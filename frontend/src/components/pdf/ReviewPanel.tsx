import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Button,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
  alpha,
  Drawer,
  useMediaQuery,
  Tabs,
  Tab,
  TextField,
  LinearProgress,
  Collapse,
  Select,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RoomIcon from '@mui/icons-material/Room';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BuildIcon from '@mui/icons-material/Build';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import toast from 'react-hot-toast';
import type { SpellError } from '../../lib/spellCheck';
import { apiFetch } from '../../lib/api';

/* ── Types ── */

interface ChecklistTemplate {
  id: string;
  name: string;
  items: { title: string; group?: string }[];
}

interface ReviewItem {
  id: string;
  title: string;
  group?: string;
  result: 'pass' | 'fail' | 'skip' | null;
  comment?: string;
  pageNumber?: number;
  pinX?: number;
  pinY?: number;
  fixedAt?: string;
}

// Normalize API response to match frontend Review type
function normalizeReview(r: any): Review | null {
  if (!r) return null;
  return {
    ...r,
    templateName: r.templateName || r.template?.name || r.summary || 'Review',
    items: (r.items || []).map((it: any) => ({
      ...it,
      title: it.title || (it.templateItemId?.startsWith('item-') ? `Item ${parseInt(it.templateItemId.split('-')[1] || '0') + 1}` : it.templateItemId) || 'Untitled',
      group: it.group || it.groupName || undefined,
    })),
  };
}

interface Review {
  id: string;
  templateName: string;
  status: 'in_progress' | 'completed';
  inspectorId: string;
  inspectorName: string;
  assigneeId?: string;
  assigneeName?: string;
  summary?: string;
  createdAt: string;
  completedAt?: string;
  items: ReviewItem[];
}

/* ── Props ── */

interface ReviewPanelProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  projectId: string;
  currentPage: number;
  numPages: number;
  userId: string;
  userName?: string;
  projectUsers?: { id: string; name: string; email: string }[];
  // Spell check props
  spellErrors: SpellError[];
  spellScope: 'page' | 'document';
  onSpellScopeChange: (s: 'page' | 'document') => void;
  onJumpToSpellError: (e: SpellError) => void;
  onFixSpellWord: (e: SpellError, r: string) => void;
  onIgnoreSpellWord: (w: string) => void;
  isSpellChecking: boolean;
  onRunSpellCheck?: () => void;
  // Navigation
  onJumpToPage: (page: number) => void;
  // Versions — for loading reviews from previous revisions
  versions?: Array<{ id: string; createdAt: string }>;
  onLoadPreviousReview?: (review: any) => void;
  onPlacePin: (pageNumber: number, x: number, y: number, itemId: string) => void;
}

/* ── Spell check sub-panel (extracted from old SpellCheckPanel) ── */

const FIELD_COLORS: Record<string, string> = {
  text: '#2196f3',
  subject: '#ff9800',
  comment: '#9c27b0',
};

