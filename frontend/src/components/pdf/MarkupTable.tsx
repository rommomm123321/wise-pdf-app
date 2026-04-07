import React, { useState, useMemo, useCallback, useRef, memo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Box, Typography, Select, MenuItem, IconButton, Tooltip, Menu,
  useTheme, alpha, Divider, ListItemIcon, ListItemText,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RectangleIcon from '@mui/icons-material/Rectangle';
import TimelineIcon from '@mui/icons-material/Timeline';
import TextFormatIcon from '@mui/icons-material/TextFormat';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloudIcon from '@mui/icons-material/Cloud';
import CreateIcon from '@mui/icons-material/Create';
import HighlightIcon from '@mui/icons-material/Highlight';
import EastIcon from '@mui/icons-material/East';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import PolylineIcon from '@mui/icons-material/Polyline';
import ImageIcon from '@mui/icons-material/Image';
import StraightenIcon from '@mui/icons-material/Straighten';
import RouteIcon from '@mui/icons-material/Route';
import dayjs from 'dayjs';
import { STATUS_COLORS, STATUS_LABELS } from './MarkupListItem';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  rect: <RectangleIcon sx={{ fontSize: 13 }} />,
  line: <TimelineIcon sx={{ fontSize: 13 }} />,
  arrow: <EastIcon sx={{ fontSize: 13 }} />,
  text: <TextFormatIcon sx={{ fontSize: 13 }} />,
  circle: <RadioButtonUncheckedIcon sx={{ fontSize: 13 }} />,
  cloud: <CloudIcon sx={{ fontSize: 13 }} />,
  pen: <CreateIcon sx={{ fontSize: 13 }} />,
  highlighter: <HighlightIcon sx={{ fontSize: 13 }} />,
  callout: <ChatBubbleOutlineIcon sx={{ fontSize: 13 }} />,
  polyline: <PolylineIcon sx={{ fontSize: 13 }} />,
  image: <ImageIcon sx={{ fontSize: 13 }} />,
  measure: <StraightenIcon sx={{ fontSize: 13 }} />,
  routeTemplate: <RouteIcon sx={{ fontSize: 13 }} />,
  route: <RouteIcon sx={{ fontSize: 13 }} />,
};

const TYPE_LABELS: Record<string, string> = {
  rect: 'Rectangle', line: 'Line', arrow: 'Arrow', text: 'Text',
  circle: 'Circle', cloud: 'Cloud', pen: 'Pen', highlighter: 'Highlight',
  callout: 'Callout', polyline: 'Polyline', image: 'Image', measure: 'Measure',
  routeTemplate: 'Route Template', route: 'Route',
};

type SortBy = 'subject' | 'author' | 'status' | 'page' | 'date';
type SortDir = 'asc' | 'desc';
type GroupBy = 'none' | 'author' | 'status' | 'page';

interface MarkupTableProps {
  markups: any[];
  selectedMarkupIds: string[];
  onMarkupSelect: (ids: string[]) => void;
  onMarkupOpen?: (ids: string[]) => void;
  onDeleteMarkup?: (id: string | string[]) => void;
  hiddenLayers?: string[];
  currentUserId?: string;
  isAdmin?: boolean;
  onBulkUpdateProperty?: (ids: string[], key: string, value: any) => void;
}

