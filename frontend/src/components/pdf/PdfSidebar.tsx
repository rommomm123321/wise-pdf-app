import { memo, useState, useMemo } from 'react';
import {
  Box, Tabs, Tab, useTheme, alpha, IconButton, Tooltip,
  LinearProgress, List, ListItemButton, ListItemText,
  Typography, CircularProgress, ListItemIcon, RadioGroup, FormControlLabel, Radio, Select, MenuItem, Collapse, useMediaQuery
} from '@mui/material';
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
import MarkupListItem from './MarkupListItem';
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
  onDeleteMarkup?: (id: string | string[]) => void;
  hiddenLayers?: string[];
  onToggleLayer?: (type: string) => void;
  searchResults?: { pageIndex: number; text: string; before: string; after: string; matchIndex: number }[];
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
  jumpToPage?: (pageIndex: number) => void;
  numPages?: number;
  bookmarks?: any[];
  onJumpToBookmark?: (dest: any) => void;
  pdfData?: string;
  currentPage?: number;
  pageLabels?: string[];
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
        sx={{ py: 0.8, pl: (item.level || 0) * 2 + 1.5, bgcolor: isActive ? alpha(gold, 0.1) : 'transparent', '&:hover': { bgcolor: isActive ? alpha(gold, 0.15) : alpha(gold, 0.05) }, alignItems: 'flex-start' }}
      >
        <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: isActive || hasChildren ? 600 : 400, color: isActive ? gold : 'text.primary', sx: { wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.3 } }} />
      </ListItemButton>
      {open && hasChildren && item.items.map((sub: any, i: number) => (
        <BookmarkItem key={i} item={{ ...sub, level: (item.level || 0) + 1 }} onJump={onJump} isActive={isActive} currentPage={currentPage} />
      ))}
    </>
  );
};

