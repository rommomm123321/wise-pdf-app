import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, CircularProgress, useTheme, alpha,
  Menu, MenuItem, ListItemIcon, ListItemText, Typography,
  Popover, List, ListItemButton, Avatar, useMediaQuery,
  Select, ListSubheader, IconButton, InputBase
} from '@mui/material';
import Divider from '@mui/material/Divider';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import HistoryIcon from '@mui/icons-material/History';
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { useTranslation } from 'react-i18next';

// react-pdf
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { apiFetch } from '../lib/api';
import { useMarkups, useUpdateMarkup, useDeleteMarkup, useCreateMarkup, type Markup } from '../hooks/useMarkups';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useProjectUsers } from '../hooks/useProjectUsers';
import { useAuth } from '../contexts/AuthContext';

// Components
import PdfToolbar, { type DrawTool, type LineStyle, STANDARD_SCALES } from '../components/pdf/PdfToolbar';
import PdfSidebar from '../components/pdf/PdfSidebar';
import MarkupPropertiesPanel from '../components/pdf/MarkupPropertiesPanel';
import MarkupLayer from '../components/pdf/MarkupLayer';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const SearchHighlightLayer = memo(({ pageIndex, keyword, scale, pdfData }: { pageIndex: number, keyword: string, scale: number, pdfData: string }) => {
  const [matches, setMatches] = useState<{ x: number, y: number, w: number, h: number }[]>([]);

  useEffect(() => {
    if (!keyword || keyword.length < 2 || !pdfData) { setMatches([]); return; }
    
    const findText = async () => {
      try {
        const pdf = await pdfjs.getDocument(pdfData).promise;
        const page = await pdf.getPage(pageIndex + 1);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });
        
        const results: any[] = [];
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'gi');

        textContent.items.forEach((item: any) => {
          let match;
          while ((match = regex.exec(item.str)) !== null) {
            const tx = pdfjs.Util.transform(viewport.transform, item.transform);
            const itemH = item.height || Math.abs(item.transform[0]) || 12;
            
            results.push({
              pageIndex: pageIndex,
              matchIndex: results.length,
              text: item.str,
              before: item.str.substring(0, match.index),
              after: item.str.substring(match.index + keyword.length),
              x: tx[4],
              y: tx[5] - itemH,
              w: item.width || 50,
              h: itemH
            });
          }
        });
        setMatches(results);
      } catch (e) { console.error(e); }
    };
    findText();
  }, [pageIndex, keyword, pdfData]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%', zIndex: 4 }}>
      {matches.map((m, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: m.x * scale,
          top: m.y * scale,
          width: m.w * scale,
          height: m.h * scale,
          backgroundColor: 'rgba(255, 255, 0, 0.6)',
          border: '2px solid orange',
          borderRadius: '2px',
          boxShadow: '0 0 5px rgba(255, 165, 0, 0.8)'
        }} />
      ))}
    </div>
  );
});

