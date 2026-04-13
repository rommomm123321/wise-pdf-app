package renderer

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"math"
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
	pageCache *lru.Cache[string, image.Image] // ALL zoom levels, LRU 400 slots
	// zoom budget: zoom-2 letter = ~1.9MB → 400 slots ≈ 760MB max page cache
	inFlight sync.Map // "docID/page/zoom" → *renderFlight (singleflight)
}

func NewTileRenderer(tileSize int) *TileRenderer {
	if tileSize == 0 {
		tileSize = 512
	}
	// 400 page-image slots: enough for ~6 large documents at zoom 0-3
	pc, _ := lru.New[string, image.Image](400)
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
	// Smart DPI cap: allow 8x for small/medium pages, cap large pages to 4x.
	// Budget: max ~60M pixels per rendered page (safe for all GPUs).
	// A4 (595x842) at 8x = 4760x6736 = 32M pixels → OK
	// A1 (2384x3370) at 8x = 19072x26960 = 514M → TOO BIG, cap to 4x (38M)
	if scale > 4.0 && page < doc.PageCount && page < len(doc.Pages) {
		pageW := doc.Pages[page].Width
		pageH := doc.Pages[page].Height
		totalPixels := pageW * scale * 72.0 * pageH * scale * 72.0
		if totalPixels > 60_000_000 {
			// Page too large for 8x — fall back to 4x
			scale = 4.0
		}
	} else if scale > 4.0 {
		scale = 4.0
	}
	dpi := 72.0 * scale

	// Recover from fitz/mupdf panic (C code can panic on very large allocations)
	var img image.Image
	var err error
	func() {
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("fitz panic rendering page %d at DPI %.0f: %v", page, dpi, r)
			}
		}()
		h := doc.AcquireHandle()
		img, err = h.ImageDPI(page, dpi)
		doc.ReleaseHandle(h)
	}()

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
func qualityForZoom(zoom int) int {
	switch {
	case zoom <= 0:
		return 90 // thumbnails — boosted from 88
	case zoom == 1:
		return 96 // boosted from 94
	default:
		return 100 // zoom 2+: max quality (lossless encoding used below)
	}
}

// sharpenRGBA applies a lightweight unsharp mask to an RGBA image.
// This enhances text and line edges without changing tile dimensions.
// strength: 0.0 = no effect, 0.3 = subtle, 0.5 = noticeable.
func sharpenRGBA(src *image.RGBA, strength float64) *image.RGBA {
	if strength <= 0 {
		return src
	}
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w < 3 || h < 3 {
		return src
	}
	dst := image.NewRGBA(bounds)
	stride := src.Stride
	pix := src.Pix

	for y := 1; y < h-1; y++ {
		for x := 1; x < w-1; x++ {
			idx := y*stride + x*4
			for c := 0; c < 3; c++ { // R, G, B only (skip alpha)
				// 3×3 kernel center minus average of neighbors
				center := float64(pix[idx+c])
				avg := (float64(pix[(y-1)*stride+(x-1)*4+c]) +
					float64(pix[(y-1)*stride+x*4+c]) +
					float64(pix[(y-1)*stride+(x+1)*4+c]) +
					float64(pix[y*stride+(x-1)*4+c]) +
					float64(pix[y*stride+(x+1)*4+c]) +
					float64(pix[(y+1)*stride+(x-1)*4+c]) +
					float64(pix[(y+1)*stride+x*4+c]) +
					float64(pix[(y+1)*stride+(x+1)*4+c])) / 8.0
				sharp := center + (center-avg)*strength
				dst.Pix[idx+c] = uint8(math.Max(0, math.Min(255, sharp)))
			}
			dst.Pix[idx+3] = pix[idx+3] // alpha unchanged
		}
	}
	// Copy border pixels unmodified
	for x := 0; x < w; x++ {
		copy(dst.Pix[x*4:x*4+4], pix[x*4:x*4+4])
		copy(dst.Pix[(h-1)*stride+x*4:(h-1)*stride+x*4+4], pix[(h-1)*stride+x*4:(h-1)*stride+x*4+4])
	}
	for y := 0; y < h; y++ {
		copy(dst.Pix[y*stride:y*stride+4], pix[y*stride:y*stride+4])
		copy(dst.Pix[y*stride+(w-1)*4:y*stride+(w-1)*4+4], pix[y*stride+(w-1)*4:y*stride+(w-1)*4+4])
	}
	return dst
}

// Ensure color import is used
var _ = color.White

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
