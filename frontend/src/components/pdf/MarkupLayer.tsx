import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { createPortal } from 'react-dom';
// @ts-ignore
import { fabric } from "fabric";
import type { DrawTool } from "./PdfToolbar";

interface MarkupLayerProps {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
  markups: any[];
  tool: DrawTool;
  activeColor?: string;
  activeStrokeWidth?: number;
  activeLineStyle?: "solid" | "dashed" | "dotted" | "dash-dot" | "long-dash";
  docScale?: string;
  selectedMarkupIds?: string[];
  hiddenLayers?: string[];
  currentUserId?: string;
  isAdmin?: boolean;
  canMarkup?: boolean;
  onMarkupAdded?: (markup: any) => void;
  onMarkupSelected?: (markupIds: string[]) => void;
  onMarkupModified?: (markup: any) => void;
  onMarkupDeleted?: (id: string) => void;
  onContextMenu?: (e: MouseEvent, markupId: string) => void;
  onCanvasMention?: (
    data: {
      anchor: HTMLElement;
      query: string;
      onSelect: (name: string) => void;
      cursorPos?: { top: number; left: number };
    } | null,
  ) => void;
  electricalConfig?: any;
  viewportZoom?: number;
  onDeselect?: () => void;
  onSwitchToSelect?: () => void;
  snapGrid?: number;
  /** When set, only markups whose properties.sessionId matches are editable.
   *  Used in Personal / Live modes to restrict editing to session-created markups. */
  activeSessionId?: string | null;
  /** When true, render a small author label beneath each markup */
  showAuthorOnMarkup?: boolean;
}

export interface MarkupLayerRef {
  getFabricCanvas: () => fabric.Canvas | null;
}

/* ─── Helpers ─── */

