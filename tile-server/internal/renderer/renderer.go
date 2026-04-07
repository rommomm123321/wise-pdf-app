package renderer

import (
	"bytes"
	"fmt"
	"image"
	"image/draw"
	"sync"

	lru "github.com/hashicorp/golang-lru/v2"
	"github.com/chai2010/webp"
	"github.com/wise-pdf/tile-server/internal/pool"
)

// renderFlight represents an in-progress or completed page render.
// Multiple goroutines requesting the same page/zoom share one render.
type renderFlight struct {
	img  image.Image
	err  error
	done chan struct{} // closed when render completes
}

type TileRenderer struct {
	tileSize  int
	pageCache *lru.Cache[string, image.Image] // ALL zoom levels, LRU 120 slots
	// zoom budget: zoom-2 letter = ~1.9MB → 120 slots ≈ 230MB max page cache
	inFlight sync.Map // "docID/page/zoom" → *renderFlight (singleflight)
}

func NewTileRenderer(tileSize int) *TileRenderer {
	if tileSize == 0 {
		tileSize = 512
	}
	// 120 page-image slots: enough for ~2 large documents at zoom 0-3
	pc, _ := lru.New[string, image.Image](120)
	return &TileRenderer{tileSize: tileSize, pageCache: pc}
}

// getPageImage returns the rendered full-page image for the given zoom level.
//
// Caching strategy:
//   - zoom 0-3 (scale 0.25x–2x): cached indefinitely in sync.Map (max ~8MB/page)
//   - zoom 4   (scale 4x):        LRU with 4 slots (~30MB/page)
//   - zoom 5+  (scale 8x+):       not cached at page level; tile cache handles deduplication
//
// Singleflight: concurrent requests for the same page/zoom are coalesced — only
// one fitz render runs; all waiters receive the same result.
func (r *TileRenderer) getPageImage(doc *pool.OpenDocument, page, zoom int) (image.Image, error) {
	cacheKey := fmt.Sprintf("%s/%d/%d", doc.DocID, page, zoom)

	// Fast path: check unified LRU page cache
	if cached, ok := r.pageCache.Get(cacheKey); ok {
		return cached, nil
	}

	// Singleflight: if another goroutine is already rendering this page, wait for it
	flight := &renderFlight{done: make(chan struct{})}
	actual, loaded := r.inFlight.LoadOrStore(cacheKey, flight)
	if loaded {
		f := actual.(*renderFlight)
		<-f.done
		return f.img, f.err
	}

	// We are the renderer for this page/zoom
	scale := r.zoomLevelToScale(zoom)
	dpi := 72.0 * scale

	h := doc.AcquireHandle()
	img, err := h.ImageDPI(page, dpi)
	doc.ReleaseHandle(h)

	flight.img = img
	flight.err = err

	// Store in LRU cache before broadcasting
	if err == nil {
		r.pageCache.Add(cacheKey, img)
	}

	close(flight.done)
	r.inFlight.Delete(cacheKey)

	return img, err
}

// qualityForZoom returns the WebP encode quality (0-100) for a given zoom level.
// Higher zoom = larger tiles visible on screen = need higher fidelity.
func qualityForZoom(zoom int) int {
	switch {
	case zoom <= 0:
		return 78 // thumbnails — small on screen but should look decent
	case zoom == 1:
		return 85
	case zoom == 2:
		return 90
	case zoom == 3:
		return 95
	default:
		return 97 // zoom 4+ (2x–8x): near-lossless, text must be crystal clear
	}
}

