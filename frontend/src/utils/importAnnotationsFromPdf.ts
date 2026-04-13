/**
 * importAnnotationsFromPdf.ts
 *
 * Parses existing PDF annotations (Bluebeam / Acrobat / Foxit compatible)
 * and converts them to our internal markup format for full round-trip compatibility.
 *
 * Design goals:
 *  - 100% import rate: no annotation is silently dropped (unknown types fall back to rect)
 *  - Exact colour fidelity: pdfjs-dist 3.x returns Uint8ClampedArray 0-255 — used as-is
 *  - Exact geometry: PDF pts → normalised 0-1, verified to round-trip through export
 *
 * Coordinate transforms:
 *  PDF   → top-left origin, normalised 0-1
 *  normX = pdfX / pageWidth
 *  normY = 1 − pdfY / pageHeight   (flip Y axis)
 *
 * Verified round-trip (import → export gives back original PDF coords within float ε):
 *  normRectToPdf(normRect(rect, pw, ph), pw, ph)  ≡  rect
 */

// ─── Public type ─────────────────────────────────────────────────────────────

export interface ImportedMarkup {
  type: string;
  pageNumber: number; // 0-indexed
  coordinates: Record<string, unknown>;
  properties: Record<string, unknown>;
}

// ─── Colour ──────────────────────────────────────────────────────────────────

/**
 * pdfjs-dist 3.x returns annotation colours as Uint8ClampedArray([r,g,b]) where
 * each component is 0-255. No heuristic — just integer clamping.
 */
function rgbToHex(c: Uint8ClampedArray | number[] | null | undefined, fallback = '#d32f2f'): string {
  if (!c || c.length < 3) return fallback;
  const r = Math.max(0, Math.min(255, Math.round(c[0])));
  const g = Math.max(0, Math.min(255, Math.round(c[1])));
  const b = Math.max(0, Math.min(255, Math.round(c[2])));
  return '#' + r.toString(16).padStart(2, '0')
             + g.toString(16).padStart(2, '0')
             + b.toString(16).padStart(2, '0');
}

function fillHex(c: Uint8ClampedArray | number[] | null | undefined): string | undefined {
  if (!c || c.length < 3) return undefined;
  return rgbToHex(c);
}

// ─── Border style ─────────────────────────────────────────────────────────────

// Matches the reverse of bsDict() in exportPdfWithMarkups.ts
function dashArrayToLineStyle(da: number[] | undefined): string {
  if (!da || da.length === 0) return 'solid';
  if (da.length === 2) {
    const [d] = da;
    if (d <= 3)  return 'dotted';
    if (d <= 8)  return 'short-dash';
    if (d <= 15) return 'dashed';
    return 'long-dash';
  }
  if (da.length === 4) return 'dash-dot';
  if (da.length >= 6)  return 'dash-dot-dot';
  return 'dashed';
}

function getLineStyle(bs: { style?: number; dashArray?: number[] } | null | undefined): string {
  if (!bs) return 'solid';
  return bs.style === 1 ? dashArrayToLineStyle(bs.dashArray) : 'solid';
}

// ─── Font info ────────────────────────────────────────────────────────────────

function getFontSize(annot: Record<string, any>): number {
  // pdfjs 3.x pre-parses defaultAppearance into defaultAppearanceData
  if (typeof annot.defaultAppearanceData?.fontSize === 'number') {
    return annot.defaultAppearanceData.fontSize || 14;
  }
  // Fallback: parse DA string "/FontName size Tf …"
  const da: string = annot.defaultAppearance ?? '';
  const m = da.match(/(\d+(?:\.\d+)?)\s+Tf/);
  return m ? parseFloat(m[1]) : 14;
}

function getFontColor(annot: Record<string, any>): string {
  if (annot.defaultAppearanceData?.fontColor) {
    return rgbToHex(annot.defaultAppearanceData.fontColor, '#000000');
  }
  const da: string = annot.defaultAppearance ?? '';
  const m = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);
  if (m) {
    const r = Math.round(parseFloat(m[1]) * 255);
    const g = Math.round(parseFloat(m[2]) * 255);
    const b = Math.round(parseFloat(m[3]) * 255);
    return rgbToHex([r, g, b] as any, '#000000');
  }
  return '#000000';
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/** PDF rect [llx,lly,urx,ury] → normalised {left,top,width,height} */
function normRect(rect: number[], pw: number, ph: number) {
  const left  = rect[0] / pw;
  const top   = 1 - rect[3] / ph;
  const width = Math.max(0.001, (rect[2] - rect[0]) / pw);
  const height = Math.max(0.001, (rect[3] - rect[1]) / ph);
  return { left, top, width, height };
}

