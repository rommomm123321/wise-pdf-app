import React, { useMemo, useState } from 'react';
import {
  Box, Typography, IconButton, CircularProgress,
  Tooltip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  useTheme, Avatar, TextField, Select, MenuItem, InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RestoreIcon from '@mui/icons-material/Restore';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ManageHistoryIcon from '@mui/icons-material/ManageHistory';
import FilterListIcon from '@mui/icons-material/FilterList';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ClearIcon from '@mui/icons-material/Clear';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useMarkupHistory, useRestoreMarkupHistory, useMarkupHistoryAuthors } from '../../hooks/useMarkupHistory';
import type { MarkupHistoryItem, HistoryFilters } from '../../hooks/useMarkupHistory';

dayjs.extend(relativeTime);

const ACTION_COLOR: Record<string, string> = {
  ADD: '#4caf50',
  MODIFY: '#2196f3',
  DELETE: '#f44336',
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  ADD: <AddCircleOutlineIcon sx={{ fontSize: 14 }} />,
  MODIFY: <EditOutlinedIcon sx={{ fontSize: 14 }} />,
  DELETE: <DeleteOutlineIcon sx={{ fontSize: 14 }} />,
};

const ACTION_LABEL: Record<string, string> = {
  ADD: 'Added',
  MODIFY: 'Modified',
  DELETE: 'Deleted',
};

