import { useEffect, useRef, memo } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface Props {
  pdfDoc: PDFDocumentProxy | null | undefined;
  viewport: { zoom: number; x: number; y: number };
  pageLayouts: Array<{ index: number; worldX: number; worldY: number; w: number; h: number }>;
  containerWidth: number;
  containerHeight: number;
}

const MAX_PIXELS = 40_000_000; // 40M pixel safety cap — prevents GPU crash on huge pages
const SETTLE_MS = 350;         // Wait for scroll/zoom to settle before rendering

/**
 * VectorSharpenOverlay — renders the most-visible page via pdfjs at exact DPR
 * after scroll/zoom settles (350ms). Positioned to match TileViewer's tile layer exactly.
 * Provides crisp vector text over the raster tile background.
 */
function VectorSharpenOverlay({ pdfDoc, viewport, pageLayouts, containerWidth, containerHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  useEffect(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);

    settleTimer.current = setTimeout(async () => {
      if (!pdfDoc || !canvasRef.current || pageLayouts.length === 0) return;

      // Find most-visible page (largest vertical overlap with viewport)
      let bestLayout = pageLayouts[0];
      let bestOverlap = -Infinity;
      for (const layout of pageLayouts) {
        const screenY = (layout.worldY - viewport.y) * viewport.zoom;
        const screenH = layout.h * viewport.zoom;
        const overlap = Math.min(containerHeight, screenY + screenH) - Math.max(0, screenY);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestLayout = layout;
        }
      }

      const renderW = Math.round(bestLayout.w * viewport.zoom);
      const renderH = Math.round(bestLayout.h * viewport.zoom);
      const physW = Math.round(renderW * dpr);
      const physH = Math.round(renderH * dpr);

      // Safety cap — skip very large pages (e.g. A0 at high zoom)
      if (physW * physH > MAX_PIXELS) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const page = await pdfDoc.getPage(bestLayout.index + 1);
        const pdfVp = page.getViewport({ scale: viewport.zoom * dpr });

        canvas.width = pdfVp.width;
        canvas.height = pdfVp.height;
        canvas.style.width = `${renderW}px`;
        canvas.style.height = `${renderH}px`;

        // Position to exactly match TileViewer's page screen position
        // TileViewer: screenX = worldX * zoom + containerWidth/2
        //             screenY = (worldY - viewport.y) * zoom
        const screenX = bestLayout.worldX * viewport.zoom + containerWidth / 2;
        const screenY = (bestLayout.worldY - viewport.y) * viewport.zoom;
        canvas.style.left = `${screenX}px`;
        canvas.style.top = `${screenY}px`;
        canvas.style.opacity = '1';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, pdfVp.width, pdfVp.height);
        await page.render({ canvasContext: ctx, viewport: pdfVp }).promise;
      } catch {
        // Swallow — page not yet loaded, canvas gone, or component unmounted
      }
    }, SETTLE_MS);

    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [pdfDoc, viewport, pageLayouts, containerWidth, containerHeight, dpr]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity 0.2s ease-in',
        imageRendering: 'crisp-edges',
        mixBlendMode: 'multiply',  // white background disappears, only dark ink shows
        zIndex: 5,
      }}
    />
  );
}

export default memo(VectorSharpenOverlay);