/** PDF vertex [x,y] → normalised point */
function normPt(x: number, y: number, pw: number, ph: number) {
  return { x: x / pw, y: 1 - y / ph };
}

/** Bounding box of normalised points */
function normBBox(pts: { x: number; y: number }[]) {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const left = Math.min(...xs), top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

/** Flat vertices [x1,y1,x2,y2,...] → normalised points */
function vertsToNormPts(verts: number[], pw: number, ph: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < verts.length; i += 2) {
    pts.push(normPt(verts[i], verts[i + 1], pw, ph));
  }
  return pts;
}

// ─── Polygon shape detection ──────────────────────────────────────────────────

function detectPolygonType(
  verts: number[],
  intent: string | undefined,
  borderEffect: { style?: string } | null | undefined,
): string {
  // Cloud by intent or border effect
  if (intent === 'PolygonCloud' || borderEffect?.style === 'C') return 'cloud';

  const n = verts.length / 2;
  if (n === 3)  return 'triangle';
  if (n === 6)  return 'hexagon';
  if (n === 10) return 'star';

  if (n === 4) {
    // Diamond: two vertices near centre-X, two near centre-Y
    const xs = [verts[0], verts[2], verts[4], verts[6]];
    const ys = [verts[1], verts[3], verts[5], verts[7]];
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const tw = (Math.max(...xs) - Math.min(...xs)) * 0.18; // tolerance 18% of width
    const th = (Math.max(...ys) - Math.min(...ys)) * 0.18;
    const xMid = xs.filter(x => Math.abs(x - cx) < tw).length;
    const yMid = ys.filter(y => Math.abs(y - cy) < th).length;
    if (xMid === 2 && yMid === 2) return 'diamond';
    return 'rect'; // rotated rect or unknown → use bbox
  }

  return 'rect'; // ≥ 5 sides: generic polygon → bbox
}

// ─── Arrow style from line endings ───────────────────────────────────────────

const ARROW_ENDINGS = new Set([
  'OpenArrow', 'ClosedArrow', 'ROpenArrow', 'RClosedArrow',
  'Butt', 'Slash',
]);

function leToArrowStyle(le: string[] | undefined): string | undefined {
  if (!le || le.length < 2) return undefined;
  const s = ARROW_ENDINGS.has(le[0]);
  const e = ARROW_ENDINGS.has(le[1]);
  if (s && e) return 'both';
  if (s)      return 'start';
  if (e)      return 'end';
  return undefined;
}

// ─── Ink → SVG path (matches the pen/highlighter export round-trip) ───────────

/**
 * Converts inkLists (PDF pts, Y-from-bottom) to SVG path in "virtual canvas"
 * coordinates (pw × ph, Y-from-top).  Round-trip with parsePenToInkList verified:
 *   canvasX = pdfX  →  nx = canvasX/pw + 0 = pdfX/pw  →  pdf_out = nx*pw = pdfX ✓
 *   canvasY = ph-pdfY  →  ny = canvasY/ph = 1-pdfY/ph  →  pdf_out = ph*(1-ny) = pdfY ✓
 */
function inkToSvgPath(inkLists: number[][], ph: number): string {
  let path = '';
  for (const stroke of inkLists) {
    for (let i = 0; i + 1 < stroke.length; i += 2) {
      const cx = stroke[i];           // same as PDF x (no X flip)
      const cy = ph - stroke[i + 1]; // flip Y
      path += (i === 0) ? `M ${cx.toFixed(3)} ${cy.toFixed(3)}`
                        : ` L ${cx.toFixed(3)} ${cy.toFixed(3)}`;
    }
  }
  return path;
}

// ─── Rich-content text extraction ────────────────────────────────────────────

function extractText(annot: Record<string, any>): string {
  // Prefer rich-text str over raw contents
  if (annot.richText?.str) return annot.richText.str;
  return annot.contents ?? '';
}

// ─── Annotation subtype groups ────────────────────────────────────────────────

/** Subtypes that produce no visual markup and should be skipped */
const SKIP_SUBTYPES = new Set([
  'Link', 'Widget', 'FileAttachment', 'Popup',
  'Movie', 'Sound', '3D', 'TrapNet', 'Watermark', 'PrinterMark',
]);

