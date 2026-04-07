package cache

import (
	"container/list"
	"fmt"
	"sync"
)

// TileKey represents a unique tile identifier
type TileKey struct {
	DocID string
	Page  int
	Zoom  int
	X     int
	Y     int
}

func (k TileKey) String() string {
	return fmt.Sprintf("%s/%d/%d/%d/%d", k.DocID, k.Page, k.Zoom, k.X, k.Y)
}

// MemoryCache is a thread-safe LRU tile cache.
// Uses container/list for O(1) moveToEnd instead of O(n) linear scan.
type MemoryCache struct {
	maxItems int
	items    map[string]*list.Element
	order    *list.List // front = oldest, back = newest
	mu       sync.RWMutex
	hits     int64
	misses   int64
}

type cacheEntry struct {
	key  string
	data []byte
}

func NewMemoryCache(maxItems int) *MemoryCache {
	return &MemoryCache{
		maxItems: maxItems,
		items:    make(map[string]*list.Element, maxItems),
		order:    list.New(),
	}
}

// Get retrieves a tile from cache. Returns nil if not found.
func (c *MemoryCache) Get(key string) []byte {
	c.mu.Lock()
	defer c.mu.Unlock()

	el, ok := c.items[key]
	if ok {
		c.hits++
		c.order.MoveToBack(el) // O(1)
		return el.Value.(*cacheEntry).data
	}

	c.misses++
	return nil
}

// Set stores a tile in cache with LRU eviction.
func (c *MemoryCache) Set(key string, data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Already exists — update in place
	if el, ok := c.items[key]; ok {
		el.Value.(*cacheEntry).data = data
		c.order.MoveToBack(el)
		return
	}

	// Evict oldest until under limit
	for c.order.Len() >= c.maxItems {
		front := c.order.Front()
		if front == nil {
			break
		}
		evicted := c.order.Remove(front).(*cacheEntry)
		delete(c.items, evicted.key)
	}

	entry := &cacheEntry{key: key, data: data}
	el := c.order.PushBack(entry)
	c.items[key] = el
}

// DeleteByPrefix removes all tiles for a document
func (c *MemoryCache) DeleteByPrefix(prefix string) int {
	c.mu.Lock()
	defer c.mu.Unlock()

	count := 0
	for key, el := range c.items {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			c.order.Remove(el)
			delete(c.items, key)
			count++
		}
	}
	return count
}

// Size returns current number of cached tiles
func (c *MemoryCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.order.Len()
}

// Stats returns cache hit/miss statistics
func (c *MemoryCache) Stats() (hits, misses int64) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.hits, c.misses
}
