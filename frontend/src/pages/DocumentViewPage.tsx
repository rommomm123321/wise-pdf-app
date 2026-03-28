import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box, CircularProgress, useTheme, alpha,
  Menu, MenuItem, ListItemIcon, ListItemText, Typography,
  Popover, List, ListItemButton, Avatar, useMediaQuery,
  IconButton, InputBase, Select, ListSubheader
} from '@mui/material';
import Divider from '@mui/material/Divider';
import dayjs from 'dayjs';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import ArticleIcon from "@mui/icons-material/Article";
import ViewDayIcon from "@mui/icons-material/ViewDay";
import { useTranslation } from 'react-i18next';

// react-pdf
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { apiFetch } from '../lib/api';
import { useMarkups, useUpdateMarkup, useDeleteMarkup, useCreateMarkup, type Markup } from '../hooks/useMarkups';
import { useMyProjectPermissions } from '../hooks/usePermissions';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useProjectUsers } from '../hooks/useProjectUsers';
import { useAuth } from '../contexts/AuthContext';

// Components
import NotFoundPage from './NotFoundPage';
import PdfToolbar, { type DrawTool, type LineStyle, STANDARD_SCALES } from '../components/pdf/PdfToolbar';
import PdfSidebar from '../components/pdf/PdfSidebar';
import MarkupPropertiesPanel from '../components/pdf/MarkupPropertiesPanel';
import MarkupLayer from '../components/pdf/MarkupLayer';
import { exportPdfWithMarkups } from '../utils/exportPdfWithMarkups';
import { detectAndParseAnnotations, type ImportedMarkup } from '../utils/importAnnotationsFromPdf';
import toast from 'react-hot-toast';

// Worker from CDN matching the exact pdfjs version bundled inside react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Stable options object — created once, not on every render
const PDF_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  enableXfa: false,
  disableRange: false,
  disableStream: false,
  disableAutoFetch: false,
} as const;

const SearchHighlightLayer = memo(({ pageIndex, keyword, scale, pdfDoc }: { pageIndex: number, keyword: string, scale: number, pdfDoc: any }) => {
  const [matches, setMatches] = useState<{ x: number, y: number, w: number, h: number }[]>([]);

  useEffect(() => {
    if (!keyword || keyword.length < 2 || !pdfDoc) { setMatches([]); return; }

    const findText = async () => {
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });
        const items = textContent.items as any[];

        // Same logic as handleSearch: build fullText with positional gap detection
        let fullText = '';
        const offsets: { start: number; item: any }[] = [];
        for (let j = 0; j < items.length; j++) {
          const item = items[j];
          if (typeof item.str !== 'string') continue;
          offsets.push({ start: fullText.length, item });
          fullText += item.str;
          if (item.hasEOL) { fullText += '\n'; }
          else if (j < items.length - 1 && !fullText.endsWith(' ')) {
            const next = items[j + 1];
            if (next && typeof next.transform?.[4] === 'number') {
              const curX = item.transform[4] + (item.width || 0);
              if (next.transform[4] - curX > 1) fullText += ' ';
            }
          }
        }

        const normalizedKeyword = keyword.replace(/\s+/g, ' ').trim();
        const flexEscaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
        const regex = new RegExp(flexEscaped, 'gi');

        const results: any[] = [];
        let match;
        while ((match = regex.exec(fullText)) !== null) {
          let bestItem = offsets[0]?.item;
          for (const o of offsets) {
            if (o.start <= match.index) bestItem = o.item;
            else break;
          }
          if (!bestItem) continue;
          const tx = pdfjs.Util.transform(viewport.transform, bestItem.transform);
          const itemH = bestItem.height || Math.abs(bestItem.transform[0]) || 12;
          results.push({ x: tx[4], y: tx[5] - itemH, w: bestItem.width || 50, h: itemH });
        }
        setMatches(results);
      } catch (e) { console.error(e); }
    };
    findText();
  }, [pageIndex, keyword, pdfDoc]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%', zIndex: 4 }}>
      {matches.map((m, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: m.x * scale,
          top: m.y * scale,
          width: m.w * scale,
          height: m.h * scale,
          backgroundColor: 'rgba(66, 133, 244, 0.35)',
          borderRadius: '2px',
          mixBlendMode: 'multiply'
        }} />
      ))}
    </div>
  );
});

// DPR capped by zoom level: at small zoom high DPR wastes rendering work
// (4x more pixels on Retina at 0.3 zoom that nobody can see)
const getPageDPR = (scale: number) => {
  if (scale < 0.5) return 1;
  if (scale < 1.0) return Math.min(window.devicePixelRatio, 1.5);
  return Math.min(window.devicePixelRatio, 2);
};

const PageContainer = memo(({
  pageIndex, pdfWidth, pdfHeight, scale, markups, tool, activeColor, activeStrokeWidth, activeLineStyle, docScale,
  hiddenLayers, selectedMarkupIds, handleMarkupAdded, handleMarkupSelected, handleMarkupModified, handleMarkupDeleted, handleContextMenu,
  searchKeyword, pdfDoc, currentUserId, isAdmin, canMarkup, onCanvasMention, renderDelay
}: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Stagger initial render: page 0 immediate, each subsequent page +30ms
  // Keeps PDF.js worker queue ordered by page proximity to viewport
  const [isClose, setIsClose] = useState(renderDelay === 0);
  const [isNear, setIsNear] = useState(renderDelay === 0);
  // Always keep last-good render as snapshot — shown immediately when scale changes
  const snapshotRef = useRef<string | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const prevScaleRef = useRef<number>(scale);

  // After each successful render: store canvas as snapshot for next re-render
  const handleRenderSuccess = useCallback(() => {
    const canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas && canvas.width > 0) {
      try { snapshotRef.current = canvas.toDataURL(); } catch { /* tainted canvas */ }
    }
    setShowSnapshot(false);
  }, []);

  // When scale changes: show stored snapshot instantly to cover the re-render gap
  useEffect(() => {
    if (scale === prevScaleRef.current) return;
    prevScaleRef.current = scale;
    if (snapshotRef.current) setShowSnapshot(true);
  }, [scale]);

  // Stagger render start: unlock rendering after delay so visible pages go first
  useEffect(() => {
    if (renderDelay === 0) return;
    const t = setTimeout(() => { setIsClose(true); setIsNear(true); }, renderDelay);
    return () => clearTimeout(t);
  }, [renderDelay]);

  const W = pdfWidth * scale, H = pdfHeight * scale;

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative', mb: 2,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        display: 'inline-block', overflow: 'visible',
        width: W, height: H,
        contain: 'layout style',
      }}
    >
      {isClose ? (
        <>
          <Page
            pageNumber={pageIndex + 1}
            scale={scale}
            devicePixelRatio={getPageDPR(scale)}
            renderTextLayer={tool === 'textSelect'}
            renderAnnotationLayer={false}
            loading={<Box sx={{ width: W, height: H, bgcolor: 'grey.100' }} />}
            onRenderSuccess={handleRenderSuccess}
          />
          <SearchHighlightLayer pageIndex={pageIndex} keyword={searchKeyword} scale={scale} pdfDoc={pdfDoc} />
          {/* Snapshot overlay: last-good render shown while PDF.js redraws at new scale */}
          {showSnapshot && snapshotRef.current && (
            <img
              src={snapshotRef.current}
              style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, zIndex: 4, objectFit: 'fill', display: 'block' }}
              alt=""
            />
          )}
        </>
      ) : (
        <Box sx={{ width: W, height: H, bgcolor: 'background.paper' }} />
      )}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10,
        pointerEvents: (tool === 'pan' || tool === 'textSelect') ? 'none' : 'auto'
      }}>
        {isNear && (markups.length > 0 || tool !== 'select') && (
          <MarkupLayer
            pageNumber={pageIndex}
            width={W}
            height={H}
            scale={scale}
            markups={markups}
            tool={tool} activeColor={activeColor} activeStrokeWidth={activeStrokeWidth} activeLineStyle={activeLineStyle}
            docScale={docScale} hiddenLayers={hiddenLayers} selectedMarkupIds={selectedMarkupIds}
            currentUserId={currentUserId} isAdmin={isAdmin} canMarkup={canMarkup}
            onMarkupAdded={handleMarkupAdded} onMarkupSelected={handleMarkupSelected} onMarkupModified={handleMarkupModified} onMarkupDeleted={handleMarkupDeleted} onContextMenu={handleContextMenu} onCanvasMention={onCanvasMention}
          />
        )}
      </Box>
    </Box>
  );
}, (prev: any, next: any) => {
  // Custom memo comparison: only re-render if this page's actual data changed
  return prev.markups === next.markups
    && prev.tool === next.tool
    && prev.scale === next.scale
    && prev.pdfWidth === next.pdfWidth
    && prev.pdfHeight === next.pdfHeight
    && prev.activeColor === next.activeColor
    && prev.activeStrokeWidth === next.activeStrokeWidth
    && prev.activeLineStyle === next.activeLineStyle
    && prev.docScale === next.docScale
    && prev.searchKeyword === next.searchKeyword
    && prev.pdfDoc === next.pdfDoc
    && prev.currentUserId === next.currentUserId
    && prev.isAdmin === next.isAdmin
    && prev.canMarkup === next.canMarkup
    && prev.hiddenLayers?.join(',') === next.hiddenLayers?.join(',')
    && prev.selectedMarkupIds?.join(',') === next.selectedMarkupIds?.join(',');
});

