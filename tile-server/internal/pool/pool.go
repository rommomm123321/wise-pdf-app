package pool

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gen2brain/go-fitz"
)

// fitzHandleCount: 2 handles per document (was 4).
// Each handle holds the entire PDF in MuPDF's heap — halving this halves per-doc memory.
const fitzHandleCount = 2

// idleEvictAfter: documents not accessed for this long are closed and freed.
const idleEvictAfter = 5 * time.Minute

type PageInfo struct {
	Width  float64 `json:"w"`
	Height float64 `json:"h"`
	Label  string  `json:"label,omitempty"`
}

type OpenDocument struct {
	mu        sync.Mutex
	DocID     string
	handles   chan *fitz.Document
	PageCount int
	Pages     []PageInfo
	FilePath  string
	LastUsed  time.Time
}

func (d *OpenDocument) AcquireHandle() *fitz.Document {
	return <-d.handles
}

func (d *OpenDocument) ReleaseHandle(h *fitz.Document) {
	d.handles <- h
}

func (d *OpenDocument) TouchLastUsed() {
	d.mu.Lock()
	d.LastUsed = time.Now()
	d.mu.Unlock()
}

func (d *OpenDocument) GetLastUsed() time.Time {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.LastUsed
}

// downloadFlight tracks a background PDF download in progress.
// Multiple callers share a single download via the done channel.
type downloadFlight struct {
	done     chan struct{} // closed when download+open completes
	doc      *OpenDocument
	err      error
	// progress counters (atomic) for status polling
	total    int64 // Content-Length (-1 if unknown)
	written  int64 // bytes written so far
}

type PDFPool struct {
	mu         sync.RWMutex
	maxSize    int
	expressURL string
	documents  map[string]*OpenDocument
	flights    map[string]*downloadFlight // in-progress downloads
}

func NewPDFPool(maxSize int, expressURL string) *PDFPool {
	if maxSize == 0 {
		maxSize = 20
	}
	p := &PDFPool{
		maxSize:    maxSize,
		expressURL: expressURL,
		documents:  make(map[string]*OpenDocument),
		flights:    make(map[string]*downloadFlight),
	}
	go p.idleEvictionLoop()
	return p
}

// idleEvictionLoop runs every minute and closes documents idle for >idleEvictAfter.
// This is the primary mechanism for keeping memory bounded in production.
func (p *PDFPool) idleEvictionLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		p.evictIdle()
	}
}

func (p *PDFPool) evictIdle() {
	now := time.Now()
	p.mu.Lock()
	defer p.mu.Unlock()
	for id, doc := range p.documents {
		if now.Sub(doc.GetLastUsed()) > idleEvictAfter {
			p.removeDocumentLocked(id)
			log.Printf("[Pool] Idle evicted %s (unused for >%v)", id, idleEvictAfter)
		}
	}
}

// GetDocument returns an open document, starting a background download if needed.
// It blocks ONLY until the download+open completes (using singleflight pattern).
func (p *PDFPool) GetDocument(docID string, jwtToken string) (*OpenDocument, error) {
	// Fast path: already open
	p.mu.RLock()
	doc, exists := p.documents[docID]
	p.mu.RUnlock()
	if exists {
		doc.TouchLastUsed()
		return doc, nil
	}

	// Check/start a background flight
	p.mu.Lock()
	// Double-check after acquiring write lock
	if doc, exists := p.documents[docID]; exists {
		p.mu.Unlock()
		doc.TouchLastUsed()
		return doc, nil
	}

	// Re-use existing flight if one is already downloading this doc
	flight, inProgress := p.flights[docID]
	if !inProgress {
		flight = &downloadFlight{
			done:  make(chan struct{}),
			total: -1,
		}
		p.flights[docID] = flight
		go p.runDownload(docID, jwtToken, flight)
	}
	p.mu.Unlock()

	// Wait for download to complete
	<-flight.done

	if flight.err != nil {
		// Remove failed flight so next request retries
		p.mu.Lock()
		delete(p.flights, docID)
		p.mu.Unlock()
		return nil, flight.err
	}
	return flight.doc, nil
}

// GetDownloadProgress returns (written, total, done) for a document being downloaded.
// Returns (0, -1, false) if no download is in progress.
func (p *PDFPool) GetDownloadProgress(docID string) (written, total int64, done bool) {
	p.mu.RLock()
	_, docReady := p.documents[docID]
	flight, inFlight := p.flights[docID]
	p.mu.RUnlock()

	if docReady {
		return 0, 0, true
	}
	if inFlight {
		w := atomic.LoadInt64(&flight.written)
		t := atomic.LoadInt64(&flight.total)
		return w, t, false
	}
	return 0, -1, false
}

// runDownload executes the actual download+open, recording progress into flight.
func (p *PDFPool) runDownload(docID, jwtToken string, flight *downloadFlight) {
	defer close(flight.done)

	doc, err := p.downloadAndOpen(docID, jwtToken, flight)
	if err != nil {
		flight.err = err
		log.Printf("[Pool] Download failed for %s: %v", docID, err)
		return
	}

	p.mu.Lock()
	if len(p.documents) >= p.maxSize {
		p.evictOldest()
	}
	p.documents[docID] = doc
	delete(p.flights, docID)
	p.mu.Unlock()

	flight.doc = doc
	log.Printf("[Pool] Ready: %s (%d pages)", docID, doc.PageCount)
}



