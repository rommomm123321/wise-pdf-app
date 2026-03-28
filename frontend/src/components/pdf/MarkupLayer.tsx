import {
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
    } | null,
  ) => void;
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

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0,
    g = parseInt(hex.slice(3, 5), 16) || 0,
    b = parseInt(hex.slice(5, 7), 16) || 0;
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

// CRITICAL: INCLUDE CANVAS DIMENSIONS IN HASH TO FORCE RE-SYNC
function propHash(m: any, docScale?: string, w?: number, h?: number): string {
  const c = m.coordinates || {};
  const p = m.properties || {};
  // Fast path: use updatedAt + key fields instead of full JSON.stringify
  const cl = c.cloud;
  const cloudHash = cl ? `${cl.left ?? 0}|${cl.top ?? 0}|${cl.width ?? 0}|${cl.height ?? 0}` : '';
  return `${m.updatedAt || m.createdAt || 0}|${c.left ?? c.x1 ?? 0}|${c.top ?? c.y1 ?? 0}|${c.width ?? c.x2 ?? 0}|${c.height ?? c.y2 ?? 0}|${c.angle ?? 0}|${cloudHash}|${p.stroke || ''}|${p.fill || ''}|${p.fillOpacity ?? ''}|${p.strokeWidth ?? ''}|${p.lineStyle || ''}|${p.text || ''}|${p.fontSize ?? ''}|${p.textColor || ''}|${p.arrowSize ?? ''}|${p.arrowStyle || ''}|${p.textBoxFill || ''}|${p.zIndex ?? ''}|${p.locked ? 1 : 0}|${p.showLength === false ? 0 : 1}|${docScale || ''}|${w || ''}|${h || ''}`;
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
) {
  const dx = x2 - x1,
    dy = y2 - y1,
    len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return [];
  const ux = dx / len,
    uy = dy / len;
  const nx = -uy,
    ny = ux;
  const tL = 6 * s; // Tick length
  return [
    new fabric.Line([x1 - nx * tL, y1 - ny * tL, x1 + nx * tL, y1 + ny * tL], {
      stroke,
      strokeWidth,
    }),
    new fabric.Line([x2 - nx * tL, y2 - ny * tL, x2 + nx * tL, y2 + ny * tL], {
      stroke,
      strokeWidth,
    }),
  ];
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
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvas = useRef<fabric.Canvas | null>(null);
    const objectCache = useRef<Map<string, fabric.Object>>(new Map());
    const hashCache = useRef<Map<string, string>>(new Map());
    const calloutTailCache = useRef<Map<string, fabric.Object>>(new Map());
    const calloutLineCache = useRef<Map<string, fabric.Object>>(new Map());
    const calloutTextboxBgCache = useRef<Map<string, fabric.Rect>>(new Map());
    const textBorderCache = useRef<Map<string, fabric.Rect>>(new Map());
    const lastZOrderHashRef = useRef<string>('');
    const lastHighlightHashRef = useRef<string>('');
    const isDrawing = useRef(false);
    const isInSync = useRef(false);
    const isProgrammaticSelect = useRef(false);
    const lastMoveRef = useRef(0);
    const currentObject = useRef<fabric.Object | null>(null);
    const measureLabel = useRef<fabric.Text | null>(null);
    const measureTicks = useRef<fabric.Line[]>([]);
    // Polyline drawing state
    const polylinePoints = useRef<{x: number; y: number}[]>([]);
    const polylineLines = useRef<fabric.Line[]>([]);
    const polylinePreviewLine = useRef<fabric.Line | null>(null);
    const polylineLengthLabel = useRef<fabric.Text | null>(null);
    const startPos = useRef<{ x: number; y: number } | null>(null);
    // Vertex edit mode state
    const [vertexMenu, setVertexMenu] = useState<{ x: number; y: number; handleIdx: number; markupId: string } | null>(null);
    const vertexEditMarkupId = useRef<string | null>(null);
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

    const pageNumberRef = useRef(pageNumber);
    const toolRef = useRef(tool);
    const colorRef = useRef(activeColor);
    const widthRef = useRef(activeStrokeWidth);
    const lineStyleRef = useRef(activeLineStyle);
    const scaleRef = useRef(scale);
    const docScaleRef = useRef(docScale);
    const currentUserIdRef = useRef(currentUserId);
    const isAdminRef = useRef(isAdmin);
    const canMarkupRef = useRef(canMarkup);
    const onCanvasMentionRef = useRef(onCanvasMention);
    const onMarkupAddedRef = useRef(onMarkupAdded);
    const onMarkupModifiedRef = useRef(onMarkupModified);
    const onMarkupSelectedRef = useRef(onMarkupSelected);
    const onContextMenuRef = useRef(onContextMenu);

    useEffect(() => {
      pageNumberRef.current = pageNumber;
      toolRef.current = tool;
      colorRef.current = activeColor;
      widthRef.current = activeStrokeWidth;
      lineStyleRef.current = activeLineStyle;
      scaleRef.current = scale;
      docScaleRef.current = docScale;
      currentUserIdRef.current = currentUserId;
      isAdminRef.current = isAdmin;
      canMarkupRef.current = canMarkup;
      hiddenLayersRef.current = hiddenLayers;
      onCanvasMentionRef.current = onCanvasMention;
      onMarkupAddedRef.current = onMarkupAdded;
      onMarkupModifiedRef.current = onMarkupModified;
      onMarkupSelectedRef.current = onMarkupSelected;
      onContextMenuRef.current = onContextMenu;
      onMarkupDeletedRef.current = onMarkupDeleted;
      markupsRef.current = markups;
    }, [
      tool,
      activeColor,
      activeStrokeWidth,
      activeLineStyle,
      scale,
      docScale,
      currentUserId,
      isAdmin,
      canMarkup,
      hiddenLayers,
      onCanvasMention,
      onMarkupAdded,
      onMarkupModified,
      onMarkupSelected,
      onContextMenu,
      onMarkupDeleted,
      markups,
    ]);

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
      const isDrawing = isPen || isHighlighter;

      // Cursor
      let cursor = "default";
      switch (tool) {
        case "select":
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
        const effectiveLocked = readOnly || locked || !canEdit;
        const isTail = obj.data?.part === 'tail';
        const isHighlight = obj.data?.type === 'highlighter';
        // Highlights: locked in place (no move, no resize, no rotate) — only selection for deletion
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
    }, [tool, activeColor, activeStrokeWidth]);

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
        enableRetinaScaling: false,
        allowTouchScrolling: true,
      });
      fabricCanvas.current = canvas;

      // Set up free drawing brush
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = colorRef.current;
      canvas.freeDrawingBrush.width = widthRef.current;

      fabric.Object.prototype.set({
        transparentCorners: false,
        cornerColor: "#005fb8",
        cornerStrokeColor: "#ffffff",
        borderColor: "#005fb8",
        cornerSize: 8,
        borderScaleFactor: 2,
        padding: 5,
        cornerStyle: "rect",
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
            if (target?.data?.id) onContextMenuRef.current?.(e, target.data.id);
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
        if (["select", "pan", "pen"].includes(toolRef.current)) return;
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
            top: pointer.y - 15 * scaleRef.current,
            fontSize: 14 * scaleRef.current,
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
          canvas.add(
            currentObject.current,
            measureLabel.current,
            ...measureTicks.current,
          );
          return;
        }

        // ─── Polyline: click to add points, dblclick to finish ───
        if (toolRef.current === "polyline") {
          const pointer = canvas.getPointer(opt.e);
          if (polylinePoints.current.length === 0) {
            // First point — start polyline
            polylinePoints.current = [{ x: pointer.x, y: pointer.y }];
            polylinePreviewLine.current = new fabric.Line(
              [pointer.x, pointer.y, pointer.x, pointer.y],
              { stroke: colorRef.current, strokeWidth: widthRef.current, strokeDashArray: getDashArray(lineStyleRef.current), selectable: false, evented: false },
            );
            polylineLengthLabel.current = new fabric.Text("0", {
              left: pointer.x, top: pointer.y - 15 * scaleRef.current,
              fontSize: 14 * scaleRef.current, fill: colorRef.current, fontFamily: "Arial",
              originX: "center", originY: "bottom", selectable: false, evented: false,
              textBackgroundColor: "rgba(255,255,255,0.7)",
            });
            canvas.add(polylinePreviewLine.current, polylineLengthLabel.current);
          } else {
            // Add next segment
            const prevPt = polylinePoints.current[polylinePoints.current.length - 1];
            const seg = new fabric.Line(
              [prevPt.x, prevPt.y, pointer.x, pointer.y],
              { stroke: colorRef.current, strokeWidth: widthRef.current, strokeDashArray: getDashArray(lineStyleRef.current), selectable: false, evented: false },
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
          currentObject.current = new fabric.Triangle({
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
        // Polyline preview — independent of isDrawing
        if (toolRef.current === "polyline" && polylinePoints.current.length > 0 && polylinePreviewLine.current) {
          const pointer = canvas.getPointer(opt.e);
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
          polylineLengthLabel.current?.set({ text: lenText, left: pointer.x, top: pointer.y - 15 * scaleRef.current });
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
            measureLabel.current.set({
              text,
              left: (startPos.current.x + pointer.x) / 2,
              top: (startPos.current.y + pointer.y) / 2,
              angle: textAngle,
            });

            if (measureTicks.current.length === 2 && distPoints > 0.1) {
              const len = Math.sqrt(dx * dx + dy * dy),
                ux = dx / len,
                uy = dy / len,
                nx = -uy,
                ny = ux,
                tL = 6 * scaleRef.current;
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
          currentObject.current.set({
            width: Math.abs(dx),
            height: Math.abs(dy),
            left: Math.min(startPos.current.x, pointer.x),
            top: Math.min(startPos.current.y, pointer.y),
          });
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
          currentObject.current = null;
          measureLabel.current = null;
          measureTicks.current = [];
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
          onMarkupAddedRef.current?.({
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
              } : {}),
            },
          });
          canvas.remove(obj);
          currentObject.current = null;
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
        onMarkupAddedRef.current?.({
          type: "polyline",
          pageNumber: pageNumberRef.current,
          coordinates: { points: normalizedPoints },
          properties: {
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
            radius: 6 * scaleRef.current, fill: 'white', stroke: '#2196F3',
            strokeWidth: 2 * scaleRef.current,
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

      canvas.on("mouse:dblclick", (opt: any) => {
        // Polyline drawing finalize
        if (toolRef.current === "polyline" && polylinePoints.current.length >= 1) {
          // The dblclick fires after mouse:down already added the last point; remove it
          if (polylineLines.current.length > 0) {
            const lastSeg = polylineLines.current.pop();
            if (lastSeg) canvas.remove(lastSeg);
            polylinePoints.current.pop();
          }
          finalizePolyline();
          return;
        }
        // Enter vertex edit on polyline double-click in select mode
        if (toolRef.current === "select") {
          const target = canvas.findTarget(opt.e, false) as any;
          if (target?.data?.type === "polyline") {
            const markup = markupsRef.current.find((m: any) => m.id === target.data.id);
            if (markup) enterVertexEdit(target, markup);
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
                left: midPt.x, top: midPt.y - 15 * scaleRef.current,
                fontSize: 14 * scaleRef.current, fill: stroke, fontFamily: 'Arial',
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
            }
          }
          canvas.requestRenderAll();
          return;
        }
        if (!obj?.data?.id) return;
        
        // Mark as moving to prevent incoming sync from disrupting the local drag
        obj.isMoving = true;
        
        // Immediate local render for smoothness
        canvas.requestRenderAll();
        
        const now = Date.now();
        if (now - lastMoveRef.current < 16) return; // 60fps throttle for network
        lastMoveRef.current = now;

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
            // Sync bg rect with textbox
            if (bgObj) {
              bgObj.set({ left: obj.left, top: obj.top, width: obj.width! * (obj.scaleX || 1), height: (obj as any).height || 50 });
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
              const tw2 = obj.width! * (obj.scaleX || 1), th2 = (obj as any).height || 50;
              coords = {
                cloud: { left: cloudBrLogical.left/w, top: cloudBrLogical.top/h, width: cloudBrLogical.width/w, height: cloudBrLogical.height/h },
                textBox: { left: obj.left!/w, top: obj.top!/h, width: tw2/w, height: th2/h },
              };
            } else {
              coords = {
                cloud: {},
                textBox: { left: obj.left!/w, top: obj.top!/h, width: (obj.width! * (obj.scaleX||1))/w, height: ((obj as any).height||50)/h },
              };
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
              coords = { cloud: { left: cloudBrLogical.left/w, top: cloudBrLogical.top/h, width: cloudBrLogical.width/w, height: cloudBrLogical.height/h }, tail: { x: obj.left! / w, y: obj.top! / h } };
            } else {
              coords = { cloud: {}, tail: { x: obj.left! / w, y: obj.top! / h } };
            }
          } else {
            // Cloud is being moved — use stored original dims to avoid grow-on-move bug
            const od = obj.data || {};
            const dx2 = obj.left! - (od._lastLeft ?? obj.left!);
            const dy2 = obj.top! - (od._lastTop ?? obj.top!);
            const cloudBrLogical = {
              left: (od._cloudOrigLeft ?? obj.left! - (obj.width||0)/2) + dx2,
              top: (od._cloudOrigTop ?? obj.top! - (obj.height||0)/2) + dy2,
              width: od._cloudOrigWidth ?? obj.width! ?? 100,
              height: od._cloudOrigHeight ?? obj.height! ?? 100,
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
            if ((tailObj as any)?.data?.part === 'textbox') {
              coords = {
                cloud: { left: cloudBrLogical.left/w, top: cloudBrLogical.top/h, width: cloudBrLogical.width/w, height: cloudBrLogical.height/h },
                textBox: { left: tailObj!.left!/w, top: tailObj!.top!/h, width: (tailObj!.width! * (tailObj!.scaleX||1))/w, height: ((tailObj as any).height||50)/h },
              };
            } else {
              const tailX = tailObj ? tailObj.left! / w : cloudBrLogical.left/w + cloudBrLogical.width/w/2;
              const tailY = tailObj ? tailObj.top! / h : cloudBrLogical.top/h + cloudBrLogical.height/h + 70/h;
              coords = { cloud: { left: cloudBrLogical.left/w, top: cloudBrLogical.top/h, width: cloudBrLogical.width/w, height: cloudBrLogical.height/h }, tail: { x: tailX, y: tailY } };
            }
          }
        } else if (
          [
            "rect",
            "circle",
            "ellipse",
            "triangle",
            "diamond",
            "hexagon",
            "star",
          ].includes(type)
        ) {
          coords = {
            left: obj.left! / w,
            top: obj.top! / h,
            width: (obj.width! * (obj.scaleX || 1)) / w,
            height: (obj.height! * (obj.scaleY || 1)) / h,
            angle: obj.angle || 0,
          };
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
          const line = (
            obj.type === "group"
              ? obj.getObjects().find((o: any) => o.type === "line") || obj
              : obj
          ) as fabric.Line;
          let dx = 0,
            dy = 0;
          if (obj.type === "group") {
            dx = obj.left - (obj.data?._lastLeft ?? obj.left);
            dy = obj.top - (obj.data?._lastTop ?? obj.top);
          }
          coords = {
            x1: (line.x1 + dx) / w,
            y1: (line.y1 + dy) / h,
            x2: (line.x2 + dx) / w,
            y2: (line.y2 + dy) / h,
            angle: obj.angle || 0,
          };
        } else if (type === "text") {
          // Sync text border rect position/size during drag
          const movingBorder = textBorderCache.current.get(obj.data.id);
          if (movingBorder) {
            movingBorder.set({
              left: obj.left,
              top: obj.top,
              width: obj.width! * (obj.scaleX || 1),
              height: obj.height! * (obj.scaleY || 1),
              angle: obj.angle || 0,
            });
            movingBorder.setCoords();
          }
          coords = {
            left: obj.left / w,
            top: obj.top / h,
            angle: obj.angle || 0,
            width: (obj.width! * (obj.scaleX || 1)) / w,
          };
        } else if (["pen", "highlighter"].includes(type)) {
          coords = {
            ...obj.data.coordinates,
            left: obj.left / w,
            top: obj.top! / h,
            width: (obj.width! * (obj.scaleX || 1)) / w,
            height: (obj.height! * (obj.scaleY || 1)) / h,
            angle: obj.angle || 0,
          };
        } else if (type === 'polyline') {
          // Polyline group movement: apply delta to stored normalized points
          const dx = obj.left! - (obj.data?._lastLeft ?? obj.left!);
          const dy = obj.top! - (obj.data?._lastTop ?? obj.top!);
          const markup = markupsRef.current?.find((m: any) => m.id === obj.data.id);
          const originalPts: { x: number; y: number }[] = markup?.coordinates?.points || [];
          if (originalPts.length >= 2) {
            coords = { points: originalPts.map((p: any) => ({ x: p.x + dx / w, y: p.y + dy / h })) };
          }
        }

        // Emit update with a flag to skip history push and refetch in the parent
        onMarkupModifiedRef.current?.({
          id: obj.data.id,
          type,
          coordinates: coords,
          isMoving: true,
        });
      });

      canvas.on("object:modified", (opt: any) => {
        const obj = opt.target;
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
            const tbW = obj.width! * (obj.scaleX || 1), tbH = (obj as any).height || 50;
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
            // Cloud moved — use stored original dims to avoid grow-on-move bug
            const od = obj.data || {};
            const dx2 = obj.left! - (od._lastLeft ?? obj.left!);
            const dy2 = obj.top! - (od._lastTop ?? obj.top!);
            const cloudBrLogical = {
              left: (od._cloudOrigLeft ?? obj.left! - (obj.width||0)/2) + dx2,
              top: (od._cloudOrigTop ?? obj.top! - (obj.height||0)/2) + dy2,
              width: od._cloudOrigWidth ?? obj.width! ?? 100,
              height: od._cloudOrigHeight ?? obj.height! ?? 100,
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
              coords = {
                cloud: { left: cloudBrLogical.left/w, top: cloudBrLogical.top/h, width: cloudBrLogical.width/w, height: cloudBrLogical.height/h },
                textBox: { left: tailObj!.left!/w, top: tailObj!.top!/h, width: (tailObj!.width! * (tailObj!.scaleX||1))/w, height: ((tailObj as any).height||50)/h },
              };
            } else {
              const tailX = tailObj ? tailObj.left!/w : cloudBrLogical.left/w + cloudBrLogical.width/w/2;
              const tailY = tailObj ? tailObj.top!/h : cloudBrLogical.top/h + cloudBrLogical.height/h + 70/h;
              coords = { cloud: { left: cloudBrLogical.left/w, top: cloudBrLogical.top/h, width: cloudBrLogical.width/w, height: cloudBrLogical.height/h }, tail: { x: tailX, y: tailY } };
            }
          }
        } else if (
          [
            "rect",
            "circle",
            "ellipse",
            "triangle",
            "diamond",
            "hexagon",
            "star",
          ].includes(type)
        ) {
          coords = {
            left: obj.left! / w,
            top: obj.top! / h,
            width: (obj.width! * (obj.scaleX || 1)) / w,
            height: (obj.height! * (obj.scaleY || 1)) / h,
            angle: obj.angle || 0,
          };
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
          const line = (
            obj.type === "group"
              ? obj.getObjects().find((o: any) => o.type === "line") || obj
              : obj
          ) as fabric.Line;
          let dx = 0,
            dy = 0;
          if (obj.type === "group") {
            dx = obj.left - (obj.data?._lastLeft ?? obj.left);
            dy = obj.top - (obj.data?._lastTop ?? obj.top);
          }
          coords = {
            x1: (line.x1 + dx) / w,
            y1: (line.y1 + dy) / h,
            x2: (line.x2 + dx) / w,
            y2: (line.y2 + dy) / h,
            angle: obj.angle || 0,
          };
        } else if (type === "text") {
          // Sync text border rect on final position/size
          const modifiedBorder = textBorderCache.current.get(obj.data.id);
          if (modifiedBorder) {
            modifiedBorder.set({
              left: obj.left,
              top: obj.top,
              width: obj.width! * (obj.scaleX || 1),
              height: obj.height! * (obj.scaleY || 1),
              angle: obj.angle || 0,
            });
            modifiedBorder.setCoords();
          }
          coords = {
            left: obj.left / w,
            top: obj.top / h,
            angle: obj.angle || 0,
            width: (obj.width! * (obj.scaleX || 1)) / w,
          };
        } else if (["pen", "highlighter"].includes(type)) {
          coords = {
            ...obj.data.coordinates,
            left: obj.left / w,
            top: obj.top! / h,
            width: (obj.width! * (obj.scaleX || 1)) / w,
            height: (obj.height! * (obj.scaleY || 1)) / h,
            angle: obj.angle || 0,
          };
        } else if (type === 'polyline') {
          const angleRad = ((obj.angle || 0) * Math.PI) / 180;
          const markup = markupsRef.current?.find((m: any) => m.id === obj.data.id);
          const originalPts: { x: number; y: number }[] = markup?.coordinates?.points || [];
          if (originalPts.length >= 2) {
            const s = scaleRef.current;
            let canvasPts = originalPts.map((p: any) => ({ x: p.x * w, y: p.y * h }));
            if (angleRad !== 0) {
              // Bake rotation: rotate each canvas point around the group's visual center
              const center = obj.getCenterPoint();
              const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
              canvasPts = canvasPts.map(p => ({
                x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
                y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos,
              }));
              // Reset angle to 0 — rotation is now baked into point positions
              obj.set({ angle: 0 });
              obj.setCoords();
            } else {
              // Pure movement: apply delta to canvas points
              const dx = obj.left! - (obj.data?._lastLeft ?? obj.left!);
              const dy = obj.top! - (obj.data?._lastTop ?? obj.top!);
              canvasPts = canvasPts.map(p => ({ x: p.x + dx, y: p.y + dy }));
            }
            const newPts = canvasPts.map(p => ({ x: p.x / w, y: p.y / h }));
            let pathLength = 0;
            for (let i = 1; i < newPts.length; i++) {
              const pdx = (newPts[i].x - newPts[i-1].x) * w / s;
              const pdy = (newPts[i].y - newPts[i-1].y) * h / s;
              pathLength += Math.sqrt(pdx*pdx + pdy*pdy);
            }
            coords = { points: newPts };
            onMarkupModifiedRef.current?.({ id: obj.data.id, type, coordinates: coords, properties: { pathLength } });
            return;
          }
        }
        onMarkupModifiedRef.current?.({ id: obj.data.id, type, coordinates: coords });
      });

      canvas.on("selection:created", (e: any) => {
        if (!isProgrammaticSelect.current && !isInSync.current)
          onMarkupSelectedRef.current?.(
            e.selected?.map((o: any) => o.data?.id).filter(Boolean) || [],
          );
      });
      canvas.on("selection:updated", (e: any) => {
        // Vertex edit exit is handled in mouse:down, not here.
        if (!isProgrammaticSelect.current && !isInSync.current)
          onMarkupSelectedRef.current?.(
            e.selected?.map((o: any) => o.data?.id).filter(Boolean) || [],
          );
      });
      canvas.on("selection:cleared", () => {
        // Primary vertex edit exit is handled in mouse:down (more reliable than selection:cleared
        // which fires spuriously after drags and when hiding the group in enterVertexEdit).
        // No exitVertexEdit here.
        if (!isInSync.current && !isProgrammaticSelect.current)
          onMarkupSelectedRef.current?.([]);
      });

      // Canvas text editing: detect @mention and save text on exit
      canvas.on("text:changed", (e: any) => {
        const obj = e.target;
        if (!obj || obj.type !== "textbox") return;
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
        if (!obj?.data?.id || obj.type !== "textbox") return;
        const w = canvas.getWidth(), h = canvas.getHeight();
        if (obj.data.type === 'callout') {
          const cloudObj = objectCache.current.get(obj.data.id);
          const cloudBr = cloudObj?.getBoundingRect(true);
          const tbW = obj.width! * (obj.scaleX || 1), tbH = (obj as any).height || 50;
          const textBoxCoords = { left: obj.left!/w, top: obj.top!/h, width: tbW/w, height: tbH/h };
          // Sync bg height after text may have changed the textbox height
          const bgObj = calloutTextboxBgCache.current.get(obj.data.id);
          if (bgObj) { bgObj.set({ left: obj.left, top: obj.top, width: tbW, height: tbH }); bgObj.setCoords(); }
          onMarkupModifiedRef.current?.({
            id: obj.data.id, type: 'callout',
            coordinates: cloudBr ? { cloud: { left: cloudBr.left/w, top: cloudBr.top/h, width: cloudBr.width/w, height: cloudBr.height/h }, textBox: textBoxCoords } : { textBox: textBoxCoords },
            properties: { text: obj.text },
          });
        } else {
          const coords = { left: obj.left!/w, top: obj.top!/h, angle: obj.angle || 0, width: (obj.width! * (obj.scaleX||1))/w };
          onMarkupModifiedRef.current?.({ id: obj.data.id, type: "text", coordinates: coords, properties: { text: obj.text } });
        }
        onCanvasMentionRef.current?.(null);
      });

      // ESC key: exit vertex edit mode
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && vertexEditMarkupId.current) {
          exitVertexEdit(true);
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        wrapper?.removeEventListener('pointermove', handlePressure as EventListener);
        wrapper?.removeEventListener('pointerup', handlePressureEnd as EventListener);
        if (fabricCanvas.current) {
          fabricCanvas.current.dispose();
          fabricCanvas.current = null;
          objectCache.current.clear();
          hashCache.current.clear();
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
        
        // Prevent syncing over objects currently being dragged to avoid jitter
        const isDraggingAny = activeObj && activeObj.isMoving;

        isInSync.current = true;
        const cache = objectCache.current,
          hashes = hashCache.current,
          currentIds = new Set((mks || []).map((m) => m.id));
        for (const [id, obj] of cache.entries()) {
          if (!currentIds.has(id)) {
            canvas.remove(obj);
            cache.delete(id);
            hashes.delete(id);
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
          }
        }

        for (const m of mks || []) {
          if (isDraggingAny && prevActiveIds.includes(m.id)) {
             // Skip re-rendering the dragged object to maintain 60fps smoothness locally
             continue;
          }
          // Skip markup currently being vertex-edited to preserve temp overlay
          if (vertexEditMarkupId.current === m.id) continue;
          if (hiddenLayers.includes(m.type)) {
            if (cache.has(m.id)) {
              canvas.remove(cache.get(m.id)!);
              cache.delete(m.id);
              hashes.delete(m.id);
              const hiddenTail = calloutTailCache.current.get(m.id);
              if (hiddenTail) { canvas.remove(hiddenTail); calloutTailCache.current.delete(m.id); }
              const hiddenLine = calloutLineCache.current.get(m.id);
              if (hiddenLine) { canvas.remove(hiddenLine); calloutLineCache.current.delete(m.id); }
              const hiddenBg = calloutTextboxBgCache.current.get(m.id);
              if (hiddenBg) { canvas.remove(hiddenBg); calloutTextboxBgCache.current.delete(m.id); }
              const hiddenBorder = textBorderCache.current.get(m.id);
              if (hiddenBorder) { canvas.remove(hiddenBorder); textBorderCache.current.delete(m.id); }
            }
            continue;
          }
          const newHash = propHash(m, docScaleRef.current, w, h),
            coords = m.coordinates || {},
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
          const canEdit =
            isAdminRef.current ||
            (currentUserIdRef.current != null &&
              m.authorId === currentUserIdRef.current) ||
            !_eids ||
            _eids.includes("*") ||
            (_eids.length > 0 &&
              currentUserIdRef.current != null &&
              _eids.includes(currentUserIdRef.current));
          const effectiveLocked = !canMarkupRef.current || locked || !canEdit;

          if (cache.has(m.id)) {
            const obj = cache.get(m.id)!;
            if (hashes.get(m.id) === newHash) {
              obj.set({
                selectable: isSelect,
                evented: isSelect,
                lockMovementX: effectiveLocked,
                lockMovementY: effectiveLocked,
                lockRotation: effectiveLocked,
                lockScalingX: effectiveLocked,
                lockScalingY: effectiveLocked,
                hasControls: !effectiveLocked,
              });
              (obj as any).data = { ...(obj as any).data, canEdit };
              // Update callout textbox/tail interactivity on tool/lock change
              if (m.type === 'callout') {
                const tailObj = calloutTailCache.current.get(m.id);
                if (tailObj) {
                  const isPart = (tailObj as any).data?.part;
                  if (isPart === 'textbox') {
                    tailObj.set({
                      selectable: isSelect && !effectiveLocked,
                      evented: isSelect,
                      lockMovementX: effectiveLocked,
                      lockMovementY: effectiveLocked,
                      editable: isSelect && canEdit && !effectiveLocked,
                    } as any);
                  } else {
                    tailObj.set({
                      selectable: isSelect && !effectiveLocked,
                      evented: isSelect && !effectiveLocked,
                      lockMovementX: effectiveLocked,
                      lockMovementY: effectiveLocked,
                    });
                  }
                  (tailObj as any).data = { ...(tailObj as any).data, canEdit };
                }
              }
              continue;
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
              const connectorLine = new fabric.Line(
                [lineStart.x, lineStart.y, tbCx, tbCy],
                { stroke, strokeWidth: Math.max(1, strokeWidth), strokeDashArray: dash, selectable: false, evented: false }
              );
              connectorLine.set('data', { part: 'connector', id: m.id });
              canvas.add(connectorLine);
              calloutLineCache.current.set(m.id, connectorLine);

              // Text box background rect (non-interactive, provides fill + border)
              const textboxBg = new fabric.Rect({
                left: tbLeft, top: tbTop, width: tbWidth, height: tbHeight,
                fill: props.textBoxFill || '#ffffff',
                stroke, strokeWidth, strokeDashArray: dash,
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
                fontSize: (props.fontSize || 14) * s,
                fill: props.textColor || '#000000',
                fontFamily: props.fontFamily || 'Arial',
                fontWeight: props.fontWeight || 'normal',
                fontStyle: props.fontStyle || 'normal',
                backgroundColor: '',
                stroke: 'transparent',
                strokeWidth: 0,
                editable: isSelect && canEdit && !effectiveLocked,
              });
              textboxObj.set('data', { id: m.id, type: 'callout', part: 'textbox', canEdit });
              textboxObj.set({
                selectable: isSelect && !effectiveLocked,
                evented: isSelect,
                lockMovementX: effectiveLocked,
                lockMovementY: effectiveLocked,
                hasControls: !effectiveLocked,
                lockRotation: true,
                lockScalingY: true,
              });
              canvas.add(textboxObj);
              calloutTailCache.current.set(m.id, textboxObj);

              // Cloud shape (stored in objectCache as main object)
              obj = new fabric.Path(
                makeCloudPath(cLeft, cTop, cWidth, cHeight, 20 * s),
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
                selectable: isSelect && !effectiveLocked, evented: isSelect && !effectiveLocked,
                lockMovementX: effectiveLocked, lockMovementY: effectiveLocked,
              });
              canvas.add(tailCircle);
              calloutTailCache.current.set(m.id, tailCircle);

              obj = new fabric.Path(
                makeCloudPath(cLeft, cTop, cWidth, cHeight, 20 * s),
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
          else if (m.type === "cloud")
            obj = new fabric.Path(
              makeCloudPath(
                coords.left * w,
                coords.top * h,
                coords.width * w,
                coords.height * h,
                20 * s,
              ),
              { fill, stroke, strokeWidth, strokeDashArray: dash },
            );
          else if (m.type === "line" || m.type === "measure") {
            obj = new fabric.Line(
              [coords.x1 * w, coords.y1 * h, coords.x2 * w, coords.y2 * h],
              { stroke, strokeWidth, strokeDashArray: dash },
            );
            if (m.type === "measure") {
              const x1 = coords.x1 * w,
                y1 = coords.y1 * h,
                x2 = coords.x2 * w,
                y2 = coords.y2 * h;
              const dx = x2 - x1,
                dy = y2 - y1,
                distP = Math.sqrt(dx * dx + dy * dy) / s,
                angle = Math.atan2(dy, dx) * (180 / Math.PI);
              let tA = angle;
              if (tA > 90 || tA < -90) tA -= 180;
              const { text } = formatMeasurement(distP, docScaleRef.current);
              const lbl = new fabric.Text(text, {
                left: (x1 + x2) / 2,
                top: (y1 + y2) / 2,
                fontSize: 14 * s,
                fill: stroke,
                fontFamily: "Arial",
                originX: "center",
                originY: "bottom",
                angle: tA,
                selectable: false,
                evented: false,
                textBackgroundColor: "rgba(255,255,255,0.7)",
              });
              const ticks = getMeasureTicks(
                x1,
                y1,
                x2,
                y2,
                s,
                stroke,
                strokeWidth,
              );
              obj = new fabric.Group([obj, lbl, ...ticks]);
            }
          } else if (m.type === "arrow") {
            const arrowSize = (props.arrowSize || 10) * s;
            const arrowStyle = props.arrowStyle || 'end'; // 'end' | 'start' | 'both'
            const x1 = coords.x1 * w, y1 = coords.y1 * h, x2 = coords.x2 * w, y2 = coords.y2 * h;
            const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
            const l = new fabric.Line([x1, y1, x2, y2], { stroke, strokeWidth, strokeDashArray: dash });
            const groupItems: fabric.Object[] = [l];
            if (arrowStyle === 'end' || arrowStyle === 'both') {
              groupItems.push(new fabric.Triangle({ left: x2, top: y2, width: arrowSize, height: arrowSize, fill: stroke, originX: 'center', originY: 'center', angle: angle + 90 }));
            }
            if (arrowStyle === 'start' || arrowStyle === 'both') {
              groupItems.push(new fabric.Triangle({ left: x1, top: y1, width: arrowSize, height: arrowSize, fill: stroke, originX: 'center', originY: 'center', angle: angle - 90 }));
            }
            obj = new fabric.Group(groupItems);
          } else if (m.type === "polyline") {
            const pts = (coords.points || []) as { x: number; y: number }[];
            if (pts.length >= 2) {
              const canvasPts = pts.map((p: any) => ({ x: p.x * w, y: p.y * h }));
              let totalDist = 0;
              const segments: fabric.Line[] = [];
              for (let i = 1; i < canvasPts.length; i++) {
                const ddx = canvasPts[i].x - canvasPts[i-1].x, ddy = canvasPts[i].y - canvasPts[i-1].y;
                totalDist += Math.sqrt(ddx*ddx + ddy*ddy) / s;
                segments.push(new fabric.Line(
                  [canvasPts[i-1].x, canvasPts[i-1].y, canvasPts[i].x, canvasPts[i].y],
                  { stroke, strokeWidth, strokeDashArray: dash },
                ));
              }
              // Label at midpoint vertex (only when showLength !== false)
              const showLength = props.showLength !== false;
              const groupItems: fabric.Object[] = [...segments];
              if (showLength) {
                const midPt = canvasPts[Math.floor(canvasPts.length / 2)];
                const { text: lenText } = formatMeasurement(totalDist, docScaleRef.current);
                const lbl = new fabric.Text(lenText, {
                  left: midPt.x, top: midPt.y - 15 * s,
                  fontSize: 14 * s, fill: stroke, fontFamily: "Arial",
                  originX: "center", originY: "bottom",
                  selectable: false, evented: false,
                  textBackgroundColor: "rgba(255,255,255,0.7)",
                });
                groupItems.push(lbl);
              }
              obj = new fabric.Group(groupItems);
            }
          } else if (["pen", "highlighter"].includes(m.type)) {
            if (coords.path) {
              // Legacy freehand path (pen or old-style highlight)
              obj = new fabric.Path(coords.path, {
                fill: "transparent",
                stroke,
                strokeWidth,
                strokeDashArray: dash,
                left: coords.left * w,
                top: coords.top * h,
              });
              const origW = props.originalWidth || w,
                origH = props.originalHeight || h;
              obj.set({ scaleX: w / origW, scaleY: h / origH });
            } else if (coords.width !== undefined && coords.height !== undefined) {
              // Rect-based highlight (Bluebeam style)
              obj = new fabric.Rect({
                left: coords.left * w,
                top: coords.top * h,
                width: coords.width * w,
                height: coords.height * h,
                fill: 'transparent',
                stroke: 'transparent',
                strokeWidth: 0,
              });
            }
            if (m.type === "highlighter" && obj) {
              // Rendered on the separate raw canvas; keep in Fabric at opacity 0 so handles work
              obj.set({ opacity: 0 });
            }
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
              backgroundColor: fill === "transparent" ? "" : fill,
              stroke: "transparent",
              strokeWidth: 0,
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
            obj.set("data", {
              id: m.id,
              type: m.type,
              _lastLeft: obj.left,
              _lastTop: obj.top,
              canEdit,
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
            // Add text border rect behind the textbox
            if (m.type === 'text' && textBorderCache.current.has(m.id)) {
              const bRect = textBorderCache.current.get(m.id)!;
              canvas.add(bRect);
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
          const toSelect = prevActiveIds
            .map((id) => cache.get(id))
            .filter(Boolean) as fabric.Object[];
          if (toSelect.length === 1) canvas.setActiveObject(toSelect[0]);
          else if (toSelect.length > 1)
            canvas.setActiveObject(
              new fabric.ActiveSelection(toSelect, { canvas }),
            );
        }

        isInSync.current = false;
        canvas.requestRenderAll();
      },
      [hiddenLayers],
    );

    useEffect(() => {
      const canvas = fabricCanvas.current;
      if (!canvas) return;
      canvas.setDimensions({ width, height });
      syncMarkups(canvas, markups, width, height, scale);
    }, [width, height, scale, syncMarkups, markups]);

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
          ctx.globalAlpha = 0.5;
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
          ctx.globalAlpha = 0.5;
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
      const activeObj = canvas.getActiveObject(),
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
export default MarkupLayer;
