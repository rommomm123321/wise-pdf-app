import { useEffect, useRef, memo } from 'react';

interface Props {
  pdfDoc: any;
  viewport: { zoom: number; x: number; y: number };
  pageLayouts: Array<{ index: number; worldX: number; worldY: number; w: number; h: number }>;
  containerWidth: number;
  containerHeight: number;
}

/**
 * VectorSharpenOverlay — DISABLED.
 * Tile server provides raster tiles; this overlay was causing rendering artifacts
 * (partial page display, offset issues). Removed until architecture is reworked.
 */
function VectorSharpenOverlay(_props: Props) {
  return null;
}

export default memo(VectorSharpenOverlay);
