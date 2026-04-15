/**
 * MarkupViewportCanvas v4 — Per-Viewport markup rendering engine.
 * ONE Fabric canvas = screen size. viewportTransform for zoom/pan.
 * CSS Scale = 1.0 ALWAYS → pixel-perfect at any zoom.
 *
 * v4: No flickering (no double render), accurate markup rendering matching old engine,
 *     arrow heads, cloud path, measure ticks, stamp shapes, callout connector.
 */
import { useEffect, useRef, useCallback, memo } from 'react';
// @ts-ignore
import { fabric } from 'fabric';

interface Viewport { zoom: number; x: number; y: number; }
interface PageLayout { index: number; worldX: number; worldY: number; w: number; h: number; }
interface Markup { id: string; type: string; pageNumber: number; coordinates: any; properties: any; author?: { name?: string }; authorId?: string; [k: string]: any; }

interface Props {
  viewport: Viewport;
  pageLayouts: PageLayout[];
  containerWidth: number;
  containerHeight: number;
  markups: Markup[];
  tool: string;
  activeColor: string;
  activeStrokeWidth: number;
  activeLineStyle?: string;
  selectedMarkupIds?: string[];
  onMarkupSelected?: (ids: string[]) => void;
  onMarkupModified?: (data: any) => void;
  onMarkupAdded?: (data: any) => void;
  onMarkupDeleted?: (id: string | string[]) => void;
  onDeselect?: () => void;
  onContextMenu?: (e: any, ids: string[]) => void;
  showAuthorOnMarkup?: boolean;
  canMarkup?: boolean;
  isAdmin?: boolean;
  currentUserId?: string;
  activeSessionId?: string;
}

// ── Cloud path (bumpy edges like Bluebeam) ──
function makeCloudPath(l: number, t: number, w: number, h: number, arc = 20): string {
  if (w < arc * 2) w = arc * 2;
  if (h < arc * 2) h = arc * 2;
  const nx = Math.max(2, Math.round(w / arc)), ny = Math.max(2, Math.round(h / arc));
  const sx = w / nx, sy = h / ny, r = (s: number) => s * 0.5;
  let d = `M ${l} ${t}`;
  for (let i = 0; i < nx; i++) d += ` A ${r(sx)} ${r(sx)} 0 0 1 ${l + (i + 1) * sx} ${t}`;
  for (let i = 0; i < ny; i++) d += ` A ${r(sy)} ${r(sy)} 0 0 1 ${l + w} ${t + (i + 1) * sy}`;
  for (let i = 0; i < nx; i++) d += ` A ${r(sx)} ${r(sx)} 0 0 1 ${l + w - (i + 1) * sx} ${t + h}`;
  for (let i = 0; i < ny; i++) d += ` A ${r(sy)} ${r(sy)} 0 0 1 ${l} ${t + h - (i + 1) * sy}`;
  return d + ' Z';
}

// ── Arrow path (line + arrowhead) ──
function makeArrowPath(x1: number, y1: number, x2: number, y2: number, headSize: number, style = 'end'): string {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  let d = `M ${x1} ${y1} L ${x2} ${y2}`;
  const drawHead = (px: number, py: number, a: number) => {
    const lx = px - headSize * Math.cos(a - 0.4), ly = py - headSize * Math.sin(a - 0.4);
    const rx = px - headSize * Math.cos(a + 0.4), ry = py - headSize * Math.sin(a + 0.4);
    d += ` M ${lx} ${ly} L ${px} ${py} L ${rx} ${ry}`;
  };
  if (style === 'end' || style === 'both') drawHead(x2, y2, ang);
  if (style === 'start' || style === 'both') drawHead(x1, y1, ang + Math.PI);
  return d;
}

// ── Measure path (line + ticks + optional extensions) ──
function makeMeasurePath(x1: number, y1: number, x2: number, y2: number, tickSize: number, extSize = 0): string {
  const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  let d = `M ${x1} ${y1} L ${x2} ${y2}`;
  d += ` M ${x1 - nx * tickSize} ${y1 - ny * tickSize} L ${x1 + nx * tickSize} ${y1 + ny * tickSize}`;
  d += ` M ${x2 - nx * tickSize} ${y2 - ny * tickSize} L ${x2 + nx * tickSize} ${y2 + ny * tickSize}`;
  if (extSize > 0) {
    d += ` M ${x1} ${y1} L ${x1 - ux * extSize} ${y1 - uy * extSize}`;
    d += ` M ${x2} ${y2} L ${x2 + ux * extSize} ${y2 + uy * extSize}`;
  }
  return d;
}

function getDash(s?: string) { return s === 'dashed' ? [10, 5] : s === 'dotted' ? [2, 4] : undefined; }