const DocumentViewPage = memo(() => {
  const { projectId: urlProjectId, documentId = '' } = useParams<{ projectId?: string; documentId: string }>();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;
  const isSM = useMediaQuery("(max-width:1050px)");

  // ─── 1. State ───
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // pdfFile passed directly to react-pdf — PDF.js uses range requests, no full download
  const [pdfFile, setPdfFile] = useState<{ url: string; httpHeaders: Record<string, string> } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [tool, setTool] = useState<DrawTool>('select');
  const [activeColor, setActiveColor] = useState('#d32f2f');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(2);
  const [activeLineStyle, setActiveLineStyle] = useState<LineStyle>('solid');
  const [docScale, setDocScale] = useState<string>(() => localStorage.getItem('pdfDocScale') || '1:1');
  const [sidebarTab, setSidebarTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedMarkupIds, setSelectedMarkupIds] = useState<string[]>([]);
  const [markupClipboard, setMarkupClipboard] = useState<any[]>([]);
  
  // Viewer State
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [splitRightPage, setSplitRightPage] = useState<number>(2);
  const [splitLeftZoom, setSplitLeftZoom] = useState<number>(0.3);
  const [splitRightZoom, setSplitRightZoom] = useState<number>(0.3);
  const splitLeftScrollRef = useRef<HTMLDivElement>(null);
  const splitRightScrollRef = useRef<HTMLDivElement>(null);
  const [pageLabels, setPageLabels] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number>(0.3); 
  const [displayScale, setDisplayScale] = useState<number>(0.3); 
  const [scrollMode, setScrollMode] = useState<'page' | 'continuous' | 'split'>(
    () => (localStorage.getItem('pdfScrollMode') as 'page' | 'continuous' | 'split') || 'continuous'
  );
  const [pageDimensions, setPageDimensions] = useState<{ width: number, height: number }>({ width: 800, height: 1131 });
  // Cached PDFDocumentProxy — loaded once per pdfData, shared by search and bookmark handlers
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const pdfDocCleanupRef = useRef<any>(null);

  // Bluebeam / PDF annotation import
  const [embeddedAnnots, setEmbeddedAnnots] = useState<ImportedMarkup[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const zoomDebounceRef = useRef<any>(null);
  // Ref to the transform box so we can update CSS directly without React re-render
  const transformBoxRef = useRef<HTMLDivElement>(null);
  // Tracks the live display scale as a ref (never stale in event handlers)
  const displayScaleRef = useRef<number>(0.3);
  // Tracks the committed zoom as a ref (never stale in event handlers)
  const zoomRef = useRef<number>(0.3);

  const updateActualZoom = useCallback((newZoom: number) => {
    if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
    zoomDebounceRef.current = setTimeout(() => { setZoom(newZoom); }, 300);
  }, []);

  // When zoom settles: sync refs + reset CSS transform.
  // Snapshot overlay in each PageContainer covers the re-render flash.
  useEffect(() => {
    zoomRef.current = zoom;
    displayScaleRef.current = zoom;
    setDisplayScale(zoom);
    if (transformBoxRef.current) {
      transformBoxRef.current.style.transform = 'scale(1)';
    }
  }, [zoom]);

  const handleZoom = useCallback((delta: number) => {
    setDisplayScale(prev => {
      const next = Math.max(0.1, Math.min(10, Math.round((prev + delta) * 100) / 100));
      displayScaleRef.current = next;
      // Apply CSS transform immediately — instant visual feedback, no re-render
      if (transformBoxRef.current) {
        transformBoxRef.current.style.transform = `scale(${next / zoomRef.current})`;
      }
      updateActualZoom(next);
      return next;
    });
  }, [updateActualZoom]);

  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; markupId: string } | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<{ pageIndex: number; text: string; before: string; after: string; matchIndex: number; x: number; y: number; w?: number; h?: number; markupId?: string }[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [activeSearchKeyword, setActiveSearchKeyword] = useState('');
  const [searchScope, setSearchScope] = useState<'document' | 'page'>('document');
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState<number | null>(null);
  const [canvasMentionData, setCanvasMentionData] = useState<{ anchor: HTMLElement; query: string; onSelect: (name: string) => void } | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollModeRef = useRef(scrollMode);
  const prevToolRef = useRef<DrawTool>('select');

  // ─── 2. Data Hooks ───
  const projectId = urlProjectId || doc?.folder?.projectId;
  const { data: markups = [], refetch: refetchMarkups } = useMarkups(documentId);
  const { mutateAsync: createMarkup } = useCreateMarkup();
  const { mutateAsync: updateMarkupAPI } = useUpdateMarkup();
  const { mutateAsync: deleteMarkupAPI } = useDeleteMarkup();
  const { push: pushHistory, undo, redo, canUndo, canRedo } = useUndoRedo();
  const { data: projectUsers = [] } = useProjectUsers(projectId);
  const { token, isLoading: authLoading, user } = useAuth();
  const isAdmin = user?.systemRole === 'GENERAL_ADMIN';
  const { data: myPerms } = useMyProjectPermissions(projectId);
  const canMarkup = isAdmin || myPerms?.canMarkup !== false;

  // ─── 4. Memos ───
  const selectedMarkups = useMemo(
    () => (markups || []).filter((m: any) => selectedMarkupIds.includes(m.id)),
    [markups, selectedMarkupIds]
  );

  // Stable per-page markup arrays — only update pages that actually changed
  const prevMarkupsByPageRef = useRef<Record<number, any[]>>({});
  const markupsByPage = useMemo(() => {
    const newMap: Record<number, any[]> = {};
    (markups || []).forEach((m: any) => {
      if (!newMap[m.pageNumber]) newMap[m.pageNumber] = [];
      newMap[m.pageNumber].push(m);
    });
    const result: Record<number, any[]> = {};
    const allPages = new Set([...Object.keys(newMap).map(Number), ...Object.keys(prevMarkupsByPageRef.current).map(Number)]);
    for (const page of allPages) {
      const newMks = newMap[page] || [];
      const oldMks = prevMarkupsByPageRef.current[page] || [];
      const mkHash = (a: any[]) => a.map(m => `${m.id}:${m.updatedAt || ''}`).join('|');
      if (newMks.length === oldMks.length && mkHash(newMks) === mkHash(oldMks)) {
        result[page] = oldMks; // stable reference — PageContainer won't re-render
      } else {
        result[page] = newMks;
      }
    }
    prevMarkupsByPageRef.current = result;
    return result;
  }, [markups]);

  const canEditMarkup = useMemo(() => {
    if (!selectedMarkups.length) return true;
    if (isAdmin) return true;
    return selectedMarkups.every((m: any) => {
      if (user?.id != null && m.authorId === user.id) return true; // owner always can edit
      const ids = m.allowedEditUserIds;
      // ['*']/null = unrestricted; [] = nobody; [ids] = specific users
      if (!ids || ids.includes('*')) return true;
      if (ids.length === 0) return false;
      return user?.id != null && ids.includes(user.id);
    });
  }, [selectedMarkups, isAdmin, user]);

  const [propertiesOpen, setPropertiesOpen] = useState(false);

  // ─── 5. Handlers ───
  const handleContextMenu = useCallback((e: MouseEvent, markupId: string) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, markupId });
  }, []);

  // Called only from canvas events (user-initiated clicks) — opens panel
  const handleMarkupSelected = useCallback((ids: string[]) => {
    setSelectedMarkupIds(ids);
    setPropertiesOpen(ids.length > 0);
  }, []);

  const handleMarkupModified = useCallback(async (modifiedMarkup: any) => {
    const original = (markups || []).find((m: Markup) => m.id === modifiedMarkup.id);
    if (!original) return;

    const updateData: any = { id: modifiedMarkup.id, coordinates: modifiedMarkup.coordinates };
    if (modifiedMarkup.properties) {
      updateData.properties = { ...original.properties, ...modifiedMarkup.properties };
    }

    if (modifiedMarkup.isMoving) {
      // During drag: DON'T write to Yjs — prevents lag from 60fps DB writes.
      // Final position is saved on object:modified (mouse up).
      return;
    }

    const updatedBy = { id: user?.id || '', name: user?.name || user?.email || 'Unknown' };
    const updatedAt = new Date().toISOString();
    Object.assign(updateData, { updatedBy, updatedAt });

    await updateMarkupAPI(updateData);
    pushHistory({ type: 'update', markupId: modifiedMarkup.id, before: original, after: { ...original, ...updateData } });
    refetchMarkups();
  }, [markups, updateMarkupAPI, pushHistory, refetchMarkups, user]);

  const handleJumpToPage = useCallback((pageIndex: number) => {
    if (pageIndex < 1 || pageIndex > numPages) return;
    setCurrentPage(pageIndex);
    if (scrollMode === 'continuous') {
      const container = scrollContainerRef.current;
      if (container) {
        // Calculate scroll offset manually (CSS transform doesn't affect layout dimensions)
        // Outer padding: p:4 = 32px, inner box margin-top: my:2 = 16px, each page: height + mb:2 = 16px
        const pageH = pageDimensions.height * zoom;
        const pageGap = 16; // mb: 2
        const containerPaddingTop = 32; // p: 4
        const innerMarginTop = 16; // my: 2
        const scrollTop = containerPaddingTop + innerMarginTop + (pageIndex - 1) * (pageH + pageGap);
        container.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }
    }
  }, [scrollMode, numPages, pageDimensions.height, zoom]);

  const handleJumpToMarkup = useCallback((ids: string[]) => {
    const markupId = ids[0]; if (!markupId) return;
    const m = (markups || []).find((m: any) => m.id === markupId);
    if (!m) return;
    setSelectedMarkupIds([markupId]);
    setPropertiesOpen(true);
    const targetZoom = Math.max(displayScale, 0.8); // At least 80% zoom
    if (displayScale < 0.8) handleZoom(0.8 - displayScale);
    const s = targetZoom;
    handleJumpToPage(m.pageNumber + 1);
    setTimeout(() => {
      const container = scrollContainerRef.current; if (!container) return;
      const coords = m.coordinates;
      const w = pageDimensions.width * s, h = pageDimensions.height * s;
      let markupX = 0, markupY = 0, markupW = 80, markupH = 40;
      if (coords.left !== undefined) {
        markupX = coords.left * w; markupY = coords.top * h;
        markupW = (coords.width || 0.1) * w; markupH = (coords.height || 0.05) * h;
      } else if (coords.x1 !== undefined) {
        markupX = Math.min(coords.x1, coords.x2) * w; markupY = Math.min(coords.y1, coords.y2) * h;
        markupW = Math.abs(coords.x2 - coords.x1) * w; markupH = Math.abs(coords.y2 - coords.y1) * h;
      }
      // Center: markupCenter - half container = scroll position
      const markupCenterX = markupX + markupW / 2;
      const markupCenterY = markupY + markupH / 2;
      let scrollTop = markupCenterY - container.clientHeight / 2;
      let scrollLeft = markupCenterX - container.clientWidth / 2;
      if (scrollMode === 'continuous') scrollTop += m.pageNumber * (pageDimensions.height * s + 16);
      container.scrollTo({ left: Math.max(0, scrollLeft), top: Math.max(0, scrollTop), behavior: 'smooth' });
    }, 50);
  }, [markups, handleJumpToPage, pageDimensions, displayScale, scrollMode, handleZoom]);

  const handleJumpToSearchMatch = useCallback((idx: number) => {
    const match = searchResults[idx] as any; if (!match) return;
    setActiveSearchResultIndex(idx);
    // If this is a markup result, jump to it via handleJumpToMarkup
    if (match.markupId) {
      handleJumpToMarkup([match.markupId]);
      return;
    }
    handleJumpToPage(match.pageIndex + 1);
    setTimeout(() => {
      const container = scrollContainerRef.current; if (!container) return;
      const targetScale = 1.5;
      if (Math.abs(displayScale - targetScale) > 0.05) handleZoom(targetScale - displayScale);
      let targetX = match.x * targetScale, targetY = match.y * targetScale;
      if (scrollMode === 'continuous') targetY += match.pageIndex * (pageDimensions.height * targetScale + 16);

      // Calculate precise center based on container dimensions
      const scrollLeft = Math.max(0, targetX - (container.clientWidth / 2));
      const scrollTop = Math.max(0, targetY - (container.clientHeight / 2));

      container.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'smooth' });
    }, 30);
  }, [searchResults, handleJumpToPage, handleJumpToMarkup, displayScale, scrollMode, pageDimensions, handleZoom]);

  const handleSearch = useCallback(async (keyword: string) => {
    setActiveSearchKeyword(keyword); setActiveSearchResultIndex(null);
    if (!keyword || keyword.length < 2 || !pdfDoc) { setSearchResults([]); setIsSearching(false); setSearchProgress(0); return; }
    setIsSearching(true); setSearchProgress(0); setSearchResults([]);
    try {
      const pdf = pdfDoc;
      const results: any[] = [], totalPages = pdf.numPages;
      // Normalize keyword: collapse whitespace so "A  B" matches "A B" in PDF
    const normalizedKeyword = keyword.replace(/\s+/g, ' ').trim();
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Allow any whitespace sequence in place of each space in the query
    const flexEscaped = escaped.replace(/ /g, '\\s+');
    const regex = new RegExp(flexEscaped, 'gi');
      const start = searchScope === 'page' ? currentPage : 1, end = searchScope === 'page' ? currentPage : totalPages;
      for (let i = start; i <= end; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 });

        // Search main text content stream.
        // Build a flat string from all items so matches spanning multiple items are found.
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];
        // Build fullText and offset map for coordinate lookup
        let fullText = '';
        const offsets: { start: number; item: any }[] = [];
        for (let j = 0; j < items.length; j++) {
          const item = items[j];
          if (typeof item.str !== 'string') continue;
          offsets.push({ start: fullText.length, item });
          fullText += item.str;
          // Add separator: EOL → newline, otherwise use item's own trailing space (don't add extra)
          if (item.hasEOL) { fullText += '\n'; }
          else if (j < items.length - 1 && !fullText.endsWith(' ')) {
            // Check positional gap: if next item is far away, add space
            const next = items[j + 1];
            if (next && typeof next.transform?.[4] === 'number') {
              const curX = item.transform[4] + (item.width || 0);
              const gap = next.transform[4] - curX;
              if (gap > 1) fullText += ' ';
            }
          }
        }
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(fullText)) !== null) {
          let bestItem = offsets[0]?.item;
          for (const o of offsets) {
            if (o.start <= match.index) bestItem = o.item;
            else break;
          }
          if (!bestItem) continue;
          const tx = pdfjs.Util.transform(viewport.transform, bestItem.transform);
          const itemH = bestItem.height || Math.abs(bestItem.transform[0]) || 12;
          const snippet = fullText.replace(/\s+/g, ' ');
          const snipIdx = match.index;
          results.push({ pageIndex: i - 1, matchIndex: results.length, text: match[0].replace(/\s+/g, ' '), before: snippet.substring(Math.max(0, snipIdx - 30), snipIdx), after: snippet.substring(snipIdx + match[0].length, snipIdx + match[0].length + 30), x: tx[4], y: tx[5] - itemH, w: bestItem.width || 50, h: itemH });
        }

        // Search PDF annotations (free text, stamps, form fields, callouts, etc.)
        const annotations = await page.getAnnotations();
        for (const annot of annotations) {
          // Collect all text fields an annotation may have
          const annotTexts: string[] = [];
          if (annot.contents) annotTexts.push(annot.contents);
          if (annot.fieldValue && typeof annot.fieldValue === 'string') annotTexts.push(annot.fieldValue);
          if (annot.alternativeText) annotTexts.push(annot.alternativeText);
          if (annot.richTextContent) annotTexts.push(annot.richTextContent);
          if (annot.defaultAppearance?.text) annotTexts.push(annot.defaultAppearance.text);
          for (const str of annotTexts) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(str)) !== null) {
              // rect: [x1, y1, x2, y2] in PDF coordinates
              const rect = annot.rect || [0, 0, 0, 0];
              const tx = pdfjs.Util.transform(viewport.transform, [1, 0, 0, 1, rect[0], rect[1]]);
              results.push({ pageIndex: i - 1, matchIndex: results.length, text: str, before: str.substring(0, match.index), after: str.substring(match.index + keyword.length), x: tx[4], y: tx[5] });
            }
          }
        }

        setSearchProgress(searchScope === 'document' ? Math.round((i / totalPages) * 100) : 100);
        if (results.length > 500) break;
      }

      // Also search through markup properties (subject, comment, canvas text, custom fields)
      const markupList = markups || [];
      const startPage = searchScope === 'page' ? currentPage - 1 : 0;
      const endPage = searchScope === 'page' ? currentPage - 1 : Infinity;
      for (const m of markupList) {
        const pageIdx = m.pageNumber || 0;
        if (pageIdx < startPage || pageIdx > endPage) continue;
        const props = m.properties || {};
        const coords = m.coordinates || {};
        // Collect all text fields (including custom fields)
        const textFields = [props.subject, props.comment, props.text, m.type, ...Object.entries(props).filter(([k]) => !['stroke','fill','fillOpacity','strokeWidth','lineStyle','fontSize','textColor','zIndex','locked','isPastedOrDuplicated','borderColor','borderWidth','arrowSize','arrowStyle','fontFamily','fontWeight','fontStyle','text','subject','comment'].includes(k)).map(([,v]) => typeof v === 'string' ? v : '')].filter(Boolean).join(' ');
        regex.lastIndex = 0;
        const match = regex.exec(textFields);
        if (match) {
          const matchInText = textFields.indexOf(match[0]);
          results.push({
            pageIndex: pageIdx,
            matchIndex: results.length,
            text: textFields,
            before: textFields.substring(0, matchInText),
            after: textFields.substring(matchInText + keyword.length),
            x: (coords.left ?? coords.x1 ?? 0) * pageDimensions.width,
            y: (coords.top ?? coords.y1 ?? 0) * pageDimensions.height,
            markupId: m.id, // flag: this is a markup result
          });
        }
      }

      setSearchResults(results);
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  }, [pdfDoc, searchScope, currentPage, markups, pageDimensions]);

  const handleResetSearch = useCallback(() => { setActiveSearchKeyword(''); setSearchResults([]); setActiveSearchResultIndex(null); setSearchProgress(0); setIsSearching(false); }, []);

  const handleJumpToBookmark = useCallback(async (dest: any) => {
    if (!pdfDoc) return;
    try {
      let pageNumber = -1;
      if (Array.isArray(dest)) { const pageIndex = await pdfDoc.getPageIndex(dest[0]); pageNumber = pageIndex + 1; }
      else if (typeof dest === 'string') { const resolved = await pdfDoc.getDestination(dest); if (resolved) { const pageIndex = await pdfDoc.getPageIndex(resolved[0]); pageNumber = pageIndex + 1; } }
      if (pageNumber > 0) handleJumpToPage(pageNumber);
    } catch (e) { console.error('Failed to jump to bookmark:', e); }
  }, [pdfDoc, handleJumpToPage]);

  const handleUpdateProperties = useCallback(async (markupId: string, data: any) => {
    const original = (markups || []).find((m: Markup) => m.id === markupId);
    const updateData = {
      ...data,
      updatedBy: { id: user?.id || '', name: user?.name || user?.email || 'Unknown' },
      updatedAt: new Date().toISOString(),
    };
    await updateMarkupAPI({ id: markupId, ...updateData });
    if (original) pushHistory({ type: 'update', markupId, before: original, after: { ...original, ...updateData } });
  }, [markups, updateMarkupAPI, pushHistory, user]);

  const handleDeleteMarkup = useCallback(async (markupIds: string | string[]) => {
    const ids = Array.isArray(markupIds) ? markupIds : [markupIds];
    for (const id of ids) {
      const original = (markups || []).find((m: Markup) => m.id === id);
      await deleteMarkupAPI(id); if (original) pushHistory({ type: 'delete', markupId: id, before: original });
    }
    setSelectedMarkupIds(prev => {
      const next = prev.filter(id => !ids.includes(id));
      if (next.length === 0) setPropertiesOpen(false);
      return next;
    });
    setTimeout(() => refetchMarkups(), 100);
  }, [deleteMarkupAPI, pushHistory, refetchMarkups]);

  const handleMarkupAdded = useCallback(async (newMarkup: any) => {
    // ['*'] = everyone can edit/delete by default
    const res = await createMarkup({ ...newMarkup, documentId, pageNumber: newMarkup.pageNumber ?? 0, allowedEditUserIds: ['*'], allowedDeleteUserIds: ['*'] });
    if (res?.id) pushHistory({ type: 'create', markupId: res.id, after: res });
    refetchMarkups();
  }, [documentId, refetchMarkups, createMarkup, pushHistory, projectUsers]);

  const handleHighlightAll = useCallback(async (color: string) => {
    if (!searchResults.length || !pageDimensions.width) return;
    const pageW = pageDimensions.width;
    const pageH = pageDimensions.height;
    for (const result of searchResults) {
      if ((result as any).markupId) continue;
      if (!result.w || !result.h) continue;
      await handleMarkupAdded({
        type: 'highlighter',
        pageNumber: result.pageIndex,
        coordinates: {
          left: result.x / pageW,
          top: result.y / pageH,
          width: result.w / pageW,
          height: result.h / pageH,
        },
        properties: { stroke: color, strokeWidth: 12, originalWidth: pageW, originalHeight: pageH },
      });
    }
  }, [searchResults, pageDimensions, handleMarkupAdded]);

  const handleDuplicateMarkups = useCallback(async () => {
    const toDup = selectedMarkups.length > 0 ? [...selectedMarkups] : [];
    if (toDup.length === 0 && contextMenu?.markupId) { const m = (markups || []).find((m: any) => m.id === contextMenu.markupId); if (m) toDup.push(m); }
    if (toDup.length === 0) return;
    for (const m of toDup) {
      const { id, author, createdAt, authorId, pageNumber, ...rest } = m;
      const coords = { ...rest.coordinates };
      // Offset so duplicate is visibly shifted; keep on the original markup's page
      const off = 0.04;
      if (coords.left !== undefined) { coords.left = Math.min(0.95, coords.left + off); coords.top = Math.min(0.95, coords.top + off); }
      else if (coords.x1 !== undefined) { coords.x1 += off; coords.y1 += off; coords.x2 += off; coords.y2 += off; }
      const newProps = JSON.parse(JSON.stringify(rest.properties || {}));

      // Prevent duplicate notifications; clear comment on duplicate (custom params preserved)
      newProps.isPastedOrDuplicated = true;
      delete newProps.comment; // Don't duplicate comments
      if (newProps.subject) newProps.subject = newProps.subject.replace(/@([a-zA-Z0-9_.\-\s]+)/g, '$1');

      // Always duplicate onto the same page as the original markup
      const res = await createMarkup({ ...rest, coordinates: coords, properties: newProps, documentId, pageNumber: m.pageNumber, allowedEditUserIds: m.allowedEditUserIds ?? ['*'], allowedDeleteUserIds: m.allowedDeleteUserIds ?? ['*'] });
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

  const handleExportPdf = useCallback(async () => {
    if (!pdfDoc || isExporting) return;
    setIsExporting(true);
    try {
      await exportPdfWithMarkups({
        pdfDocProxy: pdfDoc,
        allMarkups: markups,
        numPages,
        docScale,
        hiddenLayers,
        docName: doc?.name || 'document',
        onProgress: (current, total) => {
          console.log(`Export: page ${current}/${total}`);
        },
      });
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setIsExporting(false);
    }
  }, [pdfDoc, isExporting, markups, numPages, docScale, hiddenLayers, doc]);

  const handleDownloadClean = useCallback(() => {
    if (!documentId || !token) return;
    fetch(`/api/documents/${documentId}/proxy`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url; a.download = doc?.name || `document_${documentId}.pdf`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      })
      .catch(e => console.error('Download failed:', e));
  }, [documentId, token, doc]);

  const handlePasteMarkups = useCallback(async () => {
    if (markupClipboard.length === 0) return;
    const newIds: string[] = [];

    // Determine target page from mouse position
    let targetPageIdx: number;
    let mouseX: number;
    let mouseY: number;
    if (scrollMode === 'continuous') {
      const rawX = mousePosRef.current.x * displayScale;
      const rawY = mousePosRef.current.y * displayScale;
      const pageH = pageDimensions.height * zoom + 16; // page height + mb:2 gap
      const paddingTop = 48; // container p:4 (32px) + inner box my:2 (16px)
      const paddingLeft = 32; // container p:4
      targetPageIdx = Math.max(0, Math.min(numPages - 1, Math.floor((rawY - paddingTop) / pageH)));
      mouseX = Math.max(0, Math.min(1, (rawX - paddingLeft) / (pageDimensions.width * zoom)));
      mouseY = Math.max(0, Math.min(1, ((rawY - paddingTop) - targetPageIdx * pageH) / (pageDimensions.height * zoom)));
    } else {
      // Single page mode — account for container padding (p:4 = 32px)
      const rawX = mousePosRef.current.x * displayScale;
      const rawY = mousePosRef.current.y * displayScale;
      const paddingLeft = 32;
      const paddingTop = 32;
      targetPageIdx = currentPage - 1;
      mouseX = Math.max(0, Math.min(1, (rawX - paddingLeft) / (pageDimensions.width * displayScale)));
      mouseY = Math.max(0, Math.min(1, (rawY - paddingTop) / (pageDimensions.height * displayScale)));
    }

    const firstCoords = markupClipboard[0]?.coordinates || {};
    // Offset from original position to mouse position (paste at cursor)
    const origX = firstCoords.left ?? firstCoords.x1 ?? mouseX;
    const origY = firstCoords.top ?? firstCoords.y1 ?? mouseY;
    const offsetX = mouseX - origX;
    const offsetY = mouseY - origY;

    for (const m of markupClipboard) {
      const { id, author, createdAt, authorId, pageNumber, ...rest } = m;
      const newCoords = { ...rest.coordinates };
      if (newCoords.left !== undefined) { newCoords.left = Math.max(0, Math.min(1, newCoords.left + offsetX)); newCoords.top = Math.max(0, Math.min(1, newCoords.top + offsetY)); }
      else if (newCoords.x1 !== undefined) { newCoords.x1 = Math.max(0, Math.min(1, newCoords.x1 + offsetX)); newCoords.y1 = Math.max(0, Math.min(1, newCoords.y1 + offsetY)); newCoords.x2 = Math.max(0, Math.min(1, newCoords.x2 + offsetX)); newCoords.y2 = Math.max(0, Math.min(1, newCoords.y2 + offsetY)); }

      const newProps = JSON.parse(JSON.stringify(rest.properties || {}));
      newProps.isPastedOrDuplicated = true;
      delete newProps.comment; // Don't paste comments
      if (newProps.subject) newProps.subject = newProps.subject.replace(/@([a-zA-Z0-9_.\-\s]+)/g, '$1');

      // Paste onto the page where the mouse cursor is
      const res = await createMarkup({ ...rest, coordinates: newCoords, properties: newProps, documentId, pageNumber: targetPageIdx });
      if (res?.id) { newIds.push(res.id); pushHistory({ type: 'create', markupId: res.id, after: res }); }
    }
    if (newIds.length > 0) { setSelectedMarkupIds(newIds); refetchMarkups(); }
  }, [markupClipboard, currentPage, documentId, createMarkup, pushHistory, refetchMarkups, pageDimensions, scrollMode, displayScale, zoom, numPages]);

  // Track mouse position for paste-at-cursor
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mousePosRef.current = {
        x: (e.clientX - rect.left + container.scrollLeft) / displayScale,
        y: (e.clientY - rect.top + container.scrollTop) / displayScale,
      };
    };
    container.addEventListener('mousemove', onMove);
    return () => container.removeEventListener('mousemove', onMove);
  }, [displayScale]);

  const handleDocScaleChange = useCallback(async (newScale: string) => {
    setDocScale(newScale);
    localStorage.setItem('pdfDocScale', newScale);
    try { await apiFetch(`/api/documents/${documentId}/scale`, { method: 'PATCH', body: JSON.stringify({ scale: newScale }) }); }
    catch { /* scale persisted to localStorage; server save is optional */ }
  }, [documentId]);

  // Sync scrollMode ref and persist to localStorage
  useEffect(() => {
    scrollModeRef.current = scrollMode;
    localStorage.setItem('pdfScrollMode', scrollMode);
    // When entering split view, initialise each panel's zoom to the current display scale
    if (scrollMode === 'split') {
      setSplitLeftZoom(displayScaleRef.current);
      setSplitRightZoom(displayScaleRef.current);
    }
  }, [scrollMode]);

  // Highlighter default width 12px — restore 2px when leaving
  useEffect(() => {
    if (tool === prevToolRef.current) return;
    prevToolRef.current = tool;
    if (tool === 'highlighter') setActiveStrokeWidth(12);
  }, [tool]);

  // ─── 6. Effects ───
  useEffect(() => {
    if (!documentId) return;
    apiFetch(`/api/documents/${documentId}/info`).then(res => { setDoc(res.data); if (res.data?.scale) setDocScale(res.data.scale); }).catch(err => console.error(err)).finally(() => setLoading(false));
  }, [documentId]);

  // Set PDF file source once auth is ready — PDF.js streams only needed pages via range requests
  useEffect(() => {
    if (!documentId || authLoading || !token) { setPdfFile(null); return; }
    setPdfFile({ url: `/api/documents/${documentId}/proxy`, httpHeaders: { Authorization: `Bearer ${token}` } });
  }, [documentId, token, authLoading]);

  // Load a single cached PDFDocumentProxy — shared by search highlights and handlers.
  // Uses the same URL + auth header so PDF.js reuses its already-started stream.
  useEffect(() => {
    if (!pdfFile) {
      pdfDocCleanupRef.current?.destroy?.();
      pdfDocCleanupRef.current = null;
      setPdfDoc(null);
      return;
    }
    let cancelled = false;
    pdfjs.getDocument({ url: pdfFile.url, httpHeaders: pdfFile.httpHeaders })
      .promise.then(doc => {
        if (cancelled) { doc.destroy(); return; }
        pdfDocCleanupRef.current = doc;
        setPdfDoc(doc);
      }).catch(console.error);
    return () => {
      cancelled = true;
      pdfDocCleanupRef.current?.destroy?.();
      pdfDocCleanupRef.current = null;
      setPdfDoc(null);
    };
  }, [pdfFile]);

  // Detect embedded PDF annotations (Bluebeam / Acrobat) after PDF loads
  useEffect(() => {
    if (!pdfDoc) { setEmbeddedAnnots(null); return; }
    setEmbeddedAnnots(null);
    let cancelled = false;
    detectAndParseAnnotations(pdfDoc)
      .then(annots => { if (!cancelled) setEmbeddedAnnots(annots); })
      .catch(() => { if (!cancelled) setEmbeddedAnnots([]); });
    return () => { cancelled = true; };
  }, [pdfDoc]);

  useEffect(() => {
    const container = scrollContainerRef.current; if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || scrollModeRef.current === 'page') {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const snapScrollLeft = container.scrollLeft;
        const snapScrollTop = container.scrollTop;

        const prevScale = displayScaleRef.current;
        const newScale = Math.max(0.1, Math.min(10, prevScale + delta));
        const ratio = newScale / prevScale;
        displayScaleRef.current = newScale;

        // Update CSS transform DIRECTLY on the DOM — no React re-render,
        // gives truly smooth GPU-only zoom like Bluebeam.
        if (transformBoxRef.current) {
          transformBoxRef.current.style.transform = `scale(${newScale / zoomRef.current})`;
        }

        // Adjust scroll so the point under cursor stays fixed
        requestAnimationFrame(() => {
          container.scrollLeft = (snapScrollLeft + cursorX) * ratio - cursorX;
          container.scrollTop = (snapScrollTop + cursorY) * ratio - cursorY;
        });

        // Debounced: commit zoom → triggers full re-render at new resolution
        updateActualZoom(newScale);

        // Update React state too (for mouse coordinate calculations, zoom %, etc.)
        // This re-render is fine since it's debounced via the same mechanism
        setDisplayScale(newScale);
      }
    };

    let isPanning = false, startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || tool === 'pan') {
        e.preventDefault(); isPanning = true; startX = e.pageX; startY = e.pageY;
        scrollLeft = container.scrollLeft; scrollTop = container.scrollTop;
        container.style.cursor = 'grabbing';
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      container.scrollLeft = scrollLeft - (e.pageX - startX);
      container.scrollTop = scrollTop - (e.pageY - startY);
    };
    const handleMouseUp = () => {
      if (isPanning) { isPanning = false; container.style.cursor = tool === 'pan' ? 'grab' : 'auto'; }
    };

    // ── Touch pan (single finger, pan tool) ──
    let touchPanning = false, touchStartX = 0, touchStartY = 0, touchScrollL = 0, touchScrollT = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      } else if (e.touches.length === 1 && tool === 'pan') {
        touchPanning = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchScrollL = container.scrollLeft;
        touchScrollT = container.scrollTop;
      }
    };
    let lastPinchDist = 0;
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastPinchDist > 0) {
          const delta = (dist - lastPinchDist) / 300;
          const next = Math.max(0.1, Math.min(10, Math.round((displayScaleRef.current + delta) * 100) / 100));
          updateActualZoom(next);
          setDisplayScale(next);
        }
        lastPinchDist = dist;
      } else if (touchPanning && e.touches.length === 1) {
        container.scrollLeft = touchScrollL - (e.touches[0].clientX - touchStartX);
        container.scrollTop = touchScrollT - (e.touches[0].clientY - touchStartY);
      }
    };
    const handleTouchEnd = () => { touchPanning = false; lastPinchDist = 0; };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [tool, updateActualZoom]);

  // ── Split-view: independent wheel-zoom per panel ──
  useEffect(() => {
    if (scrollMode !== 'split') return;
    const makeFn = (setter: React.Dispatch<React.SetStateAction<number>>) => (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setter(prev => Math.max(0.1, Math.min(10, Math.round((prev + delta) * 100) / 100)));
    };
    const leftEl = splitLeftScrollRef.current;
    const rightEl = splitRightScrollRef.current;
    const leftFn = makeFn(setSplitLeftZoom);
    const rightFn = makeFn(setSplitRightZoom);
    leftEl?.addEventListener('wheel', leftFn, { passive: false });
    rightEl?.addEventListener('wheel', rightFn, { passive: false });
    return () => {
      leftEl?.removeEventListener('wheel', leftFn);
      rightEl?.removeEventListener('wheel', rightFn);
    };
  }, [scrollMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
      // Block browser-native shortcuts that interfere with PDF viewer
      if (ctrl && ['f', 'p', 's', 'a'].includes(key)) { e.preventDefault(); return; }
      // When user has no markup permission, only allow select/pan shortcuts
      if (!canMarkup) {
        const readOnlyShortcuts: Record<string, DrawTool> = { v: 'select', ' ': 'pan' };
        if (!ctrl && readOnlyShortcuts[key]) { e.preventDefault(); setTool(readOnlyShortcuts[key]); }
        return;
      }
      const toolShortcuts: Record<string, DrawTool> = { v: 'select', ' ': 'pan', p: 'pen', h: 'highlighter', l: 'line', a: 'arrow', r: 'rect', c: 'cloud', t: 'text', o: 'callout', m: 'measure', k: 'polyline' };
      if (!ctrl && toolShortcuts[key]) { e.preventDefault(); setTool(toolShortcuts[key]); return; }
      if (key === 'delete' || key === 'backspace') { if (selectedMarkupIds.length > 0) { e.preventDefault(); const deletableIds = selectedMarkupIds.filter(id => { const m = (markups || []).find((x: any) => x.id === id); if (!m) return true; if (isAdmin || (user?.id != null && m.authorId === user.id)) return true; const dids = m.allowedDeleteUserIds; if (!dids || dids.includes('*')) return true; if (dids.length === 0) return false; return user?.id != null && dids.includes(user.id); }); if (deletableIds.length > 0) handleDeleteMarkup(deletableIds); } return; }
      if (ctrl && key === 'c') { if (selectedMarkups.length > 0) { e.preventDefault(); setMarkupClipboard([...selectedMarkups]); } return; }
      if (ctrl && key === 'v') { e.preventDefault(); handlePasteMarkups(); return; }
      if (ctrl && key === 'd') { e.preventDefault(); handleDuplicateMarkups(); return; }
      if (ctrl && key === 'z') { e.preventDefault(); handleUndo(); return; }
      if (ctrl && key === 'y') { e.preventDefault(); handleRedo(); return; }
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMarkupIds, selectedMarkups, markups, user, isAdmin, canMarkup, handleDeleteMarkup, handleDuplicateMarkups, handleUndo, handleRedo, handlePasteMarkups]);

  // Prevent browser context menu on the entire PDF viewer page
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, []);

  // Auto-jump to markup from notification link (?markupId=...)
  const notifMarkupId = searchParams.get('markupId');
  const [, setSearchParams] = useSearchParams();
  
  useEffect(() => {
    if (!notifMarkupId || !markups?.length || !pdfFile) return;
    const m = (markups as any[]).find((x: any) => x.id === notifMarkupId);
    if (!m) return;
    // small delay so the PDF page renders
    const t = setTimeout(() => {
      handleJumpToMarkup([notifMarkupId]);
      // Remove it from the URL so it doesn't trigger again on re-renders
      setSearchParams(prev => {
        prev.delete('markupId');
        return prev;
      }, { replace: true });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifMarkupId, markups?.length, pdfFile]);

  const onDocumentLoadSuccess = async (pdf: any) => {
    setNumPages(pdf.numPages);
    try {
      const page = await pdf.getPage(1), viewport = page.getViewport({ scale: 1 });
      setPageDimensions({ width: viewport.width, height: viewport.height });
      const labels = await pdf.getPageLabels(); setPageLabels(labels || []);
      const outline = await pdf.getOutline(); setBookmarks(outline || []);
    } catch (e) { console.error(e); }
  };

  // Import embedded PDF annotations (Bluebeam compatibility)
  // Uses Y.js createMarkup so markups sync in real-time to all connected clients
  const handleImportAnnotations = useCallback(async () => {
    if (!embeddedAnnots || embeddedAnnots.length === 0) return;
    setIsImporting(true);
    const tid = toast.loading(`Importing ${embeddedAnnots.length} annotation${embeddedAnnots.length !== 1 ? 's' : ''}…`);
    try {
      for (const annot of embeddedAnnots) {
        await createMarkup({
          ...annot,
          documentId,
          allowedEditUserIds: ['*'],
          allowedDeleteUserIds: ['*'],
        });
      }
      setEmbeddedAnnots([]); // hide the badge after import
      toast.success(`Imported ${embeddedAnnots.length} annotation${embeddedAnnots.length !== 1 ? 's' : ''} from PDF`, { id: tid });
    } catch (e: any) {
      toast.error(e?.message ?? 'Import failed', { id: tid });
    } finally {
      setIsImporting(false);
    }
  }, [embeddedAnnots, documentId, createMarkup]);

  const handleToggleLayer = useCallback((t: string) => { setHiddenLayers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]); }, []);

  // ─── 7. Render ───
  const viewerBg = isDark ? '#121212' : '#8d8d8d';
  if ((authLoading || loading) && !doc) return <Box display="flex" justifyContent="center" alignItems="center" height="100%"><CircularProgress /></Box>;
  if (!doc) return <NotFoundPage title="Document Not Found" message="This document may have been deleted or you don't have access to it." />;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary', overflow: 'hidden' }}>
      <PdfToolbar 
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        tool={tool} onToolChange={setTool} activeColor={activeColor} onColorChange={setActiveColor} activeStrokeWidth={activeStrokeWidth} onStrokeWidthChange={setActiveStrokeWidth} activeLineStyle={activeLineStyle} onLineStyleChange={setActiveLineStyle} docScale={docScale} onDocScaleChange={handleDocScaleChange} zoom={displayScale} onZoomIn={() => handleZoom(0.1)} onZoomOut={() => handleZoom(-0.1)} currentPage={currentPage} numPages={numPages} onPageChange={handleJumpToPage} scrollMode={scrollMode} onScrollModeChange={setScrollMode} canUndo={canUndo} canRedo={canRedo} onUndo={handleUndo} onRedo={handleRedo} versions={doc?.versions} currentDocId={documentId} onVersionChange={(v) => (window.location.href = `/projects/${projectId}/documents/${v}`)} canMarkup={canMarkup} onDownloadClean={handleDownloadClean} onExportPdf={handleExportPdf} isExporting={isExporting} pageMarkupCount={(markups || []).filter((m: any) => m.pageNumber === currentPage - 1 && m.type !== 'auto-highlight').length}
        embeddedAnnotCount={embeddedAnnots?.length ?? 0}
        onImportAnnotations={canMarkup ? handleImportAnnotations : undefined}
        isImporting={isImporting} />
      
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <PdfSidebar open={sidebarOpen} tab={sidebarTab} onTabChange={setSidebarTab} markups={markups} selectedMarkupIds={selectedMarkupIds} onMarkupSelect={handleJumpToMarkup} onMarkupOpen={handleJumpToMarkup} onDeleteMarkup={handleDeleteMarkup} hiddenLayers={hiddenLayers} onToggleLayer={handleToggleLayer} searchResults={searchResults} isSearching={isSearching} searchProgress={searchProgress} onSearch={handleSearch} jumpToPage={handleJumpToPage} searchKeyword={activeSearchKeyword} onSearchKeywordChange={setActiveSearchKeyword} bookmarks={bookmarks} numPages={numPages} onJumpToBookmark={handleJumpToBookmark} pdfData={pdfFile?.url} currentPage={currentPage} pageLabels={pageLabels} searchScope={searchScope} onSearchScopeChange={setSearchScope} onResetSearch={handleResetSearch} activeSearchResultIndex={activeSearchResultIndex} onSearchResultSelect={handleJumpToSearchMatch} onHighlightAll={handleHighlightAll} currentUserId={user?.id} isAdmin={isAdmin}
          onBulkUpdateProperty={(ids, key, value) => ids.forEach(id => {
            const m = (markups || []).find((x: any) => x.id === id);
            if (m) handleUpdateProperties(id, { properties: { ...m.properties, [key]: value } });
          })} />
        
        {scrollMode === 'split' ? (
          /* ── SPLIT VIEW ── two independent panels side by side ── */
          <Box sx={{ flexGrow: 1, display: 'flex', height: '100%', overflow: 'hidden', gap: '1px', bgcolor: 'divider' }}>
            {(['left', 'right'] as const).map((side) => {
              const pg = side === 'left' ? currentPage : splitRightPage;
              const setPg = side === 'left' ? setCurrentPage : setSplitRightPage;
              const panelZoom = side === 'left' ? splitLeftZoom : splitRightZoom;
              const setPanelZoom = side === 'left' ? setSplitLeftZoom : setSplitRightZoom;
              const scrollRef = side === 'left' ? splitLeftScrollRef : splitRightScrollRef;
              return (
                <Box key={side} sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: viewerBg }}>
                  {/* Panel scroll area — block-level overflow so centering works correctly at any zoom */}
                  <Box
                    ref={scrollRef}
                    sx={{
                      flex: 1, overflow: 'auto', p: 2,
                      textAlign: 'center',
                      '&::-webkit-scrollbar': { width: '6px', height: '6px' },
                      '&::-webkit-scrollbar-thumb': { background: 'rgba(128,128,128,0.3)', borderRadius: '6px' },
                    }}
                  >
                    {pdfFile && (
                      <Document file={pdfFile} onLoadSuccess={side === 'left' ? onDocumentLoadSuccess : undefined} loading={<CircularProgress />}>
                        <Box sx={{ display: 'inline-block' }}>
                          <PageContainer
                            pageIndex={pg - 1}
                            renderDelay={0}
                            pdfWidth={pageDimensions.width}
                            pdfHeight={pageDimensions.height}
                            scale={panelZoom}
                            markups={markupsByPage[pg - 1] || []}
                            tool={tool} activeColor={activeColor} activeStrokeWidth={activeStrokeWidth} activeLineStyle={activeLineStyle}
                            docScale={docScale} hiddenLayers={hiddenLayers} selectedMarkupIds={selectedMarkupIds}
                            handleMarkupAdded={handleMarkupAdded} handleMarkupSelected={handleMarkupSelected}
                            handleMarkupModified={handleMarkupModified} handleMarkupDeleted={handleDeleteMarkup}
                            handleContextMenu={handleContextMenu} searchKeyword={activeSearchKeyword}
                            pdfDoc={pdfDoc} currentUserId={user?.id} isAdmin={isAdmin} canMarkup={canMarkup}
                            onCanvasMention={setCanvasMentionData}
                          />
                        </Box>
                      </Document>
                    )}
                  </Box>
                  {/* Per-panel navigation bar: page nav + independent zoom */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, px: 1.5, py: 0.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
                    {/* Page navigation */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <IconButton size="small" onClick={() => setPg(p => Math.max(1, p - 1))} disabled={pg <= 1} sx={{ p: 0.5 }}>
                        <KeyboardArrowLeftIcon fontSize="small" />
                      </IconButton>
                      <Typography variant="caption" sx={{ minWidth: 52, textAlign: 'center', fontWeight: 600, fontSize: '0.68rem' }}>
                        {pg} / {numPages}
                      </Typography>
                      <IconButton size="small" onClick={() => setPg(p => Math.min(numPages, p + 1))} disabled={pg >= numPages} sx={{ p: 0.5 }}>
                        <KeyboardArrowRightIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    {/* Zoom */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <IconButton size="small" onClick={() => setPanelZoom(z => Math.max(0.1, Math.round((z - 0.1) * 100) / 100))} sx={{ p: 0.5, borderRadius: '6px' }}>
                        <Typography sx={{ fontSize: '1rem', lineHeight: 1, fontWeight: 400 }}>−</Typography>
                      </IconButton>
                      <Typography variant="caption" sx={{ minWidth: 34, textAlign: 'center', fontWeight: 700, fontSize: '0.68rem' }}>
                        {Math.round(panelZoom * 100)}%
                      </Typography>
                      <IconButton size="small" onClick={() => setPanelZoom(z => Math.min(10, Math.round((z + 0.1) * 100) / 100))} sx={{ p: 0.5, borderRadius: '6px' }}>
                        <Typography sx={{ fontSize: '1rem', lineHeight: 1, fontWeight: 400 }}>+</Typography>
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          /* ── NORMAL VIEW (page / continuous) ── */
          <Box ref={scrollContainerRef} onContextMenu={(e) => e.preventDefault()} sx={{ flexGrow: 1, height: '100%', position: 'relative', overflow: 'auto', bgcolor: viewerBg, display: 'block', p: 4, cursor: tool === 'pan' ? 'grab' : 'auto', scrollBehavior: 'auto', minWidth: 0, '&::-webkit-scrollbar': { width: '8px', height: '8px' }, '&::-webkit-scrollbar-track': { background: 'transparent' }, '&::-webkit-scrollbar-thumb': { background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)', borderRadius: '10px', border: '2px solid transparent', backgroundClip: 'padding-box', '&:hover': { background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' } } }}>
            {pdfFile && (
              <Box sx={{ display: 'inline-flex', justifyContent: 'flex-start', minWidth: pageDimensions.width * displayScale + 64, minHeight: 'min-content' }}>
                <Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess} loading={<CircularProgress />}>
                  <Box ref={transformBoxRef} sx={{
                    transform: `scale(1)`,
                    transformOrigin: 'top left',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    willChange: 'transform',
                    imageRendering: 'auto',
                    width: pageDimensions.width * zoom,
                    height: (scrollMode === 'continuous' ? pageDimensions.height * numPages : pageDimensions.height) * zoom,
                    my: 2
                  }}>
                    {scrollMode === 'continuous' ? Array.from(new Array(numPages), (_, idx) => <PageContainer key={idx} pageIndex={idx} renderDelay={idx * 30} pdfWidth={pageDimensions.width} pdfHeight={pageDimensions.height} scale={zoom} markups={markupsByPage[idx] || []} tool={tool} activeColor={activeColor} activeStrokeWidth={activeStrokeWidth} activeLineStyle={activeLineStyle} docScale={docScale} hiddenLayers={hiddenLayers} selectedMarkupIds={selectedMarkupIds} handleMarkupAdded={handleMarkupAdded} handleMarkupSelected={handleMarkupSelected} handleMarkupModified={handleMarkupModified} handleMarkupDeleted={handleDeleteMarkup} handleContextMenu={handleContextMenu} searchKeyword={activeSearchKeyword} pdfDoc={pdfDoc} currentUserId={user?.id} isAdmin={isAdmin} canMarkup={canMarkup} onCanvasMention={setCanvasMentionData} />) : <PageContainer pageIndex={currentPage - 1} renderDelay={0} pdfWidth={pageDimensions.width} pdfHeight={pageDimensions.height} scale={zoom} markups={markupsByPage[currentPage - 1] || []} tool={tool} activeColor={activeColor} activeStrokeWidth={activeStrokeWidth} activeLineStyle={activeLineStyle} docScale={docScale} hiddenLayers={hiddenLayers} selectedMarkupIds={selectedMarkupIds} handleMarkupAdded={handleMarkupAdded} handleMarkupSelected={handleMarkupSelected} handleMarkupModified={handleMarkupModified} handleMarkupDeleted={handleDeleteMarkup} handleContextMenu={handleContextMenu} searchKeyword={activeSearchKeyword} pdfDoc={pdfDoc} currentUserId={user?.id} isAdmin={isAdmin} canMarkup={canMarkup} onCanvasMention={setCanvasMentionData} />}
                  </Box>
                </Document>
              </Box>
            )}
          </Box>
        )}

        <MarkupPropertiesPanel open={propertiesOpen} onClose={() => { setSelectedMarkupIds([]); setPropertiesOpen(false); }} selectedMarkups={selectedMarkups} onUpdateProperties={handleUpdateProperties} onDeleteMarkup={handleDeleteMarkup} documentId={documentId} projectId={projectId} onAction={handleMarkupAction} markups={markups} canEdit={canMarkup ? canEditMarkup : false} currentUserId={user?.id} isAdmin={isAdmin} docScale={docScale} />
        
        {/* RESPONSIVE BOTTOM BAR (Mobile/Tablet) — order: Pages | ScrollMode | Scale | Zoom | Version */}
        {isSM && (
          <Box sx={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5,
            bgcolor: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(8px)',
            borderRadius: '12px', border: 1, borderColor: 'divider',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 1100
          }}>
            {/* Page Nav */}
            <Box display="flex" alignItems="center">
              <IconButton size="small" onClick={() => handleJumpToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} sx={{ p: 0.5 }}>
                <KeyboardArrowLeftIcon fontSize="small" />
              </IconButton>
              <Box display="flex" alignItems="center" gap={0.5} px={0.5}>
                <InputBase
                  value={currentPage}
                  onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val)) handleJumpToPage(val); }}
                  sx={{ width: 28, fontSize: "0.72rem", fontWeight: 700, bgcolor: alpha(gold, 0.1), borderRadius: "4px", "& input": { textAlign: "center", p: "1px 0" } }}
                />
                <Typography variant="caption" sx={{ fontSize: "0.68rem", opacity: 0.6 }}>/</Typography>
                <Typography variant="caption" sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{numPages}</Typography>
              </Box>
              <IconButton size="small" onClick={() => handleJumpToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages} sx={{ p: 0.5 }}>
                <KeyboardArrowRightIcon fontSize="small" />
              </IconButton>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ height: 18, my: 'auto' }} />

            {/* Scroll Mode */}
            <IconButton size="small" onClick={() => setScrollMode(scrollMode === 'page' ? 'continuous' : 'page')} sx={{ p: 0.5, color: 'text.secondary', borderRadius: '6px', '&:hover': { bgcolor: alpha(gold, 0.08), color: gold } }}>
              {scrollMode === 'page' ? <ArticleIcon sx={{ fontSize: 16 }} /> : <ViewDayIcon sx={{ fontSize: 16 }} />}
            </IconButton>

            <Divider orientation="vertical" flexItem sx={{ height: 18, my: 'auto' }} />

            {/* Zoom */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <IconButton size="small" onClick={() => handleZoom(-0.1)} sx={{ p: 0.5, borderRadius: '6px', '&:hover': { bgcolor: alpha(gold, 0.08) } }}>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1, fontWeight: 400 }}>−</Typography>
              </IconButton>
              <Typography variant="caption" sx={{ minWidth: 34, textAlign: 'center', fontWeight: 700, fontSize: '0.68rem' }}>
                {Math.round(displayScale * 100)}%
              </Typography>
              <IconButton size="small" onClick={() => handleZoom(0.1)} sx={{ p: 0.5, borderRadius: '6px', '&:hover': { bgcolor: alpha(gold, 0.08) } }}>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1, fontWeight: 400 }}>+</Typography>
              </IconButton>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ height: 18, my: 'auto' }} />

            {/* Scale */}
            <Select
              size="small"
              value={docScale}
              onChange={(e) => handleDocScaleChange(e.target.value)}
              IconComponent={() => null}
              variant="standard"
              disableUnderline
              sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.primary', minWidth: 44, '& .MuiSelect-select': { p: '0 4px', lineHeight: '20px' } }}
              MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', border: 1, borderColor: 'divider', maxHeight: 320 } } }}
            >
              {STANDARD_SCALES.map((group: any, idx: number) =>
                group.items
                  ? [
                    <ListSubheader key={`h-${idx}`} sx={{ lineHeight: '28px', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: gold, bgcolor: 'background.paper' }}>
                      {group.group}
                    </ListSubheader>,
                    ...group.items.map((item: any) => (
                      <MenuItem key={item.value} value={item.value} sx={{ fontSize: '0.72rem' }}>{item.label}</MenuItem>
                    ))
                  ]
                  : <MenuItem key={group.value} value={group.value} sx={{ fontSize: '0.72rem', fontWeight: 700 }}>{group.label}</MenuItem>
              )}
            </Select>

            {doc?.versions?.length > 0 && (
              <>
                <Divider orientation="vertical" flexItem sx={{ height: 18, my: 'auto' }} />
                <Select
                  size="small"
                  value={documentId}
                  variant="standard"
                  disableUnderline
                  IconComponent={() => null}
                  sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.primary', minWidth: 80, '& .MuiSelect-select': { p: '0 4px', lineHeight: '20px' } }}
                  MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', border: 1, borderColor: 'divider' } } }}
                  onChange={(e) => { window.location.href = `/projects/${projectId}/documents/${e.target.value}`; }}
                >
                  {doc.versions.map((v: any, idx: number) => (
                    <MenuItem key={v.id} value={v.id} sx={{ fontSize: '0.68rem' }}>
                      V{doc.versions.length - idx} — {dayjs(v.createdAt).format('MM/DD/YY')}
                    </MenuItem>
                  ))}
                </Select>
              </>
            )}
          </Box>
        )}

        <Menu open={contextMenu !== null} onClose={() => setContextMenu(null)} anchorReference="anchorPosition" anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined} slotProps={{ paper: { sx: { minWidth: 160, bgcolor: 'background.paper', border: 1, borderColor: 'divider', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', '& .MuiMenuItem-root': { fontSize: '0.78rem', gap: 1, borderRadius: '4px', mx: 0.5, my: 0.25 }, '& .MuiMenuItem-root:hover': { bgcolor: alpha(gold, 0.08) } }}}}>
          {canMarkup && <MenuItem onClick={() => { handleMarkupAction('duplicate', contextMenu!.markupId); setContextMenu(null); }}><ListItemIcon><ContentCopyIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('duplicate', 'Duplicate')} /><Typography variant="caption" color="text.secondary">Ctrl+D</Typography></MenuItem>}
          {canMarkup && <Divider sx={{ my: '4px !important' }} />}
          {canMarkup && <MenuItem onClick={() => { handleMarkupAction('front', contextMenu!.markupId); setContextMenu(null); }}><ListItemIcon><FlipToFrontIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('bringToFront', 'Bring to Front')} /></MenuItem>}
          {canMarkup && <MenuItem onClick={() => { handleMarkupAction('back', contextMenu!.markupId); setContextMenu(null); }}><ListItemIcon><FlipToBackIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('sendToBack', 'Send to Back')} /></MenuItem>}
          {canMarkup && <Divider sx={{ my: '4px !important' }} />}
          {canMarkup && (markups.find((m: any) => m.id === contextMenu?.markupId)?.properties?.locked ? <MenuItem onClick={() => { handleMarkupAction('unlock', contextMenu!.markupId); setContextMenu(null); }}><ListItemIcon><LockOpenIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('unlock', 'Unlock')} /></MenuItem> : <MenuItem onClick={() => { handleMarkupAction('lock', contextMenu!.markupId); setContextMenu(null); }}><ListItemIcon><LockIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('lock', 'Lock')} /></MenuItem>)}
          {canMarkup && <Divider sx={{ my: '4px !important' }} />}
          {canMarkup && (() => { const cm = markups.find((m: any) => m.id === contextMenu?.markupId); const _dids = cm?.allowedDeleteUserIds; const canDel = !cm || isAdmin || (user?.id != null && cm.authorId === user.id) || !_dids || _dids.includes('*') || (_dids.length > 0 && user?.id != null && _dids.includes(user.id)); return canDel ? <MenuItem onClick={() => { handleDeleteMarkup(contextMenu!.markupId); setContextMenu(null); }} sx={{ color: 'error.main' }}><ListItemIcon><DeleteIcon sx={{ fontSize: 16, color: 'error.main' }} /></ListItemIcon><ListItemText primary={t('delete', 'Delete')} /><Typography variant="caption" color="error">Del</Typography></MenuItem> : null; })()}
          <MenuItem onClick={() => { const m = markups.find((mm: any) => mm.id === contextMenu?.markupId); if (m) { setSelectedMarkupIds([m.id]); setPropertiesOpen(true); } setContextMenu(null); }}><ListItemIcon><ArticleIcon sx={{ fontSize: 16 }} /></ListItemIcon><ListItemText primary={t('properties', 'Properties')} /></MenuItem>
        </Menu>
        
        <Popover 
          open={Boolean(canvasMentionData)} 
          anchorReference="anchorPosition"
          anchorPosition={(() => {
            if (!canvasMentionData?.cursorPos || !canvasMentionData?.anchor) return undefined;
            const rect = canvasMentionData.anchor.getBoundingClientRect();
            return { 
              top: rect.top + canvasMentionData.cursorPos.top, 
              left: rect.left + canvasMentionData.cursorPos.left 
            };
          })()}
          onClose={() => setCanvasMentionData(null)} 
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} 
          transformOrigin={{ vertical: 'top', horizontal: 'left' }} 
          disableAutoFocus 
          disableEnforceFocus 
          slotProps={{ paper: { sx: { width: 200, maxHeight: 250, overflowY: 'auto', zIndex: 3000 } } }}
        >
          <List dense>{projectUsers.filter((u: any) => !canvasMentionData?.query || (u.name || u.email).toLowerCase().includes(canvasMentionData.query.toLowerCase())).map((user: any) => <ListItemButton key={user.id} onClick={() => canvasMentionData?.onSelect(user.name || user.email)}><ListItemIcon sx={{ minWidth: 32 }}><Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem' }}>{(user.name || user.email)[0].toUpperCase()}</Avatar></ListItemIcon><ListItemText primary={user.name || user.email} primaryTypographyProps={{ fontSize: '0.75rem', noWrap: true }} /></ListItemButton>)}</List>
        </Popover>
      </Box>
    </Box>
  );
});

export default DocumentViewPage;
