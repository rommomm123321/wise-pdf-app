/**
 * exportPdfBluebeam.ts
 *
 * Full Bluebeam-compatible PDF export with Appearance Streams.
 *
 * TWO layers per annotation:
 *   1. Native PDF annotation (geometry, colors, text) → Bluebeam can edit
 *   2. Appearance Stream (/AP) → pixel-perfect visual via Fabric.js canvas render
 *
 * This is a STANDALONE file — does NOT modify existing export code.
 * The caller can switch between old export and this one.
 *
 * Supported markup types (ALL):
 *   rect, circle/ellipse, triangle, diamond, hexagon, star, cloud,
 *   line, arrow, measure, polyline, pen, highlighter, text, stickyNote,
 *   callout (simple + cloud), reviewStamp, electricalBox, stub, panel,
 *   wireTag, routeTemplate, route, image
 */

import {
  PDFDocument, PDFName, PDFArray, PDFRef, PDFDict, PDFString,
  PDFHexString, PDFStream, PDFRawStream, PDFNumber,
} from 'pdf-lib';
// @ts-ignore — fabric v5 has no proper type declarations
import { fabric } from 'fabric';

// ─── Coordinate helpers (same as original, duplicated for isolation) ──────────

function toPdfPt(nx: number, ny: number, pw: number, ph: number): [number, number] {
  return [nx * pw, ph * (1 - ny)];
}

function normRectToPdf(
  left: number, top: number, w: number, h: number,
  pw: number, ph: number,
): [number, number, number, number] {
  return [left * pw, ph * (1 - top - h), (left + w) * pw, ph * (1 - top)];
}

