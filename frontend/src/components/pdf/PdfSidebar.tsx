import { memo, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Box, Tabs, Tab, useTheme, alpha, IconButton, Tooltip,
  LinearProgress, List, ListItemButton, ListItemText,
  Typography, CircularProgress, ListItemIcon, RadioGroup, FormControlLabel, Radio, useMediaQuery,
  Select, MenuItem, Divider,
} from '@mui/material';
import DrawIcon from '@mui/icons-material/Draw';
import SearchIcon from '@mui/icons-material/Search';
import LayersIcon from '@mui/icons-material/Layers';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ClearIcon from '@mui/icons-material/Clear';
import { useTranslation } from 'react-i18next';
import { Page, Document } from 'react-pdf';
import { MarkupTable } from './MarkupTable';

const SIDEBAR_WIDTH = 260;

const getScrollbarSx = (theme: any) => ({
  '&::-webkit-scrollbar': { width: '6px', height: '6px' },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    borderRadius: '10px',
    border: '2px solid transparent',
    backgroundClip: 'padding-box'
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
    border: '2px solid transparent',
    backgroundClip: 'padding-box'
  },
});

interface PdfSidebarProps {
  open: boolean;
  tab: number;
  onTabChange: (tab: number) => void;
  markups: any[];
  selectedMarkupIds: string[];
  onMarkupSelect: (ids: string[]) => void;
  onMarkupOpen?: (ids: string[]) => void;
  onDeleteMarkup?: (id: string | string[]) => void;
  hiddenLayers?: string[];
  onToggleLayer?: (type: string) => void;
  searchResults?: { pageIndex: number; text: string; before: string; after: string; matchIndex: number; markupId?: string }[];
  isSearching?: boolean;
  searchProgress?: number;
  onSearch?: (keyword: string) => void;
  onResetSearch?: () => void;
  searchKeyword?: string;
  onSearchKeywordChange?: (keyword: string) => void;
  searchScope?: 'document' | 'page';
  onSearchScopeChange?: (scope: 'document' | 'page') => void;
  activeSearchResultIndex?: number | null;
  onSearchResultSelect?: (index: number) => void;
  onHighlightAll?: (color: string) => void;
  jumpToPage?: (pageIndex: number) => void;
  numPages?: number;
  bookmarks?: any[];
  onJumpToBookmark?: (dest: any) => void;
  pdfData?: string;
  documentId?: string;
  token?: string;
  currentPage?: number;
  pageLabels?: string[];
  currentUserId?: string;
  isAdmin?: boolean;
  onBulkUpdateProperty?: (ids: string[], key: string, value: any) => void;
  /** OCG layers detected in the PDF (from Bluebeam overlay PDFs etc.) */
  pdfLayers?: { name: string; visible: boolean }[];
  onTogglePdfLayer?: (name: string) => void;
}

const BookmarkItem = ({ item, onJump, currentPage, pageLabels }: { item: any, onJump: (dest: any) => void, currentPage: number, pageLabels: string[] }) => {
  const [open, setOpen] = useState(true);
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const hasChildren = item.items && item.items.length > 0;
  
  // A bookmark is active if its exact title matches the current page's label, or one of its children is active
  const isSelfActive = pageLabels[currentPage - 1] === item.title;
  let hasActiveChild = false;
  if (hasChildren) {
    const checkActive = (nodes: any[]) => {
      for (const node of nodes) {
        if (pageLabels[currentPage - 1] === node.title) hasActiveChild = true;
        if (node.items) checkActive(node.items);
      }
    };
    checkActive(item.items);
  }
  
  const isActive = isSelfActive || hasActiveChild;

  useEffect(() => {
    // Auto-expand if active
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <>
      <ListItemButton 
        onClick={() => { if (hasChildren) setOpen(!open); onJump(item.dest); }}
        sx={{ pl: (item.level || 0) * 2 + 1.5, bgcolor: isActive ? alpha(gold, 0.1) : 'transparent', '&:hover': { bgcolor: isActive ? alpha(gold, 0.15) : alpha(gold, 0.05) }, alignItems: 'flex-start' }}
      >
        <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isActive || hasChildren ? 600 : 400, color: isActive ? gold : 'text.primary', sx: { wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.35, overflowWrap: 'anywhere' } }} />
      </ListItemButton>
      {open && hasChildren && item.items.map((sub: any, i: number) => (
        <BookmarkItem key={i} item={{ ...sub, level: (item.level || 0) + 1 }} onJump={onJump} currentPage={currentPage} pageLabels={pageLabels} />
      ))}
    </>
  );
};

