import { memo, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Box, Tabs, Tab, useTheme, alpha, IconButton, Tooltip,
  LinearProgress, List, ListItemButton, ListItemText, Chip, Button,
  Typography, CircularProgress, ListItemIcon, RadioGroup, FormControlLabel, Radio, Select, MenuItem, Collapse, useMediaQuery
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DrawIcon from '@mui/icons-material/Draw';
import SearchIcon from '@mui/icons-material/Search';
import LayersIcon from '@mui/icons-material/Layers';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useTranslation } from 'react-i18next';
import MarkupListItem, { STATUS_COLORS, STATUS_LABELS } from './MarkupListItem';
import { Page, Document } from 'react-pdf';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);

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
  currentPage?: number;
  pageLabels?: string[];
  currentUserId?: string;
  isAdmin?: boolean;
  onBulkUpdateProperty?: (ids: string[], key: string, value: any) => void;
}

const BookmarkItem = ({ item, onJump, isActive, currentPage }: { item: any, onJump: (dest: any) => void, isActive: boolean, currentPage: number }) => {
  const [open, setOpen] = useState(true);
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const hasChildren = item.items && item.items.length > 0;

  return (
    <>
      <ListItemButton 
        onClick={() => { if (hasChildren) setOpen(!open); onJump(item.dest); }}
        sx={{ pl: (item.level || 0) * 2 + 1.5, bgcolor: isActive ? alpha(gold, 0.1) : 'transparent', '&:hover': { bgcolor: isActive ? alpha(gold, 0.15) : alpha(gold, 0.05) }, alignItems: 'flex-start' }}
      >
        <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: isActive || hasChildren ? 600 : 400, color: isActive ? gold : 'text.primary', sx: { wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.35, overflowWrap: 'anywhere' } }} />
      </ListItemButton>
      {open && hasChildren && item.items.map((sub: any, i: number) => (
        <BookmarkItem key={i} item={{ ...sub, level: (item.level || 0) + 1 }} onJump={onJump} isActive={isActive} currentPage={currentPage} />
      ))}
    </>
  );
};