// RenderTile extracts a 512×512 tile from a PDF page at the given zoom level.
// quality: 0-100 WebP quality (0 = auto-select based on zoom level)
func (r *TileRenderer) RenderTile(doc *pool.OpenDocument, page, zoom, tileX, tileY int, quality int) ([]byte, error) {
	img, err := r.getPageImage(doc, page, zoom)
	if err != nil {
		return nil, fmt.Errorf("failed to render page: %w", err)
	}

	x0 := tileX * r.tileSize
	y0 := tileY * r.tileSize
	x1 := x0 + r.tileSize
	y1 := y0 + r.tileSize

	bounds := img.Bounds()
	if x1 > bounds.Max.X {
		x1 = bounds.Max.X
	}
	if y1 > bounds.Max.Y {
		y1 = bounds.Max.Y
	}
	if x0 >= bounds.Max.X || y0 >= bounds.Max.Y {
		return r.emptyWebP()
	}

	rect := image.Rect(x0, y0, x1, y1)
	cropped := image.NewRGBA(image.Rect(0, 0, x1-x0, y1-y0))
	draw.Draw(cropped, cropped.Bounds(), img, rect.Min, draw.Src)

	var buf bytes.Buffer
	// Use provided quality, or auto-select by zoom level for sharpest result
	q := quality
	if q <= 0 {
		q = qualityForZoom(zoom)
	}
	if q > 100 {
		q = 100
	}
	
	if err := webp.Encode(&buf, cropped, &webp.Options{Lossless: false, Quality: float32(q)}); err != nil {
		return nil, fmt.Errorf("failed to encode WebP: %w", err)
	}
	return buf.Bytes(), nil
}

// TileSize returns the configured tile size in pixels (default 512).
func (r *TileRenderer) TileSize() int {
	return r.tileSize
}

// ZoomLevelToScale converts a discrete zoom level to a float scale factor.
func (r *TileRenderer) ZoomLevelToScale(zoom int) float64 {
	return r.zoomLevelToScale(zoom)
}

// GetPageImage renders a full-page image at the given zoom level, with caching and singleflight.
func (r *TileRenderer) GetPageImage(doc *pool.OpenDocument, page, zoom int) (image.Image, error) {
	return r.getPageImage(doc, page, zoom)
}

func (r *TileRenderer) zoomLevelToScale(zoom int) float64 {
	scales := []float64{0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0}
	if zoom < 0 {
		zoom = 0
	}
	if zoom >= len(scales) {
		zoom = len(scales) - 1
	}
	return scales[zoom]
}

// RenderThumbnailAt renders a page at targetWidthPx.
// Reuses cached page images (zoom-1 or zoom-0) to avoid extra fitz calls.
func (r *TileRenderer) RenderThumbnailAt(doc *pool.OpenDocument, page int, targetWidthPx int) ([]byte, error) {
	if page < 0 || page >= doc.PageCount || len(doc.Pages) <= page {
		return r.emptyWebP()
	}
	pageInfo := doc.Pages[page]
	if pageInfo.Width <= 0 {
		return r.emptyWebP()
	}

	// Prefer cached zoom-1 (~306px wide for letter) — good enough for 260px thumbnail
	for _, zoom := range []int{1, 0} {
		cacheKey := fmt.Sprintf("%s/%d/%d", doc.DocID, page, zoom)
		if cached, ok := r.pageCache.Get(cacheKey); ok {
			if cached.Bounds().Dx() >= 64 {
				var buf bytes.Buffer
				if err := webp.Encode(&buf, cached, &webp.Options{Lossless: false, Quality: 88}); err == nil {
					return buf.Bytes(), nil
				}
			}
		}
	}

	// No cache hit — render at thumbnail DPI
	dpi := float64(targetWidthPx) / pageInfo.Width * 72.0
	if dpi < 8 {
		dpi = 8
	}
	if dpi > 144 {
		dpi = 144
	}

	h := doc.AcquireHandle()
	img, err := h.ImageDPI(page, dpi)
	doc.ReleaseHandle(h)
	if err != nil {
		return nil, fmt.Errorf("thumbnail render failed: %w", err)
	}

	var buf bytes.Buffer
	if err := webp.Encode(&buf, img, &webp.Options{Lossless: false, Quality: 88}); err != nil {
		return nil, fmt.Errorf("thumbnail webp encode failed: %w", err)
	}
	return buf.Bytes(), nil
}

// InvalidateDoc removes all cached page images for a document.
func (r *TileRenderer) InvalidateDoc(docID string) {
	for _, k := range r.pageCache.Keys() {
		if len(k) >= len(docID) && k[:len(docID)] == docID {
			r.pageCache.Remove(k)
		}
	}
}

func (r *TileRenderer) emptyWebP() ([]byte, error) {
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	var buf bytes.Buffer
	err := webp.Encode(&buf, img, &webp.Options{Lossless: true})
	return buf.Bytes(), err
}
