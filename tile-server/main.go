package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/wise-pdf/tile-server/internal/auth"
	"github.com/wise-pdf/tile-server/internal/cache"
	"github.com/wise-pdf/tile-server/internal/handler"
	"github.com/wise-pdf/tile-server/internal/pool"
	"github.com/wise-pdf/tile-server/internal/renderer"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("🚀 WISE PDF Tile Server starting...")

	// Config from env
	port := getEnv("PORT", "8080")
	expressURL := getEnv("EXPRESS_URL", "http://app:3030")
	jwtSecret := getEnv("JWT_SECRET", "super_secret_jwt_key_for_redlines")
	maxPoolSize, _ := strconv.Atoi(getEnv("PDF_POOL_MAX_SIZE", "50"))
	tileCacheMax, _ := strconv.Atoi(getEnv("TILE_CACHE_MAX_ITEMS", "5000"))
	tileSize, _ := strconv.Atoi(getEnv("TILE_SIZE", "512"))
	diskCacheDir := getEnv("DISK_CACHE_DIR", "/tmp/tile-cache")

	log.Printf("📋 Config: port=%s, expressURL=%s, poolSize=%d, cacheItems=%d, tileSize=%d, diskCache=%s",
		port, expressURL, maxPoolSize, tileCacheMax, tileSize, diskCacheDir)

	// Init components
	jwtAuth := auth.NewJWTAuth(jwtSecret)

	// Two-level cache: L1 in-memory LRU + L2 persistent disk
	memCache := cache.NewMemoryCache(tileCacheMax)
	diskCache, err := cache.NewDiskCache(diskCacheDir)
	if err != nil {
		log.Printf("⚠️  Disk cache unavailable (%v) — using memory-only cache", err)
		diskCache = nil
	}

	var tileCache cache.Cache
	if diskCache != nil {
		tileCache = cache.NewMultiCache(memCache, diskCache)
		log.Printf("✅ Two-level cache: L1 memory=%d items, L2 disk=%s", tileCacheMax, diskCacheDir)
	} else {
		tileCache = memCache
		log.Printf("✅ Memory-only cache: %d items", tileCacheMax)
	}

	pdfPool := pool.NewPDFPool(maxPoolSize, expressURL)
	tileRenderer := renderer.NewTileRenderer(tileSize)

	// HTTP router
	r := mux.NewRouter()

	// Health check
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"tile-server","pool_size":%d,"cache_size":%d}`,
			pdfPool.Size(), tileCache.Size())
	}).Methods("GET")

	// Tile HTTP endpoint (fallback)
	tileHandler := handler.NewTileHandler(pdfPool, tileRenderer, tileCache, jwtAuth)
	r.HandleFunc("/tiles/{docId}/{page}/{zoom}/{x}/{y}", tileHandler.GetTile).Methods("GET")

	// Thumbnail endpoint
	r.HandleFunc("/thumbnail/{docId}/{page}", tileHandler.GetThumbnail).Methods("GET")

	// Preload document (blocks until ready)
	r.HandleFunc("/prepare/{docId}", tileHandler.PrepareDocument).Methods("POST")

	// Download progress for large PDFs (non-blocking poll)
	r.HandleFunc("/prepare/{docId}/status", tileHandler.PrepareStatus).Methods("GET")

	// Full-text search within a prepared document
	r.HandleFunc("/search/{docId}", tileHandler.SearchHandler).Methods("GET", "OPTIONS")

	// Detect changed regions between two PDF pages (returns JSON bounding boxes)
	// Must be registered before the tile compare route so "detect" matches literally
	r.HandleFunc("/compare/detect/{docId1}/{docId2}/{page1}/{page2}", tileHandler.DetectChanges).Methods("GET", "OPTIONS")

	// Visual diff comparison between two PDF pages
	r.HandleFunc("/compare/{docId1}/{docId2}/{page1}/{page2}/{zoom}/{x}/{y}", tileHandler.CompareHandler).Methods("GET", "OPTIONS")

	// Clear cache for document
	r.HandleFunc("/cache/{docId}", tileHandler.ClearCache).Methods("DELETE")

	// Metrics endpoint
	r.HandleFunc("/metrics", tileHandler.Metrics).Methods("GET")

	// WebSocket endpoint
	wsHandler := handler.NewWSHandler(pdfPool, tileRenderer, tileCache, jwtAuth)
	r.HandleFunc("/ws/doc/{docId}", wsHandler.HandleConnection)

	// CORS middleware
	corsHandler := corsMiddleware(r)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      corsHandler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Minute, // large PDFs can take many minutes to stream to disk
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("✅ Tile Server listening on :%s", port)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