const PdfSidebar = memo(function PdfSidebar({
  open, tab, onTabChange,
  markups, selectedMarkupIds, onMarkupSelect, onDeleteMarkup,
  hiddenLayers = [], onToggleLayer,
  searchResults = [], isSearching = false, searchProgress = 0, onSearch, onResetSearch, jumpToPage,
  searchKeyword: externalSearchKeyword, onSearchKeywordChange,
  searchScope = 'document', onSearchScopeChange,
  activeSearchResultIndex, onSearchResultSelect,
  numPages = 0, bookmarks = [], onJumpToBookmark, pdfData,
  currentPage = 1, pageLabels = []
}: PdfSidebarProps) {
  const [localSearchKeyword, setLocalSearchKeyword] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('all');
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

  const filteredMarkups = useMemo(() => {
    let result = (markups || []).filter(m => m.type !== 'auto-highlight' && !hiddenLayers.includes(m.type));
    if (filterType !== 'all') result = result.filter(m => m.type === filterType);
    if (filterAuthor !== 'all') result = result.filter(m => m.authorId === filterAuthor);
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter((m: any) => m.type.toLowerCase().includes(lower) || (m.properties?.subject || '').toLowerCase().includes(lower) || (m.properties?.comment || '').toLowerCase().includes(lower));
    }
    return result;
  }, [markups, filterText, filterType, filterAuthor, hiddenLayers]);

  const groupedMarkups = useMemo(() => {
    const map = new Map<string, any>();
    filteredMarkups.forEach(m => {
      const authorId = m.authorId || 'unknown';
      const authorName = m.author?.name || m.author?.email || 'Unknown';
      // FIX INVALID DATE: Use ISO or parse carefully
      const d = dayjs(m.createdAt);
      const date = d.isValid() ? d.format('YYYY-MM-DD') : 'Unknown Date';

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

  const toggleAuthor = (id: string) => setFilterExpandedAuthors(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleDate = (id: string) => setFilterExpandedDates(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const authors = useMemo(() => {
    const set = new Map();
    (markups || []).forEach(m => { if (m.authorId) set.set(m.authorId, m.author?.name || m.author?.email || 'Unknown'); });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [markups]);

  const inputSx = { width: '100%', padding: '7px 10px', borderRadius: '6px', border: `1px solid ${theme.palette.divider}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', color: theme.palette.text.primary, fontSize: '0.78rem', outline: 'none', transition: 'border-color 0.15s' };
  const selectSx = { height: 32, fontSize: '0.75rem', '.MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(gold, 0.5) }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: gold }, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' };

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
                <List dense disablePadding>
                  {Array.from(new Array(numPages), (_, i) => {
                    const pageNum = i + 1, isActive = currentPage === pageNum, label = pageLabels[i] || `Sheet ${pageNum}`;
                    return (
                      <Box key={i} onClick={() => jumpToPage?.(pageNum)} sx={{ py: 2, px: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer', bgcolor: isActive ? alpha(gold, 0.12) : 'transparent', borderBottom: '1px solid rgba(0,0,0,0.04)', '&:hover': { bgcolor: isActive ? alpha(gold, 0.18) : alpha(gold, 0.04) }, transition: 'background-color 0.15s' }}>
                        <Box sx={{ width: 140, height: 'auto', border: 1, borderColor: isActive ? gold : 'divider', borderRadius: 0.5, overflow: 'hidden', bgcolor: 'white', boxShadow: isActive ? `0 0 15px ${alpha(gold, 0.4)}` : '0 2px 8px rgba(0,0,0,0.05)', transform: isActive ? 'scale(1.02)' : 'scale(1)', transition: 'transform 0.2s' }}>
                          <Page pageNumber={pageNum} width={140} renderTextLayer={false} renderAnnotationLayer={false} loading="" />
                        </Box>
                        <Box sx={{ overflow: 'hidden', flex: 1, textAlign: 'center' }}><Typography variant="body2" sx={{ fontSize: '0.72rem', fontWeight: isActive ? 700 : 500, wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.2, color: isActive ? gold : 'text.primary', mt: 0.5 }}>{label}</Typography></Box>
                      </Box>
                    );
                  })}
                </List>
              </Document>
            ) : <Box display="flex" justifyContent="center" p={4}><CircularProgress size={24} /></Box>}
          </Box>
        )}

        {tab === 1 && (
          <List dense disablePadding>
            {bookmarks.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>{t('noBookmarks', 'No bookmarks found.')}</Typography> : bookmarks.map((item, i) => <BookmarkItem key={i} item={item} onJump={(dest) => onJumpToBookmark?.(dest)} isActive={false} currentPage={currentPage} />)}
          </List>
        )}

        {tab === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Select size="small" value={filterAuthor} onChange={(e) => setFilterAuthor(e.target.value)} sx={selectSx}>
                <MenuItem value="all" sx={{ fontSize: '0.75rem' }}>{t('allAuthors', 'All Users')}</MenuItem>
                {authors.map(a => <MenuItem key={a.id} value={a.id} sx={{ fontSize: '0.75rem' }}>{a.name}</MenuItem>)}
              </Select>
              <input placeholder={t('filterMarkups', 'Filter markups...')} value={filterText} onChange={(e) => setFilterText(e.target.value)} style={inputSx} />
            </Box>
            <List dense disablePadding sx={{ flexGrow: 1, ...getScrollbarSx(theme) }}>
              {groupedMarkups.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>{t('noMarkups', 'No markups found.')}</Typography> : groupedMarkups.map(author => (
                <Box key={author.id}>
                  <ListItemButton onClick={() => toggleAuthor(author.id)} sx={{ py: 0.5, bgcolor: 'action.hover' }}>
                    <ListItemIcon sx={{ minWidth: 24 }}>{expandedAuthors.includes(author.id) ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}</ListItemIcon>
                    <PersonIcon sx={{ fontSize: 14, mr: 1, color: gold }} />
                    <ListItemText primary={author.name} primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 700 }} />
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); if(onDeleteMarkup) onDeleteMarkup(Array.from(author.dates.values()).flat().map((m: any) => m.id)); }} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
                  </ListItemButton>
                  <Collapse in={expandedAuthors.includes(author.id)} timeout="auto">
                    {Array.from(author.dates.entries()).map(([date, items]: any) => (
                      <Box key={date}>
                        <ListItemButton onClick={() => toggleDate(`${author.id}-${date}`)} sx={{ py: 0.3, pl: 4, bgcolor: 'action.hover', opacity: 0.9 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}>{expandedDates.includes(`${author.id}-${date}`) ? <ExpandMoreIcon sx={{ fontSize: 14 }} /> : <ChevronRightIcon sx={{ fontSize: 14 }} />}</ListItemIcon>
                          <CalendarTodayIcon sx={{ fontSize: 12, mr: 1, opacity: 0.6 }} />
                          <ListItemText primary={formatGroupDate(date)} primaryTypographyProps={{ fontSize: '0.7rem', fontWeight: 600 }} />
                          <Typography variant="caption" sx={{ opacity: 0.5, mr: 1 }}>{items.length}</Typography>
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); if(onDeleteMarkup) onDeleteMarkup(items.map((m: any) => m.id)); }} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
                        </ListItemButton>
                        <Collapse in={expandedDates.includes(`${author.id}-${date}`)} timeout="auto">
                          <Box sx={{ pl: 2 }}>{items.map((m: any) => <MarkupListItem key={m.id} markup={m} selected={selectedMarkupIds.includes(m.id)} onSelect={() => onMarkupSelect([m.id])} onDelete={() => onDeleteMarkup?.(m.id)} />)}</Box>
                        </Collapse>
                      </Box>
                    ))}
                  </Collapse>
                </Box>
              ))}
            </List>
          </Box>
        )}

        {tab === 3 && (
          <Box sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>{t('markupLayers', 'Markup Layers')}</Typography>
            <List dense disablePadding>
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
            <List dense disablePadding sx={{ flexGrow: 1, ...getScrollbarSx(theme) }}>
              {searchResults.map((res, idx) => {
                const isSelected = activeSearchResultIndex === idx;
                return (
                  <ListItemButton key={idx} onClick={() => onSearchResultSelect?.(idx)} sx={{ borderBottom: 1, borderColor: 'divider', flexDirection: 'column', alignItems: 'flex-start', bgcolor: isSelected ? alpha(gold, 0.12) : 'transparent', py: 1.2, px: 1.5, '&:hover': { bgcolor: isSelected ? alpha(gold, 0.18) : alpha(theme.palette.action.hover, 0.5) } }}>
                    <Typography variant="caption" sx={{ color: gold, fontWeight: 800, fontSize: '0.6rem', mb: 0.5 }}>PAGE {res.pageIndex + 1}</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.78rem', wordBreak: 'break-word', color: isSelected ? 'text.primary' : 'text.secondary', lineHeight: 1.4 }}>{res.before}<span style={{ backgroundColor: 'rgba(255, 255, 0, 0.8)', fontWeight: 'bold', color: 'black', padding: '0 2px', borderRadius: '2px' }}>{searchKeyword}</span>{res.after}</Typography>
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
