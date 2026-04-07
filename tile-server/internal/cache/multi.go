package cache

// MultiCache is a two-level tile cache: L1 (fast in-memory LRU) + L2 (persistent disk).
// Reads check L1 first; on L2 hit the tile is promoted to L1.
// Writes always go to L1 synchronously; L2 writes are async so they don't block rendering.
type MultiCache struct {
	l1 *MemoryCache
	l2 *DiskCache
}

func NewMultiCache(l1 *MemoryCache, l2 *DiskCache) *MultiCache {
	return &MultiCache{l1: l1, l2: l2}
}

func (c *MultiCache) Get(key string) []byte {
	if data := c.l1.Get(key); data != nil {
		return data
	}
	if data := c.l2.Get(key); data != nil {
		c.l1.Set(key, data) // promote to L1
		return data
	}
	return nil
}

func (c *MultiCache) Set(key string, data []byte) {
	c.l1.Set(key, data)
	go c.l2.Set(key, data) // async disk write — never blocks the render path
}

func (c *MultiCache) DeleteByPrefix(prefix string) int {
	n1 := c.l1.DeleteByPrefix(prefix)
	n2 := c.l2.DeleteByPrefix(prefix)
	return n1 + n2
}

func (c *MultiCache) Size() int {
	return c.l1.Size()
}

// Stats returns combined hit/miss counts across both levels.
func (c *MultiCache) Stats() (hits, misses int64) {
	h1, m1 := c.l1.Stats()
	h2, m2 := c.l2.Stats()
	return h1 + h2, m1 + m2
}

// L1Size and L2Size are exposed for the /metrics endpoint.
func (c *MultiCache) L1Size() int { return c.l1.Size() }
func (c *MultiCache) L2Size() int { return c.l2.Size() }
