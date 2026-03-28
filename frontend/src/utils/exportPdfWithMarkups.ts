/**
 * exportPdfWithMarkups.ts
 *
 * Creates a PDF with native interactive annotations (Bluebeam / Acrobat / Foxit compatible).
 * Every markup becomes a proper PDF annotation object — you can click it in Bluebeam,
 * inspect its properties, edit text, change colours, and delete it.
 *
 * Approach:
 *  1. Load the original PDF bytes via pdfDocProxy.getData() or a proxy URL fetch
 *  2. Open with pdf-lib (no pixel rendering needed)
 *  3. For each markup, create the matching PDF annotation dictionary and add it to the page
 *  4. Save → download
 */

import { PDFDocument, PDFName, PDFArray, PDFRef } from 'pdf-lib';
import { pdfjs } from 'react-pdf';

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/** Normalized (0-1) canvas point → PDF point (bottom-left origin) */
function toPdfPt(nx: number, ny: number, pw: number, ph: number): [number, number] {
  return [nx * pw, ph * (1 - ny)];
}

/** Normalized rect → PDF [llx, lly, urx, ury] */
function normRectToPdf(
  left: number, top: number, w: number, h: number,
  pw: number, ph: number,
): [number, number, number, number] {
  return [left * pw, ph * (1 - top - h), (left + w) * pw, ph * (1 - top)];
}