export const MarkupTable = memo(function MarkupTable({
  markups, selectedMarkupIds, onMarkupSelect, onMarkupOpen,
  onDeleteMarkup, hiddenLayers = [], currentUserId, isAdmin = false,
  onBulkUpdateProperty,
}: MarkupTableProps) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const isDark = theme.palette.mode === 'dark';

  const [filterText, setFilterText] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('page');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; markupId: string } | null>(null);
  const lastClickedIndexRef = useRef<number>(-1);

  const baseMarkups = useMemo(
    () => (markups || []).filter(m => m.type !== 'auto-highlight' && !hiddenLayers.includes(m.type)),
    [markups, hiddenLayers],
  );

  const filtered = useMemo(() => {
    let r = baseMarkups;
    if (filterAuthor !== 'all') r = r.filter(m => m.authorId === filterAuthor);
    if (filterStatus !== 'all') r = r.filter(m => (m.properties?.status || 'none') === filterStatus);
    if (filterText) {
      const q = filterText.toLowerCase();
      r = r.filter(m =>
        (m.properties?.subject || '').toLowerCase().includes(q) ||
        (m.properties?.comment || '').toLowerCase().includes(q) ||
        (m.author?.name || '').toLowerCase().includes(q) ||
        (TYPE_LABELS[m.type] || m.type).toLowerCase().includes(q),
      );
    }
    return r;
  }, [baseMarkups, filterAuthor, filterStatus, filterText]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: any, bv: any;
      switch (sortBy) {
        case 'subject':
          av = a.properties?.subject || TYPE_LABELS[a.type] || a.type;
          bv = b.properties?.subject || TYPE_LABELS[b.type] || b.type;
          break;
        case 'author': av = a.author?.name || ''; bv = b.author?.name || ''; break;
        case 'status': av = a.properties?.status || 'none'; bv = b.properties?.status || 'none'; break;
        case 'page': av = a.pageNumber ?? 0; bv = b.pageNumber ?? 0; return (av - bv) * dir;
        case 'date': av = a.createdAt || ''; bv = b.createdAt || ''; break;
        default: return 0;
      }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  }, [filtered, sortBy, sortDir]);

  const authors = useMemo(() => {
    const m = new Map<string, string>();
    baseMarkups.forEach(mk => {
      if (mk.authorId) m.set(mk.authorId, mk.author?.name || mk.author?.email || 'Unknown');
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [baseMarkups]);

  type GroupRow = { type: 'group'; label: string; count: number };
  type MarkupRow = { type: 'markup'; markup: any; index: number };
  type Row = GroupRow | MarkupRow;

  const rows = useMemo((): Row[] => {
    if (groupBy === 'none') {
      return sorted.map((m, i) => ({ type: 'markup', markup: m, index: i }));
    }
    const groups = new Map<string, any[]>();
    sorted.forEach(m => {
      let key: string;
      switch (groupBy) {
        case 'author': key = m.author?.name || m.author?.email || 'Unknown'; break;
        case 'status': key = STATUS_LABELS[m.properties?.status || 'none'] || (m.properties?.status || 'None'); break;
        case 'page': key = `Page ${(m.pageNumber ?? 0) + 1}`; break;
        default: key = 'All';
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    });
    const result: Row[] = [];
    let idx = 0;
    groups.forEach((items, label) => {
      result.push({ type: 'group', label, count: items.length });
      items.forEach(m => result.push({ type: 'markup', markup: m, index: idx++ }));
    });
    return result;
  }, [sorted, groupBy]);

  const handleSort = (col: SortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const handleRowClick = useCallback((markup: any, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      const lo = Math.min(lastClickedIndexRef.current, index);
      const hi = Math.max(lastClickedIndexRef.current, index);
      const rangeIds = sorted.slice(lo, hi + 1).map(m => m.id);
      onMarkupSelect(Array.from(new Set([...selectedMarkupIds, ...rangeIds])));
    } else if (e.ctrlKey || e.metaKey) {
      const isSel = selectedMarkupIds.includes(markup.id);
      onMarkupSelect(isSel ? selectedMarkupIds.filter(id => id !== markup.id) : [...selectedMarkupIds, markup.id]);
      lastClickedIndexRef.current = index;
    } else {
      onMarkupSelect([markup.id]);
      lastClickedIndexRef.current = index;
    }
  }, [sorted, selectedMarkupIds, onMarkupSelect]);

  const handleRowDoubleClick = useCallback((markup: any) => {
    onMarkupOpen?.([markup.id]);
  }, [onMarkupOpen]);

  const handleContextMenu = useCallback((e: React.MouseEvent, markupId: string) => {
    e.preventDefault();
    if (!selectedMarkupIds.includes(markupId)) onMarkupSelect([markupId]);
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, markupId });
  }, [selectedMarkupIds, onMarkupSelect]);

  const closeContextMenu = () => setContextMenu(null);

  const handleSetStatus = (status: string) => {
    const ids = selectedMarkupIds.length > 0 ? selectedMarkupIds : [contextMenu!.markupId];
    onBulkUpdateProperty?.(ids, 'status', status);
    closeContextMenu();
  };

  const handleDeleteFromContext = () => {
    const ids = selectedMarkupIds.length > 0 ? selectedMarkupIds : [contextMenu!.markupId];
    onDeleteMarkup?.(ids.length === 1 ? ids[0] : ids);
    onMarkupSelect([]);
    closeContextMenu();
  };

  const handleBulkDelete = () => {
    if (!selectedMarkupIds.length) return;
    onDeleteMarkup?.(selectedMarkupIds.length === 1 ? selectedMarkupIds[0] : selectedMarkupIds);
    onMarkupSelect([]);
  };

  const handleExportCsv = () => {
    const headers = ['Type', 'Subject', 'Comment', 'Author', 'Page', 'Status', 'Created'];
    const dataRows = filtered.map(m => [
      TYPE_LABELS[m.type] || m.type,
      m.properties?.subject || '',
      m.properties?.comment || '',
      m.author?.name || m.author?.email || '',
      (m.pageNumber || 0) + 1,
      m.properties?.status || 'none',
      m.createdAt ? dayjs(m.createdAt).format('YYYY-MM-DD HH:mm') : '',
    ]);
    const csv = [headers, ...dataRows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'markups.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const ColSortIcon = ({ col }: { col: SortBy }) => {
    if (sortBy !== col) return <ArrowUpwardIcon sx={{ fontSize: 9, opacity: 0.25 }} />;
    return sortDir === 'asc'
      ? <ArrowUpwardIcon sx={{ fontSize: 9, color: gold }} />
      : <ArrowDownwardIcon sx={{ fontSize: 9, color: gold }} />;
  };

  const colHeader = (label: string, col: SortBy, flexVal?: number, widthVal?: number) => (
    <Box
      onClick={() => handleSort(col)}
      sx={{
        display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer',
        flex: flexVal, width: widthVal, minWidth: widthVal, flexShrink: 0,
        userSelect: 'none', color: sortBy === col ? gold : 'text.secondary',
        '&:hover': { color: gold },
      }}
    >
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1 }}>
        {label}
      </Typography>
      <ColSortIcon col={col} />
    </Box>
  );

  const allIds = sorted.map(m => m.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedMarkupIds.includes(id));
  const someSelected = !allSelected && allIds.some(id => selectedMarkupIds.includes(id));

  // PERF-2: virtual scroll — only renders visible rows in DOM
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (i) => rows[i].type === 'group' ? 32 : 34,
    overscan: 10,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Match site style from Search section
  const nativeInputSx: React.CSSProperties = {
    width: '100%', padding: '7px 32px 7px 10px', borderRadius: '6px', boxSizing: 'border-box',
    border: `1px solid ${theme.palette.divider}`,
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    color: theme.palette.text.primary, fontSize: '0.85rem', outline: 'none',
    transition: 'border-color 0.15s',
  };

  const selectSx = {
    height: 30, fontSize: '0.82rem',
    '.MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(gold, 0.5) },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: gold },
    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    '& .MuiSelect-select': { py: '5px !important', fontSize: '0.82rem', pr: '26px !important' },
    '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
  };

  const menuProps = {
    PaperProps: {
      sx: {
        bgcolor: 'background.paper', border: 1, borderColor: 'divider',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        '& .MuiMenuItem-root': { fontSize: '0.85rem', py: 0.5, borderRadius: '3px', mx: 0.3, '&:hover': { bgcolor: alpha(gold, 0.08) } },
      },
    },
  };

  const checkboxSx = (checked: boolean, indeterminate = false) => ({
    width: 18, height: 18, flexShrink: 0,
    border: `1.5px solid ${checked || indeterminate ? gold : theme.palette.divider}`,
    borderRadius: '4px', cursor: 'pointer',
    bgcolor: checked ? gold : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    '&:hover': { borderColor: gold },
    transition: 'all 0.1s',
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Filter bar ── */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
        {/* Row 1: Search */}
        <Box sx={{ position: 'relative' }}>
          <input
            placeholder="Search markups..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            style={nativeInputSx}
          />
          {filterText && (
            <IconButton size="small" onClick={() => setFilterText('')}
              sx={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', p: 0.3, opacity: 0.55 }}>
              <ClearIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>

        {/* Row 2: author + status */}
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <Select size="small" value={filterAuthor} onChange={e => setFilterAuthor(e.target.value)}
            sx={{ ...selectSx, flex: 1, minWidth: 0 }} MenuProps={menuProps}>
            <MenuItem value="all">All users</MenuItem>
            {authors.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
          </Select>
          <Select size="small" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            sx={{ ...selectSx, flex: 1, minWidth: 0 }} MenuProps={menuProps}
            renderValue={val => val === 'all' ? <span>All status</span> : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[val as string] || '#78909c', flexShrink: 0 }} />
                <span>{STATUS_LABELS[val as string] || val}</span>
              </Box>
            )}>
            <MenuItem value="all">All status</MenuItem>
            {Object.entries(STATUS_LABELS).map(([k, l]) => (
              <MenuItem key={k} value={k}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[k] }} />
                  {l}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </Box>

        {/* Row 3: group + export */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Select size="small" value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}
            sx={{ ...selectSx, flex: 1, minWidth: 0 }} MenuProps={menuProps}
            renderValue={val => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FilterListIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                <span>{val === 'none' ? 'No grouping' : `By ${val}`}</span>
              </Box>
            )}>
            <MenuItem value="none">No grouping</MenuItem>
            <MenuItem value="author">By Author</MenuItem>
            <MenuItem value="status">By Status</MenuItem>
            <MenuItem value="page">By Page</MenuItem>
          </Select>
          <Tooltip title="Export CSV">
            <IconButton size="small" onClick={handleExportCsv}
              sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: gold }, flexShrink: 0 }}>
              <FileDownloadIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Column headers + Select All ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', px: 1.5, py: '6px', gap: '6px', flexShrink: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)',
      }}>
        {/* Select-all checkbox */}
        <Box onClick={() => onMarkupSelect(allSelected ? [] : allIds)} sx={checkboxSx(allSelected, someSelected)}>
          {someSelected && <Box sx={{ width: 8, height: 2, bgcolor: gold, borderRadius: 1 }} />}
          {allSelected && <Box component="span" sx={{ fontSize: '0.65rem', color: isDark ? '#000' : '#fff', lineHeight: 1, fontWeight: 900 }}>✓</Box>}
        </Box>

        {/* "Select all / none" label — clickable */}
        <Typography
          onClick={() => onMarkupSelect(allSelected ? [] : allIds)}
          sx={{
            fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            color: (allSelected || someSelected) ? gold : 'text.secondary',
            cursor: 'pointer', userSelect: 'none', flex: 1,
            '&:hover': { color: gold },
          }}
        >
          {allSelected ? 'Deselect all' : someSelected ? `${selectedMarkupIds.length} selected` : 'Select all'}
        </Typography>

        {colHeader('Pg', 'page', undefined, 24)}
      </Box>

      {/* ── Rows (PERF-2: virtualized — only visible rows in DOM) ── */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flexGrow: 1, overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-thumb': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 4 },
        }}
      >
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary"
            sx={{ p: 2, textAlign: 'center', fontSize: '0.82rem' }}>
            No markups found.
          </Typography>
        ) : (
          <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
            {virtualItems.map(vItem => {
              const row = rows[vItem.index];
              const i = vItem.index;

              if (row.type === 'group') {
                return (
                  <div key={`g${i}`} style={{ position: 'absolute', top: vItem.start, left: 0, width: '100%', height: vItem.size }}>
                    <Box sx={{
                      px: 1.5, py: '7px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      height: '100%', boxSizing: 'border-box',
                      bgcolor: isDark ? alpha(gold, 0.07) : alpha(gold, 0.06),
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: gold, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        {row.label}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 500 }}>
                        {row.count}
                      </Typography>
                    </Box>
                  </div>
                );
              }

              const m = row.markup;
              const isSelected = selectedMarkupIds.includes(m.id);
              const color = m.properties?.stroke || gold;
              const status = m.properties?.status || 'none';
              const statusColor = STATUS_COLORS[status] || STATUS_COLORS.none || '#78909c';
              const statusLabel = STATUS_LABELS[status] || status;
              const subject = m.properties?.subject || TYPE_LABELS[m.type] || m.type;

              return (
                <div key={m.id} style={{ position: 'absolute', top: vItem.start, left: 0, width: '100%', height: vItem.size }}>
                  <Tooltip
                    title={
                      <Box sx={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
                        <div><b>Subject:</b> {subject}</div>
                        {m.properties?.comment && <div><b>Comment:</b> {m.properties.comment}</div>}
                        <div><b>Author:</b> {m.author?.name || m.author?.email || 'Unknown'}</div>
                        <div><b>Status:</b> {statusLabel}</div>
                        <div><b>Page:</b> {(m.pageNumber ?? 0) + 1}</div>
                        {m.createdAt && <div><b>Created:</b> {dayjs(m.createdAt).format('DD MMM YYYY HH:mm')}</div>}
                        <div style={{ marginTop: 4, opacity: 0.6, fontSize: '0.68rem' }}>Double-click to open · Right-click for options</div>
                      </Box>
                    }
                    placement="right"
                    enterDelay={700}
                    componentsProps={{ tooltip: { sx: { maxWidth: 220 } } }}
                  >
                    <Box
                      onClick={e => handleRowClick(m, row.index, e)}
                      onDoubleClick={() => handleRowDoubleClick(m)}
                      onContextMenu={e => handleContextMenu(e, m.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', height: '100%', px: 1.5, gap: '6px',
                        cursor: 'pointer', userSelect: 'none', boxSizing: 'border-box',
                        bgcolor: isSelected ? (isDark ? alpha(gold, 0.13) : alpha(gold, 0.09)) : 'transparent',
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.35)}`,
                        '&:hover': {
                          bgcolor: isSelected
                            ? (isDark ? alpha(gold, 0.17) : alpha(gold, 0.12))
                            : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                        },
                        transition: 'background-color 0.08s',
                      }}
                    >
                      <Box sx={checkboxSx(isSelected)}>
                        {isSelected && <Box component="span" sx={{ fontSize: '0.65rem', color: isDark ? '#000' : '#fff', lineHeight: 1, fontWeight: 900 }}>✓</Box>}
                      </Box>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, bgcolor: color }} />
                      <Box sx={{ width: 18, flexShrink: 0, color: alpha(theme.palette.text.primary, 0.5), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {TYPE_ICONS[m.type] || <RectangleIcon sx={{ fontSize: 15 }} />}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: '0.83rem', lineHeight: 1.3, fontWeight: isSelected ? 600 : 400, color: isSelected ? gold : 'text.primary' }}>
                          {subject}
                        </Typography>
                        {m.author?.name && (
                          <Typography noWrap sx={{ fontSize: '0.68rem', color: 'text.secondary', lineHeight: 1.2 }}>
                            {m.author.name}
                          </Typography>
                        )}
                      </Box>
                      {status !== 'none' && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusColor, flexShrink: 0 }} />}
                      <Typography sx={{ width: 24, flexShrink: 0, fontSize: '0.75rem', color: 'text.secondary', textAlign: 'right', lineHeight: 1 }}>
                        {(m.pageNumber ?? 0) + 1}
                      </Typography>
                    </Box>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        )}
      </Box>

      {/* ── Footer ── */}
      <Box sx={{
        borderTop: 1, borderColor: 'divider', px: 1.5, py: 0.75, flexShrink: 0,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.018)',
        display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 34,
      }}>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500, flex: 1 }}>
          {filtered.length} markup{filtered.length !== 1 ? 's' : ''}
          {selectedMarkupIds.length > 0 && ` · ${selectedMarkupIds.length} selected`}
        </Typography>

        {selectedMarkupIds.length > 0 && (
          <>
            {/* Quick-set status dots */}
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <Tooltip key={key} title={`Set: ${label}`} placement="top">
                <Box
                  onClick={() => onBulkUpdateProperty?.(selectedMarkupIds, 'status', key)}
                  sx={{
                    width: 12, height: 12, borderRadius: '50%', bgcolor: STATUS_COLORS[key],
                    cursor: 'pointer', flexShrink: 0,
                    '&:hover': { transform: 'scale(1.3)', outline: `2px solid ${alpha(STATUS_COLORS[key], 0.4)}` },
                    transition: 'transform 0.12s',
                  }}
                />
              </Tooltip>
            ))}
            <Tooltip title="Delete selected">
              <IconButton size="small" onClick={handleBulkDelete}
                sx={{ p: 0.4, color: 'text.secondary', '&:hover': { color: 'error.main' }, flexShrink: 0 }}>
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear selection">
              <IconButton size="small" onClick={() => onMarkupSelect([])}
                sx={{ p: 0.4, color: 'text.secondary', flexShrink: 0 }}>
                <ClearIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* ── Right-click context menu ── */}
      <Menu
        open={!!contextMenu}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper', border: 1, borderColor: 'divider',
            boxShadow: '0 4px 24px rgba(0,0,0,0.22)', minWidth: 170, borderRadius: '8px',
          },
        }}
      >
        <MenuItem
          onClick={() => { contextMenu && onMarkupOpen?.([contextMenu.markupId]); closeContextMenu(); }}
          sx={{ fontSize: '0.82rem', py: 0.6 }}
        >
          <ListItemIcon><OpenInNewIcon sx={{ fontSize: 16 }} /></ListItemIcon>
          <ListItemText>Jump to markup</ListItemText>
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <Typography sx={{ px: 1.5, pt: 0.25, pb: 0.5, fontSize: '0.62rem', fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Set Status {selectedMarkupIds.length > 1 ? `(${selectedMarkupIds.length})` : ''}
        </Typography>

        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <MenuItem key={key} onClick={() => handleSetStatus(key)} sx={{ fontSize: '0.82rem', py: 0.45 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: STATUS_COLORS[key], mr: 1.5, flexShrink: 0 }} />
            {label}
          </MenuItem>
        ))}

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={handleDeleteFromContext}
          sx={{ fontSize: '0.82rem', py: 0.6, color: 'error.main' }}
          disabled={contextMenu ? !isAdmin && currentUserId !== (markups.find(m => m.id === contextMenu.markupId)?.authorId) : false}
        >
          <ListItemIcon><DeleteIcon sx={{ fontSize: 16, color: 'error.main' }} /></ListItemIcon>
          <ListItemText>Delete{selectedMarkupIds.length > 1 ? ` (${selectedMarkupIds.length})` : ''}</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
});

export default MarkupTable;
