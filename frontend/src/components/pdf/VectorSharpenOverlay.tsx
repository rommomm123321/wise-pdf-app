import { memo } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface Props {
  pdfDoc: PDFDocumentProxy | null | undefined;
  viewport: { zoom: number; x: number; y: number };
  pageLayouts: Array<{ index: number; worldX: number; worldY: number; w: number; h: number }>;
  containerWidth: number;
  containerHeight: number;
}

/**
 * VectorSharpenOverlay — DISABLED.
 * Renders a full opaque PDF page (white background) on top of tiles, covering content.
 * Needs proper compositing architecture (e.g. text-only layer via pdfjs TextLayer)
 * before it can be re-enabled safely.
 */
function VectorSharpenOverlay(_props: Props) {
  return null;
}

export default memo(VectorSharpenOverlay);
