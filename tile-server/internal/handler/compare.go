package handler

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"net/http"
	"strconv"

	"github.com/chai2010/webp"
	"github.com/gorilla/mux"
)

// parseHexColor parses a 6-digit hex color string (e.g. "CC0000") into RGB components.
func parseHexColor(hex string) (uint8, uint8, uint8) {
	if len(hex) != 6 {
		return 0, 0, 0
	}
	r, _ := strconv.ParseUint(hex[0:2], 16, 8)
	g, _ := strconv.ParseUint(hex[2:4], 16, 8)
	b, _ := strconv.ParseUint(hex[4:6], 16, 8)
	return uint8(r), uint8(g), uint8(b)
}

// toGray returns the luminance of an RGBA pixel (BT.601 weights).
func toGray(r, g, b uint32) uint8 {
	// r, g, b are 16-bit (0..65535); convert to 8-bit after weighting.
	return uint8((19595*r + 38470*g + 7471*b + 1<<15) >> 24)
}

// CompareHandler renders a pixel-diff tile comparing two PDF pages.
//
// GET /compare/{docId1}/{docId2}/{page1}/{page2}/{zoom}/{x}/{y}?token=...&oldColor=CC0000&newColor=0033CC&opacity=50&alignMode=direct
//
// Both documents must already be prepared in the pool (via /prepare/).
// Returns 404 if either document is not ready.
func (h *TileHandler) CompareHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	docID1 := vars["docId1"]
	docID2 := vars["docId2"]
	page1, _ := strconv.Atoi(vars["page1"])
	page2, _ := strconv.Atoi(vars["page2"])
	zoom, _ := strconv.Atoi(vars["zoom"])
	tileX, _ := strconv.Atoi(vars["x"])
	tileY, _ := strconv.Atoi(vars["y"])
	token := r.URL.Query().Get("token")

	// --- Auth ---
	if token == "" {
		http.Error(w, "Missing JWT token", http.StatusUnauthorized)
		return
	}
	if _, err := h.auth.ValidateToken(token); err != nil {
		http.Error(w, "Invalid token", http.StatusForbidden)
		return
	}

	// --- Parse optional parameters ---
	oldColorHex := r.URL.Query().Get("oldColor")
	if oldColorHex == "" {
		oldColorHex = "CC0000"
	}
	newColorHex := r.URL.Query().Get("newColor")
	if newColorHex == "" {
		newColorHex = "0033CC"
	}
	opacityPct := 50
	if opStr := r.URL.Query().Get("opacity"); opStr != "" {
		if v, err := strconv.Atoi(opStr); err == nil && v >= 0 && v <= 100 {
			opacityPct = v
		}
	}
	// showOld/showNew: 1=visible, 0=hidden (default both visible)
	showOld := r.URL.Query().Get("showOld") != "0"
	showNew := r.URL.Query().Get("showNew") != "0"

	oldR, oldG, oldB := parseHexColor(oldColorHex)
	newR, newG, newB := parseHexColor(newColorHex)
	_ = opacityPct // reserved for future blend modes

	// --- Cache key ---
	showOldInt, showNewInt := 1, 1
	if !showOld { showOldInt = 0 }
	if !showNew { showNewInt = 0 }
	cacheKey := fmt.Sprintf("cmp/%s/%s/%d/%d/%d/%d/%d/%s/%s/%d/%d/%d",
		docID1, docID2, page1, page2, zoom, tileX, tileY, oldColorHex, newColorHex, opacityPct, showOldInt, showNewInt)

	if data := h.cache.Get(cacheKey); data != nil {
		etag := tileETag(data)
		if r.Header.Get("If-None-Match") == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("Content-Type", "image/webp")
		w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
		w.Header().Set("ETag", etag)
		w.Write(data)
		return
	}

	// --- Get both documents from pool (must be already prepared) ---
	doc1, ready1 := h.pool.GetDocumentIfReady(docID1)
	if !ready1 {
		http.Error(w, fmt.Sprintf("Document %s not prepared. Call /prepare/ first.", docID1), http.StatusNotFound)
		return
	}
	doc2, ready2 := h.pool.GetDocumentIfReady(docID2)
	if !ready2 {
		http.Error(w, fmt.Sprintf("Document %s not prepared. Call /prepare/ first.", docID2), http.StatusNotFound)
		return
	}

	// --- Validate page bounds ---
	if page1 < 0 || page1 >= doc1.PageCount {
		http.Error(w, "page1 out of bounds", http.StatusBadRequest)
		return
	}
	if page2 < 0 || page2 >= doc2.PageCount {
		http.Error(w, "page2 out of bounds", http.StatusBadRequest)
		return
	}

	// --- Render both pages at the requested zoom level ---
	h.renderSem <- struct{}{}
	img1, err := h.renderer.GetPageImage(doc1, page1, zoom)
	<-h.renderSem
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to render doc1 page %d: %v", page1, err), http.StatusInternalServerError)
		return
	}

	h.renderSem <- struct{}{}
	img2, err := h.renderer.GetPageImage(doc2, page2, zoom)
	<-h.renderSem
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to render doc2 page %d: %v", page2, err), http.StatusInternalServerError)
		return
	}

	// --- Extract tile region from each image ---
	tileSize := h.renderer.TileSize()
	x0 := tileX * tileSize
	y0 := tileY * tileSize
	x1 := x0 + tileSize
	y1 := y0 + tileSize

	bounds1 := img1.Bounds()
	bounds2 := img2.Bounds()

	// Clamp to the larger of the two images so we diff as much as possible
	maxW := bounds1.Max.X
	if bounds2.Max.X > maxW {
		maxW = bounds2.Max.X
	}
	maxH := bounds1.Max.Y
	if bounds2.Max.Y > maxH {
		maxH = bounds2.Max.Y
	}

	if x0 >= maxW || y0 >= maxH {
		// Tile is completely outside both images — return empty
		empty, _ := emptyWebP()
		w.Header().Set("Content-Type", "image/webp")
		w.Write(empty)
		return
	}
	if x1 > maxW {
		x1 = maxW
	}
	if y1 > maxH {
		y1 = maxH
	}

	tileW := x1 - x0
	tileH := y1 - y0

	// --- Bluebeam-style tinting ---
	// ALL content from old doc is tinted oldColor (red).
	// ALL content from new doc is tinted newColor (green).
	// Overlay: where both match → dark gray. Where only old → red. Where only new → green.
	// showOld/showNew control which layers are visible.

	result := image.NewRGBA(image.Rect(0, 0, tileW, tileH))

	for dy := 0; dy < tileH; dy++ {
		for dx := 0; dx < tileW; dx++ {
			px := x0 + dx
			py := y0 + dy

			// Get grayscale intensity (0=black content, 255=white background)
			var gray1, gray2 uint8 = 255, 255
			if px < bounds1.Max.X && py < bounds1.Max.Y {
				r, g, b, _ := img1.At(px, py).RGBA()
				gray1 = toGray(r, g, b)
			}
			if px < bounds2.Max.X && py < bounds2.Max.Y {
				r, g, b, _ := img2.At(px, py).RGBA()
				gray2 = toGray(r, g, b)
			}

			// Content intensity: 0=background, 1=dark content
			ink1 := 1.0 - float64(gray1)/255.0 // old doc ink
			ink2 := 1.0 - float64(gray2)/255.0 // new doc ink

			// Start with white background
			var outR, outG, outB float64 = 255, 255, 255

			// Blend: tint each layer's content with its color, overlay on white
			if showOld && ink1 > 0.02 {
				// Old content → tinted with oldColor
				outR -= ink1 * (255 - float64(oldR))
				outG -= ink1 * (255 - float64(oldG))
				outB -= ink1 * (255 - float64(oldB))
			}
			if showNew && ink2 > 0.02 {
				// New content → tinted with newColor
				outR -= ink2 * (255 - float64(newR))
				outG -= ink2 * (255 - float64(newG))
				outB -= ink2 * (255 - float64(newB))
			}

			// Clamp
			if outR < 0 { outR = 0 }
			if outG < 0 { outG = 0 }
			if outB < 0 { outB = 0 }

			result.SetRGBA(dx, dy, color.RGBA{R: uint8(outR), G: uint8(outG), B: uint8(outB), A: 255})
		}
	}

	// --- Encode as WebP ---
	var buf bytes.Buffer
	q := qualityForCompare(zoom)
	if err := webp.Encode(&buf, result, &webp.Options{Lossless: false, Quality: float32(q)}); err != nil {
		http.Error(w, fmt.Sprintf("Failed to encode comparison tile: %v", err), http.StatusInternalServerError)
		return
	}

	webpBytes := buf.Bytes()
	h.cache.Set(cacheKey, webpBytes)

	etag := tileETag(webpBytes)
	w.Header().Set("Content-Type", "image/webp")
	w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
	w.Header().Set("ETag", etag)
	w.Write(webpBytes)
}

// qualityForCompare returns WebP quality for comparison tiles.
// Slightly higher than normal tiles since diff colors need fidelity.
func qualityForCompare(zoom int) int {
	switch {
	case zoom <= 0:
		return 82
	case zoom == 1:
		return 88
	case zoom == 2:
		return 92
	default:
		return 96
	}
}

// emptyWebP returns a minimal 1x1 transparent WebP image.
func emptyWebP() ([]byte, error) {
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	draw.Draw(img, img.Bounds(), &image.Uniform{color.Transparent}, image.Point{}, draw.Src)
	var buf bytes.Buffer
	err := webp.Encode(&buf, img, &webp.Options{Lossless: true})
	return buf.Bytes(), err
}
