import { useEffect, useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle, useLayoutEffect } from 'react';
import { Box, CircularProgress, LinearProgress, Typography } from '@mui/material';
import { getTileDecoder, type TileDecodeRequest } from '../../workers/tile-decoder';

export interface DocInfo {
  docId: string;
  pageCount: number;
  pages: { w: number; h: number; label?: string }[];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface PageLayout {
  index: number;
  w: number;
  h: number;
  worldX: number;
  worldY: number;
}

export interface TileViewerHandle {
  navigateTo: (worldX: number, worldY: number, zoom: number) => void;
  /** Navigate to a point (pageX, pageY) relative to the top-left of the given page. */
  navigateToPagePoint: (pageIndex: number, pageX: number, pageY: number, zoom: number) => void;
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** Convert world coordinates to page-relative normalized coordinates (0-1). */
  worldToPage: (worldX: number, worldY: number) => { pageIndex: number; nx: number; ny: number } | null;
  getViewport: () => Viewport;
  /** Return the tile-server page dimensions for the given 0-based pageIndex. */
  getPageSize: (pageIndex: number) => { w: number; h: number } | null;
  fitPage: () => void;
  fitWidth: () => void;
  /** Cancel background tile loads and immediately prioritize the given page.
   * Call this when user clicks a page in the thumbnail sidebar. */
  prioritizePage: (pageIndex: number) => void;
  /** Scroll viewport to the given 1-based page number (both page and continuous modes). */
  navigateToPage: (page: number, explicit?: boolean) => void;
}

interface TileViewerProps {
  documentId: string;
  token: string;
  scale?: number;
  scrollMode?: 'page' | 'continuous' | 'split';
  currentPage?: number;
  cursor?: string;
  zoomFocusCenter?: boolean;
  tool?: string;
  onDocInfo?: (info: DocInfo) => void;
  onZoom?: (zoom: number) => void;
  onPageChange?: (page: number) => void;
  onWsStatus?: (connected: boolean) => void;
  searchResults?: any[];
  activeSearchResultIndex?: number | null;
  /** Compare mode: overlay diff tiles from two documents */
  compareConfig?: {
    oldDocId: string;
    newDocId: string;
    oldColor: string;
    newColor: string;
    opacity: number;
    showOld: boolean;
    showNew: boolean;
    /** 0-based page mapping: comparePages[newPageIdx] = oldPageIdx (or -1 if no match) */
    pageMapping?: number[];
  } | null;
  children?: (viewport: Viewport, docInfo: DocInfo | null, layouts: PageLayout[], containerW: number, containerH: number) => React.ReactNode;
}

const TILE_SIZE = 512;
const FADE_MS = 280;

// Discrete zoom levels — each wheel tick moves exactly one step (no jerk, no stuck values)
const ZOOM_LEVELS = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0, 8.0, 12.0, 20.0];