export function formatMeasurement(pts: number, docScale: string) {
  if (docScale === "1:1") return { text: `${Math.round(pts)}px` };
  const inchesOnPaper = pts / 72;
  if (docScale.includes(":") && !docScale.includes('"')) {
    const ratio = parseFloat(docScale.split(":")[1]) || 1;
    const mmOnPaper = inchesOnPaper * 25.4;
    const realMm = mmOnPaper * ratio;
    if (realMm >= 1000) return { text: `${(realMm / 1000).toFixed(2)}m` };
    if (realMm >= 10) return { text: `${(realMm / 10).toFixed(1)}cm` };
    return { text: `${Math.round(realMm)}mm` };
  }
  let scaleFactor = 1;
  if (docScale.includes("=")) {
    const parts = docScale.split("=");
    const paperPart = parts[0].replace(/"/g, "").trim();
    const realPart = parts[1].trim();
    let paperInches = 1;
    if (paperPart.includes("/")) {
      const fr = paperPart.split("/");
      paperInches = parseFloat(fr[0]) / parseFloat(fr[1]);
    } else {
      paperInches = parseFloat(paperPart) || 1;
    }
    let realInches = 0;
    const feetMatch = realPart.match(/(\d+)'/);
    const inchMatch = realPart.match(/(\d+)"/);
    if (feetMatch) realInches += parseInt(feetMatch[1]) * 12;
    if (inchMatch) realInches += parseInt(inchMatch[1]);
    if (!feetMatch && !inchMatch && realPart.includes("'")) {
      realInches = parseInt(realPart.replace("'", "")) * 12;
    }
    scaleFactor = realInches / paperInches;
  } else {
    return { text: `${Math.round(pts)}pt` };
  }
  const totalRealInches = inchesOnPaper * scaleFactor;
  const roundedTotalInches = Math.round(totalRealInches * 8) / 8;
  let feet = Math.floor(roundedTotalInches / 12);
  let inches = roundedTotalInches % 12;
  let wholeInches = Math.floor(inches);
  let fraction = inches - wholeInches;
  if (Math.abs(fraction - 1) < 0.01) {
    wholeInches += 1;
    fraction = 0;
    if (wholeInches === 12) {
      wholeInches = 0;
      feet += 1;
    }
  }
  let fracText = "";
  if (Math.abs(fraction - 0.125) < 0.01) fracText = " 1/8";
  else if (Math.abs(fraction - 0.25) < 0.01) fracText = " 1/4";
  else if (Math.abs(fraction - 0.375) < 0.01) fracText = " 3/8";
  else if (Math.abs(fraction - 0.5) < 0.01) fracText = " 1/2";
  else if (Math.abs(fraction - 0.625) < 0.01) fracText = " 5/8";
  else if (Math.abs(fraction - 0.75) < 0.01) fracText = " 3/4";
  else if (Math.abs(fraction - 0.875) < 0.01) fracText = " 7/8";
  if (feet === 0) {
    if (wholeInches === 0 && fracText !== "")
      return { text: `${fracText.trim()}"` };
    return { text: `${wholeInches}${fracText}"` };
  }
  const inchPart =
    wholeInches === 0 && fracText === "" ? '0"' : `${wholeInches}${fracText}"`;
  return { text: `${feet}' ${inchPart}` };
}

function makeCloudPath(
  left: number,
  top: number,
  w: number,
  h: number,
  arcSize = 20,
): string {
  if (w < arcSize * 2) w = arcSize * 2;
  if (h < arcSize * 2) h = arcSize * 2;
  const nx = Math.max(2, Math.round(w / arcSize)),
    ny = Math.max(2, Math.round(h / arcSize));
  const sx = w / nx,
    sy = h / ny;
  const r = (s: number) => s * 0.5;
  let d = `M ${left} ${top}`;
  for (let i = 0; i < nx; i++)
    d += ` A ${r(sx)} ${r(sx)} 0 0 1 ${left + (i + 1) * sx} ${top}`;
  for (let i = 0; i < ny; i++)
    d += ` A ${r(sy)} ${r(sy)} 0 0 1 ${left + w} ${top + (i + 1) * sy}`;
  for (let i = 0; i < nx; i++)
    d += ` A ${r(sx)} ${r(sx)} 0 0 1 ${left + w - (i + 1) * sx} ${top + h}`;
  for (let i = 0; i < ny; i++)
    d += ` A ${r(sy)} ${r(sy)} 0 0 1 ${left} ${top + h - (i + 1) * sy}`;
  return d + " Z";
}

function hexToRgba(color: string, alpha: number): string {
  if (!color) return `rgba(0,0,0,${alpha})`;
  // If already rgba/rgb, replace the alpha
  if (color.startsWith('rgba(')) {
    return color.replace(/,\s*[\d.]+\)$/, `,${alpha})`);
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  }
  // Hex → rgba
  const r = parseInt(color.slice(1, 3), 16) || 0,
    g = parseInt(color.slice(3, 5), 16) || 0,
    b = parseInt(color.slice(5, 7), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getDashArray(style: string): number[] {
  switch (style) {
    case "dashed":
      return [12, 6];
    case "dotted":
      return [2, 4];
    case "dash-dot":
      return [15, 6, 3, 6];
    case "dash-dot-dot":
      return [15, 6, 3, 6, 3, 6];
    case "long-dash":
      return [25, 8];
    case "short-dash":
      return [6, 4];
    case "long-dash-dot":
      return [25, 8, 3, 8];
    default:
      return [];
  }
}

// Full hash: includes canvas dimensions to force recreation on zoom.
// Recreation is batched (renderOnAddRemove=false) — zero per-object flicker.
function propHash(m: any, docScale?: string, w?: number, h?: number): string {
  const c = m.coordinates || {};
  const p = m.properties || {};
  const cl = c.cloud;
  const cloudHash = cl ? `${cl.left ?? 0}|${cl.top ?? 0}|${cl.width ?? 0}|${cl.height ?? 0}` : '';
  const tb = c.textBox;
  const tbHash = tb ? `${tb.left ?? 0}|${tb.top ?? 0}|${tb.width ?? 0}|${tb.height ?? 0}` : '';
  return `${m.updatedAt || m.createdAt || 0}|${c.left ?? c.x1 ?? 0}|${c.top ?? c.y1 ?? 0}|${c.width ?? c.x2 ?? 0}|${c.height ?? c.y2 ?? 0}|${c.angle ?? 0}|${cloudHash}|${tbHash}|${p.stroke || ''}|${p.fill || ''}|${p.fillOpacity ?? ''}|${p.strokeWidth ?? ''}|${p.lineStyle || ''}|${p.text || ''}|${p.fontSize ?? ''}|${p.textColor || ''}|${p.arrowSize ?? ''}|${p.arrowStyle || ''}|${p.textBoxFill || ''}|${p.locked ? 1 : 0}|${p.showLength === false ? 0 : 1}|${docScale || ''}|${w ?? ''}|${h ?? ''}|${p.cloudArcSize ?? ''}|${p.connectorStroke ?? ''}|${p.connectorWidth ?? ''}|${p.connectorStyle ?? ''}|${p.textAlign ?? ''}|${p.fontFamily ?? ''}|${p.fontWeight ?? ''}|${p.fontStyle ?? ''}|${p.tickSize ?? ''}|${p.extensionSize ?? ''}|${p.labelBg ?? ''}|${p.labelTextColor ?? ''}|${p.label ?? ''}|${p.redlineLabel ?? ''}|${p.showLabel === false ? 0 : 1}`;
}


function trianglePoints(cx: number, cy: number, w: number, h: number) {
  return [
    { x: cx, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}
function diamondPoints(cx: number, cy: number, w: number, h: number) {
  return [
    { x: cx, y: cy - h / 2 },
    { x: cx + w / 2, y: cy },
    { x: cx, y: cy + h / 2 },
    { x: cx - w / 2, y: cy },
  ];
}
function hexagonPoints(cx: number, cy: number, w: number, h: number) {
  const r = Math.min(w, h) / 2;
  return Array.from({ length: 6 }, (_, i) => ({
    x: cx + r * Math.cos(Math.PI / 6 + (i * Math.PI) / 3),
    y: cy + r * Math.sin(Math.PI / 6 + (i * Math.PI) / 3),
  }));
}
function starPoints(cx: number, cy: number, w: number, h: number) {
  const outer = Math.min(w, h) / 2,
    inner = outer * 0.4;
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** Returns the point on the cloud's bounding-rect EDGE closest to (tx, ty). */
function cloudEdgePoint(
  br: { left: number; top: number; width: number; height: number },
  tx: number,
  ty: number,
): { x: number; y: number } {
  const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
  if (Math.abs(tx - cx) < 0.5 && Math.abs(ty - cy) < 0.5) return { x: cx, y: cy };
  const dx = tx - cx, dy = ty - cy;
  const halfW = br.width / 2, halfH = br.height / 2;
  let tMin = Infinity;
  const candidates: number[] = [];
  if (Math.abs(dx) > 0.001) { candidates.push(halfW / dx); candidates.push(-halfW / dx); }
  if (Math.abs(dy) > 0.001) { candidates.push(halfH / dy); candidates.push(-halfH / dy); }
  for (const t of candidates) {
    if (t <= 0) continue;
    const ex = cx + t * dx, ey = cy + t * dy;
    if (ex >= br.left - 1 && ex <= br.left + br.width + 1 &&
        ey >= br.top - 1 && ey <= br.top + br.height + 1 &&
        t < tMin) tMin = t;
  }
  if (!isFinite(tMin)) return { x: cx, y: cy };
  return { x: cx + tMin * dx, y: cy + tMin * dy };
}

function getMeasureTicks(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  s: number,
  stroke: string,
  strokeWidth: number,
  tickSize: number = 6,
  extensionSize: number = 3,
) {
  const dx = x2 - x1,
    dy = y2 - y1,
    len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return [];
  const ux = dx / len,
    uy = dy / len;
  const nx = -uy,
    ny = ux;
  const tL = tickSize * s; // Tick length (perpendicular half-extent)
  const items: fabric.Object[] = [
    // Tick at start
    new fabric.Line([x1 - nx * tL, y1 - ny * tL, x1 + nx * tL, y1 + ny * tL], {
      stroke,
      strokeWidth,
    }),
    // Tick at end
    new fabric.Line([x2 - nx * tL, y2 - ny * tL, x2 + nx * tL, y2 + ny * tL], {
      stroke,
      strokeWidth,
    }),
  ];
  // Extension lines: thin lines extending past ticks outward along the measurement axis
  if (extensionSize > 0) {
    const eL = extensionSize * s;
    const extSW = Math.max(strokeWidth * 0.5, 0.5); // thinner than main line
    // Start endpoint: extension goes opposite to measurement direction
    items.push(
      new fabric.Line([x1, y1, x1 - ux * eL, y1 - uy * eL], {
        stroke,
        strokeWidth: extSW,
      }),
    );
    // End endpoint: extension goes in the measurement direction
    items.push(
      new fabric.Line([x2, y2, x2 + ux * eL, y2 + uy * eL], {
        stroke,
        strokeWidth: extSW,
      }),
    );
  }
  return items;
}

const MarkupLayer = forwardRef<MarkupLayerRef, MarkupLayerProps>(
  (
    {
      pageNumber,
      width,
      height,
      scale,
      markups,
      tool,
      activeColor = "#d32f2f",
      activeStrokeWidth = 2,
      activeLineStyle = "solid",
      docScale = "1:1",
      selectedMarkupIds = [],
      hiddenLayers = [],
      currentUserId,
      isAdmin = false,
      canMarkup = true,
      onMarkupAdded,
      onMarkupSelected,
      onMarkupModified,
      onMarkupDeleted,
      onContextMenu,
      onCanvasMention,
      electricalConfig,
      viewportZoom = 1,
      onDeselect,
      onSwitchToSelect,
      snapGrid,
      activeSessionId,
      showAuthorOnMarkup = false,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvas = useRef<fabric.Canvas | null>(null);
    const objectCache = useRef<Map<string, fabric.Object>>(new Map());
    const hashCache = useRef<Map<string, string>>(new Map());
    // Fast-path cache: store updatedAt+dimensions per markup to skip full propHash when nothing changed
    const tsCache = useRef<Map<string, string>>(new Map());
    const calloutTailCache = useRef<Map<string, fabric.Object>>(new Map());
    const calloutLineCache = useRef<Map<string, fabric.Object>>(new Map());
    const calloutTextboxBgCache = useRef<Map<string, fabric.Rect>>(new Map());
    const textBorderCache = useRef<Map<string, fabric.Rect>>(new Map());
    const authorLabelCache = useRef<Map<string, fabric.Text>>(new Map());
    const auxLabelCache = useRef<Map<string, fabric.Object>>(new Map()); // measure/polyline labels
    const lastZOrderHashRef = useRef<string>('');
    const lastHighlightHashRef = useRef<string>('');
    const isDrawing = useRef(false);
    const isInSync = useRef(false);
    const isProgrammaticSelect = useRef(false);
    const isDisposing = useRef(false);
    const lastMoveRef = useRef(0);
    const currentObject = useRef<fabric.Object | null>(null);
    const measureLabel = useRef<fabric.Text | null>(null);
    const measureTicks = useRef<fabric.Line[]>([]);
    const measureExtensions = useRef<fabric.Line[]>([]);
    // Polyline drawing state
    const polylinePoints = useRef<{x: number; y: number}[]>([]);
    const polylineLines = useRef<fabric.Line[]>([]);
    const polylinePreviewLine = useRef<fabric.Line | null>(null);
    const polylineLengthLabel = useRef<fabric.Text | null>(null);
    const startPos = useRef<{ x: number; y: number } | null>(null);
    // Vertex edit mode state
    const [vertexMenu, setVertexMenu] = useState<{ x: number; y: number; handleIdx: number; markupId: string } | null>(null);
    const vertexEditMarkupId = useRef<string | null>(null);
    const textEditingMarkupId = useRef<string | null>(null);
    const vertexHandles = useRef<fabric.Circle[]>([]);
    const vertexTempObjs = useRef<fabric.Object[]>([]);
    const vertexPoints = useRef<{ x: number; y: number }[]>([]);
    const vertexMarkupDataRef = useRef<any>(null);
    const vertexExitFnRef = useRef<((save: boolean) => void) | null>(null);
    const markupsRef = useRef(markups);
    const onMarkupDeletedRef = useRef(onMarkupDeleted);
    const hiddenLayersRef = useRef(hiddenLayers);
    const highlightCanvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingHighlightRef = useRef(false);
    const highlightPreviewRectRef = useRef<fabric.Rect | null>(null);
    const imageFileInputRef = useRef<HTMLInputElement>(null);
    const imageClickPosRef = useRef<{ x: number; y: number } | null>(null);
    // Electrical: config for one-click placement
    const electricalConfigRef = useRef<any>(null);
    // Wire Tag: two-click placement refs
    const wireTagStartRef = useRef<{ x: number; y: number } | null>(null);
    const wireTagPreviewRef = useRef<fabric.Circle | null>(null);
    // Callout: ID of a just-drawn callout whose textbox should auto-enter editing once rendered
    const pendingCalloutEditRef = useRef<string | null>(null);
    const startHtmlTextEditRef = useRef<((opts: any) => void) | null>(null);
    // Cursor preview for one-click placement tools
    const cursorPreviewRef = useRef<fabric.Object | null>(null);
    const lastCursorPreviewTime = useRef(0);

    const pageNumberRef = useRef(pageNumber);
    const toolRef = useRef(tool);
    const colorRef = useRef(activeColor);
    const widthRef = useRef(activeStrokeWidth);
    const lineStyleRef = useRef(activeLineStyle);
    const scaleRef = useRef(scale);
    const uiScaleRef = useRef(1 / viewportZoom);
    const docScaleRef = useRef(docScale);
    const currentUserIdRef = useRef(currentUserId);
    const isAdminRef = useRef(isAdmin);
    const canMarkupRef = useRef(canMarkup);
    const activeSessionIdRef = useRef(activeSessionId);
    const showAuthorOnMarkupRef = useRef(showAuthorOnMarkup);
    const onCanvasMentionRef = useRef(onCanvasMention);
    const onMarkupAddedRef = useRef(onMarkupAdded);
    const onMarkupModifiedRef = useRef(onMarkupModified);
    const onMarkupSelectedRef = useRef(onMarkupSelected);
    const onContextMenuRef = useRef(onContextMenu);
    const onDeselectRef = useRef(onDeselect);
    const onSwitchToSelectRef = useRef(onSwitchToSelect);

    // Clean up cursor preview ONLY when tool or electricalConfig changes (not on every markups update)
    useEffect(() => {
      if (cursorPreviewRef.current && fabricCanvas.current) {
        fabricCanvas.current.remove(cursorPreviewRef.current);
        cursorPreviewRef.current = null;
        fabricCanvas.current.requestRenderAll();
      }
    }, [tool, electricalConfig]);

    // Sync all refs — runs on every prop change but does NOT remove cursor preview
    useEffect(() => {
      pageNumberRef.current = pageNumber;
      toolRef.current = tool;
      colorRef.current = activeColor;
      widthRef.current = activeStrokeWidth;
      lineStyleRef.current = activeLineStyle;
      scaleRef.current = scale;
      uiScaleRef.current = 1 / (viewportZoom || 1);
      docScaleRef.current = docScale;
      currentUserIdRef.current = currentUserId;
      isAdminRef.current = isAdmin;
      canMarkupRef.current = canMarkup;
      activeSessionIdRef.current = activeSessionId;
      showAuthorOnMarkupRef.current = showAuthorOnMarkup;
      electricalConfigRef.current = electricalConfig;
      hiddenLayersRef.current = hiddenLayers;
      onCanvasMentionRef.current = onCanvasMention;
      onMarkupAddedRef.current = onMarkupAdded;
      onMarkupModifiedRef.current = onMarkupModified;
      onMarkupSelectedRef.current = onMarkupSelected;
      onContextMenuRef.current = onContextMenu;
      onMarkupDeletedRef.current = onMarkupDeleted;
      markupsRef.current = markups;
      onDeselectRef.current = onDeselect;
      onSwitchToSelectRef.current = onSwitchToSelect;
    });

    useImperativeHandle(ref, () => ({
      getFabricCanvas: () => fabricCanvas.current,
    }));

    // TOOL MODE UPDATE — cursor, selection, drawing mode
    useEffect(() => {
      const canvas = fabricCanvas.current;
      if (!canvas) return;

      const readOnly = !canMarkupRef.current;
      const isSelect = tool === "select" || readOnly;
      const isPen = !readOnly && tool === "pen";
      const isHighlighter = !readOnly && tool === "highlighter";
      void (isPen || isHighlighter); // used implicitly via canvas.isDrawingMode

      // Cursor
      let cursor = "default";
      switch (tool) {
        case "select":
        case "reviewStamp":
        case "electricalBox":
        case "stub":
        case "panel":
        case "wireTag":
          cursor = "default";
          break;
        case "pan":
          cursor = "grab";
          break;
        case "pen":
        case "highlighter":
        case "measure":
        case "polyline":
          cursor = "crosshair";
          break;
        case "text":
          cursor = "text";
          break;
        default:
          cursor = "crosshair";
      }
      canvas.defaultCursor = cursor;
      // Drawing tools: keep drawing cursor even on hover (don't switch to pointer)
      canvas.hoverCursor = tool === "select" ? "move" : cursor;
      canvas.setCursor(cursor);

      // Touch scrolling: allow browser-native scroll when not drawing
      // (so single-finger pan works in pan/select mode)
      canvas.allowTouchScrolling = ['select', 'pan', 'textSelect'].includes(tool);

      // Selection rectangle — only in select mode
      canvas.selection = isSelect;

      // Free drawing mode: pen only — highlighter uses rect drag now
      canvas.isDrawingMode = isPen;
      if (isPen && canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = colorRef.current;
        canvas.freeDrawingBrush.width = widthRef.current;
      }

      // Update object interactivity based on mode
      canvas.getObjects().forEach((obj: any) => {
        // Connector lines are always non-interactive
        if (obj.data?.part === 'connector') {
          obj.set({ selectable: false, evented: false });
          return;
        }
        const locked = !!obj.data?.locked;
        const canEdit = obj.data?.canEdit !== false;
        // Session-scope: non-session markups in Personal/Live fully non-interactive
        const mId = obj.data?.id;
        const sessionRestricted = !!(activeSessionIdRef.current && (obj.data?.sessionId || obj.data?.properties?.sessionId) !== activeSessionIdRef.current);
        const effectiveLocked = readOnly || locked || !canEdit || sessionRestricted;
        const isTail = obj.data?.part === 'tail';
        const isHighlight = obj.data?.type === 'highlighter';
        const fullyLocked = effectiveLocked || isHighlight;
        obj.set({
          selectable: isSelect,
          evented: isSelect,
          lockMovementX: fullyLocked,
          lockMovementY: fullyLocked,
          lockRotation: fullyLocked,
          lockScalingX: fullyLocked,
          lockScalingY: fullyLocked,
          hasControls: !fullyLocked && !isTail,
          hasBorders: !isTail,
        });
      });

      // Cancel wireTag first-click when switching away
      if (tool !== 'wireTag' && wireTagStartRef.current) {
        wireTagStartRef.current = null;
        const cvs = fabricCanvas.current;
        if (cvs && wireTagPreviewRef.current) {
          cvs.remove(wireTagPreviewRef.current);
          wireTagPreviewRef.current = null;
          cvs.requestRenderAll();
        }
      }

      // Cancel polyline drawing when switching away from the tool
      if (tool !== "polyline" && polylinePoints.current.length > 0) {
        const cvs = fabricCanvas.current;
        if (cvs) {
          polylineLines.current.forEach(l => cvs.remove(l));
          if (polylinePreviewLine.current) cvs.remove(polylinePreviewLine.current);
          if (polylineLengthLabel.current) cvs.remove(polylineLengthLabel.current);
          cvs.requestRenderAll();
        }
        polylinePoints.current = [];
        polylineLines.current = [];
        polylinePreviewLine.current = null;
        polylineLengthLabel.current = null;
      }
      // Exit vertex edit mode when switching tool
      if (tool !== "select" && vertexEditMarkupId.current) {
        vertexExitFnRef.current?.(true);
      }

      canvas.requestRenderAll();

      // Pass pointer events through to PDF text layer when textSelect is active
      const isTextSelect = tool === 'textSelect';
      const upper = (canvas as any).upperCanvasEl as HTMLElement | undefined;
      const lower = (canvas as any).lowerCanvasEl as HTMLElement | undefined;
      const wrapper = (canvas as any).wrapperEl as HTMLElement | undefined;
      const pe = isTextSelect ? 'none' : 'auto';
      if (upper) upper.style.pointerEvents = pe;
      if (lower) lower.style.pointerEvents = pe;
      if (wrapper) wrapper.style.pointerEvents = pe;
    }, [tool, activeColor, activeStrokeWidth, activeSessionId]);

    // Adaptive control sizes: compensate for CSS scale so controls stay usable at any zoom
    const controlSizeRef = useRef({ cornerSize: 10, padding: 6, borderScaleFactor: 1.5 });
    useEffect(() => {
      const canvas = fabricCanvas.current;
      if (!canvas) return;
      const cssScale = viewportZoom / scale;
      const invScale = Math.max(0.5, Math.min(4, 1 / cssScale));
      const sz = { cornerSize: Math.round(10 * invScale), padding: Math.round(6 * invScale), borderScaleFactor: 1.5 * invScale };
      controlSizeRef.current = sz;
      // Update prototype so ALL new objects get the right size
      fabric.Object.prototype.set(sz);
      // Update existing objects
      canvas.getObjects().forEach((obj: any) => { obj.set(sz); });
      canvas.requestRenderAll();
    }, [viewportZoom, scale]);

    useEffect(() => {
      if (!canvasRef.current || fabricCanvas.current) return;
      if (width <= 0 || height <= 0) return;

      const canvas = new fabric.Canvas(canvasRef.current, {
        width,
        height,
        selection: false,
        fireRightClick: true,
        stopContextMenu: true,
        renderOnAddRemove: false,
        enableRetinaScaling: true,
        allowTouchScrolling: true,
        imageSmoothingEnabled: true, // smooth text rendering when CSS-scaled; dynamic renderedZoom keeps quality high
        preserveObjectStacking: true, // Don't change z-order on selection — keeps auxLabels above shapes
      });
      fabricCanvas.current = canvas;
      // Enable object caching for performance with many markups
      canvas.skipOffscreen = false; // Disabled — skipOffscreen + CSS transform scale can cause black screen during text editing
      // Ensure canvas receives events immediately after mount (fix for page-mode tool loss)
      requestAnimationFrame(() => canvas.calcOffset());

      // Set up free drawing brush
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = colorRef.current;
      canvas.freeDrawingBrush.width = widthRef.current;

      // Performance: enable object caching and skip automatic state checking
      fabric.Object.prototype.objectCaching = true;
      fabric.Object.prototype.statefullCache = false;

      // Fix Fabric.js textarea positioning under CSS transform: scale()
      // When Fabric creates a textarea for text editing, it positions it based on canvas coords.
      // Our parent has CSS transform: scale(cssScale) which shifts the textarea.
      // Fix: observe textarea creation AND re-apply scale on every enterEditing call.
      // Uses uiScaleRef (always-current 1/viewportZoom) instead of the captured prop value.
      const applyTextareaScale = (ta: HTMLTextAreaElement) => {
        const currentViewportZoom = 1 / (uiScaleRef.current || 1);
        const cssScale = currentViewportZoom / (scaleRef.current || 2);
        ta.style.transform = `scale(${1 / cssScale})`;
        ta.style.transformOrigin = 'top left';
      };
      const observer = new MutationObserver((mutations) => {
        for (const mut of mutations) {
          for (const node of mut.addedNodes) {
            if (node instanceof HTMLTextAreaElement && node.dataset.fabricHiddenTextarea != null) {
              if (!node.id) node.id = `fabric-textarea-${pageNumber}`;
              applyTextareaScale(node);
            }
          }
        }
      });
      const canvasWrapper = canvasRef.current?.parentElement;
      if (canvasWrapper) observer.observe(canvasWrapper, { childList: true, subtree: true });
      // Store applyTextareaScale on the canvas instance so dblclick handlers can call it
      (canvas as any)._applyTextareaScale = applyTextareaScale;

      // Rotation cursor
      canvas.rotationCursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%231565c0\' d=\'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z\'/%3E%3C/svg%3E") 12 12, crosshair';

      fabric.Object.prototype.set({
        transparentCorners: false,
        cornerColor: "#1565c0",
        cornerStrokeColor: "#ffffff",
        borderColor: "rgba(21,101,192,0.7)",
        cornerSize: 10,
        borderScaleFactor: 1.5,
        padding: 6,
        cornerStyle: "circle",
      });

      const canvasElement = canvas.getElement();
      canvasElement.addEventListener("contextmenu", (e: MouseEvent) =>
        e.preventDefault(),
      );

      // Pressure sensitivity for stylus/touch — adjusts brush width based on PointerEvent.pressure
      const wrapper = (canvas as any).wrapperEl as HTMLElement | undefined;
      const handlePressure = (e: PointerEvent) => {
        if (!canvas.freeDrawingBrush) return;
        if (toolRef.current !== 'pen' && toolRef.current !== 'highlighter') return;
        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        // Vary width: half at min pressure, double at max
        canvas.freeDrawingBrush.width = Math.max(1, widthRef.current * pressure * 2);
      };
      wrapper?.addEventListener('pointermove', handlePressure as EventListener);
      // Reset pressure on pointer up so next stroke starts at base width
      const handlePressureEnd = () => {
        if (canvas.freeDrawingBrush) canvas.freeDrawingBrush.width = widthRef.current;
      };
      wrapper?.addEventListener('pointerup', handlePressureEnd as EventListener);

      canvas.on("mouse:down", (opt: any) => {
        const e = opt.e as MouseEvent;
        // Read-only mode: only allow selection (for properties panel), block all drawing/editing
        if (!canMarkupRef.current) {
          if (e.button === 2) {
            const target = canvas.findTarget(e, false) as any;
            if (target?.data?.id) {
              onContextMenuRef.current?.(e, target.data.id);
            } else {
              const active = canvas.getActiveObject();
              const activeId = active?.data?.id
                || (active?.type === 'activeSelection' ? (active as fabric.ActiveSelection).getObjects()[0]?.data?.id : null);
              if (activeId) onContextMenuRef.current?.(e, activeId);
            }
          }
          return;
        }
        if (e.button === 1 || e.button === 2) {
          if (e.button === 2) {
            const target = canvas.findTarget(e, false) as any;
            if (target?.data?.isVertexHandle) {
              setVertexMenu({ x: e.clientX, y: e.clientY, handleIdx: target.data.handleIndex, markupId: target.data.markupId });
            } else if (target?.data?.id) {
              onContextMenuRef.current?.(e, target.data.id);
            } else if (target?.type === 'activeSelection') {
              // Right-click on activeSelection (multi-select box)
              const firstObj = (target as fabric.ActiveSelection).getObjects().find((o: any) => o.data?.id);
              if (firstObj) onContextMenuRef.current?.(e, (firstObj as any).data.id);
            } else {
              // Right-click on empty canvas — check if there's an active object/selection
              const active = canvas.getActiveObject();
              if (active?.type === 'activeSelection') {
                const firstObj = (active as fabric.ActiveSelection).getObjects().find((o: any) => o.data?.id);
                if (firstObj) onContextMenuRef.current?.(e, (firstObj as any).data.id);
              } else if (active?.data?.id) {
                onContextMenuRef.current?.(e, active.data.id);
              }
            }
          }
          return;
        }
        // Vertex edit: detect exit intent by checking left-click target BEFORE Fabric changes selection.
        // This is more reliable than relying on selection:cleared which fires spuriously during drags.
        if (vertexEditMarkupId.current && toolRef.current === 'select') {
          const target = canvas.findTarget(e, false) as any;
          const isOwnHandle = target?.data?.isVertexHandle && target.data.markupId === vertexEditMarkupId.current;
          if (!isOwnHandle) {
            exitVertexEdit(true);
            // Discard any selection that Fabric would make after restoring the group,
            // so the user doesn't need a second click to deselect.
            canvas.discardActiveObject();
            canvas.requestRenderAll();
          }
        }
        if (["select", "pan", "pen"].includes(toolRef.current)) {
          if (toolRef.current === 'select') {
            const target = canvas.findTarget(opt.e as MouseEvent, false) as any;
            if (!target && !vertexEditMarkupId.current) {
              onDeselectRef.current?.();
            }

            // Alt+click: cycle through overlapping objects at click point
            if ((opt.e as MouseEvent).altKey && target?.data?.id) {
              const pointer = canvas.getPointer(opt.e);
              const allObjs = canvas.getObjects().filter((o: any) =>
                o.data?.id && o.containsPoint(pointer)
              );
              if (allObjs.length > 1) {
                const currentIdx = allObjs.indexOf(target);
                const nextIdx = (currentIdx + 1) % allObjs.length;
                canvas.discardActiveObject();
                canvas.setActiveObject(allObjs[nextIdx] as fabric.Object);
                canvas.requestRenderAll();
                const nextId = (allObjs[nextIdx] as any).data?.id;
                if (nextId) onMarkupSelectedRef.current?.([nextId]);
              }
            }
          }
          return;
        }
        // ── Sticky Note: one-click placement, auto-enter edit mode ──
        if (toolRef.current === 'stickyNote') {
          if (cursorPreviewRef.current) { canvas.remove(cursorPreviewRef.current); cursorPreviewRef.current = null; }
          const pointer = canvas.getPointer(opt.e);
          const cw = canvas.getWidth(), ch = canvas.getHeight();
          const nx = pointer.x / cw, ny = pointer.y / ch;
          // 100x100 pixels → normalized by canvas dimensions
          const stickyPx = 100 * scaleRef.current;
          const szW = stickyPx / cw;
          const szH = stickyPx / ch;
          const config = electricalConfigRef.current;
          const noteColor = config?.customProps?.fill || '#FFEB3B';
          const pendingId = crypto.randomUUID();
          onMarkupAddedRef.current?.({
            id: pendingId,
            type: 'stickyNote',
            pageNumber: pageNumberRef.current,
            coordinates: { left: nx - szW / 2, top: ny - szH / 2, width: szW, angle: 0 },
            properties: {
              stroke: 'transparent', strokeWidth: 0,
              fill: noteColor, textColor: config?.customProps?.textColor || '#212121',
              fontSize: config?.customProps?.fontSize || 14,
              text: '',
            },
          });
          canvas.requestRenderAll();
          // Auto-enter edit mode after rendering
          setTimeout(() => {
            const obj = objectCache.current.get(pendingId) as any;
            if (obj && obj.editable !== false) {
              canvas.discardActiveObject();
              canvas.setActiveObject(obj);
              textEditingMarkupId.current = pendingId;
              requestAnimationFrame(() => {
                obj.enterEditing?.();
                canvas.requestRenderAll();
              });
            }
          }, 120);
          setTimeout(() => onSwitchToSelectRef.current?.(), 50);
          return;
        }
        // ── One-click placement: electrical + review stamps ──
        if (['electricalBox', 'stub', 'panel', 'reviewStamp'].includes(toolRef.current)) {
          // Remove cursor preview before placing
          if (cursorPreviewRef.current) {
            canvas.remove(cursorPreviewRef.current);
            cursorPreviewRef.current = null;
          }
          const pointer = canvas.getPointer(opt.e);
          const cw = canvas.getWidth(), ch = canvas.getHeight();
          const nx = pointer.x / cw;
          const ny = pointer.y / ch;
          const config = electricalConfigRef.current;
          const isStamp = toolRef.current === 'reviewStamp';
          const sz = config?.size || (isStamp ? 0.08 : 0.03);
          const isSupport = config?.customProps?.supportShape && config.customProps.supportShape !== 'hanger';
          const szH = isStamp ? sz * 0.45 : (isSupport ? sz * 0.25 : sz); // stamps are wider than tall; supports are thin horizontal
          onMarkupAddedRef.current?.({
            type: toolRef.current,
            pageNumber: pageNumberRef.current,
            coordinates: { left: nx - sz / 2, top: ny - szH / 2, width: sz, height: szH },
            properties: {
              stroke: colorRef.current,
              strokeWidth: widthRef.current,
              text: config?.defaultText || '',
              ...config?.customProps,
            },
          });
          canvas.requestRenderAll();
          // Auto-switch to select so user can move/edit the placed element
          setTimeout(() => onSwitchToSelectRef.current?.(), 50);
          return;
        }
        // ── Wire Tag two-click placement ──
        if (toolRef.current === 'wireTag') {
          const pointer = canvas.getPointer(opt.e);
          const cw = canvas.getWidth(), ch = canvas.getHeight();
          if (!wireTagStartRef.current) {
            // First click: store start point
            wireTagStartRef.current = { x: pointer.x / cw, y: pointer.y / ch };
            // Draw preview dot
            const dot = new fabric.Circle({
              left: pointer.x, top: pointer.y, radius: 3 * scaleRef.current,
              fill: colorRef.current, originX: 'center', originY: 'center',
              selectable: false, evented: false,
            });
            wireTagPreviewRef.current = dot;
            canvas.add(dot);
            canvas.requestRenderAll();
          } else {
            // Second click: create wire tag
            const start = wireTagStartRef.current;
            const end = { x: pointer.x / cw, y: pointer.y / ch };
            wireTagStartRef.current = null;
            if (wireTagPreviewRef.current) {
              canvas.remove(wireTagPreviewRef.current);
              wireTagPreviewRef.current = null;
            }
            const config = electricalConfigRef.current;
            onMarkupAddedRef.current?.({
              type: 'wireTag',
              pageNumber: pageNumberRef.current,
              coordinates: { x1: start.x, y1: start.y, x2: end.x, y2: end.y },
              properties: {
                stroke: colorRef.current,
                strokeWidth: widthRef.current,
                text: config?.defaultText || '#12 AWG',
                ...config?.customProps,
              },
            });
            canvas.requestRenderAll();
          }
          return;
        }
        // Image tool: click to open file picker
        if (toolRef.current === 'image') {
          const pointer = canvas.getPointer(opt.e);
          imageClickPosRef.current = { x: pointer.x, y: pointer.y };
          imageFileInputRef.current?.click();
          return;
        }
        // Rect-based highlighter — Bluebeam style: drag to create rectangle
        if (toolRef.current === "highlighter") {
          isDrawingHighlightRef.current = true;
          const pointer = canvas.getPointer(opt.e);
          startPos.current = { x: pointer.x, y: pointer.y };
          const r = new fabric.Rect({
            left: pointer.x, top: pointer.y, width: 0, height: 0,
            fill: colorRef.current + '66',
            stroke: 'transparent', strokeWidth: 0,
            selectable: false, evented: false,
          });
          highlightPreviewRectRef.current = r;
          canvas.add(r);
          canvas.requestRenderAll();
          return;
        }
        if (toolRef.current === "measure") {
          isDrawing.current = true;
          const pointer = canvas.getPointer(opt.e);
          startPos.current = { x: pointer.x, y: pointer.y };
          currentObject.current = new fabric.Line(
            [pointer.x, pointer.y, pointer.x, pointer.y],
            {
              stroke: colorRef.current,
              strokeWidth: widthRef.current,
              selectable: false,
            },
          );
          measureLabel.current = new fabric.Text("0", {
            left: pointer.x,
            top: pointer.y - 15 * uiScaleRef.current,
            fontSize: 14 * uiScaleRef.current,
            fill: colorRef.current,
            fontFamily: "Arial",
            originX: "center",
            originY: "bottom",
            selectable: false,
            textBackgroundColor: "rgba(255,255,255,0.7)",
          });
          measureTicks.current = [
            new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
              stroke: colorRef.current,
              strokeWidth: widthRef.current,
              selectable: false,
            }),
            new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
              stroke: colorRef.current,
              strokeWidth: widthRef.current,
              selectable: false,
            }),
          ];
          const extSW = Math.max(widthRef.current * 0.5, 0.5);
          measureExtensions.current = [
            new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
              stroke: colorRef.current,
              strokeWidth: extSW,
              selectable: false,
            }),
            new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
              stroke: colorRef.current,
              strokeWidth: extSW,
              selectable: false,
            }),
          ];
          canvas.add(
            currentObject.current,
            measureLabel.current,
            ...measureTicks.current,
            ...measureExtensions.current,
          );
          return;
        }

        // ─── Polyline / Route Template: click to add points, dblclick to finish ───
        if (toolRef.current === "polyline" || toolRef.current === "routeTemplate") {
          const pointer = canvas.getPointer(opt.e);
          // Shift-snap: constrain to 0°/45°/90° from previous point
          if ((opt.e as MouseEvent).shiftKey && polylinePoints.current.length > 0) {
            const last = polylinePoints.current[polylinePoints.current.length - 1];
            const adx = pointer.x - last.x, ady = pointer.y - last.y;
            const angle = Math.atan2(ady, adx);
            const dist = Math.sqrt(adx * adx + ady * ady);
            const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            pointer.x = last.x + dist * Math.cos(snapped);
            pointer.y = last.y + dist * Math.sin(snapped);
          }
          if (polylinePoints.current.length === 0) {
            // First point — start polyline
            polylinePoints.current = [{ x: pointer.x, y: pointer.y }];
            polylinePreviewLine.current = new fabric.Line(
              [pointer.x, pointer.y, pointer.x, pointer.y],
              { stroke: colorRef.current, strokeWidth: widthRef.current, strokeDashArray: getDashArray(lineStyleRef.current), strokeLineCap: 'round', strokeLineJoin: 'round', selectable: false, evented: false },
            );
            polylineLengthLabel.current = new fabric.Text("0", {
              left: pointer.x, top: pointer.y - 15 * uiScaleRef.current,
              fontSize: 14 * uiScaleRef.current, fill: colorRef.current, fontFamily: "Arial",
              originX: "center", originY: "bottom", selectable: false, evented: false,
              textBackgroundColor: "rgba(255,255,255,0.7)",
            });
            canvas.add(polylinePreviewLine.current, polylineLengthLabel.current);
          } else {
            // Add next segment
            const prevPt = polylinePoints.current[polylinePoints.current.length - 1];
            const seg = new fabric.Line(
              [prevPt.x, prevPt.y, pointer.x, pointer.y],
              { stroke: colorRef.current, strokeWidth: widthRef.current, strokeDashArray: getDashArray(lineStyleRef.current), strokeLineCap: 'round', strokeLineJoin: 'round', selectable: false, evented: false },
            );
            polylineLines.current.push(seg);
            canvas.add(seg);
            polylinePoints.current.push({ x: pointer.x, y: pointer.y });
            polylinePreviewLine.current?.set({ x1: pointer.x, y1: pointer.y, x2: pointer.x, y2: pointer.y });
          }
          canvas.requestRenderAll();
          return;
        }

        isDrawing.current = true;
        const pointer = canvas.getPointer(opt.e);
        startPos.current = { x: pointer.x, y: pointer.y };
        if (
          toolRef.current === "rect" ||
          toolRef.current === "cloud" ||
          toolRef.current === "callout" ||
          toolRef.current === "text"
        ) {
          currentObject.current = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: "transparent",
            stroke: colorRef.current,
            strokeWidth: widthRef.current,
            strokeDashArray: getDashArray(lineStyleRef.current),
            selectable: false,
          });
        } else if (toolRef.current === "circle") {
          currentObject.current = new fabric.Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 0,
            fill: "transparent",
            stroke: colorRef.current,
            strokeWidth: widthRef.current,
            strokeDashArray: getDashArray(lineStyleRef.current),
            selectable: false,
          });
        } else if (toolRef.current === "ellipse") {
          currentObject.current = new fabric.Ellipse({
            left: pointer.x,
            top: pointer.y,
            rx: 0,
            ry: 0,
            fill: "transparent",
            stroke: colorRef.current,
            strokeWidth: widthRef.current,
            strokeDashArray: getDashArray(lineStyleRef.current),
            selectable: false,
          });
        } else if (toolRef.current === "triangle") {
          currentObject.current = new fabric.Polygon(
            trianglePoints(pointer.x, pointer.y, 0, 0).map((p) => new fabric.Point(p.x, p.y)),
            {
              left: pointer.x,
              top: pointer.y,
              fill: "transparent",
              stroke: colorRef.current,
              strokeWidth: widthRef.current,
              strokeDashArray: getDashArray(lineStyleRef.current),
              selectable: false,
            },
          );
        } else if (["diamond", "hexagon", "star"].includes(toolRef.current)) {
          currentObject.current = new fabric.Polygon([], {
            left: pointer.x,
            top: pointer.y,
            fill: "transparent",
            stroke: colorRef.current,
            strokeWidth: widthRef.current,
            strokeDashArray: getDashArray(lineStyleRef.current),
            selectable: false,
          });
        } else if (["line", "arrow"].includes(toolRef.current)) {
          currentObject.current = new fabric.Line(
            [pointer.x, pointer.y, pointer.x, pointer.y],
            {
              stroke: colorRef.current,
              strokeWidth: widthRef.current,
              strokeDashArray: getDashArray(lineStyleRef.current),
              selectable: false,
            },
          );
        }
        if (currentObject.current) canvas.add(currentObject.current);
      });

      canvas.on("mouse:move", (opt: any) => {
        // Cursor preview for one-click placement tools
        if (['electricalBox', 'stub', 'panel', 'reviewStamp', 'stickyNote'].includes(toolRef.current)) {
          const pointer = canvas.getPointer(opt.e);

          // Fast path: just move existing preview (zero flicker)
          if (cursorPreviewRef.current) {
            const p = cursorPreviewRef.current;
            const pw = (p.width || 0) * (p.scaleX || 1);
            const ph = (p.height || 0) * (p.scaleY || 1);
            p.set({ left: pointer.x - pw / 2, top: pointer.y - ph / 2 });
            p.setCoords();
            canvas.requestRenderAll();
            return; // Never remove — just move. Preview is recreated only on tool/config change.
          } else {
            const now = performance.now();
            if (now - lastCursorPreviewTime.current < 50) return;
            lastCursorPreviewTime.current = now;
          }
          const config = electricalConfigRef.current;
          const color = colorRef.current;
          const sw = widthRef.current;
          const sz = config?.size || (toolRef.current === 'reviewStamp' ? 0.08 : 0.03);
          const isSupportPreview = config?.customProps?.supportShape && config.customProps.supportShape !== 'hanger';
          const previewW = sz * canvas.getWidth();
          const previewH = (toolRef.current === 'reviewStamp' ? sz * 0.45 : (isSupportPreview ? sz * 0.25 : sz)) * canvas.getHeight();
          let preview: fabric.Object;

          if (toolRef.current === 'reviewStamp' && config?.customProps?.__isCustomStamp && config.customProps.__stampMarkups) {
            // Custom stamp preview — render actual markup shapes from saved data
            const stampMks: any[] = config.customProps.__stampMarkups;
            const cw = canvas.getWidth(), ch = canvas.getHeight();
            const objs: fabric.Object[] = [];
            for (const sm of stampMks) {
              const c = sm.coordinates || {};
              const p = sm.properties || {};
              const st = p.stroke || '#d32f2f';
              const sw2 = (p.strokeWidth || 2) * scaleRef.current;
              const fl = p.fill && p.fill !== 'transparent' ? p.fill : 'transparent';
              if (c.left !== undefined) {
                // Rect-based: cloud, rect, circle, text, reviewStamp, etc.
                const w2 = (c.width || 0.05) * cw, h2 = (c.height || 0.05) * ch;
                const ox = (sm._offsetX || 0) * cw, oy = (sm._offsetY || 0) * ch;
                if (sm.type === 'cloud') {
                  objs.push(new fabric.Path(makeCloudPath(ox - w2/2, oy - h2/2, w2, h2, 12 * scaleRef.current), { fill: fl, stroke: st, strokeWidth: sw2, selectable: false, evented: false }));
                } else if (sm.type === 'circle' || sm.type === 'ellipse') {
                  objs.push(new fabric.Ellipse({ left: ox - w2/2, top: oy - h2/2, rx: w2/2, ry: h2/2, fill: fl, stroke: st, strokeWidth: sw2, selectable: false, evented: false }));
                } else {
                  objs.push(new fabric.Rect({ left: ox - w2/2, top: oy - h2/2, width: w2, height: h2, fill: fl, stroke: st, strokeWidth: sw2, selectable: false, evented: false }));
                }
                if (p.text) {
                  objs.push(new fabric.Text(p.text, { left: ox, top: oy, fontSize: (p.fontSize || 12) * scaleRef.current, fill: p.textColor || st, fontFamily: 'Arial', fontWeight: 'bold', originX: 'center', originY: 'center', selectable: false, evented: false }));
                }
              } else if (c.x1 !== undefined) {
                const ox = (sm._offsetX || 0) * cw, oy = (sm._offsetY || 0) * ch;
                const dx = ((c.x2 || 0) - (c.x1 || 0)) * cw / 2, dy = ((c.y2 || 0) - (c.y1 || 0)) * ch / 2;
                objs.push(new fabric.Line([ox - dx, oy - dy, ox + dx, oy + dy], { stroke: st, strokeWidth: sw2, selectable: false, evented: false }));
              }
            }
            preview = new fabric.Group(objs, {
              left: pointer.x, top: pointer.y,
              originX: 'center', originY: 'center',
              opacity: 0.5, selectable: false, evented: false,
            });
          } else if (toolRef.current === 'reviewStamp') {
            const stampProps = config?.customProps || {};
            const shape = stampProps.stampShape || 'rounded';
            const hasFill = stampProps.stampFill !== false;
            const text = config?.defaultText || '?';
            let shapeObj: fabric.Object;
            if (shape === 'rounded') {
              shapeObj = new fabric.Rect({ left: 0, top: 0, width: previewW, height: previewH, rx: previewH * 0.35, ry: previewH * 0.35, fill: hasFill ? color : 'transparent', stroke: color, strokeWidth: sw });
            } else if (shape === 'circle') {
              const r = Math.max(previewW, previewH) / 2;
              shapeObj = new fabric.Circle({ left: 0, top: 0, radius: r, fill: hasFill ? color : 'transparent', stroke: color, strokeWidth: sw });
            } else if (shape === 'diamond') {
              shapeObj = new fabric.Polygon([{x: previewW/2, y: 0}, {x: previewW, y: previewH/2}, {x: previewW/2, y: previewH}, {x: 0, y: previewH/2}], { fill: hasFill ? color : 'transparent', stroke: color, strokeWidth: sw });
            } else {
              shapeObj = new fabric.Rect({ left: 0, top: 0, width: previewW, height: previewH, fill: hasFill ? color : 'transparent', stroke: color, strokeWidth: sw });
            }
            const textObj = new fabric.Text(text, { left: previewW / 2, top: previewH / 2, fontSize: Math.min(previewW, previewH) * 0.4, originX: 'center', originY: 'center', fill: hasFill ? '#fff' : color, fontFamily: 'Arial', fontWeight: 'bold' });
            preview = new fabric.Group([shapeObj, textObj], { left: pointer.x - previewW / 2, top: pointer.y - previewH / 2, opacity: 0.5, selectable: false, evented: false });
          } else if (toolRef.current === 'stub') {
            const r = previewW / 2;
            const dir = config?.customProps?.stubDirection || 'up';
            const circle = new fabric.Circle({ left: 0, top: 0, radius: r, fill: dir === 'down' ? color : 'transparent', stroke: color, strokeWidth: sw });
            const text = new fabric.Text(dir === 'down' ? 'SD' : 'SU', { left: r, top: r, fontSize: r * 0.7, originX: 'center', originY: 'center', fill: dir === 'down' ? '#fff' : color, fontFamily: 'Arial', fontWeight: 'bold' });
            preview = new fabric.Group([circle, text], { left: pointer.x - r, top: pointer.y - r, opacity: 0.5, selectable: false, evented: false });
          } else if (toolRef.current === 'electricalBox') {
            const supportShape = config?.customProps?.supportShape;
            const text = config?.defaultText || 'JB';
            const parts: fabric.Object[] = [];
            if (supportShape === 'trapeze') {
              parts.push(new fabric.Rect({ left: 0, top: 0, width: previewW, height: previewH, fill: 'rgba(255,255,255,0.7)', stroke: color, strokeWidth: sw }));
              const dotR = Math.max(1.5, Math.min(previewH * 0.15, previewW * 0.04));
              const margin = previewW * 0.12;
              parts.push(new fabric.Circle({ left: margin - dotR, top: previewH / 2 - dotR, radius: dotR, fill: color, stroke: 'transparent' }));
              parts.push(new fabric.Circle({ left: previewW - margin - dotR, top: previewH / 2 - dotR, radius: dotR, fill: color, stroke: 'transparent' }));
            } else if (supportShape === 'unistrut') {
              // Simple rectangle
              parts.push(new fabric.Rect({ left: 0, top: 0, width: previewW, height: previewH, fill: 'rgba(255,255,255,0.7)', stroke: color, strokeWidth: sw }));
            } else if (supportShape === 'hanger') {
              // Circle with center dot
              const r = Math.min(previewW, previewH) / 2;
              parts.push(new fabric.Circle({ left: previewW / 2 - r, top: previewH / 2 - r, radius: r, fill: 'rgba(255,255,255,0.7)', stroke: color, strokeWidth: sw }));
              const dotR = r * 0.3;
              parts.push(new fabric.Circle({ left: previewW / 2 - dotR, top: previewH / 2 - dotR, radius: dotR, fill: color, stroke: 'transparent' }));
            } else {
              parts.push(new fabric.Rect({ left: 0, top: 0, width: previewW, height: previewH, fill: 'rgba(255,255,255,0.7)', stroke: color, strokeWidth: sw }));
            }
            // Text: hanger = none, trapeze/unistrut = above, standard = inside
            if (supportShape !== 'hanger') {
              const labelFontSize = supportShape ? Math.min(previewW, previewH) * 0.3 : Math.min(previewW, previewH) * 0.5;
              if (supportShape === 'trapeze' || supportShape === 'unistrut') {
                parts.push(new fabric.Text(text, { left: previewW / 2, top: -labelFontSize - 1, fontSize: labelFontSize, originX: 'center', originY: 'top', fill: color, fontFamily: 'Arial', fontWeight: 'bold' }));
              } else {
                parts.push(new fabric.Text(text, { left: previewW / 2, top: previewH / 2, fontSize: labelFontSize, originX: 'center', originY: 'center', fill: color, fontFamily: 'Arial', fontWeight: 'bold' }));
              }
            }
            preview = new fabric.Group(parts, { left: pointer.x - previewW / 2, top: pointer.y - previewH / 2, opacity: 0.5, selectable: false, evented: false });
          } else {
            // panel preview
            const text = config?.defaultText || 'PANEL';
            const outer = new fabric.Rect({ left: 0, top: 0, width: previewW, height: previewH, fill: 'rgba(255,255,255,0.7)', stroke: color, strokeWidth: sw * 1.5 });
            const inner = new fabric.Rect({ left: 3, top: 3, width: previewW - 6, height: previewH - 6, fill: 'transparent', stroke: color, strokeWidth: sw * 0.6 });
            const divLine = new fabric.Line([0, previewH * 0.33, previewW, previewH * 0.33], { stroke: color, strokeWidth: sw * 0.4 });
            const label = new fabric.Text(text, { left: previewW / 2, top: previewH * 0.65, fontSize: Math.min(previewW, previewH) * 0.3, originX: 'center', originY: 'center', fill: color, fontFamily: 'Arial', fontWeight: 'bold' });
            preview = new fabric.Group([outer, inner, divLine, label], { left: pointer.x - previewW / 2, top: pointer.y - previewH / 2, opacity: 0.5, selectable: false, evented: false });
          }
          // Sticky Note preview — yellow square 100x100
          if (toolRef.current === 'stickyNote' && !preview) {
            const config = electricalConfigRef.current;
            const noteColor = config?.customProps?.fill || '#FFEB3B';
            const stickySize = 100 * scaleRef.current;
            preview = new fabric.Rect({
              left: pointer.x - stickySize / 2, top: pointer.y - stickySize / 2,
              width: stickySize, height: stickySize,
              fill: noteColor, stroke: 'rgba(0,0,0,0.15)', strokeWidth: 1,
              opacity: 0.7, selectable: false, evented: false,
              rx: 4, ry: 4,
              shadow: new (fabric as any).Shadow({ color: 'rgba(0,0,0,0.2)', blur: 8, offsetX: 2, offsetY: 3 }),
            });
          }
          // Disable caching for preview — it moves every frame
          preview.set({ objectCaching: false });
          if (preview.getObjects) preview.getObjects().forEach((o: any) => o.set({ objectCaching: false }));
          cursorPreviewRef.current = preview;
          canvas.add(preview);
          canvas.requestRenderAll();
          return;
        }

        // Polyline preview — independent of isDrawing
        if ((toolRef.current === "polyline" || toolRef.current === "routeTemplate") && polylinePoints.current.length > 0 && polylinePreviewLine.current) {
          const pointer = canvas.getPointer(opt.e);
          // Shift-snap to 0°/45°/90° angles
          if ((opt.e as MouseEvent).shiftKey && polylinePoints.current.length > 0) {
            const last = polylinePoints.current[polylinePoints.current.length - 1];
            const adx = pointer.x - last.x, ady = pointer.y - last.y;
            const angle = Math.atan2(ady, adx);
            const dist = Math.sqrt(adx * adx + ady * ady);
            const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            pointer.x = last.x + dist * Math.cos(snapped);
            pointer.y = last.y + dist * Math.sin(snapped);
          }
          polylinePreviewLine.current.set({ x2: pointer.x, y2: pointer.y });
          // Calculate total drawn length + current preview segment
          const pts = polylinePoints.current;
          let totalPx = 0;
          for (let i = 1; i < pts.length; i++) {
            const ddx = pts[i].x - pts[i-1].x, ddy = pts[i].y - pts[i-1].y;
            totalPx += Math.sqrt(ddx*ddx + ddy*ddy);
          }
          const pdx = pointer.x - pts[pts.length-1].x, pdy = pointer.y - pts[pts.length-1].y;
          totalPx += Math.sqrt(pdx*pdx + pdy*pdy);
          const { text: lenText } = formatMeasurement(totalPx / scaleRef.current, docScaleRef.current);
          polylineLengthLabel.current?.set({ text: lenText, left: pointer.x, top: pointer.y - 15 * uiScaleRef.current });
          canvas.requestRenderAll();
          return;
        }

        // Rect-based highlighter preview
        if (toolRef.current === "highlighter" && isDrawingHighlightRef.current && highlightPreviewRectRef.current && startPos.current) {
          const pointer2 = canvas.getPointer(opt.e);
          const { x: sx, y: sy } = startPos.current;
          highlightPreviewRectRef.current.set({
            left: Math.min(sx, pointer2.x),
            top: Math.min(sy, pointer2.y),
            width: Math.abs(pointer2.x - sx),
            height: Math.abs(pointer2.y - sy),
          });
          canvas.requestRenderAll();
          return;
        }
        if (!isDrawing.current || !currentObject.current || !startPos.current)
          return;
        const e = opt.e as MouseEvent;
        let pointer = canvas.getPointer(e);
        const dx = pointer.x - startPos.current.x,
          dy = pointer.y - startPos.current.y;
        if (e.shiftKey) {
          if (["line", "arrow", "measure"].includes(toolRef.current)) {
            const angle = Math.atan2(dy, dx),
              dist = Math.sqrt(dx * dx + dy * dy),
              snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            pointer.x = startPos.current.x + dist * Math.cos(snapped);
            pointer.y = startPos.current.y + dist * Math.sin(snapped);
          } else if (
            [
              "rect",
              "circle",
              "ellipse",
              "triangle",
              "diamond",
              "hexagon",
              "star",
              "cloud",
              "callout",
            ].includes(toolRef.current)
          ) {
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            pointer.x = startPos.current.x + (dx >= 0 ? side : -side);
            pointer.y = startPos.current.y + (dy >= 0 ? side : -side);
          }
        }
        if (toolRef.current === "measure") {
          (currentObject.current as fabric.Line).set({
            x2: pointer.x,
            y2: pointer.y,
          });
          if (measureLabel.current && startPos.current) {
            const dx = pointer.x - startPos.current.x,
              dy = pointer.y - startPos.current.y;
            const distPoints = Math.sqrt(dx * dx + dy * dy) / scaleRef.current;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            let textAngle = angle;
            if (textAngle > 90 || textAngle < -90) textAngle -= 180;
            const { text } = formatMeasurement(distPoints, docScaleRef.current);
            const midX = (startPos.current.x + pointer.x) / 2;
            const midY = (startPos.current.y + pointer.y) / 2;
            // Scale-adaptive label: place above line if too short
            const distPx = Math.sqrt(dx * dx + dy * dy);
            const lblWidth = text.length * 8 * uiScaleRef.current;
            const labelOnLine = distPx > lblWidth * 1.5;
            measureLabel.current.set({
              text,
              left: midX,
              top: labelOnLine ? midY : midY - 18 * uiScaleRef.current,
              angle: labelOnLine ? textAngle : 0,
              originY: labelOnLine ? 'bottom' : 'bottom',
            });

            if (measureTicks.current.length === 2 && distPoints > 0.1) {
              const len = Math.sqrt(dx * dx + dy * dy),
                ux = dx / len,
                uy = dy / len,
                nx = -uy,
                ny = ux,
                tL = 6 * uiScaleRef.current,
                eL = 3 * uiScaleRef.current;
              measureTicks.current[0].set({
                x1: startPos.current.x - nx * tL,
                y1: startPos.current.y - ny * tL,
                x2: startPos.current.x + nx * tL,
                y2: startPos.current.y + ny * tL,
              });
              measureTicks.current[1].set({
                x1: pointer.x - nx * tL,
                y1: pointer.y - ny * tL,
                x2: pointer.x + nx * tL,
                y2: pointer.y + ny * tL,
              });
              // Update extension lines
              if (measureExtensions.current.length === 2) {
                measureExtensions.current[0].set({
                  x1: startPos.current.x,
                  y1: startPos.current.y,
                  x2: startPos.current.x - ux * eL,
                  y2: startPos.current.y - uy * eL,
                });
                measureExtensions.current[1].set({
                  x1: pointer.x,
                  y1: pointer.y,
                  x2: pointer.x + ux * eL,
                  y2: pointer.y + uy * eL,
                });
              }
            }
          }
        } else if (toolRef.current === "circle") {
          const radius =
            Math.sqrt(
              Math.pow(pointer.x - startPos.current.x, 2) +
                Math.pow(pointer.y - startPos.current.y, 2),
            ) / 2;
          (currentObject.current as fabric.Circle).set({
            radius,
            left: Math.min(startPos.current.x, pointer.x),
            top: Math.min(startPos.current.y, pointer.y),
          });
        } else if (toolRef.current === "ellipse") {
          (currentObject.current as fabric.Ellipse).set({
            rx: Math.abs(dx) / 2,
            ry: Math.abs(dy) / 2,
            left: Math.min(startPos.current.x, pointer.x),
            top: Math.min(startPos.current.y, pointer.y),
          });
        } else if (toolRef.current === "triangle") {
          const pw = Math.abs(dx), ph = Math.abs(dy);
          const tcx = Math.min(startPos.current.x, pointer.x) + pw / 2;
          const tcy = Math.min(startPos.current.y, pointer.y) + ph / 2;
          canvas.remove(currentObject.current);
          const newTri = new fabric.Polygon(
            trianglePoints(tcx, tcy, pw, ph).map((p) => new fabric.Point(p.x, p.y)),
            {
              fill: "transparent",
              stroke: colorRef.current,
              strokeWidth: widthRef.current,
              strokeDashArray: getDashArray(lineStyleRef.current),
              selectable: false,
              left: Math.min(startPos.current.x, pointer.x),
              top: Math.min(startPos.current.y, pointer.y),
            },
          );
          canvas.add(newTri);
          currentObject.current = newTri;
        } else if (["diamond", "hexagon", "star"].includes(toolRef.current)) {
          const pw = Math.abs(dx),
            ph = Math.abs(dy);
          const cx = Math.min(startPos.current.x, pointer.x) + pw / 2;
          const cy = Math.min(startPos.current.y, pointer.y) + ph / 2;
          let pts: any[] = diamondPoints(cx, cy, pw, ph);
          if (toolRef.current === "hexagon")
            pts = hexagonPoints(cx, cy, pw, ph);
          else if (toolRef.current === "star") pts = starPoints(cx, cy, pw, ph);
          // Re-create polygon for correct dimension update
          canvas.remove(currentObject.current);
          const newPoly = new fabric.Polygon(
            pts.map((p) => new fabric.Point(p.x, p.y)),
            {
              fill: "transparent",
              stroke: colorRef.current,
              strokeWidth: widthRef.current,
              strokeDashArray: getDashArray(lineStyleRef.current),
              selectable: false,
              left: Math.min(startPos.current.x, pointer.x),
              top: Math.min(startPos.current.y, pointer.y),
            },
          );
          canvas.add(newPoly);
          currentObject.current = newPoly;
        } else if (
          ["rect", "cloud", "callout", "text"].includes(toolRef.current)
        ) {
          currentObject.current.set({
            left: Math.min(startPos.current.x, pointer.x),
            top: Math.min(startPos.current.y, pointer.y),
            width: Math.abs(pointer.x - startPos.current.x),
            height: Math.abs(pointer.y - startPos.current.y),
          });
        } else if (["line", "arrow"].includes(toolRef.current)) {
          (currentObject.current as fabric.Line).set({
            x2: pointer.x,
            y2: pointer.y,
          });
        }
        canvas.requestRenderAll();
      });

      canvas.on("mouse:up", () => {
        // Rect-based highlighter finalization
        if (toolRef.current === "highlighter" && isDrawingHighlightRef.current) {
          isDrawingHighlightRef.current = false;
          const rect = highlightPreviewRectRef.current;
          highlightPreviewRectRef.current = null;
          if (rect) canvas.remove(rect);
          const rLeft = rect?.left ?? 0;
          const rTop = rect?.top ?? 0;
          const rW = rect?.width ?? 0;
          const rH = rect?.height ?? 0;
          const w = canvas.getWidth(), h = canvas.getHeight();
          if (rW >= 3 && rH >= 3) {
            onMarkupAddedRef.current?.({
              type: 'highlighter',
              pageNumber: pageNumberRef.current,
              coordinates: { left: rLeft / w, top: rTop / h, width: rW / w, height: rH / h },
              properties: { stroke: colorRef.current, strokeWidth: widthRef.current || 12, originalWidth: w, originalHeight: h },
            });
          }
          startPos.current = null;
          canvas.requestRenderAll();
          return;
        }
        if (
          toolRef.current === "measure" &&
          isDrawing.current &&
          currentObject.current
        ) {
          isDrawing.current = false;
          const line = currentObject.current as fabric.Line,
            w = canvas.getWidth(),
            h = canvas.getHeight();
          onMarkupAddedRef.current?.({
            type: "measure",
            pageNumber: pageNumberRef.current,
            coordinates: {
              x1: line.x1! / w,
              y1: line.y1! / h,
              x2: line.x2! / w,
              y2: line.y2! / h,
            },
            properties: {
              stroke: colorRef.current,
              strokeWidth: widthRef.current,
              lineStyle: "solid",
            },
          });
          canvas.remove(currentObject.current);
          if (measureLabel.current) canvas.remove(measureLabel.current);
          measureTicks.current.forEach((t) => canvas.remove(t));
          measureExtensions.current.forEach((t) => canvas.remove(t));
          currentObject.current = null;
          measureLabel.current = null;
          measureTicks.current = [];
          measureExtensions.current = [];
          startPos.current = null;
          return;
        }
        if (!isDrawing.current) return;

        isDrawing.current = false;
        if (currentObject.current) {
          const obj = currentObject.current,
            w = canvas.getWidth(),
            h = canvas.getHeight();
          let coords: any = {};
          if (
            [
              "rect",
              "circle",
              "ellipse",
              "triangle",
              "diamond",
              "hexagon",
              "star",
              "cloud",
              "callout",
              "text",
            ].includes(toolRef.current)
          ) {
            // Use getBoundingRect for Polygons (diamond/hexagon/star) since they don't have width/height directly
            let ow: number, oh: number, left: number, top: number;
            if (
              ["diamond", "hexagon", "star", "triangle"].includes(
                toolRef.current,
              )
            ) {
              obj.setCoords(); // ensure bounding rect reflects latest set() calls
              const br = obj.getBoundingRect(true);
              ow = br.width;
              oh = br.height;
              left = br.left;
              top = br.top;
            } else {
              ow = (obj.width || 0) * (obj.scaleX || 1);
              oh = (obj.height || 0) * (obj.scaleY || 1);
              left = obj.left || 0;
              top = obj.top || 0;
            }
            if (ow < 5 && oh < 5) {
              canvas.remove(obj);
              currentObject.current = null;
              startPos.current = null;
              return;
            }
            if (toolRef.current === 'callout') {
              const tbLeft = Math.min((left + ow) / w + 0.02, 0.85);
              const tbWidth = Math.min(0.18, 0.93 - tbLeft);
              coords = {
                cloud: { left: left / w, top: top / h, width: ow / w, height: oh / h },
                textBox: { left: tbLeft, top: top / h, width: Math.max(0.06, tbWidth), height: Math.max(oh / h, 0.07) },
              };
            } else {
              coords = {
                left: left / w,
                top: top / h,
                width: ow / w,
                height: oh / h,
              };
            }
          } else if (["line", "arrow"].includes(toolRef.current)) {
            const line = obj as fabric.Line;
            coords = {
              x1: line.x1! / w,
              y1: line.y1! / h,
              x2: line.x2! / w,
              y2: line.y2! / h,
            };
          }
          // Pre-register the drawn object in cache with a new ID to avoid flash.
          // EXCEPT for types rendered as Groups (arrow, measure, polyline, reviewStamp, etc.) —
          // the drawing object is a simple Line/Rect, but renderMarkup creates a Group.
          // Keeping the simple object in cache causes syncMarkups to remove+recreate it as a Group,
          // which Fabric.js v5 positions at the wrong visual location.
          // Fix: remove drawing object from canvas for Group types; syncMarkups creates the proper Group.
          const pendingId = crypto.randomUUID();
          const GROUP_TYPES = ['arrow', 'measure', 'polyline', 'routeTemplate', 'route', 'reviewStamp', 'electricalBox', 'stub', 'panel', 'wireTag'];
          const isGroupType = GROUP_TYPES.includes(toolRef.current);
          (obj as any).data = { ...(obj as any).data, id: pendingId, type: toolRef.current, _justCreated: true, sessionId: activeSessionIdRef.current };
          if (isGroupType) {
            // Remove the simple drawing object — syncMarkups will create the proper Group
            canvas.remove(obj);
          } else {
            objectCache.current.set(pendingId, obj);
          }
          // Make selectable (select tool will be active after drawing)
          obj.set({ selectable: true, evented: true });
          currentObject.current = null;
          onMarkupAddedRef.current?.({
            id: pendingId,
            type: toolRef.current,
            pageNumber: pageNumberRef.current,
            coordinates: coords,
            properties: {
              stroke:
                toolRef.current === "text" ? "transparent" : colorRef.current,
              strokeWidth: toolRef.current === "text" ? 0 : widthRef.current,
              lineStyle: lineStyleRef.current,
              ...(toolRef.current === "text"
                ? {
                    fontSize: Math.max(
                      12,
                      Math.floor(
                        Math.min(
                          obj.width! * (obj.scaleX || 1),
                          obj.height! * (obj.scaleY || 1),
                        ) * 0.5,
                      ) / scaleRef.current,
                    ),
                  }
                : {}),
              ...(toolRef.current === 'callout' ? {
                text: '',
                textColor: '#000000',
                fontSize: 14,
                textBoxFill: '#ffffff',
                textBoxStroke: colorRef.current,
              } : {}),
            },
          });
          // Auto-switch to select after drawing callout/cloud; for callout also queue auto-edit
          if (toolRef.current === 'callout') {
            pendingCalloutEditRef.current = pendingId;
            setTimeout(() => onSwitchToSelectRef.current?.(), 50);
          }
          if (toolRef.current === 'cloud') {
            setTimeout(() => onSwitchToSelectRef.current?.(), 50);
          }
        }
        startPos.current = null;
      });

      // ─── Polyline: dblclick finalizes ───
      const cleanupPolylineDrawing = () => {
        polylineLines.current.forEach(l => canvas.remove(l));
        if (polylinePreviewLine.current) canvas.remove(polylinePreviewLine.current);
        if (polylineLengthLabel.current) canvas.remove(polylineLengthLabel.current);
        polylinePoints.current = [];
        polylineLines.current = [];
        polylinePreviewLine.current = null;
        polylineLengthLabel.current = null;
        canvas.requestRenderAll();
      };

      const finalizePolyline = () => {
        const pts = polylinePoints.current;
        if (pts.length < 2) { cleanupPolylineDrawing(); return; }
        const w = canvas.getWidth(), h = canvas.getHeight();
        const s = scaleRef.current;
        const normalizedPoints = pts.map(p => ({ x: p.x / w, y: p.y / h }));
        // Compute path length in PDF points (scale-independent)
        let pathLength = 0;
        for (let i = 1; i < pts.length; i++) {
          const dx = (pts[i].x - pts[i-1].x) / s, dy = (pts[i].y - pts[i-1].y) / s;
          pathLength += Math.sqrt(dx*dx + dy*dy);
        }
        const isRouteTemplate = toolRef.current === "routeTemplate";
        onMarkupAddedRef.current?.({
          type: isRouteTemplate ? "routeTemplate" : "polyline",
          pageNumber: pageNumberRef.current,
          coordinates: { points: normalizedPoints },
          properties: isRouteTemplate ? {
            stroke: '#9e9e9e',
            strokeWidth: 1,
            lineStyle: 'dashed',
            showLength: false,
            subject: `Route Template ${Date.now().toString(36).slice(-4).toUpperCase()}`,
            pathLength,
          } : {
            stroke: colorRef.current,
            strokeWidth: widthRef.current,
            lineStyle: lineStyleRef.current,
            pathLength,
          },
        });
        cleanupPolylineDrawing();
      };

      // ─── Vertex edit mode helpers ───
      const exitVertexEdit = (save: boolean) => {
        vertexTempObjs.current.forEach(o => canvas.remove(o));
        vertexHandles.current.forEach(c => canvas.remove(c));
        vertexTempObjs.current = [];
        vertexHandles.current = [];
        const markupId = vertexEditMarkupId.current;
        vertexEditMarkupId.current = null;  // clear BEFORE calling callbacks
        if (markupId) {
          const grp = objectCache.current.get(markupId);
          if (grp) grp.set({ selectable: true, evented: true });
          if (save && vertexPoints.current.length >= 2) {
            const w = canvas.getWidth(), h = canvas.getHeight(), s = scaleRef.current;
            const normalizedPoints = vertexPoints.current.map(p => ({ x: p.x / w, y: p.y / h }));
            let pathLength = 0;
            for (let i = 1; i < vertexPoints.current.length; i++) {
              const dx = (vertexPoints.current[i].x - vertexPoints.current[i-1].x) / s;
              const dy = (vertexPoints.current[i].y - vertexPoints.current[i-1].y) / s;
              pathLength += Math.sqrt(dx*dx + dy*dy);
            }
            onMarkupModifiedRef.current?.({ id: markupId, type: 'polyline', coordinates: { points: normalizedPoints }, properties: { pathLength } });
          }
        }
        vertexMarkupDataRef.current = null;
        vertexPoints.current = [];
        setVertexMenu(null);
        canvas.requestRenderAll();
      };
      vertexExitFnRef.current = exitVertexEdit;

      const enterVertexEdit = (grp: any, markup: any) => {
        if (vertexEditMarkupId.current) exitVertexEdit(true);
        const w = canvas.getWidth(), h = canvas.getHeight();
        const pts: { x: number; y: number }[] = (markup.coordinates?.points || []).map((p: any) => ({ x: p.x * w, y: p.y * h }));
        if (pts.length < 2) return;
        // Discard active selection BEFORE setting vertexEditMarkupId so that
        // the selection:cleared event fires while id is still null and doesn't
        // call exitVertexEdit prematurely.
        canvas.discardActiveObject();
        vertexEditMarkupId.current = markup.id;
        vertexMarkupDataRef.current = markup;
        vertexPoints.current = pts.map(p => ({ ...p }));
        // Keep group fully visible — no opacity change, no temp line overlay.
        // Just make it non-interactive so handles are the only interaction targets.
        grp.set({ selectable: false, evented: false });
        // Vertex handle circles only — group already shows the polyline correctly
        pts.forEach((pt, i) => {
          const circle = new fabric.Circle({
            left: pt.x, top: pt.y,
            radius: 10 * uiScaleRef.current, fill: 'white', stroke: '#2196F3',
            strokeWidth: 2.5 * uiScaleRef.current,
            originX: 'center', originY: 'center',
            selectable: true, evented: true, hasBorders: false, hasControls: false,
            lockRotation: true,
            data: { isVertexHandle: true, handleIndex: i, markupId: markup.id },
          });
          vertexHandles.current.push(circle);
          canvas.add(circle);
        });
        canvas.requestRenderAll();
      };

      // ── HTML text editing overlay (replaces Fabric.js enterEditing to avoid black screen) ──
      // Fabric.js enterEditing() + CSS transform: scale() on the parent causes the canvas
      // to render as a black rectangle. This helper creates a plain HTML <textarea> positioned
      // over the Fabric object, completely bypassing Fabric's editing pipeline.
      const startHtmlTextEdit = (opts: {
        markupId: string;
        currentText: string;
        left: number; top: number; width: number; height: number;
        angle?: number;
        fontSize: number;
        fontFamily?: string;
        fontWeight?: string;
        fontStyle?: string;
        textAlign?: string;
        color: string;
        backgroundColor?: string;
        padding?: number;
        hideObjs?: fabric.Object[];
        onSave: (newText: string, finalWidth?: number, finalHeight?: number) => void;
      }) => {
        const container = canvas.getElement().parentElement;
        if (!container) return;

        textEditingMarkupId.current = opts.markupId;
        canvas.discardActiveObject();

        // Dim hidden objects so user sees the textarea on top
        const origOpacities = (opts.hideObjs || []).map(o => o.opacity);
        (opts.hideObjs || []).forEach(o => o.set({ opacity: 0.15 }));
        canvas.requestRenderAll();

        const ta = document.createElement('textarea');
        ta.value = opts.currentText;
        ta.setAttribute('data-markup-edit', opts.markupId);
        Object.assign(ta.style, {
          position: 'absolute',
          left: opts.left + 'px',
          top: opts.top + 'px',
          width: opts.width + 'px',
          minHeight: opts.height + 'px',
          fontSize: opts.fontSize + 'px',
          fontFamily: opts.fontFamily || 'Arial',
          fontWeight: opts.fontWeight || 'normal',
          fontStyle: opts.fontStyle || 'normal',
          textAlign: opts.textAlign || 'left',
          color: opts.color,
          backgroundColor: opts.backgroundColor || 'rgba(255,255,200,0.95)',
          border: '2px solid #1565c0',
          borderRadius: '3px',
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          zIndex: '9999',
          padding: (opts.padding ?? 4) + 'px',
          boxSizing: 'border-box',
          lineHeight: '1.16',
          transform: opts.angle ? `rotate(${opts.angle}deg)` : 'none',
          transformOrigin: 'top left',
        });

        container.appendChild(ta);
        ta.focus();
        ta.select();

        // Auto-resize height as user types
        const autoResize = () => {
          ta.style.height = 'auto';
          ta.style.height = Math.max(opts.height, ta.scrollHeight) + 'px';
        };
        ta.addEventListener('input', autoResize);
        requestAnimationFrame(autoResize);

        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          const newText = ta.value;
          // Capture final textarea dimensions BEFORE removing from DOM
          const finalWidth = ta.offsetWidth;
          const finalHeight = ta.offsetHeight;
          if (container.contains(ta)) container.removeChild(ta);
          // CRITICAL: save BEFORE clearing textEditingMarkupId — otherwise syncMarkups
          // runs between clear and save, recreating the object with OLD text.
          const textChanged = newText !== opts.currentText;
          const sizeChanged = finalHeight > opts.height + 2 || finalWidth > opts.width + 2;
          if (textChanged || sizeChanged) {
            opts.onSave(newText, finalWidth, finalHeight);
          }
          // Now safe to clear guard and restore visuals
          (opts.hideObjs || []).forEach((o, i) => o.set({ opacity: origOpacities[i] ?? 1 }));
          textEditingMarkupId.current = null;
          canvas.requestRenderAll();
        };

        ta.addEventListener('blur', finish);
        ta.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            ta.value = opts.currentText; // revert on Escape
            ta.blur();
          }
          e.stopPropagation(); // prevent canvas keyboard shortcuts during editing
        });
      };
      // Expose to syncMarkups via ref (different scope)
      startHtmlTextEditRef.current = startHtmlTextEdit;

      canvas.on("mouse:dblclick", (opt: any) => {
        // Polyline / Route Template drawing finalize
        if ((toolRef.current === "polyline" || toolRef.current === "routeTemplate") && polylinePoints.current.length >= 1) {
          // The dblclick fires after mouse:down already added the last point; remove it
          if (polylineLines.current.length > 0) {
            const lastSeg = polylineLines.current.pop();
            if (lastSeg) canvas.remove(lastSeg);
            polylinePoints.current.pop();
          }
          finalizePolyline();
          return;
        }
        if (toolRef.current === "select") {
          const target = canvas.findTarget(opt.e, false) as any;
          const markupId = target?.data?.id;

          // Callout: double-click → edit text via HTML overlay (avoids Fabric black screen)
          if (target?.data?.type === "callout" && markupId) {
            if (target.data?.canEdit === false) return;
            const textboxObj = calloutTailCache.current.get(markupId) as any;
            if (textboxObj && textboxObj.data?.part === 'textbox') {
              const tbW = (textboxObj.width || 100) * (textboxObj.scaleX || 1);
              const tbH = (textboxObj as any).height || 50;
              const bgObj = calloutTextboxBgCache.current.get(markupId);
              const hideList: fabric.Object[] = [textboxObj];
              if (bgObj) hideList.push(bgObj);
              startHtmlTextEdit({
                markupId,
                currentText: textboxObj.text || '',
                left: textboxObj.left || 0,
                top: textboxObj.top || 0,
                width: tbW,
                height: tbH,
                fontSize: (textboxObj as any).fontSize || 14,
                fontFamily: (textboxObj as any).fontFamily || 'Arial',
                fontWeight: (textboxObj as any).fontWeight || 'normal',
                fontStyle: (textboxObj as any).fontStyle || 'normal',
                textAlign: (textboxObj as any).textAlign || 'left',
                color: (textboxObj as any).fill || '#000',
                backgroundColor: 'rgba(255,255,255,0.95)',
                hideObjs: hideList,
                onSave: (newText) => {
                  const w = canvas.getWidth(), h = canvas.getHeight();
                  const existing = markupsRef.current?.find((m: any) => m.id === markupId);
                  const existingCloud = existing?.coordinates?.cloud;
                  const textBoxCoords = { left: (textboxObj.left || 0) / w, top: (textboxObj.top || 0) / h, width: tbW / w, height: tbH / h };
                  onMarkupModifiedRef.current?.({
                    id: markupId, type: 'callout',
                    coordinates: { cloud: existingCloud || {}, textBox: textBoxCoords },
                    properties: { text: newText },
                  });
                },
              });
              return;
            }
          }

          // Polyline / Route types: enter vertex edit
          if (target?.data?.type === "polyline" || target?.data?.type === "routeTemplate" || target?.data?.type === "route") {
            if (target.data?.canEdit === false) return;
            const markup = markupsRef.current.find((m: any) => m.id === markupId);
            if (markup) enterVertexEdit(target, markup);
          }

          // Plain text / sticky note: double-click → edit text via HTML overlay
          if ((target?.data?.type === 'text' || target?.data?.type === 'stickyNote') && markupId) {
            if (target.data?.canEdit === false) return;
            const isStickyNote = target.data.type === 'stickyNote';
            const tW = (target.width || 100) * (target.scaleX || 1);
            const tH = ((target as any).height || 50) * (target.scaleY || 1);
            const hideList: fabric.Object[] = [target];
            // Also hide text border rect if present
            const borderObj = textBorderCache.current.get(markupId);
            if (borderObj) hideList.push(borderObj);
            startHtmlTextEdit({
              markupId,
              currentText: (target as any).text || '',
              left: target.left || 0,
              top: target.top || 0,
              width: tW,
              height: tH,
              angle: target.angle || 0,
              fontSize: (target as any).fontSize || 14,
              fontFamily: (target as any).fontFamily || 'Arial',
              fontWeight: (target as any).fontWeight || 'normal',
              fontStyle: (target as any).fontStyle || 'normal',
              textAlign: (target as any).textAlign || 'left',
              color: (target as any).fill || '#000',
              backgroundColor: isStickyNote
                ? ((target as any).backgroundColor || '#FFEB3B')
                : ((target as any).backgroundColor || 'rgba(255,255,255,0.9)'),
              padding: isStickyNote ? Math.round(10 * scaleRef.current) : 4,
              hideObjs: hideList,
              onSave: (newText) => {
                const w = canvas.getWidth(), h = canvas.getHeight();
                // Update Fabric object text directly so it renders correctly
                // BEFORE syncMarkups processes the update
                (target as any).set({ text: newText });
                target.setCoords();
                const coords: any = {
                  left: (target.left || 0) / w,
                  top: (target.top || 0) / h,
                  angle: target.angle || 0,
                  width: ((target.width || 100) * (target.scaleX || 1)) / w,
                  height: ((target as any).height || 50) / h,
                };
                onMarkupModifiedRef.current?.({
                  id: markupId,
                  type: target.data.type,
                  coordinates: coords,
                  properties: { text: newText },
                });
              },
            });
            return;
          }

          // Electrical/Review types: double-click to edit text inline via HTML overlay
          const activeObj = canvas.getActiveObject() as any;
          const activeId = activeObj?.data?.id;
          const activeType = activeObj?.data?.type;

          if (['electricalBox', 'stub', 'panel', 'wireTag', 'reviewStamp'].includes(activeType) && activeId) {
            if (activeObj.data?.canEdit === false) return;
            const markup = markupsRef.current.find((m: any) => m.id === activeId);
            if (markup) {
              const currentText = markup.properties?.text || '';
              const ow = (activeObj.width || 0) * (activeObj.scaleX || 1);
              const oh = (activeObj.height || 0) * (activeObj.scaleY || 1);
              const hideList: fabric.Object[] = [activeObj];
              const auxLbl = auxLabelCache.current.get(activeId);
              if (auxLbl) hideList.push(auxLbl);
              startHtmlTextEdit({
                markupId: activeId,
                currentText,
                left: activeObj.left || 0,
                top: activeObj.top || 0,
                width: Math.max(60, ow),
                height: Math.max(30, oh),
                angle: activeObj.angle || 0,
                fontSize: Math.max(10, Math.min(ow, oh) * 0.4),
                fontFamily: 'Arial',
                fontWeight: 'bold',
                textAlign: 'center',
                color: '#000',
                backgroundColor: 'rgba(255,255,200,0.95)',
                hideObjs: hideList,
                onSave: (newText) => {
                  onMarkupModifiedRef.current?.({
                    id: activeId,
                    type: markup.type,
                    coordinates: markup.coordinates,
                    properties: { ...markup.properties, text: newText },
                  });
                },
              });
            }
          }
        }
      });

      canvas.on("path:created", (opt: any) => {
        if (toolRef.current !== "pen") return;
        const p = opt.path,
          w = canvas.getWidth(),
          h = canvas.getHeight();
        // Normalize stroke color — highlighter may have opacity appended
        const rawStroke = (p.stroke || colorRef.current).replace(/80$/, "");
        onMarkupAddedRef.current?.({
          type: toolRef.current,
          pageNumber: pageNumberRef.current,
          coordinates: {
            left: p.left / w,
            top: p.top / h,
            width: (p.width * p.scaleX) / w,
            height: (p.height * p.scaleY) / h,
            path: p.path,
          },
          properties: {
            stroke: rawStroke,
            strokeWidth: p.strokeWidth,
            lineStyle: lineStyleRef.current,
            originalWidth: w,
            originalHeight: h,
          },
        });
        canvas.remove(p);
        });

        canvas.on('object:moving', (opt: any) => {
        const obj = opt.target;
        // Vertex handle dragging — rebuild the polyline group in-place so the
        // user sees the line update live without any opacity or color change.
        if (obj?.data?.isVertexHandle) {
          const idx = obj.data.handleIndex;
          if (idx >= 0 && idx < vertexPoints.current.length) {
            vertexPoints.current[idx] = { x: obj.left, y: obj.top };
            const markupId = vertexEditMarkupId.current;
            const existingGrp = markupId ? objectCache.current.get(markupId) : null;
            if (existingGrp && vertexMarkupDataRef.current) {
              const pts = vertexPoints.current;
              const mprops = vertexMarkupDataRef.current.properties || {};
              const stroke = mprops.stroke || '#ff0000';
              const sw = (mprops.strokeWidth || 2) * scaleRef.current;
              const dash = getDashArray(mprops.lineStyle || 'solid');
              let totalDist = 0;
              const segs: fabric.Line[] = [];
              for (let i = 1; i < pts.length; i++) {
                const ddx = pts[i].x - pts[i-1].x, ddy = pts[i].y - pts[i-1].y;
                totalDist += Math.sqrt(ddx*ddx + ddy*ddy) / scaleRef.current;
                segs.push(new fabric.Line([pts[i-1].x, pts[i-1].y, pts[i].x, pts[i].y], { stroke, strokeWidth: sw, strokeDashArray: dash }));
              }
              const { text: lt } = formatMeasurement(totalDist, docScaleRef.current);
              const midPt = pts[Math.floor(pts.length / 2)];
              const lbl = new fabric.Text(lt, {
                left: midPt.x, top: midPt.y - 15 * uiScaleRef.current,
                fontSize: 14 * uiScaleRef.current, fill: stroke, fontFamily: 'Arial',
                originX: 'center', originY: 'bottom', selectable: false, evented: false,
                textBackgroundColor: 'rgba(255,255,255,0.7)',
              });
              const zIdx = canvas.getObjects().indexOf(existingGrp);
              canvas.remove(existingGrp);
              const newGrp = new fabric.Group([...segs, lbl], {
                selectable: false, evented: false,
                data: { ...existingGrp.data },
              });
              zIdx >= 0 ? canvas.insertAt(newGrp, zIdx) : canvas.add(newGrp);
              objectCache.current.set(markupId!, newGrp);
              hashCache.current.delete(markupId!);
              tsCache.current.delete(markupId!);
            }
          }
          canvas.requestRenderAll();
          return;
        }
        // Multi-select: lock bypass fix — restore locked object positions each tick
        if (obj?.type === 'activeSelection') {
          const sel = obj as fabric.ActiveSelection;
          // Clamp active selection to page bounds
          const cw = canvas.getWidth(), ch = canvas.getHeight();
          const br = sel.getBoundingRect(false);
          if (br.left < 0) sel.set('left', sel.left! - br.left);
          if (br.top < 0) sel.set('top', sel.top! - br.top);
          if (br.left + br.width > cw) sel.set('left', sel.left! - (br.left + br.width - cw));
          if (br.top + br.height > ch) sel.set('top', sel.top! - (br.top + br.height - ch));
          sel.setCoords();
          // Track selection delta for moving non-selectable callout parts
          const selMatrix = sel.calcTransformMatrix();
          const selCenterX = selMatrix[4], selCenterY = selMatrix[5];
          if (!sel._prevCX) { sel._prevCX = selCenterX; sel._prevCY = selCenterY; }
          const sdx = selCenterX - sel._prevCX;
          const sdy = selCenterY - sel._prevCY;
          sel._prevCX = selCenterX;
          sel._prevCY = selCenterY;

          sel.getObjects().forEach((child: any) => {
            if (!child.data?.id) return;
            const childLocked = !!child.data?.locked;
            const childCanEdit = child.data?.canEdit !== false;
            if (childLocked || !childCanEdit) {
              if (child._lockedLeft !== undefined) {
                child.set({ left: child._lockedLeft, top: child._lockedTop });
                child.setCoords();
              }
              return;
            }
            // Move callout non-selectable parts (bg, connector) with the selection
            if (child.data?.type === 'callout' && (Math.abs(sdx) > 0.01 || Math.abs(sdy) > 0.01)) {
              const mid = child.data.id;
              const bgObj = calloutTextboxBgCache.current.get(mid);
              const lineObj = calloutLineCache.current.get(mid);
              // Only move parts that are NOT in the selection (bg and connector are selectable:false)
              if (bgObj && !sel.contains(bgObj)) {
                bgObj.set({ left: bgObj.left! + sdx, top: bgObj.top! + sdy });
                bgObj.setCoords();
              }
              if (lineObj && !sel.contains(lineObj)) {
                const l = lineObj as fabric.Line;
                l.set({ x1: l.x1! + sdx, y1: l.y1! + sdy, x2: l.x2! + sdx, y2: l.y2! + sdy });
                lineObj.setCoords();
              }
            }
          });
          canvas.requestRenderAll();
          return;
        }

        if (!obj?.data?.id) return;

        // Mark as moving to prevent incoming sync from disrupting the local drag
        obj.isMoving = true;

        // Clamp to page bounds — prevent dragging outside the page
        const cw = canvas.getWidth(), ch = canvas.getHeight();
        const br = obj.getBoundingRect(false);
        if (br.left < 0) obj.set('left', obj.left! - br.left);
        if (br.top < 0) obj.set('top', obj.top! - br.top);
        if (br.left + br.width > cw) obj.set('left', obj.left! - (br.left + br.width - cw));
        if (br.top + br.height > ch) obj.set('top', obj.top! - (br.top + br.height - ch));

        // Snap to grid
        if (snapGrid && snapGrid > 0) {
          const grid = snapGrid * scaleRef.current;
          obj.set({
            left: Math.round(obj.left! / grid) * grid,
            top: Math.round(obj.top! / grid) * grid,
          });
        }
        obj.setCoords();

        // Immediate local render for smoothness — no state updates during drag.
        // Final position is sent in object:modified (mouse up) to avoid mid-drag
        // hash mismatches that cause the object to be removed+recreated (flash).
        canvas.requestRenderAll();

        // Move callout auxiliary parts (connector line, textbox bg) in sync
        const type = obj.data.type;
        if (type === 'callout') {
          const w = canvas.getWidth(), h = canvas.getHeight();
          const part = obj.data?.part;
          const markupId = obj.data.id;
          const cloudObj = objectCache.current.get(markupId);
          const tailObj = calloutTailCache.current.get(markupId);
          const lineObj = calloutLineCache.current.get(markupId);
          const bgObj = calloutTextboxBgCache.current.get(markupId);

          if (part === 'textbox') {
            // Sync bg rect with textbox — bgObj is outer rect, obj is inner (inset by strokeWidth)
            if (bgObj) {
              const sw = bgObj.strokeWidth || 0;
              bgObj.set({ left: obj.left! - sw, top: obj.top! - sw, width: obj.width! * (obj.scaleX || 1) + sw * 2, height: ((obj as any).height || 50) + sw * 2 });
              bgObj.setCoords();
            }
            // Update connector line: start at cloud EDGE, end at textbox center
            if (lineObj && cloudObj) {
              const cd = (cloudObj as any).data || {};
              const cDx = cloudObj.left! - (cd._lastLeft ?? cloudObj.left!);
              const cDy = cloudObj.top! - (cd._lastTop ?? cloudObj.top!);
              const cloudBrLogical = {
                left: (cd._cloudOrigLeft ?? cloudObj.left! - (cloudObj.width||0)/2) + cDx,
                top: (cd._cloudOrigTop ?? cloudObj.top! - (cloudObj.height||0)/2) + cDy,
                width: cd._cloudOrigWidth ?? cloudObj.width! ?? 100,
                height: cd._cloudOrigHeight ?? cloudObj.height! ?? 100,
              };
              const tw = obj.width! * (obj.scaleX || 1), th = (obj as any).height || 50;
              const tbCx = obj.left! + tw / 2, tbCy = obj.top! + th / 2;
              const ep = cloudEdgePoint(cloudBrLogical, tbCx, tbCy);
              (lineObj as fabric.Line).set({ x1: ep.x, y1: ep.y, x2: tbCx, y2: tbCy });
              lineObj.setCoords();
            }

          } else if (part === 'tail') {
            // Legacy tail circle
            if (lineObj && cloudObj) {
              const cd = (cloudObj as any).data || {};
              const cDx = cloudObj.left! - (cd._lastLeft ?? cloudObj.left!);
              const cDy = cloudObj.top! - (cd._lastTop ?? cloudObj.top!);
              const cloudBrLogical = {
                left: (cd._cloudOrigLeft ?? cloudObj.left! - (cloudObj.width||0)/2) + cDx,
                top: (cd._cloudOrigTop ?? cloudObj.top! - (cloudObj.height||0)/2) + cDy,
                width: cd._cloudOrigWidth ?? cloudObj.width! ?? 100,
                height: cd._cloudOrigHeight ?? cloudObj.height! ?? 100,
              };
              const ep = cloudEdgePoint(cloudBrLogical, obj.left!, obj.top!);
              (lineObj as fabric.Line).set({ x1: ep.x, y1: ep.y, x2: obj.left!, y2: obj.top! });
              lineObj.setCoords();
            }
          } else {
            // Cloud is being moved independently — textbox stays in place, connector updates
            const od = obj.data || {};
            const dx2 = obj.left! - (od._lastLeft ?? obj.left!);
            const dy2 = obj.top! - (od._lastTop ?? obj.top!);
            const cloudBrLogical = {
              left: (od._cloudOrigLeft ?? obj.left! - (obj.width||0)/2) + dx2,
              top: (od._cloudOrigTop ?? obj.top! - (obj.height||0)/2) + dy2,
              width: (od._cloudOrigWidth ?? obj.width! ?? 100) * (obj.scaleX || 1),
              height: (od._cloudOrigHeight ?? obj.height! ?? 100) * (obj.scaleY || 1),
            };
            if (lineObj && tailObj) {
              let tx: number, ty: number;
              if ((tailObj as any).data?.part === 'textbox') {
                const tw = tailObj.width! * (tailObj.scaleX || 1), th = (tailObj as any).height || 50;
                tx = tailObj.left! + tw / 2; ty = tailObj.top! + th / 2;
              } else {
                tx = tailObj.left!; ty = tailObj.top!;
              }
              const ep = cloudEdgePoint(cloudBrLogical, tx, ty);
              (lineObj as fabric.Line).set({ x1: ep.x, y1: ep.y, x2: tx, y2: ty });
              lineObj.setCoords();
            }
          }
        } else if (type === "text") {
          // Sync text border rect position during drag (visual only)
          const movingBorder = textBorderCache.current.get(obj.data.id);
          if (movingBorder) {
            movingBorder.set({ left: obj.left, top: obj.top, width: obj.width! * (obj.scaleX || 1), height: obj.height! * (obj.scaleY || 1), angle: obj.angle || 0 });
            movingBorder.setCoords();
          }
        }
        // Update author label position during drag
        if (obj.data?.id && showAuthorOnMarkupRef.current) {
          const movingAuthorLabel = authorLabelCache.current.get(obj.data.id);
          if (movingAuthorLabel) {
            const bounds = obj.getBoundingRect(true);
            movingAuthorLabel.set({ left: bounds.left + bounds.width / 2, top: bounds.top + bounds.height + 2 });
            movingAuthorLabel.setCoords();
          }
        }
        // Move auxLabel (measure/polyline/stamp text) with the object during drag
        if (obj.data?.id) {
          const movingAuxLabel = auxLabelCache.current.get(obj.data.id);
          if (movingAuxLabel) {
            const dragStartL = (obj as any)._dragStartLeft;
            const dragStartT = (obj as any)._dragStartTop;
            if (dragStartL !== undefined) {
              // Initialize label start position on first move tick
              if ((movingAuxLabel as any)._dragStartLeft === undefined) {
                (movingAuxLabel as any)._dragStartLeft = movingAuxLabel.left;
                (movingAuxLabel as any)._dragStartTop = movingAuxLabel.top;
              }
              const adx = obj.left! - dragStartL;
              const ady = obj.top! - dragStartT;
              movingAuxLabel.set({
                left: (movingAuxLabel as any)._dragStartLeft + adx,
                top: (movingAuxLabel as any)._dragStartTop + ady,
              });
              movingAuxLabel.setCoords();
            }
          }
        }
        // NO onMarkupModified call here — position is saved only on mouse UP (object:modified).
        // Sending updates mid-drag would change markup data → trigger sync → hash mismatch → remove+recreate → flash.
      });

      // ── Rotate auxLabel + authorLabel together with the main shape during rotation ──
      canvas.on('object:rotating', (opt: any) => {
        const obj = opt.target;
        if (!obj?.data?.id) return;
        const id = obj.data.id;
        const angle = obj.angle || 0;

        // Rotate auxLabel (stamp/electrical/measure text) to match shape angle
        const rotatingLabel = auxLabelCache.current.get(id);
        if (rotatingLabel) {
          // Reposition label at shape's current visual center + same angle
          const center = obj.getCenterPoint();
          rotatingLabel.set({ left: center.x, top: center.y, angle });
          rotatingLabel.setCoords();
        }
        // Reposition author label around the rotated bounding box
        if (showAuthorOnMarkupRef.current) {
          const rotatingAuthor = authorLabelCache.current.get(id);
          if (rotatingAuthor) {
            const bounds = obj.getBoundingRect(true);
            rotatingAuthor.set({ left: bounds.left + bounds.width / 2, top: bounds.top + bounds.height + 2 });
            rotatingAuthor.setCoords();
          }
        }
        // Rotate text border rect
        const rotatingBorder = textBorderCache.current.get(id);
        if (rotatingBorder) {
          rotatingBorder.set({ angle });
          rotatingBorder.setCoords();
        }
        canvas.requestRenderAll();
      });

      canvas.on("object:modified", (opt: any) => {
        const obj = opt.target;
        // Clear stored lock positions after any drag ends
        if (obj?.type === 'activeSelection') {
          (obj as fabric.ActiveSelection).getObjects().forEach((child: any) => {
            delete child._lockedLeft;
            delete child._lockedTop;
          });
        }
        // Vertex handle released — save immediately (stay in vertex edit mode)
        if (obj?.data?.isVertexHandle) {
          const markupId = vertexEditMarkupId.current;
          if (markupId && vertexPoints.current.length >= 2) {
            const w = canvas.getWidth(), h = canvas.getHeight(), s = scaleRef.current;
            const normalizedPoints = vertexPoints.current.map(p => ({ x: p.x / w, y: p.y / h }));
            let pathLength = 0;
            for (let i = 1; i < vertexPoints.current.length; i++) {
              const dx = (vertexPoints.current[i].x - vertexPoints.current[i-1].x) / s;
              const dy = (vertexPoints.current[i].y - vertexPoints.current[i-1].y) / s;
              pathLength += Math.sqrt(dx*dx + dy*dy);
            }
            onMarkupModifiedRef.current?.({ id: markupId, type: 'polyline', coordinates: { points: normalizedPoints }, properties: { pathLength } });
          }
          return;
        }
        if (!obj?.data?.id) return;
        obj.isMoving = false;
        const w = canvas.getWidth(),
          h = canvas.getHeight(),
          type = obj.data.type;
        let coords: any = {};
        if (type === 'callout') {
          const part = obj.data?.part;
          const markupId = obj.data.id;
          const cloudObj = objectCache.current.get(markupId);
          const tailObj = calloutTailCache.current.get(markupId);
          const lineObj = calloutLineCache.current.get(markupId);
          const bgObj = calloutTextboxBgCache.current.get(markupId);

          if (part === 'textbox') {
            const sx = obj.scaleX || 1, sy = obj.scaleY || 1;
            const tbW = obj.width! * sx, tbH = ((obj as any).height || 50) * sy;

            // Scale fontSize proportionally when textbox is resized (not just moved)
            if (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01) {
              const avgScale = (sx + sy) / 2;
              const curFontSize = (obj as any).fontSize || 14 * scaleRef.current;
              const newFontSize = Math.round(curFontSize * avgScale);
              (obj as any).set({ fontSize: newFontSize, width: tbW, scaleX: 1, scaleY: 1 });
              obj.setCoords();
              // Save new fontSize to markup properties
              // Will be sent along with coordinates below
            }

            if (bgObj) { bgObj.set({ left: obj.left, top: obj.top, width: tbW, height: tbH }); bgObj.setCoords(); }
            if (lineObj && cloudObj) {
              const cd = (cloudObj as any).data || {};
              const cDx = cloudObj.left! - (cd._lastLeft ?? cloudObj.left!);
              const cDy = cloudObj.top! - (cd._lastTop ?? cloudObj.top!);
              const cloudBrLogical = {
                left: (cd._cloudOrigLeft ?? cloudObj.left! - (cloudObj.width||0)/2) + cDx,
                top: (cd._cloudOrigTop ?? cloudObj.top! - (cloudObj.height||0)/2) + cDy,
                width: cd._cloudOrigWidth ?? cloudObj.width! ?? 100,
                height: cd._cloudOrigHeight ?? cloudObj.height! ?? 100,
              };
              const tbCx = obj.left! + tbW/2, tbCy = obj.top! + tbH/2;
              const ep = cloudEdgePoint(cloudBrLogical, tbCx, tbCy);
              (lineObj as fabric.Line).set({ x1: ep.x, y1: ep.y, x2: tbCx, y2: tbCy });
              lineObj.setCoords();
              coords = {
                cloud: { left: cloudBrLogical.left/w, top: cloudBrLogical.top/h, width: cloudBrLogical.width/w, height: cloudBrLogical.height/h },
                textBox: { left: obj.left!/w, top: obj.top!/h, width: tbW/w, height: tbH/h },
              };
            } else {
              coords = { cloud: {}, textBox: { left: obj.left!/w, top: obj.top!/h, width: tbW/w, height: tbH/h } };
            }
            // Send with fontSize if it changed due to resize
            const newFS = Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01
              ? { fontSize: Math.round(((obj as any).fontSize || 14 * scaleRef.current) / scaleRef.current) }
              : {};
            onMarkupModifiedRef.current?.({ id: markupId, type, coordinates: coords, properties: newFS });
            return;
          } else if (part === 'tail') {
            if (lineObj && cloudObj) {
              const cd = (cloudObj as any).data || {};
              const cDx = cloudObj.left! - (cd._lastLeft ?? cloudObj.left!);
              const cDy = cloudObj.top! - (cd._lastTop ?? cloudObj.top!);
              const cloudBrLogical = {
                left: (cd._cloudOrigLeft ?? cloudObj.left! - (cloudObj.width||0)/2) + cDx,
                top: (cd._cloudOrigTop ?? cloudObj.top! - (cloudObj.height||0)/2) + cDy,
                width: cd._cloudOrigWidth ?? cloudObj.width! ?? 100,
                height: cd._cloudOrigHeight ?? cloudObj.height! ?? 100,
              };
              const ep = cloudEdgePoint(cloudBrLogical, obj.left!, obj.top!);
              (lineObj as fabric.Line).set({ x1: ep.x, y1: ep.y, x2: obj.left!, y2: obj.top! });
              lineObj.setCoords();
              coords = { cloud: { left: cloudBrLogical.left/w, top: cloudBrLogical.top/h, width: cloudBrLogical.width/w, height: cloudBrLogical.height/h }, tail: { x: obj.left!/w, y: obj.top!/h } };
            } else {
              coords = { cloud: {}, tail: { x: obj.left!/w, y: obj.top!/h } };
            }
          } else {
            // Cloud moved or scaled — use stored original dims + current scale
            const od = obj.data || {};
            const dx2 = obj.left! - (od._lastLeft ?? obj.left!);
            const dy2 = obj.top! - (od._lastTop ?? obj.top!);
            const cloudBrLogical = {
              left: (od._cloudOrigLeft ?? obj.left! - (obj.width||0)/2) + dx2,
              top: (od._cloudOrigTop ?? obj.top! - (obj.height||0)/2) + dy2,
              width: (od._cloudOrigWidth ?? obj.width! ?? 100) * (obj.scaleX || 1),
              height: (od._cloudOrigHeight ?? obj.height! ?? 100) * (obj.scaleY || 1),
            };
            if (lineObj && tailObj) {
              let tx: number, ty: number;
              if ((tailObj as any).data?.part === 'textbox') {
                const tw = tailObj.width! * (tailObj.scaleX || 1), th = (tailObj as any).height || 50;
                tx = tailObj.left! + tw / 2; ty = tailObj.top! + th / 2;
              } else { tx = tailObj.left!; ty = tailObj.top!; }
              const ep = cloudEdgePoint(cloudBrLogical, tx, ty);
              (lineObj as fabric.Line).set({ x1: ep.x, y1: ep.y, x2: tx, y2: ty });
              lineObj.setCoords();
            }
            if ((tailObj as any)?.data?.part === 'textbox') {
              // Use bgObj (outer bg rect) for textBox dimensions — tailObj is inset by strokeWidth
              // and would cause progressive shrink on every cloud move
              coords = {
                cloud: { left: cloudBrLogical.left/w, top: cloudBrLogical.top/h, width: cloudBrLogical.width/w, height: cloudBrLogical.height/h },
                textBox: bgObj
                  ? { left: bgObj.left!/w, top: bgObj.top!/h, width: bgObj.width!/w, height: (bgObj.height || (tailObj as any).height || 50)/h }
                  : { left: tailObj!.left!/w, top: tailObj!.top!/h, width: (tailObj!.width! * (tailObj!.scaleX||1))/w, height: ((tailObj as any).height||50)/h },
              };
            } else {
              const tailX = tailObj ? tailObj.left!/w : cloudBrLogical.left/w + cloudBrLogical.width/w/2;
              const tailY = tailObj ? tailObj.top!/h : cloudBrLogical.top/h + cloudBrLogical.height/h + 70/h;
              coords = { cloud: { left: cloudBrLogical.left/w, top: cloudBrLogical.top/h, width: cloudBrLogical.width/w, height: cloudBrLogical.height/h }, tail: { x: tailX, y: tailY } };
            }
          }
        } else if (["rect", "circle", "ellipse", "triangle", "diamond", "hexagon", "star"].includes(type)) {
          // Universal: use obj bounding box (works for all shape types)
          const ow = (obj.width || 0) * (obj.scaleX || 1);
          const oh = (obj.height || 0) * (obj.scaleY || 1);
          coords = { left: (obj.left || 0) / w, top: (obj.top || 0) / h, width: ow / w, height: oh / h, angle: obj.angle || 0 };
        } else if (type === 'cloud') {
          // fabric.Path uses center-based left/top; use delta from _lastLeft to avoid grow-on-move
          const od = obj.data || {};
          const dx = obj.left! - (od._lastLeft ?? obj.left!);
          const dy = obj.top! - (od._lastTop ?? obj.top!);
          coords = {
            left: ((od._cloudOrigLeft ?? 0) + dx) / w,
            top: ((od._cloudOrigTop ?? 0) + dy) / h,
            width: ((od._cloudOrigWidth ?? obj.width!) * (obj.scaleX || 1)) / w,
            height: ((od._cloudOrigHeight ?? obj.height!) * (obj.scaleY || 1)) / h,
            angle: obj.angle || 0,
          };
        } else if (["line", "arrow", "measure"].includes(type)) {
          if (obj.type === 'line') {
            // Plain line: use calcTransformMatrix + calcLinePoints
            const matrix = (obj as any).calcTransformMatrix();
            const relPts = (obj as any).calcLinePoints();
            const p1 = (fabric.util as any).transformPoint({ x: relPts.x1, y: relPts.y1 }, matrix);
            const p2 = (fabric.util as any).transformPoint({ x: relPts.x2, y: relPts.y2 }, matrix);
            coords = { x1: p1.x / w, y1: p1.y / h, x2: p2.x / w, y2: p2.y / h };
          } else if (obj.type === 'path') {
            // Arrow rendered as Path (not Group) to avoid Fabric.js v5 Group positioning bugs.
            const od = obj.data || {};
            const wasScaled = Math.abs((obj.scaleX || 1) - 1) > 0.01 || Math.abs((obj.scaleY || 1) - 1) > 0.01;
            const wasRotated = Math.abs(obj.angle || 0) > 0.5;
            if (wasScaled || wasRotated) {
              // Scale/rotate: compute new endpoints via transform matrix, then allow re-render
              const po = (obj as any).pathOffset || { x: 0, y: 0 };
              const matrix = obj.calcTransformMatrix();
              const opx1 = (od._origPx1 ?? 0), opy1 = (od._origPy1 ?? 0);
              const opx2 = (od._origPx2 ?? 0), opy2 = (od._origPy2 ?? 0);
              const ap1 = (fabric.util as any).transformPoint({ x: opx1 - po.x, y: opy1 - po.y }, matrix);
              const ap2 = (fabric.util as any).transformPoint({ x: opx2 - po.x, y: opy2 - po.y }, matrix);
              coords = { x1: ap1.x / w, y1: ap1.y / h, x2: ap2.x / w, y2: ap2.y / h };
              // Reset transform — syncMarkups will re-create the Path with new endpoints
              obj.set({ scaleX: 1, scaleY: 1, angle: 0 });
            } else {
              // Pure move: use _lastLeft/_lastTop delta + _movedLocally to prevent re-render flicker
              const dx = obj.left! - (od._lastLeft ?? obj.left!);
              const dy = obj.top! - (od._lastTop ?? obj.top!);
              coords = {
                x1: (od._x1 ?? 0) + dx / w,
                y1: (od._y1 ?? 0) + dy / h,
                x2: (od._x2 ?? 0) + dx / w,
                y2: (od._y2 ?? 0) + dy / h,
              };
              obj.data._x1 = coords.x1; obj.data._y1 = coords.y1;
              obj.data._x2 = coords.x2; obj.data._y2 = coords.y2;
              obj.data._lastLeft = obj.left!; obj.data._lastTop = obj.top!;
              obj.data._origPx1 = coords.x1 * w; obj.data._origPy1 = coords.y1 * h;
              obj.data._origPx2 = coords.x2 * w; obj.data._origPy2 = coords.y2 * h;
              (obj as any)._movedLocally = true;
            }
          } else {
            // Group (measure): use before:transform drag start position for delta
            const od = obj.data || {};
            const startL = (obj as any)._dragStartLeft ?? od._lastLeft ?? obj.left!;
            const startT = (obj as any)._dragStartTop ?? od._lastTop ?? obj.top!;
            const dx = obj.left! - startL;
            const dy = obj.top! - startT;
            coords = {
              x1: (od._x1 ?? 0) + dx / w,
              y1: (od._y1 ?? 0) + dy / h,
              x2: (od._x2 ?? 0) + dx / w,
              y2: (od._y2 ?? 0) + dy / h,
            };
            obj.data._x1 = coords.x1; obj.data._y1 = coords.y1;
            obj.data._x2 = coords.x2; obj.data._y2 = coords.y2;
            obj.data._lastLeft = obj.left!; obj.data._lastTop = obj.top!;
            (obj as any)._movedLocally = true;
          }
        } else if (type === 'highlighter') {
          // Highlights are locked — never persist a moved position.
          // After being in an ActiveSelection drag, Fabric shifts the object's coords.
          // Restore from markupsRef to fix hit area.
          const orig = markupsRef.current?.find((m: any) => m.id === obj.data.id);
          if (orig?.coordinates) {
            const oc = orig.coordinates;
            obj.set({
              left: (oc.left ?? 0) * w,
              top: (oc.top ?? 0) * h,
              scaleX: oc.width != null ? (oc.width * w) / (obj.width || 1) : (obj.scaleX || 1),
              scaleY: oc.height != null ? (oc.height * h) / (obj.height || 1) : (obj.scaleY || 1),
              angle: oc.angle ?? 0,
            });
            obj.setCoords();
            canvas.requestRenderAll();
          }
          return;
        } else if (type === 'image') {
          coords = {
            left: obj.left! / w,
            top: obj.top! / h,
            width: (obj.width! * (obj.scaleX || 1)) / w,
            height: (obj.height! * (obj.scaleY || 1)) / h,
            angle: obj.angle || 0,
          };
        } else if (type === 'pen') {
          // Preserve the path data from the original markup (not stored in obj.data)
          const origPen = markupsRef.current?.find((mk: any) => mk.id === obj.data.id);
          coords = {
            path: origPen?.coordinates?.path || (obj as any).path,
            left: (obj.left || 0) / w,
            top: (obj.top || 0) / h,
            width: ((obj.width || 1) * (obj.scaleX || 1)) / w,
            height: ((obj.height || 1) * (obj.scaleY || 1)) / h,
            angle: obj.angle || 0,
          };
        } else if (['electricalBox', 'stub', 'panel', 'reviewStamp'].includes(type)) {
          // Now rendered as simple Rect/Circle (not Group) — use absolute coords like shapes
          const ow = (obj.width || 0) * (obj.scaleX || 1);
          const oh = (obj.height || 0) * (obj.scaleY || 1);
          coords = { left: (obj.left || 0) / w, top: (obj.top || 0) / h, width: ow / w, height: oh / h, angle: obj.angle || 0 };
        } else if (type === 'text' || type === 'stickyNote') {
          // Text / Sticky Note: save position + width + scale fontSize proportionally on resize
          const sx = obj.scaleX || 1, sy = obj.scaleY || 1;
          const wasResized = Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01;
          const textW = (obj.width || 100) * sx;
          const textH = ((obj as any).height || 50) * sy;
          coords = { left: (obj.left || 0) / w, top: (obj.top || 0) / h, width: textW / w, height: textH / h, angle: obj.angle || 0 };
          // Scale fontSize proportionally when resized
          const origFontSize = (obj as any).fontSize || 14 * scaleRef.current;
          if (wasResized) {
            const newFontSize = Math.round(origFontSize * ((sx + sy) / 2));
            (obj as any).set({ fontSize: newFontSize, width: textW, scaleX: 1, scaleY: 1 });
            obj.setCoords();
            // Update text border (only for 'text' type)
            if (type === 'text') {
              const modifiedBorder = textBorderCache.current.get(obj.data.id);
              if (modifiedBorder) {
                modifiedBorder.set({ left: obj.left, top: obj.top, width: textW, height: (obj as any).height || 50, angle: obj.angle || 0 });
                modifiedBorder.setCoords();
              }
            }
            // Save fontSize in properties
            onMarkupModifiedRef.current?.({ id: obj.data.id, type, coordinates: coords, properties: { fontSize: Math.round(newFontSize / scaleRef.current) } });
            return;
          }
          // Sync text border on move (only for 'text' type)
          if (type === 'text') {
            const modifiedBorder = textBorderCache.current.get(obj.data.id);
            if (modifiedBorder) {
              modifiedBorder.set({ left: obj.left, top: obj.top, width: textW, height: (obj as any).height || 50, angle: obj.angle || 0 });
              modifiedBorder.setCoords();
            }
          }
        } else if (type === 'wireTag') {
          const od = obj.data || {};
          const startL = (obj as any)._dragStartLeft ?? od._lastLeft ?? obj.left!;
          const startT = (obj as any)._dragStartTop ?? od._lastTop ?? obj.top!;
          const dx = obj.left! - startL;
          const dy = obj.top! - startT;
          coords = {
            x1: (od._x1 ?? 0) + dx / w, y1: (od._y1 ?? 0) + dy / h,
            x2: (od._x2 ?? 0) + dx / w, y2: (od._y2 ?? 0) + dy / h,
          };
          obj.data._x1 = coords.x1; obj.data._y1 = coords.y1;
          obj.data._x2 = coords.x2; obj.data._y2 = coords.y2;
          obj.data._lastLeft = obj.left!; obj.data._lastTop = obj.top!;
          (obj as any)._movedLocally = true;
        } else if (type === 'polyline' || type === 'routeTemplate' || type === 'route') {
          // Polyline rendered as Path: use _lastLeft/_lastTop delta for move
          const od = obj.data || {};
          const storedPts: any[] = od._pts || [];
          if (storedPts.length >= 2) {
            const dx = obj.left! - (od._lastLeft ?? obj.left!);
            const dy = obj.top! - (od._lastTop ?? obj.top!);
            const newPts = storedPts.map((p: any) => ({ x: p.x + dx / w, y: p.y + dy / h }));
            const s2 = scaleRef.current;
            let pathLength = 0;
            for (let i = 1; i < newPts.length; i++) {
              const pdx = (newPts[i].x - newPts[i - 1].x) * w / s2;
              const pdy = (newPts[i].y - newPts[i - 1].y) * h / s2;
              pathLength += Math.sqrt(pdx * pdx + pdy * pdy);
            }
            coords = { points: newPts };
            obj.data._pts = JSON.parse(JSON.stringify(newPts));
            obj.data._lastLeft = obj.left!; obj.data._lastTop = obj.top!;
            (obj as any)._movedLocally = true;
            onMarkupModifiedRef.current?.({ id: obj.data.id, type, coordinates: coords, properties: { pathLength } });
            return;
          }
        }
        onMarkupModifiedRef.current?.({ id: obj.data.id, type, coordinates: coords });
      });

      // Store locked-object positions at transform start so we can freeze them during drag
      canvas.on('before:transform', (opt: any) => {
        const obj = opt.transform?.target;
        // Capture drag start position for ALL objects — used in object:modified delta calc.
        // This is immune to Fabric.js cache/coordinate issues because it's captured BEFORE the drag.
        if (obj) {
          (obj as any)._dragStartLeft = obj.left;
          (obj as any)._dragStartTop = obj.top;
          // Reset auxLabel drag tracking
          if (obj.data?.id) {
            const al = auxLabelCache.current.get(obj.data.id);
            if (al) { delete (al as any)._dragStartLeft; delete (al as any)._dragStartTop; }
          }
        }
        if (obj?.type === 'activeSelection') {
          // Reset delta tracker for callout non-selectable part movement
          (obj as any)._prevCX = undefined;
          (obj as any)._prevCY = undefined;
          (obj as fabric.ActiveSelection).getObjects().forEach((child: any) => {
            const childLocked = !!child.data?.locked;
            const childCanEdit = child.data?.canEdit !== false;
            if (childLocked || !childCanEdit) {
              child._lockedLeft = child.left;
              child._lockedTop = child.top;
            }
          });
        }
      });

      // Remove locked/non-editable objects from activeSelection so they can't be dragged
      const stripLockedFromSelection = () => {
        const active = canvas.getActiveObject();
        if (active?.type !== 'activeSelection') return;
        const sel = active as fabric.ActiveSelection;
        const allObjs = sel.getObjects();
        const locked = allObjs.filter((o: any) => o.data?.locked || o.data?.canEdit === false);
        if (locked.length === 0) return; // nothing to strip
        if (locked.length === allObjs.length) {
          // All objects are locked — deselect entirely
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          return;
        }
        // Get unlocked objects before destroying the selection
        const unlocked = allObjs.filter((o: any) => !o.data?.locked && o.data?.canEdit !== false);
        // Discard current selection completely and re-select only unlocked
        canvas.discardActiveObject();
        if (unlocked.length === 1) {
          canvas.setActiveObject(unlocked[0]);
        } else if (unlocked.length > 1) {
          const newSel = new fabric.ActiveSelection(unlocked, { canvas });
          canvas.setActiveObject(newSel);
        }
        canvas.requestRenderAll();
      };

      canvas.on("selection:created", (e: any) => {
        stripLockedFromSelection();
        if (!isProgrammaticSelect.current && !isInSync.current)
          onMarkupSelectedRef.current?.(
            e.selected?.map((o: any) => o.data?.id).filter(Boolean) || [],
          );
      });
      canvas.on("selection:updated", (e: any) => {
        stripLockedFromSelection();
        if (!isProgrammaticSelect.current && !isInSync.current)
          onMarkupSelectedRef.current?.(
            e.selected?.map((o: any) => o.data?.id).filter(Boolean) || [],
          );
      });
      canvas.on("selection:cleared", () => {
        // Primary vertex edit exit is handled in mouse:down (more reliable than selection:cleared
        // which fires spuriously after drags and when hiding the group in enterVertexEdit).
        // No exitVertexEdit here.
        // Skip when disposing — prevents cross-page clipboard being cleared on page navigation.
        if (!isInSync.current && !isProgrammaticSelect.current && !isDisposing.current)
          onMarkupSelectedRef.current?.([]);
      });

      // Canvas text editing: detect @mention and save text on exit
      const calloutTextDebounce = new Map<string, ReturnType<typeof setTimeout>>();
      canvas.on("text:changed", (e: any) => {
        const obj = e.target;
        if (!obj || obj.type !== "textbox") return;
        // Sync callout bg rect height as text grows + save live
        if (obj.data?.type === 'callout' && obj.data?.part === 'textbox') {
          const markupId = obj.data.id;
          // Mark as editing so syncMarkups skips this markup (prevents focus loss)
          textEditingMarkupId.current = markupId;
          const bgObj = calloutTextboxBgCache.current.get(markupId);
          const autoH = (obj as any).height || 40;
          const tbW = obj.width! * (obj.scaleX || 1);
          if (bgObj) {
            bgObj.set({ left: obj.left, top: obj.top, width: tbW, height: autoH });
            bgObj.setCoords();
          }
          // Update connector line endpoint to textbox center
          const lineObj = calloutLineCache.current.get(markupId);
          const cloudObj = objectCache.current.get(markupId);
          if (lineObj && cloudObj) {
            const tbCx = obj.left! + tbW / 2;
            const tbCy = obj.top! + autoH / 2;
            const cd = (cloudObj as any).data || {};
            const cloudBrLogical = { left: cd._cloudOrigLeft ?? 0, top: cd._cloudOrigTop ?? 0, width: (cd._cloudOrigWidth ?? 100) * (cloudObj.scaleX || 1), height: (cd._cloudOrigHeight ?? 100) * (cloudObj.scaleY || 1) };
            const ep = cloudEdgePoint(cloudBrLogical, tbCx, tbCy);
            (lineObj as fabric.Line).set({ x1: ep.x, y1: ep.y, x2: tbCx, y2: tbCy });
            lineObj.setCoords();
          }
          canvas.requestRenderAll();

          // Debounced live save (300ms) — text + textBox height update to Y.js
          const prev = calloutTextDebounce.get(markupId);
          if (prev) clearTimeout(prev);
          calloutTextDebounce.set(markupId, setTimeout(() => {
            calloutTextDebounce.delete(markupId);
            const w = canvas.getWidth(), h = canvas.getHeight();
            const existing = markupsRef.current?.find((m: any) => m.id === markupId);
            const existingCloud = existing?.coordinates?.cloud;
            const textBoxCoords = { left: obj.left!/w, top: obj.top!/h, width: tbW/w, height: autoH/h };
            onMarkupModifiedRef.current?.({
              id: markupId, type: 'callout',
              coordinates: { cloud: existingCloud || {}, textBox: textBoxCoords },
              properties: { text: obj.text ?? '' },
            });
          }, 300));
        }
        const text: string = obj.text || "";
        const cursorPos: number = obj.selectionStart ?? text.length;
        const textBefore = text.substring(0, cursorPos);
        const lastAt = textBefore.lastIndexOf("@");
        if (lastAt !== -1) {
          const query = textBefore.substring(lastAt + 1);
          if (!query.includes(" ") && !query.includes("\n")) {
            const canvasEl = canvas.getElement() as HTMLElement;
            const { left = 0, top = 0 } = obj.getBoundingRect(true);
            onCanvasMentionRef.current?.({
              anchor: canvasEl,
              cursorPos: {
                left,
                top: top + (obj.fontSize || 20) * scaleRef.current,
              }, // Position near the textbox
              query,
              onSelect: (name: string) => {
                const before = text.substring(0, lastAt);
                const after = text.substring(cursorPos);
                const newText = before + "@" + name + " " + after;
                obj.set("text", newText);
                const newCursor = lastAt + name.length + 2;
                obj.selectionStart = newCursor;
                obj.selectionEnd = newCursor;
                canvas.requestRenderAll();
                onCanvasMentionRef.current?.(null);
              },
            });
            return;
          }
        }
        onCanvasMentionRef.current?.(null);
      });

      canvas.on("text:editing:exited", (e: any) => {
        const obj = e.target;
        if (!obj?.data?.id) return;
        if (obj.type !== "textbox" && obj.data?.part !== 'textbox') return;
        textEditingMarkupId.current = null; // Clear editing guard
        try { // Guard against null refs during editing exit
        const newText = obj.text ?? '';
        const w = canvas.getWidth(), h = canvas.getHeight();
        if (obj.data.type === 'callout') {
          // Use stored cloud coordinates from the original markup data (not getBoundingRect which
          // can be corrupted by Fabric transforms). Only send textBox coords + text update.
          const bgObj = calloutTextboxBgCache.current.get(obj.data.id);
          const sw = (bgObj as any)?.strokeWidth || 0;
          const tbW = obj.width! * (obj.scaleX || 1);
          const tbH = (obj as any).height || 50;
          // Store OUTER dimensions (bgObj = textbox+border, textboxObj is inset by sw on each side).
          // Without this, each save stores inner height → re-render subtracts sw*2 again → progressive shrink.
          const outerW = tbW + sw * 2;
          const outerH = tbH + sw * 2;
          const textBoxCoords = { left: (obj.left! - sw) / w, top: (obj.top! - sw) / h, width: outerW / w, height: outerH / h };
          if (bgObj) { bgObj.set({ left: obj.left! - sw, top: obj.top! - sw, width: outerW, height: outerH }); bgObj.setCoords(); }
          // Find the current markup to preserve its cloud coords
          const existing = markupsRef.current?.find((m: any) => m.id === obj.data.id);
          const existingCloud = existing?.coordinates?.cloud;
          onMarkupModifiedRef.current?.({
            id: obj.data.id, type: 'callout',
            coordinates: { cloud: existingCloud || {}, textBox: textBoxCoords },
            properties: { text: newText },
          });
        } else {
          const coords = { left: (obj.left || 0)/w, top: (obj.top || 0)/h, angle: obj.angle || 0, width: ((obj.width || 100) * (obj.scaleX||1))/w };
          onMarkupModifiedRef.current?.({ id: obj.data.id, type: "text", coordinates: coords, properties: { text: newText } });
        }
        } catch (err) { console.warn('text:editing:exited error:', err); }
        onCanvasMentionRef.current?.(null);
      });

      // ESC key: cancel drawing / exit vertex edit / switch to select
      let lastEscTime = 0;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        const target = e.target as HTMLElement;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;

        const now = Date.now();

        // 1. Cancel active polyline drawing
        if (polylinePoints.current.length > 0) {
          e.preventDefault();
          polylineLines.current.forEach(l => canvas.remove(l));
          polylineLines.current = [];
          if (polylinePreviewLine.current) { canvas.remove(polylinePreviewLine.current); polylinePreviewLine.current = null; }
          if (polylineLengthLabel.current) { canvas.remove(polylineLengthLabel.current); polylineLengthLabel.current = null; }
          polylinePoints.current = [];
          canvas.requestRenderAll();
          return;
        }

        // 2. Cancel active shape/line drawing
        if (isDrawing.current && currentObject.current) {
          e.preventDefault();
          canvas.remove(currentObject.current);
          if (measureLabel.current) { canvas.remove(measureLabel.current); measureLabel.current = null; }
          measureTicks.current.forEach(t => canvas.remove(t));
          measureTicks.current = [];
          measureExtensions.current.forEach(t => canvas.remove(t));
          measureExtensions.current = [];
          currentObject.current = null;
          isDrawing.current = false;
          canvas.requestRenderAll();
          return;
        }

        // 3. Cancel active highlight drawing
        if (isDrawingHighlightRef.current) {
          e.preventDefault();
          if (currentObject.current) canvas.remove(currentObject.current);
          currentObject.current = null;
          isDrawingHighlightRef.current = false;
          canvas.requestRenderAll();
          return;
        }

        // 4. Exit vertex edit mode
        if (vertexEditMarkupId.current) {
          exitVertexEdit(true);
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          return;
        }

        // 5. Deselect active objects
        if (canvas.getActiveObject()) {
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          return;
        }

        // 6. Double-ESC → switch to select tool
        if (now - lastEscTime < 400) {
          onSwitchToSelectRef.current?.();
        }
        lastEscTime = now;
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        wrapper?.removeEventListener('pointermove', handlePressure as EventListener);
        wrapper?.removeEventListener('pointerup', handlePressureEnd as EventListener);
        if (fabricCanvas.current) {
          isDisposing.current = true;
          fabricCanvas.current.dispose();
          fabricCanvas.current = null;
          objectCache.current.clear();
          hashCache.current.clear();
          tsCache.current.clear();
          calloutTailCache.current.clear();
          calloutLineCache.current.clear();
          calloutTextboxBgCache.current.clear();
          polylinePoints.current = [];
          polylineLines.current = [];
          polylinePreviewLine.current = null;
          polylineLengthLabel.current = null;
          vertexHandles.current = [];
          vertexTempObjs.current = [];
          vertexEditMarkupId.current = null;
          vertexPoints.current = [];
          vertexMarkupDataRef.current = null;
        }
      };
    }, []);

    const syncMarkups = useCallback(
      (canvas: fabric.Canvas, mks: any[], w: number, h: number, s: number) => {
        // Capture active selection before sync so we can restore it after re-creating replaced objects
        const activeObj = canvas.getActiveObject();
        const prevActiveIds: string[] = activeObj
          ? activeObj.type === "activeSelection"
            ? (activeObj as fabric.ActiveSelection)
                .getObjects()
                .map((o: any) => o.data?.id)
                .filter(Boolean)
            : [(activeObj as any).data?.id].filter(Boolean)
          : [];
        
        // Collect IDs of objects currently being dragged — skip only those during sync
        const draggingIds = new Set<string>();
        if (activeObj && activeObj.isMoving) {
          if (activeObj.type === 'activeSelection') {
            (activeObj as fabric.ActiveSelection).getObjects().forEach((o: any) => {
              if (o.data?.id) draggingIds.add(o.data.id);
            });
          } else if ((activeObj as any).data?.id) {
            draggingIds.add((activeObj as any).data.id);
          }
        }

        isInSync.current = true;
        const cache = objectCache.current,
          hashes = hashCache.current,
          currentIds = new Set((mks || []).map((m) => m.id));
        for (const [id, obj] of cache.entries()) {
          if (!currentIds.has(id) && !draggingIds.has(id)) {
            canvas.remove(obj);
            cache.delete(id);
            hashes.delete(id);
            tsCache.current.delete(id);
            // Clean up callout tail and connector line
            const tailObj = calloutTailCache.current.get(id);
            if (tailObj) { canvas.remove(tailObj); calloutTailCache.current.delete(id); }
            const lineObj = calloutLineCache.current.get(id);
            if (lineObj) { canvas.remove(lineObj); calloutLineCache.current.delete(id); }
            const bgObj2 = calloutTextboxBgCache.current.get(id);
            if (bgObj2) { canvas.remove(bgObj2); calloutTextboxBgCache.current.delete(id); }
            // Clean up text border rect
            const bRectOld = textBorderCache.current.get(id);
            if (bRectOld) { canvas.remove(bRectOld); textBorderCache.current.delete(id); }
            // Clean up author label
            const authorLabel = authorLabelCache.current.get(id);
            if (authorLabel) { canvas.remove(authorLabel); authorLabelCache.current.delete(id); }
            // Clean up measure/polyline aux label
            const auxLbl = auxLabelCache.current.get(id);
            if (auxLbl) { canvas.remove(auxLbl); auxLabelCache.current.delete(id); }
          }
        }

        for (const m of mks || []) {
          // Skip objects currently being dragged to avoid position conflict
          if (draggingIds.has(m.id)) continue;
          // Skip markup currently being vertex-edited to preserve temp overlay
          if (vertexEditMarkupId.current === m.id) continue;
          // Skip markup currently being text-edited (callout) to prevent focus loss
          if (textEditingMarkupId.current === m.id) continue;
          if (hiddenLayers.includes(m.type)) {
            if (cache.has(m.id)) {
              canvas.remove(cache.get(m.id)!);
              cache.delete(m.id);
              hashes.delete(m.id);
              tsCache.current.delete(m.id);
              const hiddenTail = calloutTailCache.current.get(m.id);
              if (hiddenTail) { canvas.remove(hiddenTail); calloutTailCache.current.delete(m.id); }
              const hiddenLine = calloutLineCache.current.get(m.id);
              if (hiddenLine) { canvas.remove(hiddenLine); calloutLineCache.current.delete(m.id); }
              const hiddenBg = calloutTextboxBgCache.current.get(m.id);
              if (hiddenBg) { canvas.remove(hiddenBg); calloutTextboxBgCache.current.delete(m.id); }
              const hiddenBorder = textBorderCache.current.get(m.id);
              if (hiddenBorder) { canvas.remove(hiddenBorder); textBorderCache.current.delete(m.id); }
              const hiddenAuthorLabel = authorLabelCache.current.get(m.id);
              if (hiddenAuthorLabel) { canvas.remove(hiddenAuthorLabel); authorLabelCache.current.delete(m.id); }
            }
            continue;
          }
          // Fast-path: if updatedAt + dimensions haven't changed and object exists, skip full propHash
          const tsKey = `${m.updatedAt || m.createdAt || '0'}|${w}|${h}|${docScaleRef.current}|${showAuthorOnMarkupRef.current ? 1 : 0}`;
          const prevTs = tsCache.current.get(m.id);
          if (prevTs === tsKey && cache.has(m.id) && !(cache.get(m.id) as any)._justCreated) {
            // Nothing changed — just update interactivity flags (cheap)
            const isSelect = toolRef.current === "select" || !canMarkupRef.current;
            const locked = !!(m.properties || {}).locked;
            const _eids = m.allowedEditUserIds;
            let canEdit =
              isAdminRef.current ||
              (currentUserIdRef.current != null && m.authorId === currentUserIdRef.current) ||
              !_eids || _eids.includes("*") ||
              (_eids.length > 0 && currentUserIdRef.current != null && _eids.includes(currentUserIdRef.current));
            // Session-scope restriction: in Personal/Live mode only session markups are editable
            const sessionRestricted = !!(activeSessionIdRef.current && (m.properties?.sessionId) !== activeSessionIdRef.current);
            if (sessionRestricted) canEdit = false;
            const effectiveLocked = !canMarkupRef.current || locked || !canEdit;
            // Non-session markups in Personal/Live: clickable (view properties) but fully locked (no move/resize)
            const objSelectable = isSelect;
            const objEvented = isSelect;
            const obj = cache.get(m.id)!;
            obj.set({ selectable: objSelectable, evented: objEvented, lockMovementX: effectiveLocked, lockMovementY: effectiveLocked, lockRotation: effectiveLocked, lockScalingX: effectiveLocked, lockScalingY: effectiveLocked, hasControls: !effectiveLocked });
            (obj as any).data = { ...(obj as any).data, canEdit, sessionId: m.properties?.sessionId };
            continue;
          }

          const newHash = propHash(m, docScaleRef.current, w, h),
            coords = m.coordinates || {};
          const
            props = m.properties || {},
            stroke = props.stroke || "#d32f2f",
            strokeWidth = props.strokeWidth || 2,
            dash = getDashArray(props.lineStyle || "solid");
          const fillHex = props.fill || "transparent",
            fillOpacity =
              props.fillOpacity !== undefined ? props.fillOpacity : 0.2,
            fill =
              fillHex === "transparent"
                ? "transparent"
                : hexToRgba(fillHex, fillOpacity);
          const isSelect = toolRef.current === "select" || !canMarkupRef.current,
            locked = !!props.locked;
          // ['*'] or null/undefined = unrestricted; [] = nobody (except owner/admin); [ids] = specific users
          const _eids = m.allowedEditUserIds;
          let canEdit =
            isAdminRef.current ||
            (currentUserIdRef.current != null &&
              m.authorId === currentUserIdRef.current) ||
            !_eids ||
            _eids.includes("*") ||
            (_eids.length > 0 &&
              currentUserIdRef.current != null &&
              _eids.includes(currentUserIdRef.current));
          // Session-scope restriction: in Personal/Live mode only session markups are editable
          const sessionRestricted = !!(activeSessionIdRef.current && (m.properties?.sessionId) !== activeSessionIdRef.current);
          if (sessionRestricted) canEdit = false;
          const effectiveLocked = !canMarkupRef.current || locked || !canEdit;
          // Non-session markups: selectable (view properties on click) but fully locked
          const objSelectable = isSelect;
          const objEvented = isSelect;

          // Store timestamp key for fast-path on next sync
          tsCache.current.set(m.id, tsKey);

          if (cache.has(m.id)) {
            const obj = cache.get(m.id)!;
            // Object was just drawn locally — accept Yjs data without recreation
            if ((obj as any)._justCreated) {
              // cloud/callout are pre-registered as plain Rect preview objects and lack
              // _cloudOrigLeft/_lastLeft data. If we keep them, the first move/resize in
              // object:modified computes coords (0,0) → markup flies to top-left.
              // Fix: remove the Rect and fall through to renderMarkup to create the proper shape.
              if (m.type === 'cloud' || m.type === 'callout') {
                canvas.remove(obj);
                cache.delete(m.id);
                hashes.delete(m.id);
                // fall through to renderMarkup below
              } else {
                (obj as any)._justCreated = false;
                hashes.set(m.id, newHash);
                // Refresh self-contained coord cache from the Yjs-confirmed coordinates
                const _jcCache: any = {};
                if (obj.type === 'group') {
                  const _jcp = obj.getCenterPoint();
                  _jcCache._cx = _jcp.x;
                  _jcCache._cy = _jcp.y;
                }
                const _jCoords = m.coordinates || {} as any;
                if (['arrow', 'measure', 'wireTag'].includes(m.type)) {
                  _jcCache._x1 = _jCoords.x1 ?? 0; _jcCache._y1 = _jCoords.y1 ?? 0;
                  _jcCache._x2 = _jCoords.x2 ?? 0; _jcCache._y2 = _jCoords.y2 ?? 0;
                } else if (['polyline', 'routeTemplate', 'route'].includes(m.type)) {
                  _jcCache._pts = _jCoords.points ? JSON.parse(JSON.stringify(_jCoords.points)) : [];
                } else if (['electricalBox', 'stub', 'panel', 'reviewStamp'].includes(m.type)) {
                  _jcCache._cl = _jCoords.left ?? 0; _jcCache._ct = _jCoords.top ?? 0;
                  _jcCache._cw = _jCoords.width ?? 0; _jcCache._ch = _jCoords.height ?? 0;
                }
                (obj as any).data = { ...(obj as any).data, ..._jcCache, canEdit, locked: !!props.locked, sessionId: m.properties?.sessionId };
                obj.set({ selectable: objSelectable, evented: objEvented, lockMovementX: effectiveLocked, lockMovementY: effectiveLocked, lockRotation: effectiveLocked, lockScalingX: effectiveLocked, lockScalingY: effectiveLocked, hasControls: !effectiveLocked });
                continue;
              }
            }
            // Object was moved locally via object:modified — coordinates saved correctly,
            // DO NOT remove+recreate (Fabric.js Group recreation causes wrong visual position).
            // Just accept the new hash and update interactivity flags.
            if ((obj as any)._movedLocally) {
              (obj as any)._movedLocally = false;
              hashes.set(m.id, newHash);
              tsCache.current.set(m.id, tsKey);
              obj.set({ selectable: objSelectable, evented: objEvented, lockMovementX: effectiveLocked, lockMovementY: effectiveLocked, lockRotation: effectiveLocked, lockScalingX: effectiveLocked, lockScalingY: effectiveLocked, hasControls: !effectiveLocked });
              (obj as any).data = { ...(obj as any).data, canEdit, sessionId: m.properties?.sessionId };
              continue;
            }
            if (hashes.get(m.id) === newHash) {
              // Hash match: data + dimensions unchanged — just update interactivity flags
              obj.set({
                selectable: objSelectable,
                evented: objEvented,
                lockMovementX: effectiveLocked,
                lockMovementY: effectiveLocked,
                lockRotation: effectiveLocked,
                lockScalingX: effectiveLocked,
                lockScalingY: effectiveLocked,
                hasControls: !effectiveLocked,
              });
              (obj as any).data = { ...(obj as any).data, canEdit, sessionId: m.properties?.sessionId };
              if (m.type === 'callout') {
                const tailObj = calloutTailCache.current.get(m.id);
                if (tailObj) {
                  const isPart = (tailObj as any).data?.part;
                  if (isPart === 'textbox') {
                    tailObj.set({
                      selectable: !effectiveLocked, evented: true,
                      lockMovementX: effectiveLocked, lockMovementY: effectiveLocked,
                      editable: canEdit && !effectiveLocked,
                    } as any);
                  } else {
                    tailObj.set({
                      selectable: isSelect && !effectiveLocked, evented: isSelect && !effectiveLocked,
                      lockMovementX: effectiveLocked, lockMovementY: effectiveLocked,
                    });
                  }
                  (tailObj as any).data = { ...(tailObj as any).data, canEdit };
                }
              }
              continue;
            }
            const activeObj2 = canvas.getActiveObject();
            if (activeObj2 === obj || (activeObj2?.type === 'activeSelection' && (activeObj2 as fabric.ActiveSelection).contains(obj))) {
              canvas.discardActiveObject();
            }
            canvas.remove(obj);
            cache.delete(m.id);
            hashes.delete(m.id);
            // Remove stale callout parts when hash changes
            const staleTail = calloutTailCache.current.get(m.id);
            if (staleTail) { canvas.remove(staleTail); calloutTailCache.current.delete(m.id); }
            const staleLine = calloutLineCache.current.get(m.id);
            if (staleLine) { canvas.remove(staleLine); calloutLineCache.current.delete(m.id); }
            const staleBg = calloutTextboxBgCache.current.get(m.id);
            if (staleBg) { canvas.remove(staleBg); calloutTextboxBgCache.current.delete(m.id); }
            // Remove stale text border rect
            const staleBorder = textBorderCache.current.get(m.id);
            if (staleBorder) { canvas.remove(staleBorder); textBorderCache.current.delete(m.id); }
            // Remove stale author label
            const staleAuthorLabel = authorLabelCache.current.get(m.id);
            if (staleAuthorLabel) { canvas.remove(staleAuthorLabel); authorLabelCache.current.delete(m.id); }
            // Remove stale measure/polyline aux label
            const staleAuxLbl = auxLabelCache.current.get(m.id);
            if (staleAuxLbl) { canvas.remove(staleAuxLbl); auxLabelCache.current.delete(m.id); }
          }

          let obj: fabric.Object | null = null;
          if (m.type === "rect")
            obj = new fabric.Rect({
              left: coords.left * w,
              top: coords.top * h,
              width: coords.width * w,
              height: coords.height * h,
              fill,
              stroke,
              strokeWidth,
              strokeDashArray: dash,
            });
          else if (m.type === "callout" && coords.cloud) {
            const cc = coords.cloud;
            const cLeft = cc.left * w, cTop = cc.top * h, cWidth = cc.width * w, cHeight = cc.height * h;

            // Clean up previous objects
            const prevTail = calloutTailCache.current.get(m.id);
            if (prevTail) { canvas.remove(prevTail); calloutTailCache.current.delete(m.id); }
            const prevLine = calloutLineCache.current.get(m.id);
            if (prevLine) { canvas.remove(prevLine); calloutLineCache.current.delete(m.id); }
            const prevBg = calloutTextboxBgCache.current.get(m.id);
            if (prevBg) { canvas.remove(prevBg); calloutTextboxBgCache.current.delete(m.id); }

            if (coords.textBox) {
              // NEW Cloud+ format: cloud + leader line + text box
              const tb = coords.textBox;
              const tbLeft = tb.left * w, tbTop = tb.top * h;
              const tbWidth = tb.width * w, tbHeight = tb.height * h;
              const tbCx = tbLeft + tbWidth / 2, tbCy = tbTop + tbHeight / 2;
              const cloudBrForLine = { left: cLeft, top: cTop, width: cWidth, height: cHeight };
              const lineStart = cloudEdgePoint(cloudBrForLine, tbCx, tbCy);

              // Connector line (non-interactive)
              const connStroke = props.connectorStroke || stroke;
              const connWidth = props.connectorWidth != null ? props.connectorWidth * s : Math.max(1, strokeWidth);
              const connDash = getDashArray(props.connectorStyle || props.lineStyle || 'solid');
              const connectorLine = new fabric.Line(
                [lineStart.x, lineStart.y, tbCx, tbCy],
                { stroke: connStroke, strokeWidth: connWidth, strokeDashArray: connDash, selectable: false, evented: false }
              );
              connectorLine.set('data', { part: 'connector', id: m.id });
              canvas.add(connectorLine);
              calloutLineCache.current.set(m.id, connectorLine);

              // Text box background rect (non-interactive, provides fill + border)
              const textboxBg = new fabric.Rect({
                left: tbLeft, top: tbTop, width: tbWidth, height: tbHeight,
                fill: props.textBoxFill || '#ffffff',
                stroke: props.textBoxStroke || stroke, strokeWidth, strokeDashArray: dash,
                selectable: false, evented: false,
                originX: 'left', originY: 'top',
              });
              textboxBg.set('data', { id: m.id, type: 'callout', part: 'textboxBg' });
              canvas.add(textboxBg);
              calloutTextboxBgCache.current.set(m.id, textboxBg);

              // Textbox (editable, movable)
              const textboxObj = new fabric.Textbox(props.text || '', {
                left: tbLeft + strokeWidth, top: tbTop + strokeWidth,
                width: Math.max(10, tbWidth - strokeWidth * 2),
                height: tbHeight - strokeWidth * 2,
                fontSize: (props.fontSize || 14) * s,
                fill: props.textColor || '#000000',
                fontFamily: props.fontFamily || 'Arial',
                fontWeight: props.fontWeight || 'normal',
                fontStyle: props.fontStyle || 'normal',
                textAlign: props.textAlign || 'left',
                backgroundColor: '',
                stroke: 'transparent',
                strokeWidth: 0,
                editable: false, // NEVER use Fabric enterEditing — HTML textarea overlay handles editing (avoids black screen)
                splitByGrapheme: false,
                objectCaching: false,
              });
              textboxObj.set('data', { id: m.id, type: 'callout', part: 'textbox', canEdit });
              textboxObj.set({
                selectable: !effectiveLocked,
                evented: true,
                lockMovementX: effectiveLocked,
                lockMovementY: effectiveLocked,
                hasControls: !effectiveLocked,
                lockRotation: true,
                lockScalingY: effectiveLocked,
                lockScalingX: effectiveLocked,
                lockScalingFlip: true,
              });
              canvas.add(textboxObj);
              calloutTailCache.current.set(m.id, textboxObj);

              // Auto-open HTML text editing for newly drawn callout (avoids black screen from enterEditing)
              if (pendingCalloutEditRef.current === m.id) {
                pendingCalloutEditRef.current = null;
                requestAnimationFrame(() => {
                  if (!fabricCanvas.current || !startHtmlTextEditRef.current) return;
                  const tbW2 = (textboxObj.width || 100) * (textboxObj.scaleX || 1);
                  const tbH2 = (textboxObj as any).height || 50;
                  const bgObj2 = calloutTextboxBgCache.current.get(m.id);
                  const hideList2: fabric.Object[] = [textboxObj];
                  if (bgObj2) hideList2.push(bgObj2);
                  startHtmlTextEditRef.current({
                    markupId: m.id,
                    currentText: '',
                    left: textboxObj.left || 0,
                    top: textboxObj.top || 0,
                    width: tbW2,
                    height: tbH2,
                    fontSize: (textboxObj as any).fontSize || 14,
                    fontFamily: (textboxObj as any).fontFamily || 'Arial',
                    fontWeight: (textboxObj as any).fontWeight || 'normal',
                    fontStyle: (textboxObj as any).fontStyle || 'normal',
                    textAlign: (textboxObj as any).textAlign || 'left',
                    color: (textboxObj as any).fill || '#000',
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    hideObjs: hideList2,
                    onSave: (newText: string) => {
                      const cw = fabricCanvas.current!.getWidth(), ch = fabricCanvas.current!.getHeight();
                      const existing2 = markupsRef.current?.find((mk: any) => mk.id === m.id);
                      const existingCloud2 = existing2?.coordinates?.cloud;
                      const tbCoords2 = { left: (textboxObj.left || 0) / cw, top: (textboxObj.top || 0) / ch, width: tbW2 / cw, height: tbH2 / ch };
                      onMarkupModifiedRef.current?.({
                        id: m.id, type: 'callout',
                        coordinates: { cloud: existingCloud2 || {}, textBox: tbCoords2 },
                        properties: { text: newText },
                      });
                    },
                  });
                });
              }

              // Cloud shape (stored in objectCache as main object)
              obj = new fabric.Path(
                makeCloudPath(cLeft, cTop, cWidth, cHeight, (props.cloudArcSize || 20) * s),
                { fill, stroke, strokeWidth, strokeDashArray: dash }
              );
            } else {
              // Legacy tail-circle format: keep old behavior
              const tailX = (coords.tail?.x ?? (cc.left + cc.width / 2)) * w;
              const tailY = (coords.tail?.y ?? (cc.top + cc.height + 70 / h)) * h;

              const legacyEdge = cloudEdgePoint({ left: cLeft, top: cTop, width: cWidth, height: cHeight }, tailX, tailY);
              const connectorLine = new fabric.Line(
                [legacyEdge.x, legacyEdge.y, tailX, tailY],
                { stroke, strokeWidth: Math.max(1, strokeWidth), strokeDashArray: dash, selectable: false, evented: false }
              );
              connectorLine.set('data', { part: 'connector', id: m.id });
              canvas.add(connectorLine);
              calloutLineCache.current.set(m.id, connectorLine);

              const tailCircle = new fabric.Circle({
                left: tailX, top: tailY, radius: 7 * s,
                fill: stroke, stroke: '#ffffff', strokeWidth: 2,
                originX: 'center', originY: 'center',
                hasControls: false, hasBorders: false,
              });
              tailCircle.set('data', { id: m.id, type: 'callout', part: 'tail', canEdit });
              tailCircle.set({
                selectable: isSelect && !effectiveLocked,
                evented: isSelect && !effectiveLocked,
                lockMovementX: effectiveLocked, lockMovementY: effectiveLocked,
              });
              canvas.add(tailCircle);
              calloutTailCache.current.set(m.id, tailCircle);

              obj = new fabric.Path(
                makeCloudPath(cLeft, cTop, cWidth, cHeight, (props.cloudArcSize || 20) * s),
                { fill, stroke, strokeWidth, strokeDashArray: dash }
              );
            }
          } else if (m.type === "callout") {
            // Legacy callout (old format without cloud sub-object): render as rect
            obj = new fabric.Rect({
              left: coords.left * w,
              top: coords.top * h,
              width: coords.width * w,
              height: coords.height * h,
              fill, stroke, strokeWidth, strokeDashArray: dash,
            });
          }
          else if (m.type === "circle")
            obj = new fabric.Circle({
              left: coords.left * w,
              top: coords.top * h,
              radius: Math.min(coords.width * w, coords.height * h) / 2,
              fill,
              stroke,
              strokeWidth,
              strokeDashArray: dash,
            });
          else if (m.type === "ellipse")
            obj = new fabric.Ellipse({
              left: coords.left * w,
              top: coords.top * h,
              rx: (coords.width * w) / 2,
              ry: (coords.height * h) / 2,
              fill,
              stroke,
              strokeWidth,
              strokeDashArray: dash,
            });
          else if (m.type === "triangle")
            obj = new fabric.Polygon(
              trianglePoints(
                coords.left * w + (coords.width * w) / 2,
                coords.top * h + (coords.height * h) / 2,
                coords.width * w,
                coords.height * h,
              ).map((p) => new fabric.Point(p.x, p.y)),
              { fill, stroke, strokeWidth, strokeDashArray: dash },
            );
          else if (m.type === "diamond")
            obj = new fabric.Polygon(
              diamondPoints(
                coords.left * w + (coords.width * w) / 2,
                coords.top * h + (coords.height * h) / 2,
                coords.width * w,
                coords.height * h,
              ).map((p) => new fabric.Point(p.x, p.y)),
              { fill, stroke, strokeWidth, strokeDashArray: dash },
            );
          else if (m.type === "hexagon")
            obj = new fabric.Polygon(
              hexagonPoints(
                coords.left * w + (coords.width * w) / 2,
                coords.top * h + (coords.height * h) / 2,
                coords.width * w,
                coords.height * h,
              ).map((p) => new fabric.Point(p.x, p.y)),
              { fill, stroke, strokeWidth, strokeDashArray: dash },
            );
          else if (m.type === "star")
            obj = new fabric.Polygon(
              starPoints(
                coords.left * w + (coords.width * w) / 2,
                coords.top * h + (coords.height * h) / 2,
                coords.width * w,
                coords.height * h,
              ).map((p) => new fabric.Point(p.x, p.y)),
              { fill, stroke, strokeWidth, strokeDashArray: dash },
            );
          else if (m.type === "cloud") {
            obj = new fabric.Path(
              makeCloudPath(
                coords.left * w,
                coords.top * h,
                coords.width * w,
                coords.height * h,
                (props.cloudArcSize || 20) * s,
              ),
              { fill, stroke, strokeWidth, strokeDashArray: dash },
            );
            if (coords.angle) obj.set({ angle: coords.angle });
          }
          else if (m.type === "line" || m.type === "measure") {
            if (m.type === "line") {
              obj = new fabric.Line(
                [coords.x1 * w, coords.y1 * h, coords.x2 * w, coords.y2 * h],
                { stroke, strokeWidth, strokeDashArray: dash },
              );
            } else {
              // Measure: render as Path (line + ticks) to avoid Group positioning bugs
              const x1 = coords.x1 * w, y1 = coords.y1 * h, x2 = coords.x2 * w, y2 = coords.y2 * h;
              const mdx = x2 - x1, mdy = y2 - y1, mlen = Math.sqrt(mdx * mdx + mdy * mdy);
              const tickSz = (props.tickSize ?? 6) * s;
              let pathStr = `M ${x1} ${y1} L ${x2} ${y2}`; // main line
              if (mlen > 1) {
                const ux = mdx / mlen, uy = mdy / mlen;
                const nx = -uy, ny = ux;
                // Ticks at start and end
                pathStr += ` M ${x1 - nx * tickSz} ${y1 - ny * tickSz} L ${x1 + nx * tickSz} ${y1 + ny * tickSz}`;
                pathStr += ` M ${x2 - nx * tickSz} ${y2 - ny * tickSz} L ${x2 + nx * tickSz} ${y2 + ny * tickSz}`;
                // Extension lines
                const extSz = (props.extensionSize ?? 0) * s;
                if (extSz > 0) {
                  pathStr += ` M ${x1} ${y1} L ${x1 - ux * extSz} ${y1 - uy * extSz}`;
                  pathStr += ` M ${x2} ${y2} L ${x2 + ux * extSz} ${y2 + uy * extSz}`;
                }
              }
              obj = new fabric.Path(pathStr, {
                stroke, strokeWidth, strokeDashArray: dash,
                fill: 'transparent', objectCaching: true,
              });
              // Measure label: separate Text object (not grouped) — added after canvas.add(obj) below
              const distP = mlen / s;
              const mAngle = Math.atan2(mdy, mdx) * (180 / Math.PI);
              let tA = mAngle; if (tA > 90 || tA < -90) tA -= 180;
              const { text: mText } = formatMeasurement(distP, docScaleRef.current);
              const lblFontSize = (props.fontSize || 14) * s;
              const lblFill = props.labelTextColor || props.textColor || stroke;
              const lblBg = props.labelBg || 'rgba(255,255,255,0.85)';
              const lblWidth = mText.length * lblFontSize * 0.6;
              const labelOnLine = mlen > lblWidth * 1.5;
              const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
              // Remove old label if exists
              const oldMeasureLbl = auxLabelCache.current.get(m.id);
              if (oldMeasureLbl) { canvas.remove(oldMeasureLbl); auxLabelCache.current.delete(m.id); }
              const measureLbl = new fabric.Text(mText, {
                left: midX, top: labelOnLine ? midY : midY - lblFontSize - 4 * s,
                fontSize: lblFontSize, fill: lblFill,
                fontFamily: props.fontFamily || 'Arial', fontWeight: props.fontWeight || 'normal',
                originX: 'center', originY: 'bottom',
                angle: labelOnLine ? tA : 0,
                selectable: false, evented: false,
                textBackgroundColor: lblBg,
              });
              auxLabelCache.current.set(m.id, measureLbl);
              // Will be added to canvas after obj is added (see below)
              (obj as any)._auxLabel = measureLbl;
            }
          } else if (m.type === "arrow") {
            // Render arrow as a single fabric.Path (not a Group) to avoid Fabric.js v5
            // Group positioning bugs. Path objects work correctly (proven by Cloud type).
            const arrowSize = (props.arrowSize || 10) * Math.max(1, strokeWidth / 2) * s;
            const arrowStyle = props.arrowStyle || 'end'; // 'end' | 'start' | 'both'
            const x1 = coords.x1 * w, y1 = coords.y1 * h, x2 = coords.x2 * w, y2 = coords.y2 * h;
            const ang = Math.atan2(y2 - y1, x2 - x1);
            // Build SVG path: line shaft + arrowhead(s)
            let pathStr = `M ${x1} ${y1} L ${x2} ${y2}`;
            if (arrowStyle === 'end' || arrowStyle === 'both') {
              const ax1 = x2 - arrowSize * Math.cos(ang - Math.PI / 6);
              const ay1 = y2 - arrowSize * Math.sin(ang - Math.PI / 6);
              const ax2 = x2 - arrowSize * Math.cos(ang + Math.PI / 6);
              const ay2 = y2 - arrowSize * Math.sin(ang + Math.PI / 6);
              pathStr += ` M ${ax1} ${ay1} L ${x2} ${y2} L ${ax2} ${ay2} Z`;
            }
            if (arrowStyle === 'start' || arrowStyle === 'both') {
              const bx1 = x1 + arrowSize * Math.cos(ang - Math.PI / 6);
              const by1 = y1 + arrowSize * Math.sin(ang - Math.PI / 6);
              const bx2 = x1 + arrowSize * Math.cos(ang + Math.PI / 6);
              const by2 = y1 + arrowSize * Math.sin(ang + Math.PI / 6);
              pathStr += ` M ${bx1} ${by1} L ${x1} ${y1} L ${bx2} ${by2} Z`;
            }
            obj = new fabric.Path(pathStr, {
              stroke, strokeWidth, strokeDashArray: dash,
              fill: stroke, // fill the arrowhead
              objectCaching: true,
            });
          } else if (m.type === "polyline" || m.type === "routeTemplate" || m.type === "route") {
            const pts = (coords.points || []) as { x: number; y: number }[];
            if (pts.length >= 2) {
              const canvasPts = pts.map((p: any) => ({ x: p.x * w, y: p.y * h }));
              let totalDist = 0;
              for (let i = 1; i < canvasPts.length; i++) {
                const ddx = canvasPts[i].x - canvasPts[i-1].x, ddy = canvasPts[i].y - canvasPts[i-1].y;
                totalDist += Math.sqrt(ddx*ddx + ddy*ddy) / s;
              }
              // Render polyline as a single fabric.Path (not Group) to avoid positioning bugs
              let pathStr = `M ${canvasPts[0].x} ${canvasPts[0].y}`;
              for (let i = 1; i < canvasPts.length; i++) {
                pathStr += ` L ${canvasPts[i].x} ${canvasPts[i].y}`;
              }
              obj = new fabric.Path(pathStr, {
                stroke, strokeWidth, strokeDashArray: dash,
                fill: 'transparent',
                strokeLineCap: 'round', strokeLineJoin: 'round',
                objectCaching: true,
              });
              // Remove old label
              const oldPolyLbl = auxLabelCache.current.get(m.id);
              if (oldPolyLbl) { canvas.remove(oldPolyLbl); auxLabelCache.current.delete(m.id); }
              // Length label at midpoint (separate Text, not grouped)
              // Build label text: length + optional conduit label
              const showLength = props.showLength !== false;
              const labelText = props.redlineLabel || props.label;
              let displayText = '';
              if (showLength) {
                const { text: lenText } = formatMeasurement(totalDist, docScaleRef.current);
                displayText = lenText;
              }
              if (labelText && props.showLabel !== false) {
                displayText = displayText ? `${labelText}  ${displayText}` : String(labelText);
              }
              if (displayText && canvasPts.length >= 2) {
                const midPt = canvasPts[Math.floor(canvasPts.length / 2)];
                const polyLbl = new fabric.Text(displayText, {
                  left: midPt.x, top: midPt.y - 15 * s,
                  fontSize: 14 * s, fill: stroke, fontFamily: 'Arial',
                  originX: 'center', originY: 'bottom',
                  selectable: false, evented: false,
                  textBackgroundColor: 'rgba(255,255,255,0.7)',
                });
                auxLabelCache.current.set(m.id, polyLbl);
                (obj as any)._auxLabel = polyLbl;
              }
            }
          } else if (["pen", "highlighter"].includes(m.type)) {
            if (coords.path) {
              const isHighlightPath = m.type === 'highlighter';
              obj = new fabric.Path(coords.path, {
                fill: "transparent",
                stroke: isHighlightPath ? "transparent" : stroke,
                strokeWidth,
                strokeDashArray: dash,
                left: coords.left * w,
                top: coords.top * h,
              });
              // If coords has explicit width/height (from resize), use it. Otherwise scale from original.
              if (coords.width && coords.height && obj.width && obj.height) {
                obj.set({ scaleX: (coords.width * w) / obj.width, scaleY: (coords.height * h) / obj.height });
              } else {
                const origW = props.originalWidth || w, origH = props.originalHeight || h;
                obj.set({ scaleX: w / origW, scaleY: h / origH });
              }
            } else if (coords.width !== undefined && coords.height !== undefined) {
              // Rect-based highlight — visible semi-transparent rect, fully interactive
              const hlFill = stroke && stroke !== 'transparent'
                ? hexToRgba(stroke, 0.35)
                : 'rgba(255,235,59,0.35)';
              obj = new fabric.Rect({
                left: coords.left * w,
                top: coords.top * h,
                width: coords.width * w,
                height: coords.height * h,
                fill: 'rgba(0,0,0,0.001)', // Near-transparent: ensures Fabric hit-test detects drag; visual rendering is via highlightCanvasRef
                stroke: 'transparent',
                strokeWidth: 0,
                perPixelTargetFind: false,
              });
            }
          } else if (m.type === "stickyNote") {
            // Miro-style sticky note: colored background Textbox with shadow
            const noteBg = (props.fill && props.fill !== 'transparent') ? props.fill : '#FFEB3B';
            const noteTextColor = props.textColor || '#212121';
            const notePad = Math.round(10 * s);
            obj = new fabric.Textbox(props.text || "", {
              left: coords.left * w,
              top: coords.top * h,
              width: (coords.width || 0.18) * w,
              fontSize: (props.fontSize || 14) * s,
              fill: noteTextColor,
              fontFamily: props.fontFamily || "Arial",
              fontWeight: props.fontWeight || "normal",
              fontStyle: (props.fontStyle as any) || "normal",
              textAlign: props.textAlign || "left",
              backgroundColor: noteBg,
              padding: notePad,
              stroke: "transparent",
              strokeWidth: 0,
              editable: false, // NEVER use Fabric enterEditing — HTML textarea overlay handles editing (avoids black screen)
              objectCaching: false,
              shadow: new (fabric as any).Shadow({ color: 'rgba(0,0,0,0.25)', blur: 10 * s, offsetX: 2 * s, offsetY: 4 * s }),
            });
          } else if (m.type === "text") {
            const borderColor = props.stroke && props.stroke !== 'transparent' ? props.stroke : (props.borderColor || null);
            const effectiveBorderWidth = (props.strokeWidth || 0) > 0 ? props.strokeWidth : (props.borderWidth || 0);
            const hasBorder = !!borderColor && borderColor !== 'transparent' && effectiveBorderWidth > 0;
            obj = new fabric.Textbox(props.text || "Text", {
              left: coords.left * w,
              top: coords.top * h,
              width: (coords.width || 0.2) * w,
              fontSize: (props.fontSize || 20) * s,
              fill: props.textColor || '#000000',
              fontFamily: props.fontFamily || "Arial",
              fontWeight: props.fontWeight || "normal",
              fontStyle: props.fontStyle || "normal",
              textAlign: props.textAlign || "left",
              backgroundColor: fill === "transparent" ? "" : fill,
              stroke: "transparent",
              strokeWidth: 0,
              editable: false, // NEVER use Fabric enterEditing — HTML textarea overlay handles editing (avoids black screen)
              objectCaching: false,
            });
            // Rectangular border — companion Rect drawn behind the Textbox
            if (hasBorder) {
              const tbH = (obj as any).height || 50;
              const bRect = new fabric.Rect({
                left: coords.left * w,
                top: coords.top * h,
                width: (coords.width || 0.2) * w,
                height: tbH,
                originX: 'left',
                originY: 'top',
                fill: 'transparent',
                stroke: borderColor!,
                strokeWidth: effectiveBorderWidth,
                selectable: false,
                evented: false,
              });
              bRect.set('data', { id: m.id, type: 'textBorder' });
              textBorderCache.current.set(m.id, bRect);
            }
          }
          // ── Electrical Box: rectangle with centered text (or detailed support shape) ──
          if (m.type === 'electricalBox') {
            // Render as single Rect at absolute position (not Group) + text as auxLabel
            const bw = (coords.width || 0.03) * w;
            const bh = (coords.height || 0.03) * h;
            const bLeft = (coords.left || 0) * w;
            const bTop = (coords.top || 0) * h;
            const boxText = props.text !== undefined && props.text !== null ? String(props.text) : (props.boxType || 'JB');
            const supportShape = props.supportShape;
            const ebTextColor = props.textColor || stroke;
            const ebCustomFontSize = props.fontSize ? props.fontSize * (w / 1000) : null;
            const ebFillColor = props.fill && props.fill !== 'transparent'
              ? hexToRgba(props.fill, props.fillOpacity ?? 0.85)
              : 'rgba(255,255,255,0.85)';
            const ebBorderRadius = props.borderRadius || 0;

            if (supportShape === 'hanger') {
              const r = Math.min(bw, bh) / 2;
              obj = new fabric.Circle({ left: bLeft + bw / 2 - r, top: bTop + bh / 2 - r, radius: r, fill: ebFillColor, stroke, strokeWidth });
            } else {
              obj = new fabric.Rect({
                left: bLeft, top: bTop, width: bw, height: bh,
                fill: ebFillColor, stroke, strokeWidth, strokeDashArray: dash,
                rx: ebBorderRadius, ry: ebBorderRadius,
              });
            }

            // Text as separate auxLabel
            const oldEbLbl = auxLabelCache.current.get(m.id);
            if (oldEbLbl) { canvas.remove(oldEbLbl); auxLabelCache.current.delete(m.id); }
            if (supportShape !== 'hanger' && boxText) {
              const isSupport = supportShape === 'trapeze' || supportShape === 'unistrut';
              const ebFontSize = isSupport
                ? Math.max(6, ebCustomFontSize || bw * 0.15)
                : Math.max(6, ebCustomFontSize || Math.min(bw, bh) * (boxText.length > 3 ? 0.35 : 0.5));
              const ebLbl = new fabric.Text(boxText, {
                left: bLeft + bw / 2,
                top: isSupport ? bTop - ebFontSize - 2 : bTop + bh / 2,
                fontSize: ebFontSize,
                originX: 'center', originY: isSupport ? 'top' : 'center',
                fill: ebTextColor, fontFamily: 'Arial', fontWeight: 'bold',
                selectable: false, evented: false,
              });
              auxLabelCache.current.set(m.id, ebLbl);
              (obj as any)._auxLabel = ebLbl;
            }
          }

          // ── Stub: circle with SU/SD text ──
          else if (m.type === 'stub') {
            // Render as Circle at absolute position (not Group) + text as auxLabel
            const sr = ((coords.width || 0.018) * w) / 2;
            const sLeft = (coords.left || 0) * w;
            const sTop = (coords.top || 0) * h;
            const isDown = props.stubDirection === 'down';
            const stubText = props.text !== undefined && props.text !== null ? String(props.text) : (isDown ? 'SD' : 'SU');
            const stubFillColor = props.fill && props.fill !== 'transparent'
              ? hexToRgba(props.fill, props.fillOpacity ?? 1)
              : (isDown ? stroke : 'transparent');
            const stubTextColor = props.textColor || (isDown ? '#ffffff' : stroke);
            const stubCustomFontSize = props.fontSize ? props.fontSize * (w / 1000) : null;
            obj = new fabric.Circle({ left: sLeft, top: sTop, radius: sr, fill: stubFillColor, stroke, strokeWidth });
            const oldStubLbl = auxLabelCache.current.get(m.id);
            if (oldStubLbl) { canvas.remove(oldStubLbl); auxLabelCache.current.delete(m.id); }
            if (stubText) {
              const stubLbl = new fabric.Text(stubText, {
                left: sLeft + sr, top: sTop + sr,
                fontSize: stubCustomFontSize || Math.max(6, sr * 0.85),
                originX: 'center', originY: 'center',
                fill: stubTextColor, fontFamily: 'Arial', fontWeight: 'bold',
                selectable: false, evented: false,
              });
              auxLabelCache.current.set(m.id, stubLbl);
              (obj as any)._auxLabel = stubLbl;
            }
          }

          // ── Panel: Rect at absolute position (not Group) + text as auxLabel ──
          else if (m.type === 'panel') {
            const pw = (coords.width || 0.05) * w;
            const ph = (coords.height || 0.04) * h;
            const pLeft = (coords.left || 0) * w;
            const pTop = (coords.top || 0) * h;
            const panelText = props.text !== undefined && props.text !== null ? String(props.text) : 'PANEL';
            const panelTextColor = props.textColor || stroke;
            const panelCustomFontSize = props.fontSize ? props.fontSize * s : null;
            const fillC = (props.fill && props.fill !== 'transparent') ? props.fill : 'rgba(255,255,255,0.9)';
            obj = new fabric.Rect({ left: pLeft, top: pTop, width: pw, height: ph, fill: fillC, stroke, strokeWidth: strokeWidth * 1.5 });
            const oldPanelLbl = auxLabelCache.current.get(m.id);
            if (oldPanelLbl) { canvas.remove(oldPanelLbl); auxLabelCache.current.delete(m.id); }
            const nameFontSize = panelCustomFontSize || Math.max(6, Math.min(pw * 0.2, ph * 0.3));
            const panelLbl = new fabric.Text(panelText, {
              left: pLeft + pw / 2, top: pTop + ph / 2,
              fontSize: nameFontSize, originX: 'center', originY: 'center',
              fill: panelTextColor, fontFamily: 'Arial', fontWeight: 'bold',
              selectable: false, evented: false,
            });
            auxLabelCache.current.set(m.id, panelLbl);
            (obj as any)._auxLabel = panelLbl;
          }

          // ── Wire Tag: Path (vertical + horizontal leader) + text as auxLabel ──
          else if (m.type === 'wireTag') {
            const x1 = (coords.x1 || 0) * w, y1 = (coords.y1 || 0) * h;
            const x2 = (coords.x2 || 0) * w, y2 = (coords.y2 || 0) * h;
            const tagText = props.text || '#12 AWG';
            const wtTextColor = props.textColor || stroke;
            const wtCustomFontSize = props.fontSize ? props.fontSize * (w / 1000) : null;
            const leaderDir = x2 >= x1 ? 1 : -1;
            // Render leader lines as Path
            const wtPathStr = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
            obj = new fabric.Path(wtPathStr, { stroke, strokeWidth, fill: 'transparent', objectCaching: true });
            const oldWtLbl = auxLabelCache.current.get(m.id);
            if (oldWtLbl) { canvas.remove(oldWtLbl); auxLabelCache.current.delete(m.id); }
            const wtLbl = new fabric.Text(tagText, {
              left: x2 + 4 * leaderDir, top: y2,
              fontSize: wtCustomFontSize || 12 * s,
              originX: leaderDir > 0 ? 'left' : 'right',
              originY: 'center',
              fill: wtTextColor, fontFamily: 'Arial', fontWeight: 'bold',
              textBackgroundColor: 'rgba(255,255,255,0.8)',
              selectable: false, evented: false,
            });
            auxLabelCache.current.set(m.id, wtLbl);
            (obj as any)._auxLabel = wtLbl;
          }

          // ── Review Stamp: render shape as Rect at absolute coords (not Group) + text as auxLabel ──
          else if (m.type === 'reviewStamp') {
            const rw = (coords.width || 0.08) * w;
            const rh = (coords.height || 0.035) * h;
            const rLeft = (coords.left || 0) * w;
            const rTop = (coords.top || 0) * h;
            const stampText = props.text !== undefined && props.text !== null ? String(props.text) : '?';
            const shape = props.stampShape || 'rounded';
            const hasFill = props.stampFill !== false;
            const rsActualFill = props.fill && props.fill !== 'transparent'
              ? hexToRgba(props.fill, props.fillOpacity ?? 1)
              : (hasFill ? stroke : 'transparent');
            // Filled stamps: white text by default. Only use custom textColor if it's NOT the stroke/fill color.
            const hasCustomTextColor = props.textColor && props.textColor.toLowerCase() !== stroke.toLowerCase()
              && props.textColor.toLowerCase() !== (props.fill || '').toLowerCase();
            const rsTextColor = hasFill ? (hasCustomTextColor ? props.textColor : '#ffffff') : (props.textColor || stroke);
            const rsBorderRadius = props.borderRadius || 0;
            const baseFontSize = Math.min(rw, rh) * 0.55;
            const rsCustomFontSize = props.fontSize ? props.fontSize * (w / 1000) : null;
            const rsFontSize = rsCustomFontSize || Math.max(8, baseFontSize * (stampText.length > 8 ? 0.6 : stampText.length > 5 ? 0.75 : 1));
            const shapeFontScale = (shape === 'triangle' || shape === 'diamond') ? 0.65 : 1;

            // Render shape as a single Rect (most common) at absolute position — no Group
            const rx = rsBorderRadius || (shape === 'rounded' ? rh * 0.35 : (shape === 'cloud' ? rh * 0.4 : 0));
            const ry = rx;
            const shapeFill = shape === 'cloud'
              ? (props.fill && props.fill !== 'transparent' ? hexToRgba(props.fill, props.fillOpacity ?? 0.9) : 'rgba(255,255,255,0.9)')
              : rsActualFill;
            const shapeSW = shape === 'cloud' ? strokeWidth * 2 : strokeWidth * 1.5;
            const shapeDash = shape === 'cloud' ? [4, 3] : undefined;

            obj = new fabric.Rect({
              left: rLeft, top: rTop, width: rw, height: rh,
              rx, ry, fill: shapeFill, stroke, strokeWidth: shapeSW,
              strokeDashArray: shapeDash,
            });

            // Text label as separate object
            const oldStampLbl = auxLabelCache.current.get(m.id);
            if (oldStampLbl) { canvas.remove(oldStampLbl); auxLabelCache.current.delete(m.id); }
            const textTopOffset = shape === 'triangle' ? rTop + rh * 0.6 : rTop + rh / 2;
            const stampLbl = new fabric.Text(stampText, {
              left: rLeft + rw / 2, top: textTopOffset,
              fontSize: rsFontSize * shapeFontScale,
              originX: 'center', originY: 'center',
              fill: shape === 'cloud' ? (props.textColor || stroke) : rsTextColor,
              fontFamily: 'Arial', fontWeight: 'bold',
              selectable: false, evented: false,
            });
            auxLabelCache.current.set(m.id, stampLbl);
            (obj as any)._auxLabel = stampLbl;
          }

          // Image markup — async load, handled separately
          if (m.type === 'image' && props.imageData) {
            const imgLeft = (coords.left || 0) * w;
            const imgTop = (coords.top || 0) * h;
            const imgW = (coords.width || 0.2) * w;
            const imgH = (coords.height || 0.2) * h;
            const mId = m.id;
            hashes.set(mId, newHash);
            fabric.Image.fromURL(props.imageData, (imgObj: fabric.Image) => {
              if (!fabricCanvas.current || isDisposing.current) return;
              const c2 = fabricCanvas.current;
              // Remove previous if still present (hash changed path)
              const prev2 = cache.get(mId);
              if (prev2) { c2.remove(prev2); cache.delete(mId); }
              imgObj.set({
                left: imgLeft,
                top: imgTop,
                scaleX: imgW / (imgObj.width || 1),
                scaleY: imgH / (imgObj.height || 1),
                originX: 'left',
                originY: 'top',
                selectable: isSelect,
                evented: isSelect,
                lockMovementX: effectiveLocked,
                lockMovementY: effectiveLocked,
                lockRotation: effectiveLocked,
                lockScalingX: effectiveLocked,
                lockScalingY: effectiveLocked,
                hasControls: !effectiveLocked,
              });
              if (coords.angle !== undefined) imgObj.angle = coords.angle;
              (imgObj as any).data = { id: mId, type: 'image', canEdit };
              c2.add(imgObj);
              cache.set(mId, imgObj);
              c2.requestRenderAll();
            }, { crossOrigin: 'anonymous' });
            continue;
          }

          if (obj) {
            if (coords.angle !== undefined) obj.angle = coords.angle;
            // Store original cloud logical bounds so movement handlers can compute
            // coords without getBoundingRect (which inflates due to arc bumps + stroke).
            const cloudOrigData: any = {};
            if (m.type === 'callout' && coords.cloud) {
              cloudOrigData._cloudOrigLeft = coords.cloud.left * w;
              cloudOrigData._cloudOrigTop = coords.cloud.top * h;
              cloudOrigData._cloudOrigWidth = coords.cloud.width * w;
              cloudOrigData._cloudOrigHeight = coords.cloud.height * h;
            } else if (m.type === 'cloud') {
              cloudOrigData._cloudOrigLeft = coords.left * w;
              cloudOrigData._cloudOrigTop = coords.top * h;
              cloudOrigData._cloudOrigWidth = coords.width * w;
              cloudOrigData._cloudOrigHeight = coords.height * h;
            }
            // Build self-contained coord cache so object:modified never needs markupsRef lookup
            const _coordsCache: any = {};
            // NOTE: _cx/_cy for groups are set AFTER canvas.add() below — getCenterPoint()
            // returns correct absolute canvas coords only after the object is added to canvas.
            if (['arrow', 'measure', 'wireTag'].includes(m.type)) {
              _coordsCache._x1 = coords.x1 ?? 0;
              _coordsCache._y1 = coords.y1 ?? 0;
              _coordsCache._x2 = coords.x2 ?? 0;
              _coordsCache._y2 = coords.y2 ?? 0;
              // Store original pixel endpoints for arrow Path transform computation
              _coordsCache._origPx1 = (coords.x1 ?? 0) * w;
              _coordsCache._origPy1 = (coords.y1 ?? 0) * h;
              _coordsCache._origPx2 = (coords.x2 ?? 0) * w;
              _coordsCache._origPy2 = (coords.y2 ?? 0) * h;
            } else if (['polyline', 'routeTemplate', 'route'].includes(m.type)) {
              _coordsCache._pts = coords.points ? JSON.parse(JSON.stringify(coords.points)) : [];
            } else if (['electricalBox', 'stub', 'panel', 'reviewStamp'].includes(m.type)) {
              _coordsCache._cl = coords.left ?? 0;
              _coordsCache._ct = coords.top ?? 0;
              _coordsCache._cw = coords.width ?? 0;
              _coordsCache._ch = coords.height ?? 0;
            }
            obj.set("data", {
              id: m.id,
              type: m.type,
              _lastLeft: obj.left,
              _lastTop: obj.top,
              ..._coordsCache,
              canEdit,
              sessionId: m.properties?.sessionId,
              locked: !!props.locked,
              ...cloudOrigData,
            });
            const isHighlightObj = m.type === 'highlighter';
            const fullyLockedObj = effectiveLocked || isHighlightObj;
            obj.set({
              selectable: isSelect,
              evented: isSelect,
              lockMovementX: fullyLockedObj,
              lockMovementY: fullyLockedObj,
              lockRotation: fullyLockedObj,
              lockScalingX: fullyLockedObj,
              lockScalingY: fullyLockedObj,
              hasControls: !fullyLockedObj,
            });
            canvas.add(obj);
            // Recompute _cx/_cy AFTER canvas.add — Fabric.js v5 Group finalizes absolute
            // canvas position only after being added. Pre-add getCenterPoint() returns local
            // coords (relative to origin), causing wrong delta in object:modified → fly-to-corner.
            if (obj.type === 'group') {
              const cp = obj.getCenterPoint();
              (obj as any).data._cx = cp.x;
              (obj as any).data._cy = cp.y;
              // Also update _lastLeft/_lastTop AFTER canvas.add since Group position may shift
              (obj as any).data._lastLeft = obj.left;
              (obj as any).data._lastTop = obj.top;
            }
            // Polylines cannot be rotated (vertex edit is the right tool) — hide rotation handle
            if (['polyline', 'routeTemplate', 'route'].includes(m.type)) {
              obj.setControlsVisibility({ mtr: false });
            }
            // Add auxiliary label (measure/polyline/stamp text) on top of the shape
            if ((obj as any)._auxLabel) {
              const auxLbl = (obj as any)._auxLabel;
              canvas.add(auxLbl);
              // When shape has angle, Fabric adjusts left/top so center stays put.
              // Simple (left+w/2, top+h/2) is WRONG for rotated shapes — we must
              // use getCenterPoint() which accounts for the angle adjustment.
              if (obj.angle) {
                const center = obj.getCenterPoint();
                auxLbl.set({ left: center.x, top: center.y, angle: obj.angle });
                auxLbl.setCoords();
              }
              delete (obj as any)._auxLabel;
            }
            // Add text border rect behind the textbox
            if (m.type === 'text' && textBorderCache.current.has(m.id)) {
              const bRect = textBorderCache.current.get(m.id)!;
              canvas.add(bRect);
            }
            // Author label: small colored text below the markup
            if (showAuthorOnMarkupRef.current) {
              const authorName: string | undefined = m.properties?.bluebeamAuthor || m.author?.name;
              if (authorName) {
                const bounds = obj.getBoundingRect(true);
                const labelFontSize = Math.max(7, 9 * s);
                // Deterministic color from author name
                const ACOLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9'];
                let ah = 0;
                for (let i = 0; i < authorName.length; i++) ah = ((ah << 5) - ah + authorName.charCodeAt(i)) | 0;
                const authorColor = ACOLORS[Math.abs(ah) % ACOLORS.length];
                const authorLabel = new fabric.Text(authorName, {
                  left: bounds.left + bounds.width / 2,
                  top: bounds.top + bounds.height + 2,
                  originX: 'center',
                  originY: 'top',
                  fontSize: labelFontSize,
                  fontFamily: 'Arial',
                  fontWeight: 'bold',
                  fill: authorColor,
                  textBackgroundColor: 'rgba(0,0,0,0.5)',
                  selectable: false,
                  evented: false,
                  objectCaching: false,
                });
                canvas.add(authorLabel);
                authorLabelCache.current.set(m.id, authorLabel);
              }
            }
            cache.set(m.id, obj);
            hashes.set(m.id, newHash);
          }
        }
        // Z-order: only sort+bringToFront when zIndexes actually changed
        const newZHash = (mks || []).map(m => `${m.id}:${m.properties?.zIndex ?? 0}`).join(',');
        if (newZHash !== lastZOrderHashRef.current) {
          lastZOrderHashRef.current = newZHash;
          [...(mks || [])]
            .sort(
              (a, b) => (a.properties?.zIndex || 0) - (b.properties?.zIndex || 0),
            )
            .forEach((m) => {
              // For text with border: bring border rect first, then textbox on top
              if (m.type === 'text' && textBorderCache.current.has(m.id)) {
                textBorderCache.current.get(m.id)?.bringToFront();
              }
              // For callout: connector line → cloud → textboxBg → textbox/tail
              if (m.type === 'callout' && m.coordinates?.cloud) {
                calloutLineCache.current.get(m.id)?.bringToFront();
              }
              cache.get(m.id)?.bringToFront();
              if (m.type === 'callout' && m.coordinates?.cloud) {
                calloutTextboxBgCache.current.get(m.id)?.bringToFront();
                calloutTailCache.current.get(m.id)?.bringToFront();
              }
            });
        }

        // Restore selection if objects were replaced during sync
        if (prevActiveIds.length > 0) {
          // Check if the previously active object was a callout textbox
          const prevActivePart = activeObj?.data?.part;
          const toSelect = prevActiveIds
            .map((id) => {
              // If textbox was active, re-select the textbox (not the cloud)
              if (prevActivePart === 'textbox') {
                return calloutTailCache.current.get(id) || cache.get(id);
              }
              return cache.get(id);
            })
            .filter(Boolean) as fabric.Object[];
          if (toSelect.length === 1) {
            const selObj = toSelect[0];
            // Full coord recalculation for groups (polyline, measure, etc.)
            if (selObj.type === 'group') {
              (selObj as fabric.Group).setObjectsCoords?.();
              selObj._calcBounds?.();
            }
            selObj.setCoords();
            canvas.setActiveObject(selObj);
          } else if (toSelect.length > 1) {
            const sel = new fabric.ActiveSelection(toSelect, { canvas });
            sel.setCoords();
            canvas.setActiveObject(sel);
          }
        }

        isInSync.current = false;
        canvas.requestRenderAll();
      },
      [hiddenLayers],
    );

    useEffect(() => {
      const canvas = fabricCanvas.current;
      if (!canvas) return;
      // Only call setDimensions when canvas size actually changed — setDimensions clears
      // the entire HTML canvas via _initRetinaScaling (setAttribute width) → black screen.
      // NEVER call during text editing — it would destroy the editing state.
      if (canvas.getWidth() !== width || canvas.getHeight() !== height) {
        if (!textEditingMarkupId.current) {
          canvas.setDimensions({ width, height });
          canvas.getObjects().forEach((obj: any) => { obj.dirty = true; });
        }
      }
      syncMarkups(canvas, markups, width, height, scale);
      // Ensure auxLabels (measure/polyline/stamp text) are always on top of their shapes.
      // After syncMarkups adds/removes objects, z-order may be wrong.
      for (const lbl of auxLabelCache.current.values()) {
        if (lbl.canvas) canvas.bringToFront(lbl);
      }
      // Author labels also on top
      for (const lbl of authorLabelCache.current.values()) {
        if (lbl.canvas) canvas.bringToFront(lbl);
      }
    }, [width, height, scale, syncMarkups, markups, docScale, activeSessionId, showAuthorOnMarkup]);

    // ── Highlight canvas: draw highlighter strokes with mix-blend-mode:multiply ──
    useEffect(() => {
      const hlCanvas = highlightCanvasRef.current;
      if (!hlCanvas) return;

      // Skip expensive redraw if no highlighter-related data changed
      const hidden = hiddenLayers || [];
      const hlHash = markups
        .filter(m => m.type === 'highlighter')
        .map(m => {
          const c = m.coordinates || {};
          return `${m.id}:${m.updatedAt || m.createdAt || 0}:${c.left ?? ''}:${c.top ?? ''}:${c.width ?? ''}:${c.height ?? ''}`;
        })
        .join(',') + `|${width}|${height}|${hidden.join(',')}`;
      if (hlHash === lastHighlightHashRef.current) return;
      lastHighlightHashRef.current = hlHash;

      hlCanvas.width = width;
      hlCanvas.height = height;
      const ctx = hlCanvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const m of markups) {
        if (m.type !== 'highlighter') continue;
        if (hidden.includes(m.authorId)) continue;
        const coords = m.coordinates || {};
        const props = m.properties || {};
        const stroke = props.stroke || '#ffff00';

        if (!coords.path && coords.width !== undefined && coords.height !== undefined) {
          // Rect-based highlight (Bluebeam style) — coordinates are normalized (0-1)
          const rx = (coords.left || 0) * hlCanvas.width;
          const ry = (coords.top || 0) * hlCanvas.height;
          const rw = coords.width * hlCanvas.width;
          const rh = coords.height * hlCanvas.height;
          ctx.save();
          ctx.fillStyle = stroke;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(rx, ry, rw, rh);
          ctx.restore();
          continue;
        }

        if (!coords.path) continue;
        const origW = props.originalWidth || width;
        const origH = props.originalHeight || height;
        const sx = width / origW;
        const sy = height / origH;
        // Fabric PencilBrush stores path commands in ABSOLUTE canvas coordinates,
        // so just scale them to the current canvas size — no translate needed.
        const strokeWidth = (props.strokeWidth || 12);
        // Convert Fabric path array to SVG path string for Path2D
        const pathStr = Array.isArray(coords.path)
          ? (coords.path as any[][]).map(cmd => Array.isArray(cmd) ? cmd.join(' ') : String(cmd)).join(' ')
          : String(coords.path);
        try {
          ctx.save();
          ctx.scale(sx, sy);
          ctx.strokeStyle = stroke;
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke(new Path2D(pathStr));
          ctx.restore();
        } catch (_) { /* ignore malformed paths */ }
      }
    }, [markups, width, height, hiddenLayers]);
    useEffect(() => {
      const canvas = fabricCanvas.current;
      if (!canvas) return;
      // Don't forcibly change active object while user is typing in a textbox —
      // discardActiveObject() would call exitEditing() → clears canvas text edit (black screen)
      const currentActive = canvas.getActiveObject() as any;
      if (currentActive?.isEditing) return;
      // Don't interfere while entering text editing (dblclick → enterEditing RAF pending)
      if (textEditingMarkupId.current) return;
      const activeObj = currentActive,
        activeIds = activeObj
          ? activeObj.type === "activeSelection"
            ? (activeObj as fabric.ActiveSelection)
                .getObjects()
                .map((o: any) => o.data?.id)
            : [(activeObj as any).data?.id]
          : [];
      if (
        JSON.stringify([...selectedMarkupIds].sort()) !==
        JSON.stringify([...activeIds].sort())
      ) {
        isProgrammaticSelect.current = true;
        canvas.discardActiveObject();
        const toSelect = (markups || [])
          .filter((m) => selectedMarkupIds.includes(m.id))
          .map((m) => objectCache.current.get(m.id))
          .filter(Boolean) as fabric.Object[];
        if (toSelect.length === 1) canvas.setActiveObject(toSelect[0]);
        else if (toSelect.length > 1)
          canvas.setActiveObject(
            new fabric.ActiveSelection(toSelect, { canvas }),
          );
        canvas.requestRenderAll();
        isProgrammaticSelect.current = false;
      }
    }, [selectedMarkupIds]);

    const handleVertexSplit = useCallback((markupId: string, handleIdx: number) => {
      const pts = vertexPoints.current;
      if (pts.length < 2 || handleIdx <= 0 || handleIdx >= pts.length) { setVertexMenu(null); return; }
      const cvs = fabricCanvas.current; if (!cvs) return;
      const w = cvs.getWidth(), h = cvs.getHeight(), s = scaleRef.current;
      const markup = vertexMarkupDataRef.current; if (!markup) return;
      const pts1 = pts.slice(0, handleIdx + 1);
      const pts2 = pts.slice(handleIdx);
      const computeLen = (ps: { x: number; y: number }[]) => {
        let len = 0;
        for (let i = 1; i < ps.length; i++) {
          const dx = (ps[i].x - ps[i-1].x) / s, dy = (ps[i].y - ps[i-1].y) / s;
          len += Math.sqrt(dx*dx + dy*dy);
        }
        return len;
      };
      onMarkupAddedRef.current?.({
        type: 'polyline', pageNumber: markup.pageNumber,
        coordinates: { points: pts1.map(p => ({ x: p.x / w, y: p.y / h })) },
        properties: { ...markup.properties, pathLength: computeLen(pts1) },
      });
      onMarkupAddedRef.current?.({
        type: 'polyline', pageNumber: markup.pageNumber,
        coordinates: { points: pts2.map(p => ({ x: p.x / w, y: p.y / h })) },
        properties: { ...markup.properties, pathLength: computeLen(pts2) },
      });
      onMarkupDeletedRef.current?.(markupId);
      vertexExitFnRef.current?.(false);
      onMarkupSelectedRef.current?.([]);   // clear selection so panel shows the new polylines
      setVertexMenu(null);
    }, []);

    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          // Pass pointer events through when in text-select mode so PDF text layer is accessible
          pointerEvents: tool === "textSelect" ? "none" : "auto",
          cursor: tool === "textSelect" ? "text" : undefined,
        }}
      >
        {/* Highlight layer — below Fabric in DOM so it blends with PDF via multiply */}
        <canvas
          ref={highlightCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            mixBlendMode: 'multiply',
          }}
        />
        <canvas ref={canvasRef} />
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || !fabricCanvas.current) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataURL = ev.target?.result as string;
              if (!dataURL || !fabricCanvas.current) return;
              const canvas = fabricCanvas.current;
              const w = canvas.getWidth(), h = canvas.getHeight();
              const clickPos = imageClickPosRef.current || { x: w / 2, y: h / 2 };
              fabric.Image.fromURL(dataURL, (imgObj: fabric.Image) => {
                if (!fabricCanvas.current || isDisposing.current) return;
                const c = fabricCanvas.current;
                const maxW = w * 0.4;
                const maxH = h * 0.4;
                const natW = imgObj.width || 200;
                const natH = imgObj.height || 200;
                const scale = Math.min(maxW / natW, maxH / natH, 1);
                const iw = natW * scale;
                const ih = natH * scale;
                const left = clickPos.x - iw / 2;
                const top = clickPos.y - ih / 2;
                imgObj.set({
                  left, top,
                  scaleX: scale,
                  scaleY: scale,
                  originX: 'left',
                  originY: 'top',
                  selectable: true,
                  evented: true,
                });
                const pendingId = crypto.randomUUID();
                (imgObj as any).data = { id: pendingId, type: 'image', _justCreated: true };
                objectCache.current.set(pendingId, imgObj);
                c.add(imgObj);
                c.setActiveObject(imgObj);
                c.requestRenderAll();
                onMarkupAddedRef.current?.({
                  id: pendingId,
                  type: 'image',
                  pageNumber: pageNumberRef.current,
                  coordinates: { left: left / w, top: top / h, width: iw / w, height: ih / h },
                  properties: { imageData: dataURL },
                });
                onSwitchToSelectRef.current?.();
              }, { crossOrigin: 'anonymous' });
            };
            reader.readAsDataURL(file);
            // Reset so same file can be picked again
            e.target.value = '';
          }}
        />
        {vertexMenu && createPortal(
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setVertexMenu(null)} />
            <div style={{
              position: 'fixed', left: vertexMenu.x, top: vertexMenu.y + 8,
              background: '#1e1e1e', border: '1px solid #444', borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)', zIndex: 9999, minWidth: 170, overflow: 'hidden',
            }}>
              {vertexMenu.handleIdx > 0 && vertexMenu.handleIdx < vertexPoints.current.length - 1 && (
                <div
                  style={{ padding: '9px 16px', cursor: 'pointer', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#2d2d2d')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => handleVertexSplit(vertexMenu.markupId, vertexMenu.handleIdx)}
                >
                  ✂ Split at this vertex
                </div>
              )}
              <div
                style={{ padding: '9px 16px', cursor: 'pointer', color: '#888', fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#2d2d2d')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => setVertexMenu(null)}
              >
                Cancel
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    );
  },
);

MarkupLayer.displayName = "MarkupLayer";

// PERF-15: React.memo — skip re-render when parent (MarkupOverlay) updates but this page's props are unchanged
const MemoizedMarkupLayer = React.memo(MarkupLayer);
MemoizedMarkupLayer.displayName = "MemoizedMarkupLayer";
export default MemoizedMarkupLayer;
