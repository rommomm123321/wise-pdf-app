package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/wise-pdf/tile-server/internal/auth"
	"github.com/wise-pdf/tile-server/internal/cache"
	"github.com/wise-pdf/tile-server/internal/pool"
	"github.com/wise-pdf/tile-server/internal/renderer"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  2048,
	WriteBufferSize: 1024 * 1024, // 1MB for tiles
	CheckOrigin: func(r *http.Request) bool {
		return true // Configurable origin check for production
	},
}

type WSHandler struct {
	pool     *pool.PDFPool
	renderer *renderer.TileRenderer
	cache    cache.Cache
	auth     *auth.JWTAuth
}

func NewWSHandler(pool *pool.PDFPool, renderer *renderer.TileRenderer, c cache.Cache, auth *auth.JWTAuth) *WSHandler {
	return &WSHandler{
		pool:     pool,
		renderer: renderer,
		cache:    c,
		auth:     auth,
	}
}

// HandleConnection accepts WS connection for a specific doc
func (h *WSHandler) HandleConnection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	docID := vars["docId"]
	token := r.URL.Query().Get("token")

	// Auth Check
	_, err := h.auth.ValidateToken(token)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS Upgrade failed: %v", err)
		return
	}
	defer ws.Close()

	ws.SetReadDeadline(time.Now().Add(60 * time.Minute))

	// Pre-open PDF
	doc, err := h.pool.GetDocument(docID, token)
	if err != nil {
		sendError(ws, "failed_to_load_pdf", err.Error())
		return
	}

	// Send initial document info
	sendJSON(ws, map[string]interface{}{
		"type":      "doc_info",
		"docId":     doc.DocID,
		"pageCount": doc.PageCount,
		"pages":     doc.Pages,
	})

	// Pre-warm thumbnails in the background.
	// 50ms sleep between pages yields the fitz handle pool to tile requests.
	go func() {
		for i := 0; i < doc.PageCount; i++ {
			thumbKey := fmt.Sprintf("thumb/%s/%d", doc.DocID, i)
			if h.cache.Get(thumbKey) != nil {
				continue
			}
			data, err := h.renderer.RenderThumbnailAt(doc, i, 260)
			if err == nil {
				h.cache.Set(thumbKey, data)
			}
			time.Sleep(50 * time.Millisecond)
		}
	}()

	// Setup a write mutex to avoid concurrent writes to the same connection
	var writeMu sync.Mutex

	// Per-session cancelled tile keys: populated by "cancel" messages, checked before render+send
	var cancelled sync.Map

	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WS %s closed unexpectedly: %v", docID, err)
			}
			break
		}

		// Parse request messages
		var req map[string]interface{}
		if err := json.Unmarshal(message, &req); err != nil {
			continue
		}

		reqType, ok := req["type"].(string)
		if !ok {
			continue
		}

		switch reqType {
		case "request_tiles":
			tilesRaw, ok := req["tiles"].([]interface{})
			if !ok {
				continue
			}
			h.processTileBatch(ws, &writeMu, &cancelled, doc, tilesRaw, 4)

		case "prefetch":
			// Same as request_tiles but lower priority: concurrency=1 so visible tiles aren't starved
			tilesRaw, ok := req["tiles"].([]interface{})
			if !ok {
				continue
			}
			h.processTileBatch(ws, &writeMu, &cancelled, doc, tilesRaw, 1)

		case "cancel":
			// Mark tile keys as cancelled so in-flight goroutines skip them
			tilesRaw, ok := req["tiles"].([]interface{})
			if !ok {
				continue
			}
			for _, tRaw := range tilesRaw {
				tMap, ok := tRaw.(map[string]interface{})
				if !ok {
					continue
				}
				page := int(tMap["page"].(float64))
				zoom := int(tMap["zoom"].(float64))
				x := int(tMap["x"].(float64))
				y := int(tMap["y"].(float64))
				key := fmt.Sprintf("%s/%d/%d/%d/%d", docID, page, zoom, x, y)
				cancelled.Store(key, true)
			}
		}
	}
}

// processTileBatch renders and sends a batch of tiles with bounded concurrency.
func (h *WSHandler) processTileBatch(
	ws *websocket.Conn,
	writeMu *sync.Mutex,
	cancelled *sync.Map,
	doc *pool.OpenDocument,
	tilesRaw []interface{},
	maxConcurrent int,
) {
	sem := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup

	for _, tRaw := range tilesRaw {
		tMap, ok := tRaw.(map[string]interface{})
		if !ok {
			continue
		}

		page := int(tMap["page"].(float64))
		zoom := int(tMap["zoom"].(float64))
		x := int(tMap["x"].(float64))
		y := int(tMap["y"].(float64))

		if page < 0 || page >= doc.PageCount {
			continue
		}

		key := fmt.Sprintf("%s/%d/%d/%d/%d", doc.DocID, page, zoom, x, y)
		if _, isCancelled := cancelled.Load(key); isCancelled {
			continue
		}

		sem <- struct{}{}
		wg.Add(1)
		go func(page, zoom, x, y int, key string) {
			defer func() {
				<-sem
				wg.Done()
			}()
			// Re-check cancellation after acquiring semaphore slot
			if _, isCancelled := cancelled.Load(key); isCancelled {
				return
			}
			h.sendTile(ws, writeMu, cancelled, doc, page, zoom, x, y)
		}(page, zoom, x, y, key)
	}

	// Wait in a separate goroutine so the read loop continues immediately
	go func() { wg.Wait() }()
}

func (h *WSHandler) sendTile(ws *websocket.Conn, writeMu *sync.Mutex, cancelled *sync.Map, doc *pool.OpenDocument, page, zoom, x, y int) {
	key := fmt.Sprintf("%s/%d/%d/%d/%d", doc.DocID, page, zoom, x, y)

	var tileData []byte
	cached := h.cache.Get(key)
	if cached != nil {
		tileData = cached
	} else {
		// Render with default quality 75
		rendered, err := h.renderer.RenderTile(doc, page, zoom, x, y, 75)
		if err != nil {
			log.Printf("Render failed for %s: %v", key, err)
			return
		}
		h.cache.Set(key, rendered)
		tileData = rendered
	}

	// Final cancellation check before sending
	if _, isCancelled := cancelled.Load(key); isCancelled {
		return
	}

	// Send Binary Frame: [page(2) zoom(2) x(2) y(2) _(8) dataLen(4)] + WebP body
	header := make([]byte, 16)
	header[0] = byte(page >> 8)
	header[1] = byte(page)
	header[2] = byte(zoom >> 8)
	header[3] = byte(zoom)
	header[4] = byte(x >> 8)
	header[5] = byte(x)
	header[6] = byte(y >> 8)
	header[7] = byte(y)

	dataLen := len(tileData)
	header[12] = byte(dataLen >> 24)
	header[13] = byte(dataLen >> 16)
	header[14] = byte(dataLen >> 8)
	header[15] = byte(dataLen)

	frame := append(header, tileData...)

	writeMu.Lock()
	ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
	ws.WriteMessage(websocket.BinaryMessage, frame)
	writeMu.Unlock()
}

func sendJSON(ws *websocket.Conn, data interface{}) {
	ws.SetWriteDeadline(time.Now().Add(5 * time.Second))
	ws.WriteJSON(data)
}

func sendError(ws *websocket.Conn, code, message string) {
	sendJSON(ws, map[string]string{
		"type":    "error",
		"code":    code,
		"message": message,
	})
}
