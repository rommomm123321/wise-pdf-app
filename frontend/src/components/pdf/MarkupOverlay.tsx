import React, { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Box, alpha } from '@mui/material';
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
  /** When set, only markups whose properties.sessionId matches are editable */
  activeSessionId?: string | null;
  showAuthorOnMarkup?: boolean;

  onMarkupAdded: (m: any) => void;
  onMarkupSelected: (ids: string[]) => void;
  onMarkupModified: (m: any) => void;
  onMarkupDeleted: (id: string | string[]) => void;
  onContextMenu: (e: any, id: string) => void;
  onCanvasMention?: (data: { anchor: HTMLElement; query: string; onSelect: (name: string) => void; } | null) => void;
  onDeselect?: () => void;
  onSwitchToSelect?: () => void;
  electricalConfig?: any;
  searchResults?: any[];
  activeSearchResultIndex?: number | null;
  pulseEnabled?: boolean;
  pulseColor?: string;
  pulseIntensity?: 'low' | 'medium' | 'high';
  snapGrid?: number;

  pdfDoc?: any;
  pdfFile?: any;
  pdfOptions?: any;
  /** pdfjs page 1 width in native PDF units (e.g. 595 for A4 at scale=1).
   * Used to convert search result coordinates from pdfjs-space to tile-server-space (2×). */
  pdfjsPageWidth?: number;
}