/** Bounding rect of a flat vertex array [x1 y1 x2 y2 …] */
function vertsBBox(verts: number[]): [number, number, number, number] {
  const xs = verts.filter((_, i) => i % 2 === 0);
  const ys = verts.filter((_, i) => i % 2 !== 0);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Rotate a canvas point around a canvas centre */
function rotateCanvasPt(px: number, py: number, cx: number, cy: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  return [
    cx + (px - cx) * Math.cos(r) - (py - cy) * Math.sin(r),
    cy + (px - cx) * Math.sin(r) + (py - cy) * Math.cos(r),
  ];
}

/** Rotated rect → flat Polygon vertices in PDF coords */
function rotatedRectVerts(
  left: number, top: number, w: number, h: number, deg: number,
  pw: number, ph: number,
): number[] {
  const x1 = left * pw, y1c = top * ph;
  const x2 = (left + w) * pw, y2c = (top + h) * ph;
  const cx = (x1 + x2) / 2, cy = (y1c + y2c) / 2;
  const corners: [number, number][] = [[x1, y1c], [x2, y1c], [x2, y2c], [x1, y2c]];
  return corners.flatMap(([px, py]) => {
    const [rx, ry] = rotateCanvasPt(px, py, cx, cy, deg);
    return [rx, ph - ry];
  });
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToRgbArr(hex: string): [number, number, number] {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return [0.8, 0, 0];
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

// ─── Border-style dict ────────────────────────────────────────────────────────

function bsDict(sw: number, lineStyle: string): Record<string, unknown> {
  const dashMap: Record<string, number[]> = {
    dashed: [12, 6],
    dotted: [2, 4],
    'dash-dot': [15, 6, 3, 6],
    'dash-dot-dot': [15, 6, 3, 6, 3, 6],
    'long-dash': [25, 8],
    'short-dash': [6, 4],
    'long-dash-dot': [25, 8, 3, 8],
  };
  const dash = dashMap[lineStyle];
  if (dash) return { W: sw, S: PDFName.of('D'), D: dash };
  return { W: sw, S: PDFName.of('S') };
}

// ─── Shape vertex helpers ─────────────────────────────────────────────────────

function normPolyVerts(pts: { x: number; y: number }[], pw: number, ph: number): number[] {
  return pts.flatMap(p => toPdfPt(p.x, p.y, pw, ph));
}

function triangleNorm(l: number, t: number, w: number, h: number) {
  return [{ x: l + w / 2, y: t }, { x: l + w, y: t + h }, { x: l, y: t + h }];
}
function diamondNorm(l: number, t: number, w: number, h: number) {
  return [{ x: l + w / 2, y: t }, { x: l + w, y: t + h / 2 }, { x: l + w / 2, y: t + h }, { x: l, y: t + h / 2 }];
}
function hexagonNorm(l: number, t: number, w: number, h: number) {
  const cx = l + w / 2, cy = t + h / 2, r = Math.min(w, h) / 2;
  return Array.from({ length: 6 }, (_, i) => ({
    x: cx + r * Math.cos(Math.PI / 6 + (i * Math.PI) / 3),
    y: cy + r * Math.sin(Math.PI / 6 + (i * Math.PI) / 3),
  }));
}
function starNorm(l: number, t: number, w: number, h: number) {
  const cx = l + w / 2, cy = t + h / 2, outer = Math.min(w, h) / 2, inner = outer * 0.4;
  return Array.from({ length: 10 }, (_, i) => {
    const ra = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return { x: cx + ra * Math.cos(a), y: cy + ra * Math.sin(a) };
  });
}

// ─── Measurement formatter ────────────────────────────────────────────────────

function formatMeasurement(pts: number, docScale: string): string {
  if (docScale === '1:1') return `${Math.round(pts)}px`;
  const inchesOnPaper = pts / 72;
  if (docScale.includes(':') && !docScale.includes('"')) {
    const ratio = parseFloat(docScale.split(':')[1]) || 1;
    const realMm = inchesOnPaper * 25.4 * ratio;
    if (realMm >= 1000) return `${(realMm / 1000).toFixed(2)}m`;
    if (realMm >= 10) return `${(realMm / 10).toFixed(1)}cm`;
    return `${Math.round(realMm)}mm`;
  }
  if (docScale.includes('=')) {
    const [paperPart, realPart] = docScale.split('=').map(s => s.trim());
    let paperInches = 1;
    const pp = paperPart.replace(/"/g, '');
    if (pp.includes('/')) {
      const fr = pp.split('/');
      paperInches = parseFloat(fr[0]) / parseFloat(fr[1]);
    } else paperInches = parseFloat(pp) || 1;
    let realInches = 0;
    const feetM = realPart.match(/(\d+)'/);
    const inchM = realPart.match(/(\d+)"/);
    if (feetM) realInches += parseInt(feetM[1]) * 12;
    if (inchM) realInches += parseInt(inchM[1]);
    if (!feetM && !inchM && realPart.includes("'")) realInches = parseInt(realPart) * 12;
    const scaleFactor = realInches / paperInches;
    const total = Math.round((inchesOnPaper * scaleFactor) * 8) / 8;
    const feet = Math.floor(total / 12), inches = total % 12;
    return feet === 0 ? `${Math.floor(inches)}"` : `${feet}' ${Math.floor(inches)}"`;
  }
  return `${Math.round(pts)}pt`;
}

function polylineLength(pts: { x: number; y: number }[], pw: number, ph: number): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = toPdfPt(pts[i - 1].x, pts[i - 1].y, pw, ph);
    const [x2, y2] = toPdfPt(pts[i].x, pts[i].y, pw, ph);
    d += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }
  return d;
}

// ─── SVG path → InkList ───────────────────────────────────────────────────────

function parsePenToInkList(
  pathInput: string | unknown[][],
  coordsLeft: number, coordsTop: number,
  origW: number, origH: number,
  pw: number, ph: number,
): number[][] {
  const pathStr = Array.isArray(pathInput)
    ? (pathInput as unknown[][]).map(c => (c as unknown[]).join(' ')).join(' ')
    : pathInput as string;

  const result: number[][] = [];
  let current: number[] = [];

  const pushPt = (ax: number, ay: number) => {
    const nx = ax / origW + coordsLeft;
    const ny = ay / origH + coordsTop;
    const [px, py] = toPdfPt(nx, ny, pw, ph);
    current.push(px, py);
  };

  const re = /([MLQCZz])([^MLQCZz]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pathStr)) !== null) {
    const cmd = m[1];
    const args = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === 'M') {
      if (current.length >= 4) result.push(current);
      current = [];
      for (let i = 0; i + 1 < args.length; i += 2) pushPt(args[i], args[i + 1]);
    } else if (cmd === 'L') {
      for (let i = 0; i + 1 < args.length; i += 2) pushPt(args[i], args[i + 1]);
    } else if (cmd === 'Q') {
      for (let i = 0; i + 3 < args.length; i += 4) pushPt(args[i + 2], args[i + 3]);
    } else if (cmd === 'C') {
      for (let i = 0; i + 5 < args.length; i += 6) pushPt(args[i + 4], args[i + 5]);
    } else if (cmd === 'Z' || cmd === 'z') {
      if (current.length >= 4) result.push(current);
      current = [];
    }
  }
  if (current.length >= 4) result.push(current);
  return result;
}

// ─── Annotation registration helpers ─────────────────────────────────────────

function registerAnnot(doc: PDFDocument, dict: Record<string, unknown>): PDFRef {
  return doc.context.register(doc.context.obj(dict));
}

function addAnnotToPage(page: { node: { lookupMaybe: (...a: unknown[]) => unknown; set: (...a: unknown[]) => void } }, ref: PDFRef, doc: PDFDocument) {
  const key = PDFName.of('Annots');
  const existing = page.node.lookupMaybe(key, PDFArray) as PDFArray | undefined;
  if (existing) {
    existing.push(ref);
  } else {
    page.node.set(key, doc.context.obj([ref]));
  }
}

// ─── Per-markup annotation creator ───────────────────────────────────────────

function addMarkupAnnotation(
  m: Record<string, unknown>,
  page: { node: { lookupMaybe: (...a: unknown[]) => unknown; set: (...a: unknown[]) => void } },
  doc: PDFDocument,
  pw: number,
  ph: number,
  docScale: string,
): void {
  const coords = (m.coordinates as Record<string, unknown>) || {};
  const props = (m.properties as Record<string, unknown>) || {};

  const stroke = (props.stroke as string) || '#d32f2f';
  const sw = (props.strokeWidth as number) || 2;
  const lineStyle = (props.lineStyle as string) || 'solid';
  const fillHex = props.fill as string | undefined;
  const fillOpacity = props.fillOpacity !== undefined ? (props.fillOpacity as number) : 0.2;
  const angle = (coords.angle as number) || 0;

  const [sr, sg, sb] = hexToRgbArr(stroke);
  const icColor = fillHex && fillHex !== 'transparent' ? hexToRgbArr(fillHex) : undefined;
  const bs = bsDict(sw, lineStyle);
  // For shapes: comment is the annotation note; for text boxes: text is the visible content.
  // Bluebeam reads /Contents as the popup note; for FreeText it's also the displayed text.
  const contents = (props.text as string) || (props.comment as string) || '';
  const subject = (props.subject as string) || undefined;
  const authorName = ((m as any).author?.name || (m as any).authorName || '') as string;
  const markupId = ((m as any).id || '') as string;

  // Common base dict fields (NM = unique name for Bluebeam tracking, T = author, Subj = category)
  const base = (subtype: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of(subtype),
    F: 4,
    C: [sr, sg, sb],
    CA: 1,
    BS: bs,
    Contents: contents,
    ...(markupId ? { NM: markupId } : {}),
    ...(authorName ? { T: authorName } : {}),
    ...(subject ? { Subj: subject } : {}),
    ...extra,
  });

  const addPolygon = (
    pts: { x: number; y: number }[],
    cloud = false,
  ) => {
    const verts = normPolyVerts(pts, pw, ph);
    const bbox = vertsBBox(verts);
    const d: Record<string, unknown> = {
      ...base('Polygon'),
      Rect: bbox,
      Vertices: verts,
    };
    if (icColor) d.IC = icColor;
    if (cloud) {
      d.IT = PDFName.of('PolygonCloud');
      d.BE = { S: PDFName.of('C'), I: 1 };
    }
    addAnnotToPage(page, registerAnnot(doc, d), doc);
  };

  const type = m.type as string;

  // ── Highlighter ─────────────────────────────────────────────────────────────
  if (type === 'highlighter') {
    if (coords.width !== undefined && coords.height !== undefined) {
      const [x1, y1, x2, y2] = normRectToPdf(
        coords.left as number, coords.top as number,
        coords.width as number, coords.height as number, pw, ph,
      );
      // QuadPoints order for PDF: TL TR BL BR (in PDF bottom-left coords: top = higher Y)
      const qp = [x1, y2, x2, y2, x1, y1, x2, y1];
      addAnnotToPage(page, registerAnnot(doc, {
        ...base('Highlight'),
        Rect: [x1, y1, x2, y2],
        QuadPoints: qp,
        CA: 0.5,
      }), doc);
    } else if (coords.path) {
      const origW = (props.originalWidth as number) || pw;
      const origH = (props.originalHeight as number) || ph;
      const inkList = parsePenToInkList(
        coords.path as string | unknown[][],
        (coords.left as number) || 0, (coords.top as number) || 0,
        origW, origH, pw, ph,
      );
      if (inkList.length > 0) {
        const flat = inkList.flat();
        const bbox = vertsBBox(flat);
        addAnnotToPage(page, registerAnnot(doc, {
          ...base('Ink'),
          Rect: [bbox[0] - 2, bbox[1] - 2, bbox[2] + 2, bbox[3] + 2],
          InkList: inkList,
          CA: 0.5,
          BS: { W: (props.strokeWidth as number) || 12, S: PDFName.of('S') },
        }), doc);
      }
    }
    return;
  }

  // ── Rect / simple callout ───────────────────────────────────────────────────
  if (type === 'rect' || (type === 'callout' && !coords.cloud)) {
    const l = coords.left as number, t = coords.top as number;
    const w = coords.width as number, h = coords.height as number;
    if (angle !== 0) {
      const verts = rotatedRectVerts(l, t, w, h, angle, pw, ph);
      const bbox = vertsBBox(verts);
      const d: Record<string, unknown> = { ...base('Polygon'), Rect: bbox, Vertices: verts };
      if (icColor) d.IC = icColor;
      addAnnotToPage(page, registerAnnot(doc, d), doc);
    } else {
      const [x1, y1, x2, y2] = normRectToPdf(l, t, w, h, pw, ph);
      const d: Record<string, unknown> = { ...base('Square'), Rect: [x1, y1, x2, y2] };
      if (icColor) d.IC = icColor;
      addAnnotToPage(page, registerAnnot(doc, d), doc);
    }
    return;
  }

  // ── Cloud callout ───────────────────────────────────────────────────────────
  if (type === 'callout' && coords.cloud) {
    const cc = coords.cloud as Record<string, number>;
    const [cx1, cy1, cx2, cy2] = normRectToPdf(cc.left, cc.top, cc.width, cc.height, pw, ph);
    const cloudVerts = [cx1, cy1, cx2, cy1, cx2, cy2, cx1, cy2];
    const cloudD: Record<string, unknown> = {
      ...base('Polygon'),
      Rect: [cx1, cy1, cx2, cy2],
      Vertices: cloudVerts,
      IT: PDFName.of('PolygonCloud'),
      BE: { S: PDFName.of('C'), I: 1 },
    };
    if (icColor) cloudD.IC = icColor;
    addAnnotToPage(page, registerAnnot(doc, cloudD), doc);

    if (coords.textBox) {
      const tb = coords.textBox as Record<string, number>;
      const [tx1, ty1, tx2, ty2] = normRectToPdf(tb.left, tb.top, tb.width, tb.height, pw, ph);
      const tbCx = (tx1 + tx2) / 2, tbCy = (ty1 + ty2) / 2;
      const clCx = (cx1 + cx2) / 2, clCy = (cy1 + cy2) / 2;
      const fontSize = (props.fontSize as number) || 14;
      addAnnotToPage(page, registerAnnot(doc, {
        ...base('FreeText'),
        Rect: [tx1, ty1, tx2, ty2],
        Contents: contents,
        DA: `/Helvetica ${fontSize} Tf 0 0 0 rg`,
        IT: PDFName.of('FreeTextCallout'),
        CL: [tbCx, tbCy, clCx, clCy],
        BS: { W: sw, S: PDFName.of('S') },
      }), doc);
    }
    return;
  }

  // ── Circle / Ellipse ─────────────────────────────────────────────────────────
  if (type === 'circle' || type === 'ellipse') {
    const [x1, y1, x2, y2] = normRectToPdf(
      coords.left as number, coords.top as number,
      coords.width as number, coords.height as number, pw, ph,
    );
    const d: Record<string, unknown> = { ...base('Circle'), Rect: [x1, y1, x2, y2] };
    if (icColor) d.IC = icColor;
    addAnnotToPage(page, registerAnnot(doc, d), doc);
    return;
  }

  // ── Polygon shapes ──────────────────────────────────────────────────────────
  const l = coords.left as number, t = coords.top as number;
  const w = coords.width as number, h = coords.height as number;

  if (type === 'triangle') { addPolygon(triangleNorm(l, t, w, h)); return; }
  if (type === 'diamond')  { addPolygon(diamondNorm(l, t, w, h));  return; }
  if (type === 'hexagon')  { addPolygon(hexagonNorm(l, t, w, h));  return; }
  if (type === 'star')     { addPolygon(starNorm(l, t, w, h));     return; }

  // ── Cloud rectangle ─────────────────────────────────────────────────────────
  if (type === 'cloud') {
    const [x1, y1, x2, y2] = normRectToPdf(l, t, w, h, pw, ph);
    const verts = [x1, y1, x2, y1, x2, y2, x1, y2];
    const d: Record<string, unknown> = {
      ...base('Polygon'),
      Rect: [x1, y1, x2, y2],
      Vertices: verts,
      IT: PDFName.of('PolygonCloud'),
      BE: { S: PDFName.of('C'), I: 1 },
    };
    if (icColor) d.IC = icColor;
    addAnnotToPage(page, registerAnnot(doc, d), doc);
    return;
  }

  // ── Line ────────────────────────────────────────────────────────────────────
  if (type === 'line') {
    const [lx1, ly1] = toPdfPt(coords.x1 as number, coords.y1 as number, pw, ph);
    const [lx2, ly2] = toPdfPt(coords.x2 as number, coords.y2 as number, pw, ph);
    const margin = sw + 2;
    addAnnotToPage(page, registerAnnot(doc, {
      ...base('Line'),
      Rect: [Math.min(lx1, lx2) - margin, Math.min(ly1, ly2) - margin,
             Math.max(lx1, lx2) + margin, Math.max(ly1, ly2) + margin],
      L: [lx1, ly1, lx2, ly2],
      LE: [PDFName.of('None'), PDFName.of('None')],
    }), doc);
    return;
  }

  // ── Measure ─────────────────────────────────────────────────────────────────
  if (type === 'measure') {
    const [lx1, ly1] = toPdfPt(coords.x1 as number, coords.y1 as number, pw, ph);
    const [lx2, ly2] = toPdfPt(coords.x2 as number, coords.y2 as number, pw, ph);
    const len = Math.sqrt((lx2 - lx1) ** 2 + (ly2 - ly1) ** 2);
    const margin = sw + 2;
    addAnnotToPage(page, registerAnnot(doc, {
      ...base('Line'),
      Rect: [Math.min(lx1, lx2) - margin, Math.min(ly1, ly2) - margin,
             Math.max(lx1, lx2) + margin, Math.max(ly1, ly2) + margin],
      L: [lx1, ly1, lx2, ly2],
      LE: [PDFName.of('None'), PDFName.of('None')],
      Contents: formatMeasurement(len, docScale),
      IT: PDFName.of('LineDimension'),
    }), doc);
    return;
  }

  // ── Arrow ───────────────────────────────────────────────────────────────────
  if (type === 'arrow') {
    const [lx1, ly1] = toPdfPt(coords.x1 as number, coords.y1 as number, pw, ph);
    const [lx2, ly2] = toPdfPt(coords.x2 as number, coords.y2 as number, pw, ph);
    const arrowStyle = (props.arrowStyle as string) || 'end';
    const leStart = (arrowStyle === 'start' || arrowStyle === 'both') ? PDFName.of('OpenArrow') : PDFName.of('None');
    const leEnd   = (arrowStyle === 'end'   || arrowStyle === 'both') ? PDFName.of('OpenArrow') : PDFName.of('None');
    const margin = sw * 5 + 4;
    addAnnotToPage(page, registerAnnot(doc, {
      ...base('Line'),
      Rect: [Math.min(lx1, lx2) - margin, Math.min(ly1, ly2) - margin,
             Math.max(lx1, lx2) + margin, Math.max(ly1, ly2) + margin],
      L: [lx1, ly1, lx2, ly2],
      LE: [leStart, leEnd],
      IT: PDFName.of('LineArrow'),
    }), doc);
    return;
  }

  // ── Polyline ─────────────────────────────────────────────────────────────────
  if (type === 'polyline') {
    const pts = (coords.points as { x: number; y: number }[]) || [];
    if (pts.length >= 2) {
      const verts = normPolyVerts(pts, pw, ph);
      const bbox = vertsBBox(verts);
      const lenStr = props.showLength !== false
        ? formatMeasurement(polylineLength(pts, pw, ph), docScale) : '';
      addAnnotToPage(page, registerAnnot(doc, {
        ...base('PolyLine'),
        Rect: [bbox[0] - sw, bbox[1] - sw, bbox[2] + sw, bbox[3] + sw],
        Vertices: verts,
        LE: [PDFName.of('None'), PDFName.of('None')],
        Contents: lenStr,
      }), doc);
    }
    return;
  }

  // ── Pen (freehand ink) ───────────────────────────────────────────────────────
  if (type === 'pen' && coords.path) {
    const origW = (props.originalWidth as number) || pw;
    const origH = (props.originalHeight as number) || ph;
    const inkList = parsePenToInkList(
      coords.path as string | unknown[][],
      (coords.left as number) || 0, (coords.top as number) || 0,
      origW, origH, pw, ph,
    );
    if (inkList.length > 0) {
      const flat = inkList.flat();
      const bbox = vertsBBox(flat);
      addAnnotToPage(page, registerAnnot(doc, {
        ...base('Ink'),
        Rect: [bbox[0] - sw, bbox[1] - sw, bbox[2] + sw, bbox[3] + sw],
        InkList: inkList,
      }), doc);
    }
    return;
  }

  // ── Text (FreeText) ──────────────────────────────────────────────────────────
  if (type === 'text') {
    const textW = (coords.width as number) || 0.2;
    const textH = (coords.height as number) || 0.1;
    const [x1, y1, x2, y2] = normRectToPdf(coords.left as number, coords.top as number, textW, textH, pw, ph);
    const fontSize = (props.fontSize as number) || 14;
    const [tr, tg, tb] = hexToRgbArr((props.textColor as string) || '#000000');
    // Preserve original font name for round-trip accuracy; fall back to Helvetica
    const fontName = (props.fontFamily as string) || 'Helvetica';
    const da = `/${fontName} ${fontSize} Tf ${tr.toFixed(3)} ${tg.toFixed(3)} ${tb.toFixed(3)} rg`;
    const textContent = (props.text as string) || contents || 'Text';
    const d: Record<string, unknown> = {
      ...base('FreeText'),
      Rect: [x1, y1, x2, y2],
      Contents: textContent,
      DA: da,
      Q: 0,
      BS: { W: (props.strokeWidth as number) > 0 ? sw : 0, S: PDFName.of('S') },
    };
    if (icColor) d.IC = icColor;
    addAnnotToPage(page, registerAnnot(doc, d), doc);
    return;
  }
}

