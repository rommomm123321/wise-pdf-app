import React, { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Box } from '@mui/material';
import type { Viewport, DocInfo, PageLayout } from './TileViewer';
import MarkupLayer from './MarkupLayer';
import { Page, Document } from 'react-pdf';

// PERF-15: Stable per-page markups — avoids re-render of unchanged MarkupLayers
function useStablePageMarkups(markups: any[], pageIndices: number[]): Map<number, any[]> {
  const prevRef = useRef(new Map<number, any[]>());
  return useMemo(() => {
    const next = new Map<number, any[]>();
    for (const idx of pageIndices) {
      const filtered = markups.filter(m => m.pageNumber === idx);
      const prev = prevRef.current.get(idx);
      // Reuse previous array ref if contents are identical (by id set + length)
      if (prev && prev.length === filtered.length && filtered.every((m, i) => m === prev[i])) {
        next.set(idx, prev);
      } else {
        next.set(idx, filtered);
      }
    }
    prevRef.current = next;
    return next;
  }, [markups, pageIndices]);
}

import type { LineStyle } from './PdfToolbar';

interface MarkupOverlayProps {
  viewport: Viewport;
  docInfo: DocInfo | null;
  layouts: PageLayout[];
  containerWidth: number;
  containerHeight: number;

  // Passed to MarkupLayer
  markups: any[];
  tool: string;
  activeColor: string;
  activeStrokeWidth: number;
  activeLineStyle: any; // Passed through to MarkupLayer
  docScale: string;
  hiddenLayers: string[];
  selectedMarkupIds: string[];
  currentUserId?: string;
  isAdmin?: boolean;
  canMarkup?: boolean;

  onMarkupAdded: (m: any) => void;
  onMarkupSelected: (ids: string[]) => void;
  onMarkupModified: (m: any) => void;
  onMarkupDeleted: (id: string | string[]) => void;
  onContextMenu: (e: any, id: string) => void;
  onCanvasMention?: (data: { anchor: HTMLElement; query: string; onSelect: (name: string) => void; } | null) => void;
  onDeselect?: () => void;
  onSwitchToSelect?: () => void;
  searchResults?: any[];
  activeSearchResultIndex?: number | null;
  
  pdfDoc?: any;
  pdfFile?: any;
  pdfOptions?: any;
  /** pdfjs page 1 width in native PDF units (e.g. 595 for A4 at scale=1).
   * Used to convert search result coordinates from pdfjs-space to tile-server-space (2×). */
  pdfjsPageWidth?: number;
}

