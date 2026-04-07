package cache

import (
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// DiskCache stores tiles as files on disk so they survive server restarts.
// Writes are atomic: data is first written to a .tmp file, then renamed.
// Eviction runs periodically: when file count exceeds maxFiles, oldest files are removed.
type DiskCache struct {
	dir      string
	maxFiles int
	hits     int64
	misses   int64
	mu       sync.Mutex // guards eviction
}

const defaultMaxDiskFiles = 20000 // ~20k tiles × ~15KB avg = ~300MB

func NewDiskCache(dir string) (*DiskCache, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	dc := &DiskCache{dir: dir, maxFiles: defaultMaxDiskFiles}
	go dc.evictionLoop()
	return dc, nil
}

// keyToPath converts a tile key like "docId/0/2/1/3" into a safe filename.
func (c *DiskCache) keyToPath(key string) string {
	safe := strings.ReplaceAll(key, "/", "_")
	return filepath.Join(c.dir, safe+".webp")
}

func (c *DiskCache) Get(key string) []byte {
	data, err := os.ReadFile(c.keyToPath(key))
	if err != nil {
		atomic.AddInt64(&c.misses, 1)
		return nil
	}
	atomic.AddInt64(&c.hits, 1)
	// Touch atime by rewriting (best-effort, keeps LRU accurate)
	path := c.keyToPath(key)
	now := time.Now()
	os.Chtimes(path, now, now)
	return data
}

func (c *DiskCache) Set(key string, data []byte) {
	path := c.keyToPath(key)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return
	}
	os.Rename(tmp, path) // atomic on Linux/macOS; best-effort on Windows
}

func (c *DiskCache) DeleteByPrefix(prefix string) int {
	safePrefix := strings.ReplaceAll(prefix, "/", "_")
	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), safePrefix) {
			os.Remove(filepath.Join(c.dir, e.Name()))
			count++
		}
	}
	return count
}

func (c *DiskCache) Size() int {
	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".webp") {
			count++
		}
	}
	return count
}

func (c *DiskCache) Stats() (hits, misses int64) {
	return atomic.LoadInt64(&c.hits), atomic.LoadInt64(&c.misses)
}

// evictionLoop runs every 5 minutes and removes oldest files when count > maxFiles.
func (c *DiskCache) evictionLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		c.evictOldest()
	}
}

func (c *DiskCache) evictOldest() {
	c.mu.Lock()
	defer c.mu.Unlock()

	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return
	}

	type fileInfo struct {
		name    string
		modTime time.Time
	}

	var files []fileInfo
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".webp") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		files = append(files, fileInfo{name: e.Name(), modTime: info.ModTime()})
	}

	if len(files) <= c.maxFiles {
		return
	}

	// Sort oldest first
	sort.Slice(files, func(i, j int) bool {
		return files[i].modTime.Before(files[j].modTime)
	})

	// Remove oldest until under 80% of limit (hysteresis to avoid evicting every cycle)
	target := int(float64(c.maxFiles) * 0.8)
	removed := 0
	for _, f := range files {
		if len(files)-removed <= target {
			break
		}
		os.Remove(filepath.Join(c.dir, f.name))
		removed++
	}

	if removed > 0 {
		log.Printf("[DiskCache] Evicted %d oldest tiles (was %d, target %d)", removed, len(files), target)
	}
}
