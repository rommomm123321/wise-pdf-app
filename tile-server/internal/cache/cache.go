package cache

// Cache is the interface implemented by MemoryCache, DiskCache, and MultiCache.
type Cache interface {
	Get(key string) []byte
	Set(key string, data []byte)
	DeleteByPrefix(prefix string) int
	Size() int
	Stats() (hits, misses int64)
}