export default function MarkupOverlay(props: MarkupOverlayProps) {
  const { viewport, docInfo, layouts, containerWidth, containerHeight, pdfDoc } = props;

  // Track the zoom level that was actually rendered on the Fabric canvas
  const [renderedZoom, setRenderedZoom] = useState(viewport.zoom);
  const zoomDebounceRef = useRef<any>(null);

  // When viewport.zoom changes, we wait for it to settle before redrawing high-res markups.
  // In the meantime, we use CSS scale for instant feedback.
  // Cap renderedZoom to prevent Fabric.js canvases from becoming too large at high zoom.
  // With enableRetinaScaling=true (DPR=2), the physical canvas is 2x larger.
  // Cap at 2.0 so the physical canvas stays ≤ 4760×6736px per page (crisp + GPU-safe).
  // CSS scale handles the remaining zoom factor visually (zoom/2.0 at max zoom).
  const MAX_RENDERED_ZOOM = 2.0;

  useEffect(() => {
    if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
    zoomDebounceRef.current = setTimeout(() => {
      setRenderedZoom(Math.min(viewport.zoom, MAX_RENDERED_ZOOM));
    }, 250);
    return () => clearTimeout(zoomDebounceRef.current);
  }, [viewport.zoom]);

  // Calculate which pages are visible to avoid mounting 100 Fabric.js canvases
  const visiblePages = useMemo(() => {
    if (!docInfo || !layouts) return [];
    
    const pages = [];
    const containerCenter = (containerWidth / viewport.zoom) / 2;

    for (const p of layouts) {
        // Buffer proportional to page height at current zoom — prevents pop-in without rendering too many off-screen pages
        const PADDING = Math.max(50, Math.min(150, p.h * viewport.zoom * 0.25));
        
        const pageTopScreen = (p.worldY - viewport.y) * viewport.zoom;
        const pageBottomScreen = pageTopScreen + (p.h * viewport.zoom);
        
        if (pageBottomScreen > -PADDING && pageTopScreen < containerHeight + PADDING) {
            // It's visible (or near)!
            pages.push({
                index: p.index,
                w: p.w,
                h: p.h,
                screenY: pageTopScreen,
                screenX: (containerCenter + p.worldX - viewport.x) * viewport.zoom
            });
        }
    }

    return pages;
  }, [docInfo, layouts, viewport, containerWidth, containerHeight]);

  // PERF-15: stable per-page markup arrays — prevents unnecessary MarkupLayer re-renders
  const visibleIndices = useMemo(() => visiblePages.map(p => p.index), [visiblePages]);
  const stableMarkups = useStablePageMarkups(props.markups, visibleIndices);

  // Block wheel scroll during active drawing to prevent viewport pan desync.
  // Only blocks when a drawing tool is active AND pointer is down on canvas.
  const isDrawingTool = !['select', 'pan', 'textSelect'].includes(props.tool);
  const pointerDownOnCanvas = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    const onPointerDown = () => { if (isDrawingTool) pointerDownOnCanvas.current = true; };
    const onPointerUp = () => { pointerDownOnCanvas.current = false; };
    const blockWheel = (e: WheelEvent) => {
      // Block scroll when actively drawing OR in polyline/routeTemplate mode (multi-click)
      if (isDrawingTool && (pointerDownOnCanvas.current || ['polyline', 'routeTemplate'].includes(props.tool))) {
        if (!e.ctrlKey && !e.metaKey) {
          e.stopPropagation();
        }
      }
    };

    el.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('wheel', blockWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('wheel', blockWheel, true);
    };
  }, [isDrawingTool, props.tool]);

  if (!docInfo || visiblePages.length === 0) return null;

  const showTextLayer = props.tool === 'textSelect' && !!pdfDoc;

  return (
    <Box ref={overlayRef} sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>

      {/* ── MARKUP LAYERS (always rendered, no react-pdf context needed) ── */}
      {visiblePages.map(page => {
        const pageMarkups = stableMarkups.get(page.index) || [];
        const isPassThrough = props.tool === 'pan';
        const currentCssScale = viewport.zoom / renderedZoom;
        return (
          <Box
            key={page.index}
            sx={{
              position: 'absolute', top: 0, left: 0,
              transform: `translate(${page.screenX}px, ${page.screenY}px) scale(${currentCssScale})`,
              transformOrigin: 'top left',
              width: page.w * renderedZoom,
              height: page.h * renderedZoom,
              pointerEvents: isPassThrough ? 'none' : 'auto',
              ...(isPassThrough && { '& canvas': { pointerEvents: 'none' } }),
            }}
          >
            <MarkupLayer
              pageNumber={page.index}
              width={page.w * renderedZoom}
              height={page.h * renderedZoom}
              scale={renderedZoom}
              viewportZoom={viewport.zoom}
              markups={pageMarkups}
              tool={props.tool as any}
              activeColor={props.activeColor}
              activeStrokeWidth={props.activeStrokeWidth}
              activeLineStyle={props.activeLineStyle}
              docScale={props.docScale}
              hiddenLayers={props.hiddenLayers}
              selectedMarkupIds={props.selectedMarkupIds}
              currentUserId={props.currentUserId}
              isAdmin={props.isAdmin}
              canMarkup={props.canMarkup}
              onMarkupAdded={props.onMarkupAdded}
              onMarkupSelected={props.onMarkupSelected}
              onMarkupModified={props.onMarkupModified}
              onMarkupDeleted={props.onMarkupDeleted}
              onContextMenu={props.onContextMenu}
              onCanvasMention={props.onCanvasMention}
              onDeselect={props.onDeselect}
              onSwitchToSelect={props.onSwitchToSelect}
            />
            {/* Active Search Match Highlight Overlay */}
            {props.searchResults && props.activeSearchResultIndex !== null && props.activeSearchResultIndex !== undefined && (
              props.searchResults.map((res, i) => {
                if (i !== props.activeSearchResultIndex || res.pageIndex !== page.index) return null;
                // Search results from pdfjs use scale=1 PDF units (e.g. 595-wide for A4).
                // The tile server renders pages at 2× (e.g. 1190-wide). We must scale up.
                const tileW = docInfo?.pages[page.index]?.w ?? page.w;
                const pdfjsW = props.pdfjsPageWidth ?? (tileW / 2);
                const coordScale = tileW / pdfjsW;
                // Render a pulsing blue highlight over the exact match
                return (
                  <Box
                    key={`search-hl-${i}`}
                    sx={{
                      position: 'absolute',
                      left: res.x * coordScale * renderedZoom,
                      top: res.y * coordScale * renderedZoom,
                      width: (res.w || 20) * coordScale * renderedZoom,
                      height: (res.h || 12) * coordScale * renderedZoom,
                      backgroundColor: 'rgba(33, 150, 243, 0.4)',
                      border: '2px solid rgba(33, 150, 243, 0.8)',
                      borderRadius: '3px',
                      pointerEvents: 'none',
                      zIndex: 20,
                      animation: 'searchPulse 2s infinite',
                      '@keyframes searchPulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(33, 150, 243, 0.7)' },
                        '70%': { boxShadow: '0 0 0 10px rgba(33, 150, 243, 0)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(33, 150, 243, 0)' }
                      }
                    }}
                  />
                );
              })
            )}
          </Box>
        );
      })}

      {/* ── TEXT LAYERS (inside Document, always mounted when pdfDoc available → no reload on tool switch) ── */}
      {pdfDoc && (
        <Document file={props.pdfFile} options={props.pdfOptions} loading={null} noData={null} error={null}>
          {visiblePages.map(page => {
            const currentCssScale = viewport.zoom / renderedZoom;
            return (
              <Box
                key={`text-${page.index}`}
                sx={{
                  position: 'absolute', top: 0, left: 0,
                  transform: `translate(${page.screenX}px, ${page.screenY}px) scale(${currentCssScale})`,
                  transformOrigin: 'top left',
                  width: page.w * renderedZoom,
                  height: page.h * renderedZoom,
                  // Visibility via CSS — keeps Page mounted, avoids PDF reload on tool switch
                  opacity: showTextLayer ? 1 : 0,
                  pointerEvents: showTextLayer ? 'auto' : 'none',
                  zIndex: 20,
                  '& .react-pdf__Page__textContent': {
                    pointerEvents: showTextLayer ? 'auto' : 'none',
                  },
                }}
              >
                <Page
                  pageNumber={page.index + 1}
                  scale={renderedZoom}
                  renderMode="none"
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                />
              </Box>
            );
          })}
        </Document>
      )}
    </Box>
  );
}