function worldToPage(wx: number, wy: number, layouts: PageLayout[]) {
  for (const p of layouts) { if (wx >= p.worldX && wx <= p.worldX + p.w && wy >= p.worldY && wy <= p.worldY + p.h) return { page: p, nx: (wx - p.worldX) / p.w, ny: (wy - p.worldY) / p.h }; }
  if (!layouts.length) return null;
  let best = layouts[0], bd = Infinity;
  for (const p of layouts) { const d = (wx - p.worldX - p.w / 2) ** 2 + (wy - p.worldY - p.h / 2) ** 2; if (d < bd) { bd = d; best = p; } }
  return { page: best, nx: Math.max(0, Math.min(1, (wx - best.worldX) / best.w)), ny: Math.max(0, Math.min(1, (wy - best.worldY) / best.h)) };
}

function buildVT(vp: Viewport, cw: number, dpr: number): number[] {
  const s = vp.zoom * dpr;
  return [s, 0, 0, s, (-vp.x * vp.zoom + cw / 2) * dpr, -vp.y * vp.zoom * dpr];
}

function mToW(m: Markup, layouts: PageLayout[]) {
  const p = layouts.find(l => l.index === m.pageNumber);
  if (!p) return null;
  const c = m.coordinates || {}, a = c.angle || 0;
  if (c.cloud) { const cl = c.cloud, tb = c.textBox; return { x: p.worldX + (cl.left||0)*p.w, y: p.worldY + (cl.top||0)*p.h, w: (cl.width||.1)*p.w, h: (cl.height||.1)*p.h, a, p, tb: tb ? { x: p.worldX+tb.left*p.w, y: p.worldY+tb.top*p.h, w: tb.width*p.w, h: (tb.height||.05)*p.h } : null }; }
  if (c.left !== undefined) return { x: p.worldX + c.left*p.w, y: p.worldY + (c.top||0)*p.h, w: (c.width||.1)*p.w, h: (c.height||c.width||.1)*p.h, a, p };
  if (c.x1 !== undefined) return { x1: p.worldX+c.x1*p.w, y1: p.worldY+c.y1*p.h, x2: p.worldX+(c.x2||0)*p.w, y2: p.worldY+(c.y2||0)*p.h, a, p };
  if (Array.isArray(c.points) && c.points.length >= 2) return { pts: c.points.map((pt: any) => ({ x: p.worldX+pt.x*p.w, y: p.worldY+pt.y*p.h })), a, p };
  return { x: p.worldX, y: p.worldY, w: 100, h: 100, a, p };
}