function SpellCheckContent({
  errors, scope, onScopeChange, onJumpToError, onFixWord, onIgnoreWord,
  isChecking, currentPage, totalPages, onRunCheck,
}: {
  errors: SpellError[];
  scope: 'page' | 'document';
  onScopeChange: (s: 'page' | 'document') => void;
  onJumpToError: (e: SpellError) => void;
  onFixWord: (e: SpellError, r: string) => void;
  onIgnoreWord: (w: string) => void;
  isChecking: boolean;
  currentPage: number;
  totalPages: number;
  onRunCheck?: () => void;
}) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;

  const uniqueMarkupCount = useMemo(() => {
    const ids = new Set(errors.map(e => e.pageNumber));
    return ids.size;
  }, [errors]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Scope toggle + summary */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ToggleButtonGroup
          size="small" exclusive value={scope}
          onChange={(_, v) => { if (v) onScopeChange(v); }}
          sx={{
            height: 26,
            '& .MuiToggleButton-root': {
              fontSize: '0.7rem', fontWeight: 600, px: 1, py: 0, textTransform: 'none',
              borderColor: theme.palette.divider,
              '&.Mui-selected': { bgcolor: alpha(gold, 0.15), color: gold, borderColor: alpha(gold, 0.4) },
            },
          }}
        >
          <ToggleButton value="page">Page</ToggleButton>
          <ToggleButton value="document">All</ToggleButton>
        </ToggleButtonGroup>
        {onRunCheck && (
          <Button size="small" variant="contained" onClick={onRunCheck} disabled={isChecking}
            sx={{ textTransform: 'none', fontSize: '0.72rem', px: 1.5, py: 0.3, borderRadius: '8px', bgcolor: gold, minWidth: 0, '&:hover': { bgcolor: alpha(gold, 0.85) } }}>
            {isChecking ? 'Checking...' : 'Run Check'}
          </Button>
        )}
        {!isChecking && errors.length > 0 && (
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
            <strong style={{ color: theme.palette.error.main }}>{errors.length}</strong> errors
          </Typography>
        )}
        {!isChecking && errors.length === 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 15, color: '#4caf50' }} />
            <Typography sx={{ fontSize: '0.72rem', color: '#4caf50', fontWeight: 600 }}>Clear</Typography>
          </Box>
        )}
      </Box>

      {/* Progress bar while checking */}
      {isChecking && <LinearProgress sx={{ height: 2, '& .MuiLinearProgress-bar': { bgcolor: gold } }} />}

      {/* Error list */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1 }}>
        {isChecking ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pt: 5 }}>
            <CircularProgress size={28} sx={{ color: gold }} />
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
              {scope === 'document' ? `Checking ${totalPages} pages...` : `Checking page ${currentPage}...`}
            </Typography>
          </Box>
        ) : errors.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pt: 5 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 40, color: alpha('#4caf50', 0.5) }} />
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', textAlign: 'center' }}>
              No spelling errors in {scope === 'page' ? `page ${currentPage}` : 'the document'}.
            </Typography>
          </Box>
        ) : (
          errors.map((err, idx) => (
            <Box
              key={`${err.pageNumber}-${"text"}-${0}-${idx}`}
              onClick={() => onJumpToError(err)}
              sx={{
                mb: 0.75, p: 1.25, borderRadius: '8px', border: `1px solid ${theme.palette.divider}`,
                cursor: 'pointer', transition: 'border-color 0.15s, background-color 0.15s',
                '&:hover': { borderColor: alpha(gold, 0.5), bgcolor: alpha(gold, 0.04) },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                <Typography component="span" sx={{
                  fontSize: '0.85rem', fontWeight: 700, color: theme.palette.error.main,
                  textDecoration: 'wavy underline', textDecorationColor: theme.palette.error.main,
                }}>{err.word}</Typography>
                {err.suggestions.length > 0 && (
                  <>
                    <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary', mx: 0.5 }}>&rarr;</Typography>
                    {err.suggestions.slice(0, 3).map(s => (
                      <Chip key={s} label={s} size="small"
                        sx={{
                          height: 20, fontSize: '0.68rem', fontWeight: 600,
                          bgcolor: alpha('#4caf50', 0.1), color: '#4caf50',
                          border: `1px solid ${alpha('#4caf50', 0.3)}`,
                        }}
                      />
                    ))}
                  </>
                )}
              </Box>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.3, mb: 0.5, fontFamily: 'monospace' }}>{err.context}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip label={"text"} size="small" sx={{
                    height: 16, fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                    bgcolor: alpha(FIELD_COLORS["text"] || '#888', 0.12), color: FIELD_COLORS["text"] || '#888',
                  }} />
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>P.{err.pageNumber + 1}</Typography>
                </Box>
                <Box onClick={(e) => { e.stopPropagation(); onIgnoreWord(err.word); }}
                  sx={{ px: 1, py: 0.25, borderRadius: '6px', cursor: 'pointer',
                    border: `1px solid ${theme.palette.divider}`, fontSize: '0.65rem', fontWeight: 600,
                    color: 'text.secondary', '&:hover': { borderColor: '#f44336', color: '#f44336', bgcolor: alpha('#f44336', 0.05) },
                    transition: 'all 0.12s', whiteSpace: 'nowrap',
                  }}>
                  Ignore
                </Box>
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

/* ── Checklist sub-panel ── */

function ChecklistContent({
  documentId, projectId, currentPage, numPages, userId, userName,
  projectUsers, onJumpToPage, onPlacePin, versions, onLoadPreviousReview, onReviewCompleted, viewReview, onViewReviewClear,
}: {
  documentId: string;
  projectId: string;
  currentPage: number;
  numPages: number;
  userId: string;
  userName?: string;
  projectUsers?: { id: string; name: string; email: string }[];
  onJumpToPage: (page: number) => void;
  onPlacePin: (pageNumber: number, x: number, y: number, itemId: string) => void;
  versions?: Array<{ id: string; createdAt: string }>;
  onLoadPreviousReview?: (review: any) => void;
  onReviewCompleted?: () => void;
  viewReview?: any;
  onViewReviewClear?: () => void;
}) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [completedReviews, setCompletedReviews] = useState<any[]>([]);

  // When parent passes a viewReview (from Reports "View Details"), load it
  useEffect(() => {
    if (viewReview && viewReview.id && viewReview.items) {
      setReview(viewReview);
      const cm: Record<string, string> = {};
      (viewReview.items || []).forEach((it: any) => { if (it.comment) cm[it.id] = it.comment; });
      setComments(cm);
    }
  }, [viewReview]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [completeSummary, setCompleteSummary] = useState('');
  const [completeAssignee, setCompleteAssignee] = useState('');
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateItems, setNewTemplateItems] = useState<{ title: string; group: string }[]>([{ title: '', group: '' }]);
  useEffect(() => { setExpandedItem(null); }, [review?.id]);

  // Load existing review or templates
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // Try to load active review for this document
        const reviews: any[] = await apiFetch(`/api/reviews?documentId=${documentId}`);
        // Restore in_progress first, then show latest completed
        const active = reviews.find(r => r.status === 'in_progress');
        // Store all completed reviews for the reports list
        if (!cancelled) setCompletedReviews(reviews.filter(r => r.status === 'completed'));
        // Only auto-restore in_progress reviews (NOT completed)
        const restore = active;
        if (!cancelled && restore) {
          // If we have a full review with items, use it. Otherwise fetch details.
          if (restore.items?.length > 0) {
            setReview(normalizeReview(restore));
            const cm: Record<string, string> = {};
            restore.items.forEach((it: any) => { if (it.comment) cm[it.id] = it.comment; });
            setComments(cm);
          } else {
            // Fetch full review with items
            try {
              const full: Review = await apiFetch(`/api/reviews/${restore.id}`);
              if (!cancelled && full) {
                setReview(normalizeReview(full));
                const cm: Record<string, string> = {};
                (full.items || []).forEach(it => { if (it.comment) cm[it.id] = it.comment; });
                setComments(cm);
              }
            } catch { /* fallback: use what we have */ if (!cancelled) setReview(normalizeReview(restore)); }
          }
          // Save in_progress review ID to localStorage for reload recovery
          if (restore.status === 'in_progress') {
            try { localStorage.setItem(`review-${documentId}`, JSON.stringify(restore.id)); } catch {}
          }
        } else if (!cancelled) {
          // No active in_progress review from API — explicitly clear state
          setReview(null);
          // Try localStorage backup — only restore in_progress
          try {
            const savedId = localStorage.getItem(`review-${documentId}`);
            if (savedId) {
              const full: Review = await apiFetch(`/api/reviews/${JSON.parse(savedId)}`);
              if (full?.items && full.status === 'in_progress') {
                setReview(normalizeReview(full));
                const cm: Record<string, string> = {};
                full.items.forEach(it => { if (it.comment) cm[it.id] = it.comment; });
                setComments(cm);
              } else {
                // Stale backup — clear it
                localStorage.removeItem(`review-${documentId}`);
              }
            }
          } catch { localStorage.removeItem(`review-${documentId}`); }
        }
      } catch {
        // No reviews endpoint yet - that's fine
      }
      try {
        const tpls: ChecklistTemplate[] = await apiFetch(`/api/checklist-templates?projectId=${projectId}`);
        if (!cancelled) setTemplates(tpls);
      } catch {
        // Templates not available yet
        if (!cancelled) setTemplates(getDefaultTemplates());
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [documentId, projectId]);

  const startReview = useCallback(async (template: ChecklistTemplate | null) => {
    const items: ReviewItem[] = template
      ? template.items.map((it, i) => ({
          id: `item-${i}-${Date.now()}`,
          title: it.title,
          group: it.group,
          result: null,
        }))
      : [{ id: `item-0-${Date.now()}`, title: 'New item', result: null }];

    const newReview: Review = {
      id: `review-${Date.now()}`,
      templateName: template?.name || 'Blank Review',
      status: 'in_progress',
      inspectorId: userId,
      inspectorName: userName || 'Inspector',
      createdAt: new Date().toISOString(),
      items,
    };

    try {
      const saved: Review = await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          documentId,
          templateId: template?.id,
          templateName: newReview.templateName,
          items: newReview.items,
        }),
      });
      if (saved?.id) {
        // Fetch full review with items
        const full: Review = await apiFetch(`/api/reviews/${saved.id}`);
        setReview(full || saved);
        try { localStorage.setItem(`review-${documentId}`, JSON.stringify(saved.id)); } catch {}
      } else {
        setReview(saved);
      }
    } catch {
      // API not ready - use local state
      setReview(newReview);
    }
  }, [documentId, userId, userName]);

  const updateItem = useCallback(async (itemId: string, result: 'pass' | 'fail' | 'skip', comment?: string) => {
    setReview(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(it => it.id === itemId ? { ...it, result, comment: comment ?? it.comment } : it),
      };
    });
    if (result === 'fail') {
      setExpandedItem(itemId);
    } else {
      setExpandedItem(null);
    }
    try {
      if (review) {
        await apiFetch(`/api/reviews/${review.id}/items/${itemId}`, {
          method: 'PATCH',
          body: JSON.stringify({ result, comment }),
        });
      }
    } catch { /* API not ready */ }
  }, [documentId, review]);

  const saveComment = useCallback(async (itemId: string) => {
    const comment = comments[itemId] || '';
    setReview(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(it => it.id === itemId ? { ...it, comment } : it),
      };
    });
    try {
      if (review) {
        await apiFetch(`/api/reviews/${review.id}/items/${itemId}`, {
          method: 'PATCH',
          body: JSON.stringify({ comment }),
        });
      }
    } catch { /* */ }
  }, [documentId, review, comments]);

  const handlePlacePin = useCallback((itemId: string) => {
    // The parent will handle pin placement mode
    // We use a simple approach: place pin at current page center
    onPlacePin(currentPage - 1, 0.5, 0.5, itemId);
    // Update item with page number
    setReview(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(it => it.id === itemId ? { ...it, pageNumber: currentPage } : it),
      };
    });
  }, [currentPage, onPlacePin]);

  const completeReview = useCallback(async () => {
    if (!review) return;
    try {
      await apiFetch(`/api/reviews/${review.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completed',
          summary: completeSummary,
          assigneeId: completeAssignee || undefined,
        }),
      });
      setReview(null);
      setShowCompleteDialog(false);
      setCompleteSummary('');
      setCompleteAssignee('');
      localStorage.removeItem(`review-${documentId}`);
      onReviewCompleted?.();
      toast.success('Review completed');
    } catch {
      toast.error('Failed to complete review');
    }
  }, [review, completeSummary, completeAssignee, documentId, onReviewCompleted]);

  const markFixed = useCallback(async (itemId: string) => {
    setReview(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(it => it.id === itemId ? { ...it, fixedAt: new Date().toISOString() } : it),
      };
    });
    try {
      if (review) {
        await apiFetch(`/api/reviews/${review.id}/items/${itemId}/fix`, { method: 'PATCH' });
      }
    } catch {
      toast.error('Failed to mark as fixed');
      setReview(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map(it => it.id === itemId ? { ...it, fixedAt: undefined } : it),
        };
      });
    }
  }, [documentId, review]);

  const saveNewTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) return;
    const validItems = newTemplateItems.filter(it => it.title.trim());
    if (validItems.length === 0) return;
    const tpl: ChecklistTemplate = {
      id: `tpl-${Date.now()}`,
      name: newTemplateName.trim(),
      items: validItems.map(it => ({ title: it.title.trim(), group: it.group.trim() || undefined })),
    };
    try {
      await apiFetch(`/api/checklist-templates`, {
        method: 'POST',
        body: JSON.stringify({ ...tpl, projectId }),
      });
    } catch { /* */ }
    setTemplates(prev => [...prev, tpl]);
    setShowNewTemplate(false);
    setNewTemplateName('');
    setNewTemplateItems([{ title: '', group: '' }]);
  }, [newTemplateName, newTemplateItems, projectId]);

  // Progress stats
  const stats = useMemo(() => {
    if (!review) return { total: 0, done: 0, pass: 0, fail: 0, skip: 0 };
    const items = review.items;
    return {
      total: items.length,
      done: items.filter(i => i.result !== null).length,
      pass: items.filter(i => i.result === 'pass').length,
      fail: items.filter(i => i.result === 'fail').length,
      skip: items.filter(i => i.result === 'skip').length,
    };
  }, [review]);

  /* ── Previous version reviews (for re-inspection) ── */
  const [prevReviews, setPrevReviews] = useState<any[]>([]);
  useEffect(() => {
    if (!versions || versions.length < 2) { setPrevReviews([]); return; }
    let cancelled = false;
    (async () => {
      const all: any[] = [];
      for (const v of versions) {
        if (cancelled) break;
        if (v.id === documentId) continue;
        try {
          const reviews: any[] = await apiFetch(`/api/reviews?documentId=${v.id}`);
          if (Array.isArray(reviews)) {
            for (const r of reviews) all.push({ ...r, versionId: v.id, versionDate: v.createdAt });
          }
        } catch { /* ignore */ }
      }
      if (!cancelled) setPrevReviews(all.filter(r => r.status === 'completed'));
    })();
    return () => { cancelled = true; };
  }, [versions, documentId]);

  // Group items — MUST be before any early returns (React hooks rule)
  const groups = useMemo(() => {
    if (!review?.items) return new Map<string, ReviewItem[]>();
    const map = new Map<string, ReviewItem[]>();
    review.items.forEach(it => {
      const g = it.group || '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(it);
    });
    return map;
  }, [review?.items]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
        <CircularProgress size={28} sx={{ color: gold }} />
      </Box>
    );
  }

  /* ── No active review → show reports + template selection ── */
  if (!review) {
    return (
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 1 }}>
          Select a checklist template to start:
        </Typography>

        {templates.map(tpl => (
          <Box key={tpl.id} onClick={() => startReview(tpl)}
            sx={{
              mb: 0.75, p: 1.25, borderRadius: '8px', border: `1px solid ${theme.palette.divider}`,
              cursor: 'pointer', transition: 'all 0.15s',
              '&:hover': { borderColor: alpha(gold, 0.5), bgcolor: alpha(gold, 0.04) },
            }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon sx={{ fontSize: 18, color: gold }} />
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{tpl.name}</Typography>
              <Chip label={`${tpl.items.length} items`} size="small" sx={{ height: 18, fontSize: '0.62rem', ml: 'auto' }} />
              <IconButton size="small" onClick={async (e) => {
                e.stopPropagation();
                try {
                  await apiFetch(`/api/checklist-templates/${tpl.id}`, { method: 'DELETE' });
                  setTemplates(prev => prev.filter(t => t.id !== tpl.id));
                  toast.success('Template deleted');
                } catch { toast.error('Failed to delete template'); }
              }} sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: '#f44336' } }}>
                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Box>
          </Box>
        ))}

        <Button size="small" startIcon={<AddIcon />} onClick={() => setShowNewTemplate(true)}
          sx={{ mt: 1, textTransform: 'none', fontSize: '0.8rem', color: gold }}>
          New Template
        </Button>

        <Button variant="outlined" fullWidth onClick={() => startReview(null)}
          sx={{ mt: 1.5, textTransform: 'none', fontSize: '0.82rem', borderColor: theme.palette.divider, color: 'text.secondary' }}>
          Start Blank Review
        </Button>

        {/* Previous version reviews — for re-inspection */}
        {prevReviews.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: alpha(gold, 0.7), mb: 0.5 }}>
              Previous Version Reviews
            </Typography>
            {prevReviews.map(pr => {
              const failCount = (pr.items || []).filter((i: any) => i.result === 'fail').length;
              return (
                <Box key={pr.id} onClick={() => onLoadPreviousReview?.(pr)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 0.5,
                    borderRadius: '8px', cursor: 'pointer', border: `1px solid ${theme.palette.divider}`,
                    '&:hover': { bgcolor: alpha(gold, 0.06), borderColor: alpha(gold, 0.4) },
                  }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '6px', bgcolor: alpha('#f44336', 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f44336', fontSize: '0.7rem', fontWeight: 800 }}>
                    {failCount}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{pr.template?.name || 'Review'}</Typography>
                    <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
                      {failCount} issues · {new Date(pr.versionDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.62rem', color: gold, fontWeight: 600 }}>Verify →</Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {/* New template inline form */}
        <Collapse in={showNewTemplate}>
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '8px', border: `1px solid ${alpha(gold, 0.3)}`, bgcolor: alpha(gold, 0.02) }}>
            <TextField size="small" fullWidth placeholder="Template name" value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              sx={{ mb: 1, '& .MuiInputBase-root': { fontSize: '0.82rem' } }} />
            {newTemplateItems.map((item, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                <TextField size="small" placeholder="Item title" value={item.title}
                  onChange={e => {
                    const arr = [...newTemplateItems];
                    arr[idx] = { ...arr[idx], title: e.target.value };
                    setNewTemplateItems(arr);
                  }}
                  sx={{ flex: 2, '& .MuiInputBase-root': { fontSize: '0.78rem' } }} />
                <TextField size="small" placeholder="Group" value={item.group}
                  onChange={e => {
                    const arr = [...newTemplateItems];
                    arr[idx] = { ...arr[idx], group: e.target.value };
                    setNewTemplateItems(arr);
                  }}
                  sx={{ flex: 1, '& .MuiInputBase-root': { fontSize: '0.78rem' } }} />
              </Box>
            ))}
            <Button size="small" onClick={() => setNewTemplateItems(p => [...p, { title: '', group: '' }])}
              sx={{ fontSize: '0.72rem', textTransform: 'none', color: 'text.secondary', mb: 1 }}>
              + Add item
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="contained" onClick={saveNewTemplate}
                sx={{ textTransform: 'none', fontSize: '0.78rem', bgcolor: gold, '&:hover': { bgcolor: alpha(gold, 0.85) } }}>
                Save Template
              </Button>
              <Button size="small" onClick={() => setShowNewTemplate(false)}
                sx={{ textTransform: 'none', fontSize: '0.78rem', color: 'text.secondary' }}>
                Cancel
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Box>
    );
  }

  /* ── Active or completed review ── */
  const isCompleted = review.status === 'completed';
  const progressPct = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Review header info */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          {isCompleted && (
            <Box onClick={() => { setReview(null); onViewReviewClear?.(); }} sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: '8px', cursor: 'pointer',
              border: `1.5px solid ${theme.palette.divider}`,
              '&:hover': { borderColor: gold, bgcolor: alpha(gold, 0.08) },
              transition: 'all 0.15s', flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </Box>
          )}
          <AssignmentIcon sx={{ fontSize: 16, color: gold }} />
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, flex: 1 }}>{review.templateName}</Typography>
          {isCompleted && <Chip label="Completed" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: alpha('#4caf50', 0.15), color: '#4caf50', fontWeight: 700 }} />}
        </Box>
        {!isCompleted && (
          <Box sx={{ mb: 0.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                {stats.done}/{stats.total} ({Math.round(progressPct)}%)
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                {stats.pass} pass / {stats.fail} fail / {stats.skip} skip
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progressPct}
              sx={{ height: 3, borderRadius: 2, bgcolor: alpha(gold, 0.1), '& .MuiLinearProgress-bar': { bgcolor: gold } }} />
          </Box>
        )}
        {isCompleted && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
            {stats.pass} passed, {stats.fail} failed, {stats.skip} skipped
            {review.assigneeName && ` | Assigned to: ${review.assigneeName}`}
          </Typography>
        )}
      </Box>

      {/* Items list */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 0.75 }}>
        {[...groups.entries()].map(([group, items]) => (
          <Box key={group}>
            {group && (
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.5, px: 0.5, pt: 1, pb: 0.25 }}>
                {group}
              </Typography>
            )}
            {items.map(item => {
              const isExpanded = expandedItem === item.id;
              return (
                <Box key={item.id} sx={{
                  mb: 0.5, borderRadius: '6px', border: `1px solid ${theme.palette.divider}`,
                  overflow: 'hidden', transition: 'border-color 0.15s',
                  ...(item.result === 'fail' && !item.fixedAt ? { borderColor: alpha(theme.palette.error.main, 0.3) } : {}),
                  ...(item.result === 'pass' || item.fixedAt ? { borderColor: alpha('#4caf50', 0.2) } : {}),
                }}>
                  {/* Item row */}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, minHeight: 40,
                    cursor: 'pointer', '&:hover': { bgcolor: alpha(gold, 0.03) },
                  }} onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                    {/* Result icon */}
                    {item.fixedAt ? (
                      <Tooltip title="Fixed"><BuildIcon sx={{ fontSize: 16, color: '#4caf50' }} /></Tooltip>
                    ) : item.result === 'pass' ? (
                      <CheckCircleIcon sx={{ fontSize: 16, color: '#4caf50' }} />
                    ) : item.result === 'fail' ? (
                      <CancelIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
                    ) : item.result === 'skip' ? (
                      <SkipNextIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    ) : (
                      <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    )}
                    {/* Title */}
                    <Typography sx={{
                      fontSize: '0.8rem', flex: 1,
                      ...(item.result === 'pass' || item.fixedAt ? { color: 'text.secondary' } : {}),
                      ...(item.result === 'fail' && !item.fixedAt ? { fontWeight: 600 } : {}),
                    }}>{item.title}</Typography>
                    {/* Page badge — click to jump */}
                    {item.pageNumber != null && (
                      <Chip label={`P.${item.pageNumber + 1}`} size="small"
                        onClick={(e) => { e.stopPropagation(); onJumpToPage(item.pageNumber! + 1); }}
                        sx={{ height: 18, fontSize: '0.6rem', cursor: 'pointer', '&:hover': { bgcolor: alpha(gold, 0.15) } }} />
                    )}
                    {isExpanded ? <ExpandLessIcon sx={{ fontSize: 16, color: 'text.disabled' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.disabled' }} />}
                  </Box>

                  {/* Expanded content */}
                  <Collapse in={isExpanded}>
                    <Box sx={{ px: 1, pb: 1, pt: 0.25 }}>
                      {/* Action buttons for unchecked items */}
                      {!isCompleted && item.result === null && (
                        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75 }}>
                          <Button size="small" variant="contained"
                            startIcon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                            onClick={() => updateItem(item.id, 'pass')}
                            sx={{ flex: 1, textTransform: 'none', fontSize: '0.72rem', bgcolor: '#4caf50', '&:hover': { bgcolor: '#43a047' }, minWidth: 0 }}>
                            Pass
                          </Button>
                          <Button size="small" variant="contained"
                            startIcon={<CancelIcon sx={{ fontSize: 14 }} />}
                            onClick={() => updateItem(item.id, 'fail')}
                            sx={{ flex: 1, textTransform: 'none', fontSize: '0.72rem', bgcolor: theme.palette.error.main, '&:hover': { bgcolor: theme.palette.error.dark }, minWidth: 0 }}>
                            Fail
                          </Button>
                          <Button size="small" variant="outlined"
                            onClick={() => updateItem(item.id, 'skip')}
                            sx={{ minWidth: 0, px: 1, textTransform: 'none', fontSize: '0.72rem', borderColor: theme.palette.divider, color: 'text.secondary' }}>
                            Skip
                          </Button>
                        </Box>
                      )}

                      {/* Re-judge for already checked items */}
                      {!isCompleted && item.result !== null && (
                        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75 }}>
                          {item.result !== 'pass' && (
                            <Button size="small" onClick={() => updateItem(item.id, 'pass')}
                              sx={{ minWidth: 0, px: 1, textTransform: 'none', fontSize: '0.68rem', color: '#4caf50' }}>Pass</Button>
                          )}
                          {item.result !== 'fail' && (
                            <Button size="small" onClick={() => updateItem(item.id, 'fail')}
                              sx={{ minWidth: 0, px: 1, textTransform: 'none', fontSize: '0.68rem', color: theme.palette.error.main }}>Fail</Button>
                          )}
                          {item.result !== 'skip' && (
                            <Button size="small" onClick={() => updateItem(item.id, 'skip')}
                              sx={{ minWidth: 0, px: 1, textTransform: 'none', fontSize: '0.68rem', color: 'text.secondary' }}>Skip</Button>
                          )}
                        </Box>
                      )}

                      {/* Comment area (shown for fail or if already has comment) */}
                      {(item.result === 'fail' || item.comment) && (
                        <Box sx={{ mb: 0.75 }}>
                          <TextField size="small" fullWidth multiline minRows={2} maxRows={4}
                            placeholder="Add comment..."
                            value={comments[item.id] ?? item.comment ?? ''}
                            onChange={e => setComments(p => ({ ...p, [item.id]: e.target.value }))}
                            onBlur={() => saveComment(item.id)}
                            disabled={isCompleted}
                            sx={{ '& .MuiInputBase-root': { fontSize: '0.78rem' } }} />
                        </Box>
                      )}

                      {/* Pin placement */}
                      {!isCompleted && (
                        <Button size="small" startIcon={<RoomIcon sx={{ fontSize: 14 }} />}
                          onClick={() => handlePlacePin(item.id)}
                          sx={{ textTransform: 'none', fontSize: '0.72rem', color: gold }}>
                          {item.pageNumber ? `Pinned on P.${item.pageNumber}` : 'Place pin on drawing'}
                        </Button>
                      )}

                      {/* Navigate to pin (completed review) */}
                      {isCompleted && item.pageNumber != null && (
                        <Button size="small" startIcon={<RoomIcon sx={{ fontSize: 14 }} />}
                          onClick={() => onJumpToPage(item.pageNumber! + 1)}
                          sx={{ textTransform: 'none', fontSize: '0.72rem', color: gold, mb: 0.5 }}>
                          Go to page {item.pageNumber + 1}
                        </Button>
                      )}

                      {/* Mark as fixed (completed review) */}
                      {isCompleted && item.result === 'fail' && !item.fixedAt && (
                        <Button size="small" variant="outlined" startIcon={<BuildIcon sx={{ fontSize: 14 }} />}
                          onClick={() => markFixed(item.id)}
                          sx={{ textTransform: 'none', fontSize: '0.72rem', borderColor: '#4caf50', color: '#4caf50' }}>
                          Mark as Fixed
                        </Button>
                      )}
                      {item.fixedAt && (
                        <Typography sx={{ fontSize: '0.68rem', color: '#4caf50' }}>
                          Fixed on {new Date(item.fixedAt).toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Bottom actions */}
      {!isCompleted && (
        <Box sx={{ px: 1.5, py: 1, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', gap: 1 }}>
          <Button size="small" variant="contained" fullWidth
            disabled={stats.done === 0}
            onClick={() => setShowCompleteDialog(true)}
            sx={{ textTransform: 'none', fontSize: '0.8rem', bgcolor: gold, '&:hover': { bgcolor: alpha(gold, 0.85) } }}>
            Complete Review
          </Button>
          <Button size="small" variant="outlined"
            onClick={() => setShowDiscardDialog(true)}
            sx={{ textTransform: 'none', fontSize: '0.78rem', borderColor: theme.palette.divider, color: 'text.secondary', minWidth: 0, px: 2 }}>
            Discard
          </Button>
        </Box>
      )}

      {/* Complete dialog */}
      <Dialog open={showCompleteDialog} onClose={() => { setShowCompleteDialog(false); setCompleteSummary(''); setCompleteAssignee(''); }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 700 }}>Complete Review</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1.5 }}>
            {stats.pass} passed, {stats.fail} failed, {stats.skip} skipped
          </Typography>
          <TextField fullWidth multiline minRows={2} maxRows={4} placeholder="Summary notes..."
            value={completeSummary} onChange={e => setCompleteSummary(e.target.value)}
            sx={{ mb: 1.5, '& .MuiInputBase-root': { fontSize: '0.82rem' } }} />
          {projectUsers && projectUsers.length > 0 && (
            <>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 0.5 }}>Assign fixes to:</Typography>
              <Select size="small" fullWidth displayEmpty value={completeAssignee}
                onChange={e => setCompleteAssignee(e.target.value as string)}
                sx={{ fontSize: '0.82rem' }}>
                <MenuItem value=""><em>None</em></MenuItem>
                {(projectUsers || []).map(u => (
                  <MenuItem key={u.id} value={u.id} sx={{ fontSize: '0.82rem' }}>{u.name || u.email}</MenuItem>
                ))}
              </Select>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowCompleteDialog(false); setCompleteSummary(''); setCompleteAssignee(''); }} sx={{ textTransform: 'none', fontSize: '0.82rem' }}>Cancel</Button>
          <Button variant="contained" onClick={completeReview}
            sx={{ textTransform: 'none', fontSize: '0.82rem', bgcolor: gold, '&:hover': { bgcolor: alpha(gold, 0.85) } }}>
            Complete & Notify
          </Button>
        </DialogActions>
      </Dialog>

      {/* Discard dialog */}
      <Dialog open={showDiscardDialog} onClose={() => setShowDiscardDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Discard Review?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
            All progress will be permanently lost. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowDiscardDialog(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={async () => {
            setShowDiscardDialog(false);
            // Delete from DB — try for any review with an ID
            if (review?.id) {
              try {
                await apiFetch(`/api/reviews/${review.id}`, { method: 'DELETE' });
              } catch (e: any) {
                console.warn('[ReviewPanel] delete failed:', e.message);
                // Fallback: mark as completed to prevent re-loading
                try { await apiFetch(`/api/reviews/${review.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', summary: 'Discarded' }) }); } catch {}
              }
            }
            setReview(null); setExpandedItem(null); setComments({});
            try { localStorage.removeItem(`review-${documentId}`); } catch {}
            toast.success('Review discarded');
          }} sx={{ textTransform: 'none' }}>Discard</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ── Default templates (fallback when API not available) ── */

function getDefaultTemplates(): ChecklistTemplate[] {
  return [
    {
      id: 'tpl-fire', name: 'Fire Protection',
      items: [
        { title: 'Sprinkler spacing per NFPA 13', group: 'Fire Safety' },
        { title: 'Exit sign placement', group: 'Fire Safety' },
        { title: 'Smoke detector coverage', group: 'Fire Safety' },
        { title: 'Fire alarm pull stations', group: 'Fire Safety' },
        { title: 'Fire-rated wall penetrations', group: 'Fire Safety' },
      ],
    },
    {
      id: 'tpl-elec', name: 'Electrical',
      items: [
        { title: 'Panel clearance (36" min)', group: 'Code Compliance' },
        { title: 'Circuit load calculation', group: 'Code Compliance' },
        { title: 'Grounding/bonding', group: 'Code Compliance' },
        { title: 'Conduit fill ratio', group: 'Design' },
        { title: 'Voltage drop calculation', group: 'Design' },
        { title: 'Emergency power circuits', group: 'Design' },
      ],
    },
    {
      id: 'tpl-mech', name: 'Mechanical',
      items: [
        { title: 'Ductwork sizing', group: 'HVAC' },
        { title: 'Equipment clearance', group: 'HVAC' },
        { title: 'Pipe insulation', group: 'Plumbing' },
        { title: 'Valve accessibility', group: 'Plumbing' },
        { title: 'Seismic bracing', group: 'Structural' },
      ],
    },
  ];
}

/* ── Main ReviewPanel ── */

const ReviewPanel = memo(function ReviewPanel({
  open, onClose, documentId, projectId, currentPage, numPages, userId, userName, projectUsers,
  spellErrors, spellScope, onSpellScopeChange, onJumpToSpellError, onFixSpellWord, onIgnoreSpellWord, isSpellChecking, onRunSpellCheck,
  onJumpToPage, onPlacePin, versions, onLoadPreviousReview,
}: ReviewPanelProps) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const isMobile = useMediaQuery('(max-width:1050px)');
  const [tab, setTab] = useState(0);
  const [completedReviews, setCompletedReviews] = useState<any[]>([]);
  const [review, setReview] = useState<any>(null);

  // Load completed reviews for Reports tab
  useEffect(() => {
    if (!open || !documentId) return;
    (async () => {
      try {
        const reviews: any[] = await apiFetch(`/api/reviews?documentId=${documentId}`);
        if (Array.isArray(reviews)) setCompletedReviews(reviews.filter(r => r.status === 'completed'));
      } catch { /* */ }
    })();
  }, [open, documentId]);

  const content = (
    <Box sx={{ width: isMobile ? '100%' : 340, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 0.75,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>QA/QC Review</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)}
        sx={{
          minHeight: 32,
          borderBottom: `1px solid ${theme.palette.divider}`,
          '& .MuiTab-root': {
            minHeight: 32, py: 0.5, fontSize: '0.78rem', fontWeight: 600, textTransform: 'none',
            '&.Mui-selected': { color: gold },
          },
          '& .MuiTabs-indicator': { bgcolor: gold },
        }}>
        <Tab icon={<SpellcheckIcon sx={{ fontSize: 18 }} />} aria-label="Spell Check" sx={{ flex: 1, minHeight: 32, minWidth: 0, p: 0 }} />
        <Tab icon={<AssignmentIcon sx={{ fontSize: 18 }} />} aria-label="Checklist" sx={{ flex: 1, minHeight: 32, minWidth: 0, p: 0 }} />
        <Tab icon={<AssessmentIcon sx={{ fontSize: 18 }} />} aria-label="Reports" sx={{ flex: 1, minHeight: 32, minWidth: 0, p: 0 }} />
      </Tabs>

      {/* Tab content — all mounted, hidden via display to preserve state */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ display: tab === 0 ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
          <SpellCheckContent
            errors={spellErrors}
            scope={spellScope}
            onScopeChange={onSpellScopeChange}
            onJumpToError={onJumpToSpellError}
            onFixWord={onFixSpellWord}
            onIgnoreWord={onIgnoreSpellWord}
            isChecking={isSpellChecking}
            currentPage={currentPage}
            totalPages={numPages}
            onRunCheck={onRunSpellCheck}
          />
        </Box>
        <Box sx={{ display: tab === 1 ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
          <ChecklistContent
            documentId={documentId}
            projectId={projectId}
            currentPage={currentPage}
            numPages={numPages}
            userId={userId}
            userName={userName}
            projectUsers={projectUsers}
            onJumpToPage={onJumpToPage}
            onPlacePin={onPlacePin}
            versions={versions}
            onLoadPreviousReview={onLoadPreviousReview}
            viewReview={review}
            onViewReviewClear={() => setReview(null)}
            onReviewCompleted={async () => {
              // Refresh completed reviews for Reports tab
              try {
                const reviews: any[] = await apiFetch(`/api/reviews?documentId=${documentId}`);
                if (Array.isArray(reviews)) setCompletedReviews(reviews.filter(r => r.status === 'completed'));
              } catch { /* */ }
            }}
          />
        </Box>
        {/* Reports tab */}
        <Box sx={{ display: tab === 2 ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0, overflowY: 'auto', px: 1.5, py: 1 }}>
          {completedReviews.length === 0 ? (
            <Box sx={{ textAlign: 'center', pt: 4 }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.disabled' }}>No review reports yet</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.5 }}>Complete a checklist review to see reports here</Typography>
            </Box>
          ) : (
            completedReviews.map(cr => {
              const inspName = cr.inspector?.name || cr.inspector?.email || 'Inspector';
              const failCount = cr.items?.filter((i: any) => i.result === 'fail')?.length || 0;
              const passCount = cr.items?.filter((i: any) => i.result === 'pass')?.length || 0;
              return (
                <Box key={cr.id} sx={{ mb: 1, p: 1.25, borderRadius: '10px', border: `1px solid ${theme.palette.divider}`, '&:hover': { borderColor: alpha(gold, 0.4) } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '6px', bgcolor: failCount > 0 ? alpha('#f44336', 0.1) : alpha('#4caf50', 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {failCount > 0
                        ? <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#f44336' }}>{failCount}</Typography>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="#4caf50"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{cr.template?.name || cr.summary || 'Review'}</Typography>
                      <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
                        {inspName} · {new Date(cr.completedAt || cr.createdAt).toLocaleDateString()} · {passCount}✓ {failCount}✗
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={async () => {
                      try {
                        await apiFetch(`/api/reviews/${cr.id}`, { method: 'DELETE' });
                        setCompletedReviews(prev => prev.filter(r => r.id !== cr.id));
                        toast.success('Review deleted');
                      } catch { toast.error('Failed to delete'); }
                    }} sx={{ p: 0.3, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Box>
                  {cr.summary && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic', mb: 0.5 }}>"{cr.summary}"</Typography>}
                  {cr.assignee && <Typography sx={{ fontSize: '0.62rem', color: gold }}>Assigned: {cr.assignee.name || cr.assignee.email}</Typography>}
                  <Typography onClick={async () => {
                    try { const full = await apiFetch(`/api/reviews/${cr.id}`); if (full) { setReview(normalizeReview(full)); setTab(1); } } catch {}
                  }} sx={{ fontSize: '0.68rem', fontWeight: 600, color: gold, cursor: 'pointer', mt: 0.5, '&:hover': { textDecoration: 'underline' } }}>
                    View Details →
                  </Typography>
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer anchor="bottom" open={open} onClose={onClose}
        PaperProps={{ sx: { maxHeight: '80vh', borderTopLeftRadius: 16, borderTopRightRadius: 16 } }}>
        {content}
      </Drawer>
    );
  }

  if (!open) return null;

  return (
    <Box sx={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 340, zIndex: 20,
      borderLeft: `1px solid ${theme.palette.divider}`, boxShadow: '-4px 0 16px rgba(0,0,0,0.08)',
    }}>
      {content}
    </Box>
  );
});

export default ReviewPanel;