export default function MarkupOverlay(props: MarkupOverlayProps) {
  const { viewport, docInfo, layouts, containerWidth, containerHeight, pdfDoc } = props;

  // ── Dynamic renderedZoom: adapts Fabric canvas resolution to viewport zoom ──
  // Strategy: renderedZoom = snap to discrete steps so canvas isn't resized on every scroll.
  // Steps: 1.0, 2.0, 3.0, 5.0 — covers zoom 0.1x to 20x with cssScale always ≤ 2.0.
  // When cssScale > 1.5, we bump renderedZoom up; when < 0.5, we drop down.
  // Debounced 300ms so rapid zooming doesn't cause canvas resize storm.
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const [renderedZoom, setRenderedZoom] = useState(2.0);
  const renderedZoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRenderedZoomRef = useRef(2.0);

  useEffect(() => {
    const maxPageH = docInfo?.pages?.reduce((m: number, p: any) => Math.max(m, p.h || 0), 0) || 1684;
    const maxPageW = docInfo?.pages?.reduce((m: number, p: any) => Math.max(m, p.w || 0), 0) || 1190;
    const maxDim = Math.max(maxPageW, maxPageH);
    // Max canvas pixels: 8192px on longest side / DPR
    const budgetMax = 8192 / (maxDim * dpr);

    // Discrete steps for renderedZoom (don't resize canvas on every pixel of scroll)
    const STEPS = [1.0, 1.5, 2.0, 3.0, Math.min(5.0, budgetMax)];
    const vz = viewport.zoom;

    // Find the best step: smallest step where cssScale (vz / step) ≤ 1.5
    // This means the CSS magnification is at most 1.5x → sharp text
    let best = STEPS[0];
    for (const s of STEPS) {
      if (vz / s <= 1.5) { best = s; break; }
      best = s; // if all steps give cssScale > 1.5, use the largest
    }
    // Don't go below 1.0 or above budget
    best = Math.max(1.0, Math.min(budgetMax, best));

    // Only update if step actually changed (avoid unnecessary canvas resize)
    if (Math.abs(best - prevRenderedZoomRef.current) < 0.01) return;

    // Debounce: wait 300ms after zoom settles before resizing canvas
    if (renderedZoomTimerRef.current) clearTimeout(renderedZoomTimerRef.current);
    renderedZoomTimerRef.current = setTimeout(() => {
      prevRenderedZoomRef.current = best;
      setRenderedZoom(best);
    }, 300);

    return () => { if (renderedZoomTimerRef.current) clearTimeout(renderedZoomTimerRef.current); };
  }, [viewport.zoom, docInfo]);

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
      // Block scroll when:
      // - actively drawing (pointerDown + drawing tool)
      // - in polyline/routeTemplate multi-click mode
      // - pointer is down on canvas in ANY mode (vertex edit, object drag)
      if (pointerDownOnCanvas.current || (isDrawingTool && ['polyline', 'routeTemplate'].includes(props.tool))) {
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
              // Ensure Fabric.js canvas container is always transparent (prevent black flash)
              '& .canvas-container': { background: 'transparent !important' },
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
              electricalConfig={props.electricalConfig}
              snapGrid={props.snapGrid}
              activeSessionId={props.activeSessionId}
              showAuthorOnMarkup={props.showAuthorOnMarkup}
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
            {/* Pulsating markup highlights — SVG shape-adaptive, rotates with markup */}
            {props.markups
              .filter(m => m.pageNumber === page.index && m.properties?.pulse && m.id && !m.id.startsWith('preview') && m.type !== 'stickyNote')
              .map(m => {
                const coords = m.coordinates || {};
                const hasRect = coords.left != null && coords.width != null;
                let nx: number, ny: number, nw: number, nh: number;
                if (hasRect) {
                  nx = coords.left; ny = coords.top ?? 0; nw = coords.width; nh = coords.height ?? nw;
                } else {
                  const x1 = coords.x1 ?? 0, y1 = coords.y1 ?? 0, x2 = coords.x2 ?? x1, y2 = coords.y2 ?? y1;
                  nx = Math.min(x1, x2); ny = Math.min(y1, y2);
                  nw = Math.abs(x2 - x1) || 0.05; nh = Math.abs(y2 - y1) || 0.05;
                }
                const pw = page.w * renderedZoom, ph = page.h * renderedZoom;
                const sw = ((m.properties?.strokeWidth || 2) * renderedZoom) / 2;
                const angle = coords.angle || 0;

                // Compute REAL center accounting for Fabric.js left/top adjustment on rotation
                const halfW = nw * pw / 2;
                const halfH = nh * ph / 2;
                const rad = angle * Math.PI / 180;
                const cosA = Math.cos(rad);
                const sinA = Math.sin(rad);
                const cx = nx * pw + halfW * cosA - halfH * sinA;
                const cy = ny * ph + halfW * sinA + halfH * cosA;

                const pulseColor = props.pulseColor || '#00e5ff';
                const cssScale = viewport.zoom / renderedZoom || 1;
                const screenPx = props.pulseIntensity === 'high' ? 3 : props.pulseIntensity === 'low' ? 1 : 2;
                const expand = screenPx / cssScale;
                const strokeW = Math.max(1, 1.5 / cssScale);
                let boxW = nw * pw + sw * 2 + expand * 2;
                let boxH = nh * ph + sw * 2 + expand * 2;
                const glowBlur = props.pulseIntensity === 'high' ? 5 : props.pulseIntensity === 'low' ? 2 : 3;

                // ── Determine pulse shape from markup type + stampShape ──
                const mType = m.type;
                const stampShape = m.properties?.stampShape;
                type PulseShape = 'rect' | 'rounded' | 'circle' | 'diamond' | 'triangle' | 'cloud' | 'ellipse';
                let shape: PulseShape = 'rect';
                if (mType === 'circle' || mType === 'stub' || stampShape === 'circle') shape = 'circle';
                else if (mType === 'ellipse') shape = 'ellipse';
                else if (stampShape === 'diamond') shape = 'diamond';
                else if (stampShape === 'triangle') shape = 'triangle';
                else if (stampShape === 'cloud' || mType === 'cloud' || mType === 'callout') shape = 'cloud';
                else if (stampShape === 'rounded') shape = 'rounded';

                // For circle, make box square using max dimension
                if (shape === 'circle') {
                  const side = Math.max(boxW, boxH);
                  boxW = side; boxH = side;
                }

                // ── Build SVG outline path based on shape ──
                const p = strokeW / 2; // inset for stroke
                let svgContent: React.ReactNode;
                switch (shape) {
                  case 'circle':
                    svgContent = <ellipse cx={boxW / 2} cy={boxH / 2} rx={boxW / 2 - p} ry={boxH / 2 - p}
                      fill="none" stroke={pulseColor} strokeWidth={strokeW} />;
                    break;
                  case 'ellipse':
                    svgContent = <ellipse cx={boxW / 2} cy={boxH / 2} rx={boxW / 2 - p} ry={boxH / 2 - p}
                      fill="none" stroke={pulseColor} strokeWidth={strokeW} />;
                    break;
                  case 'diamond':
                    svgContent = <polygon
                      points={`${boxW / 2},${p} ${boxW - p},${boxH / 2} ${boxW / 2},${boxH - p} ${p},${boxH / 2}`}
                      fill="none" stroke={pulseColor} strokeWidth={strokeW} strokeLinejoin="round" />;
                    break;
                  case 'triangle':
                    svgContent = <polygon
                      points={`${boxW / 2},${p} ${p},${boxH - p} ${boxW - p},${boxH - p}`}
                      fill="none" stroke={pulseColor} strokeWidth={strokeW} strokeLinejoin="round" />;
                    break;
                  case 'cloud': {
                    const rx = Math.min(boxW, boxH) * 0.25;
                    svgContent = <rect x={p} y={p} width={boxW - strokeW} height={boxH - strokeW}
                      rx={rx} ry={rx} fill="none" stroke={pulseColor} strokeWidth={strokeW} />;
                    break;
                  }
                  case 'rounded': {
                    const rr = Math.min(boxW, boxH) * 0.35;
                    svgContent = <rect x={p} y={p} width={boxW - strokeW} height={boxH - strokeW}
                      rx={rr} ry={rr} fill="none" stroke={pulseColor} strokeWidth={strokeW} />;
                    break;
                  }
                  default: {
                    const dr = Math.min(3 / cssScale, boxW * 0.04, boxH * 0.04);
                    svgContent = <rect x={p} y={p} width={boxW - strokeW} height={boxH - strokeW}
                      rx={dr} ry={dr} fill="none" stroke={pulseColor} strokeWidth={strokeW} />;
                  }
                }

                return (
                  <Box key={`pulse-${m.id}`}
                    sx={{
                      position: 'absolute',
                      left: cx - boxW / 2,
                      top: cy - boxH / 2,
                      width: boxW,
                      height: boxH,
                      pointerEvents: 'none',
                      zIndex: 15,
                      transform: angle ? `rotate(${angle}deg)` : 'none',
                      transformOrigin: 'center center',
                      // drop-shadow follows SVG shape outline (unlike boxShadow which is rect-only)
                      animation: 'markupPulse 2s ease-in-out infinite',
                      '@keyframes markupPulse': {
                        '0%': { opacity: 0.3, filter: `drop-shadow(0 0 0px ${pulseColor}30)` },
                        '50%': { opacity: 0.9, filter: `drop-shadow(0 0 ${glowBlur}px ${pulseColor}60)` },
                        '100%': { opacity: 0.3, filter: `drop-shadow(0 0 0px ${pulseColor}30)` },
                      },
                    }}
                  >
                    <svg width={boxW} height={boxH} style={{ display: 'block' }}>
                      {svgContent}
                    </svg>
                  </Box>
                );
              })}
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