// Lazy-rendered page thumbnail — only renders <Page> when near the viewport
const LazyPageThumbnail = memo(({ pageNum, isActive, gold, jumpToPage, label }: { pageNum: number; isActive: boolean; gold: string; jumpToPage?: (p: number) => void; label: string }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <Box ref={ref} onClick={() => jumpToPage?.(pageNum)}
      sx={{ py: 2, px: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer',
        bgcolor: isActive ? alpha(gold, 0.12) : 'transparent',
        borderBottom: '1px solid rgba(0,0,0,0.04)',
        '&:hover': { bgcolor: isActive ? alpha(gold, 0.18) : alpha(gold, 0.04) },
        transition: 'background-color 0.15s' }}
    >
      <Box sx={{ width: 140, border: 1, borderColor: isActive ? gold : 'divider', borderRadius: 0.5, overflow: 'hidden', bgcolor: 'white',
        boxShadow: isActive ? `0 0 15px ${alpha(gold, 0.4)}` : '0 2px 8px rgba(0,0,0,0.05)',
        transform: isActive ? 'scale(1.02)' : 'scale(1)', transition: 'transform 0.2s', lineHeight: 0 }}>
        {visible
          ? <Page pageNumber={pageNum} width={140} renderTextLayer={false} renderAnnotationLayer={false} loading={<Box sx={{ width: 140, height: 100, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={16} /></Box>} />
          : <Box sx={{ width: 140, height: 100, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={16} /></Box>
        }
      </Box>
      <Box sx={{ width: '100%', textAlign: 'center', px: 0.5 }}>
        <Typography variant="body2" sx={{ fontSize: '0.72rem', fontWeight: isActive ? 700 : 500, wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.3, color: isActive ? gold : 'text.primary', mt: 0.5 }}>{label}</Typography>
      </Box>
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
  numPages = 0, bookmarks = [], onJumpToBookmark, pdfData,
  currentPage = 1, pageLabels = [],
  currentUserId, isAdmin = false,
  onBulkUpdateProperty,
}: PdfSidebarProps) {
  const [localSearchKeyword, setLocalSearchKeyword] = useState('');
  const [highlightAllColor, setHighlightAllColor] = useState('#ffff00');
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [expandedAuthors, setFilterExpandedAuthors] = useState<string[]>([]);
  const [expandedDates, setFilterExpandedDates] = useState<string[]>([]);
  
  const searchKeyword = externalSearchKeyword !== undefined ? externalSearchKeyword : localSearchKeyword;
  const setSearchKeyword = (val: string) => { if (onSearchKeywordChange) onSearchKeywordChange(val); else setLocalSearchKeyword(val); };
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;
  const [filterText, setFilterText] = useState('');
  const [filterType] = useState('all');

  // Cache createdAt → YYYY-MM-DD to avoid re-parsing immutable dates on every useMemo
  const dateParseCache = useRef<Map<string, string>>(new Map());
  const parseDateKey = (createdAt: string): string => {
    if (dateParseCache.current.has(createdAt)) return dateParseCache.current.get(createdAt)!;
    const d = dayjs(createdAt);
    const result = d.isValid() ? d.format('YYYY-MM-DD') : 'Unknown Date';
    dateParseCache.current.set(createdAt, result);
    return result;
  };

  const filteredMarkups = useMemo(() => {
    let result = (markups || []).filter(m => m.type !== 'auto-highlight' && !hiddenLayers.includes(m.type));
    if (filterType !== 'all') result = result.filter(m => m.type === filterType);
    if (filterAuthor !== 'all') result = result.filter(m => m.authorId === filterAuthor);
    if (filterStatus !== 'all') result = result.filter(m => (m.properties?.status || 'open') === filterStatus);
    if (filterDateFrom) result = result.filter(m => m.createdAt && new Date(m.createdAt) >= new Date(filterDateFrom));
    if (filterDateTo) result = result.filter(m => m.createdAt && new Date(m.createdAt) <= new Date(filterDateTo + 'T23:59:59'));
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter((m: any) => m.type.toLowerCase().includes(lower) || (m.properties?.subject || '').toLowerCase().includes(lower) || (m.properties?.comment || '').toLowerCase().includes(lower));
    }
    return result;
  }, [markups, filterText, filterType, filterAuthor, filterStatus, filterDateFrom, filterDateTo, hiddenLayers]);

  const groupedMarkups = useMemo(() => {
    const map = new Map<string, any>();
    filteredMarkups.forEach(m => {
      const authorId = m.authorId || 'unknown';
      const authorName = m.author?.name || m.author?.email || 'Unknown';
      const date = parseDateKey(m.createdAt);

      if (!map.has(authorId)) map.set(authorId, { id: authorId, name: authorName, dates: new Map<string, any[]>() });
      const authorData = map.get(authorId);
      if (!authorData.dates.has(date)) authorData.dates.set(date, []);
      authorData.dates.get(date)!.push(m);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredMarkups]);

  const formatGroupDate = (dateStr: string) => {
    if (dateStr === 'Unknown Date') return dateStr;
    const d = dayjs(dateStr);
    if (d.isToday()) return t('today', 'Today');
    if (d.isYesterday()) return t('yesterday', 'Yesterday');
    return d.format('DD MMM YYYY');
  };

  // Auto-expand only NEW (never-seen) groups — don't re-expand collapsed groups on delete/update
  const seenAuthorsRef = useRef<Set<string>>(new Set());
  const seenDateKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (groupedMarkups.length === 0) return;
    const newAuthors = groupedMarkups.filter(a => !seenAuthorsRef.current.has(a.id));
    if (newAuthors.length > 0) {
      newAuthors.forEach(a => seenAuthorsRef.current.add(a.id));
      setFilterExpandedAuthors(prev => [...prev, ...newAuthors.map(a => a.id).filter(id => !prev.includes(id))]);
    }
    const newDateKeys: string[] = [];
    groupedMarkups.forEach(a => {
      Array.from(a.dates.keys()).forEach((d: any) => {
        const key = `${a.id}-${d}`;
        if (!seenDateKeysRef.current.has(key)) {
          seenDateKeysRef.current.add(key);
          newDateKeys.push(key);
        }
      });
    });
    if (newDateKeys.length > 0) {
      setFilterExpandedDates(prev => [...prev, ...newDateKeys.filter(k => !prev.includes(k))]);
    }
  }, [groupedMarkups]);

  const toggleAuthor = (id: string) => setFilterExpandedAuthors(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleDate = (id: string) => setFilterExpandedDates(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const authors = useMemo(() => {
    const set = new Map();
    (markups || []).forEach(m => { if (m.authorId) set.set(m.authorId, m.author?.name || m.author?.email || 'Unknown'); });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [markups]);

  const handleExportCsv = () => {
    const headers = ['Type', 'Subject', 'Comment', 'Author', 'Page', 'Status', 'Created'];
    const rows = filteredMarkups.map(m => [
      m.type,
      m.properties?.subject || '',
      m.properties?.comment || '',
      m.author?.name || m.author?.email || '',
      (m.pageNumber || 0) + 1,
      m.properties?.status || 'open',
      m.createdAt ? dayjs(m.createdAt).format('YYYY-MM-DD HH:mm') : '',
    ]);
    const csv = [headers, ...rows].map(row => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'markups.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const inputSx = { width: '100%', padding: '7px 10px', borderRadius: '6px', border: `1px solid ${theme.palette.divider}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', color: theme.palette.text.primary, fontSize: '0.78rem', outline: 'none', transition: 'border-color 0.15s' };
  const selectSx = {
    height: 32, fontSize: '0.75rem', width: '100%',
    '.MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(gold, 0.5) },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: gold },
    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    color: theme.palette.text.primary,
    '& .MuiSelect-select': { color: theme.palette.text.primary },
  };

  // Themed menu props for all dropdowns — prevents white-on-white in dark/light
  const styledMenuProps = {
    PaperProps: {
      sx: {
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        '& .MuiMenuItem-root': {
          fontSize: '0.75rem', borderRadius: '4px', mx: 0.5, my: 0.25,
          color: 'text.primary',
          '&:hover': { bgcolor: alpha(gold, 0.08) },
          '&.Mui-selected': { bgcolor: alpha(gold, 0.12), color: gold, fontWeight: 600 }
        }
      }
    }
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

      <Box sx={{ flexGrow: 1, overflowY: 'auto', ...getScrollbarSx(theme) }}>
        {tab === 0 && (
          <Box sx={{ p: 0 }}>
            {pdfData ? (
              <Document file={pdfData}>
                {Array.from(new Array(numPages), (_, i) => {
                  const pageNum = i + 1, isActive = currentPage === pageNum, label = pageLabels[i] || `Sheet ${pageNum}`;
                  return <LazyPageThumbnail key={i} pageNum={pageNum} isActive={isActive} gold={gold} jumpToPage={jumpToPage} label={label} />;
                })}
              </Document>
            ) : <Box display="flex" justifyContent="center" p={4}><CircularProgress size={24} /></Box>}
          </Box>
        )}

        {tab === 1 && (
          <List>
            {bookmarks.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>{t('noBookmarks', 'No bookmarks found.')}</Typography> : bookmarks.map((item, i) => <BookmarkItem key={i} item={item} onJump={(dest) => onJumpToBookmark?.(dest)} isActive={false} currentPage={currentPage} />)}
          </List>
        )}

        {tab === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Select size="small" value={filterAuthor} onChange={(e) => setFilterAuthor(e.target.value)} sx={{ ...selectSx, flex: 1 }} MenuProps={styledMenuProps}>
                  <MenuItem value="all" sx={{ fontSize: '0.75rem' }}>{t('allAuthors', 'All Users')}</MenuItem>
                  {authors.map(a => <MenuItem key={a.id} value={a.id} sx={{ fontSize: '0.75rem' }}>{a.name}</MenuItem>)}
                </Select>
                <Tooltip title={t('batchSelect', 'Batch select')}>
                  <IconButton size="small" onClick={() => { setBatchMode(b => !b); if (batchMode) onMarkupSelect([]); }}
                    sx={{ flexShrink: 0, borderRadius: '6px', bgcolor: batchMode ? alpha(gold, 0.15) : 'transparent', color: batchMode ? gold : 'text.secondary', '&:hover': { bgcolor: alpha(gold, 0.08), color: gold } }}>
                    <CheckBoxOutlineBlankIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('exportCsv', 'Export CSV')}>
                  <IconButton size="small" onClick={handleExportCsv} sx={{ flexShrink: 0, borderRadius: '6px', color: 'text.secondary', '&:hover': { bgcolor: alpha(gold, 0.08), color: gold } }}>
                    <FileDownloadIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Select size="small" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} sx={selectSx} MenuProps={styledMenuProps}
                renderValue={(val) => val === 'all' ? <span style={{ fontSize: '0.75rem' }}>{t('allStatuses', 'All Statuses')}</span> : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[val as string] }} />
                    <span style={{ fontSize: '0.75rem' }}>{STATUS_LABELS[val as string]}</span>
                  </Box>
                )}
              >
                <MenuItem value="all" sx={{ fontSize: '0.75rem' }}>{t('allStatuses', 'All Statuses')}</MenuItem>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key} sx={{ fontSize: '0.75rem' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[key] }} />
                      {label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              <input placeholder={t('filterMarkups', 'Filter markups...')} value={filterText} onChange={(e) => setFilterText(e.target.value)} style={inputSx} />
              {/* Date range toggle + inputs */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box component="button" onClick={() => setShowDateFilter(s => !s)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.62rem', fontWeight: 600, color: (filterDateFrom || filterDateTo) ? gold : 'text.secondary', border: 'none', background: 'none', cursor: 'pointer', p: 0, '&:hover': { color: gold } }}>
                  <CalendarTodayIcon sx={{ fontSize: 11 }} />
                  {(filterDateFrom || filterDateTo) ? `${filterDateFrom || '…'} — ${filterDateTo || '…'}` : t('dateRange', 'Date range')}
                </Box>
                {(filterDateFrom || filterDateTo) && (
                  <IconButton size="small" sx={{ p: 0.2, opacity: 0.5 }} onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}>
                    <ClearIcon sx={{ fontSize: 11 }} />
                  </IconButton>
                )}
              </Box>
              {showDateFilter && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                    style={{ ...inputSx, flex: 1, fontSize: '0.65rem', padding: '5px 6px' }} />
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                    style={{ ...inputSx, flex: 1, fontSize: '0.65rem', padding: '5px 6px' }} />
                </Box>
              )}
            </Box>
            <List sx={{ flexGrow: 1, ...getScrollbarSx(theme) }}>
              {groupedMarkups.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>{t('noMarkups', 'No markups found.')}</Typography> : groupedMarkups.map(author => (
                <Box key={author.id}>
                  <ListItemButton onClick={() => toggleAuthor(author.id)} sx={{ bgcolor: 'action.hover' }}>
                    <ListItemIcon sx={{ minWidth: 24 }}>{expandedAuthors.includes(author.id) ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}</ListItemIcon>
                    <PersonIcon sx={{ fontSize: 14, mr: 1, color: gold }} />
                    <ListItemText primary={author.name} primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 700 }} />
                    {isAdmin && <IconButton size="small" onClick={(e) => { e.stopPropagation(); if(onDeleteMarkup) onDeleteMarkup(Array.from(author.dates.values()).flat().map((m: any) => m.id)); }} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>}
                  </ListItemButton>
                  <Collapse in={expandedAuthors.includes(author.id)} timeout="auto">
                    {Array.from(author.dates.entries()).map(([date, items]: any) => (
                      <Box key={date}>
                        <ListItemButton onClick={() => toggleDate(`${author.id}-${date}`)} sx={{ pl: 4, bgcolor: 'action.hover', opacity: 0.9 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}>{expandedDates.includes(`${author.id}-${date}`) ? <ExpandMoreIcon sx={{ fontSize: 14 }} /> : <ChevronRightIcon sx={{ fontSize: 14 }} />}</ListItemIcon>
                          <CalendarTodayIcon sx={{ fontSize: 12, mr: 1, opacity: 0.6 }} />
                          <ListItemText primary={formatGroupDate(date)} primaryTypographyProps={{ fontSize: '0.7rem', fontWeight: 600 }} />
                          <Typography variant="caption" sx={{ opacity: 0.5, mr: 1 }}>{items.length}</Typography>
                          {isAdmin && <IconButton size="small" onClick={(e) => { e.stopPropagation(); if(onDeleteMarkup) onDeleteMarkup(items.map((m: any) => m.id)); }} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>}
                        </ListItemButton>
                        <Collapse in={expandedDates.includes(`${author.id}-${date}`)} timeout="auto">
                          <Box sx={{ pl: 2 }}>{items.map((m: any) => {
  const canDelete = isAdmin || (currentUserId != null && m.authorId === currentUserId);
  const isChecked = selectedMarkupIds.includes(m.id);
  const handleSelect = () => {
    if (batchMode) {
      // Toggle in/out of multi-selection
      const next = isChecked ? selectedMarkupIds.filter(id => id !== m.id) : [...selectedMarkupIds, m.id];
      onMarkupSelect(next);
    } else {
      onMarkupSelect([m.id]);
    }
  };
  return <MarkupListItem key={m.id} markup={m} selected={isChecked} onSelect={handleSelect} onOpen={() => !batchMode && onMarkupOpen?.([m.id])} onDelete={() => onDeleteMarkup?.(m.id)} canDelete={canDelete} batchMode={batchMode} />;
})}</Box>
                        </Collapse>
                      </Box>
                    ))}
                  </Collapse>
                </Box>
              ))}
            </List>
            {/* Bulk action bar — shows when in batch mode with items selected */}
            {batchMode && selectedMarkupIds.length > 0 && (
              <Box sx={{ borderTop: 1, borderColor: 'divider', p: 1.5, bgcolor: alpha(gold, 0.05), display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Chip label={`${selectedMarkupIds.length} selected`} size="small" sx={{ fontSize: '0.65rem', height: 20, bgcolor: alpha(gold, 0.15), color: gold, fontWeight: 700 }} />
                  <Button size="small" sx={{ fontSize: '0.62rem', color: 'text.secondary', textTransform: 'none', minWidth: 0, p: 0.5 }}
                    onClick={() => onMarkupSelect([])}>
                    {t('clearSelection', 'Clear')}
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <Chip key={key} label={label} size="small" clickable
                      sx={{ fontSize: '0.6rem', height: 20, border: `1px solid ${STATUS_COLORS[key]}`, bgcolor: alpha(STATUS_COLORS[key], 0.08), color: STATUS_COLORS[key], fontWeight: 600, '&:hover': { bgcolor: alpha(STATUS_COLORS[key], 0.2) } }}
                      onClick={() => onBulkUpdateProperty?.(selectedMarkupIds, 'status', key)}
                    />
                  ))}
                </Box>
                <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontSize: '0.65rem', textTransform: 'none', py: 0.5 }}
                  onClick={() => { onDeleteMarkup?.(selectedMarkupIds); onMarkupSelect([]); setBatchMode(false); }}>
                  {t('deleteSelected', 'Delete selected')} ({selectedMarkupIds.length})
                </Button>
              </Box>
            )}
          </Box>
        )}

        {tab === 3 && (
          <Box sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>{t('markupLayers', 'Markup Layers')}</Typography>
            <List>
              {Array.from(new Set((markups || []).map(m => m.type))).map((type: any) => {
                const isHidden = hiddenLayers.includes(type);
                return (
                  <ListItemButton key={type} onClick={() => onToggleLayer?.(type)} sx={{ borderRadius: 1, mb: 0.5, bgcolor: isHidden ? 'transparent' : alpha(gold, 0.08), justifyContent: 'space-between', '&:hover': { bgcolor: isHidden ? theme.palette.action.hover : alpha(gold, 0.15) } }}>
                    <ListItemText primary={type} primaryTypographyProps={{ fontSize: '0.85rem', color: isHidden ? 'text.secondary' : 'text.primary', fontWeight: isHidden ? 400 : 600 }} />
                    <ListItemIcon sx={{ minWidth: 0 }}>{isHidden ? <VisibilityOffIcon sx={{ fontSize: 18, opacity: 0.5 }} /> : <VisibilityIcon sx={{ fontSize: 18, color: gold }} />}</ListItemIcon>
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        )}

        {tab === 4 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <RadioGroup row value={searchScope} onChange={(e) => onSearchScopeChange?.(e.target.value as any)} sx={{ mb: 1.5, justifyContent: 'center', bgcolor: alpha(gold, 0.05), borderRadius: '8px', p: 0.5 }}>
                <FormControlLabel value="document" control={<Radio size="small" sx={{ color: gold, '&.Mui-checked': { color: gold }, p: 0.5 }} />} label={<Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700 }}>{t('allPages', 'ALL SHEETS')}</Typography>} />
                <FormControlLabel value="page" control={<Radio size="small" sx={{ color: gold, '&.Mui-checked': { color: gold }, p: 0.5 }} />} label={<Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700 }}>{t('currentPage', 'CURRENT')}</Typography>} />
              </RadioGroup>
              <Box sx={{ position: 'relative', display: 'flex', gap: 1 }}>
                <input placeholder={t('searchDocument', 'Search document...')} value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSearch?.(searchKeyword); }} style={{ ...inputSx, paddingRight: '30px' }} />
                {searchKeyword && <IconButton size="small" onClick={onResetSearch} sx={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}><ClearIcon sx={{ fontSize: 14 }} /></IconButton>}
                <IconButton onClick={() => onSearch?.(searchKeyword)} size="small" sx={{ bgcolor: alpha(gold, 0.1), color: gold, '&:hover': { bgcolor: alpha(gold, 0.2) } }}><SearchIcon fontSize="small" /></IconButton>
              </Box>
              {isSearching && <Box sx={{ mt: 2 }}><LinearProgress variant="determinate" value={searchProgress} /><Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", textAlign: "center" }}>{t('searching', 'Searching...')} {searchProgress}%</Typography></Box>}
            </Box>
            {searchResults.length > 0 && !isSearching && (
              <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', flexGrow: 1 }}>
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </Typography>
                <Tooltip title="Pick highlight color">
                  <Box sx={{ position: 'relative', width: 20, height: 20, flexShrink: 0 }}>
                    <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: highlightAllColor, border: '2px solid', borderColor: 'divider', cursor: 'pointer' }} />
                    <input type="color" value={highlightAllColor} onChange={e => setHighlightAllColor(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                  </Box>
                </Tooltip>
                <Box
                  component="button"
                  onClick={() => onHighlightAll?.(highlightAllColor)}
                  sx={{ fontSize: '0.6rem', fontWeight: 700, px: 1, py: 0.5, bgcolor: alpha(gold, 0.15), color: gold, border: '1px solid', borderColor: alpha(gold, 0.3), borderRadius: '4px', cursor: 'pointer', '&:hover': { bgcolor: alpha(gold, 0.25) } }}
                >
                  HIGHLIGHT ALL
                </Box>
              </Box>
            )}
            <List sx={{ flexGrow: 1, ...getScrollbarSx(theme) }}>
              {searchResults.map((res, idx) => {
                const isSelected = activeSearchResultIndex === idx;
                const isMarkup = !!(res as any).markupId;
                return (
                  <ListItemButton key={idx} onClick={() => onSearchResultSelect?.(idx)} sx={{ borderBottom: 1, borderColor: 'divider', flexDirection: 'column', alignItems: 'flex-start', bgcolor: isSelected ? alpha(gold, 0.12) : 'transparent', '&:hover': { bgcolor: isSelected ? alpha(gold, 0.18) : alpha(theme.palette.action.hover, 0.5) } }}>
                    <Typography variant="caption" sx={{ color: isMarkup ? 'secondary.main' : gold, fontWeight: 800, fontSize: '0.6rem', mb: 0.5 }}>{isMarkup ? 'MARKUP' : `PAGE ${res.pageIndex + 1}`}</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.78rem', wordBreak: 'break-word', color: isSelected ? 'text.primary' : 'text.secondary', lineHeight: 1.4 }}>{res.before}<span style={{ backgroundColor: 'rgba(66, 133, 244, 0.3)', fontWeight: 600, padding: '0 2px', borderRadius: '2px', textDecoration: 'underline', textDecorationColor: 'rgba(66, 133, 244, 0.8)' }}>{searchKeyword}</span>{res.after}</Typography>
                  </ListItemButton>
                );
              })}
              {!isSearching && searchResults.length === 0 && searchKeyword && <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>{t('noResults', 'No results found.')}</Typography>}
            </List>
          </Box>
        )}
      </Box>
    </Box>
  );
});

export default PdfSidebar;