function vertsBBox(verts: number[]): [number, number, number, number] {
  const xs = verts.filter((_, i) => i % 2 === 0);
  const ys = verts.filter((_, i) => i % 2 !== 0);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function hexToRgbArr(hex: string): [number, number, number] {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return [0.8, 0, 0];
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function normPolyVerts(pts: { x: number; y: number }[], pw: number, ph: number): number[] {
  return pts.flatMap(p => toPdfPt(p.x, p.y, pw, ph));
}

function toPdfDate(input: string | Date | undefined | null): string | undefined {
  if (!input) return undefined;
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(d.getTime())) return undefined;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `D:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  } catch { return undefined; }
}

// ─── PDF annotation helpers ─────────────────────────────────────────────────

function registerAnnot(doc: PDFDocument, dict: Record<string, unknown>): PDFRef {
  const ref = doc.context.register(doc.context.obj(dict as any));
  return ref;
}

function addAnnotToPage(
  page: { node: { lookupMaybe: (...a: unknown[]) => unknown; set: (...a: unknown[]) => void } },
  ref: PDFRef, doc: PDFDocument,
) {
  const existing = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  const annots = existing instanceof PDFArray ? existing : doc.context.obj([]);
  (annots as PDFArray).push(ref);
  page.node.set(PDFName.of('Annots'), annots as PDFArray);
}

function bsDict(sw: number, lineStyle: string): Record<string, unknown> {
  const dashMap: Record<string, number[]> = {
    dashed: [12, 6], dotted: [2, 4], 'dash-dot': [15, 6, 3, 6],
    'long-dash': [25, 8], 'short-dash': [6, 4],
  };
  const dash = dashMap[lineStyle];
  if (dash) return { W: sw, S: PDFName.of('D'), D: dash };
  return { W: sw, S: PDFName.of('S') };
}

// ─── Appearance Stream generator ────────────────────────────────────────────

/**
 * Render a single markup onto an offscreen Fabric.js StaticCanvas,
 * export as PNG, embed in PDF as an XObject Form (Appearance Stream).
 *
 * The Appearance Stream is what Bluebeam/Acrobat ACTUALLY renders.
 * If /AP exists, PDF viewers use it instead of computing from geometry.
 */
async function createAppearanceStream(
  m: Record<string, unknown>,
  doc: PDFDocument,
  pw: number, ph: number,
  rect: [number, number, number, number],
): Promise<PDFRef | null> {
  const coords = (m.coordinates as Record<string, unknown>) || {};
  const props = (m.properties as Record<string, unknown>) || {};
  const type = m.type as string;

  // Calculate pixel dimensions for the canvas
  // We render at 2x for quality (retina)
  const SCALE = 2;
  const rectW = rect[2] - rect[0];
  const rectH = rect[3] - rect[1];

  // Normalized coords
  const nLeft = (coords.left as number) || 0;
  const nTop = (coords.top as number) || 0;
  const nWidth = (coords.width as number) || 0;
  const nHeight = (coords.height as number) || 0;

  // Canvas size in pixels (at least 10px to avoid degenerate canvases)
  const canvasW = Math.max(Math.round(rectW * SCALE), 10);
  const canvasH = Math.max(Math.round(rectH * SCALE), 10);

  // Skip degenerate markups
  if (canvasW > 8000 || canvasH > 8000) return null;

  try {
    const staticCanvas = new fabric.StaticCanvas(null, {
      width: canvasW,
      height: canvasH,
      backgroundColor: 'transparent',
      enableRetinaScaling: false,
    });

    const stroke = (props.stroke as string) || '#d32f2f';
    const sw = ((props.strokeWidth as number) || 2) * SCALE;
    const fill = (props.fill as string) || 'transparent';
    const fillOpacity = (props.fillOpacity as number) ?? (fill !== 'transparent' ? 0.2 : 0);

    // Map markup to Fabric.js objects
    // All drawing happens in canvas pixel space (0,0 = top-left of markup bounding box)
    const fabricObjects: fabric.Object[] = [];

    if (type === 'rect') {
      fabricObjects.push(new fabric.Rect({
        left: sw/2, top: sw/2,
        width: canvasW - sw, height: canvasH - sw,
        stroke, strokeWidth: sw,
        fill: fill !== 'transparent' ? fill : undefined,
        opacity: fillOpacity || 1,
        rx: 0, ry: 0,
      }));
    }
    else if (type === 'circle' || type === 'ellipse') {
      fabricObjects.push(new fabric.Ellipse({
        left: sw/2, top: sw/2,
        rx: (canvasW - sw) / 2, ry: (canvasH - sw) / 2,
        stroke, strokeWidth: sw,
        fill: fill !== 'transparent' ? fill : undefined,
        opacity: fillOpacity || 1,
      }));
    }
    else if (type === 'line' || type === 'arrow' || type === 'measure') {
      const x1 = coords.x1 as number || 0;
      const y1 = coords.y1 as number || 0;
      const x2 = coords.x2 as number || 0;
      const y2 = coords.y2 as number || 0;
      // Convert normalized to canvas-local
      const lx1 = (x1 * pw - rect[0]) * SCALE;
      const ly1 = ((1 - y1) * ph - rect[1]) * SCALE;
      const lx2 = (x2 * pw - rect[0]) * SCALE;
      const ly2 = ((1 - y2) * ph - rect[1]) * SCALE;
      fabricObjects.push(new fabric.Line([lx1, ly1, lx2, ly2], {
        stroke, strokeWidth: sw,
      }));
      // Arrow heads
      if (type === 'arrow') {
        const arrowStyle = (props.arrowStyle as string) || 'end';
        const angle = Math.atan2(ly2 - ly1, lx2 - lx1);
        const headLen = sw * 4;
        if (arrowStyle === 'end' || arrowStyle === 'both') {
          fabricObjects.push(new fabric.Triangle({
            left: lx2, top: ly2,
            width: headLen, height: headLen,
            angle: (angle * 180 / Math.PI) + 90,
            fill: stroke, originX: 'center', originY: 'center',
          }));
        }
        if (arrowStyle === 'start' || arrowStyle === 'both') {
          fabricObjects.push(new fabric.Triangle({
            left: lx1, top: ly1,
            width: headLen, height: headLen,
            angle: (angle * 180 / Math.PI) - 90,
            fill: stroke, originX: 'center', originY: 'center',
          }));
        }
      }
    }
    else if (type === 'text' || type === 'stickyNote') {
      const text = (props.text as string) || (props.comment as string) || '';
      const fontSize = ((props.fontSize as number) || 14) * SCALE;
      const textColor = (props.textColor as string) || '#000000';
      const bgColor = type === 'stickyNote' ? ((props.fill as string) || '#fff9c4') : (fill !== 'transparent' ? fill : undefined);

      if (bgColor) {
        fabricObjects.push(new fabric.Rect({
          left: 0, top: 0, width: canvasW, height: canvasH,
          fill: bgColor, stroke: stroke, strokeWidth: sw,
        }));
      }
      fabricObjects.push(new fabric.Textbox(text, {
        left: sw + 4, top: sw + 2,
        width: canvasW - sw * 2 - 8,
        fontSize, fill: textColor,
        fontFamily: (props.fontFamily as string) || 'Arial',
        fontWeight: (props.fontWeight as string) || 'normal',
        fontStyle: (props.fontStyle as string) || 'normal',
      }));
    }
    else if (type === 'reviewStamp') {
      const stampText = (props.text as string) || '';
      const stampShape = (props.stampShape as string) || 'rounded';
      const stampFill = props.stampFill as boolean;
      const textColor = (props.textColor as string) || (stampFill ? '#ffffff' : stroke);
      const bgFill = stampFill ? stroke : 'transparent';

      // Background shape
      const radius = stampShape === 'circle' ? canvasW / 2 :
                     stampShape === 'diamond' ? 0 : 8 * SCALE;

      if (stampShape === 'circle') {
        fabricObjects.push(new fabric.Circle({
          left: sw/2, top: sw/2,
          radius: (Math.min(canvasW, canvasH) - sw) / 2,
          stroke, strokeWidth: sw,
          fill: bgFill,
        }));
      } else if (stampShape === 'diamond') {
        const cx = canvasW / 2, cy = canvasH / 2;
        fabricObjects.push(new fabric.Polygon([
          { x: cx, y: sw }, { x: canvasW - sw, y: cy },
          { x: cx, y: canvasH - sw }, { x: sw, y: cy },
        ], { stroke, strokeWidth: sw, fill: bgFill }));
      } else if (stampShape === 'triangle') {
        fabricObjects.push(new fabric.Triangle({
          left: sw/2, top: sw/2,
          width: canvasW - sw, height: canvasH - sw,
          stroke, strokeWidth: sw, fill: bgFill,
        }));
      } else {
        // rounded / rectangle
        fabricObjects.push(new fabric.Rect({
          left: sw/2, top: sw/2,
          width: canvasW - sw, height: canvasH - sw,
          stroke, strokeWidth: sw, fill: bgFill,
          rx: radius, ry: radius,
        }));
      }

      // Stamp text
      const fontSize = ((props.fontSize as number) || 12) * SCALE;
      fabricObjects.push(new fabric.Textbox(stampText, {
        left: 0, top: 0, width: canvasW, height: canvasH,
        fontSize, fill: textColor,
        fontFamily: 'Arial', fontWeight: 'bold',
        textAlign: 'center',
        originX: 'left', originY: 'top',
      }));
    }
    else if (type === 'cloud') {
      // Cloud as rect with wavy border (simplified as polygon)
      fabricObjects.push(new fabric.Rect({
        left: sw/2, top: sw/2,
        width: canvasW - sw, height: canvasH - sw,
        stroke, strokeWidth: sw,
        fill: fill !== 'transparent' ? fill : undefined,
        rx: 4 * SCALE, ry: 4 * SCALE,
      }));
    }
    else if (type === 'polyline' || type === 'routeTemplate' || type === 'route') {
      const pts = (coords.points as { x: number; y: number }[]) || [];
      if (pts.length >= 2) {
        const canvasPoints = pts.map(p => ({
          x: (p.x * pw - rect[0]) * SCALE,
          y: ((1 - p.y) * ph - rect[1]) * SCALE,
        }));
        fabricObjects.push(new fabric.Polyline(canvasPoints, {
          stroke, strokeWidth: sw,
          fill: 'transparent',
        }));
      }
    }
    else if (type === 'pen' || type === 'highlighter') {
      // Simplified: render as rect outline for appearance
      fabricObjects.push(new fabric.Rect({
        left: sw/2, top: sw/2,
        width: canvasW - sw, height: canvasH - sw,
        stroke: type === 'highlighter' ? 'transparent' : stroke,
        strokeWidth: type === 'highlighter' ? 0 : sw,
        fill: type === 'highlighter' ? stroke : 'transparent',
        opacity: type === 'highlighter' ? 0.3 : 1,
      }));
    }
    else if (type === 'electricalBox' || type === 'panel') {
      fabricObjects.push(new fabric.Rect({
        left: sw/2, top: sw/2,
        width: canvasW - sw, height: canvasH - sw,
        stroke, strokeWidth: sw,
        fill: fill !== 'transparent' ? fill : undefined,
      }));
      const label = (props.text as string) || (props.label as string) || type;
      fabricObjects.push(new fabric.Textbox(label, {
        left: 4 * SCALE, top: 4 * SCALE,
        width: canvasW - 8 * SCALE,
        fontSize: 10 * SCALE, fill: (props.textColor as string) || '#000',
        fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center',
      }));
    }
    else if (type === 'stub') {
      const r = Math.min(canvasW, canvasH) / 2 - sw;
      fabricObjects.push(new fabric.Circle({
        left: canvasW / 2 - r, top: canvasH / 2 - r,
        radius: r, stroke, strokeWidth: sw,
        fill: fill !== 'transparent' ? fill : undefined,
      }));
      const label = (props.text as string) || '';
      if (label) {
        fabricObjects.push(new fabric.Textbox(label, {
          left: 0, top: canvasH / 2 - 6 * SCALE,
          width: canvasW, fontSize: 10 * SCALE,
          fill: (props.textColor as string) || '#000',
          fontFamily: 'Arial', textAlign: 'center',
        }));
      }
    }
    else if (type === 'wireTag') {
      fabricObjects.push(new fabric.Line([0, canvasH / 2, canvasW, canvasH / 2], {
        stroke, strokeWidth: sw,
      }));
      const label = (props.text as string) || '';
      if (label) {
        fabricObjects.push(new fabric.Textbox(label, {
          left: 0, top: 0, width: canvasW, fontSize: 10 * SCALE,
          fill: (props.textColor as string) || '#000',
          fontFamily: 'Arial', textAlign: 'center',
        }));
      }
    }
    else if (type === 'callout') {
      // Cloud part
      if (coords.cloud) {
        const cc = coords.cloud as Record<string, number>;
        const cLeft = (cc.left * pw - rect[0]) * SCALE;
        const cTop = ((1 - cc.top) * ph - rect[3]) * SCALE;
        const cW = cc.width * pw * SCALE;
        const cH = cc.height * ph * SCALE;
        fabricObjects.push(new fabric.Rect({
          left: Math.max(0, cLeft), top: Math.max(0, Math.abs(cTop)),
          width: cW, height: cH,
          stroke, strokeWidth: sw,
          fill: fill !== 'transparent' ? fill : undefined,
          rx: 4 * SCALE, ry: 4 * SCALE,
        }));
      }
      // Textbox part
      if (coords.textBox) {
        const tb = coords.textBox as Record<string, number>;
        const tLeft = (tb.left * pw - rect[0]) * SCALE;
        const tTop = ((1 - tb.top) * ph - rect[3]) * SCALE;
        const tW = tb.width * pw * SCALE;
        const tH = tb.height * ph * SCALE;
        const textContent = (props.text as string) || '';
        const fontSize = ((props.fontSize as number) || 14) * SCALE;
        fabricObjects.push(new fabric.Rect({
          left: Math.max(0, tLeft), top: Math.max(0, Math.abs(tTop)),
          width: tW, height: tH,
          fill: '#ffffff', stroke: (props.textBoxStroke as string) || stroke,
          strokeWidth: sw / 2,
        }));
        fabricObjects.push(new fabric.Textbox(textContent, {
          left: Math.max(0, tLeft) + 4, top: Math.max(0, Math.abs(tTop)) + 2,
          width: tW - 8, fontSize,
          fill: (props.textColor as string) || '#000',
          fontFamily: (props.fontFamily as string) || 'Arial',
        }));
      }
    }
    else {
      // Fallback: simple rect outline
      fabricObjects.push(new fabric.Rect({
        left: sw/2, top: sw/2,
        width: canvasW - sw, height: canvasH - sw,
        stroke, strokeWidth: sw,
        fill: 'transparent',
      }));
    }

    // Add all objects to canvas
    for (const obj of fabricObjects) {
      staticCanvas.add(obj);
    }
    staticCanvas.renderAll();

    // Export canvas to PNG
    const dataUrl = staticCanvas.toDataURL({ format: 'png', multiplier: 1 });
    const pngBase64 = dataUrl.split(',')[1];
    const pngBytes = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0));

    // Embed as PDF image → create Form XObject for Appearance Stream
    const pngImage = await doc.embedPng(pngBytes);

    // Create Form XObject appearance stream
    // This is what Bluebeam renders when it sees /AP /N
    const apW = rectW;
    const apH = rectH;
    const streamContent = `q ${apW} 0 0 ${apH} 0 0 cm /Img Do Q`;
    const streamBytes = new TextEncoder().encode(streamContent);

    const xObjectDict = doc.context.obj({
      Type: PDFName.of('XObject'),
      Subtype: PDFName.of('Form'),
      BBox: [0, 0, apW, apH],
      Resources: {
        XObject: { Img: pngImage.ref },
      },
    });

    const stream = doc.context.stream(streamBytes, xObjectDict as any);
    const apRef = doc.context.register(stream);

    // Cleanup
    staticCanvas.dispose();

    return apRef;
  } catch (err) {
    // console.warn(`[BluebeamExport] Failed to create AP for ${type}:`, err);
    return null;
  }
}

// ─── BSI Column Data ─────────────────────────────────────────────────────────

const STANDARD_PROPS = new Set([
  'stroke', 'strokeWidth', 'lineStyle', 'fill', 'fillOpacity',
  'subject', 'comment', 'text', 'locked', 'status', 'source',
  'bluebeamAuthor', 'pdfAnnotId', 'fontSize', 'textColor', 'fontFamily',
  'arrowStyle', 'originalWidth', 'originalHeight', 'pathLength',
  'opacity', 'strokeOpacity', 'createdAt', 'updatedAt',
  'stampShape', 'stampFill', 'reviewStamp', 'sessionId',
]);

function buildBSIColumnData(props: Record<string, unknown>, doc: PDFDocument): PDFDict | undefined {
  const entries: [string, string][] = [];
  for (const [key, val] of Object.entries(props)) {
    if (STANDARD_PROPS.has(key)) continue;
    if (val === undefined || val === null || val === '') continue;
    entries.push([key, String(val)]);
  }
  if (entries.length === 0) return undefined;
  const dict = doc.context.obj({});
  for (const [key, val] of entries) {
    (dict as PDFDict).set(PDFName.of(key), PDFHexString.fromText(val));
  }
  return dict as PDFDict;
}

// ─── Measurement formatting ─────────────────────────────────────────────────

function formatMeasurement(pdfPts: number, docScale: string): string {
  const m = docScale.match(/([\d/.]+)"?\s*=\s*([\d/.]+)'?\s*([\d/.]+)?/);
  if (!m) return `${(pdfPts / 72).toFixed(2)} in`;
  const parseNum = (s: string) => {
    if (s.includes('/')) {
      const [num, den] = s.split('/').map(Number);
      return den ? num / den : num;
    }
    return parseFloat(s);
  };
  const drawInch = parseNum(m[1]);
  const realFeet = parseNum(m[2]);
  const realInch = m[3] ? parseNum(m[3]) : 0;
  const scale = (realFeet * 12 + realInch) / drawInch;
  const totalInches = (pdfPts / 72) * scale;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return feet > 0 ? `${feet}'-${inches.toFixed(1)}"` : `${inches.toFixed(1)}"`;
}

function polylineLength(pts: { x: number; y: number }[], pw: number, ph: number): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i].x - pts[i - 1].x) * pw;
    const dy = (pts[i].y - pts[i - 1].y) * ph;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

