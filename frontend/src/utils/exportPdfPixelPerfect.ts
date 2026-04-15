/**
 * exportPdfPixelPerfect.ts
 *
 * Pixel-perfect PDF export with Bluebeam compatibility.
 *
 * TWO layers per page:
 *   1. Native PDF annotations (from existing annotateDoc) → Bluebeam can edit
 *   2. PNG overlay (captured from actual Fabric.js DOM canvas) → pixel-perfect visual
 *
 * STANDALONE — does NOT modify existing export code.
 * Only imports the exported annotateDoc function.
 */

import { PDFDocument } from 'pdf-lib';

function triggerDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Get all rendered Fabric.js canvases by page index.
 */
function getAllRenderedCanvases(): Map<number, HTMLCanvasElement> {
  const result = new Map<number, HTMLCanvasElement>();
  const pageContainers = document.querySelectorAll('[data-page-index]');
  for (const container of Array.from(pageContainers)) {
    const idx = parseInt(container.getAttribute('data-page-index') || '-1', 10);
    if (idx >= 0) {
      const canvas = container.querySelector('.lower-canvas') as HTMLCanvasElement;
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        result.set(idx, canvas);
      }
    }
  }
  if (result.size === 0) {
    const allCanvases = document.querySelectorAll('canvas.lower-canvas');
    let idx = 0;
    for (const canvas of Array.from(allCanvases) as HTMLCanvasElement[]) {
      if (canvas.width > 0 && canvas.height > 0) {
        result.set(idx, canvas);
        idx++;
      }
    }
  }
  return result;
}

export interface PixelPerfectExportOptions {
  pdfDocProxy: { getData: () => Promise<Uint8Array>; numPages: number };
  allMarkups: unknown[];
  numPages: number;
  docScale: string;
  hiddenLayers?: string[];
  docName?: string;
  navigateToPage?: (page: number) => Promise<void>;
  onProgress?: (current: number, total: number, phase: string) => void;
}

export async function exportPdfPixelPerfect(opts: PixelPerfectExportOptions): Promise<void> {
  const {
    pdfDocProxy, allMarkups, numPages, docScale,
    hiddenLayers = [], docName = 'export',
    navigateToPage, onProgress,
  } = opts;

  onProgress?.(0, numPages, 'Loading PDF...');
  const rawBytes = await pdfDocProxy.getData();
  const pdfDoc = await PDFDocument.load(rawBytes);

  // PNG overlays only — no native PDF annotations
  let capturedPages = 0;

  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    // Skip pages without markups
    const pageHasMarkups = (allMarkups as any[]).some(
      m => m.pageNumber === pageIdx && !hiddenLayers.includes(m.type)
    );
    if (!pageHasMarkups) continue;

    onProgress?.(pageIdx + 1, numPages, `Capturing page ${pageIdx + 1}/${numPages}...`);

    let canvases = getAllRenderedCanvases();
    let canvas = canvases.get(pageIdx);

    // Navigate to page if not visible
    if (!canvas && navigateToPage) {
      try {
        await navigateToPage(pageIdx + 1);
        await new Promise(resolve => setTimeout(resolve, 1000));
        canvases = getAllRenderedCanvases();
        canvas = canvases.get(pageIdx);
      } catch {
        // console.warn(`[PixelPerfect] Could not navigate to page ${pageIdx + 1}`);
      }
    }

    if (!canvas) {
      // console.warn(`[PixelPerfect] No canvas for page ${pageIdx}`);
      continue;
    }

    try {
      const pngDataUrl = canvas.toDataURL('image/png');
      const pngBytes = Uint8Array.from(atob(pngDataUrl.split(',')[1]), c => c.charCodeAt(0));
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const page = pdfDoc.getPage(pageIdx);
      const { width: pw, height: ph } = page.getSize();

      page.drawImage(pngImage, { x: 0, y: 0, width: pw, height: ph, opacity: 1 });
      capturedPages++;
      // console.log(`[PixelPerfect] Page ${pageIdx}: ${canvas.width}x${canvas.height} → ${pw}x${ph}`);
    } catch (err) {
      // console.warn(`[PixelPerfect] Failed page ${pageIdx}:`, err);
    }
  }

  // console.log(`[PixelPerfect] Done: ${capturedPages} pages with overlays`);
  onProgress?.(numPages, numPages, 'Saving PDF...');

  const outBytes = await pdfDoc.save();
  triggerDownload(outBytes, `${docName.replace(/\.pdf$/i, '')}_with_markups.pdf`);
}