function getUserInitials(author: { name?: string; email: string }) {
  if (author.name) {
    return author.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
  return author.email.slice(0, 2).toUpperCase();
}

function getUserColor(id: string) {
  const palette = ['#e53935','#8e24aa','#1e88e5','#00897b','#e65100','#3949ab','#d81b60','#6d4c41','#039be5','#43a047'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

interface DayGroup {
  day: string;
  items: MarkupHistoryItem[];
}

function groupByDay(items: MarkupHistoryItem[]): DayGroup[] {
  const map = new Map<string, MarkupHistoryItem[]>();
  for (const item of items) {
    const day = dayjs(item.createdAt).format('YYYY-MM-DD');
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(item);
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
}

interface Props {
  documentId: string;
  isAdmin: boolean;
  numPages?: number;
  onClose: () => void;
  onRestored?: () => void;
  /** Navigate to markup — passes markupId, pageNumber (0-based), and snapshot coordinates for fallback */
  onNavigateToMarkup?: (markupId: string, pageNumber: number, snapshotCoords?: any) => void;
  variant?: 'panel' | 'drawer';
}

export default function MarkupHistoryPanel({ documentId, isAdmin, numPages = 0, onClose, onRestored, onNavigateToMarkup, variant = 'panel' }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>({});
  const hasActiveFilters = !!(filters.authorId || filters.action || (filters.pageNumber !== undefined && filters.pageNumber !== '') || filters.dateFrom || filters.dateTo);

  const { data, isLoading, error } = useMarkupHistory(documentId, true, filters);
  const { data: authors = [] } = useMarkupHistoryAuthors(documentId, true);
  const restore = useRestoreMarkupHistory(documentId);

  const [confirmItem, setConfirmItem] = useState<MarkupHistoryItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  const groups = useMemo(() => {
    if (!data?.items) return [];
    return groupByDay(data.items);
  }, [data]);

  const handleRestore = async () => {
    if (!confirmItem) return;
    setRestoring(true);
    try {
      await restore.mutateAsync(confirmItem.createdAt);
      setConfirmItem(null);
      onRestored?.();
    } catch (e: any) {
      console.error('Restore failed', e);
    } finally {
      setRestoring(false);
    }
  };

  const clearFilters = () => setFilters({});

  const panelBg = isDark ? '#1a1a1a' : '#fafafa';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  // Theme-aware styles for inputs and selects
  const inputBg = isDark ? '#252525' : '#fff';
  const inputColor = isDark ? '#e0e0e0' : '#333';
  const inputSx = {
    '& .MuiInputBase-root': { height: 30, fontSize: '0.8rem', bgcolor: inputBg, color: inputColor },
    '& .MuiInputLabel-root': { fontSize: '0.78rem', color: 'text.secondary' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor },
    // Style native date picker icon and text for dark/light theme
    '& input[type="date"]': {
      color: inputColor,
      colorScheme: isDark ? 'dark' : 'light',
      '&::-webkit-calendar-picker-indicator': {
        filter: isDark ? 'invert(0.8)' : 'none',
        cursor: 'pointer',
      },
    },
  };
  const selectSx = {
    height: 30, fontSize: '0.8rem', bgcolor: inputBg, color: inputColor,
    '& .MuiOutlinedInput-notchedOutline': { borderColor },
    '& .MuiSelect-select': { color: inputColor },
    '& .MuiSelect-icon': { color: isDark ? '#aaa' : '#666' },
  };

  return (
    <Box sx={variant === 'drawer'
      ? { flex: 1, display: 'flex', flexDirection: 'column', bgcolor: panelBg, overflow: 'hidden' } as any
      : { position: 'absolute', top: 0, right: 0, bottom: 0, width: 340, zIndex: 20, display: 'flex', flexDirection: 'column', bgcolor: panelBg, borderLeft: `1px solid ${borderColor}`, overflow: 'hidden', boxShadow: '-4px 0 16px rgba(0,0,0,0.15)' }
    }>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 1.5,
        borderBottom: `1px solid ${borderColor}`,
        bgcolor: isDark ? '#111' : '#fff',
        flexShrink: 0,
      }}>
        <ManageHistoryIcon sx={{ fontSize: 18, color: gold }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, fontSize: '0.85rem' }}>
          Markup History
        </Typography>
        {data && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {data.total} events
          </Typography>
        )}
        <Tooltip title="Filters">
          <IconButton size="small" onClick={() => setShowFilters(v => !v)} sx={{ color: hasActiveFilters ? gold : 'inherit' }}>
            <FilterListIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={onClose} sx={{ ml: 0.5 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Filter bar */}
      {showFilters && (
        <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', gap: 0.75, flexShrink: 0, bgcolor: isDark ? '#151515' : '#f5f5f5' }}>
          {/* Row 1: Action + Author */}
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Select
              displayEmpty
              size="small"
              value={filters.action || ''}
              onChange={e => setFilters(f => ({ ...f, action: e.target.value || undefined }))}
              sx={{ ...selectSx, flex: 1 }}
            >
              <MenuItem value="">All actions</MenuItem>
              <MenuItem value="ADD">Added</MenuItem>
              <MenuItem value="MODIFY">Modified</MenuItem>
              <MenuItem value="DELETE">Deleted</MenuItem>
            </Select>
            <Select
              displayEmpty
              size="small"
              value={filters.authorId || ''}
              onChange={e => setFilters(f => ({ ...f, authorId: e.target.value || undefined }))}
              sx={{ ...selectSx, flex: 1.5 }}
            >
              <MenuItem value="">All users</MenuItem>
              {authors.map(a => (
                <MenuItem key={a.id} value={a.id}>{a.name || a.email}</MenuItem>
              ))}
            </Select>
          </Box>
          {/* Row 2: Page + Date range */}
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Select
              displayEmpty
              size="small"
              value={filters.pageNumber !== undefined ? String(filters.pageNumber) : ''}
              onChange={e => {
                const v = e.target.value;
                setFilters(f => ({ ...f, pageNumber: v === '' ? undefined : Number(v) }));
              }}
              sx={{ ...selectSx, flex: 0.7 }}
            >
              <MenuItem value="">All pages</MenuItem>
              {Array.from({ length: numPages }, (_, i) => (
                <MenuItem key={i} value={String(i)}>Page {i + 1}</MenuItem>
              ))}
            </Select>
            <TextField
              type="date"
              size="small"
              value={filters.dateFrom || ''}
              onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))}
              sx={{ ...inputSx, flex: 1 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>From</Typography></InputAdornment> }}
            />
            <TextField
              type="date"
              size="small"
              value={filters.dateTo || ''}
              onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined }))}
              sx={{ ...inputSx, flex: 1 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>To</Typography></InputAdornment> }}
            />
          </Box>
          {/* Clear filters */}
          {hasActiveFilters && (
            <Button size="small" onClick={clearFilters} startIcon={<ClearIcon sx={{ fontSize: 14 }} />}
              sx={{ alignSelf: 'flex-start', fontSize: '0.72rem', textTransform: 'none', color: 'text.secondary', p: '2px 8px' }}>
              Clear filters
            </Button>
          )}
        </Box>
      )}

      {/* Admin restore hint */}
      {isAdmin && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: isDark ? '#1e1a00' : '#fffde7', borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: isDark ? '#ffd740' : '#f57f17', fontSize: '0.75rem' }}>
            As admin, you can restore the document to any point in time.
          </Typography>
        </Box>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Typography variant="body2" color="error" sx={{ p: 2 }}>
            Failed to load history
          </Typography>
        )}

        {!isLoading && !error && groups.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <ManageHistoryIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {hasActiveFilters ? 'No results match filters' : 'No history yet'}
            </Typography>
            {!hasActiveFilters && (
              <Typography variant="caption" color="text.disabled">
                Changes will appear here as markups are added, edited, or deleted.
              </Typography>
            )}
          </Box>
        )}

        {groups.map((group) => {
          const isToday = dayjs(group.day).isSame(dayjs(), 'day');
          const isYesterday = dayjs(group.day).isSame(dayjs().subtract(1, 'day'), 'day');
          const dayLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : dayjs(group.day).format('MMM D, YYYY');

          return (
            <Box key={group.day}>
              {/* Day header */}
              <Box sx={{
                display: 'flex', alignItems: 'center', px: 2, py: 0.75,
                position: 'sticky', top: 0, zIndex: 1,
                bgcolor: isDark ? '#222' : '#f0f0f0',
                borderBottom: `1px solid ${borderColor}`,
              }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {dayLabel} · {group.items.length} change{group.items.length !== 1 ? 's' : ''}
                </Typography>
              </Box>

              {/* Events */}
              {group.items.map((item) => {
                const color = ACTION_COLOR[item.action] || '#9e9e9e';
                const icon = ACTION_ICON[item.action];
                const label = ACTION_LABEL[item.action] || item.action;
                const authorName = item.author?.name || item.author?.email || 'Unknown';
                const typeName = item.snapshot?.type || 'markup';
                const pageNum = item.snapshot?.pageNumber !== undefined ? item.snapshot.pageNumber + 1 : null;
                const subject = item.snapshot?.properties?.subject;
                const timeStr = dayjs(item.createdAt).format('HH:mm:ss');

                // Allow navigation for all actions (even DELETE — navigates to where it was)
                const canNavigate = !!onNavigateToMarkup && item.snapshot?.pageNumber !== undefined;
                return (
                  <Box
                    key={item.id}
                    onClick={canNavigate ? () => onNavigateToMarkup!(item.markupId, item.snapshot!.pageNumber, item.snapshot?.coordinates) : undefined}
                    sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1.5,
                      px: 2, py: 1.25,
                      borderBottom: `1px solid ${borderColor}`,
                      cursor: canNavigate ? 'pointer' : 'default',
                      '&:hover': canNavigate
                        ? { bgcolor: isDark ? 'rgba(180,140,60,0.08)' : 'rgba(180,140,60,0.06)' }
                        : { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Author avatar */}
                    <Avatar
                      sx={{
                        width: 28, height: 28, fontSize: '0.65rem',
                        bgcolor: getUserColor(item.authorId),
                        flexShrink: 0, mt: 0.25,
                      }}
                    >
                      {getUserInitials(item.author)}
                    </Avatar>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        {/* Action badge */}
                        <Box sx={{
                          display: 'inline-flex', alignItems: 'center', gap: 0.3,
                          color, fontSize: '0.72rem', fontWeight: 700,
                        }}>
                          {icon}
                          {label}
                        </Box>
                        {/* Type */}
                        <Typography variant="caption" sx={{ color: 'text.primary', fontSize: '0.75rem', fontWeight: 500 }}>
                          {typeName}
                        </Typography>
                        {pageNum !== null && (
                          <Typography variant="caption" sx={{
                            color: gold, fontSize: '0.7rem', fontWeight: 600,
                            bgcolor: isDark ? 'rgba(180,140,60,0.15)' : 'rgba(180,140,60,0.1)',
                            px: 0.5, borderRadius: '3px',
                          }}>
                            P{pageNum}
                          </Typography>
                        )}
                      </Box>

                      {/* Author + time */}
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', display: 'block', mt: 0.25 }}>
                        {authorName} · {timeStr}
                      </Typography>

                      {/* Subject if any */}
                      {subject && (
                        <Typography variant="caption" sx={{
                          color: 'text.secondary', fontSize: '0.71rem',
                          display: 'block', mt: 0.2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          "{subject}"
                        </Typography>
                      )}

                      {/* Navigate link */}
                      {canNavigate && (
                        <Typography variant="caption" sx={{
                          color: gold, fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: 0.3,
                          mt: 0.3, cursor: 'pointer', '&:hover': { textDecoration: 'underline' },
                        }}>
                          <OpenInNewIcon sx={{ fontSize: 11 }} />
                          Jump to {item.action === 'DELETE' ? 'location' : 'markup'}
                        </Typography>
                      )}
                    </Box>

                    {/* Restore button — admin only */}
                    {isAdmin && (
                      <Tooltip title="Restore to this point">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setConfirmItem(item); }}
                          sx={{ flexShrink: 0, opacity: 0.5, '&:hover': { opacity: 1, color: gold } }}
                        >
                          <RestoreIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>

      {/* Restore Confirmation Dialog */}
      <Dialog open={!!confirmItem} onClose={() => !restoring && setConfirmItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700 }}>
          Restore to this point?
        </DialogTitle>
        <DialogContent>
          {confirmItem && (
            <Typography variant="body2" color="text.secondary">
              This will restore all markups to their state at{' '}
              <strong>{dayjs(confirmItem.createdAt).format('MMM D, YYYY HH:mm:ss')}</strong>.
              Markups created after this point will be permanently deleted.
              This cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmItem(null)} disabled={restoring}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRestore}
            disabled={restoring}
            startIcon={restoring ? <CircularProgress size={14} /> : <RestoreIcon />}
          >
            {restoring ? 'Restoring...' : 'Restore'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