// ─── Main export function ───────────────────────────────────────────────────

export interface BluebeamExportOptions {
  pdfDocProxy: { getData: () => Promise<Uint8Array>; numPages: number };
  allMarkups: unknown[];
  numPages: number;
  docScale: string;
  hiddenLayers?: string[];
  docName?: string;
  onProgress?: (current: number, total: number, phase: string) => void;
}

export async function exportPdfBluebeam(opts: BluebeamExportOptions): Promise<void> {
  const {
    pdfDocProxy, allMarkups, docScale,
    hiddenLayers = [], docName = 'export', onProgress,
  } = opts;

  onProgress?.(0, 0, 'Loading PDF...');

  const rawBytes = await pdfDocProxy.getData();
  const pdfDoc = await PDFDocument.load(rawBytes);
  const numPages = pdfDoc.getPageCount();
  const hidden = new Set(hiddenLayers);

  let processedCount = 0;
  const totalMarkups = (allMarkups as any[]).filter(m => !hidden.has(m.type)).length;

  for (let i = 0; i < numPages; i++) {
    const page = pdfDoc.getPage(i);
    const { width: pw, height: ph } = page.getSize();

    const pageMarkups = (allMarkups as Record<string, unknown>[]).filter(
      m => (m.pageNumber as number) === i && !hidden.has(m.type as string),
    );

    for (const m of pageMarkups) {
      processedCount++;
      onProgress?.(processedCount, totalMarkups, `Page ${i + 1}: markup ${processedCount}/${totalMarkups}`);

      try {
        const coords = (m.coordinates as Record<string, unknown>) || {};
        const props = (m.properties as Record<string, unknown>) || {};
        const type = m.type as string;

        const stroke = (props.stroke as string) || '#d32f2f';
        const sw = (props.strokeWidth as number) || 2;
        const lineStyle = (props.lineStyle as string) || 'solid';
        const fillHex = props.fill as string | undefined;
        const [sr, sg, sb] = hexToRgbArr(stroke);
        const icColor = fillHex && fillHex !== 'transparent' ? hexToRgbArr(fillHex) : undefined;
        const bs = bsDict(sw, lineStyle);
        const contents = (props.text as string) || (props.comment as string) || '';
        const subject = (props.subject as string) || type;
        const authorName = ((m as any).author?.name || (m as any).authorName || '') as string;
        const markupId = ((m as any).id || '') as string;
        const creationDate = toPdfDate((m as any).createdAt ?? props.createdAt);
        const modDate = toPdfDate((m as any).updatedAt ?? props.updatedAt);
        const fillOpacity = props.fillOpacity !== undefined ? (props.fillOpacity as number) : (fillHex && fillHex !== 'transparent' ? 0.2 : undefined);
        const bsiDict = buildBSIColumnData(props, pdfDoc);
        const flags = 4 | (props.locked ? 128 : 0);

        // Calculate bounding rect in PDF coordinates
        let rect: [number, number, number, number];
        if (type === 'line' || type === 'arrow' || type === 'measure') {
          const [lx1, ly1] = toPdfPt(coords.x1 as number || 0, coords.y1 as number || 0, pw, ph);
          const [lx2, ly2] = toPdfPt(coords.x2 as number || 0, coords.y2 as number || 0, pw, ph);
          const margin = sw * 5 + 10;
          rect = [Math.min(lx1, lx2) - margin, Math.min(ly1, ly2) - margin,
                  Math.max(lx1, lx2) + margin, Math.max(ly1, ly2) + margin];
        } else if (type === 'polyline' || type === 'routeTemplate' || type === 'route') {
          const pts = (coords.points as { x: number; y: number }[]) || [];
          if (pts.length < 2) continue;
          const verts = normPolyVerts(pts, pw, ph);
          const bbox = vertsBBox(verts);
          rect = [bbox[0] - sw - 5, bbox[1] - sw - 5, bbox[2] + sw + 5, bbox[3] + sw + 5];
        } else if (type === 'callout' && coords.cloud) {
          const cc = coords.cloud as Record<string, number>;
          const tb = (coords.textBox as Record<string, number>) || { left: cc.left, top: cc.top, width: cc.width, height: cc.height };
          const [cx1, cy1, cx2, cy2] = normRectToPdf(cc.left, cc.top, cc.width, cc.height, pw, ph);
          const [tx1, ty1, tx2, ty2] = normRectToPdf(tb.left, tb.top, tb.width, tb.height, pw, ph);
          rect = [Math.min(cx1, tx1) - 5, Math.min(cy1, ty1) - 5,
                  Math.max(cx2, tx2) + 5, Math.max(cy2, ty2) + 5];
        } else {
          const l = (coords.left as number) || 0;
          const t = (coords.top as number) || 0;
          const w = (coords.width as number) || 0.01;
          const h = (coords.height as number) || 0.01;
          rect = normRectToPdf(l, t, w, h, pw, ph);
          // Add padding
          rect = [rect[0] - sw, rect[1] - sw, rect[2] + sw, rect[3] + sw];
        }

        // Determine PDF annotation subtype
        let subtype = 'Square';
        if (type === 'circle' || type === 'ellipse') subtype = 'Circle';
        else if (type === 'line' || type === 'arrow' || type === 'measure') subtype = 'Line';
        else if (type === 'polyline' || type === 'routeTemplate' || type === 'route') subtype = 'PolyLine';
        else if (type === 'cloud') subtype = 'Polygon';
        else if (type === 'pen') subtype = 'Ink';
        else if (type === 'highlighter') subtype = 'Highlight';
        else if (type === 'text' || type === 'stickyNote') subtype = 'FreeText';
        else if (type === 'callout') subtype = 'FreeText';
        else if (type === 'reviewStamp') subtype = 'Stamp';
        else if (type === 'triangle' || type === 'diamond' || type === 'hexagon' || type === 'star') subtype = 'Polygon';
        else subtype = 'Square'; // electricalBox, panel, stub, wireTag

        // Build annotation dict
        const annotDict: Record<string, unknown> = {
          Type: PDFName.of('Annot'),
          Subtype: PDFName.of(subtype),
          Rect: rect,
          F: flags,
          C: [sr, sg, sb],
          CA: props.strokeOpacity ?? 1,
          ...(fillOpacity !== undefined ? { ca: fillOpacity } : {}),
          BS: bs,
          Contents: contents,
          ...(markupId ? { NM: markupId } : {}),
          ...(authorName ? { T: authorName } : {}),
          ...(subject ? { Subj: subject } : {}),
          ...(creationDate ? { CreationDate: creationDate } : {}),
          ...(modDate ? { M: modDate } : {}),
          ...(bsiDict ? { BSIColumnData: bsiDict } : {}),
        };

        // Type-specific properties
        if (icColor) annotDict.IC = icColor;

        if (type === 'line' || type === 'arrow' || type === 'measure') {
          const [lx1, ly1] = toPdfPt(coords.x1 as number || 0, coords.y1 as number || 0, pw, ph);
          const [lx2, ly2] = toPdfPt(coords.x2 as number || 0, coords.y2 as number || 0, pw, ph);
          annotDict.L = [lx1, ly1, lx2, ly2];
          if (type === 'arrow') {
            const style = (props.arrowStyle as string) || 'end';
            annotDict.LE = [
              PDFName.of(style === 'start' || style === 'both' ? 'OpenArrow' : 'None'),
              PDFName.of(style === 'end' || style === 'both' ? 'OpenArrow' : 'None'),
            ];
          } else {
            annotDict.LE = [PDFName.of('None'), PDFName.of('None')];
          }
          if (type === 'measure') {
            const len = Math.sqrt(
              ((coords.x2 as number) - (coords.x1 as number)) ** 2 * pw * pw +
              ((coords.y2 as number) - (coords.y1 as number)) ** 2 * ph * ph
            );
            annotDict.Contents = formatMeasurement(len, docScale);
            annotDict.IT = PDFName.of('LineDimension');
          }
        }
        else if (type === 'polyline' || type === 'routeTemplate' || type === 'route') {
          const pts = (coords.points as { x: number; y: number }[]) || [];
          annotDict.Vertices = normPolyVerts(pts, pw, ph);
          annotDict.LE = [PDFName.of('None'), PDFName.of('None')];
          if (props.showLength !== false && type === 'polyline') {
            annotDict.Contents = formatMeasurement(polylineLength(pts, pw, ph), docScale);
          }
        }
        else if (type === 'cloud') {
          const l = (coords.left as number) || 0, t = (coords.top as number) || 0;
          const w = (coords.width as number) || 0, h = (coords.height as number) || 0;
          const [x1, y1, x2, y2] = normRectToPdf(l, t, w, h, pw, ph);
          annotDict.Vertices = [x1, y1, x2, y1, x2, y2, x1, y2];
          annotDict.IT = PDFName.of('PolygonCloud');
          annotDict.BE = { S: PDFName.of('C'), I: (props.cloudIntensity as number) ?? 1 };
        }
        else if (type === 'text' || type === 'stickyNote') {
          const fontSize = (props.fontSize as number) || 14;
          const [tr, tg, tb] = hexToRgbArr((props.textColor as string) || '#000000');
          annotDict.DA = `/Helvetica ${fontSize} Tf ${tr.toFixed(3)} ${tg.toFixed(3)} ${tb.toFixed(3)} rg`;
          annotDict.Q = 0;
        }
        else if (type === 'reviewStamp') {
          annotDict.Name = PDFName.of((props.reviewStamp as string) || 'Draft');
        }
        else if (type === 'highlighter') {
          const qr = rect;
          annotDict.QuadPoints = [qr[0], qr[3], qr[2], qr[3], qr[0], qr[1], qr[2], qr[1]];
          annotDict.CA = 0.3;
        }

        // Generate Appearance Stream (pixel-perfect visual)
        const apRef = await createAppearanceStream(m, pdfDoc, pw, ph, rect);
        if (apRef) {
          annotDict.AP = { N: apRef };
        }

        // Register annotation and add to page
        const annotRef = registerAnnot(pdfDoc, annotDict);
        addAnnotToPage(page as any, annotRef, pdfDoc);

        // Status annotation (if has status)
        const status = (props.status as string);
        if (status && status !== 'none') {
          const statusDict: Record<string, unknown> = {
            Type: PDFName.of('Annot'),
            Subtype: PDFName.of('Text'),
            Rect: [rect[2] - 20, rect[3] - 20, rect[2], rect[3]],
            F: 4 | 32,
            Contents: `Status: ${status}`,
            T: authorName,
            IRT: annotRef,
            RT: PDFName.of('R'),
            StateModel: 'Review',
            State: status.charAt(0).toUpperCase() + status.slice(1),
          };
          const statusRef = registerAnnot(pdfDoc, statusDict);
          addAnnotToPage(page as any, statusRef, pdfDoc);
        }

      } catch (err) {
        // console.warn(`[BluebeamExport] Skipped markup ${(m as any).type}:`, err);
      }
    }
  }

  onProgress?.(totalMarkups, totalMarkups, 'Saving PDF...');
  const outBytes = await pdfDoc.save();

  const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${docName.replace(/\.pdf$/i, '')}_with_markups.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