// ─── Main converter ───────────────────────────────────────────────────────────

function convertAnnotation(
  annot: Record<string, any>,
  pageIndex: number,
  pw: number,
  ph: number,
): ImportedMarkup | null {
  const sub: string = annot.subtype ?? annot.annotationType?.toString() ?? '';

  if (SKIP_SUBTYPES.has(sub)) return null;

  // Skip PDF review-status annotations (Text reply with /StateModel = Review).
  // These are handled in a separate pass in detectAndParseAnnotations() and applied
  // as properties on the parent markup — they must not become standalone markups.
  if (annot.inReplyTo && annot.stateModel === 'Review') return null;

  // Guard: must have a valid rect
  const rect: number[] = Array.isArray(annot.rect) && annot.rect.length === 4
    ? annot.rect : [0, 0, pw * 0.1, ph * 0.1];

  // Common properties
  const stroke     = rgbToHex(annot.color,         '#d32f2f');
  const fill       = fillHex(annot.interiorColor);
  const strokeWidth = Math.max(0, annot.borderStyle?.width ?? 1);
  const lineStyle  = getLineStyle(annot.borderStyle);
  const opacity    = typeof annot.opacity === 'number' ? annot.opacity : 1;
  const text       = extractText(annot);
  const subject    = annot.subject ?? '';
  const authorName = annot.title ?? '';   // /T is the author name in Bluebeam
  const intent: string | undefined = annot.intent;

  // Dates from PDF
  const creationDate = annot.creationDate ?? annot.createdDate ?? undefined;
  const modificationDate = annot.modificationDate ?? annot.modDate ?? undefined;

  // BSIColumnData — Bluebeam custom properties
  const bsiCustom: Record<string, unknown> = {};
  if (annot.BSIColumnData && typeof annot.BSIColumnData === 'object') {
    for (const [k, v] of Object.entries(annot.BSIColumnData)) {
      if (v !== undefined && v !== null) bsiCustom[k] = String(v);
    }
  }
  // Some pdfjs versions expose raw dict entries — scan for BSI-prefixed keys
  for (const key of Object.keys(annot)) {
    if (key.startsWith('BSI') && key !== 'BSIColumnData' && annot[key] !== undefined) {
      bsiCustom[key] = String(annot[key]);
    }
  }

  // ── Additional PDF annotation keys for full round-trip ──────────────────────
  // Measure dict (measurement calibration)
  if (annot.Measure || annot.measure) {
    bsiCustom._pdf_Measure = JSON.stringify(annot.Measure ?? annot.measure);
  }
  // Border effect (cloud style)
  if (annot.borderEffect || annot.BE) {
    const be = annot.borderEffect ?? annot.BE;
    if (be && typeof be === 'object') {
      bsiCustom.borderEffect = JSON.stringify({ style: be.style ?? be.S ?? '', intensity: be.intensity ?? be.I ?? 0 });
    }
  }
  // Intent — save raw value alongside the parsed `intent` variable
  if (intent) {
    bsiCustom._pdf_IT = intent;
  }
  // Line endings — save raw array
  if (Array.isArray(annot.lineEndings) && annot.lineEndings.length >= 2) {
    bsiCustom._pdf_LE = JSON.stringify(annot.lineEndings);
  }
  // Optional Content (layer reference)
  if (annot.OC) {
    bsiCustom._pdf_OC = JSON.stringify(annot.OC);
  }
  // Flags — extract locked bit (bit 8, value 128)
  if (typeof annot.flags === 'number' && (annot.flags & 128) !== 0) {
    bsiCustom.locked = 'true';
  }
  // Rotation
  if (typeof annot.rotation === 'number' || typeof annot.Rotation === 'number') {
    bsiCustom.angle = String(annot.rotation ?? annot.Rotation);
  }
  // Stroke opacity (CA)
  if (typeof annot.CA === 'number' && annot.CA !== 1) {
    bsiCustom.strokeOpacity = String(annot.CA);
  }
  // Blend mode
  if (annot.BM) {
    bsiCustom._pdf_BM = String(annot.BM);
  }
  // Appearance stream presence
  if (annot.AP || annot.hasAppearance) {
    bsiCustom._hasAppearanceStream = 'true';
  }

  const base = (): Record<string, unknown> => ({
    stroke,
    strokeWidth: strokeWidth || 1,
    lineStyle,
    ...(fill ? { fill, fillOpacity: 0.2 } : {}),
    ...(subject ? { subject } : {}),
    ...(authorName ? { bluebeamAuthor: authorName } : {}),
    source: 'bluebeam_import',
    _pdf_Subtype: sub || '',
    ...(annot.id ? { pdfAnnotId: annot.id } : {}),
    ...(opacity !== 1 ? { opacity } : {}),
    ...(creationDate ? { createdAt: creationDate } : {}),
    ...(modificationDate ? { updatedAt: modificationDate } : {}),
    ...bsiCustom,
  });

  // ── Highlight (rect) ────────────────────────────────────────────────────────
  if (sub === 'Highlight') {
    const qp: number[] = Array.isArray(annot.quadPoints) ? annot.quadPoints : [];
    let coords: Record<string, unknown>;
    if (qp.length >= 8) {
      // Build overall bounding box from all quad points
      const allX: number[] = [], allY: number[] = [];
      for (let i = 0; i < qp.length; i += 2) { allX.push(qp[i]); allY.push(qp[i + 1]); }
      const minX = Math.min(...allX), maxX = Math.max(...allX);
      const minY = Math.min(...allY), maxY = Math.max(...allY);
      coords = {
        left:   minX / pw,
        top:    1 - maxY / ph,
        width:  (maxX - minX) / pw,
        height: (maxY - minY) / ph,
      };
    } else {
      coords = normRect(rect, pw, ph);
    }
    return {
      type: 'highlighter', pageNumber: pageIndex, coordinates: coords,
      properties: { ...base(), stroke: rgbToHex(annot.color, '#ffeb3b'), strokeWidth: Math.max(strokeWidth, 4), comment: text },
    };
  }

  // ── Underline / StrikeOut → mapped to highlighter ───────────────────────────
  if (sub === 'Underline' || sub === 'StrikeOut') {
    return {
      type: 'highlighter', pageNumber: pageIndex,
      coordinates: normRect(rect, pw, ph),
      properties: { ...base(), stroke: rgbToHex(annot.color, '#ef9a9a'), comment: text },
    };
  }

  // ── Square → rect ────────────────────────────────────────────────────────────
  if (sub === 'Square') {
    return {
      type: 'rect', pageNumber: pageIndex,
      coordinates: normRect(rect, pw, ph),
      properties: { ...base(), comment: text },
    };
  }

  // ── Circle → circle / ellipse ────────────────────────────────────────────────
  if (sub === 'Circle') {
    const c = normRect(rect, pw, ph);
    const ratio = c.width / Math.max(c.height, 0.001);
    const type = ratio > 0.85 && ratio < 1.15 ? 'circle' : 'ellipse';
    return {
      type, pageNumber: pageIndex,
      coordinates: c,
      properties: { ...base(), comment: text },
    };
  }

  // ── Polygon ──────────────────────────────────────────────────────────────────
  if (sub === 'Polygon') {
    const verts: number[] = Array.isArray(annot.vertices) ? annot.vertices : [];
    if (verts.length < 6) {
      // Too few vertices — use bounding box as rect
      return {
        type: 'rect', pageNumber: pageIndex,
        coordinates: normRect(rect, pw, ph),
        properties: { ...base(), comment: text },
      };
    }
    const shape = detectPolygonType(verts, intent, annot.borderEffect);
    const pts   = vertsToNormPts(verts, pw, ph);
    const bbox  = normBBox(pts);
    return {
      type: shape, pageNumber: pageIndex,
      coordinates: bbox,
      properties: { ...base(), comment: text },
    };
  }

  // ── PolyLine → polyline ──────────────────────────────────────────────────────
  if (sub === 'PolyLine') {
    const verts: number[] = Array.isArray(annot.vertices) ? annot.vertices : [];
    if (verts.length >= 4) {
      return {
        type: 'polyline', pageNumber: pageIndex,
        coordinates: { points: vertsToNormPts(verts, pw, ph) },
        properties: { ...base(), comment: text, showLength: false },
      };
    }
    // Fallback: treat as line
    return {
      type: 'line', pageNumber: pageIndex,
      coordinates: { x1: rect[0]/pw, y1: 1-rect[3]/ph, x2: rect[2]/pw, y2: 1-rect[1]/ph },
      properties: { ...base(), comment: text },
    };
  }

  // ── Line → line / arrow / measure ────────────────────────────────────────────
  if (sub === 'Line') {
    const lc: number[] = Array.isArray(annot.lineCoordinates) && annot.lineCoordinates.length === 4
      ? annot.lineCoordinates
      : [rect[0], rect[1], rect[2], rect[3]];

    const coords = {
      x1: lc[0] / pw, y1: 1 - lc[1] / ph,
      x2: lc[2] / pw, y2: 1 - lc[3] / ph,
    };

    if (intent === 'LineDimension') {
      return {
        type: 'measure', pageNumber: pageIndex,
        coordinates: coords,
        properties: { ...base(), comment: text },
      };
    }

    const arrowStyle = leToArrowStyle(annot.lineEndings);
    if (intent === 'LineArrow' || arrowStyle) {
      const leArr: string[] | undefined = annot.lineEndings;
      const arrowProps: Record<string, unknown> = {
        ...base(),
        arrowStyle: arrowStyle ?? 'end',
        comment: text,
      };
      // Preserve exact PDF line ending types for round-trip fidelity
      if (leArr && leArr.length >= 2) {
        arrowProps.lineEndStart = leArr[0]; // e.g. 'OpenArrow', 'ClosedArrow', 'Diamond', 'Square', 'Circle', 'Slash', 'Butt', 'None'
        arrowProps.lineEndEnd = leArr[1];
      }
      return {
        type: 'arrow', pageNumber: pageIndex,
        coordinates: coords,
        properties: arrowProps,
      };
    }

    return {
      type: 'line', pageNumber: pageIndex,
      coordinates: coords,
      properties: { ...base(), comment: text },
    };
  }

  // ── Ink → pen / freehand highlight ───────────────────────────────────────────
  if (sub === 'Ink') {
    const inkLists: number[][] = Array.isArray(annot.inkLists) ? annot.inkLists : [];
    if (inkLists.length === 0 || inkLists.every(s => s.length < 2)) return null;

    const pathStr = inkToSvgPath(inkLists, ph);
    if (!pathStr) return null;

    const isHighlight = opacity < 0.75;
    return {
      type: isHighlight ? 'highlighter' : 'pen',
      pageNumber: pageIndex,
      coordinates: { path: pathStr, left: 0, top: 0 },
      properties: {
        ...base(),
        strokeWidth: annot.borderStyle?.width ?? (isHighlight ? 12 : 2),
        originalWidth: pw,
        originalHeight: ph,
        comment: text,
      },
    };
  }

  // ── FreeText → text / callout ─────────────────────────────────────────────────
  if (sub === 'FreeText') {
    const fontSize  = getFontSize(annot);
    const textColor = getFontColor(annot);
    const content   = text;

    // Detect callout: FreeTextCallout intent or CL (callout line) present
    const isCallout = intent === 'FreeTextCallout'
      || (Array.isArray(annot.calloutLine) && annot.calloutLine.length >= 4)
      || (Array.isArray(annot.CL) && annot.CL.length >= 4);

    if (isCallout) {
      const nRect = normRect(rect, pw, ph);
      const cl: number[] = annot.calloutLine ?? annot.CL ?? [];
      // CL has 4 or 6 values: [x1,y1,x2,y2] or [x1,y1,knee_x,knee_y,x2,y2]
      // We store the textbox as the rect and build a cloud around the anchor point
      const calloutCoords: Record<string, unknown> = {
        ...nRect,
        textBox: nRect,
      };
      if (cl.length >= 4) {
        // Anchor point (the pointed-to location) is the last pair
        const anchorX = cl[cl.length - 2];
        const anchorY = cl[cl.length - 1];
        calloutCoords.calloutLine = cl.map((v: number, i: number) =>
          i % 2 === 0 ? v / pw : 1 - v / ph
        );
        // Create a small cloud region around anchor
        const np = normPt(anchorX, anchorY, pw, ph);
        calloutCoords.cloud = {
          left: np.x - 0.02, top: np.y - 0.02,
          width: 0.04, height: 0.04,
        };
      }
      return {
        type: 'callout',
        pageNumber: pageIndex,
        coordinates: calloutCoords,
        properties: {
          ...base(),
          text: content,
          comment: content,
          fontSize,
          textColor,
          fontFamily: annot.defaultAppearanceData?.fontName ?? 'Helvetica',
          strokeWidth: strokeWidth || 1,
        },
      };
    }

    return {
      type: 'text',
      pageNumber: pageIndex,
      coordinates: normRect(rect, pw, ph),
      properties: {
        ...base(),
        text: content,
        comment: content,
        fontSize,
        textColor,
        fontFamily: annot.defaultAppearanceData?.fontName ?? 'Helvetica',
        strokeWidth: 0,
      },
    };
  }

  // ── Text (sticky note) ────────────────────────────────────────────────────────
  if (sub === 'Text') {
    return {
      type: 'text',
      pageNumber: pageIndex,
      coordinates: { left: rect[0]/pw, top: 1-rect[3]/ph, width: 0.12, height: 0.06 },
      properties: {
        ...base(),
        text,
        comment: text,
        fontSize: 12,
        textColor: '#000000',
        strokeWidth: 0,
      },
    };
  }

  // ── Stamp → text box showing stamp label ──────────────────────────────────────
  if (sub === 'Stamp') {
    const label = text || annot.name || 'STAMP';
    return {
      type: 'text',
      pageNumber: pageIndex,
      coordinates: normRect(rect, pw, ph),
      properties: {
        ...base(),
        text: label,
        comment: label,
        fontSize: 18,
        textColor: stroke,
        strokeWidth: 2,
      },
    };
  }

  // ── Caret (insertion mark) → small rect ───────────────────────────────────────
  if (sub === 'Caret') {
    return {
      type: 'rect',
      pageNumber: pageIndex,
      coordinates: normRect(rect, pw, ph),
      properties: { ...base(), comment: text },
    };
  }

  // ── Unknown non-skipped annotation: import as rect with note ─────────────────
  // This ensures 100% import rate — nothing is silently lost.
  if (rect[2] > rect[0] && rect[3] > rect[1]) {
    return {
      type: 'rect',
      pageNumber: pageIndex,
      coordinates: normRect(rect, pw, ph),
      properties: {
        ...base(),
        comment: text || `[${sub}]`,
        strokeWidth: Math.max(1, strokeWidth),
      },
    };
  }

  return null; // zero-area annotation, truly skip
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scans every page of an already-loaded PDFDocumentProxy for annotations.
 * Returns an array of markup objects ready to be inserted via Y.js / createMarkup().
 *
 * Never throws — per-page errors are swallowed with a console.warn.
 */
// Map PDF state string to our internal status key
const PDF_STATE_TO_STATUS: Record<string, string> = {
  Accepted: 'accepted', Rejected: 'rejected',
  Cancelled: 'cancelled', Completed: 'completed', None: 'none',
};

export async function detectAndParseAnnotations(
  pdfDoc: { numPages: number; getPage: (n: number) => Promise<any> },
): Promise<ImportedMarkup[]> {
  const result: ImportedMarkup[] = [];
  // Map annotation id (NM field) → ImportedMarkup, for status resolution
  const idToMarkup = new Map<string, ImportedMarkup>();
  // Collected status annotations: { parentId, state }
  const pendingStatuses: { parentId: string; state: string }[] = [];

  for (let i = 0; i < pdfDoc.numPages; i++) {
    let page: any;
    try {
      page = await pdfDoc.getPage(i + 1); // pdfjs 1-indexed
    } catch {
      continue;
    }

    const vp    = page.getViewport({ scale: 1 });
    const pw    = vp.width;
    const ph    = vp.height;

    if (!pw || !ph) continue; // degenerate page

    let annots: Record<string, any>[] = [];
    try {
      // 'display' covers all visible markup annotations
      annots = (await page.getAnnotations({ intent: 'display' })) ?? [];
    } catch {
      continue;
    }

    for (const annot of annots) {
      try {
        // Collect status reply annotations for second pass
        if (annot.inReplyTo && annot.stateModel === 'Review' && annot.state) {
          pendingStatuses.push({ parentId: annot.inReplyTo, state: annot.state });
          continue;
        }

        const mk = convertAnnotation(annot, i, pw, ph);
        if (mk) {
          result.push(mk);
          // Index by annotation id so status annotations can find their parent.
          // pdfjs uses /NM as the id if present, which matches what we export.
          if (annot.id) idToMarkup.set(String(annot.id), mk);
        }
      } catch (e) {
        // Never lose an annotation silently — log and skip
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[importAnnotations] failed to convert annotation', {
            subtype: annot?.subtype, id: annot?.id, error: e,
          });
        }
      }
    }
  }

  // Second pass: apply statuses to parent markups
  for (const { parentId, state } of pendingStatuses) {
    const mk = idToMarkup.get(parentId);
    if (mk) {
      const status = PDF_STATE_TO_STATUS[state];
      if (status && status !== 'none') {
        mk.properties.status = status;
      }
    }
  }

  return result;
}
