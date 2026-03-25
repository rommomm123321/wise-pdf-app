import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
// @ts-ignore
import { fabric } from 'fabric';
import type { DrawTool } from './PdfToolbar';

interface MarkupLayerProps {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
  markups: any[];
  tool: DrawTool;
  activeColor?: string;
  activeStrokeWidth?: number;
  activeLineStyle?: 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'long-dash';
  docScale?: string;
  selectedMarkupIds?: string[];
  hiddenLayers?: string[];
  onMarkupAdded?: (markup: any) => void;
  onMarkupSelected?: (markupIds: string[]) => void;
  onMarkupModified?: (markup: any) => void;
  onContextMenu?: (e: MouseEvent, markupId: string) => void;
}

export interface MarkupLayerRef {
  getFabricCanvas: () => fabric.Canvas | null;
}

/* ─── Helpers ─── */

export function formatMeasurement(pts: number, docScale: string) {
  if (docScale === '1:1') return { text: `${Math.round(pts)}pt` };
  const inchesOnPaper = pts / 72;
  if (docScale.includes(':') && !docScale.includes('"')) {
    const ratio = parseFloat(docScale.split(':')[1]) || 1;
    const mmOnPaper = inchesOnPaper * 25.4;
    const realMm = mmOnPaper * ratio;
    if (realMm >= 1000) return { text: `${(realMm / 1000).toFixed(2)}m` };
    if (realMm >= 10) return { text: `${(realMm / 10).toFixed(1)}cm` };
    return { text: `${Math.round(realMm)}mm` };
  }
  let scaleFactor = 1;
  if (docScale.includes('=')) {
    const parts = docScale.split('=');
    const paperPart = parts[0].replace(/"/g, '').trim(); 
    const realPart = parts[1].trim(); 
    let paperInches = 1;
    if (paperPart.includes('/')) {
      const fr = paperPart.split('/');
      paperInches = parseFloat(fr[0]) / parseFloat(fr[1]);
    } else { paperInches = parseFloat(paperPart) || 1; }
    let realInches = 0;
    const feetMatch = realPart.match(/(\d+)'/);
    const inchMatch = realPart.match(/(\d+)"/);
    if (feetMatch) realInches += parseInt(feetMatch[1]) * 12;
    if (inchMatch) realInches += parseInt(inchMatch[1]);
    if (!feetMatch && !inchMatch && realPart.includes("'")) {
      realInches = parseInt(realPart.replace("'", '')) * 12;
    }
    scaleFactor = realInches / paperInches;
  } else { return { text: `${Math.round(pts)}pt` }; }
  const totalRealInches = inchesOnPaper * scaleFactor;
  const roundedTotalInches = Math.round(totalRealInches * 8) / 8;
  let feet = Math.floor(roundedTotalInches / 12);
  let inches = roundedTotalInches % 12;
  let wholeInches = Math.floor(inches);
  let fraction = inches - wholeInches;
  if (Math.abs(fraction - 1) < 0.01) {
    wholeInches += 1; fraction = 0;
    if (wholeInches === 12) { wholeInches = 0; feet += 1; }
  }
  let fracText = '';
  if (Math.abs(fraction - 0.125) < 0.01) fracText = ' 1/8';
  else if (Math.abs(fraction - 0.25) < 0.01) fracText = ' 1/4';
  else if (Math.abs(fraction - 0.375) < 0.01) fracText = ' 3/8';
  else if (Math.abs(fraction - 0.5) < 0.01) fracText = ' 1/2';
  else if (Math.abs(fraction - 0.625) < 0.01) fracText = ' 5/8';
  else if (Math.abs(fraction - 0.75) < 0.01) fracText = ' 3/4';
  else if (Math.abs(fraction - 0.875) < 0.01) fracText = ' 7/8';
  if (feet === 0) {
    if (wholeInches === 0 && fracText !== '') return { text: `${fracText.trim()}"` };
    return { text: `${wholeInches}${fracText}"` };
  }
  const inchPart = (wholeInches === 0 && fracText === '') ? '0"' : `${wholeInches}${fracText}"`;
  return { text: `${feet}' ${inchPart}` };
}

function makeCloudPath(left: number, top: number, w: number, h: number, arcSize = 20): string {
  if (w < arcSize * 2) w = arcSize * 2; if (h < arcSize * 2) h = arcSize * 2;
  const nx = Math.max(2, Math.round(w / arcSize)), ny = Math.max(2, Math.round(h / arcSize));
  const sx = w / nx, sy = h / ny;
  const r = (s: number) => s * 0.5;
  let d = `M ${left} ${top}`;
  for (let i = 0; i < nx; i++) d += ` A ${r(sx)} ${r(sx)} 0 0 1 ${left + (i + 1) * sx} ${top}`;
  for (let i = 0; i < ny; i++) d += ` A ${r(sy)} ${r(sy)} 0 0 1 ${left + w} ${top + (i + 1) * sy}`;
  for (let i = 0; i < nx; i++) d += ` A ${r(sx)} ${r(sx)} 0 0 1 ${left + w - (i + 1) * sx} ${top + h}`;
  for (let i = 0; i < ny; i++) d += ` A ${r(sy)} ${r(sy)} 0 0 1 ${left} ${top + h - (i + 1) * sy}`;
  return d + ' Z';
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0, g = parseInt(hex.slice(3, 5), 16) || 0, b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getDashArray(style: string): number[] {
  if (style === 'dashed') return [10, 5]; if (style === 'dotted') return [2, 4];
  if (style === 'dash-dot') return [10, 5, 2, 5]; if (style === 'long-dash') return [20, 8];
  return [];
}

// CRITICAL: INCLUDE CANVAS DIMENSIONS IN HASH TO FORCE RE-SYNC
function propHash(m: any, docScale?: string, w?: number, h?: number): string {
  return JSON.stringify(m.properties || {}) + JSON.stringify(m.coordinates || {}) + (docScale || '') + (w || '') + (h || '');
}

function trianglePoints(cx: number, cy: number, w: number, h: number) { return [{x:cx,y:cy-h/2},{x:cx+w/2,y:cy+h/2},{x:cx-w/2,y:cy+h/2}]; }
function diamondPoints(cx: number, cy: number, w: number, h: number) { return [{x:cx,y:cy-h/2},{x:cx+w/2,y:cy},{x:cx,y:cy+h/2},{x:cx-w/2,y:cy}]; }
function hexagonPoints(cx: number, cy: number, w: number, h: number) { const r = Math.min(w,h)/2; return Array.from({length:6},(_,i)=>({x:cx+r*Math.cos(Math.PI/6+i*Math.PI/3),y:cy+r*Math.sin(Math.PI/6+i*Math.PI/3)})); }
function starPoints(cx: number, cy: number, w: number, h: number) { const outer = Math.min(w,h)/2, inner = outer*0.4; return Array.from({length:10},(_,i)=>{ const r = i%2===0?outer:inner; const a = -Math.PI/2+i*Math.PI/5; return {x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)}; }); }

const MarkupLayer = forwardRef<MarkupLayerRef, MarkupLayerProps>(({
  pageNumber, width, height, scale, markups, tool,
  activeColor = '#d32f2f', activeStrokeWidth = 2, activeLineStyle = 'solid',
  docScale = '1:1', selectedMarkupIds = [], hiddenLayers = [],
  onMarkupAdded, onMarkupSelected, onMarkupModified, onContextMenu
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);
  const objectCache = useRef<Map<string, fabric.Object>>(new Map());
  const hashCache = useRef<Map<string, string>>(new Map());
  const isDrawing = useRef(false);
  const currentObject = useRef<fabric.Object | null>(null);
  const measureLabel = useRef<fabric.Text | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const toolRef = useRef(tool);
  const colorRef = useRef(activeColor);
  const widthRef = useRef(activeStrokeWidth);
  const lineStyleRef = useRef(activeLineStyle);
  const scaleRef = useRef(scale);
  const docScaleRef = useRef(docScale);

  useEffect(() => {
    toolRef.current = tool; colorRef.current = activeColor; widthRef.current = activeStrokeWidth; lineStyleRef.current = activeLineStyle; scaleRef.current = scale; docScaleRef.current = docScale;
  }, [tool, activeColor, activeStrokeWidth, activeLineStyle, scale, docScale]);

  useImperativeHandle(ref, () => ({ getFabricCanvas: () => fabricCanvas.current }));

  // CURSOR UPDATE
  useEffect(() => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    let cursor = 'default';
    switch (tool) {
      case 'select': cursor = 'default'; break;
      case 'pan': cursor = 'grab'; break;
      case 'pen': case 'highlighter': cursor = 'crosshair'; break;
      case 'measure': cursor = 'cell'; break;
      case 'text': cursor = 'text'; break;
      default: cursor = 'crosshair';
    }
    canvas.defaultCursor = cursor;
    canvas.hoverCursor = cursor === 'grab' ? 'grab' : 'pointer';
    canvas.setCursor(cursor);
    canvas.requestRenderAll();
  }, [tool]);

  useEffect(() => {
    if (!canvasRef.current || fabricCanvas.current) return;
    if (width <= 0 || height <= 0) return;

    const canvas = new fabric.Canvas(canvasRef.current, { 
      width, height, selection: tool === 'select', fireRightClick: true, stopContextMenu: true, renderOnAddRemove: false, enableRetinaScaling: false 
    });
    fabricCanvas.current = canvas;

    fabric.Object.prototype.set({ transparentCorners: false, cornerColor: '#005fb8', cornerStrokeColor: '#ffffff', borderColor: '#005fb8', cornerSize: 8, borderScaleFactor: 2, padding: 5, cornerStyle: 'rect' });

    const canvasElement = canvas.getElement();
    canvasElement.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

    canvas.on('mouse:down', (opt: any) => {
      const e = opt.e as MouseEvent;
      if (e.button === 1 || e.button === 2) {
        if (e.button === 2) { const target = canvas.findTarget(e, false); if (target?.data?.id) onContextMenu?.(e, target.data.id); }
        return;
      }
      if (['select', 'pan', 'pen', 'highlighter'].includes(toolRef.current)) return;
      if (toolRef.current === 'measure') {
        isDrawing.current = true; const pointer = canvas.getPointer(opt.e); startPos.current = { x: pointer.x, y: pointer.y };
        currentObject.current = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], { stroke: colorRef.current, strokeWidth: widthRef.current, selectable: false });
        measureLabel.current = new fabric.Text('0', { left: pointer.x, top: pointer.y - 15 * scaleRef.current, fontSize: 14 * scaleRef.current, fill: colorRef.current, fontFamily: 'Arial', originX: 'center', originY: 'bottom', selectable: false, textBackgroundColor: 'rgba(255,255,255,0.7)' });
        canvas.add(currentObject.current, measureLabel.current); return;
      }
      isDrawing.current = true; const pointer = canvas.getPointer(opt.e); startPos.current = { x: pointer.x, y: pointer.y };
      if (toolRef.current === 'rect' || toolRef.current === 'cloud' || toolRef.current === 'callout' || toolRef.current === 'text') {
        currentObject.current = new fabric.Rect({ left: pointer.x, top: pointer.y, width: 0, height: 0, fill: 'transparent', stroke: colorRef.current, strokeWidth: widthRef.current, strokeDashArray: getDashArray(lineStyleRef.current), selectable: false });
      } else if (toolRef.current === 'circle') {
        currentObject.current = new fabric.Circle({ left: pointer.x, top: pointer.y, radius: 0, fill: 'transparent', stroke: colorRef.current, strokeWidth: widthRef.current, strokeDashArray: getDashArray(lineStyleRef.current), selectable: false });
      } else if (toolRef.current === 'ellipse') {
        currentObject.current = new fabric.Ellipse({ left: pointer.x, top: pointer.y, rx: 0, ry: 0, fill: 'transparent', stroke: colorRef.current, strokeWidth: widthRef.current, strokeDashArray: getDashArray(lineStyleRef.current), selectable: false });
      } else if (toolRef.current === 'triangle') {
        currentObject.current = new fabric.Triangle({ left: pointer.x, top: pointer.y, width: 0, height: 0, fill: 'transparent', stroke: colorRef.current, strokeWidth: widthRef.current, strokeDashArray: getDashArray(lineStyleRef.current), selectable: false });
      } else if (['diamond', 'hexagon', 'star'].includes(toolRef.current)) {
        currentObject.current = new fabric.Polygon([], { left: pointer.x, top: pointer.y, fill: 'transparent', stroke: colorRef.current, strokeWidth: widthRef.current, strokeDashArray: getDashArray(lineStyleRef.current), selectable: false });
      } else if (['line', 'arrow'].includes(toolRef.current)) {
        currentObject.current = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], { stroke: colorRef.current, strokeWidth: widthRef.current, strokeDashArray: getDashArray(lineStyleRef.current), selectable: false });
      }
      if (currentObject.current) canvas.add(currentObject.current);
    });

    canvas.on('mouse:move', (opt: any) => {
      if (!isDrawing.current || !currentObject.current || !startPos.current) return;
      const e = opt.e as MouseEvent; let pointer = canvas.getPointer(e);
      const dx = pointer.x - startPos.current.x, dy = pointer.y - startPos.current.y;
      if (e.shiftKey) {
        if (['line', 'arrow', 'measure'].includes(toolRef.current)) {
          const angle = Math.atan2(dy, dx), dist = Math.sqrt(dx*dx + dy*dy), snapped = Math.round(angle / (Math.PI/4)) * (Math.PI/4);
          pointer.x = startPos.current.x + dist * Math.cos(snapped); pointer.y = startPos.current.y + dist * Math.sin(snapped);
        } else if (['rect', 'circle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'cloud', 'callout'].includes(toolRef.current)) {
          const side = Math.max(Math.abs(dx), Math.abs(dy)); pointer.x = startPos.current.x + (dx >= 0 ? side : -side); pointer.y = startPos.current.y + (dy >= 0 ? side : -side);
        }
      }
      if (toolRef.current === 'measure') {
        (currentObject.current as fabric.Line).set({ x2: pointer.x, y2: pointer.y });
        if (measureLabel.current && startPos.current) {
           const distPoints = Math.sqrt(Math.pow(pointer.x - startPos.current.x, 2) + Math.pow(pointer.y - startPos.current.y, 2)) / scaleRef.current;
           const angle = Math.atan2(pointer.y - startPos.current.y, pointer.x - startPos.current.x) * (180/Math.PI);
           let textAngle = angle; if (textAngle > 90 || textAngle < -90) textAngle -= 180;
           const { text } = formatMeasurement(distPoints, docScaleRef.current);
           measureLabel.current.set({ text, left: (startPos.current.x + pointer.x)/2, top: (startPos.current.y + pointer.y)/2, angle: textAngle });
        }
      } else if (toolRef.current === 'circle') {
        const radius = Math.sqrt(Math.pow(pointer.x - startPos.current.x, 2) + Math.pow(pointer.y - startPos.current.y, 2)) / 2;
        (currentObject.current as fabric.Circle).set({ radius, left: Math.min(startPos.current.x, pointer.x), top: Math.min(startPos.current.y, pointer.y) });
      } else if (toolRef.current === 'ellipse') {
        (currentObject.current as fabric.Ellipse).set({ rx: Math.abs(dx)/2, ry: Math.abs(dy)/2, left: Math.min(startPos.current.x, pointer.x), top: Math.min(startPos.current.y, pointer.y) });
      } else if (toolRef.current === 'triangle') {
        currentObject.current.set({ width: Math.abs(dx), height: Math.abs(dy), left: Math.min(startPos.current.x, pointer.x), top: Math.min(startPos.current.y, pointer.y) });
      } else if (['diamond', 'hexagon', 'star'].includes(toolRef.current)) {
        const w = Math.abs(dx), h = Math.abs(dy), cx = Math.min(startPos.current.x, pointer.x) + w/2, cy = Math.min(startPos.current.y, pointer.y) + h/2;
        let pts: any[] = diamondPoints(cx, cy, w, h);
        if (toolRef.current === 'hexagon') pts = hexagonPoints(cx, cy, w, h);
        else if (toolRef.current === 'star') pts = starPoints(cx, cy, w, h);
        (currentObject.current as fabric.Polygon).set({ points: pts, left: Math.min(startPos.current.x, pointer.x), top: Math.min(startPos.current.y, pointer.y) });
      } else if (['rect', 'cloud', 'callout', 'text'].includes(toolRef.current)) {
        currentObject.current.set({ left: Math.min(startPos.current.x, pointer.x), top: Math.min(startPos.current.y, pointer.y), width: Math.abs(pointer.x - startPos.current.x), height: Math.abs(pointer.y - startPos.current.y) });
      } else if (['line', 'arrow'].includes(toolRef.current)) { (currentObject.current as fabric.Line).set({ x2: pointer.x, y2: pointer.y }); }
      canvas.requestRenderAll();
    });

    canvas.on('mouse:up', () => {
      if (toolRef.current === 'measure' && isDrawing.current && currentObject.current) {
        isDrawing.current = false; const line = currentObject.current as fabric.Line, w = canvas.getWidth(), h = canvas.getHeight();
        onMarkupAdded?.({ type: 'measure', pageNumber, coordinates: { x1: line.x1!/w, y1: line.y1!/h, x2: line.x2!/w, y2: line.y2!/h }, properties: { stroke: colorRef.current, strokeWidth: widthRef.current, lineStyle: 'solid' } });
        canvas.remove(currentObject.current); if (measureLabel.current) canvas.remove(measureLabel.current);
        currentObject.current = null; measureLabel.current = null; startPos.current = null; return;
      }
      if (!isDrawing.current) return; isDrawing.current = false;
      if (currentObject.current) {
        const obj = currentObject.current, w = canvas.getWidth(), h = canvas.getHeight();
        let coords: any = {};
        if (['rect', 'circle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'cloud', 'callout', 'text'].includes(toolRef.current)) {
          const ow = obj.width! * (obj.scaleX || 1), oh = obj.height! * (obj.scaleY || 1);
          if (ow < 5 && oh < 5) { canvas.remove(obj); currentObject.current = null; startPos.current = null; return; }
          coords = { left: obj.left!/w, top: obj.top!/h, width: ow/w, height: oh/h };
        } else if (['line', 'arrow'].includes(toolRef.current)) {
          const line = obj as fabric.Line; coords = { x1: line.x1!/w, y1: line.y1!/h, x2: line.x2!/w, y2: line.y2!/h };
        }
        onMarkupAdded?.({ type: toolRef.current, pageNumber, coordinates: coords, properties: { stroke: colorRef.current, strokeWidth: widthRef.current, lineStyle: lineStyleRef.current } });
        canvas.remove(obj); currentObject.current = null;
      }
      startPos.current = null;
    });

    canvas.on('path:created', (opt: any) => {
      if (toolRef.current !== 'pen' && toolRef.current !== 'highlighter') return;
      const p = opt.path, w = canvas.getWidth(), h = canvas.getHeight();
      onMarkupAdded?.({ 
        type: toolRef.current, pageNumber, 
        coordinates: { left: p.left/w, top: p.top/h, width: (p.width*p.scaleX)/w, height: (p.height*p.scaleY)/h, path: p.path }, 
        properties: { stroke: p.stroke, strokeWidth: p.strokeWidth, lineStyle: lineStyleRef.current, originalWidth: w, originalHeight: h } 
      });
      canvas.remove(p);
    });

    canvas.on('object:modified', (opt: any) => {
      const obj = opt.target; if (!obj?.data?.id) return;
      const w = canvas.getWidth(), h = canvas.getHeight(), type = obj.data.type;
      let coords: any = {};
      if (['rect', 'circle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'cloud', 'callout'].includes(type)) {
        coords = { left: obj.left!/w, top: obj.top!/h, width: (obj.width!*(obj.scaleX||1))/w, height: (obj.height!*(obj.scaleY||1))/h, angle: obj.angle||0 };
      } else if (['line', 'arrow', 'measure'].includes(type)) {
        const line = (obj.type === 'group' ? obj.getObjects().find((o: any) => o.type === 'line') || obj : obj) as fabric.Line;
        let dx = 0, dy = 0;
        if (obj.type === 'group') { dx = obj.left - (obj.data?._lastLeft ?? obj.left); dy = obj.top - (obj.data?._lastTop ?? obj.top); }
        coords = { x1: (line.x1+dx)/w, y1: (line.y1+dy)/h, x2: (line.x2+dx)/w, y2: (line.y2+dy)/h, angle: obj.angle||0 };
      } else if (type === 'text') { coords = { left: obj.left/w, top: obj.top/h, angle: obj.angle||0, width: (obj.width!*(obj.scaleX||1))/w }; }
      else if (['pen', 'highlighter'].includes(type)) { coords = { ...obj.data.coordinates, left: obj.left/w, top: obj.top!/h, width: (obj.width!*(obj.scaleX||1))/w, height: (obj.height!*(obj.scaleY||1))/h, angle: obj.angle||0 }; }
      onMarkupModified?.({ id: obj.data.id, type, coordinates: coords });
    });

    canvas.on('selection:created', (e: any) => onMarkupSelected?.(e.selected?.map((o: any) => o.data?.id).filter(Boolean) || []));
    canvas.on('selection:updated', (e: any) => onMarkupSelected?.(e.selected?.map((o: any) => o.data?.id).filter(Boolean) || []));
    canvas.on('selection:cleared', () => onMarkupSelected?.([]));

    return () => { if (fabricCanvas.current) { fabricCanvas.current.dispose(); fabricCanvas.current = null; objectCache.current.clear(); hashCache.current.clear(); } };
  }, []);

  const syncMarkups = useCallback((canvas: fabric.Canvas, mks: any[], w: number, h: number, s: number) => {
    const cache = objectCache.current, hashes = hashCache.current, currentIds = new Set((mks || []).map(m => m.id));
    for (const [id, obj] of cache.entries()) { if (!currentIds.has(id)) { canvas.remove(obj); cache.delete(id); hashes.delete(id); } }

    for (const m of (mks || [])) {
      if (hiddenLayers.includes(m.type)) { if (cache.has(m.id)) { canvas.remove(cache.get(m.id)!); cache.delete(m.id); hashes.delete(m.id); } continue; }
      const newHash = propHash(m, docScaleRef.current, w, h), coords = m.coordinates || {}, props = m.properties || {}, stroke = props.stroke || '#d32f2f', strokeWidth = props.strokeWidth || 2, dash = getDashArray(props.lineStyle || 'solid');
      const fillHex = props.fill || 'transparent', fillOpacity = props.fillOpacity !== undefined ? props.fillOpacity : 0.2, fill = fillHex === 'transparent' ? 'transparent' : hexToRgba(fillHex, fillOpacity);
      const isSelect = toolRef.current === 'select', locked = !!props.locked;

      if (cache.has(m.id)) {
        const obj = cache.get(m.id)!;
        if (hashes.get(m.id) === newHash) {
          obj.set({ selectable: isSelect, evented: isSelect, lockMovementX: locked, lockMovementY: locked, lockRotation: locked, lockScalingX: locked, lockScalingY: locked, hasControls: !locked });
          continue;
        }
        canvas.remove(obj); cache.delete(m.id); hashes.delete(m.id);
      }

      let obj: fabric.Object | null = null;
      if (m.type === 'rect') obj = new fabric.Rect({ left: coords.left*w, top: coords.top*h, width: coords.width*w, height: coords.height*h, fill, stroke, strokeWidth, strokeDashArray: dash });
      else if (m.type === 'circle') obj = new fabric.Circle({ left: coords.left*w, top: coords.top*h, radius: (Math.min(coords.width*w, coords.height*h))/2, fill, stroke, strokeWidth, strokeDashArray: dash });
      else if (m.type === 'ellipse') obj = new fabric.Ellipse({ left: coords.left*w, top: coords.top*h, rx: (coords.width*w)/2, ry: (coords.height*h)/2, fill, stroke, strokeWidth, strokeDashArray: dash });
      else if (m.type === 'triangle') obj = new fabric.Polygon(trianglePoints(coords.left*w+(coords.width*w)/2, coords.top*h+(coords.height*h)/2, coords.width*w, coords.height*h).map(p => new fabric.Point(p.x,p.y)), { fill, stroke, strokeWidth, strokeDashArray: dash });
      else if (m.type === 'diamond') obj = new fabric.Polygon(diamondPoints(coords.left*w+(coords.width*w)/2, coords.top*h+(coords.height*h)/2, coords.width*w, coords.height*h).map(p => new fabric.Point(p.x,p.y)), { fill, stroke, strokeWidth, strokeDashArray: dash });
      else if (m.type === 'hexagon') obj = new fabric.Polygon(hexagonPoints(coords.left*w+(coords.width*w)/2, coords.top*h+(coords.height*h)/2, coords.width*w, coords.height*h).map(p => new fabric.Point(p.x,p.y)), { fill, stroke, strokeWidth, strokeDashArray: dash });
      else if (m.type === 'star') obj = new fabric.Polygon(starPoints(coords.left*w+(coords.width*w)/2, coords.top*h+(coords.height*h)/2, coords.width*w, coords.height*h).map(p => new fabric.Point(p.x,p.y)), { fill, stroke, strokeWidth, strokeDashArray: dash });
      else if (m.type === 'cloud') obj = new fabric.Path(makeCloudPath(coords.left*w, coords.top*h, coords.width*w, coords.height*h, 20*s), { fill, stroke, strokeWidth, strokeDashArray: dash });
      else if (m.type === 'line' || m.type === 'measure') {
        obj = new fabric.Line([coords.x1*w, coords.y1*h, coords.x2*w, coords.y2*h], { stroke, strokeWidth, strokeDashArray: dash });
        if (m.type === 'measure') {
          const dx = (coords.x2-coords.x1)*w, dy = (coords.y2-coords.y1)*h, distP = Math.sqrt(dx*dx+dy*dy)/s, angle = Math.atan2(dy,dx)*(180/Math.PI);
          let tA = angle; if (tA > 90 || tA < -90) tA -= 180;
          const { text } = formatMeasurement(distP, docScaleRef.current);
          const lbl = new fabric.Text(text, { left:((coords.x1+coords.x2)/2)*w, top:((coords.y1+coords.y2)/2)*h, fontSize:14*s, fill:stroke, fontFamily:'Arial', originX:'center', originY:'bottom', angle:tA, selectable:false, evented:false, textBackgroundColor:'rgba(255,255,255,0.7)' });
          obj = new fabric.Group([obj, lbl]);
        }
      } else if (m.type === 'arrow') {
        const l = new fabric.Line([coords.x1*w, coords.y1*h, coords.x2*w, coords.y2*h], { stroke, strokeWidth, strokeDashArray: dash });
        const angle = Math.atan2((coords.y2-coords.y1)*h, (coords.x2-coords.x1)*w)*(180/Math.PI);
        const head = new fabric.Triangle({ left: coords.x2*w, top: coords.y2*h, width: 10*s, height: 10*s, fill: stroke, originX: 'center', originY: 'center', angle: angle+90 });
        obj = new fabric.Group([l, head]);
      } else if (['pen', 'highlighter'].includes(m.type)) {
        if (coords.path) {
          obj = new fabric.Path(coords.path, { fill: 'transparent', stroke, strokeWidth, strokeDashArray: dash, left: coords.left*w, top: coords.top*h });
          const origW = props.originalWidth || w, origH = props.originalHeight || h;
          obj.set({ scaleX: w / origW, scaleY: h / origH });
          if (m.type === 'highlighter') { (obj as any).globalCompositeOperation = 'multiply'; obj.set({ opacity: 0.5 }); }
        }
      } else if (m.type === 'text') {
        obj = new fabric.Textbox(props.text || 'Text', { left: coords.left*w, top: coords.top*h, width: (coords.width || 0.2)*w, fontSize: (props.fontSize || 20)*s, fill: props.textColor || stroke, fontFamily: 'Arial' });
      }
      if (obj) {
        if (coords.angle !== undefined) obj.angle = coords.angle;
        obj.set('data', { id: m.id, type: m.type, _lastLeft: obj.left, _lastTop: obj.top });
        obj.set({ selectable: isSelect, evented: isSelect, lockMovementX: locked, lockMovementY: locked, lockRotation: locked, lockScalingX: locked, lockScalingY: locked, hasControls: !locked });
        canvas.add(obj); cache.set(m.id, obj); hashes.set(m.id, newHash);
      }
    }
    [...(mks || [])].sort((a, b) => (a.properties?.zIndex || 0) - (b.properties?.zIndex || 0)).forEach(m => cache.get(m.id)?.bringToFront());
    canvas.requestRenderAll();
  }, [hiddenLayers]);

  useEffect(() => { const canvas = fabricCanvas.current; if (!canvas) return; canvas.setDimensions({ width, height }); syncMarkups(canvas, markups, width, height, scale); }, [width, height, scale, syncMarkups, markups]);
  useEffect(() => {
    const canvas = fabricCanvas.current; if (!canvas) return;
    const activeObj = canvas.getActiveObject(), activeIds = activeObj ? (activeObj.type === 'activeSelection' ? (activeObj as fabric.ActiveSelection).getObjects().map((o: any) => o.data?.id) : [(activeObj as any).data?.id]) : [];
    if (JSON.stringify([...selectedMarkupIds].sort()) !== JSON.stringify([...activeIds].sort())) {
      canvas.discardActiveObject();
      const toSelect = (markups || []).filter(m => selectedMarkupIds.includes(m.id)).map(m => objectCache.current.get(m.id)).filter(Boolean) as fabric.Object[];
      if (toSelect.length === 1) canvas.setActiveObject(toSelect[0]); else if (toSelect.length > 1) canvas.setActiveObject(new fabric.ActiveSelection(toSelect, { canvas }));
      canvas.requestRenderAll();
    }
  }, [selectedMarkupIds]);

  return <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'auto' }}><canvas ref={canvasRef} /></div>;
});

MarkupLayer.displayName = 'MarkupLayer';
export default MarkupLayer;