// Lazy-rendered page thumbnail — uses tile server if available, falls back to react-pdf
const LazyPageThumbnail = memo(({ pageNum, isActive, gold, jumpToPage, label, documentId, token, pdfFileUrl }: {
  pageNum: number; isActive: boolean; gold: string; jumpToPage?: (p: number) => void;
  label: string; documentId?: string; token?: string; pdfFileUrl?: string;
}) => {
  const [visible, setVisible] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const thumbnailUrl = useMemo(() => {
    if (!documentId || !token || useFallback) return undefined;
    const cacheBust = retryCount > 0 ? `&r=${retryCount}` : '';
    return `/thumbnail/${documentId}/${pageNum - 1}?token=${token}${cacheBust}`;
  }, [documentId, pageNum, token, retryCount, useFallback]);

  const handleError = useCallback(() => {
    setUseFallback(true); // tile server unavailable or error — switch to react-pdf
  }, []);

  // Remove the artificial 2s timeout. Allow the tile server to process the request,
  // especially if it needs to download the PDF for the first time.
  // Errors will still trigger `handleError` via the `onError` image event.

  const pdfFile = useMemo(() => {
    if (!pdfFileUrl || !token) return undefined;
    return { url: pdfFileUrl, httpHeaders: { Authorization: `Bearer ${token}` } };
  }, [pdfFileUrl, token]);

  return (
    <Box ref={ref} onClick={() => jumpToPage?.(pageNum)}
      sx={{ py: 1.5, px: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, cursor: 'pointer',
        bgcolor: isActive ? alpha(gold, 0.12) : 'transparent',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
        '&:hover': { bgcolor: isActive ? alpha(gold, 0.18) : alpha(gold, 0.05) },
        transition: 'background-color 0.15s' }}
    >
      <Box sx={{
        width: 130, minHeight: 90, border: `1.5px solid`, borderColor: isActive ? gold : 'divider',
        borderRadius: '4px', overflow: 'hidden', bgcolor: 'white',
        boxShadow: isActive ? `0 0 0 2px ${alpha(gold, 0.3)}, 0 4px 12px rgba(0,0,0,0.12)` : '0 2px 6px rgba(0,0,0,0.08)',
        transform: isActive ? 'scale(1.03)' : 'scale(1)', transition: 'transform 0.18s, box-shadow 0.18s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', lineHeight: 0,
      }}>
        {visible ? (
          useFallback && pdfFile ? (
            // react-pdf fallback when tile server unavailable
            <Document file={pdfFile} loading={<CircularProgress size={24} />} error={null}>
              <Page pageNumber={pageNum} width={130} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>
          ) : thumbnailUrl ? (
            <>
              {!imgLoaded && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.50' }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              <img
                src={thumbnailUrl}
                alt={`Page ${pageNum}`}
                style={{ width: '100%', height: 'auto', display: imgLoaded ? 'block' : 'none' }}
                onLoad={() => setImgLoaded(true)}
                onError={handleError}
              />
            </>
          ) : (
            <Box sx={{ width: 130, height: 90, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          )
        ) : (
          <Box sx={{ width: 130, height: 90, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
      <Typography sx={{
        fontSize: '0.85rem', fontWeight: 500, wordBreak: 'break-word', lineHeight: 1.3,
        color: isActive ? gold : 'text.secondary', textAlign: 'center', width: '100%', px: 0.25,
      }}>
        {label}
      </Typography>
    </Box>
  );
});

const PdfSidebar = memo(function PdfSidebar({
  open, tab, onTabChange,
  markups, selectedMarkupIds, onMarkupSelect, onMarkupOpen, onDeleteMarkup,
  hiddenLayers = [], onToggleLayer,
  searchResults = [], isSearching = false, searchProgress = 0, onSearch, onResetSearch, jumpToPage,
  searchKeyword: externalSearchKeyword, onSearchKeywordChange,
  searchScope = 'document', onSearchScopeChange,
  activeSearchResultIndex, onSearchResultSelect, onHighlightAll,
  numPages = 0, bookmarks = [], onJumpToBookmark, documentId, token, pdfData,
  currentPage = 1, pageLabels = [],
  currentUserId, isAdmin = false,
  onBulkUpdateProperty,
  pdfLayers = [],
  onTogglePdfLayer,
}: PdfSidebarProps) {
  const [localSearchKeyword, setLocalSearchKeyword] = useState('');
  const [highlightAllColor, setHighlightAllColor] = useState('#ffff00');
  const [searchGroupBy, setSearchGroupBy] = useState<'none' | 'page'>('none');
  const [searchFilterType, setSearchFilterType] = useState<'all' | 'text' | 'markup'>('all');
  const [searchSortBy, setSearchSortBy] = useState<'found' | 'page'>('found');
  
  const searchKeyword = externalSearchKeyword !== undefined ? externalSearchKeyword : localSearchKeyword;
  const setSearchKeyword = (val: string) => { if (onSearchKeywordChange) onSearchKeywordChange(val); else setLocalSearchKeyword(val); };
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;
  const inputSx = { width: '100%', padding: '7px 10px', borderRadius: '6px', border: `1px solid ${theme.palette.divider}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', color: theme.palette.text.primary, fontSize: '0.88rem', outline: 'none', transition: 'border-color 0.15s' };

  // MUI Select style matching MarkupTable's selectSx (divider border, 30px height, 0.82rem)
  const searchSelectSx = {
    height: 30, fontSize: '0.82rem',
    '.MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(gold, 0.5) },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: gold },
    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    '& .MuiSelect-select': { py: '5px !important', fontSize: '0.82rem', pr: '26px !important' },
    '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
  };
  const searchMenuProps = {
    PaperProps: {
      sx: {
        bgcolor: 'background.paper', border: 1, borderColor: 'divider',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        '& .MuiMenuItem-root': { fontSize: '0.82rem', py: 0.5, borderRadius: '3px', mx: 0.3, '&:hover': { bgcolor: alpha(gold, 0.08) } },
      },
    },
  };

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const currentWidth = isMobile ? '100%' : SIDEBAR_WIDTH;

  if (!open) return null;

  return (
    <Box sx={{ width: currentWidth, minWidth: isMobile ? '100%' : SIDEBAR_WIDTH, borderRight: isMobile ? 0 : 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', zIndex: 50, position: isMobile ? 'absolute' : 'relative', height: '100%', boxShadow: isMobile ? '4px 0 15px rgba(0,0,0,0.1)' : 'none' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => onTabChange(v)} variant="fullWidth" sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, minWidth: 0, py: 0.5, transition: 'color 0.12s' }, '& .Mui-selected': { color: `${gold} !important` }, '& .MuiTabs-indicator': { backgroundColor: gold, height: 2 } }}>
          <Tab icon={<Tooltip title={t('pages', 'Pages')}><ViewQuiltIcon sx={{ fontSize: 16 }} /></Tooltip>} />
          <Tab icon={<Tooltip title={t('bookmarks', 'Bookmarks')}><BookmarkIcon sx={{ fontSize: 16 }} /></Tooltip>} />
          <Tab icon={<Tooltip title={t('markups', 'Markups')}><DrawIcon sx={{ fontSize: 16 }} /></Tooltip>} />
          <Tab icon={<Tooltip title={t('layers', 'Layers')}><LayersIcon sx={{ fontSize: 16 }} /></Tooltip>} />
          <Tab icon={<Tooltip title={t('search', 'Search')}><SearchIcon sx={{ fontSize: 16 }} /></Tooltip>} />
        </Tabs>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: tab === 2 ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', ...getScrollbarSx(theme) }}>
        {tab === 0 && (
          <Box sx={{ p: 0 }}>
            {documentId && token ? (
              <Box>
                {(() => {
                  // Build a sequential list of leaf bookmark titles as a fallback
                  // when pageLabels hasn't been resolved yet (e.g. pdfjs still loading).
                  // Only leaf nodes (no children) are real sheet names like "A101".
                  // Parent containers like "Sheets" are skipped entirely.
                  const leafTitles: string[] = [];
                  const collectLeaves = (items: any[]) => {
                    for (const item of items) {
                      if (item.items?.length) { collectLeaves(item.items); }
                      else if (item.title) { leafTitles.push(item.title); }
                    }
                  };
                  if (bookmarks?.length) collectLeaves(bookmarks);

                  return Array.from(new Array(numPages), (_, i) => {
                    const pageNum = i + 1, isActive = currentPage === pageNum;
                    const rawLabel = pageLabels[i];
                    // Priority:
                    // 1) pageLabels[i] — resolved by pdfjs outline (most accurate, set async)
                    // 2) leafTitles[i]  — sequential leaf bookmark names as fast fallback
                    // 3) "Page N"       — last resort
                    let label: string;
                    if (rawLabel && rawLabel !== String(pageNum) && rawLabel.trim() !== '') {
                      label = rawLabel;
                    } else if (leafTitles[i]) {
                      label = leafTitles[i];
                    } else {
                      label = `Page ${pageNum}`;
                    }
                    return <LazyPageThumbnail key={i} pageNum={pageNum} isActive={isActive} gold={gold} jumpToPage={jumpToPage} label={label} documentId={documentId} token={token} pdfFileUrl={pdfData} />;
                  });
                })()}
              </Box>
            ) : <Box display="flex" justifyContent="center" p={4}><CircularProgress size={24} /></Box>}
          </Box>
        )}

        {tab === 1 && (
          <List>
            {bookmarks.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>{t('noBookmarks', 'No bookmarks found.')}</Typography> : bookmarks.map((item, i) => <BookmarkItem key={i} item={item} onJump={(dest) => onJumpToBookmark?.(dest)} currentPage={currentPage || 1} pageLabels={pageLabels || []} />)}
          </List>
        )}

        {tab === 2 && (
          <MarkupTable
            markups={markups}
            selectedMarkupIds={selectedMarkupIds}
            onMarkupSelect={onMarkupSelect}
            onMarkupOpen={onMarkupOpen}
            onDeleteMarkup={onDeleteMarkup}
            hiddenLayers={hiddenLayers}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onBulkUpdateProperty={onBulkUpdateProperty}
          />
        )}

        {tab === 3 && (
          <Box sx={{ p: 1.5 }}>
            {/* PDF OCG Layers (from overlay/comparison PDFs or Bluebeam) */}
            {pdfLayers.length > 0 && (
              <>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: gold, mb: 1 }}>
                  PDF Layers
                </Typography>
                <List sx={{ mb: 1.5 }}>
                  {pdfLayers.map(layer => (
                    <ListItemButton key={layer.name} onClick={() => onTogglePdfLayer?.(layer.name)}
                      sx={{ borderRadius: 1, mb: 0.5, py: 0.5, bgcolor: layer.visible ? alpha(gold, 0.08) : 'transparent', justifyContent: 'space-between', '&:hover': { bgcolor: layer.visible ? alpha(gold, 0.15) : theme.palette.action.hover } }}>
                      <ListItemText primary={layer.name}
                        primaryTypographyProps={{ fontSize: '0.85rem', color: layer.visible ? 'text.primary' : 'text.disabled', fontWeight: layer.visible ? 600 : 400 }} />
                      <ListItemIcon sx={{ minWidth: 0 }}>
                        {layer.visible ? <VisibilityIcon sx={{ fontSize: 18, color: gold }} /> : <VisibilityOffIcon sx={{ fontSize: 18, opacity: 0.4 }} />}
                      </ListItemIcon>
                    </ListItemButton>
                  ))}
                </List>
                <Divider sx={{ mb: 1.5 }} />
              </>
            )}

            {/* Markup Layers */}
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 1 }}>
              {t('markupLayers', 'Markup Layers')}
            </Typography>
            <List>
              {Array.from(new Set((markups || []).map(m => m.type))).map((type: any) => {
                const isHidden = hiddenLayers.includes(type);
                return (
                  <ListItemButton key={type} onClick={() => onToggleLayer?.(type)} sx={{ borderRadius: 1, mb: 0.5, py: 0.5, bgcolor: isHidden ? 'transparent' : alpha(gold, 0.08), justifyContent: 'space-between', '&:hover': { bgcolor: isHidden ? theme.palette.action.hover : alpha(gold, 0.15) } }}>
                    <ListItemText primary={type} primaryTypographyProps={{ fontSize: '0.85rem', color: isHidden ? 'text.secondary' : 'text.primary', fontWeight: isHidden ? 400 : 600 }} />
                    <ListItemIcon sx={{ minWidth: 0 }}>{isHidden ? <VisibilityOffIcon sx={{ fontSize: 18, opacity: 0.5 }} /> : <VisibilityIcon sx={{ fontSize: 18, color: gold }} />}</ListItemIcon>
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        )}

        {tab === 4 && (() => {
          // Group search results by page for collapsible display
          const groupByPage = searchGroupBy === 'page';
          const sortedResults = searchSortBy === 'page'
            ? [...searchResults].sort((a, b) => a.pageIndex - b.pageIndex)
            : searchResults; // default = order found
          const pageGroups = groupByPage
            ? sortedResults.reduce((acc, res, origIdx) => {
                // Find the REAL index in original searchResults for navigation
                const realIdx = searchResults.indexOf(res);
                const pg = res.pageIndex;
                if (!acc.has(pg)) acc.set(pg, []);
                acc.get(pg)!.push({ ...res, _realIdx: realIdx });
                return acc;
              }, new Map<number, any[]>())
            : null;

          // Filter by type
          const filteredResults = searchFilterType === 'all'
            ? sortedResults
            : searchFilterType === 'text'
            ? sortedResults.filter(r => !(r as any).markupId)
            : sortedResults.filter(r => !!(r as any).markupId);

          const filteredGroups = groupByPage && pageGroups
            ? new Map([...pageGroups].filter(([, items]) =>
                items.some(r => searchFilterType === 'all' || (searchFilterType === 'text' ? !r.markupId : !!r.markupId))
              ).map(([pg, items]) => [pg, items.filter(r =>
                searchFilterType === 'all' || (searchFilterType === 'text' ? !r.markupId : !!r.markupId)
              )]))
            : null;

          const activeIdx = activeSearchResultIndex ?? -1;
          const navResults = searchFilterType === 'all' ? sortedResults : filteredResults;
          const navRealIndices = navResults.map(r => searchResults.indexOf(r));

          const goNext = () => {
            const curPos = navRealIndices.indexOf(activeIdx);
            const next = curPos < navRealIndices.length - 1 ? navRealIndices[curPos + 1] : navRealIndices[0];
            onSearchResultSelect?.(next);
          };
          const goPrev = () => {
            const curPos = navRealIndices.indexOf(activeIdx);
            const prev = curPos > 0 ? navRealIndices[curPos - 1] : navRealIndices[navRealIndices.length - 1];
            onSearchResultSelect?.(prev);
          };
          const activePos = navRealIndices.indexOf(activeIdx);

          return (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Search input */}
            <Box sx={{ p: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <RadioGroup row value={searchScope} onChange={(e) => onSearchScopeChange?.(e.target.value as any)} sx={{ justifyContent: 'center', bgcolor: alpha(gold, 0.05), borderRadius: '8px', p: 0.5 }}>
                <FormControlLabel value="document" control={<Radio size="small" sx={{ color: gold, '&.Mui-checked': { color: gold }, p: 0.5 }} />} label={<Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{t('allPages', 'ALL SHEETS')}</Typography>} />
                <FormControlLabel value="page" control={<Radio size="small" sx={{ color: gold, '&.Mui-checked': { color: gold }, p: 0.5 }} />} label={<Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{t('currentPage', 'CURRENT')}</Typography>} />
              </RadioGroup>
              <Box sx={{ position: 'relative', display: 'flex', gap: 1 }}>
                <input placeholder={t('searchDocument', 'Search document...')} value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSearch?.(searchKeyword); }} style={{ ...inputSx, paddingRight: '30px' }} />
                {searchKeyword && <IconButton size="small" onClick={onResetSearch} sx={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}><ClearIcon sx={{ fontSize: 14 }} /></IconButton>}
                <IconButton onClick={() => onSearch?.(searchKeyword)} size="small" sx={{ bgcolor: alpha(gold, 0.1), color: gold, '&:hover': { bgcolor: alpha(gold, 0.2) } }}><SearchIcon fontSize="small" /></IconButton>
              </Box>
              {isSearching && <Box><LinearProgress variant="determinate" value={searchProgress} /><Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", textAlign: "center" }}>{t('searching', 'Searching...')} {searchProgress}%</Typography></Box>}
            </Box>

            {/* Results toolbar: count + prev/next + group/sort/filter + highlight */}
            {searchResults.length > 0 && !isSearching && (
              <Box sx={{ px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {/* Row 1: count + prev/next arrows */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 500, flex: 1 }}>
                    {activePos >= 0 ? `${activePos + 1} / ` : ''}{navResults.length} result{navResults.length !== 1 ? 's' : ''}
                  </Typography>
                  <IconButton size="small" onClick={goPrev} sx={{ p: 0.3, color: 'text.secondary' }}>
                    <Box component="span" sx={{ fontSize: '0.9rem', lineHeight: 1 }}>▲</Box>
                  </IconButton>
                  <IconButton size="small" onClick={goNext} sx={{ p: 0.3, color: 'text.secondary' }}>
                    <Box component="span" sx={{ fontSize: '0.9rem', lineHeight: 1 }}>▼</Box>
                  </IconButton>
                  <Tooltip title="Pick highlight color">
                    <Box sx={{ position: 'relative', width: 18, height: 18, flexShrink: 0 }}>
                      <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: highlightAllColor, border: '2px solid', borderColor: 'divider', cursor: 'pointer' }} />
                      <input type="color" value={highlightAllColor} onChange={e => setHighlightAllColor(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    </Box>
                  </Tooltip>
                  <Box component="button" onClick={() => onHighlightAll?.(highlightAllColor)}
                    sx={{ fontSize: '0.68rem', fontWeight: 700, px: 0.75, py: 0.4, bgcolor: alpha(gold, 0.15), color: gold, border: '1px solid', borderColor: alpha(gold, 0.3), borderRadius: '4px', cursor: 'pointer', '&:hover': { bgcolor: alpha(gold, 0.25) } }}>
                    HIGHLIGHT
                  </Box>
                </Box>
                {/* Row 2: group + filter + sort — MUI Selects matching Markups style */}
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  <Select size="small" value={searchGroupBy} onChange={e => setSearchGroupBy(e.target.value as any)}
                    sx={{ ...searchSelectSx, flex: 1, minWidth: 0 }} MenuProps={searchMenuProps}>
                    <MenuItem value="none">No grouping</MenuItem>
                    <MenuItem value="page">By page</MenuItem>
                  </Select>
                  <Select size="small" value={searchFilterType} onChange={e => setSearchFilterType(e.target.value as any)}
                    sx={{ ...searchSelectSx, flex: 1, minWidth: 0 }} MenuProps={searchMenuProps}>
                    <MenuItem value="all">All types</MenuItem>
                    <MenuItem value="text">Text only</MenuItem>
                    <MenuItem value="markup">Markups</MenuItem>
                  </Select>
                  <Select size="small" value={searchSortBy} onChange={e => setSearchSortBy(e.target.value as any)}
                    sx={{ ...searchSelectSx, flex: 1, minWidth: 0 }} MenuProps={searchMenuProps}>
                    <MenuItem value="found">Found order</MenuItem>
                    <MenuItem value="page">By page</MenuItem>
                  </Select>
                </Box>
              </Box>
            )}

            {/* Results list — grouped or flat */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', ...getScrollbarSx(theme) }}>
              {groupByPage && filteredGroups ? (
                [...filteredGroups].map(([pageIdx, items]) => (
                  <Box key={pageIdx}>
                    <Box sx={{ px: 1.5, py: '5px', bgcolor: isDark ? alpha(gold, 0.07) : alpha(gold, 0.05), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: gold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {pageLabels?.[pageIdx] || `Page ${pageIdx + 1}`}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{items.length}</Typography>
                    </Box>
                    {items.map((res: any) => {
                      const realIdx = res._realIdx;
                      const isSelected = activeSearchResultIndex === realIdx;
                      const isMarkup = !!res.markupId;
                      return (
                        <Box key={realIdx} onClick={() => onSearchResultSelect?.(realIdx)}
                          sx={{ px: 1.5, py: 0.75, cursor: 'pointer', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                            bgcolor: isSelected ? alpha(gold, 0.12) : 'transparent',
                            '&:hover': { bgcolor: isSelected ? alpha(gold, 0.18) : 'rgba(255,255,255,0.03)' } }}>
                          {isMarkup && <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'secondary.main', mb: 0.3 }}>MARKUP</Typography>}
                          <Typography sx={{ fontSize: '0.82rem', wordBreak: 'break-word', color: isSelected ? 'text.primary' : 'text.secondary', lineHeight: 1.4 }}>
                            {res.before}<span style={{ backgroundColor: 'rgba(66,133,244,0.3)', fontWeight: 600, padding: '0 2px', borderRadius: 2, textDecoration: 'underline', textDecorationColor: 'rgba(66,133,244,0.8)' }}>{searchKeyword}</span>{res.after}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                ))
              ) : (
                (searchFilterType === 'all' ? sortedResults : filteredResults).map((res, i) => {
                  const realIdx = searchResults.indexOf(res);
                  const isSelected = activeSearchResultIndex === realIdx;
                  const isMarkup = !!(res as any).markupId;
                  return (
                    <Box key={realIdx} onClick={() => onSearchResultSelect?.(realIdx)}
                      sx={{ px: 1.5, py: 0.75, cursor: 'pointer', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                        bgcolor: isSelected ? alpha(gold, 0.12) : 'transparent',
                        '&:hover': { bgcolor: isSelected ? alpha(gold, 0.18) : 'rgba(255,255,255,0.03)' } }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: isMarkup ? 'secondary.main' : gold, mb: 0.3 }}>
                        {isMarkup ? 'MARKUP' : `PAGE ${res.pageIndex + 1}`}
                      </Typography>
                      <Typography sx={{ fontSize: '0.82rem', wordBreak: 'break-word', color: isSelected ? 'text.primary' : 'text.secondary', lineHeight: 1.4 }}>
                        {res.before}<span style={{ backgroundColor: 'rgba(66,133,244,0.3)', fontWeight: 600, padding: '0 2px', borderRadius: 2, textDecoration: 'underline', textDecorationColor: 'rgba(66,133,244,0.8)' }}>{searchKeyword}</span>{res.after}
                      </Typography>
                    </Box>
                  );
                })
              )}
              {!isSearching && searchResults.length === 0 && searchKeyword && <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>{t('noResults', 'No results found.')}</Typography>}
            </Box>
          </Box>
          );
        })()}
      </Box>
    </Box>
  );
});

export default PdfSidebar;