const PageContainer = memo(({ 
  pageIndex, pdfWidth, pdfHeight, scale, markups, tool, activeColor, activeStrokeWidth, activeLineStyle, docScale, 
  hiddenLayers, selectedMarkupIds, handleMarkupAdded, handleMarkupSelected, handleMarkupModified, handleContextMenu,
  searchKeyword, pdfData
}: any) => {
  return (
    <Box sx={{ position: 'relative', mb: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', display: 'inline-block', overflow: 'hidden' }}>
      <Page 
        pageNumber={pageIndex + 1} 
        scale={scale} 
        renderTextLayer={true} 
        renderAnnotationLayer={true}
        loading=""
      />
      <SearchHighlightLayer pageIndex={pageIndex} keyword={searchKeyword} scale={scale} pdfData={pdfData} />
      <Box sx={{ 
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, 
        pointerEvents: tool === 'pan' ? 'none' : 'auto' 
      }}>
        <MarkupLayer
          pageNumber={pageIndex} 
          width={pdfWidth * scale} 
          height={pdfHeight * scale} 
          scale={scale}
          markups={markups}
          tool={tool} activeColor={activeColor} activeStrokeWidth={activeStrokeWidth} activeLineStyle={activeLineStyle}
          docScale={docScale} hiddenLayers={hiddenLayers} selectedMarkupIds={selectedMarkupIds}
          onMarkupAdded={handleMarkupAdded} onMarkupSelected={handleMarkupSelected} onMarkupModified={handleMarkupModified} onContextMenu={handleContextMenu}
        />
      </Box>
    </Box>
  );
});

const DocumentViewPage = memo(() => {
  const { projectId: urlProjectId, documentId = '' } = useParams<{ projectId?: string; documentId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;
  const isSM = useMediaQuery("(max-width:1050px)");

  // ─── 1. State ───
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [tool, setTool] = useState<DrawTool>('select');
  const [activeColor, setActiveColor] = useState('#d32f2f');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(2);
  const [activeLineStyle, setActiveLineStyle] = useState<LineStyle>('solid');
  const [docScale, setDocScale] = useState<string>('1:1');
  const [sidebarTab, setSidebarTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedMarkupIds, setSelectedMarkupIds] = useState<string[]>([]);
  const [markupClipboard, setMarkupClipboard] = useState<any[]>([]);
  
  // Viewer State
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageLabels, setPageLabels] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number>(0.3); 
  const [displayScale, setDisplayScale] = useState<number>(0.3); 
  const [scrollMode, setScrollMode] = useState<'page' | 'continuous'>('continuous');
  const [pageDimensions, setPageDimensions] = useState<{ width: number, height: number }>({ width: 800, height: 1131 });

  const zoomDebounceRef = useRef<any>(null);

  const updateActualZoom = useCallback((newZoom: number) => {
    if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
    zoomDebounceRef.current = setTimeout(() => { setZoom(newZoom); }, 250);
  }, []);

  const handleZoom = useCallback((delta: number) => {
    setDisplayScale(prev => {
      const next = Math.max(0.1, Math.min(10, prev + delta));
      updateActualZoom(next);
      return next;
    });
  }, [updateActualZoom]);

  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; markupId: string } | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<{ pageIndex: number; text: string; before: string; after: string; matchIndex: number; x: number; y: number }[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [activeSearchKeyword, setActiveSearchKeyword] = useState('');
  const [searchScope, setSearchScope] = useState<'document' | 'page'>('document');
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState<number | null>(null);
  const [canvasMentionData, setCanvasMentionData] = useState<{ anchor: HTMLElement; query: string; onSelect: (name: string) => void } | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ─── 2. Data Hooks ───
  const projectId = urlProjectId || doc?.folder?.projectId;
  const { data: markups = [], refetch: refetchMarkups } = useMarkups(documentId);
  const { mutateAsync: createMarkup } = useCreateMarkup();
  const { mutateAsync: updateMarkupAPI } = useUpdateMarkup();
  const { mutateAsync: deleteMarkupAPI } = useDeleteMarkup();
  const { push: pushHistory, undo, redo, canUndo, canRedo } = useUndoRedo();
  const { data: projectUsers = [] } = useProjectUsers(projectId);
  const { token, isLoading: authLoading } = useAuth();

  // ─── 4. Memos ───
  const selectedMarkups = useMemo(
    () => (markups || []).filter((m: any) => selectedMarkupIds.includes(m.id)),
    [markups, selectedMarkupIds]
  );

  const propertiesOpen = (selectedMarkupIds || []).length > 0;

  // ─── 5. Handlers ───
  const handleContextMenu = useCallback((e: MouseEvent, markupId: string) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, markupId });
  }, []);

  const handleMarkupSelected = useCallback((ids: string[]) => {
    setSelectedMarkupIds(ids);
  }, []);

  const handleMarkupModified = useCallback(async (modifiedMarkup: any) => {
    const original = (markups || []).find((m: Markup) => m.id === modifiedMarkup.id);
    if (!original) return;
    await updateMarkupAPI({ id: modifiedMarkup.id, coordinates: modifiedMarkup.coordinates });
    pushHistory({ type: 'update', markupId: modifiedMarkup.id, before: original, after: { ...original, coordinates: modifiedMarkup.coordinates } });
    refetchMarkups();
  }, [markups, updateMarkupAPI, pushHistory, refetchMarkups]);

  const handleJumpToPage = useCallback((pageIndex: number) => {
    if (pageIndex < 1 || pageIndex > numPages) return;
    setCurrentPage(pageIndex);
    if (scrollMode === 'continuous') {
      const container = scrollContainerRef.current;
      if (container) {
        const pages = container.querySelectorAll('.react-pdf__Page');
        if (pages[pageIndex - 1]) {
          pages[pageIndex - 1].scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }, [scrollMode, numPages]);

  const handleJumpToMarkup = useCallback((ids: string[]) => {
    const markupId = ids[0]; if (!markupId) return;
    const m = (markups || []).find((m: any) => m.id === markupId);
    if (!m) return;
    handleJumpToPage(m.pageNumber + 1);
    setTimeout(() => {
      const container = scrollContainerRef.current; if (!container) return;
      const coords = m.coordinates, w = pageDimensions.width * displayScale, h = pageDimensions.height * displayScale;
      let targetX = 0, targetY = 0;
      if (coords.left !== undefined) { targetX = coords.left * w; targetY = coords.top * h; }
      else if (coords.x1 !== undefined) { targetX = Math.min(coords.x1, coords.x2) * w; targetY = Math.min(coords.y1, coords.y2) * h; }
      if (scrollMode === 'continuous') targetY += m.pageNumber * (pageDimensions.height * displayScale + 16);
      if (displayScale < 0.6) handleZoom(0.6 - displayScale);
      container.scrollTo({ left: targetX - container.clientWidth / 2, top: targetY - container.clientHeight / 2, behavior: 'smooth' });
      setSelectedMarkupIds([markupId]);
    }, 100);
  }, [markups, handleJumpToPage, pageDimensions, displayScale, scrollMode, handleZoom]);

  const handleJumpToSearchMatch = useCallback((idx: number) => {
    const match = searchResults[idx]; if (!match) return;
    setActiveSearchResultIndex(idx);
    handleJumpToPage(match.pageIndex + 1);
    setTimeout(() => {
      const container = scrollContainerRef.current; if (!container) return;
      let targetX = match.x * displayScale, targetY = match.y * displayScale;
      if (scrollMode === 'continuous') targetY += match.pageIndex * (pageDimensions.height * displayScale + 16);
      if (displayScale < 0.6) handleZoom(0.6 - displayScale);
      container.scrollTo({ left: targetX - container.clientWidth / 2, top: targetY - container.clientHeight / 2, behavior: 'smooth' });
    }, 100);
  }, [searchResults, handleJumpToPage, displayScale, scrollMode, pageDimensions, handleZoom]);

  const handleSearch = useCallback(async (keyword: string) => {
    setActiveSearchKeyword(keyword); setActiveSearchResultIndex(null);
    if (!keyword || keyword.length < 2 || !pdfData) { setSearchResults([]); setIsSearching(false); setSearchProgress(0); return; }
    setIsSearching(true); setSearchProgress(0); setSearchResults([]);
    try {
      const pdf = await pdfjs.getDocument(pdfData).promise;
      const results: any[] = [], totalPages = pdf.numPages;
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), regex = new RegExp(escaped, 'gi');
      const start = searchScope === 'page' ? currentPage : 1, end = searchScope === 'page' ? currentPage : totalPages;
      for (let i = start; i <= end; i++) {
        const page = await pdf.getPage(i), textContent = await page.getTextContent(), viewport = page.getViewport({ scale: 1 });
        textContent.items.forEach((item: any) => {
          let match;
          while ((match = regex.exec(item.str)) !== null) {
            const tx = pdfjs.Util.transform(viewport.transform, item.transform);
            const itemH = item.height || Math.abs(item.transform[0]) || 12;
            results.push({ pageIndex: i - 1, matchIndex: results.length, text: item.str, before: item.str.substring(0, match.index), after: item.str.substring(match.index + keyword.length), x: tx[4], y: tx[5] - itemH });
          }
        });
        setSearchProgress(searchScope === 'document' ? Math.round((i / totalPages) * 100) : 100);
        if (results.length > 500) break;
      }
      setSearchResults(results);
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  }, [pdfData, searchScope, currentPage]);

  const handleResetSearch = useCallback(() => { setActiveSearchKeyword(''); setSearchResults([]); setActiveSearchResultIndex(null); setSearchProgress(0); setIsSearching(false); }, []);

  const handleJumpToBookmark = useCallback(async (dest: any) => {
    if (!pdfData) return;
    try {
      const pdf = await pdfjs.getDocument(pdfData).promise;
      let pageNumber = -1;
      if (Array.isArray(dest)) { const pageIndex = await pdf.getPageIndex(dest[0]); pageNumber = pageIndex + 1; }
      else if (typeof dest === 'string') { const resolved = await pdf.getDestination(dest); if (resolved) { const pageIndex = await pdf.getPageIndex(resolved[0]); pageNumber = pageIndex + 1; } }
      if (pageNumber > 0) handleJumpToPage(pageNumber);
    } catch (e) { console.error('Failed to jump to bookmark:', e); }
  }, [pdfData, handleJumpToPage]);

  const handleUpdateProperties = useCallback(async (markupId: string, data: any) => {
    const original = (markups || []).find((m: Markup) => m.id === markupId);
    await updateMarkupAPI({ id: markupId, ...data });
    if (original) pushHistory({ type: 'update', markupId, before: original, after: { ...original, ...data } });
  }, [markups, updateMarkupAPI, pushHistory]);

  const handleDeleteMarkup = useCallback(async (markupIds: string | string[]) => {
    const ids = Array.isArray(markupIds) ? markupIds : [markupIds];
    for (const id of ids) {
      const original = (markups || []).find((m: Markup) => m.id === id);
      await deleteMarkupAPI(id); if (original) pushHistory({ type: 'delete', markupId: id, before: original });
    }
    setSelectedMarkupIds(prev => prev.filter(id => !ids.includes(id)));
    setTimeout(() => refetchMarkups(), 100);
  }, [deleteMarkupAPI, pushHistory, refetchMarkups]);

  const handleMarkupAdded = useCallback(async (newMarkup: any) => {
    const userIds = projectUsers && projectUsers.length > 0 ? projectUsers.map(u => u.id) : [];
    const res = await createMarkup({ ...newMarkup, documentId, pageNumber: newMarkup.pageNumber ?? 0, allowedEditUserIds: userIds, allowedDeleteUserIds: userIds });
    if (res?.id) pushHistory({ type: 'create', markupId: res.id, after: res });
    refetchMarkups();
  }, [documentId, refetchMarkups, createMarkup, pushHistory, projectUsers]);

  const handleDuplicateMarkups = useCallback(async () => {
    const toDup = selectedMarkups.length > 0 ? [...selectedMarkups] : [];
    if (toDup.length === 0 && contextMenu?.markupId) { const m = (markups || []).find((m: any) => m.id === contextMenu.markupId); if (m) toDup.push(m); }
    if (toDup.length === 0) return;
    for (const m of toDup) {
      const { id, author, createdAt, authorId, pageNumber, ...rest } = m;
      const coords = { ...rest.coordinates };
      if (coords.left !== undefined) { coords.left += 0.02; coords.top += 0.02; }
      else if (coords.x1 !== undefined) { coords.x1 += 0.02; coords.y1 += 0.02; coords.x2 += 0.02; coords.y2 += 0.02; }
      const newProps = JSON.parse(JSON.stringify(rest.properties || {}));
      const res = await createMarkup({ ...rest, coordinates: coords, properties: newProps, documentId, pageNumber: currentPage - 1, allowedEditUserIds: m.allowedEditUserIds || projectUsers.map(u => u.id), allowedDeleteUserIds: m.allowedDeleteUserIds || projectUsers.map(u => u.id) });
      if (res?.id) pushHistory({ type: 'create', markupId: res.id, after: res });
    }
    refetchMarkups();
  }, [selectedMarkups, contextMenu, markups, createMarkup, pushHistory, refetchMarkups, currentPage, documentId, projectUsers]);

  const handleMarkupAction = useCallback((action: string, markupId: string) => {
    if (action === 'duplicate') { handleDuplicateMarkups(); return; }
    const m = (markups || []).find((m: any) => m.id === markupId); if (!m) return;
    if (action === 'lock' || action === 'unlock') { handleUpdateProperties(markupId, { properties: { ...m.properties, locked: action === 'lock' } }); return; }
    const sorted = [...(markups || [])].sort((a, b) => (a.properties?.zIndex || 0) - (b.properties?.zIndex || 0));
    const minZ = sorted[0]?.properties?.zIndex || 0, maxZ = sorted[sorted.length - 1]?.properties?.zIndex || 0;
    let newZ = m.properties?.zIndex || 0;
    if (action === 'front') newZ = maxZ + 1; else if (action === 'back') newZ = minZ - 1; else if (action === 'forward') newZ += 1; else if (action === 'backward') newZ -= 1;
    handleUpdateProperties(markupId, { properties: { ...m.properties, zIndex: newZ } });
  }, [markups, handleDuplicateMarkups, handleUpdateProperties]);

  const handleUndo = useCallback(async () => {
    const action = undo(); if (!action) return;
    try {
      if (action.type === 'create') await deleteMarkupAPI(action.markupId);
      else if (action.type === 'update' && action.before) await updateMarkupAPI({ id: action.markupId, ...action.before });
      else if (action.type === 'delete' && action.before) await createMarkup(action.before);
      refetchMarkups();
    } catch (e) { console.error(e); }
  }, [undo, deleteMarkupAPI, updateMarkupAPI, createMarkup, refetchMarkups]);

  const handleRedo = useCallback(async () => {
    const action = redo(); if (!action) return;
    try {
      if (action.type === 'create' && action.after) await createMarkup(action.after);
      else if (action.type === 'update' && action.after) await updateMarkupAPI({ id: action.markupId, ...action.after });
      else if (action.type === 'delete') await deleteMarkupAPI(action.markupId);
      refetchMarkups();
    } catch (e) { console.error(e); }
  }, [redo, deleteMarkupAPI, updateMarkupAPI, createMarkup, refetchMarkups]);

  const handlePasteMarkups = useCallback(async () => {
    if (markupClipboard.length === 0) return;
    const newIds: string[] = [];
    for (const m of markupClipboard) {
      const { id, author, createdAt, authorId, pageNumber, ...rest } = m;
      const res = await createMarkup({ ...rest, documentId, pageNumber: currentPage - 1 });
      if (res?.id) { newIds.push(res.id); pushHistory({ type: 'create', markupId: res.id, after: res }); }
    }
    if (newIds.length > 0) { setSelectedMarkupIds(newIds); refetchMarkups(); }
  }, [markupClipboard, currentPage, documentId, createMarkup, pushHistory, refetchMarkups]);

  const handleDocScaleChange = useCallback(async (newScale: string) => {
    setDocScale(newScale);
    try { await apiFetch(`/api/documents/${documentId}/scale`, { method: 'PATCH', body: JSON.stringify({ scale: newScale }) }); }
    catch (err) { console.error(err); }
  }, [documentId]);

  // ─── 6. Effects ───
  useEffect(() => {
    if (!documentId) return;
    apiFetch(`/api/documents/${documentId}/info`).then(res => { setDoc(res.data); if (res.data?.scale) setDocScale(res.data.scale); }).catch(err => console.error(err)).finally(() => setLoading(false));
  }, [documentId]);

  useEffect(() => {
    if (!documentId || authLoading || !token) return;
    let url: string | null = null, cancelled = false;
    fetch(`/api/documents/${documentId}/proxy`, { headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include' })
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(buf => { if (cancelled) return; const blob = new Blob([buf], { type: 'application/pdf' }); url = URL.createObjectURL(blob); setPdfData(url); })
      .catch(err => console.error(err));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [documentId, token, authLoading]);

  useEffect(() => {
    const container = scrollContainerRef.current; if (!container) return;
    const handleWheel = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleZoom(e.deltaY > 0 ? -0.1 : 0.1); } };
    let isPanning = false, startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;
    const handleMouseDown = (e: MouseEvent) => { if (e.button === 1 || tool === 'pan') { e.preventDefault(); isPanning = true; startX = e.pageX; startY = e.pageY; scrollLeft = container.scrollLeft; scrollTop = container.scrollTop; container.style.cursor = 'grabbing'; } };
    const handleMouseMove = (e: MouseEvent) => { if (!isPanning) return; const x = e.pageX - startX, y = e.pageY - startY; container.scrollLeft = scrollLeft - x; container.scrollTop = scrollTop - y; };
    const handleMouseUp = () => { if (isPanning) { isPanning = false; container.style.cursor = tool === 'pan' ? 'grab' : 'auto'; } };
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { container.removeEventListener('wheel', handleWheel); container.removeEventListener('mousedown', handleMouseDown); window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [tool, handleZoom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
      const toolShortcuts: Record<string, DrawTool> = { v: 'select', ' ': 'pan', p: 'pen', h: 'highlighter', l: 'line', a: 'arrow', r: 'rect', c: 'cloud', t: 'text', o: 'callout', m: 'measure' };
      if (!ctrl && toolShortcuts[key]) { e.preventDefault(); setTool(toolShortcuts[key]); return; }
      if (key === 'delete' || key === 'backspace') { if (selectedMarkupIds.length > 0) { e.preventDefault(); handleDeleteMarkup(selectedMarkupIds); } return; }
      if (ctrl && key === 'c') { if (selectedMarkups.length > 0) { e.preventDefault(); setMarkupClipboard([...selectedMarkups]); } return; }
      if (ctrl && key === 'v') { e.preventDefault(); handlePasteMarkups(); return; }
      if (ctrl && key === 'd') { e.preventDefault(); handleDuplicateMarkups(); return; }
      if (ctrl && key === 'z') { e.preventDefault(); handleUndo(); return; }
      if (ctrl && key === 'y') { e.preventDefault(); handleRedo(); return; }
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMarkupIds, selectedMarkups, handleDeleteMarkup, handleDuplicateMarkups, handleUndo, handleRedo, handlePasteMarkups]);

  const onDocumentLoadSuccess = async (pdf: any) => {
    setNumPages(pdf.numPages);
    try {
      const page = await pdf.getPage(1), viewport = page.getViewport({ scale: 1 });
      setPageDimensions({ width: viewport.width, height: viewport.height });
      const labels = await pdf.getPageLabels(); setPageLabels(labels || []);
      const outline = await pdf.getOutline(); setBookmarks(outline || []);
    } catch (e) { console.error(e); }
  };

  const handleToggleLayer = useCallback((t: string) => { setHiddenLayers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]); }, []);

  // ─── 7. Render ───
  const viewerBg = isDark ? '#121212' : '#8d8d8d';
  if ((authLoading || loading) && !doc) return <Box display="flex" justifyContent="center" alignItems="center" height="100%"><CircularProgress /></Box>;
  if (!doc) return <Box p={3}>Document not found</Box>;

  const propertyBlockSx = { display: "flex", alignItems: "center", justifyContent: "center", px: "4px", py: "4px", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s", color: "text.secondary", height: 32, "&:hover": { bgcolor: alpha(gold, 0.08), color: gold } };
  const selectSx = { height: 28, fontSize: "0.75rem", bgcolor: "transparent", color: "inherit", ".MuiOutlinedInput-notchedOutline": { border: "none" }, ".MuiSelect-select": { p: "0 !important", display: "flex", alignItems: "center", justifyContent: "center" } };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary', overflow: 'hidden' }}>
      <PdfToolbar 
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        tool={tool} onToolChange={setTool} activeColor={activeColor} onColorChange={setActiveColor} activeStrokeWidth={activeStrokeWidth} onStrokeWidthChange={setActiveStrokeWidth} activeLineStyle={activeLineStyle} onLineStyleChange={setActiveLineStyle} docScale={docScale} onDocScaleChange={handleDocScaleChange} zoom={displayScale} onZoomIn={() => handleZoom(0.1)} onZoomOut={() => handleZoom(-0.1)} currentPage={currentPage} numPages={numPages} onPageChange={handleJumpToPage} scrollMode={scrollMode} onScrollModeChange={setScrollMode} canUndo={canUndo} canRedo={canRedo} onUndo={handleUndo} onRedo={handleRedo} versions={doc?.versions} currentDocId={documentId} onVersionChange={(v) => (window.location.href = `/projects/${projectId}/documents/${v}`)} />
      
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <PdfSidebar open={sidebarOpen} tab={sidebarTab} onTabChange={setSidebarTab} markups={markups} selectedMarkupIds={selectedMarkupIds} onMarkupSelect={handleJumpToMarkup} onDeleteMarkup={handleDeleteMarkup} hiddenLayers={hiddenLayers} onToggleLayer={handleToggleLayer} searchResults={searchResults} isSearching={isSearching} searchProgress={searchProgress} onSearch={handleSearch} jumpToPage={handleJumpToPage} searchKeyword={activeSearchKeyword} onSearchKeywordChange={setActiveSearchKeyword} bookmarks={bookmarks} numPages={numPages} onJumpToBookmark={handleJumpToBookmark} pdfData={pdfData || undefined} currentPage={currentPage} pageLabels={pageLabels} searchScope={searchScope} onSearchScopeChange={setSearchScope} onResetSearch={handleResetSearch} activeSearchResultIndex={activeSearchResultIndex} onSearchResultSelect={handleJumpToSearchMatch} />
        
        <Box ref={scrollContainerRef} sx={{ flexGrow: 1, height: '100%', position: 'relative', overflow: 'auto', bgcolor: viewerBg, display: 'block', p: 4, cursor: tool === 'pan' ? 'grab' : 'auto', scrollBehavior: 'auto', '&::-webkit-scrollbar': { width: '10px', height: '10px' }, '&::-webkit-scrollbar-track': { background: 'rgba(0,0,0,0.05)' }, '&::-webkit-scrollbar-thumb': { background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: '10px', border: '2px solid transparent', backgroundClip: 'padding-box', '&:hover': { background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' } } }}>
          {pdfData && (
            <Box sx={{ display: 'flex', justifyContent: 'center', minWidth: '100%', minHeight: 'min-content' }}>
              <Document file={pdfData} onLoadSuccess={onDocumentLoadSuccess} loading={<CircularProgress />}>
                <Box sx={{ 
                  transform: `scale(${displayScale / zoom})`, 
                  transformOrigin: 'top left', 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  willChange: 'transform',
                  imageRendering: displayScale !== zoom ? 'pixelated' : 'auto',
                  width: pageDimensions.width * zoom, 
                  height: (scrollMode === 'continuous' ? pageDimensions.height * numPages : pageDimensions.height) * zoom,
                  my: 2
                }}>
                  {scrollMode === 'continuous' ? Array.from(new Array(numPages), (_, idx) => <PageContainer key={idx} pageIndex={idx} pdfWidth={pageDimensions.width} pdfHeight={pageDimensions.height} scale={zoom} markups={markups.filter((m: any) => m.pageNumber === idx)} tool={tool} activeColor={activeColor} activeStrokeWidth={activeStrokeWidth} activeLineStyle={activeLineStyle} docScale={docScale} hiddenLayers={hiddenLayers} selectedMarkupIds={selectedMarkupIds} handleMarkupAdded={handleMarkupAdded} handleMarkupSelected={handleMarkupSelected} handleMarkupModified={handleMarkupModified} handleContextMenu={handleContextMenu} searchKeyword={activeSearchKeyword} pdfData={pdfData} />) : <PageContainer pageIndex={currentPage - 1} pdfWidth={pageDimensions.width} pdfHeight={pageDimensions.height} scale={zoom} markups={markups.filter((m: any) => m.pageNumber === (currentPage - 1))} tool={tool} activeColor={activeColor} activeStrokeWidth={activeStrokeWidth} activeLineStyle={activeLineStyle} docScale={docScale} hiddenLayers={hiddenLayers} selectedMarkupIds={selectedMarkupIds} handleMarkupAdded={handleMarkupAdded} handleMarkupSelected={handleMarkupSelected} handleMarkupModified={handleMarkupModified} handleContextMenu={handleContextMenu} searchKeyword={activeSearchKeyword} pdfData={pdfData} />}
                </Box>
              </Document>
            </Box>
          )}
        </Box>

        <MarkupPropertiesPanel open={propertiesOpen} onClose={() => setSelectedMarkupIds([])} selectedMarkups={selectedMarkups} onUpdateProperties={handleUpdateProperties} onDeleteMarkup={handleDeleteMarkup} documentId={documentId} projectId={projectId} onAction={handleMarkupAction} markups={markups} />
        
        {/* RESPONSIVE BOTTOM BAR (Mobile/Tablet) */}
        {isSM && (
          <Box sx={{ 
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.5,
            bgcolor: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(8px)',
            borderRadius: '12px', border: 1, borderColor: 'divider',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 1100
          }}>
            {/* Page Nav */}
            <Box display="flex" alignItems="center">
              <IconButton size="small" onClick={() => handleJumpToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}><KeyboardArrowLeftIcon fontSize="small" /></IconButton>
              <Box display="flex" alignItems="center" gap={0.5} px={0.5}>
                <InputBase 
                  value={currentPage} 
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) handleJumpToPage(val);
                  }}
                  sx={{ width: 30, fontSize: "0.75rem", fontWeight: 700, textAlign: "center", bgcolor: alpha(gold, 0.1), borderRadius: "4px", "& input": { textAlign: "center", p: 0 } }} 
                />
                <Typography variant="caption" sx={{ fontSize: "0.7rem", opacity: 0.6 }}>/</Typography>
                <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{numPages}</Typography>
              </Box>
              <IconButton size="small" onClick={() => handleJumpToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages}><KeyboardArrowRightIcon fontSize="small" /></IconButton>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ height: 20, my: 'auto', mx: 0.5 }} />

            {/* Scale */}
            <Box sx={propertyBlockSx}>
              <Select size="small" value={docScale} onChange={(e) => handleDocScaleChange(e.target.value as string)} IconComponent={() => null} sx={{ ...selectSx, minWidth: 40, fontWeight: 700 }}>
                {STANDARD_SCALES.map((group, idx) => group.items ? [<ListSubheader key={`h-${idx}`} sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", color: gold }}>{group.group}</ListSubheader>, ...group.items.map((item) => <MenuItem key={item.value} value={item.value} sx={{ fontSize: "0.75rem" }}>{item.label}</MenuItem>)] : <MenuItem key={group.value} value={group.value} sx={{ fontSize: "0.75rem", fontWeight: 700 }}>{group.label}</MenuItem>)}
              </Select>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ height: 20, my: 'auto', mx: 0.5 }} />

            {/* Zoom */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton size="small" onClick={() => handleZoom(-0.1)} sx={{ p: 0.5 }}><Typography sx={{ fontSize: '1.2rem', lineHeight: 1, fontWeight: 300 }}>-</Typography></IconButton>
              <Typography variant="caption" sx={{ minWidth: 35, textAlign: 'center', fontWeight: 700, fontSize: '0.7rem' }}>{Math.round(displayScale * 100)}%</Typography>
              <IconButton size="small" onClick={() => handleZoom(0.1)} sx={{ p: 0.5 }}><Typography sx={{ fontSize: '1.2rem', lineHeight: 1, fontWeight: 300 }}>+</Typography></IconButton>
            </Box>

            {doc?.versions?.length > 0 && (
              <>
                <Divider orientation="vertical" flexItem sx={{ height: 20, my: 'auto', mx: 0.5 }} />
                <Box sx={propertyBlockSx}>
                  <HistoryIcon sx={{ fontSize: 16, mr: 0.5, color: gold }} />
                  <Select size="small" value={documentId} onChange={(e) => (window.location.href = `/projects/${projectId}/documents/${e.target.value}`)} IconComponent={() => null} sx={{ ...selectSx, minWidth: 40, fontWeight: 700 }}>
                    {doc.versions.map((v: any, idx: number) => <MenuItem key={v.id} value={v.id} sx={{ fontSize: "0.72rem" }}>V{doc.versions.length - idx}</MenuItem>)}
                  </Select>
                </Box>
              </>
            )}
          </Box>
        )}

        <Menu open={contextMenu !== null} onClose={() => setContextMenu(null)} anchorReference="anchorPosition" anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined} slotProps={{ paper: { sx: { minWidth: 160, bgcolor: 'background.paper', border: 1, borderColor: 'divider', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', '& .MuiMenuItem-root': { fontSize: '0.78rem', gap: 1, borderRadius: '4px', mx: 0.5, my: 0.25 }, '& .MuiMenuItem-root:hover': { bgcolor: alpha(gold, 0.08) } }}}}>
          <MenuItem onClick={() => { handleMarkupAction('duplicate', contextMenu!.markupId); setContextMenu(null); }}><ListItemIcon><ContentCopyIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('duplicate', 'Duplicate')} /><Typography variant="caption" color="text.secondary">Ctrl+D</Typography></MenuItem>
          <Divider sx={{ my: '4px !important' }} />
          <MenuItem onClick={() => { handleMarkupAction('front', contextMenu!.markupId); setContextMenu(null); }}><ListItemIcon><FlipToFrontIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('bringToFront', 'Bring to Front')} /></MenuItem>
          <MenuItem onClick={() => { handleMarkupAction('back', contextMenu!.markupId); setContextMenu(null); }}><ListItemIcon><FlipToBackIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('sendToBack', 'Send to Back')} /></MenuItem>
          <Divider sx={{ my: '4px !important' }} />
          {markups.find((m: any) => m.id === contextMenu?.markupId)?.properties?.locked ? <MenuItem onClick={() => { handleMarkupAction('unlock', contextMenu!.markupId); setContextMenu(null); }}><ListItemIcon><LockOpenIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('unlock', 'Unlock')} /></MenuItem> : <MenuItem onClick={() => { handleMarkupAction('lock', contextMenu!.markupId); setContextMenu(null); }}><ListItemIcon><LockIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('lock', 'Lock')} /></MenuItem>}
          <Divider sx={{ my: '4px !important' }} />
          <MenuItem onClick={() => { handleDeleteMarkup(contextMenu!.markupId); setContextMenu(null); }} sx={{ color: 'error.main' }}><ListItemIcon><DeleteIcon sx={{ fontSize: 16, color: 'error.main' }} /></ListItemIcon><ListItemText primary={t('delete', 'Delete')} /><Typography variant="caption" color="error">Del</Typography></MenuItem>
        </Menu>
        
        <Popover open={Boolean(canvasMentionData)} anchorEl={canvasMentionData?.anchor} onClose={() => setCanvasMentionData(null)} anchorOrigin={{ vertical: 'center', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} disableAutoFocus disableEnforceFocus slotProps={{ paper: { sx: { width: 200, maxHeight: 250, overflowY: 'auto', zIndex: 3000 } } }}>
          <List dense>{projectUsers.filter((u: any) => !canvasMentionData?.query || (u.name || u.email).toLowerCase().includes(canvasMentionData.query.toLowerCase())).map((user: any) => <ListItemButton key={user.id} onClick={() => canvasMentionData?.onSelect(user.name || user.email)}><ListItemIcon sx={{ minWidth: 32 }}><Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem' }}>{(user.name || user.email)[0].toUpperCase()}</Avatar></ListItemIcon><ListItemText primary={user.name || user.email} primaryTypographyProps={{ fontSize: '0.75rem', noWrap: true }} /></ListItemButton>)}</List>
        </Popover>
      </Box>
    </Box>
  );
});

export default DocumentViewPage;