// ─── Core: add annotations to an already-loaded PDFDocument ──────────────────

async function annotateDoc(
  pdfDoc: PDFDocument,
  allMarkups: unknown[],
  docScale: string,
  hiddenLayers: string[],
  onProgress?: (cur: number, total: number) => void,
): Promise<void> {
  const numPages = pdfDoc.getPageCount();
  const hidden = new Set(hiddenLayers);

  for (let i = 0; i < numPages; i++) {
    onProgress?.(i, numPages);
    const page = pdfDoc.getPage(i);
    const { width: pw, height: ph } = page.getMediaBox();

    const pageMarkups = (allMarkups as Record<string, unknown>[]).filter(
      m => (m.pageNumber as number) === i && !hidden.has(m.type as string),
    );
    for (const m of pageMarkups) {
      try {
        addMarkupAnnotation(m, page as unknown as Parameters<typeof addMarkupAnnotation>[1], pdfDoc, pw, ph, docScale);
      } catch (e) {
        console.warn('Skipped markup annotation:', m.type, e);
      }
    }
  }
  onProgress?.(numPages, numPages);
}

// ─── Public: export from DocumentViewPage (has pdfDocProxy) ──────────────────

export interface ExportOptions {
  /** PDFDocumentProxy from pdfjs — we call .getData() to get raw bytes */
  pdfDocProxy: { getData: () => Promise<Uint8Array>; numPages: number };
  allMarkups: unknown[];
  numPages: number;
  docScale: string;
  hiddenLayers?: string[];
  docName?: string;
  onProgress?: (current: number, total: number) => void;
}