const TileViewer = forwardRef<TileViewerHandle, TileViewerProps>(function TileViewer(
  { documentId, token, scale = 1.0, scrollMode = 'continuous', currentPage = 1, cursor: cursorProp, zoomFocusCenter = false, tool, onDocInfo, onZoom, onPageChange, onWsStatus, searchResults, activeSearchResultIndex, compareConfig, children },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const childrenWrapperRef = useRef<HTMLDivElement>(null);

  // HTTP in-flight tile requests — AbortController per tile key
  const inFlightRef = useRef(new Map<string, AbortController>());
  // Tile decoder instance for Web Workers
  const tileDecoderRef = useRef<ReturnType<typeof getTileDecoder> | null>(null);
  
  // Worker queue management
  const decodeQueueRef = useRef<TileDecodeRequest[]>([]);
  const isProcessingQueueRef = useRef(false);
  const pendingDecodesRef = useRef(new Map<string, { resolve: (bitmap: ImageBitmap) => void; reject: (error: Error) => void }>());

  const tileCache = useRef(new Map<string, ImageBitmap>());
  const tileTimestamps = useRef(new Map<string, number>());
  // P1-2: FIFO order for LRU eviction
  const tileCacheOrder = useRef<string[]>([]);
  const MAX_TILE_CACHE = 500;

  const lastOnZoomRef = useRef<number>(scale);
  const scrollModeRef = useRef(scrollMode);
  const currentPageRef = useRef(currentPage);
  const docInfoRef = useRef<DocInfo | null>(null);
  const hasInitializedRef = useRef(false);
  const pageLayoutsRef = useRef<PageLayout[]>([]);
  const renderCanvasRef = useRef<() => void>(() => {});
  const fadeAnimRef = useRef<number | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number; dist?: number } | null>(null);
  const tileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: scale });
  const panRafRef = useRef<number | null>(null);
  const momentumRafRef = useRef<number | null>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastMoveTimeRef = useRef(0);
  // Zoom settle: delay tile requests 200ms after last zoom change
  // (user sees pyramid fallback during zoom; prevents flooding server with intermediate zoom tiles)
  const zoomSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isZoomingRef = useRef(false);
  const zoomFocusCenterRef = useRef(zoomFocusCenter);
  const cursorPropRef = useRef(cursorProp);
  const onZoomRef = useRef(onZoom);
  const wheelAccumulatorRef = useRef(0);
  // PERF-10: scroll direction tracking for smarter prefetch
  const scrollDirRef = useRef<1 | -1>(1);
  const prevViewportYRef = useRef(0);
  // Compare mode ref (avoids re-creating fetchTile on every config change)
  const compareConfigRef = useRef(compareConfig);
  compareConfigRef.current = compareConfig;

  const [docInfo, setDocInfo] = useState<DocInfo | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: scale });
  
  // React strictly tracks what is CURRENTLY rendered.
  // This ensures CSS overlay transforms never double-apply or desync from React renders.
  const reactStateViewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: scale });
  reactStateViewportRef.current = viewport;

  const wheelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [loadPhase, setLoadPhase] = useState<0 | 1 | 2>(0);
  const [loadError, setLoadError] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ written: number; total: number; percent: number } | null>(null);
  const initialLoadDoneRef = useRef(false);
  // Track drag state as React state so cursor updates correctly
  const [isDraggingState, setIsDraggingState] = useState(false);

  // P1-2: add tile to cache with LRU eviction
  const setCachedTile = useCallback((key: string, bitmap: ImageBitmap) => {
    if (tileCache.current.has(key)) return; // already cached
    tileCache.current.set(key, bitmap);
    tileTimestamps.current.set(key, Date.now());
    tileCacheOrder.current.push(key);
    // Evict oldest when over limit
    while (tileCache.current.size > MAX_TILE_CACHE) {
      const evictKey = tileCacheOrder.current.shift();
      if (!evictKey) break;
      const bmp = tileCache.current.get(evictKey);
      if (bmp) { try { bmp.close(); } catch {} }
      tileCache.current.delete(evictKey);
      tileTimestamps.current.delete(evictKey);
    }
  }, []);

  // P2-3: cleanup timers/RAFs on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (panRafRef.current !== null) clearTimeout(panRafRef.current);
      if (momentumRafRef.current !== null) cancelAnimationFrame(momentumRafRef.current);
    };
  }, []);

  // Safety timeout: show content after 30s even if no tiles arrive
  useEffect(() => {
    const t = setTimeout(() => { if (!initialLoadDoneRef.current) setLoadPhase(2); }, 30000);
    return () => clearTimeout(t);
  }, []);

  // Initialize tile decoder Web Worker
  useEffect(() => {
    try {
      tileDecoderRef.current = getTileDecoder();
    } catch (error) {
      console.error('Failed to initialize tile decoder:', error);
    }
    return () => {
      pendingDecodesRef.current.clear();
      decodeQueueRef.current = [];
      tileDecoderRef.current = null;
    };
  }, []);

  // Reset state when switching documents
  useEffect(() => {
    hasInitializedRef.current = false;
    initialLoadDoneRef.current = false;
    lastReportedPage.current = 1;
    setDocInfo(null);
    setLoadPhase(0);
    setLoadError(false);
    const init: Viewport = { x: 0, y: 0, zoom: 0.3 };
    viewportRef.current = init;
    setViewport(init);
    // P1-1: free GPU memory for each cached ImageBitmap before clearing
    for (const bitmap of tileCache.current.values()) {
      try { bitmap.close(); } catch {}
    }
    tileCache.current.clear();
    tileTimestamps.current.clear();
    tileCacheOrder.current = [];
    // P2-2: cancel in-flight momentum/pan to avoid updating viewport of new doc
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
    if (panRafRef.current !== null) {
      clearTimeout(panRafRef.current);
      panRafRef.current = null;
    }
    for (const ctrl of inFlightRef.current.values()) ctrl.abort();
    inFlightRef.current.clear();
  }, [documentId]);

  // Flush ALL tile cache when compare mode/params change → forces re-fetch with correct URL
  const compareCacheKey = compareConfig
    ? `${compareConfig.oldDocId}|${compareConfig.opacity}|${compareConfig.showOld}|${compareConfig.showNew}`
    : 'off';
  const prevCompareCacheKey = useRef(compareCacheKey);
  useEffect(() => {
    if (prevCompareCacheKey.current === compareCacheKey) return;
    prevCompareCacheKey.current = compareCacheKey;
    // Flush everything
    for (const bmp of tileCache.current.values()) { try { bmp.close(); } catch {} }
    tileCache.current.clear();
    tileTimestamps.current.clear();
    tileCacheOrder.current = [];
    for (const ctrl of inFlightRef.current.values()) ctrl.abort();
    inFlightRef.current.clear();

    // Immediately re-fetch zoom-0 thumbnails for all pages in current layout
    // so the pyramid fallback chain works during zoom (prevents blank/blurry)
    for (const p of pageLayoutsRef.current) {
      fetchTile(p.index, 0, 0, 0, false);
    }
    // Also fetch current zoom level tiles for visible pages
    if (containerRef.current) {
      const vp = viewportRef.current;
      const level = getZoomLevel(vp.zoom);
      const levelScale = getScaleForLevel(level);
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const cc = cw / vp.zoom / 2;
      for (const p of pageLayoutsRef.current) {
        const px = (cc + p.worldX - vp.x) * vp.zoom;
        const py = (p.worldY - vp.y) * vp.zoom;
        const pw = p.w * vp.zoom;
        const ph = p.h * vp.zoom;
        if (px + pw <= 0 || px >= cw || py + ph <= 0 || py >= ch) continue;
        const tws = TILE_SIZE / levelScale;
        const cols = Math.ceil(p.w / tws);
        const rows = Math.ceil(p.h / tws);
        for (let tx = 0; tx < cols; tx++) {
          for (let ty = 0; ty < rows; ty++) {
            fetchTile(p.index, level, tx, ty, false);
          }
        }
      }
    }
    // Force tile sync for any remaining tiles
    setViewport(prev => ({ ...prev }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCacheKey]);

  // Keep refs in sync with latest props
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { scrollModeRef.current = scrollMode; }, [scrollMode]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { docInfoRef.current = docInfo; }, [docInfo]);
  useEffect(() => { zoomFocusCenterRef.current = zoomFocusCenter; }, [zoomFocusCenter]);
  useEffect(() => { cursorPropRef.current = cursorProp; }, [cursorProp]);
  useEffect(() => { onZoomRef.current = onZoom; }, [onZoom]);

  // Sync zero-lag transform to React DOM reconciliation.
  // This guarantees that the instant React applies the new viewport to the markups,
  // Reset CSS transform on childrenWrapper BEFORE browser paints.
  // This is fast (no canvas redraw) — just resets the compensating transform to identity.
  useLayoutEffect(() => {
    if (childrenWrapperRef.current) {
      childrenWrapperRef.current.style.transform = 'translate(0px, 0px) scale(1)';
    }
    // Also redraw tiles (but the transform reset above prevents jitter)
    renderCanvasRef.current();
  }, [viewport]);

  // Sync viewport zoom when external scale prop changes
  useEffect(() => {
    setViewport(v => {
      if (Math.abs(v.zoom - scale) < 0.01) return v;
      if (Math.abs(lastOnZoomRef.current - scale) < 0.005) return v;
      if (containerRef.current) {
        const cx = containerRef.current.clientWidth / 2;
        const cy = containerRef.current.clientHeight / 2;
        return { zoom: scale, x: v.x + cx / v.zoom - cx / scale, y: v.y + cy / v.zoom - cy / scale };
      }
      return { ...v, zoom: scale };
    });
  }, [scale]);

  // Page layouts: positions of all pages in world space
  // In page mode, the layout changes based on currentPage (only that page is shown).
  // In continuous/split mode, all pages are always laid out regardless of currentPage,
  // so we use -1 as a stable value to avoid rebuilding the array on every page change.
  const pageLayoutCurrentPage = scrollMode === 'page' ? currentPage : -1;

  const pageLayouts = useMemo(() => {
    // SKELETON LAYOUT: If docInfo is not yet downloaded, we create a fake 1-page A4 skeleton.
    // This entirely removes the "Loading..." blank screen period and gives instantaneous visual render.
    const layouts: PageLayout[] = [];
    const info = docInfo || { pageCount: 1, pages: [{ w: 842, h: 1191 }] };
    const GAP = 24;

    if (scrollMode === 'page') {
      const pIdx = Math.max(0, Math.min(currentPage - 1, info.pages.length - 1));
      const p = info.pages[pIdx];
      if (p) layouts.push({ index: pIdx, w: p.w, h: p.h, worldX: -p.w / 2, worldY: 0 });
    } else if (scrollMode === 'split') {
      let currentY = 0;
      for (let i = 0; i < info.pages.length; i += 2) {
        const p1 = info.pages[i];
        const p2 = i + 1 < info.pages.length ? info.pages[i + 1] : null;
        const rowH = Math.max(p1.h, p2 ? p2.h : 0);
        if (p2) {
          layouts.push({ index: i, w: p1.w, h: p1.h, worldX: -(p1.w + GAP / 2), worldY: currentY });
          layouts.push({ index: i + 1, w: p2.w, h: p2.h, worldX: GAP / 2, worldY: currentY });
        } else {
          layouts.push({ index: i, w: p1.w, h: p1.h, worldX: -p1.w / 2, worldY: currentY });
        }
        currentY += rowH + GAP;
      }
    } else {
      let currentY = 0;
      for (let i = 0; i < info.pages.length; i++) {
        const p = info.pages[i];
        layouts.push({ index: i, w: p.w, h: p.h, worldX: -p.w / 2, worldY: currentY });
        currentY += p.h + GAP;
      }
    }
    return layouts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docInfo, scrollMode, pageLayoutCurrentPage]);

  useEffect(() => { pageLayoutsRef.current = pageLayouts; }, [pageLayouts]);

  // P1-5: pending navigation executed when pageLayouts rebuilds (avoids fragile setTimeout)
  const pendingNavigationRef = useRef<{ pageIndex: number; pageX: number; pageY: number; zoom: number } | null>(null);

  const lastReportedPage = useRef(currentPage);
  useEffect(() => {
    if (!docInfo || pageLayouts.length === 0) return;
    // Execute pending cross-page navigation once layout is ready
    const pending = pendingNavigationRef.current;
    if (pending) {
      const layout = pageLayouts.find(l => l.index === pending.pageIndex);
      if (layout && containerRef.current) {
        pendingNavigationRef.current = null;
        const { pageIndex, pageX, pageY, zoom } = pending;
        const targetWorldX = layout.worldX + pageX;
        const targetWorldY = layout.worldY + pageY;
        const ch = containerRef.current.clientHeight;
        // Same formula as navigateToPagePoint direct path — no extra X offset
        const next: Viewport = {
          zoom,
          x: targetWorldX,
          y: targetWorldY - ch / (2 * zoom),
        };
        viewportRef.current = next;
        setViewport(next);
        lastOnZoomRef.current = zoom;
        if (onZoom) onZoom(zoom);
        requestAnimationFrame(() => renderCanvasRef.current());

        // Now that layout is ready, fetch HD tiles for the target page at current zoom
        const level = getZoomLevel(zoom);
        const levelScale = getScaleForLevel(level);
        const tileWorldSize = TILE_SIZE / levelScale;
        const cols = Math.ceil(layout.w / tileWorldSize);
        const rows = Math.ceil(layout.h / tileWorldSize);
        for (let tx = 0; tx < cols; tx++) {
          for (let ty = 0; ty < rows; ty++) {
            fetchTile(pageIndex, level, tx, ty, false);
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLayouts]);

  useEffect(() => {
    if (!docInfo || pageLayouts.length === 0) return;
    if (currentPage !== lastReportedPage.current) {
      // In page mode: force viewport to show the requested page (y=0 = top of single page).
      // In continuous/split mode: do NOT force viewport — the user is scrolling freely
      // and explicit navigation is handled imperatively via navigateToPage().
      // Forcing setViewport here in continuous mode caused unwanted jumps to page 1.
      if (scrollMode === 'page') {
        setViewport(v => ({ ...v, y: 0, x: 0 }));
      }
      lastReportedPage.current = currentPage;
    }
  }, [scrollMode, currentPage, docInfo, pageLayouts]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      if (entries[0]) setContainerSize({ w: entries[0].contentRect.width, h: entries[0].contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!docInfo || containerSize.w === 0 || containerSize.h === 0) return;
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    const clampedZoom = 0.3;
    setViewport({ zoom: clampedZoom, x: 0, y: 0 });
    if (onZoom) { lastOnZoomRef.current = clampedZoom; onZoom(clampedZoom); }
  }, [docInfo, containerSize.w, containerSize.h]);

  // ─── Fade animation loop ────────────────────────────────────────────────────
  const startFadeLoop = useCallback(() => {
    if (fadeAnimRef.current !== null) return;
    const loop = () => {
      renderCanvasRef.current();
      const now = Date.now();
      const stillFading = [...tileTimestamps.current.values()].some(ts => now - ts < FADE_MS);
      if (stillFading) {
        fadeAnimRef.current = requestAnimationFrame(loop);
      } else {
        fadeAnimRef.current = null;
      }
    };
    fadeAnimRef.current = requestAnimationFrame(loop);
  }, []);

  // Process decode queue
  const processDecodeQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || decodeQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;
    const batch = decodeQueueRef.current.splice(0, 4); // Process 4 at a time
    
    try {
      const decoder = tileDecoderRef.current;
      if (!decoder) {
        // Fallback to main thread
        for (const request of batch) {
          try {
            const bitmap = await createImageBitmap(request.blob, request.options);
            const callback = pendingDecodesRef.current.get(request.id);
            if (callback) {
              callback.resolve(bitmap);
              pendingDecodesRef.current.delete(request.id);
            }
          } catch (error) {
            const callback = pendingDecodesRef.current.get(request.id);
            if (callback) {
              callback.reject(error instanceof Error ? error : new Error('Decode failed'));
              pendingDecodesRef.current.delete(request.id);
            }
          }
        }
      } else {
        // Batch decode через worker
        const results = await decoder.decodeBatch(batch);
        
        for (const result of results) {
          const callback = pendingDecodesRef.current.get(result.id);
          if (callback) {
            if (result.success && result.imageBitmap) {
              callback.resolve(result.imageBitmap);
            } else {
              callback.reject(new Error(result.error || 'Decode failed'));
            }
            pendingDecodesRef.current.delete(result.id);
          }
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
      
      // Process remaining queue
      if (decodeQueueRef.current.length > 0) {
        setTimeout(() => processDecodeQueue(), 0);
      }
    }
  }, []);

  // Optimized tile decoding with Web Workers and localStorage cache
  const decodeTileImage = useCallback((key: string, blob: Blob): Promise<ImageBitmap> => {
    // Check memory cache first
    const cached = tileCache.current.get(key);
    if (cached) return Promise.resolve(cached);

    // If already pending, attach to existing promise
    const existing = pendingDecodesRef.current.get(key);
    if (existing) {
      return new Promise((resolve, reject) => {
        const prev = pendingDecodesRef.current.get(key)!;
        const prevResolve = prev.resolve;
        const prevReject = prev.reject;
        pendingDecodesRef.current.set(key, {
          resolve: (bmp) => { prevResolve(bmp); resolve(bmp); },
          reject: (err) => { prevReject(err); reject(err); },
        });
      });
    }

    // Create a single promise for decoding — no nested promises
    return new Promise<ImageBitmap>((resolve, reject) => {
      pendingDecodesRef.current.set(key, { resolve, reject });

      const request: TileDecodeRequest = {
        id: key,
        blob,
        options: { premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: 'none' },
      };
      decodeQueueRef.current.push(request);
      if (!isProcessingQueueRef.current) setTimeout(() => processDecodeQueue(), 0);
    });
  }, [processDecodeQueue]);

  // ─── Tile fetching via HTTP ────────────────────────────────────────────────
  const fetchTile = useCallback((page: number, zoom: number, x: number, y: number, lowPriority = false, retryCount = 0) => {
    // Always use standard key — cache is fully flushed when compare mode changes
    const key = `${documentId}/${page}/${zoom}/${x}/${y}`;
    if (tileCache.current.has(key) || inFlightRef.current.has(key)) return;

    const ac = new AbortController();
    inFlightRef.current.set(key, ac);

    const opts: RequestInit & { priority?: string } = { signal: ac.signal };
    if (lowPriority) opts.priority = 'low';

    // Build URL: normal tiles vs compare tiles (always use /compare/ in compare mode for tinting)
    const cmp = compareConfigRef.current;
    let url: string;
    if (cmp) {
      const oldPage = cmp.pageMapping?.[page] ?? page;
      url = `/compare/${cmp.oldDocId}/${documentId}/${oldPage}/${page}/${zoom}/${x}/${y}?token=${encodeURIComponent(token)}&oldColor=${cmp.oldColor.replace('#','')}&newColor=${cmp.newColor.replace('#','')}&opacity=${cmp.opacity}&showOld=${cmp.showOld?1:0}&showNew=${cmp.showNew?1:0}`;
    } else {
      url = `/tiles/${documentId}/${page}/${zoom}/${x}/${y}?token=${encodeURIComponent(token)}`;
    }

    fetch(url, opts as RequestInit)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.blob();
      })
      .then(blob => decodeTileImage(key, blob))
      .then(bitmap => {
        setCachedTile(key, bitmap);
        inFlightRef.current.delete(key);
        if (!initialLoadDoneRef.current) {
          // Only hide loading overlay when a tile at the CURRENT zoom level loads
          // (not a prefetched zoom-0 thumbnail that's invisible at the current zoom)
          const currentLevel = getZoomLevel(viewportRef.current.zoom);
          if (zoom >= currentLevel || zoom >= 2) {
            initialLoadDoneRef.current = true;
            setLoadPhase(2);
          }
        }
        renderCanvasRef.current();
        startFadeLoop();
      })
      .catch(e => {
        inFlightRef.current.delete(key);
        pendingDecodesRef.current.delete(key);
        if (e.name !== 'AbortError') {
          // P2-1: retry once after 2s on network error
          if (retryCount < 1) {
            setTimeout(() => fetchTile(page, zoom, x, y, lowPriority, retryCount + 1), 2000);
          } else {
            console.warn('[TileViewer] tile fetch failed after retry:', key, e.message);
          }
        }
      });
  }, [documentId, token, decodeTileImage, startFadeLoop]);

  // ─── Prepare document via HTTP (replaces WebSocket connection) ───────────────
  useEffect(() => {
    if (!documentId || !token) return;
    const ac = new AbortController();

    // OPTIMIZATION: Use cached DocInfo for instant display on repeat visits
    const cacheKey = `docinfo-${documentId}`;
    const cached = (() => { try { const s = sessionStorage.getItem(cacheKey); return s ? JSON.parse(s) as DocInfo : null; } catch { return null; } })();
    if (cached && cached.pages?.length > 0) {
      // Instant init from cache — show content immediately
      docInfoRef.current = cached;
      setDocInfo(cached);
      setLoadPhase(1);
      onDocInfo?.(cached);
      // Auto-fit from cached info
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        hasInitializedRef.current = true; // mark so /prepare/ response won't overwrite
        const page = cached.pages[0];
        if (!page) return;
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const MARGIN = 32;
        const z = Math.min((cw - MARGIN * 2) / page.w, (ch - MARGIN * 2) / page.h, 10);
        const next = { zoom: z, x: 0, y: -MARGIN / z };
        viewportRef.current = next;
        setViewport(next);
        lastOnZoomRef.current = z;
        if (onZoom) onZoom(z);
        renderCanvasRef.current();
      });
    }

    // Poll /prepare/{docId}/status every 250ms while prepare is pending
    let statusInterval: ReturnType<typeof setInterval> | null = null;
    const startStatusPolling = () => {
      statusInterval = setInterval(async () => {
        try {
          const res = await fetch(`/prepare/${documentId}/status?token=${encodeURIComponent(token)}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.ready) {
            if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
            return;
          }
          if (data.total > 0) {
            setDownloadProgress({ written: data.written, total: data.total, percent: data.percent });
          }
        } catch { /* ignore poll errors */ }
      }, 250);
    };
    startStatusPolling();

    fetch(`/prepare/${documentId}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      signal: ac.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error(`prepare HTTP ${r.status}`);
        return r.json();
      })
      .then((info: DocInfo) => {
        if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
        setDownloadProgress(null);
        onWsStatus?.(true);
        docInfoRef.current = info;
        setDocInfo(info);
        setLoadPhase(p => Math.max(p, 1) as 0 | 1 | 2);
        onDocInfo?.(info);
        // Cache DocInfo for instant load next time
        try { sessionStorage.setItem(cacheKey, JSON.stringify(info)); } catch { /* quota */ }

        // Auto-fit: open document at Fit-Page zoom — but ONLY if user hasn't zoomed yet.
        // If sessionStorage cached DocInfo, fit was already applied. If user zoomed manually
        // before /prepare/ responded, don't overwrite their zoom.
        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          if (hasInitializedRef.current) return; // user already interacted or cache fit already applied
          hasInitializedRef.current = true;
          const page = info.pages[0];
          if (!page) return;
          const cw = containerRef.current.clientWidth;
          const ch = containerRef.current.clientHeight;
          const MARGIN = 32;
          const z = Math.min((cw - MARGIN * 2) / page.w, (ch - MARGIN * 2) / page.h, 10);
          const next = { zoom: z, x: 0, y: -MARGIN / z };
          viewportRef.current = next;
          setViewport(next);
          lastOnZoomRef.current = z;
          if (onZoom) onZoom(z);
          renderCanvasRef.current();
        });

        // Throttled prefetch: first 12 pages eagerly, rest in idle batches.
        // Previously ALL pages were queued immediately → 6 parallel connections → decode floods → 5s freeze.
        const EAGER_PAGES = Math.min(12, info.pageCount);
        const maxConcurrent = 3; // reduced from 6
        let activeRequests = 0;
        const queue: number[] = [];

        // First 12 pages → eager (fills sidebar thumbnails immediately visible)
        for (let i = 0; i < EAGER_PAGES; i++) queue.push(i);

        const processQueue = () => {
          while (activeRequests < maxConcurrent && queue.length > 0) {
            const pg = queue.shift();
            if (pg === undefined) continue;

            const key = `${documentId}/${pg}/0/0/0`;
            if (tileCache.current.has(key) || inFlightRef.current.has(key)) {
              // Already cached/in-flight — keep draining
              if (queue.length > 0) setTimeout(processQueue, 0);
              continue;
            }

            activeRequests++;
            const eac = new AbortController();
            inFlightRef.current.set(key, eac);
            const priority = pg < 4 ? 'high' : 'low';

            fetch(`/tiles/${documentId}/${pg}/0/0/0?token=${encodeURIComponent(token)}`, {
              signal: eac.signal, priority
            } as RequestInit)
              .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.blob(); })
              .then(blob => decodeTileImage(key, blob))
              .then(bitmap => {
                setCachedTile(key, bitmap);
                inFlightRef.current.delete(key);
                activeRequests--;

                if (!initialLoadDoneRef.current && pg < 4) {
                  initialLoadDoneRef.current = true;
                  setLoadPhase(2);
                }

                renderCanvasRef.current();
                startFadeLoop();

                if (queue.length > 0) setTimeout(processQueue, 0);
              })
              .catch(e => {
                if (e.name !== 'AbortError') console.warn('[TileViewer] eager tile failed:', key, e.message);
                inFlightRef.current.delete(key);
                pendingDecodesRef.current.delete(key);
                activeRequests--;
                if (queue.length > 0) setTimeout(processQueue, 0);
              });
          }
        };

        processQueue();

        // Remaining pages (13+): load lazily after 3s when browser is idle
        if (info.pageCount > EAGER_PAGES) {
          setTimeout(() => {
            for (let i = EAGER_PAGES; i < info.pageCount; i++) {
              const key = `${documentId}/${i}/0/0/0`;
              if (!tileCache.current.has(key) && !inFlightRef.current.has(key)) {
                fetchTile(i, 0, 0, 0, true); // background priority
              }
            }
          }, 3000);
        }

        // Prefetch first page at zoom level 1 for crisp initial render
        // Use currentPageRef.current (not currentPage) to avoid re-running effect on page change!
        setTimeout(() => {
          const firstPageIdx = currentPageRef.current - 1;
          [[0,0],[1,0],[0,1],[1,1]].forEach(([tx,ty]) => {
            const key = `${documentId}/${firstPageIdx}/1/${tx}/${ty}`;
            if (!tileCache.current.has(key) && !inFlightRef.current.has(key))
              fetchTile(firstPageIdx, 1, tx, ty, true);
          });
        }, 800);
      })
      .catch(e => {
        if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
        if (e.name !== 'AbortError') {
          console.error('[TileViewer] prepare failed:', e.message);
          onWsStatus?.(false);
          // P2-5: show error state instead of infinite spinner
          setLoadPhase(2);
          setLoadError(true);
        }
      });

    return () => {
      if (statusInterval) clearInterval(statusInterval);
      ac.abort();
      for (const ctrl of inFlightRef.current.values()) ctrl.abort();
      inFlightRef.current.clear();
    };
  // NOTE: currentPage intentionally NOT in deps — it's read via currentPageRef.current.
  // Including it would re-run /prepare/ on every page change → teleport viewport to y=0.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, token, decodeTileImage, startFadeLoop, fetchTile]);

  // ─── Zoom level helpers ────────────────────────────────────────────────────
  // Use higher tile resolution sooner for crisper rendering
  // Max pixel budget for 8x: 60M pixels (must match Go renderer cap)
  const MAX_8X_PIXELS = 60_000_000;
  const screenDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  const getZoomLevel = useCallback((zoom: number): number => {
    // Choose tile zoom level so tiles are NEVER visually upscaled on screen.
    // upscale ratio = zoom × DPR / scale — must be ≤ 1.0 for zero upscale.
    // This means scale ≥ zoom × DPR — always request enough pixels.
    const needed = zoom * screenDpr;
    // scales: [0.25, 0.5, 1.0, 2.0, 4.0, 8.0]
    // Each level's max "needed" = its scale value (upscale ratio exactly 1.0)
    let level: number;
    if (needed <= 0.25) level = 0;
    else if (needed <= 0.5)  level = 1;
    else if (needed <= 1.0)  level = 2;
    else if (needed <= 2.0)  level = 3;
    else if (needed <= 4.0)  level = 4;
    else level = 5;

    // Zoom 5 (8x): only if pages are small enough
    if (level >= 5) {
      const pages = docInfoRef.current?.pages;
      if (pages && pages.length > 0) {
        const maxW = pages.reduce((m: number, p: any) => Math.max(m, p.w || 0), 0);
        const maxH = pages.reduce((m: number, p: any) => Math.max(m, p.h || 0), 0);
        const pxAt8x = (maxW * 4) * (maxH * 4);
        if (pxAt8x > MAX_8X_PIXELS) level = 4;
      }
    }
    return level;
  }, [screenDpr]);

  const getScaleForLevel = (level: number) => [0.25, 0.5, 1.0, 2.0, 4.0, 8.0][level] ?? 4.0;

  // ─── Calculate which tiles are currently visible ───────────────────────────
  type TileKey = { key: string; page: number; zoomLevel: number; x: number; y: number; screenX: number; screenY: number; w: number; h: number };

  const calculateVisibleTiles = useCallback((): TileKey[] => {
    if (!docInfo || !containerRef.current) return [];

    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return [];

    const vp = viewportRef.current;
    const level = getZoomLevel(vp.zoom);
    const levelScale = getScaleForLevel(level);
    const containerCenter = clientWidth / vp.zoom / 2;
    const result: TileKey[] = [];

    for (const p of pageLayouts) {
      const pageTop = (p.worldY - vp.y) * vp.zoom;
      const pageBottom = pageTop + p.h * vp.zoom;
      if (pageBottom <= 0 || pageTop >= clientHeight) continue;

      const tileWorldSize = TILE_SIZE / levelScale;
      const cols = Math.ceil(p.w / tileWorldSize);
      const rows = Math.ceil(p.h / tileWorldSize);

      for (let tx = 0; tx < cols; tx++) {
        for (let ty = 0; ty < rows; ty++) {
          const screenX = (containerCenter + p.worldX + tx * tileWorldSize - vp.x) * vp.zoom;
          const screenY = (p.worldY + ty * tileWorldSize - vp.y) * vp.zoom;
          const sw = tileWorldSize * vp.zoom;
          const sh = tileWorldSize * vp.zoom;
          if (screenX + sw > 0 && screenX < clientWidth && screenY + sh > 0 && screenY < clientHeight) {
            result.push({
              key: `${documentId}/${p.index}/${level}/${tx}/${ty}`,
              page: p.index, zoomLevel: level, x: tx, y: ty,
              screenX, screenY, w: Math.ceil(sw), h: Math.ceil(sh),
            });
          }
        }
      }
    }
    return result;
  }, [pageLayouts, documentId, containerSize]);

  // ─── Tile sync: cancel stale + fetch missing ──────────────────────────────
  useEffect(() => {
    if (!docInfo) return;

    function doTileSync() {
      // PERF-10: track scroll direction
      const vpY = viewportRef.current.y;
      if (vpY !== prevViewportYRef.current) {
        scrollDirRef.current = vpY > prevViewportYRef.current ? 1 : -1;
        prevViewportYRef.current = vpY;
      }
      const visible = calculateVisibleTiles();
      const visibleKeys = new Set(visible.map(t => t.key));
      const vp = viewportRef.current;
      const cw = containerRef.current?.clientWidth || 0;
      const ch = containerRef.current?.clientHeight || 0;
      const cancelBufferPx = TILE_SIZE * 3;
      const cc = cw / vp.zoom / 2;

      // Cancel in-flight requests that scrolled far off-screen
      for (const [key, ac] of inFlightRef.current) {
        if (visibleKeys.has(key)) continue;
        const parts = key.split('/');
        if (parts.length !== 5) { ac.abort(); inFlightRef.current.delete(key); continue; }
        const pl = pageLayouts.find(p => p.index === parseInt(parts[1]));
        if (!pl) { ac.abort(); inFlightRef.current.delete(key); continue; }
        const lvScale = getScaleForLevel(parseInt(parts[2]));
        const tileWorld = TILE_SIZE / lvScale;
        const tx = parseInt(parts[3]), ty = parseInt(parts[4]);
        const sx = (cc + pl.worldX + tx * tileWorld - vp.x) * vp.zoom;
        const sy = (pl.worldY + ty * tileWorld - vp.y) * vp.zoom;
        const sw = tileWorld * vp.zoom;
        if (sx + sw < -cancelBufferPx || sx > cw + cancelBufferPx ||
            sy + sw < -cancelBufferPx || sy > ch + cancelBufferPx) {
          ac.abort();
          inFlightRef.current.delete(key);
        }
      }

      // Fetch visible tiles + buffer
      // While zoom is settling (user actively zooming), only load zoom-0 thumbnail as fallback
      const zooming = isZoomingRef.current;
      const level = getZoomLevel(vp.zoom);
      const levelScale = getScaleForLevel(level);
      // Zoom 5 (8x): no buffer, strict visible only, max 16 tiles per sync
      const isHiRes = level >= 5;
      const bufferPx = isHiRes ? 0 : TILE_SIZE * 1;
      let hiResFetched = 0;

      if (!zooming) {
        for (const p of pageLayouts) {
          const px = (cc + p.worldX - vp.x) * vp.zoom;
          const py = (p.worldY - vp.y) * vp.zoom;
          const pw = p.w * vp.zoom;
          const ph = p.h * vp.zoom;
          if (px + pw < -bufferPx || px > cw + bufferPx || py + ph < -bufferPx || py > ch + bufferPx) continue;

          const tileWorldSize = TILE_SIZE / levelScale;
          const cols = Math.ceil(p.w / tileWorldSize);
          const rows = Math.ceil(p.h / tileWorldSize);
          for (let tx = 0; tx < cols; tx++) {
            for (let ty = 0; ty < rows; ty++) {
              if (isHiRes && hiResFetched >= 16) break; // limit 8x tiles per sync cycle
              const sx = (cc + p.worldX + tx * tileWorldSize - vp.x) * vp.zoom;
              const sy = (p.worldY + ty * tileWorldSize - vp.y) * vp.zoom;
              const sw = tileWorldSize * vp.zoom;
              if (sx + sw > -bufferPx && sx < cw + bufferPx && sy + sw > -bufferPx && sy < ch + bufferPx) {
                fetchTile(p.index, level, tx, ty);
                if (isHiRes) hiResFetched++;
              }
            }
            if (isHiRes && hiResFetched >= 16) break;
          }
        }
      }

      // Prefetch level N-1 as intermediate quality (low priority, only when not zooming)
      if (level > 1 && !zooming) {
        const fbLevel = level - 1;
        const fbScale = getScaleForLevel(fbLevel);
        const fbTileWorld = TILE_SIZE / fbScale;
        for (const p of pageLayouts) {
          const px = (cc + p.worldX - vp.x) * vp.zoom;
          const py = (p.worldY - vp.y) * vp.zoom;
          const pw = p.w * vp.zoom;
          const ph = p.h * vp.zoom;
          if (px + pw < -bufferPx || px > cw + bufferPx || py + ph < -bufferPx || py > ch + bufferPx) continue;

          const fbCols = Math.ceil(p.w / fbTileWorld);
          const fbRows = Math.ceil(p.h / fbTileWorld);
          for (let tx = 0; tx < fbCols; tx++) {
            for (let ty = 0; ty < fbRows; ty++) {
              const sx = (cc + p.worldX + tx * fbTileWorld - vp.x) * vp.zoom;
              const sy = (p.worldY + ty * fbTileWorld - vp.y) * vp.zoom;
              const sw = fbTileWorld * vp.zoom;
              if (sx + sw > -bufferPx && sx < cw + bufferPx && sy + sw > -bufferPx && sy < ch + bufferPx) {
                fetchTile(p.index, fbLevel, tx, ty, true);
              }
            }
          }
        }
      }

      // Ensure zoom-0 fallback exists for ALL visible pages (not just next page).
      // Critical for compare mode where cache was flushed — without this, pyramid fallback is blank.
      const visiblePages = new Set(visible.map(t => t.page));
      for (const pageIdx of visiblePages) {
        fetchTile(pageIdx, 0, 0, 0, true);
      }
      // PERF-10: Also prefetch zoom-0 for next page in scroll direction
      const maxPage = docInfo!.pageCount - 1;
      const scrollDir = scrollDirRef.current;
      for (const pageIdx of visiblePages) {
        const next = pageIdx + scrollDir;
        if (next >= 0 && next <= maxPage) fetchTile(next, 0, 0, 0, true);
      }

      requestAnimationFrame(() => renderCanvasRef.current());

      // Detect current page in continuous/split mode.
      // Always read viewportRef.current (not stale React state) so detection is accurate
      // even when setViewport is throttled (e.g. 150ms pan throttle).
      if ((scrollMode === 'continuous' || scrollMode === 'split') && containerRef.current && onPageChange && pageLayouts.length > 0) {
        const vpNow = viewportRef.current;
        const focalOffsetWorld = Math.min((containerRef.current.clientHeight / vpNow.zoom) * 0.2, 100 / vpNow.zoom);
        const focalYWorld = vpNow.y + focalOffsetWorld;
        let closestIndex = 0;
        let minDistance = Infinity;
        for (const p of pageLayouts) {
          if (focalYWorld >= p.worldY && focalYWorld <= p.worldY + p.h) { closestIndex = p.index; break; }
          const dist = Math.abs(p.worldY + p.h / 2 - focalYWorld);
          if (dist < minDistance) { minDistance = dist; closestIndex = p.index; }
        }
        if (closestIndex + 1 !== lastReportedPage.current) {
          lastReportedPage.current = closestIndex + 1;
          onPageChange(closestIndex + 1);
        }
      }
    }

    if (tileDebounceRef.current !== null) clearTimeout(tileDebounceRef.current);
    tileDebounceRef.current = setTimeout(() => {
      tileDebounceRef.current = null;
      doTileSync();
    }, 8);

    return () => {
      if (tileDebounceRef.current !== null) { clearTimeout(tileDebounceRef.current); tileDebounceRef.current = null; }
    };
  // viewport в deps нужен чтобы React знал что эффект нужно перезапустить при движении,
  // но внутри doTileSync мы читаем viewportRef.current (не stale closure)
  }, [viewport, docInfo, calculateVisibleTiles, scrollMode, onPageChange, pageLayouts, fetchTile]);

  // ─── Canvas rendering ──────────────────────────────────────────────────────
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { clientWidth, clientHeight } = containerRef.current;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== clientWidth * dpr || canvas.height !== clientHeight * dpr) {
      canvas.width = clientWidth * dpr;
      canvas.height = clientHeight * dpr;
      ctx.scale(dpr, dpr);
    } else {
      ctx.clearRect(0, 0, clientWidth, clientHeight);
    }

    const vp = viewportRef.current;
    const tiles = calculateVisibleTiles();

    // Draw page backgrounds + shadows
    if (docInfo) {
      const cc = clientWidth / vp.zoom / 2;
      for (const p of pageLayouts) {
        const sx = (cc + p.worldX - vp.x) * vp.zoom;
        const sy = (p.worldY - vp.y) * vp.zoom;
        const pw = p.w * vp.zoom;
        const ph = p.h * vp.zoom;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(sx + 3, sy + 3, pw, ph);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx, sy, pw, ph);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, pw, ph);
      }
    }

    // Smoothing ON for fallback thumbnails (hide pixelation on stretched low-res)
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw zoom-0 fallback stretched to full page (blurry but immediate)
    if (docInfo) {
      const cc = clientWidth / vp.zoom / 2;
      for (const p of pageLayouts) {
        const fallbackKey = `${documentId}/${p.index}/0/0/0`;
        const fallback = tileCache.current.get(fallbackKey);
        if (!fallback) continue;
        const sx = (cc + p.worldX - vp.x) * vp.zoom;
        const sy = (p.worldY - vp.y) * vp.zoom;
        const pw = p.w * vp.zoom;
        const ph = p.h * vp.zoom;
        if (sx + pw <= 0 || sx >= clientWidth || sy + ph <= 0 || sy >= clientHeight) continue;
        const ts = tileTimestamps.current.get(fallbackKey);
        ctx.globalAlpha = ts ? Math.min(1, (Date.now() - ts) / FADE_MS) : 1;
        ctx.drawImage(fallback, sx, sy, pw, ph);
        ctx.globalAlpha = 1;
      }
    }

    // Smart smoothing for HD tiles:
    // - When tile scale matches screen (upscale ≤ 1.05): smoothing OFF → pixel-perfect
    // - When tiles are being upscaled (zoom between levels): smoothing ON → smooth text
    const level = getZoomLevel(vp.zoom);
    const tileScale = getScaleForLevel(level);
    const effectiveZoom = vp.zoom * dpr;
    const upscaleRatio = effectiveZoom / tileScale;
    ctx.imageSmoothingEnabled = upscaleRatio > 1.05;
    if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = 'high';

    // Draw actual tiles with fade-in; pyramid fallback for missing tiles
    for (const t of tiles) {
      const bitmap = tileCache.current.get(t.key);
      if (bitmap) {
        const ts = tileTimestamps.current.get(t.key);
        ctx.globalAlpha = ts ? Math.min(1, (Date.now() - ts) / FADE_MS) : 1;
        const drawW = (bitmap.width / TILE_SIZE) * t.w;
        const drawH = (bitmap.height / TILE_SIZE) * t.h;
        ctx.drawImage(bitmap, t.screenX, t.screenY, drawW, drawH);
        ctx.globalAlpha = 1;
      } else {
        // Pyramid fallback: try progressively lower zoom levels
        const p = pageLayouts.find(pl => pl.index === t.page);
        if (!p || t.zoomLevel === 0) continue;
        for (let lv = t.zoomLevel - 1; lv >= 0; lv--) {
          const lvScale = getScaleForLevel(lv);
          const fbTileWorld = TILE_SIZE / lvScale;
          const curTileWorld = TILE_SIZE / getScaleForLevel(t.zoomLevel);
          const tileWX = t.x * curTileWorld;
          const tileWY = p.worldY + t.y * curTileWorld;
          const fbTx = Math.floor(tileWX / fbTileWorld);
          const fbTy = Math.floor((tileWY - p.worldY) / fbTileWorld);
          const fbBitmap = tileCache.current.get(`${documentId}/${t.page}/${lv}/${fbTx}/${fbTy}`);
          if (!fbBitmap) continue;
          const srcX = ((tileWX - fbTx * fbTileWorld) / fbTileWorld) * fbBitmap.width;
          const srcY = (((tileWY - p.worldY) - fbTy * fbTileWorld) / fbTileWorld) * fbBitmap.height;
          const srcW = (curTileWorld / fbTileWorld) * fbBitmap.width;
          const srcH = (curTileWorld / fbTileWorld) * fbBitmap.height;
          ctx.drawImage(fbBitmap, srcX, srcY, srcW, srcH, t.screenX, t.screenY, t.w, t.h);
          break;
        }
      }
    }

    // Synchronous CSS transform for zero-lag Markups overlay
    // By directly mutating the DOM, the markups remain perfectly glued to the PDF
    // while React's state asynchronously catches up.
    if (childrenWrapperRef.current && containerRef.current) {
      const vState = reactStateViewportRef.current; // React DOM state actually currently rendered
      const vRef = viewportRef.current; // Real target state

      if (vState.zoom > 0) {
        const S = vRef.zoom / vState.zoom;
        const cw = containerRef.current.clientWidth;
        const dxPx = (cw / 2) * (1 - S) + (vState.x - vRef.x) * vRef.zoom;
        const dyPx = (vState.y - vRef.y) * vRef.zoom;
        childrenWrapperRef.current.style.transform = `translate(${dxPx}px, ${dyPx}px) scale(${S})`;
      }
    }
  };

  renderCanvasRef.current = renderCanvas;

  // ─── Clamp pan to document bounds ─────────────────────────────────────────
  const clampXY = useCallback((x: number, y: number, zoom: number) => {
    const layouts = pageLayoutsRef.current;
    if (layouts.length === 0 || !containerRef.current) return { x, y };
    const margin = 64 / zoom;
    const lastPage = layouts[layouts.length - 1];
    const totalDocH = lastPage.worldY + lastPage.h;
    const visibleH = containerRef.current.clientHeight / zoom;
    const maxY = Math.max(0, totalDocH - visibleH + margin);
    const maxPageW = Math.max(...layouts.map(l => l.w));
    return {
      x: Math.max(-maxPageW / 2 - margin, Math.min(maxPageW / 2 + margin, x)),
      y: Math.max(-margin, Math.min(maxY, y)),
    };
  }, []);

  // ─── Mouse wheel: Miro-style smooth zoom-to-cursor ──────────────────────
  // Rules:
  //   Ctrl+wheel (or page mode)  → smooth continuous zoom anchored to mouse cursor
  //   wheel alone                → scroll (pan) only, no zoom
  //   Both mouse and trackpad    → continuous factor from deltaY (no accumulator)
  const handleWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  handleWheelRef.current = (e: WheelEvent) => {
    e.preventDefault();

    // Cancel any running momentum on any scroll
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }

    // Text-select mode: let the browser handle its own scroll
    if (cursorPropRef.current === 'text') return;

    const isCtrl = e.ctrlKey || e.metaKey;
    const isPageMode = scrollModeRef.current === 'page';

    if (isCtrl || isPageMode) {
      // ── SMOOTH ZOOM TO CURSOR (Miro-style) ─────────────────────────────
      if (!containerRef.current) return;

      const prev = viewportRef.current;
      const rect = containerRef.current.getBoundingClientRect();

      // Pixel position of mouse inside the container
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;
      const containerCenterX = containerRef.current.clientWidth / 2;

      // Continuous zoom factor from deltaY:
      // - Mouse wheel: deltaY ≈ ±100 → factor ≈ 0.9 or 1.1 (10% per tick)
      // - Trackpad pinch: deltaY ≈ ±2..±20 → proportional fine-grained zoom
      // Sensitivity: smaller = more granular zoom. 300 feels like Miro.
      const ZOOM_SENSITIVITY = 300;
      const factor = Math.pow(2, -e.deltaY / ZOOM_SENSITIVITY);
      const MIN_ZOOM = ZOOM_LEVELS[0];
      const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));

      // Skip if barely changed (avoids float jitter)
      if (Math.abs(nextZoom - prev.zoom) < 0.001) return;

      // ── Zoom-to-cursor formula ──
      // The world coordinate under the mouse must stay fixed after zoom.
      const worldX = prev.x + (mouseScreenX - containerCenterX) / prev.zoom;
      const worldY = prev.y + mouseScreenY / prev.zoom;

      const rawX = worldX - (mouseScreenX - containerCenterX) / nextZoom;
      const rawY = worldY - mouseScreenY / nextZoom;

      const { x, y } = clampXY(rawX, rawY, nextZoom);
      const next = { zoom: nextZoom, x, y };

      viewportRef.current = next;
      renderCanvasRef.current();

      const cb = onZoomRef.current;
      if (cb) { lastOnZoomRef.current = nextZoom; cb(nextZoom); }

      // Signal "zooming" to defer heavy tile fetches; commit React state once zoom settles
      isZoomingRef.current = true;
      if (zoomSettleRef.current) clearTimeout(zoomSettleRef.current);
      zoomSettleRef.current = setTimeout(() => {
        isZoomingRef.current = false;
        setViewport({ ...viewportRef.current });
      }, 150);

    } else {
      // ── SCROLL (pan) only — no zoom ───────────────────────────────────
      const prev = viewportRef.current;
      const { x, y } = clampXY(
        prev.x + e.deltaX / prev.zoom,
        prev.y + e.deltaY / prev.zoom,
        prev.zoom
      );
      viewportRef.current = { ...prev, x, y };
      renderCanvasRef.current();

      // Debounce React state updates for trackpad scroll. 
      // Do not spam setViewport, let CSS handle the smooth 60fps pan!
      if (wheelDebounceRef.current !== null) clearTimeout(wheelDebounceRef.current);
      wheelDebounceRef.current = setTimeout(() => {
        wheelDebounceRef.current = null;
        setViewport({ ...viewportRef.current });
      }, 100);
    }
  };

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  // +/= → zoom in, - → zoom out (toward center)
  // Ctrl+0 → fitPage, Ctrl+Shift+0 → fitWidth
  // Arrow keys → pan 50px
  // Space → handled by tool (pan mode); no-op here to avoid page scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keys when user is typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+0 → fitPage
      if (isCtrl && !e.shiftKey && e.key === '0') {
        e.preventDefault();
        if (!containerRef.current || !docInfoRef.current) return;
        const page = docInfoRef.current.pages[0];
        if (!page) return;
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const MARGIN = 24;
        const z = Math.min((cw - MARGIN * 2) / page.w, (ch - MARGIN * 2) / page.h, 10);
        const next: Viewport = { zoom: z, x: 0, y: -MARGIN / z };
        viewportRef.current = next;
        setViewport(next);
        lastOnZoomRef.current = z;
        if (onZoomRef.current) onZoomRef.current(z);
        requestAnimationFrame(() => renderCanvasRef.current());
        return;
      }

      // Ctrl+Shift+0 → fitWidth
      if (isCtrl && e.shiftKey && e.key === '0') {
        e.preventDefault();
        if (!containerRef.current || !docInfoRef.current) return;
        const page = docInfoRef.current.pages[0];
        if (!page) return;
        const cw = containerRef.current.clientWidth;
        const MARGIN = 24;
        const z = Math.min((cw - MARGIN * 2) / page.w, 10);
        const vp = viewportRef.current;
        const next: Viewport = { zoom: z, x: 0, y: vp.y };
        viewportRef.current = next;
        setViewport(next);
        lastOnZoomRef.current = z;
        if (onZoomRef.current) onZoomRef.current(z);
        requestAnimationFrame(() => renderCanvasRef.current());
        return;
      }

      // + or = → zoom in toward center
      // - → zoom out toward center
      if (!isCtrl && (e.key === '+' || e.key === '=' || e.key === '-')) {
        e.preventDefault();
        if (!containerRef.current) return;
        const prev = viewportRef.current;
        const zoomIn = e.key !== '-';

        let currentIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < ZOOM_LEVELS.length; i++) {
          const diff = Math.abs(ZOOM_LEVELS[i] - prev.zoom);
          if (diff < minDiff) { minDiff = diff; currentIdx = i; }
        }
        const nextIdx = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, zoomIn ? currentIdx + 1 : currentIdx - 1));
        const nextZoom = ZOOM_LEVELS[nextIdx];
        if (nextZoom === prev.zoom) return;

        // Zoom toward center of container
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const rawX = prev.x + cw / 2 / prev.zoom - cw / 2 / nextZoom;
        const rawY = prev.y + ch / 2 / prev.zoom - ch / 2 / nextZoom;
        const { x, y } = clampXY(rawX, rawY, nextZoom);
        const next = { zoom: nextZoom, x, y };

        viewportRef.current = next;
        renderCanvasRef.current();
        const cb = onZoomRef.current;
        if (cb) { lastOnZoomRef.current = nextZoom; cb(nextZoom); }

        isZoomingRef.current = true;
        if (zoomSettleRef.current) clearTimeout(zoomSettleRef.current);
        zoomSettleRef.current = setTimeout(() => {
          isZoomingRef.current = false;
          setViewport({ ...viewportRef.current });
        }, 120);
        return;
      }

      // Arrow keys → pan 50px (in screen space → convert to world space)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const PAN_PX = 50;
        const prev = viewportRef.current;
        const dx = e.key === 'ArrowLeft' ? -PAN_PX : e.key === 'ArrowRight' ? PAN_PX : 0;
        const dy = e.key === 'ArrowUp' ? -PAN_PX : e.key === 'ArrowDown' ? PAN_PX : 0;
        const { x, y } = clampXY(prev.x + dx / prev.zoom, prev.y + dy / prev.zoom, prev.zoom);
        viewportRef.current = { ...prev, x, y };
        renderCanvasRef.current();

        if (panRafRef.current === null) {
          panRafRef.current = setTimeout(() => {
            panRafRef.current = null;
            setViewport({ ...viewportRef.current });
          }, 150) as unknown as number;
        }
        return;
      }

      // Space → prevent page scroll (actual pan gesture is handled via pointerdown/tool)
      if (e.key === ' ') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — all state accessed via refs

  // Stable wrapper — same function reference forever
  const stableWheelHandler = useRef((e: WheelEvent) => handleWheelRef.current(e)).current;

  useEffect(() => {
    // Retry attaching wheel handler — containerRef may not be ready on first render
    const attach = () => {
      const el = containerRef.current;
      if (!el) { requestAnimationFrame(attach); return; }
      el.addEventListener('wheel', stableWheelHandler, { passive: false });
    };
    attach();
    return () => {
      const el = containerRef.current;
      if (el) el.removeEventListener('wheel', stableWheelHandler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — handler is stable via ref

  // ─── Pointer (mouse/pen) drag for panning ─────────────────────────────────
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1) e.preventDefault();

    // ── Ctrl+click → zoom in | Alt+click → zoom out (centered on click point) ──
    if (e.button === 0 && (e.ctrlKey || e.metaKey || e.altKey) && containerRef.current) {
      e.preventDefault();
      const prev = viewportRef.current;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;
      const containerCenterX = containerRef.current.clientWidth / 2;

      // Find nearest discrete zoom level
      let currentIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < ZOOM_LEVELS.length; i++) {
        const diff = Math.abs(ZOOM_LEVELS[i] - prev.zoom);
        if (diff < minDiff) { minDiff = diff; currentIdx = i; }
      }
      const zoomIn = !e.altKey; // Ctrl/Meta = zoom in, Alt = zoom out
      const nextIdx = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, zoomIn ? currentIdx + 1 : currentIdx - 1));
      const nextZoom = ZOOM_LEVELS[nextIdx];
      if (nextZoom === prev.zoom) return;

      // Zoom-to-cursor: keep world point under click fixed
      const worldX = prev.x + (mouseScreenX - containerCenterX) / prev.zoom;
      const worldY = prev.y + mouseScreenY / prev.zoom;
      const rawX = worldX - (mouseScreenX - containerCenterX) / nextZoom;
      const rawY = worldY - mouseScreenY / nextZoom;

      const { x, y } = clampXY(rawX, rawY, nextZoom);
      const next = { zoom: nextZoom, x, y };

      viewportRef.current = next;
      renderCanvasRef.current();

      const cb = onZoomRef.current;
      if (cb) { lastOnZoomRef.current = nextZoom; cb(nextZoom); }

      isZoomingRef.current = true;
      if (zoomSettleRef.current) clearTimeout(zoomSettleRef.current);
      zoomSettleRef.current = setTimeout(() => {
        isZoomingRef.current = false;
        setViewport({ ...viewportRef.current });
      }, 120);
      return;
    }

    // Middle-click or pan-tool left-click → start panning
    const isPanGesture = e.button === 1 || (e.button === 0 && tool === 'pan');
    if (!isPanGesture) return;

    // Cancel any running momentum
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }

    isDragging.current = true;
    setIsDraggingState(true);
    lastMouse.current = { x: e.clientX, y: e.clientY };
    velocityRef.current = { x: 0, y: 0 };
    lastMoveTimeRef.current = performance.now();
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const now = performance.now();
    const dt = now - lastMoveTimeRef.current;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    // Track velocity (px/ms) using recent samples only
    if (dt > 0 && dt < 100) {
      // Exponential smoothing so fast flicks feel snappy
      velocityRef.current = {
        x: velocityRef.current.x * 0.4 + (dx / dt) * 0.6,
        y: velocityRef.current.y * 0.4 + (dy / dt) * 0.6,
      };
    }
    lastMoveTimeRef.current = now;

    const prev = viewportRef.current;
    const { x, y } = clampXY(prev.x - dx / prev.zoom, prev.y - dy / prev.zoom, prev.zoom);
    viewportRef.current = { ...prev, x, y };

    // Immediate canvas + overlay update (zero-lag visual feedback)
    renderCanvasRef.current();

    // Throttle React state updates to ~150ms during pan so Fabric.js re-renders only a few
    // times per second (not 60fps). The CSS transform on childrenWrapperRef handles all
    // visual feedback synchronously via renderCanvasRef() above.
    if (panRafRef.current === null) {
      panRafRef.current = setTimeout(() => {
        panRafRef.current = null;
        setViewport({ ...viewportRef.current });
      }, 150) as unknown as number;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setIsDraggingState(false);
    if (containerRef.current?.hasPointerCapture(e.pointerId)) containerRef.current.releasePointerCapture(e.pointerId);

    // ── Momentum / inertia scrolling (Bluebeam-style) ────────────────────────
    const FRICTION = 0.88;        // per-frame decay (lower = stops faster)
    const MIN_SPEED = 0.02;       // px/ms threshold to stop
    const FRAME_MS = 1000 / 60;

    const startMomentum = () => {
      const v = velocityRef.current;
      const speed = Math.sqrt(v.x * v.x + v.y * v.y);
      if (speed < MIN_SPEED) {
        setViewport({ ...viewportRef.current });
        return;
      }
      velocityRef.current = { x: v.x * FRICTION, y: v.y * FRICTION };
      const prev = viewportRef.current;
      const { x, y } = clampXY(
        prev.x - v.x * FRAME_MS / prev.zoom,
        prev.y - v.y * FRAME_MS / prev.zoom,
        prev.zoom,
      );
      viewportRef.current = { ...prev, x, y };
      renderCanvasRef.current();
      // Throttle React re-renders to ~7/sec (same as pan) to avoid 60fps jitter
      if (panRafRef.current === null) {
        panRafRef.current = setTimeout(() => {
          panRafRef.current = null;
          setViewport({ ...viewportRef.current });
        }, 150) as unknown as number;
      }
      momentumRafRef.current = requestAnimationFrame(startMomentum);
    };

    momentumRafRef.current = requestAnimationFrame(startMomentum);
  };

  // ─── Touch: single finger pan, two finger pinch-zoom ─────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      lastTouchRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        dist: Math.sqrt(dx * dx + dy * dy),
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!lastTouchRef.current) return;
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const prev = viewportRef.current;
      const { x, y } = clampXY(prev.x - dx / prev.zoom, prev.y - dy / prev.zoom, prev.zoom);
      viewportRef.current = { ...prev, x, y };
      renderCanvasRef.current();
      if (panRafRef.current === null) {
        panRafRef.current = setTimeout(() => { panRafRef.current = null; setViewport({ ...viewportRef.current }); }, 150) as unknown as number;
      }
    } else if (e.touches.length === 2 && lastTouchRef.current.dist !== undefined) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const zoomFactor = newDist / lastTouchRef.current.dist;
      lastTouchRef.current = { x: cx, y: cy, dist: newDist };
      // P1-4: throttle React state update (same as pan) — canvas updates at 60fps via ref
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = cx - rect.left;
      const offsetY = cy - rect.top;
      const prev = viewportRef.current;
      const nextZoom = Math.min(Math.max(prev.zoom * zoomFactor, 0.1), 10);
      const halfW = containerRef.current.clientWidth / 2;
      const next = {
        zoom: nextZoom,
        x: (prev.x + (offsetX - halfW) / prev.zoom) - (offsetX - halfW) / nextZoom,
        y: (prev.y + offsetY / prev.zoom) - offsetY / nextZoom,
      };
      viewportRef.current = next;
      renderCanvasRef.current();
      if (onZoom) { lastOnZoomRef.current = nextZoom; onZoom(nextZoom); }
      if (panRafRef.current === null) {
        panRafRef.current = setTimeout(() => { panRafRef.current = null; setViewport({ ...viewportRef.current }); }, 150) as unknown as number;
      }
    }
  };

  const handleTouchEnd = () => { lastTouchRef.current = null; };

  // ─── Imperative handle ────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    navigateTo: (worldX, worldY, zoom) => {
      if (!containerRef.current) return;
      const next: Viewport = { x: worldX, y: worldY - containerRef.current.clientHeight / (2 * zoom), zoom };
      viewportRef.current = next;
      setViewport(next);
      lastOnZoomRef.current = zoom;
      if (onZoom) onZoom(zoom);
      requestAnimationFrame(() => renderCanvasRef.current());
    },
    getViewport: () => viewportRef.current,
    getPageSize: (pageIndex: number) => {
      // Try current layouts first, then fall back to docInfo (always available)
      const layout = pageLayoutsRef.current.find(l => l.index === pageIndex);
      if (layout) return { w: layout.w, h: layout.h };
      const docI = docInfoRef.current;
      if (docI && pageIndex >= 0 && pageIndex < docI.pages.length) {
        return { w: docI.pages[pageIndex].w, h: docI.pages[pageIndex].h };
      }
      return null;
    },
    navigateToPagePoint: (pageIndex, pageX, pageY, zoom) => {
      if (!containerRef.current) return;

      // ALWAYS prefetch zoom-0 thumbnail immediately — even before layout is ready.
      // This prevents the "black screen" when jumping to a distant page in page mode.
      const thumbKey = `${documentId}/${pageIndex}/0/0/0`;
      if (!tileCache.current.has(thumbKey) && !inFlightRef.current.has(thumbKey)) {
        fetchTile(pageIndex, 0, 0, 0, false); // high priority
      }
      // Also prefetch zoom-1 tiles for the target page (4 tiles covers most pages)
      for (let tx = 0; tx < 2; tx++) {
        for (let ty = 0; ty < 2; ty++) {
          const k = `${documentId}/${pageIndex}/1/${tx}/${ty}`;
          if (!tileCache.current.has(k) && !inFlightRef.current.has(k)) {
            fetchTile(pageIndex, 1, tx, ty, false);
          }
        }
      }

      // Find the layout for this page
      let layout = pageLayoutsRef.current.find(l => l.index === pageIndex);
      if (!layout) {
        // P1-5: Layout not ready yet (page mode switching pages).
        // Store as pending — executed by useEffect once pageLayouts rebuilds.
        pendingNavigationRef.current = { pageIndex, pageX, pageY, zoom };
        return;
      }
      // World coords of the target point (top-left of page is (worldX, worldY))
      const targetWorldX = layout.worldX + pageX;
      const targetWorldY = layout.worldY + pageY;
      // Navigate: navigateTo centers (targetWorldX, targetWorldY) on screen
      const ch = containerRef.current.clientHeight;
      const next: Viewport = { x: targetWorldX, y: targetWorldY - ch / (2 * zoom), zoom };
      viewportRef.current = next;
      setViewport(next);
      lastOnZoomRef.current = zoom;
      if (onZoom) onZoom(zoom);
      requestAnimationFrame(() => renderCanvasRef.current());
    },
    screenToWorld: (clientX, clientY) => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const vp = viewportRef.current;
      const cx = containerRef.current.clientWidth / 2;
      return { x: vp.x + (clientX - rect.left - cx) / vp.zoom, y: vp.y + (clientY - rect.top) / vp.zoom };
    },
    worldToPage: (worldX, worldY) => {
      const layouts = pageLayoutsRef.current;
      if (layouts.length === 0) return null;
      // Find which page the world point falls on
      for (const l of layouts) {
        if (worldX >= l.worldX && worldX <= l.worldX + l.w &&
            worldY >= l.worldY && worldY <= l.worldY + l.h) {
          return {
            pageIndex: l.index,
            nx: (worldX - l.worldX) / l.w,
            ny: (worldY - l.worldY) / l.h,
          };
        }
      }
      // Fallback: find closest page (by Y distance)
      let best = layouts[0];
      let bestDist = Infinity;
      for (const l of layouts) {
        const cy = l.worldY + l.h / 2;
        const d = Math.abs(worldY - cy);
        if (d < bestDist) { bestDist = d; best = l; }
      }
      return {
        pageIndex: best.index,
        nx: Math.max(0, Math.min(1, (worldX - best.worldX) / best.w)),
        ny: Math.max(0, Math.min(1, (worldY - best.worldY) / best.h)),
      };
    },
    fitPage: () => {
      if (!containerRef.current || !docInfoRef.current) return;
      const page = docInfoRef.current.pages[0];
      if (!page) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const MARGIN = 24;
      const zoomW = (cw - MARGIN * 2) / page.w;
      const zoomH = (ch - MARGIN * 2) / page.h;
      const z = Math.min(zoomW, zoomH, 10);
      const next: Viewport = { zoom: z, x: 0, y: -MARGIN / z };
      viewportRef.current = next;
      setViewport(next);
      lastOnZoomRef.current = z;
      if (onZoom) onZoom(z);
      requestAnimationFrame(() => renderCanvasRef.current());
    },
    fitWidth: () => {
      if (!containerRef.current || !docInfoRef.current) return;
      const page = docInfoRef.current.pages[0];
      if (!page) return;
      const cw = containerRef.current.clientWidth;
      const MARGIN = 24;
      const z = Math.min((cw - MARGIN * 2) / page.w, 10);
      const vp = viewportRef.current;
      const next: Viewport = { zoom: z, x: 0, y: vp.y };
      viewportRef.current = next;
      setViewport(next);
      lastOnZoomRef.current = z;
      if (onZoom) onZoom(z);
      requestAnimationFrame(() => renderCanvasRef.current());
    },
    prioritizePage: (pageIndex: number) => {
      // 1. Cancel ALL in-flight low-priority background fetches that are NOT the target page.
      for (const [key, ac] of inFlightRef.current) {
        const parts = key.split('/');
        if (parts.length === 5) {
          const keyPage = parseInt(parts[1]);
          const keyZoom = parseInt(parts[2]);
          if (keyPage !== pageIndex && keyZoom === 0) {
            ac.abort();
            inFlightRef.current.delete(key);
          }
        }
      }

      // 2. Immediately fetch zoom-0 thumbnail (blurry but instant preview)
      const thumbKey = `${documentId}/${pageIndex}/0/0/0`;
      if (!tileCache.current.has(thumbKey) && !inFlightRef.current.has(thumbKey)) {
        fetchTile(pageIndex, 0, 0, 0, false);
      }

      // 3. Fetch full-resolution tiles — use layout if available, else fall back to docInfo
      let pageW: number | undefined, pageH: number | undefined;
      const layout = pageLayoutsRef.current.find(l => l.index === pageIndex);
      if (layout) {
        pageW = layout.w;
        pageH = layout.h;
      } else if (docInfoRef.current?.pages[pageIndex]) {
        // Layout not built yet (page mode switching) — use docInfo dimensions directly
        pageW = docInfoRef.current.pages[pageIndex].w;
        pageH = docInfoRef.current.pages[pageIndex].h;
      }

      if (pageW && pageH) {
        const vp = viewportRef.current;
        const level = getZoomLevel(vp.zoom);
        const levelScale = getScaleForLevel(level);
        const tileWorldSize = TILE_SIZE / levelScale;
        const cols = Math.ceil(pageW / tileWorldSize);
        const rows = Math.ceil(pageH / tileWorldSize);
        for (let tx = 0; tx < cols; tx++) {
          for (let ty = 0; ty < rows; ty++) {
            fetchTile(pageIndex, level, tx, ty, false);
          }
        }
        if (level > 1) {
          const fb = level - 1;
          const fbScale = getScaleForLevel(fb);
          const fbWorld = TILE_SIZE / fbScale;
          const fbCols = Math.ceil(pageW / fbWorld);
          const fbRows = Math.ceil(pageH / fbWorld);
          for (let tx = 0; tx < fbCols; tx++) {
            for (let ty = 0; ty < fbRows; ty++) {
              fetchTile(pageIndex, fb, tx, ty, true);
            }
          }
        }
      }
    },
    navigateToPage: (page: number, explicit = false) => {
      const mode = scrollModeRef.current;
      if (mode === 'page') {
        lastReportedPage.current = page;
        setViewport(v => ({ ...v, x: 0, y: 0 }));
      } else {
        // In continuous/split mode, only navigate if explicitly requested by user.
        // Ignoring implicit calls prevents the viewport from teleporting to page 1
        // when navigateToPage is called during auto-sync effects.
        if (!explicit) return;
        const layout = pageLayoutsRef.current.find(l => l.index === page - 1);
        if (layout) {
          lastReportedPage.current = page;
          setViewport(v => ({ ...v, y: layout.worldY }));
        }
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [onZoom]);

  return (
    <Box
      ref={containerRef}
      sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', touchAction: 'none' }}
      onMouseDown={e => { if (e.button === 1) e.preventDefault(); }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={e => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        style={{ 
          width: '100%', 
          height: '100%', 
          display: 'block', 
          cursor: cursorProp || (isDraggingState ? 'grabbing' : (tool === 'pan' ? 'grab' : 'default'))
        }}
      />
      {children && (
        <Box ref={childrenWrapperRef} sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transformOrigin: '0 0', pointerEvents: 'none', willChange: 'transform', '& > *': { pointerEvents: 'auto' } }}>
          {children(viewport, docInfo, pageLayouts, containerSize.w, containerSize.h)}
        </Box>
      )}

      {/* ─── Loading indicator — thin bar at top + compact card bottom-left ─── */}
      {loadPhase < 2 && (
        <>
          {/* Thin gold progress bar at very top */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, pointerEvents: 'none' }}>
            <LinearProgress
              variant={downloadProgress && downloadProgress.total > 0 ? 'determinate' : 'indeterminate'}
              value={downloadProgress?.percent ?? 0}
              sx={{
                height: 3,
                bgcolor: 'transparent',
                '& .MuiLinearProgress-bar': { bgcolor: 'rgba(180,140,60,0.9)', transition: 'transform 0.3s ease' },
              }}
            />
          </Box>
          {/* Centered loading card */}
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
          }}>
            <Box sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              bgcolor: 'rgba(18,18,18,0.92)',
              backdropFilter: 'blur(12px)',
              borderRadius: '16px',
              px: 5, py: 4,
              border: '1px solid rgba(180,140,60,0.35)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              minWidth: 220,
            }}>
              {/* Animated PDF badge */}
              <Box sx={{
                width: 64, height: 64, borderRadius: '14px',
                bgcolor: 'rgba(180,140,60,0.12)',
                border: '2px solid rgba(180,140,60,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'tileLoaderPulse 1.6s ease-in-out infinite',
                '@keyframes tileLoaderPulse': {
                  '0%,100%': { opacity: 1, boxShadow: '0 0 0 0 rgba(180,140,60,0.5)' },
                  '50%': { opacity: 0.75, boxShadow: '0 0 0 10px rgba(180,140,60,0)' },
                },
              }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: 'rgba(180,140,60,1)', letterSpacing: '-0.5px' }}>PDF</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.95)', lineHeight: 1.3 }}>
                  {loadPhase === 0 ? 'Connecting…' : 'Loading document…'}
                </Typography>
                {downloadProgress && downloadProgress.total > 0 ? (
                  <Typography sx={{ fontSize: '0.8rem', color: 'rgba(180,140,60,0.9)', lineHeight: 1.4, mt: 0.5 }}>
                    {(downloadProgress.written / 1024 / 1024).toFixed(1)} / {(downloadProgress.total / 1024 / 1024).toFixed(1)} MB
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, mt: 0.5 }}>
                    {loadPhase === 0 ? 'Initializing tile server' : 'Fetching pages'}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </>
      )}

      {/* P2-5: Tile server unavailable error */}
      {loadError && (
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }}>
          <Box sx={{ bgcolor: 'rgba(18,18,18,0.95)', borderRadius: '16px', px: 5, py: 4, border: '1px solid rgba(255,80,80,0.4)', textAlign: 'center', maxWidth: 320 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,120,120,0.95)', mb: 1 }}>Tile server unavailable</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Could not connect to the rendering service. Try reloading the page.</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
});

export default TileViewer;
