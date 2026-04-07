package handler

import (
	"encoding/json"
	"fmt"
	"hash/crc32"
	"log"
	"net/http"
	"runtime"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/wise-pdf/tile-server/internal/auth"
	"github.com/wise-pdf/tile-server/internal/cache"
	"github.com/wise-pdf/tile-server/internal/pool"
	"github.com/wise-pdf/tile-server/internal/renderer"
)

// tileETag returns a quoted ETag for a tile payload using CRC32 (fast, non-crypto).
func tileETag(data []byte) string {
	return fmt.Sprintf(`"%08x"`, crc32.ChecksumIEEE(data))
}

type TileHandler struct {
	pool      *pool.PDFPool
	renderer  *renderer.TileRenderer
	cache     cache.Cache
	auth      *auth.JWTAuth
	renderSem chan struct{} // global limit on concurrent page renders
}

func NewTileHandler(pool *pool.PDFPool, renderer *renderer.TileRenderer, c cache.Cache, auth *auth.JWTAuth) *TileHandler {
	// Cap concurrent renders at 2× CPU count; singleflight in renderer further reduces duplicates
	semSize := runtime.GOMAXPROCS(0) * 2
	if semSize < 4 {
		semSize = 4
	}
	if semSize > 16 {
		semSize = 16
	}
	return &TileHandler{
		pool:      pool,
		renderer:  renderer,
		cache:     c,
		auth:      auth,
		renderSem: make(chan struct{}, semSize),
	}
}

// GetTile handles HTTP GET for a single tile: /tiles/{docId}/{page}/{zoom}/{x}/{y}?token=...&q=75
func (h *TileHandler) GetTile(w http.ResponseWriter, r *http.Request) {
	log.Printf("[HTTP] GetTile request: %s", r.URL.Path)
	vars := mux.Vars(r)
	docID := vars["docId"]
	page, _ := strconv.Atoi(vars["page"])
	zoom, _ := strconv.Atoi(vars["zoom"])
	x, _ := strconv.Atoi(vars["x"])
	y, _ := strconv.Atoi(vars["y"])
	token := r.URL.Query().Get("token")
	
	// Parse quality parameter (0 = auto based on zoom level)
	quality := 0 // 0 = auto; let renderer pick best quality for this zoom
	if qStr := r.URL.Query().Get("q"); qStr != "" {
		if q, err := strconv.Atoi(qStr); err == nil && q > 0 && q <= 100 {
			quality = q
		}
	}

	if token == "" {
		http.Error(w, "Missing JWT token", http.StatusUnauthorized)
		return
	}
	_, err := h.auth.ValidateToken(token)
	if err != nil {
		http.Error(w, "Invalid token", http.StatusForbidden)
		return
	}

	// Cache key encodes zoom (which determines quality when q=auto),
	// so tiles are not shared across different quality levels.
	key := fmt.Sprintf("%s/%d/%d/%d/%d/q%d", docID, page, zoom, x, y, quality)

	// Cache check — serve with ETag so browser gets 304 on repeat visits
	if data := h.cache.Get(key); data != nil {
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

	// Not in cache, render it
	doc, err := h.pool.GetDocument(docID, token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if page < 0 || page >= doc.PageCount {
		http.Error(w, "Page out of bounds", http.StatusBadRequest)
		return
	}

	// Acquire global render slot — prevents CPU overload when many tiles arrive simultaneously.
	// Singleflight in renderer further deduplicates concurrent renders of the same page/zoom.
	h.renderSem <- struct{}{}
	webpBytes, err := h.renderer.RenderTile(doc, page, zoom, x, y, quality)
	<-h.renderSem
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.cache.Set(key, webpBytes)

	etag := tileETag(webpBytes)
	w.Header().Set("Content-Type", "image/webp")
	w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
	w.Header().Set("ETag", etag)
	w.Write(webpBytes)
}

func (h *TileHandler) GetThumbnail(w http.ResponseWriter, r *http.Request) {
	log.Printf("[HTTP] GetThumbnail request: %s", r.URL.Path)
	vars := mux.Vars(r)
	docID := vars["docId"]
	page, _ := strconv.Atoi(vars["page"])
	token := r.URL.Query().Get("token")

	if token == "" {
		http.Error(w, "Missing JWT token", http.StatusUnauthorized)
		return
	}
	if _, err := h.auth.ValidateToken(token); err != nil {
		http.Error(w, "Invalid token", http.StatusForbidden)
		return
	}

	key := fmt.Sprintf("thumb/%s/%d", docID, page)
	if data := h.cache.Get(key); data != nil {
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

	doc, err := h.pool.GetDocument(docID, token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if page < 0 || page >= doc.PageCount {
		http.Error(w, "Page out of bounds", http.StatusBadRequest)
		return
	}

	// Render at 260px wide (2× the 130px display size for sharp retina thumbnails)
	webpBytes, err := h.renderer.RenderThumbnailAt(doc, page, 260)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.cache.Set(key, webpBytes)
	etag := tileETag(webpBytes)
	w.Header().Set("Content-Type", "image/webp")
	w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
	w.Header().Set("ETag", etag)
	w.Write(webpBytes)
}

func (h *TileHandler) PrepareDocument(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	docID := vars["docId"]
	token := r.URL.Query().Get("token")

	// Open it (downloads to pool if not present)
	doc, err := h.pool.GetDocument(docID, token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "ok",
		"docId":     doc.DocID,
		"pageCount": doc.PageCount,
		"pages":     doc.Pages,
	})
}

// PrepareStatus returns download progress for a large PDF being loaded in the background.
// GET /prepare/{docId}/status?token=...
// Response: { "ready": bool, "written": bytes, "total": bytes, "percent": float }
func (h *TileHandler) PrepareStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	docID := vars["docId"]
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Missing token", http.StatusUnauthorized)
		return
	}
	if _, err := h.auth.ValidateToken(token); err != nil {
		http.Error(w, "Invalid token", http.StatusForbidden)
		return
	}

	written, total, done := h.pool.GetDownloadProgress(docID)
	pct := 0.0
	if total > 0 {
		pct = float64(written) / float64(total) * 100
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ready":   done,
		"written": written,
		"total":   total,
		"percent": pct,
	})
}


func (h *TileHandler) ClearCache(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	docID := vars["docId"]

	h.pool.RemoveDocument(docID)
	removed := h.cache.DeleteByPrefix(docID + "/")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "ok",
		"removed_tiles": removed,
	})
}

// Metrics returns JSON with cache stats, pool size, and hit ratio.
func (h *TileHandler) Metrics(w http.ResponseWriter, r *http.Request) {
	hits, misses := h.cache.Stats()
	total := hits + misses
	hitRatio := 0.0
	if total > 0 {
		hitRatio = float64(hits) / float64(total)
	}

	// If MultiCache, expose L1/L2 sizes separately
	l1Size, l2Size := 0, 0
	if mc, ok := h.cache.(*cache.MultiCache); ok {
		l1Size = mc.L1Size()
		l2Size = mc.L2Size()
	} else {
		l1Size = h.cache.Size()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"pool_size":  h.pool.Size(),
		"cache_size": h.cache.Size(),
		"l1_size":    l1Size,
		"l2_size":    l2Size,
		"hits":       hits,
		"misses":     misses,
		"hit_ratio":  hitRatio,
	})
}