export async function exportPdfWithMarkups(opts: ExportOptions): Promise<void> {
  const { pdfDocProxy, allMarkups, docScale, hiddenLayers = [], docName = 'export', onProgress } = opts;

  const rawBytes = await pdfDocProxy.getData();
  const pdfDoc = await PDFDocument.load(rawBytes);

  await annotateDoc(pdfDoc, allMarkups, docScale, hiddenLayers, onProgress);

  const outBytes = await pdfDoc.save();
  triggerDownload(outBytes, `${docName.replace(/\.pdf$/i, '')}_with_markups.pdf`);
}

// ─── Public: standalone export from file manager ─────────────────────────────

export interface StandaloneExportOptions {
  documentId: string;
  docName: string;
  authToken: string;
  apiBase?: string;
  docScale?: string;
  hiddenLayers?: string[];
  onProgress?: (current: number, total: number) => void;
}

export async function exportDocumentWithMarkups(opts: StandaloneExportOptions): Promise<void> {
  const {
    documentId, docName, authToken,
    apiBase = '',
    docScale = '1:1',
    hiddenLayers = [],
    onProgress,
  } = opts;

  const headers = { Authorization: `Bearer ${authToken}` };

  const [pdfRes, markupsRes] = await Promise.all([
    fetch(`${apiBase}/api/documents/${documentId}/proxy`, { headers }),
    fetch(`${apiBase}/api/markups/document/${documentId}`, { headers }),
  ]);

  if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`);
  const rawBytes = new Uint8Array(await pdfRes.arrayBuffer());
  const markupsJson = await markupsRes.json();
  const allMarkups: unknown[] = markupsJson?.data ?? [];

  const pdfDoc = await PDFDocument.load(rawBytes);
  await annotateDoc(pdfDoc, allMarkups, docScale, hiddenLayers, onProgress);

  const outBytes = await pdfDoc.save();
  triggerDownload(outBytes, `${docName.replace(/\.pdf$/i, '')}_with_markups.pdf`);
}

// ─── Download helper ──────────────────────────────────────────────────────────

function triggerDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