// ── Component ──
function MarkupViewportCanvas({ viewport, pageLayouts, containerWidth, containerHeight, markups, tool, activeColor, activeStrokeWidth, activeLineStyle, onMarkupSelected, onMarkupModified, onMarkupAdded, onMarkupDeleted, onDeselect, onContextMenu, showAuthorOnMarkup, canMarkup = true, isAdmin = false, currentUserId, activeSessionId }: Props) {
  const elRef = useRef<HTMLCanvasElement>(null);
  const fcRef = useRef<fabric.Canvas | null>(null);
  const cache = useRef(new Map<string, fabric.Object>());
  const auxC = useRef(new Map<string, fabric.Object[]>());
  const hCache = useRef(new Map<string, string>());
  const tRef = useRef(tool), cRef = useRef(activeColor), wRef = useRef(activeStrokeWidth), lRef = useRef(pageLayouts), vRef = useRef(viewport);
  const drawR = useRef<{ sx: number; sy: number; obj: fabric.Object | null; t: string } | null>(null);
  const editR = useRef<string | null>(null);
  const clipR = useRef<Markup[]>([]);
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  useEffect(() => { tRef.current = tool; }, [tool]);
  useEffect(() => { cRef.current = activeColor; }, [activeColor]);
  useEffect(() => { wRef.current = activeStrokeWidth; }, [activeStrokeWidth]);
  useEffect(() => { lRef.current = pageLayouts; }, [pageLayouts]);
  useEffect(() => { vRef.current = viewport; }, [viewport]);

  // ── Init (once) ──
  useEffect(() => {
    if (!elRef.current) return;
    const canvas = new fabric.Canvas(elRef.current, {
      width: containerWidth * dpr, height: containerHeight * dpr,
      selection: true, fireRightClick: true, stopContextMenu: true,
      renderOnAddRemove: false, enableRetinaScaling: false,
      imageSmoothingEnabled: true, preserveObjectStacking: true,
    });
    const setCSS = () => {
      [canvas.getElement(), canvas.upperCanvasEl].forEach(el => { if (el) { el.style.width = containerWidth + 'px'; el.style.height = containerHeight + 'px'; } });
    };
    setCSS();
    fabric.Object.prototype.set({ transparentCorners: false, cornerColor: '#1565c0', cornerStrokeColor: '#fff', borderColor: 'rgba(21,101,192,0.7)', cornerSize: 10, borderScaleFactor: 1.5, padding: 6 });
    fcRef.current = canvas;

    canvas.on('selection:created', (e: any) => { onMarkupSelected?.((e.selected||[]).map((o:any)=>o.data?.id).filter(Boolean)); });
    canvas.on('selection:updated', (e: any) => { onMarkupSelected?.((e.selected||[]).map((o:any)=>o.data?.id).filter(Boolean)); });
    canvas.on('selection:cleared', () => onDeselect?.());

    canvas.on('mouse:down', (opt: any) => {
      if (opt.button === 3 && opt.target?.data?.id) {
        const ids = canvas.getActiveObjects().map((o:any)=>o.data?.id).filter(Boolean);
        if (!ids.includes(opt.target.data.id)) ids.push(opt.target.data.id);
        onContextMenu?.({ clientX: opt.e.clientX, clientY: opt.e.clientY, preventDefault: () => opt.e.preventDefault() }, ids);
        return;
      }
      const t = tRef.current;
      if (t === 'select' || t === 'pan' || t === 'textSelect') return;
      if (opt.target) return;
      const ptr = canvas.getPointer(opt.e);
      drawR.current = { sx: ptr.x, sy: ptr.y, obj: null, t };
      if (t === 'pen' || t === 'highlighter') {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = t === 'highlighter' ? cRef.current + '60' : cRef.current;
        canvas.freeDrawingBrush.width = wRef.current;
      }
    });

    canvas.on('mouse:move', (opt: any) => {
      const d = drawR.current; if (!d || d.t === 'pen' || d.t === 'highlighter') return;
      const ptr = canvas.getPointer(opt.e);
      const x = Math.min(d.sx, ptr.x), y = Math.min(d.sy, ptr.y), w = Math.abs(ptr.x - d.sx), h = Math.abs(ptr.y - d.sy);
      if (w < 2 && h < 2) return;
      if (d.obj) canvas.remove(d.obj);
      const c = cRef.current, sw = wRef.current;
      let o: fabric.Object | null = null;
      if (d.t === 'rect') o = new fabric.Rect({ left: x, top: y, width: w, height: h, fill: 'transparent', stroke: c, strokeWidth: sw });
      else if (d.t === 'circle') { const r = Math.sqrt(w*w+h*h)/2; o = new fabric.Circle({ left: d.sx-r, top: d.sy-r, radius: r, fill: 'transparent', stroke: c, strokeWidth: sw }); }
      else if (d.t === 'ellipse') o = new fabric.Ellipse({ left: x, top: y, rx: w/2, ry: h/2, fill: 'transparent', stroke: c, strokeWidth: sw });
      else if (d.t === 'line' || d.t === 'arrow' || d.t === 'measure') o = new fabric.Line([d.sx, d.sy, ptr.x, ptr.y], { stroke: c, strokeWidth: sw });
      else if (d.t === 'cloud') o = new fabric.Path(makeCloudPath(x, y, w, h), { fill: 'transparent', stroke: c, strokeWidth: sw });
      else if (d.t === 'text' || d.t === 'stickyNote') o = new fabric.Rect({ left: x, top: y, width: w, height: h, fill: d.t === 'stickyNote' ? '#FFEB3B80' : 'rgba(0,0,0,0.05)', stroke: c, strokeWidth: 1, opacity: 0.5 });
      else if (d.t === 'callout') o = new fabric.Path(makeCloudPath(x, y, w, h), { fill: 'transparent', stroke: c, strokeWidth: sw });
      if (o) { o.set({ selectable: false, evented: false }); canvas.add(o); d.obj = o; canvas.requestRenderAll(); }
    });

    canvas.on('mouse:up', (opt: any) => {
      const d = drawR.current; if (!d) return; drawR.current = null;
      if (d.t === 'pen' || d.t === 'highlighter') { canvas.isDrawingMode = false; return; }
      if (d.obj) canvas.remove(d.obj);
      const ptr = canvas.getPointer(opt.e), w = Math.abs(ptr.x - d.sx), h = Math.abs(ptr.y - d.sy);
      if (w < 3 && h < 3) return;
      const pg = worldToPage(d.sx, d.sy, lRef.current); if (!pg) return;
      const x = Math.min(d.sx, ptr.x), y = Math.min(d.sy, ptr.y);
      let coords: any;
      if (d.t === 'line' || d.t === 'arrow' || d.t === 'measure') coords = { x1: (d.sx-pg.page.worldX)/pg.page.w, y1: (d.sy-pg.page.worldY)/pg.page.h, x2: (ptr.x-pg.page.worldX)/pg.page.w, y2: (ptr.y-pg.page.worldY)/pg.page.h };
      else coords = { left: (x-pg.page.worldX)/pg.page.w, top: (y-pg.page.worldY)/pg.page.h, width: w/pg.page.w, height: h/pg.page.h };
      onMarkupAdded?.({ type: d.t, pageNumber: pg.page.index, coordinates: coords, properties: { stroke: cRef.current, strokeWidth: wRef.current, ...(d.t === 'stickyNote' && { fill: '#FFEB3B', textColor: '#212121' }), ...(d.t === 'text' && { text: 'Text', fontSize: 20 }) } });
    });

    canvas.on('path:created', (opt: any) => {
      const path = opt.path; if (!path) return; canvas.isDrawingMode = false;
      const b = path.getBoundingRect(), vt = canvas.viewportTransform || [1,0,0,1,0,0];
      const wL = (b.left-vt[4])/vt[0], wT = (b.top-vt[5])/vt[3], wW = b.width/vt[0], wH = b.height/vt[3];
      const pg = worldToPage(wL, wT, lRef.current); if (!pg) { canvas.remove(path); return; }
      onMarkupAdded?.({ type: tRef.current === 'highlighter' ? 'highlighter' : 'pen', pageNumber: pg.page.index, coordinates: { path: (path as any).path?.map((s:any)=>s.join(' ')).join(' ')||'', left: (wL-pg.page.worldX)/pg.page.w, top: (wT-pg.page.worldY)/pg.page.h, width: wW/pg.page.w, height: wH/pg.page.h }, properties: { stroke: cRef.current, strokeWidth: wRef.current } });
      canvas.remove(path);
    });

    canvas.on('object:modified', (opt: any) => {
      const obj = opt.target; if (!obj?.data?.id || !obj.data._p) return;
      const p = obj.data._p as PageLayout;
      if (obj.data._ln) {
        const l = obj as fabric.Line;
        onMarkupModified?.({ id: obj.data.id, type: obj.data.type, coordinates: { x1: (l.x1!-p.worldX)/p.w, y1: (l.y1!-p.worldY)/p.h, x2: (l.x2!-p.worldX)/p.w, y2: (l.y2!-p.worldY)/p.h } });
      } else {
        const ww = (obj.width||0)*(obj.scaleX||1), wh = (obj.height||0)*(obj.scaleY||1);
        obj.set({ scaleX: 1, scaleY: 1, width: ww, height: wh });
        onMarkupModified?.({ id: obj.data.id, type: obj.data.type, coordinates: { left: ((obj.left||0)-p.worldX)/p.w, top: ((obj.top||0)-p.worldY)/p.h, width: ww/p.w, height: wh/p.h, angle: obj.angle||0 } });
      }
    });

    canvas.on('mouse:dblclick', (opt: any) => {
      if (tRef.current !== 'select') return;
      const target = canvas.findTarget(opt.e, false) as any; if (!target?.data?.id) return;
      const mk = (window as any).__vpcM?.find((m:any)=>m.id===target.data.id); if (!mk) return;
      editR.current = target.data.id;
      const txt = mk.properties?.text || '', b = target.getBoundingRect(), ct = elRef.current?.parentElement; if (!ct) return;
      const ta = document.createElement('textarea'); ta.value = txt;
      Object.assign(ta.style, { position:'absolute', left:b.left/dpr+'px', top:b.top/dpr+'px', width:Math.max(60,b.width/dpr)+'px', minHeight:Math.max(30,b.height/dpr)+'px', fontSize:Math.max(10,Math.min(b.width,b.height)/dpr*0.3)+'px', fontFamily:'Arial', fontWeight:'bold', textAlign:'center', color:'#000', backgroundColor:'rgba(255,255,200,0.95)', border:'2px solid #1565c0', borderRadius:'3px', outline:'none', resize:'none', overflow:'hidden', zIndex:'9999', padding:'4px', boxSizing:'border-box' });
      ct.appendChild(ta); ta.focus(); ta.select();
      const fin = () => { const v = ta.value; if (ct.contains(ta)) ct.removeChild(ta); editR.current = null; if (v !== txt) onMarkupModified?.({ id: target.data.id, type: mk.type, coordinates: mk.coordinates, properties: { ...mk.properties, text: v } }); };
      ta.addEventListener('blur', fin);
      ta.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key==='Escape'){ta.value=txt;ta.blur();} e.stopPropagation(); });
    });

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (t?.tagName==='INPUT'||t?.tagName==='TEXTAREA'||t?.isContentEditable||editR.current) return;
      if (e.key==='Delete'||e.key==='Backspace') { const ids=canvas.getActiveObjects().map((o:any)=>o.data?.id).filter(Boolean); if (ids.length) { e.preventDefault(); onMarkupDeleted?.(ids.length===1?ids[0]:ids); } }
      if ((e.ctrlKey||e.metaKey)&&e.key==='c') { const ids=canvas.getActiveObjects().map((o:any)=>o.data?.id).filter(Boolean); clipR.current=ids.map((id: string)=>((window as any).__vpcM||[]).find((m:any)=>m.id===id)).filter(Boolean); }
      if ((e.ctrlKey||e.metaKey)&&e.key==='v'&&clipR.current.length) { e.preventDefault(); for (const m of clipR.current) { const nc=JSON.parse(JSON.stringify(m.coordinates)); if(nc.left!==undefined){nc.left+=0.02;nc.top=(nc.top||0)+0.02;}else if(nc.x1!==undefined){nc.x1+=0.02;nc.y1+=0.02;nc.x2+=0.02;nc.y2+=0.02;} onMarkupAdded?.({type:m.type,pageNumber:m.pageNumber,coordinates:nc,properties:{...m.properties}}); } }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); canvas.dispose(); fcRef.current = null; cache.current.clear(); auxC.current.clear(); hCache.current.clear(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize
  useEffect(() => { const c = fcRef.current; if (!c) return; const nw=containerWidth*dpr,nh=containerHeight*dpr; if(c.getWidth()!==nw||c.getHeight()!==nh){c.setDimensions({width:nw,height:nh});[c.getElement(),c.upperCanvasEl].forEach(el=>{if(el){el.style.width=containerWidth+'px';el.style.height=containerHeight+'px';}})} }, [containerWidth, containerHeight, dpr]);

  // ViewportTransform — NO requestRenderAll (setViewportTransform renders internally)
  useEffect(() => { const c = fcRef.current; if (c) c.setViewportTransform(buildVT(viewport, containerWidth, dpr)); }, [viewport.zoom, viewport.x, viewport.y, containerWidth, dpr]);

  // Tool
  useEffect(() => { const c=fcRef.current; if(!c)return; const s=tool==='select'; c.selection=s; c.isDrawingMode=false; c.getObjects().forEach((o:any)=>{if(o.data?.id)o.set({selectable:s,evented:s})}); c.defaultCursor=tool==='pan'?'grab':s?'default':'crosshair'; c.requestRenderAll(); }, [tool]);

  // Markups ref
  useEffect(() => { (window as any).__vpcM = markups; return () => { delete (window as any).__vpcM; }; }, [markups]);

  // ── Sync ──
  const sync = useCallback(() => {
    const c = fcRef.current; if (!c || !pageLayouts.length) return;
    const cc = cache.current, hc = hCache.current, isSel = tRef.current === 'select';
    const cur = new Set<string>();

    for (const m of markups) {
      cur.add(m.id);
      if (editR.current === m.id) continue;
      const W = mToW(m, pageLayouts); if (!W) continue;
      const pr = m.properties || {}, co = m.coordinates || {};
      const h = `${m.type}|${JSON.stringify(co)}|${pr.stroke}|${pr.fill}|${pr.strokeWidth}|${pr.text}|${pr.fontSize}|${pr.stampShape}|${m.updatedAt||''}|${showAuthorOnMarkup?1:0}`;
      if (hc.get(m.id) === h && cc.has(m.id)) continue;

      // Clean old
      const old = cc.get(m.id); if (old) c.remove(old);
      const oa = auxC.current.get(m.id); if (oa) oa.forEach(a => c.remove(a)); auxC.current.delete(m.id);

      const sk = pr.stroke || '#d32f2f', sw = pr.strokeWidth || 2;
      const fl = pr.fill && pr.fill !== 'transparent' ? pr.fill : 'transparent';
      const da = getDash(pr.lineStyle);
      const pg = (W as any).p as PageLayout;
      let obj: fabric.Object | null = null;
      const aux: fabric.Object[] = [];
      const w: any = W;

      // ── Rect types ──
      if (m.type === 'rect') {
        obj = new fabric.Rect({ left: w.x, top: w.y, width: w.w, height: w.h, fill: fl, stroke: sk, strokeWidth: sw, strokeDashArray: da, angle: w.a });
      }
      // ── Circle / Stub ──
      else if (m.type === 'circle' || m.type === 'stub') {
        const r = Math.min(w.w, w.h) / 2;
        const sf = m.type === 'stub' && pr.stubDirection === 'down' ? sk : fl;
        obj = new fabric.Circle({ left: w.x, top: w.y, radius: r, fill: sf, stroke: sk, strokeWidth: sw, angle: w.a });
        // Stub text
        if (m.type === 'stub') {
          const lbl = new fabric.Text(pr.text || (pr.stubDirection === 'down' ? 'SD' : 'SU'), { left: w.x + r, top: w.y + r, originX: 'center', originY: 'center', fontSize: Math.max(4, r * 0.85), fontFamily: 'Arial', fontWeight: 'bold', fill: pr.stubDirection === 'down' ? '#fff' : (pr.textColor || sk), angle: w.a, selectable: false, evented: false });
          aux.push(lbl);
        }
      }
      // ── Ellipse ──
      else if (m.type === 'ellipse') {
        obj = new fabric.Ellipse({ left: w.x, top: w.y, rx: w.w / 2, ry: w.h / 2, fill: fl, stroke: sk, strokeWidth: sw, angle: w.a });
      }
      // ── Cloud (bumpy) ──
      else if (m.type === 'cloud') {
        obj = new fabric.Path(makeCloudPath(w.x, w.y, w.w, w.h, pr.cloudArcSize || 20), { fill: fl, stroke: sk, strokeWidth: sw, strokeDashArray: da });
        if (co.angle) obj.set({ angle: co.angle });
      }
      // ── Callout ──
      else if (m.type === 'callout') {
        obj = new fabric.Path(makeCloudPath(w.x, w.y, w.w, w.h, pr.cloudArcSize || 20), { fill: fl, stroke: sk, strokeWidth: sw, strokeDashArray: da, angle: w.a });
        if (w.tb) {
          const bg = new fabric.Rect({ left: w.tb.x, top: w.tb.y, width: w.tb.w, height: w.tb.h, fill: pr.textBoxFill || '#fff', stroke: pr.textBoxStroke || sk, strokeWidth: 1, selectable: false, evented: false });
          aux.push(bg);
          const tb = new fabric.Textbox(pr.text || '', { left: w.tb.x + 2, top: w.tb.y + 2, width: w.tb.w - 4, fontSize: pr.fontSize || 14, fill: pr.textColor || '#000', fontFamily: pr.fontFamily || 'Arial', editable: false, selectable: false, evented: false });
          aux.push(tb);
          const conn = new fabric.Line([w.x + w.w / 2, w.y + w.h / 2, w.tb.x + w.tb.w / 2, w.tb.y + w.tb.h / 2], { stroke: pr.connectorStroke || sk, strokeWidth: Math.max(1, sw * 0.5), selectable: false, evented: false });
          aux.push(conn);
        }
      }
      // ── Text / StickyNote ──
      else if (m.type === 'text' || m.type === 'stickyNote') {
        const bg = m.type === 'stickyNote' ? (pr.fill || '#FFEB3B') : (fl === 'transparent' ? '' : fl);
        obj = new fabric.Textbox(pr.text || (m.type === 'text' ? 'Text' : ''), {
          left: w.x, top: w.y, width: w.w, fontSize: pr.fontSize || (m.type === 'text' ? 20 : 14),
          fill: pr.textColor || '#000', fontFamily: pr.fontFamily || 'Arial', fontWeight: pr.fontWeight || 'normal',
          fontStyle: pr.fontStyle || 'normal', textAlign: pr.textAlign || 'left',
          backgroundColor: bg, stroke: 'transparent', strokeWidth: 0, editable: false, angle: w.a,
          ...(m.type === 'stickyNote' && { shadow: new (fabric as any).Shadow({ color: 'rgba(0,0,0,0.25)', blur: 10, offsetX: 2, offsetY: 4 }) }),
        });
      }
      // ── Arrow ──
      else if (m.type === 'arrow' && w.x1 !== undefined) {
        const hs = (pr.arrowSize || 10) * Math.max(1, sw / 2);
        obj = new fabric.Path(makeArrowPath(w.x1, w.y1, w.x2, w.y2, hs, pr.arrowStyle || 'end'), { fill: 'transparent', stroke: sk, strokeWidth: sw, strokeDashArray: da });
      }
      // ── Line ──
      else if (m.type === 'line' && w.x1 !== undefined) {
        obj = new fabric.Line([w.x1, w.y1, w.x2, w.y2], { stroke: sk, strokeWidth: sw, strokeDashArray: da });
      }
      // ── Measure ──
      else if (m.type === 'measure' && w.x1 !== undefined) {
        const ts = pr.tickSize ?? 6, es = pr.extensionSize ?? 0;
        obj = new fabric.Path(makeMeasurePath(w.x1, w.y1, w.x2, w.y2, ts, es), { fill: 'transparent', stroke: sk, strokeWidth: sw, strokeDashArray: da });
        // Label
        const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = Math.sqrt(dx*dx+dy*dy);
        let ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang > 90 || ang < -90) ang -= 180;
        const ml = new fabric.Text(`${Math.round(len)}`, { left: (w.x1+w.x2)/2, top: (w.y1+w.y2)/2 - 8, originX: 'center', originY: 'bottom', fontSize: pr.fontSize || 14, fontFamily: pr.fontFamily || 'Arial', fontWeight: 'bold', fill: pr.labelTextColor || pr.textColor || sk, textBackgroundColor: pr.labelBg || 'rgba(255,255,255,0.85)', angle: ang, selectable: false, evented: false });
        aux.push(ml);
      }
      // ── Polyline / Route ──
      else if ((m.type === 'polyline' || m.type === 'routeTemplate' || m.type === 'route') && w.pts?.length >= 2) {
        obj = new fabric.Path('M ' + w.pts.map((p: any) => `${p.x} ${p.y}`).join(' L '), { fill: 'transparent', stroke: sk, strokeWidth: sw, strokeDashArray: m.type === 'routeTemplate' ? [6, 4] : da });
      }
      // ── ReviewStamp ──
      else if (m.type === 'reviewStamp') {
        const shape = pr.stampShape || 'rounded';
        const hasFill = pr.stampFill !== false;
        const rsFill = hasFill ? (fl !== 'transparent' ? fl : sk) : 'transparent';
        if (shape === 'circle') {
          const r = Math.max(w.w, w.h) / 2;
          obj = new fabric.Circle({ left: w.x, top: w.y, radius: r, fill: rsFill, stroke: sk, strokeWidth: sw * 1.5, angle: w.a });
        } else if (shape === 'diamond') {
          obj = new fabric.Polygon([{ x: w.x + w.w / 2, y: w.y }, { x: w.x + w.w, y: w.y + w.h / 2 }, { x: w.x + w.w / 2, y: w.y + w.h }, { x: w.x, y: w.y + w.h / 2 }], { fill: rsFill, stroke: sk, strokeWidth: sw * 1.5 });
        } else if (shape === 'triangle') {
          obj = new fabric.Polygon([{ x: w.x + w.w / 2, y: w.y }, { x: w.x + w.w, y: w.y + w.h }, { x: w.x, y: w.y + w.h }], { fill: rsFill, stroke: sk, strokeWidth: sw * 1.5 });
        } else if (shape === 'cloud') {
          obj = new fabric.Rect({ left: w.x, top: w.y, width: w.w, height: w.h, fill: rsFill, stroke: sk, strokeWidth: sw * 2, strokeDashArray: [4, 3], rx: w.h * 0.4, ry: w.h * 0.4 });
        } else {
          // rounded or rect
          const rx = shape === 'rounded' ? w.h * 0.35 : 0;
          obj = new fabric.Rect({ left: w.x, top: w.y, width: w.w, height: w.h, fill: rsFill, stroke: sk, strokeWidth: sw * 1.5, rx, ry: rx, angle: w.a });
        }
        // Stamp text
        const stxt = pr.text != null ? String(pr.text) : '?';
        const center = { x: w.x + w.w / 2, y: w.y + w.h / 2 };
        const sfs = Math.max(4, Math.min(w.w, w.h) * 0.45);
        const stc = hasFill ? '#fff' : (pr.textColor || sk);
        const sl = new fabric.Text(stxt, { left: center.x, top: shape === 'triangle' ? w.y + w.h * 0.6 : center.y, originX: 'center', originY: 'center', fontSize: sfs, fontFamily: 'Arial', fontWeight: 'bold', fill: stc, angle: w.a, selectable: false, evented: false });
        aux.push(sl);
      }
      // ── ElectricalBox / Panel ──
      else if (m.type === 'electricalBox' || m.type === 'panel') {
        const ef = pr.fill && pr.fill !== 'transparent' ? pr.fill : 'rgba(255,255,255,0.85)';
        obj = new fabric.Rect({ left: w.x, top: w.y, width: w.w, height: w.h, fill: ef, stroke: sk, strokeWidth: m.type === 'panel' ? sw * 1.5 : sw, angle: w.a });
        const etxt = pr.text != null ? String(pr.text) : (m.type === 'panel' ? 'PANEL' : 'JB');
        const efs = Math.max(4, Math.min(w.w, w.h) * 0.45);
        const el = new fabric.Text(etxt, { left: w.x + w.w / 2, top: w.y + w.h / 2, originX: 'center', originY: 'center', fontSize: efs, fontFamily: 'Arial', fontWeight: 'bold', fill: pr.textColor || sk, angle: w.a, selectable: false, evented: false });
        aux.push(el);
      }
      // ── WireTag ──
      else if (m.type === 'wireTag' && w.x1 !== undefined) {
        const leaderDir = w.x2 >= w.x1 ? 1 : -1;
        obj = new fabric.Path(`M ${w.x1} ${w.y1} L ${w.x1} ${w.y2} L ${w.x2} ${w.y2}`, { fill: 'transparent', stroke: sk, strokeWidth: sw });
        const wt = new fabric.Text(pr.text || '#12 AWG', { left: w.x2 + 4 * leaderDir, top: w.y2, fontSize: 12, originX: leaderDir > 0 ? 'left' : 'right', originY: 'center', fill: pr.textColor || sk, fontFamily: 'Arial', fontWeight: 'bold', textBackgroundColor: 'rgba(255,255,255,0.8)', selectable: false, evented: false });
        aux.push(wt);
      }
      // ── Pen / Highlighter ──
      else if (m.type === 'pen' || m.type === 'highlighter') {
        if (co.path) { try { obj = new fabric.Path(co.path, { left: w.x, top: w.y, fill: m.type === 'highlighter' ? sk + '40' : 'transparent', stroke: m.type === 'highlighter' ? 'transparent' : sk, strokeWidth: sw }); } catch {} }
      }
      // ── Fallback ──
      else {
        obj = new fabric.Rect({ left: w.x || 0, top: w.y || 0, width: w.w || 50, height: w.h || 50, fill: fl, stroke: sk, strokeWidth: sw, angle: w.a || 0 });
      }

      if (!obj) continue;
      const isLn = m.type === 'line' || m.type === 'arrow' || m.type === 'measure' || m.type === 'wireTag';

      // ── Permission logic (matches old MarkupLayer) ──
      const locked = !!pr.locked;
      const _eids = m.allowedEditUserIds;
      let canEdit = isAdmin || (currentUserId != null && m.authorId === currentUserId) || !_eids || _eids.includes('*') || (_eids.length > 0 && currentUserId != null && _eids.includes(currentUserId));
      // Session restriction: in Personal/Live only session markups editable
      if (activeSessionId && m.properties?.sessionId !== activeSessionId) canEdit = false;
      const effectiveLocked = !canMarkup || locked || !canEdit;
      const isHighlight = m.type === 'highlighter';
      const fullyLocked = effectiveLocked || isHighlight;

      obj.set({
        data: { id: m.id, type: m.type, _p: pg, _ln: isLn },
        selectable: isSel, evented: isSel,
        lockMovementX: fullyLocked, lockMovementY: fullyLocked,
        lockRotation: fullyLocked, lockScalingX: fullyLocked, lockScalingY: fullyLocked,
        hasControls: !fullyLocked,
        objectCaching: true,
      });
      c.add(obj); cc.set(m.id, obj); hc.set(m.id, h);

      // Add aux + bring main to front for callout
      for (const a of aux) { c.add(a); }
      if (m.type === 'callout' && aux.length) obj.bringToFront();

      // Author label
      if (showAuthorOnMarkup) {
        const an = pr.bluebeamAuthor || m.author?.name;
        if (an) {
          const b = obj.getBoundingRect(), vt = c.viewportTransform || [1,0,0,1,0,0];
          const COLS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9'];
          let ah = 0; for (let i=0;i<an.length;i++) ah=((ah<<5)-ah+an.charCodeAt(i))|0;
          const al = new fabric.Text(an, { left: (b.left+b.width/2-vt[4])/vt[0], top: (b.top+b.height-vt[5])/vt[3]+3, originX: 'center', originY: 'top', fontSize: 9, fontFamily: 'Arial', fontWeight: 'bold', fill: COLS[Math.abs(ah)%COLS.length], textBackgroundColor: 'rgba(0,0,0,0.5)', selectable: false, evented: false });
          aux.push(al);
          c.add(al);
        }
      }
      if (aux.length) auxC.current.set(m.id, aux);
    }

    // Cleanup
    for (const [id] of cc) {
      if (!cur.has(id)) { const o=cc.get(id); if(o) c.remove(o); cc.delete(id); hc.delete(id); const a=auxC.current.get(id); if(a) a.forEach(x=>c.remove(x)); auxC.current.delete(id); }
    }
    c.requestRenderAll();
  }, [markups, pageLayouts, showAuthorOnMarkup, canMarkup, isAdmin, currentUserId, activeSessionId]);

  useEffect(() => { sync(); }, [sync]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: containerWidth, height: containerHeight, pointerEvents: tool === 'pan' ? 'none' : 'auto', zIndex: 10 }}>
      <canvas ref={elRef} />
    </div>
  );
}

export default memo(MarkupViewportCanvas);