func (p *PDFPool) downloadAndOpen(docID string, jwtToken string, flight *downloadFlight) (*OpenDocument, error) {
	log.Printf("[Pool] Downloading PDF %s ...", docID)
	url := fmt.Sprintf("%s/api/documents/%s/proxy", p.expressURL, docID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	if jwtToken != "" {
		req.Header.Set("Authorization", "Bearer "+jwtToken)
	}

	// Large PDFs (800-900 MB) need a longer timeout.
	// We stream directly to disk — no full-file RAM spike.
	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to reach external API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// Stream directly to disk — avoids loading entire large PDF into RAM.
	// For a 900 MB file this saves ~900 MB of heap pressure.
	// Track progress atomically so /prepare/status can poll it.
	if cl := resp.ContentLength; cl > 0 && flight != nil {
		atomic.StoreInt64(&flight.total, cl)
	}
	filePath := filepath.Join("/tmp/pdfs", docID+".pdf")
	f, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}

	// progressReader wraps resp.Body and counts bytes written
	var progressReader io.Reader = resp.Body
	if flight != nil {
		progressReader = &countingReader{r: resp.Body, n: &flight.written}
	}
	written, err := io.Copy(f, progressReader)
	f.Close()
	if err != nil {
		os.Remove(filePath)
		return nil, fmt.Errorf("failed to stream PDF to disk: %w", err)
	}
	log.Printf("[Pool] Downloaded %d bytes for %s (streamed)", written, docID)

	log.Printf("[Pool] Opening %d fitz handles for %s ...", fitzHandleCount, docID)
	var openedHandles []*fitz.Document
	for i := 0; i < fitzHandleCount; i++ {
		h, err := fitz.New(filePath)
		if err != nil {
			for _, oh := range openedHandles {
				oh.Close()
			}
			return nil, fmt.Errorf("failed to open fitz handle %d: %w", i, err)
		}
		openedHandles = append(openedHandles, h)
	}

	first := openedHandles[0]
	pageCount := first.NumPage()
	pages := make([]PageInfo, pageCount)
	
	// Map ToC bookmarks to page labels — LEAF nodes only.
	// Container entries like "Sheets" have children (next entry has deeper Level) and must
	// be skipped, otherwise "Sheets" would become the label for the first sheet page.
	// An entry is a leaf if the NEXT entry has the same or shallower level (or it's the last).
	toc, err := first.ToC()
	labelMap := make(map[int]string)
	if err == nil {
		for i, entry := range toc {
			isLeaf := i == len(toc)-1 || toc[i+1].Level <= entry.Level
			if isLeaf && entry.Page >= 0 && entry.Page < pageCount {
				// Only use the first (highest-priority) bookmark for a page
				if _, exists := labelMap[entry.Page]; !exists {
					labelMap[entry.Page] = entry.Title
				}
			}
		}
	}

	for i := 0; i < pageCount; i++ {
		rect, boundErr := first.Bound(i)
		width, height := 612.0, 792.0
		if boundErr == nil {
			width = float64(rect.Dx())
			height = float64(rect.Dy())
		}
		label := labelMap[i]
		pages[i] = PageInfo{Width: width, Height: height, Label: label}
	}

	handles := make(chan *fitz.Document, fitzHandleCount)
	for _, h := range openedHandles {
		handles <- h
	}

	log.Printf("[Pool] Opened %s — pages: %d, handles: %d", docID, pageCount, fitzHandleCount)

	return &OpenDocument{
		DocID:     docID,
		handles:   handles,
		PageCount: pageCount,
		Pages:     pages,
		FilePath:  filePath,
		LastUsed:  time.Now(),
	}, nil
}

func (p *PDFPool) evictOldest() {
	var oldestID string
	var oldestTime time.Time
	for id, doc := range p.documents {
		lu := doc.GetLastUsed()
		if oldestID == "" || lu.Before(oldestTime) {
			oldestID = id
			oldestTime = lu
		}
	}
	if oldestID != "" {
		p.removeDocumentLocked(oldestID)
	}
}

func (p *PDFPool) RemoveDocument(docID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.removeDocumentLocked(docID)
}

func (p *PDFPool) removeDocumentLocked(docID string) {
	doc, exists := p.documents[docID]
	if !exists {
		return
	}
	delete(p.documents, docID)
	go func() {
		for i := 0; i < fitzHandleCount; i++ {
			h := <-doc.handles
			h.Close()
		}
		os.Remove(doc.FilePath)
		log.Printf("[Pool] Freed %s", docID)
	}()
}

func (p *PDFPool) Size() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.documents)
}

// GetDocumentIfReady returns the document only if it is already loaded in the pool.
// Unlike GetDocument, it does NOT trigger a download. Returns (nil, false) if not present.
func (p *PDFPool) GetDocumentIfReady(docID string) (*OpenDocument, bool) {
	p.mu.RLock()
	doc, exists := p.documents[docID]
	p.mu.RUnlock()
	if exists {
		doc.TouchLastUsed()
	}
	return doc, exists
}

// countingReader wraps an io.Reader and atomically increments *n for every byte read.
// Used to track download progress for large PDF files.
type countingReader struct {
	r io.Reader
	n *int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	if n > 0 {
		atomic.AddInt64(c.n, int64(n))
	}
	return n, err
}
