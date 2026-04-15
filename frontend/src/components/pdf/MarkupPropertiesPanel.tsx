import { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Box, Typography, IconButton, Button,
  Paper, Select, MenuItem, Tooltip, useTheme, alpha, InputBase, Slider,
  CircularProgress, Divider, Popover, Avatar, List, ListItemButton, ListItemIcon, ListItemText, Checkbox, FormControlLabel, useMediaQuery
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import ConstructionIcon from '@mui/icons-material/Construction';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { apiFetch } from '../../lib/api';
import toast from 'react-hot-toast';
import { useProjectUsers, type ProjectUser } from '../../hooks/useProjectUsers';
import { LINE_STYLES, LinePreview } from './PdfToolbar';
import { formatMeasurement } from './MarkupLayer';
import MentionText from './MentionText';
import { STATUS_COLORS, STATUS_LABELS } from './MarkupListItem';

const PANEL_WIDTH = 300;

interface MarkupPropertiesPanelProps {
  open: boolean;
  selectedMarkups: any[];
  onClose: () => void;
  onUpdateProperties: (markupId: string, properties: any) => void;
  onDeleteMarkup: (markupId: string | string[]) => void;
  documentId: string;
  projectId?: string;
  onAction?: (action: 'front' | 'back' | 'forward' | 'backward' | 'duplicate' | 'lock' | 'unlock', markupId: string) => void;
  markups: any[];
  canEdit?: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  docScale?: string;
  onPresetSaved?: () => void;
}

function getCommonValue(markups: any[], key: string): any {
  if (!markups || markups.length === 0) return undefined;
  const vals = markups.map(m => m.properties?.[key] ?? m[key]);
  const first = vals[0];
  return vals.every(v => v === first) ? first : '__varies__';
}

const PropertySlider = ({ label, value, onChange, min = 0, max = 100, step = 1, unit = '' }: any) => {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const isVaries = value === '__varies__';
  
  return (
    <Box mb={2.5}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: gold }}>
          {isVaries ? '---' : `${Math.round(value)}${unit}`}
        </Typography>
      </Box>
      <Slider 
        size="small" 
        value={isVaries ? 0 : value} 
        onChange={(_, v) => onChange(v)} 
        min={min} 
        max={max} 
        step={step}
        sx={{ 
          color: gold, 
          py: 1,
          '& .MuiSlider-rail': { opacity: 0.2 },
          '& .MuiSlider-thumb': {
            width: 12, height: 12,
            transition: '0.2s cubic-bezier(.47,1.64,.41,.8)',
            '&:hover, &.Mui-focusVisible': { boxShadow: `0px 0px 0px 8px ${alpha(gold, 0.16)}` },
            '&.Mui-active': { width: 16, height: 16 }
          }
        }} 
      />
    </Box>
  );
};

// Style keys saved in a simple Tool Chest preset (no geometry)
export const TOOL_CHEST_STYLE_KEYS = [
  'stroke', 'strokeWidth', 'lineStyle', 'fill', 'fillOpacity', 'textColor',
  'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'textAlign',
  'arrowSize', 'arrowStyle', 'cloudArcSize', 'textBoxFill', 'textBoxStroke',
  'connectorStyle', 'tickSize', 'extensionSize', 'stampShape', 'stampFill',
  'subject', 'status', 'text', 'labelTextColor', 'labelBg',
];
// These types support simple style presets (not full-copy stamps)
export const SIMPLE_PRESET_TYPES = new Set([
  'line', 'arrow', 'measure', 'rect', 'circle', 'ellipse', 'triangle', 'diamond',
  'hexagon', 'star', 'cloud', 'callout', 'text', 'polyline', 'highlighter', 'pen',
  'reviewStamp', 'routeTemplate', 'route',
]);

const MarkupPropertiesPanel = memo(function MarkupPropertiesPanel({
  open, selectedMarkups, onClose, onUpdateProperties, projectId, onAction, markups: allMarkups, canEdit = true, currentUserId, isAdmin = false, docScale = '1:1', onPresetSaved
}: MarkupPropertiesPanelProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Record<string, any>>({});
  const [newFieldName, setNewFieldName] = useState('');
  const [isAddingField, setIsAddingField] = useState(false);
  const [useTemplate, setUseTemplate] = useState(false); // ALWAYS DEFAULT TO FALSE

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionTargetField, setMentionTargetField] = useState<'subject' | 'comment' | string | null>(null);
  const mentionAnchorRef = useRef<HTMLDivElement>(null);
  const threadMentionAnchorRef = useRef<HTMLDivElement>(null);
  const { data: projectUsers = [] } = useProjectUsers(projectId);
  const saveTimerRef = useRef<any>(null);

  const [commentDraft, setCommentDraft] = useState<string | null>(null);
  const [commentFocused, setCommentFocused] = useState(false);
  const [threadDraft, setThreadDraft] = useState('');
  const [chestNameOpen, setChestNameOpen] = useState(false);
  const [chestNameInput, setChestNameInput] = useState('');
  const [chestSaving, setChestSaving] = useState(false);

  useEffect(() => {
    if (open && projectId) {
      setLoadingFields(true);
      apiFetch(`/api/project-markup-fields/${projectId}`)
        .then(data => { if (Array.isArray(data)) setCustomFields(data); })
        .catch(err => console.error(err))
        .finally(() => setLoadingFields(false));
    }
  }, [open, projectId]);

  // Only reset when the set of selected markup IDs changes, NOT when their content changes
  // (content changes happen on every Yjs update and would kill the comment draft while typing)
  const selectedIdsKey = (selectedMarkups || []).map((m: any) => m.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalOverrides({}); setCommentDraft(null); setCommentFocused(false); setUseTemplate(false); setThreadDraft(''); }, [selectedIdsKey]);

  const cv = useCallback((key: string) => getCommonValue(selectedMarkups, key), [selectedMarkups]);
  const gv = useCallback((key: string) => localOverrides[key] !== undefined ? localOverrides[key] : cv(key), [localOverrides, cv]);

  // Visual properties (color, width, line style, fill, etc.) ALWAYS apply only to selected markups.
  // Template mode (useTemplate) applies ONLY to text fields (subject, comment, custom params).
  const VISUAL_KEYS = new Set(['stroke', 'fill', 'fillOpacity', 'strokeWidth', 'lineStyle', 'fontSize', 'textColor', 'borderColor', 'borderWidth', 'arrowSize', 'arrowStyle', 'stampShape', 'stampFill']);

  const savePropertyImmediate = useCallback((key: string, value: any) => {
    const isVisual = VISUAL_KEYS.has(key);
    const isPermission = key === 'allowedEditUserIds' || key === 'allowedDeleteUserIds';
    const targets = (!isVisual && useTemplate) ? allMarkups : selectedMarkups;
    targets.forEach(m => {
      // Permissions can only be changed by the markup owner or admin
      if (isPermission && !isAdmin && (currentUserId == null || m.authorId !== currentUserId)) return;
      if (isPermission) {
        onUpdateProperties(m.id, { [key]: value });
      } else {
        const updatedProps: any = { ...m.properties, [key]: value };
        // When the user explicitly saves a text field, clear the duplicate flag so mentions work
        if (['comment', 'subject', 'text'].includes(key)) {
          delete updatedProps.isPastedOrDuplicated;
        }
        // Always include current coordinates to prevent position-reset on re-render
        onUpdateProperties(m.id, { coordinates: m.coordinates, properties: updatedProps });
      }
    });
  }, [selectedMarkups, allMarkups, useTemplate, onUpdateProperties, currentUserId, isAdmin]);

  const saveProperty = useCallback((key: string, value: any) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => savePropertyImmediate(key, value), 120);
  }, [savePropertyImmediate]);

  const handleLocalChange = useCallback((key: string, value: any, immediate = false) => {
    setLocalOverrides(prev => ({ ...prev, [key]: value }));
    if (immediate) savePropertyImmediate(key, value); else saveProperty(key, value);
  }, [saveProperty, savePropertyImmediate]);

  const [addFieldForAll, setAddFieldForAll] = useState(false);
  const [addFieldError, setAddFieldError] = useState('');

  // Add a custom property — either to selected markup(s) only or to ALL markups
  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    const key = newFieldName.trim();

    // Check for duplicate name
    const projectFieldKeys = new Set(customFields.map((f: any) => f.key));
    const first = selectedMarkups[0];
    const existingKeys = first?.properties ? Object.keys(first.properties) : [];
    if (projectFieldKeys.has(key) || existingKeys.includes(key)) {
      setAddFieldError(`Parameter "${key}" already exists`);
      return;
    }
    setAddFieldError('');

    const targets = addFieldForAll ? (allMarkups || []) : selectedMarkups;
    targets.forEach((m: any) => {
      onUpdateProperties(m.id, { properties: { ...m.properties, [key]: '' } });
    });
    setNewFieldName('');
    setIsAddingField(false);
    setAddFieldForAll(false);
  };

  const handleMentionInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: string) => {
    const value = e.target.value;
    const caretPos = e.target.selectionStart || 0;
    const textBeforeCaret = value.substring(0, caretPos);
    const lastAtIdx = textBeforeCaret.lastIndexOf('@');
    
    if (field === 'comment') {
      setCommentDraft(value);
    } else if (field === 'thread') {
      setThreadDraft(value);
    } else {
      handleLocalChange(field, value);
    }

    if (lastAtIdx !== -1) {
      const query = textBeforeCaret.substring(lastAtIdx + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query); setMentionOpen(true); setMentionTargetField(field);
        return;
      }
    }
    setMentionOpen(false); setMentionTargetField(null);
  };

  const handleSelectMention = (user: ProjectUser) => {
    if (!mentionTargetField) return;
    const currentVal = mentionTargetField === 'comment'
      ? (commentDraft ?? gv('comment') ?? '')
      : mentionTargetField === 'thread'
        ? threadDraft
        : (gv(mentionTargetField) || '');
    const lastAtIdx = currentVal.lastIndexOf('@');
    const newVal = currentVal.substring(0, lastAtIdx) + `@${user.name || user.email} ` + currentVal.substring(lastAtIdx + mentionQuery.length + 1);

    if (mentionTargetField === 'comment') {
      setCommentDraft(newVal);
      setCommentFocused(true);
    } else if (mentionTargetField === 'thread') {
      setThreadDraft(newVal);
    } else {
      handleLocalChange(mentionTargetField, newVal, true);
    }

    setMentionOpen(false); setMentionTargetField(null);
  };

  // ['*'] or null/empty-check = unrestricted; [] = nobody; [ids] = specific users
  const isRestricted = (field: string) => {
    const v = gv(field);
    if (!Array.isArray(v)) return false;
    return !v.includes('*'); // ['*'] = unrestricted = not restricted
  };

  const handleRestrictToggle = (field: string, restricted: boolean) => {
    // Toggle on → [] (nobody by default, user selects who); toggle off → ['*'] (everyone)
    handleLocalChange(field, restricted ? [] : ['*'], true);
  };

  const handleSaveToToolChest = useCallback(async () => {
    const name = chestNameInput.trim();
    const m = selectedMarkups?.[0];
    if (!name || !m) return;
    setChestSaving(true);
    try {
      const props = m.properties || {};
      const fields: any[] = [
        { key: '__markupType__', type: 'text', defaultValue: m.type },
        ...TOOL_CHEST_STYLE_KEYS
          .filter(k => props[k] !== undefined && props[k] !== null && props[k] !== '')
          .map(k => ({ key: k, type: typeof props[k] === 'number' ? 'number' : 'text', defaultValue: String(props[k]) })),
      ];
      await apiFetch('/api/presets', { method: 'POST', body: JSON.stringify({ name, fields, markupType: m.type }) });
      setChestNameOpen(false);
      setChestNameInput('');
      toast.success(`"${name}" saved to Tool Chest`);
      onPresetSaved?.();
    } catch (e: any) {
      toast.error('Failed to save to Tool Chest');
      console.error('Failed to save preset:', e);
    } finally {
      setChestSaving(false);
    }
  }, [chestNameInput, selectedMarkups, onPresetSaved]);

  if (!open || (selectedMarkups || []).length === 0) return null;

  const isSingle = (selectedMarkups || []).length === 1;
  const isMulti = (selectedMarkups || []).length > 1;
  const markup = isSingle ? selectedMarkups[0] : null;
  const markupType = isSingle ? markup?.type : null;
  const hasFill = ['rect', 'circle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'cloud', 'callout', 'text'].includes(markupType || '') || isMulti;
  const hasFillOpacity = hasFill;
  const hasLineStyle = !['pen', 'highlighter', 'text'].includes(markupType || '') || isMulti;
  const hasStrokeWidth = !['text'].includes(markupType || '') || isMulti || (markupType === 'text');
  // Font Size: for text/callout/stickyNote in main section; reviewStamp/electrical have their own dedicated section below
  const hasFontSize = ['text', 'callout', 'stickyNote'].includes(markupType || '') || isMulti;
  // Text Color: for text/callout/stickyNote in the main section; reviewStamp/electrical have their own dedicated section below
  const hasTextColor = ['text', 'callout', 'stickyNote'].includes(markupType || '') || isMulti;
  const isTextType = markupType === 'text' && !isMulti;

  const sectionSx = { px: 1.5, py: 1.5, width: '100%', boxSizing: 'border-box' };
  const labelSx = { fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.5, display: 'block' };
  const inputSx = { height: 28, fontSize: '0.82rem', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: '4px', '& fieldset': { borderColor: 'divider' }, '&:hover fieldset': { borderColor: alpha(gold, 0.4) }, '&.Mui-focused fieldset': { borderColor: `${gold} !important` } };
  const currentWidth = isMobile ? '100%' : PANEL_WIDTH;
  const getColorValue = (val: any, fallback: string) => (val === '__varies__' ? '#9e9e9e' : (val || fallback));
  const isVaries = (val: any) => val === '__varies__';

  return (
    <Paper elevation={0} sx={{ 
      position: 'absolute', right: 0, top: 0, bottom: 0, width: currentWidth, display: 'flex', flexDirection: 'column', 
      bgcolor: 'background.paper', borderLeft: '1px solid', borderColor: 'divider', 
      zIndex: 1200, overflow: 'hidden'
    }}>
      <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700}>{isMulti ? `${selectedMarkups.length} ${t('selected', 'Selected')}` : (markup?.properties?.subject || ({ rect: 'Rectangle', circle: 'Circle', ellipse: 'Ellipse', triangle: 'Triangle', diamond: 'Diamond', hexagon: 'Hexagon', star: 'Star', line: 'Line', arrow: 'Arrow', measure: 'Measure', polyline: 'Polyline', text: 'Text', pen: 'Pen', highlighter: 'Highlighter', cloud: 'Cloud', callout: 'Callout', image: 'Image', reviewStamp: 'Review Stamp', electricalBox: 'Junction Box', stub: 'Stub Up', panel: 'Panel', wireTag: 'Wire Tag', routeTemplate: 'Route Template', route: 'Route' } as Record<string, string>)[markup?.type] || markup?.type || t('properties', 'Properties'))}</Typography>
        <IconButton size="small" onClick={onClose} sx={{ p: 0.5 }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
      </Box>
      {!canEdit && (
        <Box sx={{ mx: 2, mb: 1, mt: 1, px: 1.5, py: 0.75, borderRadius: '6px', bgcolor: 'warning.main', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon sx={{ fontSize: 14, color: 'warning.contrastText' }} />
          <Typography sx={{ fontSize: '0.76rem', fontWeight: 600, color: 'warning.contrastText' }}>
            View only — you don't have edit rights
          </Typography>
        </Box>
      )}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ ...sectionSx, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: canEdit ? 'auto' : 'none' }}>
          {isSingle && onAction && (
            <Box display="flex" gap={0.5}>
              <Tooltip title={t('bringToFront', 'Bring to Front')}><IconButton size="small" onClick={() => onAction('front', markup!.id)} sx={{ p: 0.5 }}><FlipToFrontIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title={t('sendToBack', 'Send to Back')}><IconButton size="small" onClick={() => onAction('back', markup!.id)} sx={{ p: 0.5 }}><FlipToBackIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title={markup?.properties?.locked ? t('unlock', 'Unlock') : t('lock', 'Lock')}><IconButton size="small" onClick={() => onAction(markup!.properties?.locked ? 'unlock' : 'lock', markup!.id)} sx={{ p: 0.5, color: markup?.properties?.locked ? gold : 'inherit' }}>{markup?.properties?.locked ? <LockIcon sx={{ fontSize: 16 }} /> : <LockOpenIcon sx={{ fontSize: 16 }} />}</IconButton></Tooltip>
              {markup?.type === 'reviewStamp' && (
              <Tooltip title={markup?.properties?.pulse ? 'Disable pulse' : 'Enable pulse animation'}><IconButton size="small" onClick={() => onUpdateProperties(markup!.id, { properties: { ...markup!.properties, pulse: !markup?.properties?.pulse } })} sx={{ p: 0.5, color: markup?.properties?.pulse ? '#e91e63' : 'inherit' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>{markup?.properties?.pulse && <circle cx="12" cy="12" r="4" />}</svg>
              </IconButton></Tooltip>
              )}
              {/* Save to Tool Chest — style preset */}
              {markup && SIMPLE_PRESET_TYPES.has(markup.type) && (
                <Tooltip title="Save style to Tool Chest">
                  <IconButton size="small" onClick={() => { setChestNameInput(markup.properties?.subject || ''); setChestNameOpen(v => !v); }} sx={{ p: 0.5, color: chestNameOpen ? gold : 'inherit' }}>
                    <ConstructionIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
        {/* Inline preset name input */}
        {chestNameOpen && isSingle && markup && SIMPLE_PRESET_TYPES.has(markup.type) && (
          <Box sx={{ px: 1.5, pb: 1, display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <InputBase
              value={chestNameInput}
              onChange={e => setChestNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveToToolChest(); if (e.key === 'Escape') setChestNameOpen(false); }}
              placeholder="Preset name..."
              autoFocus
              sx={{ flex: 1, fontSize: '0.78rem', px: 1, py: 0.4, borderRadius: '6px', border: `1px solid ${alpha(gold, 0.4)}`, bgcolor: 'transparent' }}
            />
            <IconButton size="small" disabled={!chestNameInput.trim() || chestSaving} onClick={handleSaveToToolChest} sx={{ p: 0.5, color: gold }}>
              {chestSaving ? <CircularProgress size={14} /> : <CheckIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          </Box>
        )}

        {/* Creator / Updater info */}
        {isSingle && markup && (
          <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            {markup.author && (
              <Box display="flex" alignItems="center" gap={0.75}>
                <PersonIcon sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.2 }}>
                  {t('createdBy', 'Created by')} <strong style={{ color: 'inherit' }}>{markup.properties?.bluebeamAuthor as string || markup.author?.name || markup.author?.email || '—'}</strong>
                  {markup.createdAt && <> · {dayjs(markup.createdAt).format('MM/DD/YY HH:mm')}</>}
                </Typography>
              </Box>
            )}
            {markup.updatedBy && (
              <Box display="flex" alignItems="center" gap={0.75}>
                <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.2 }}>
                  {t('updatedBy', 'Updated by')} <strong style={{ color: 'inherit' }}>{markup.updatedBy?.name || markup.updatedBy?.email || '—'}</strong>
                  {markup.updatedAt && <> · {dayjs(markup.updatedAt).format('MM/DD/YY HH:mm')}</>}
                </Typography>
              </Box>
            )}
            {markup.properties?.source === 'bluebeam_import' && (
              <Box display="flex" alignItems="center" gap={0.75} sx={{ mt: 0.25 }}>
                <Box component="span" sx={{
                  fontSize: '0.58rem', fontWeight: 800, color: 'warning.main',
                  border: '1px solid', borderColor: 'warning.main', borderRadius: 0.5,
                  px: 0.4, lineHeight: 1.5,
                }}>BB</Box>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                  {t('importedFromBluebeam', 'Imported from Bluebeam')}
                  {markup.properties?.bluebeamAuthor && (
                    <> · <strong>{markup.properties.bluebeamAuthor as string}</strong></>
                  )}
                </Typography>
              </Box>
            )}
          </Box>
        )}
        <Divider />
        {/* Polyline/route length display, label + show/hide toggles */}
        {['polyline', 'routeTemplate', 'route'].includes(markupType) && (
          <Box sx={{ px: 1.5, py: 1 }}>
            {isSingle && markup?.properties?.pathLength != null && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Length
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: gold }}>
                  {formatMeasurement(markup.properties.pathLength, docScale).text}
                </Typography>
              </Box>
            )}
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={gv('showLength') !== false}
                  disabled={!canEdit}
                  onChange={e => handleLocalChange('showLength', e.target.checked, true)}
                  sx={{ py: 0, color: gold, '&.Mui-checked': { color: gold } }}
                />
              }
              label={<Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Show length on canvas</Typography>}
              sx={{ ml: 0 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={gv('showLabel') !== false}
                  disabled={!canEdit}
                  onChange={e => handleLocalChange('showLabel', e.target.checked, true)}
                  sx={{ py: 0, color: gold, '&.Mui-checked': { color: gold } }}
                />
              }
              label={<Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Show label on canvas</Typography>}
              sx={{ ml: 0, mb: 1 }}
            />
            <Box mb={1.5} display="flex" alignItems="center" gap={1}>
              <Typography sx={labelSx} mb={0} minWidth={50}>Label</Typography>
              <InputBase fullWidth value={gv('label') || gv('redlineLabel') || ''} placeholder="e.g. 3/4&quot; EMT"
                onChange={e => handleLocalChange('label', e.target.value)}
                onBlur={e => savePropertyImmediate('label', (e.target as HTMLInputElement).value)}
                disabled={!canEdit}
                sx={{ ...inputSx, flex: 1, px: 1 }} />
            </Box>
          </Box>
        )}
        {['polyline', 'routeTemplate', 'route'].includes(markupType) && gv('conduitSize') && (
          <Box sx={{ px: 1.5, py: 1 }}>
            <Typography sx={labelSx} mb={0.5}>Label</Typography>
            <InputBase
              value={gv('redlineLabel') || ''}
              onChange={e => handleLocalChange('redlineLabel', e.target.value)}
              onBlur={e => savePropertyImmediate('redlineLabel', e.target.value)}
              sx={{ ...inputSx, px: 1 }}
              placeholder='e.g. 2"'
            />
          </Box>
        )}
        <Box sx={{ ...sectionSx, pointerEvents: canEdit ? 'auto' : 'none' }}>
          <Box display="flex" gap={2} mb={3}>
            {/* For text type: show Text Color + Background; for others: show Stroke + Fill */}
            {isTextType ? (
              <>
                <Box flex={1}>
                  <Typography sx={labelSx} mb={0.5}>Text Color</Typography>
                  <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('textColor'), '#000000'), border: '1px solid #ccc' }} />
                    <input type="color" value={gv('textColor') || '#000000'} onChange={e => handleLocalChange('textColor', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                  </Box>
                </Box>
                <Box flex={1}>
                  <Typography sx={labelSx} mb={0.5}>Background</Typography>
                  <Box display="flex" gap={1} alignItems="center">
                    <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('fill'), 'transparent'), border: '1px solid #ccc' }} />
                      <input type="color" value={gv('fill') || '#ffffff'} onChange={e => handleLocalChange('fill', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    </Box>
                    <IconButton size="small" onClick={() => handleLocalChange('fill', 'transparent', true)} sx={{ p: 0.5 }}><Typography sx={{ fontSize: '0.70rem', fontWeight: 700 }}>NONE</Typography></IconButton>
                  </Box>
                </Box>
              </>
            ) : (
              <>
                <Box flex={1}>
                  <Typography sx={labelSx} mb={0.5}>{t('strokeColor', 'Stroke')}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('stroke'), '#d32f2f'), border: '1px solid #ccc' }} />
                      <input type="color" value={isVaries(gv('stroke')) ? '#9e9e9e' : (gv('stroke') || '#d32f2f')} onChange={e => handleLocalChange('stroke', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    </Box>
                  </Box>
                </Box>
                {hasFill && (
                  <Box flex={1}>
                    <Typography sx={labelSx} mb={0.5}>{t('fillColor', 'Fill')}</Typography>
                    <Box display="flex" gap={1} alignItems="center">
                      <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                        <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('fill'), 'transparent'), border: '1px solid #ccc' }} />
                        <input type="color" value={isVaries(gv('fill')) ? '#9e9e9e' : (gv('fill') || '#ffffff')} onChange={e => handleLocalChange('fill', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                      </Box>
                      <IconButton size="small" onClick={() => handleLocalChange('fill', 'transparent', true)} sx={{ p: 0.5 }}><Typography sx={{ fontSize: '0.70rem', fontWeight: 700 }}>NONE</Typography></IconButton>
                    </Box>
                  </Box>
                )}
              </>
            )}
          </Box>
          {/* Text color for callout/cloud/multi (shapes with embedded text, not the standalone text type) */}
          {!isTextType && hasTextColor && (
            <Box mb={2}>
              <Typography sx={labelSx} mb={0.5}>Text Color</Typography>
              <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('textColor'), '#000000'), border: '1px solid #ccc' }} />
                <input type="color" value={isVaries(gv('textColor')) ? '#9e9e9e' : (gv('textColor') || '#000000')} onChange={e => handleLocalChange('textColor', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
              </Box>
            </Box>
          )}
          {/* Text type border controls */}
          {isTextType && (
            <Box mb={2}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography sx={labelSx} mb={0}>Border</Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box sx={{ position: 'relative', width: 22, height: 22 }}>
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: getColorValue(gv('stroke') && gv('stroke') !== 'transparent' ? gv('stroke') : '#000000', '#000000'), border: '1px solid #ccc' }} />
                    <input type="color" value={(!gv('stroke') || gv('stroke') === 'transparent') ? '#000000' : gv('stroke')} onChange={e => { handleLocalChange('stroke', e.target.value, true); if ((gv('strokeWidth') ?? 0) === 0) handleLocalChange('strokeWidth', 2, true); }} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                  </Box>
                  <IconButton size="small" onClick={() => {
                    const newW = (gv('strokeWidth') ?? 0) > 0 ? 0 : 2;
                    handleLocalChange('strokeWidth', newW, true);
                    if (newW > 0 && (!gv('stroke') || gv('stroke') === 'transparent')) {
                      handleLocalChange('stroke', '#000000', true);
                    }
                  }} sx={{ p: 0.5, fontSize: '0.70rem', fontWeight: 700, color: (gv('strokeWidth') ?? 0) > 0 ? gold : 'text.disabled' }}>
                    <Typography sx={{ fontSize: '0.70rem', fontWeight: 700 }}>{(gv('strokeWidth') ?? 0) > 0 ? 'ON' : 'OFF'}</Typography>
                  </IconButton>
                </Box>
              </Box>
              {(gv('strokeWidth') ?? 0) > 0 && (
                <PropertySlider label="Border Width" value={gv('strokeWidth') ?? 2} onChange={(v: number) => handleLocalChange('strokeWidth', v)} min={1} max={20} unit="px" />
              )}
            </Box>
          )}
          {hasFillOpacity && !isTextType && <PropertySlider label={t('opacity', 'Opacity')} value={(gv('fillOpacity') ?? 1) * 100} onChange={(v: number) => handleLocalChange('fillOpacity', v / 100)} unit="%" />}
          {hasStrokeWidth && !isTextType && <PropertySlider label={t('strokeWidth', 'Width')} value={gv('strokeWidth') ?? 2} onChange={(v: number) => handleLocalChange('strokeWidth', v)} min={1} max={50} unit="px" />}
          {/* Cloud Arc Size */}
          {markupType === 'cloud' && !isMulti && (
            <PropertySlider label="Arc Size" value={gv('cloudArcSize') ?? 20} onChange={(v: number) => handleLocalChange('cloudArcSize', v)} min={8} max={60} step={2} unit="px" />
          )}
          {hasLineStyle && (
            <Box mb={1}>
              <Typography sx={labelSx}>{t('lineStyle', 'Line Style')}</Typography>
              <Select
                size="small"
                fullWidth
                value={isVaries(gv('lineStyle')) ? '__varies__' : (gv('lineStyle') || 'solid')}
                onChange={e => handleLocalChange('lineStyle', e.target.value, true)}
                sx={inputSx}
                renderValue={(val) =>
                  val === '__varies__'
                    ? <em style={{ fontSize: '0.78rem' }}>{t('varies', 'Varies')}</em>
                    : <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <LinePreview style={val as any} width={gv('strokeWidth') || 2} previewWidth={180} />
                      </Box>
                }
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: 'background.paper', border: 1, borderColor: 'divider',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      '& .MuiMenuItem-root': {
                        borderRadius: '4px', mx: 0.5, my: 0.25,
                        '&:hover': { bgcolor: `${alpha(gold, 0.08)}` },
                        '&.Mui-selected': { bgcolor: `${alpha(gold, 0.12)}`, fontWeight: 600 }
                      }
                    }
                  }
                }}
              >
                {isVaries(gv('lineStyle')) && <MenuItem value="__varies__"><em>{t('varies', 'Varies')}</em></MenuItem>}
                {LINE_STYLES.map(s => (
                  <MenuItem key={s.key} value={s.key} sx={{ px: 1.5 }}>
                    <LinePreview style={s.key} width={2} previewWidth={220} />
                  </MenuItem>
                ))}
              </Select>
            </Box>
          )}
          {hasFontSize && <PropertySlider label={t('fontSize', 'Font Size')} value={gv('fontSize') ?? 14} onChange={(v: number) => handleLocalChange('fontSize', v)} min={1} max={1000} unit="px" />}
          {/* Electrical / Review Stamp types: full customization */}
          {['electricalBox', 'stub', 'panel', 'wireTag', 'reviewStamp'].includes(markupType) && !isMulti && (
            <>
              {/* Label / Text */}
              <Box mb={1.5} sx={{ pointerEvents: canEdit ? 'auto' : 'none' }}>
                <Typography sx={labelSx} mb={0.5}>Label</Typography>
                <textarea
                  value={gv('text') || ''}
                  onChange={e => handleLocalChange('text', e.target.value)}
                  onBlur={e => savePropertyImmediate('text', e.target.value)}
                  rows={1}
                  placeholder="Enter label..."
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '6px 8px', borderRadius: '4px', resize: 'vertical',
                    border: `1px solid rgba(128,128,128,0.3)`,
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    color: 'inherit', fontSize: '0.82rem', fontFamily: 'inherit', lineHeight: 1.4,
                    outline: 'none',
                  }}
                />
              </Box>
              {/* Text Color */}
              <Box mb={1.5} display="flex" alignItems="center" gap={1}>
                <Typography sx={labelSx} mb={0} minWidth={80}>Text Color</Typography>
                <Box sx={{ position: 'relative', width: 24, height: 24 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: gv('textColor') || gv('stroke') || '#000', border: '2px solid', borderColor: 'divider', cursor: 'pointer' }} />
                  <input type="color" value={gv('textColor') || gv('stroke') || '#000000'}
                    onChange={e => handleLocalChange('textColor', e.target.value)}
                    onBlur={e => savePropertyImmediate('textColor', e.target.value)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                </Box>
              </Box>
              {/* Text Size */}
              <Box mb={1.5} display="flex" alignItems="center" gap={1}>
                <Typography sx={labelSx} mb={0} minWidth={80}>Text Size</Typography>
                {(() => {
                  const raw = gv('fontSize');
                  const defaultFontSize = (() => {
                    const w = markup?.coordinates?.width || 0.03;
                    const h = markup?.coordinates?.height || 0.03;
                    const minDim = Math.min(w, h) * 1000;
                    return Math.round(minDim * 0.5);
                  })();
                  const displayVal = (raw !== undefined && raw !== null && raw !== 0) ? raw : defaultFontSize;
                  return (
                    <InputBase
                      value={displayVal}
                      onChange={e => handleLocalChange('fontSize', parseFloat(e.target.value) || 0)}
                      onBlur={e => savePropertyImmediate('fontSize', parseFloat((e.target as HTMLInputElement).value) || 0)}
                      type="number"
                      sx={{ ...inputSx, width: 70, px: 1 }}
                      placeholder={String(defaultFontSize)}
                    />
                  );
                })()}
              </Box>
              {/* Fill Color */}
              <Box mb={1.5} display="flex" alignItems="center" gap={1}>
                <Typography sx={labelSx} mb={0} minWidth={80}>Fill Color</Typography>
                {(() => {
                  const rawFill = gv('fill');
                  const defaultFill = (() => {
                    if (markupType === 'reviewStamp') {
                      return markup?.properties?.stampFill !== false ? (gv('stroke') || '#4caf50') : 'transparent';
                    }
                    return 'rgba(255,255,255,0.85)';
                  })();
                  const displayFill = (rawFill !== undefined && rawFill !== null) ? rawFill : defaultFill;
                  const colorInputVal = (!displayFill || displayFill === 'transparent' || displayFill.startsWith('rgba')) ? '#ffffff' : displayFill;
                  return (
                    <>
                      <Box sx={{ position: 'relative', width: 24, height: 24 }}>
                        <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: displayFill, border: '2px solid', borderColor: 'divider', cursor: 'pointer' }} />
                        <input type="color" value={colorInputVal}
                          onChange={e => handleLocalChange('fill', e.target.value)}
                          onBlur={e => savePropertyImmediate('fill', e.target.value)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                      </Box>
                      <Typography
                        onClick={() => { handleLocalChange('fill', 'transparent'); savePropertyImmediate('fill', 'transparent'); }}
                        sx={{ fontSize: '0.7rem', color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                        None
                      </Typography>
                    </>
                  );
                })()}
              </Box>
              {/* Fill Opacity */}
              <Box mb={1.5} display="flex" alignItems="center" gap={1}>
                <Typography sx={labelSx} mb={0} minWidth={80}>Fill Opacity</Typography>
                {(() => {
                  const rawOpacity = gv('fillOpacity');
                  const opacityVal = (rawOpacity !== undefined && rawOpacity !== null) ? rawOpacity as number : 1;
                  return (
                    <>
                      <Slider
                        size="small"
                        value={Math.round(opacityVal * 100)}
                        onChange={(_, v) => handleLocalChange('fillOpacity', (v as number) / 100)}
                        onChangeCommitted={(_, v) => savePropertyImmediate('fillOpacity', (v as number) / 100)}
                        min={0} max={100} step={5}
                        sx={{ flex: 1, color: 'primary.main' }}
                      />
                      <Typography sx={{ fontSize: '0.72rem', minWidth: 30 }}>{Math.round(opacityVal * 100)}%</Typography>
                    </>
                  );
                })()}
              </Box>
              {/* Corner Radius removed */}
              {/* Shape (reviewStamp only) */}
              {markupType === 'reviewStamp' && (
                <Box mb={1.5}>
                  <Typography sx={labelSx} mb={0.5}>Shape</Typography>
                  <Select size="small" fullWidth
                    value={gv('stampShape') || 'rounded'}
                    onChange={e => { handleLocalChange('stampShape', e.target.value); savePropertyImmediate('stampShape', e.target.value); }}
                    sx={inputSx}>
                    <MenuItem value="rounded">Rounded Rectangle</MenuItem>
                    <MenuItem value="rect">Rectangle</MenuItem>
                    <MenuItem value="circle">Circle</MenuItem>
                    <MenuItem value="diamond">Diamond</MenuItem>
                    <MenuItem value="triangle">Triangle</MenuItem>
                    <MenuItem value="cloud">Cloud</MenuItem>
                  </Select>
                </Box>
              )}
            </>
          )}
          {/* Panel-specific: editable width/height */}
          {markupType === 'panel' && !isMulti && selectedMarkups.length === 1 && (
            <Box mb={2} sx={{ pointerEvents: canEdit ? 'auto' : 'none' }}>
              <Typography sx={labelSx} mb={0.5}>Panel Size</Typography>
              <Box display="flex" gap={1}>
                <Box flex={1}>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mb: 0.3 }}>Width</Typography>
                  <input
                    type="number"
                    step="0.005"
                    min="0.01"
                    max="1"
                    value={Math.round((localOverrides._panelWidth ?? selectedMarkups[0]?.coordinates?.width ?? 0.05) * 100) / 100}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0.05;
                      setLocalOverrides(prev => ({ ...prev, _panelWidth: val }));
                      const m = selectedMarkups[0];
                      if (m) onUpdateProperties(m.id, { coordinates: { ...m.coordinates, width: val }, properties: m.properties });
                    }}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '5px 8px', borderRadius: '4px',
                      border: `1px solid rgba(128,128,128,0.3)`,
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      color: 'inherit', fontSize: '0.82rem', fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                </Box>
                <Box flex={1}>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mb: 0.3 }}>Height</Typography>
                  <input
                    type="number"
                    step="0.005"
                    min="0.01"
                    max="1"
                    value={Math.round((localOverrides._panelHeight ?? selectedMarkups[0]?.coordinates?.height ?? 0.05) * 100) / 100}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0.05;
                      setLocalOverrides(prev => ({ ...prev, _panelHeight: val }));
                      const m = selectedMarkups[0];
                      if (m) onUpdateProperties(m.id, { coordinates: { ...m.coordinates, height: val }, properties: m.properties });
                    }}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '5px 8px', borderRadius: '4px',
                      border: `1px solid rgba(128,128,128,0.3)`,
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      color: 'inherit', fontSize: '0.82rem', fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                </Box>
              </Box>
            </Box>
          )}
          {/* Callout-specific: inline text editing */}
          {markupType === 'callout' && !isMulti && (
            <Box mb={2} sx={{ pointerEvents: canEdit ? 'auto' : 'none' }}>
              <Typography sx={labelSx} mb={0.5}>Text</Typography>
              <textarea
                value={gv('text') || ''}
                onChange={e => handleLocalChange('text', e.target.value)}
                onBlur={e => savePropertyImmediate('text', e.target.value)}
                rows={3}
                placeholder="Enter callout text..."
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '6px 8px', borderRadius: '4px', resize: 'vertical',
                  border: `1px solid rgba(128,128,128,0.3)`,
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  color: 'inherit', fontSize: '0.82rem', fontFamily: 'inherit', lineHeight: 1.4,
                  outline: 'none',
                }}
              />
            </Box>
          )}
          {/* Callout-specific: text box background fill */}
          {markupType === 'callout' && !isMulti && (
            <Box mb={2}>
              <Typography sx={labelSx} mb={0.5}>Text Box Fill</Typography>
              <Box display="flex" gap={1} alignItems="center">
                <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('textBoxFill'), '#ffffff'), border: '1px solid #ccc' }} />
                  <input type="color" value={isVaries(gv('textBoxFill')) ? '#9e9e9e' : (gv('textBoxFill') || '#ffffff')} onChange={e => handleLocalChange('textBoxFill', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </Box>
                <IconButton size="small" onClick={() => handleLocalChange('textBoxFill', 'transparent', true)} sx={{ p: 0.5 }}><Typography sx={{ fontSize: '0.70rem', fontWeight: 700 }}>NONE</Typography></IconButton>
              </Box>
            </Box>
          )}
          {/* Text styling: font, bold/italic, alignment — for callout, stickyNote, text */}
          {(['callout', 'stickyNote', 'text'].includes(markupType || '') && !isMulti) && (
            <>
              {/* Sticky Note / Text: background color + text color */}
              {(markupType === 'stickyNote' || markupType === 'text') && (
                <Box mb={2} display="flex" gap={2} alignItems="center">
                  <Box>
                    <Typography sx={labelSx} mb={0.5}>Background</Typography>
                    <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('fill'), markupType === 'stickyNote' ? '#FFEB3B' : 'transparent'), border: '1px solid #ccc' }} />
                      <input type="color" value={isVaries(gv('fill')) ? '#9e9e9e' : (gv('fill') || (markupType === 'stickyNote' ? '#FFEB3B' : '#ffffff'))} onChange={e => handleLocalChange('fill', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    </Box>
                  </Box>
                  <Box>
                    <Typography sx={labelSx} mb={0.5}>Text Color</Typography>
                    <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('textColor'), '#212121'), border: '1px solid #ccc' }} />
                      <input type="color" value={isVaries(gv('textColor')) ? '#9e9e9e' : (gv('textColor') || '#212121')} onChange={e => handleLocalChange('textColor', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    </Box>
                  </Box>
                </Box>
              )}
              {/* Font Family */}
              <Box mb={2}>
                <Typography sx={labelSx} mb={0.5}>Font</Typography>
                <Select size="small" fullWidth
                  value={gv('fontFamily') || 'Arial'}
                  onChange={e => handleLocalChange('fontFamily', e.target.value as string, true)}
                  sx={inputSx}>
                  {['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'].map(f => (
                    <MenuItem key={f} value={f} sx={{ fontFamily: f }}>{f}</MenuItem>
                  ))}
                </Select>
              </Box>
              {/* Bold / Italic / Text Align */}
              <Box mb={2} display="flex" gap={1} alignItems="center">
                <Tooltip title="Bold">
                  <IconButton size="small"
                    onClick={() => handleLocalChange('fontWeight', gv('fontWeight') === 'bold' ? 'normal' : 'bold', true)}
                    sx={{ p: 0.5, border: '1px solid', borderColor: gv('fontWeight') === 'bold' ? gold : 'divider', borderRadius: '4px', bgcolor: gv('fontWeight') === 'bold' ? alpha(gold, 0.12) : 'transparent' }}>
                    <FormatBoldIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Italic">
                  <IconButton size="small"
                    onClick={() => handleLocalChange('fontStyle', gv('fontStyle') === 'italic' ? 'normal' : 'italic', true)}
                    sx={{ p: 0.5, border: '1px solid', borderColor: gv('fontStyle') === 'italic' ? gold : 'divider', borderRadius: '4px', bgcolor: gv('fontStyle') === 'italic' ? alpha(gold, 0.12) : 'transparent' }}>
                    <FormatItalicIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Box sx={{ mx: 0.5, width: '1px', height: 20, bgcolor: 'divider' }} />
                {(['left', 'center', 'right'] as const).map(align => (
                  <Tooltip key={align} title={align.charAt(0).toUpperCase() + align.slice(1)}>
                    <IconButton size="small"
                      onClick={() => handleLocalChange('textAlign', align, true)}
                      sx={{ p: 0.5, border: '1px solid', borderColor: (gv('textAlign') || 'left') === align ? gold : 'divider', borderRadius: '4px', bgcolor: (gv('textAlign') || 'left') === align ? alpha(gold, 0.12) : 'transparent' }}>
                      {align === 'left' ? <FormatAlignLeftIcon sx={{ fontSize: 16 }} /> : align === 'center' ? <FormatAlignCenterIcon sx={{ fontSize: 16 }} /> : <FormatAlignRightIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
              {/* Callout-only: Textbox border + Connector */}
              {markupType === 'callout' && (
                <>
                  <Box mb={2}>
                    <Typography sx={labelSx} mb={0.5}>Text Box Border</Typography>
                    <Box display="flex" gap={1} alignItems="center">
                      <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                        <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('textBoxStroke'), '#000000'), border: '1px solid #ccc' }} />
                        <input type="color" value={isVaries(gv('textBoxStroke')) ? '#9e9e9e' : (gv('textBoxStroke') || '#000000')} onChange={e => handleLocalChange('textBoxStroke', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                      </Box>
                      <IconButton size="small" onClick={() => handleLocalChange('textBoxStroke', 'transparent', true)} sx={{ p: 0.5 }}><Typography sx={{ fontSize: '0.70rem', fontWeight: 700 }}>NONE</Typography></IconButton>
                    </Box>
                  </Box>
                  <Box mb={2}>
                    <Typography sx={labelSx} mb={0.5}>Connector Style</Typography>
                    <Select size="small" fullWidth
                      value={gv('connectorStyle') || 'straight'}
                      onChange={e => handleLocalChange('connectorStyle', e.target.value as string, true)}
                      sx={inputSx}>
                      <MenuItem value="straight">Straight</MenuItem>
                      <MenuItem value="elbow">Elbow</MenuItem>
                      <MenuItem value="curved">Curved</MenuItem>
                    </Select>
                  </Box>
                </>
              )}
            </>
          )}
          {/* Measure-specific controls */}
          {markupType === 'measure' && !isMulti && (
            <>
              <PropertySlider label="Label Size" value={gv('fontSize') ?? 14} onChange={(v: number) => handleLocalChange('fontSize', v)} min={8} max={36} unit="px" />
              <Box mb={2}>
                <Typography sx={labelSx} mb={0.5}>Label Color</Typography>
                <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('textColor'), '#000000'), border: '1px solid #ccc' }} />
                  <input type="color" value={isVaries(gv('textColor')) ? '#9e9e9e' : (gv('textColor') || '#000000')} onChange={e => handleLocalChange('textColor', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </Box>
              </Box>
              <PropertySlider label="Tick Size" value={gv('tickSize') ?? 6} onChange={(v: number) => handleLocalChange('tickSize', v)} min={3} max={20} unit="px" />
              <PropertySlider label="Extensions" value={gv('extensionSize') ?? 3} onChange={(v: number) => handleLocalChange('extensionSize', v)} min={0} max={15} unit="px" />
            </>
          )}
          {/* Arrow-specific controls */}
          {markupType === 'arrow' && !isMulti && (
            <>
              <PropertySlider label="Arrowhead Size" value={gv('arrowSize') ?? 10} onChange={(v: number) => handleLocalChange('arrowSize', v, true)} min={4} max={50} unit="px" />
              <Box mb={2}>
                <Typography sx={labelSx}>Arrow Direction</Typography>
                <Box display="flex" gap={1}>
                  {(['end', 'start', 'both'] as const).map(style => (
                    <Box key={style} onClick={() => handleLocalChange('arrowStyle', style, true)}
                      sx={{ flex: 1, py: 0.5, px: 1, border: 2, borderRadius: '6px', cursor: 'pointer', textAlign: 'center',
                        borderColor: (gv('arrowStyle') || 'end') === style ? gold : 'divider',
                        bgcolor: (gv('arrowStyle') || 'end') === style ? alpha(gold, 0.1) : 'transparent' }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 600 }}>
                        {style === 'end' ? '→' : style === 'start' ? '←' : '↔'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </>
          )}
        </Box>
        <Divider />
        <Box sx={sectionSx}>
          <Typography sx={labelSx}>{t('common', 'General')}</Typography>
          {/* Status */}
          <Box mb={1.5} sx={{ pointerEvents: canEdit ? 'auto' : 'none' }}>
            <Typography sx={labelSx}>{t('status', 'Status')}</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const active = (gv('status') || 'none') === key;
                return (
                  <Box key={key} onClick={() => canEdit && handleLocalChange('status', key, true)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      px: 1, py: 0.4, borderRadius: '12px', cursor: canEdit ? 'pointer' : 'default',
                      border: '1.5px solid',
                      borderColor: active ? STATUS_COLORS[key] : 'divider',
                      bgcolor: active ? alpha(STATUS_COLORS[key], 0.12) : 'transparent',
                      transition: 'all 0.15s',
                      '&:hover': canEdit ? { borderColor: STATUS_COLORS[key], bgcolor: alpha(STATUS_COLORS[key], 0.08) } : {},
                    }}
                  >
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: STATUS_COLORS[key], flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: active ? 700 : 500, color: active ? STATUS_COLORS[key] : 'text.secondary', lineHeight: 1 }}>
                      {label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
          <Box mb={1.5} display="flex" alignItems="center" gap={1} width="100%" sx={{ pointerEvents: canEdit ? 'auto' : 'none' }}>
            <Typography sx={{ ...labelSx, mb: 0, minWidth: 80, flexShrink: 0 }}>{t('subject', 'Subject')}</Typography>
            <InputBase fullWidth value={gv('subject') || ''} onChange={e => handleLocalChange('subject', e.target.value)} sx={{ ...inputSx, flex: 1, px: 1 }} placeholder="" />
          </Box>
          <Box mb={1.5} ref={mentionAnchorRef}>
            <Typography sx={labelSx}>{t('comment', 'Comment')}</Typography>
            {canEdit && commentFocused ? (
              <>
                <InputBase
                  fullWidth multiline rows={3}
                  value={commentDraft !== null ? commentDraft : (gv('comment') || '')}
                  onChange={e => handleMentionInput(e, 'comment')}
                  onBlur={e => { if (mentionOpen) return; setCommentFocused(false); }}
                  autoFocus
                  sx={{ ...inputSx, height: 'auto', p: 1 }}
                  placeholder=""
                />
                {commentDraft !== null && commentDraft !== (gv('comment') || '') && (
                  <Box display="flex" justifyContent="flex-end" mt={1}>
                    <Button
                      size="small"
                      variant="contained"
                      sx={{ fontSize: '0.72rem', minWidth: 0, py: 0.25, px: 1.5, textTransform: 'none' }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        handleLocalChange('comment', commentDraft, true);
                        setCommentDraft(null);
                        setCommentFocused(false);
                      }}
                    >
                      {t('save', 'Save')}
                    </Button>
                  </Box>
                )}
              </>
            ) : (
              // View mode OR canEdit but not yet focused — show MentionText with click-to-edit
              <Box
                sx={{ ...inputSx, height: 'auto', p: 1, borderRadius: '4px', border: '1px solid', borderColor: 'divider', minHeight: 62, fontSize: '0.82rem', lineHeight: 1.5, pointerEvents: 'auto', cursor: canEdit ? 'text' : 'default' }}
                onClick={() => { if (canEdit) setCommentFocused(true); }}
              >
                <MentionText text={gv('comment') || ''} projectUsers={projectUsers} />
              </Box>
            )}
          </Box>
          <Popover open={mentionOpen && !!projectUsers.length} anchorEl={mentionTargetField === 'thread' ? threadMentionAnchorRef.current : mentionAnchorRef.current} onClose={() => setMentionOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} disableAutoFocus disableEnforceFocus slotProps={{ paper: { sx: { width: 200, maxHeight: 250, overflowY: 'auto', zIndex: 3000 } } }}>
            <List dense onMouseDown={(e) => e.preventDefault()}>{projectUsers.filter(u => !mentionQuery || (u.name || u.email).toLowerCase().includes(mentionQuery.toLowerCase())).map(user => <ListItemButton key={user.id} onClick={() => handleSelectMention(user)}><ListItemIcon sx={{ minWidth: 32 }}><Avatar sx={{ width: 24, height: 24, fontSize: '0.70rem' }}>{(user.name || user.email)[0].toUpperCase()}</Avatar></ListItemIcon><ListItemText primary={user.name || user.email} primaryTypographyProps={{ fontSize: '0.82rem', noWrap: true }} /></ListItemButton>)}</List>
          </Popover>

          {/* Thread / Replies */}
          {isSingle && (
            <Box mt={2}>
              <Typography sx={labelSx}>{t('replies', 'Replies')}</Typography>
              {((gv('thread') as any[]) || []).map((entry: any) => (
                <Box key={entry.id} sx={{ mb: 1, p: 1, borderRadius: '6px', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid', borderColor: 'divider', position: 'relative' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
                    <Typography sx={{ fontSize: '0.70rem', fontWeight: 700, color: gold }}>{entry.authorName || '?'}</Typography>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography sx={{ fontSize: '0.70rem', color: 'text.disabled' }}>{entry.createdAt ? dayjs(entry.createdAt).format('MM/DD HH:mm') : ''}</Typography>
                      {canEdit && (isAdmin || entry.authorId === currentUserId) && (
                        <IconButton size="small" sx={{ p: 0.2, opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}
                          onClick={() => {
                            const updated = ((gv('thread') as any[]) || []).filter((e: any) => e.id !== entry.id);
                            handleLocalChange('thread', updated, true);
                          }}>
                          <CloseIcon sx={{ fontSize: 11 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ fontSize: '0.78rem', color: 'text.primary', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    <MentionText text={entry.text || ''} projectUsers={projectUsers} />
                  </Box>
                </Box>
              ))}
              {canEdit && (
                <Box ref={threadMentionAnchorRef} display="flex" gap={1} mt={1}>
                  <InputBase
                    fullWidth multiline maxRows={3}
                    placeholder={t('addReply', 'Add a reply… (@ to mention)')}
                    value={threadDraft}
                    onChange={e => handleMentionInput(e, 'thread')}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && threadDraft.trim()) {
                        e.preventDefault();
                        const newEntry = { id: Date.now().toString(), authorId: currentUserId || '', authorName: markup?.author?.name || markup?.author?.email || 'Me', text: threadDraft.trim(), createdAt: new Date().toISOString() };
                        handleLocalChange('thread', [...((gv('thread') as any[]) || []), newEntry], true);
                        setThreadDraft('');
                      }
                    }}
                    sx={{ ...inputSx, height: 'auto', p: 1, fontSize: '0.78rem' }}
                  />
                  <Button size="small" variant="contained" disabled={!threadDraft.trim()} sx={{ fontSize: '0.70rem', minWidth: 0, py: 0.5, px: 1.5, textTransform: 'none', alignSelf: 'flex-end' }}
                    onClick={() => {
                      if (!threadDraft.trim()) return;
                      const newEntry = { id: Date.now().toString(), authorId: currentUserId || '', authorName: markup?.author?.name || markup?.author?.email || 'Me', text: threadDraft.trim(), createdAt: new Date().toISOString() };
                      handleLocalChange('thread', [...((gv('thread') as any[]) || []), newEntry], true);
                      setThreadDraft('');
                    }}>
                    {t('send', 'Send')}
                  </Button>
                </Box>
              )}
            </Box>
          )}

          <Divider sx={{ my: 2 }} />
          <Tooltip title={t('templateTooltip', 'When ON — Subject, Comment, and custom fields apply to ALL markups. Visual properties (color, width, style) always apply only to selected.')} placement="left" arrow>
            <FormControlLabel
              control={<Checkbox size="small" checked={useTemplate} onChange={e => setUseTemplate(e.target.checked)} sx={{ color: gold, '&.Mui-checked': { color: gold } }} disabled={!canEdit} />}
              label={
                <Box sx={{ pointerEvents: 'auto' }}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{t('applyToAllMarkups', 'Apply to All')}</Typography>
                  <Typography sx={{ fontSize: '0.70rem', color: 'text.secondary', lineHeight: 1.2 }}>text fields → all markups</Typography>
                </Box>
              }
            />
          </Tooltip>
        </Box>
        <Divider />
        <Box sx={sectionSx}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} sx={{ pointerEvents: canEdit ? 'auto' : 'none' }}><Typography sx={labelSx}>{t('customParameters', 'Custom Parameters')}</Typography>{loadingFields && <CircularProgress size={12} color="inherit" />}</Box>
          {/* Project-level custom fields */}
          {customFields.filter(field => {
            const v = gv(field.key);
            return typeof v !== 'object' || v === null;
          }).map(field => (
            <Box key={field.id} mb={1.5} display="flex" alignItems="center" gap={1} width="100%" sx={{ pointerEvents: canEdit ? 'auto' : 'none' }}>
              <Typography sx={{ ...labelSx, mb: 0, minWidth: 80, flexShrink: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{field.label || field.key}</Typography>
              <InputBase fullWidth value={gv(field.key) || ''} onChange={e => handleMentionInput(e, field.key)} sx={{ ...inputSx, flex: 1, px: 1 }} placeholder="" />
            </Box>
          ))}
          {/* Per-markup custom properties (not in project fields or standard keys) */}
          {(() => {
            const STANDARD_KEYS = new Set([
              'stroke', 'fill', 'fillOpacity', 'strokeWidth', 'lineStyle', 'fontSize', 'textColor',
              'fontFamily', 'fontWeight', 'fontStyle', 'textAlign', 'text', 'comment', 'subject',
              'status', 'locked', 'source', 'bluebeamAuthor', 'pdfAnnotId', 'arrowSize', 'arrowStyle',
              'showLength', 'originalWidth', 'originalHeight', 'pathLength', 'opacity', 'strokeOpacity',
              'createdAt', 'updatedAt', 'thread', 'isPastedOrDuplicated', 'allowedEditUserIds',
              'allowedDeleteUserIds', 'imageData', 'borderColor', 'borderWidth', 'stampShape', 'stampFill',
              'boxType', 'supportShape', 'stubDirection', 'redlineLabel', 'showLabel',
              'textBoxFill', 'textBoxStroke', 'connectorStroke', 'connectorWidth', 'connectorStyle',
              'cloudArcSize', 'cloudIntensity', 'borderEffect', 'tickSize', 'extensionSize', 'labelBg',
              'labelTextColor', 'measureDict', 'lineEndStart', 'lineEndEnd',
              'isDraft', '_draftNew', '_hasAppearanceStream', '_pdf_Subtype', '_pdf_Measure',
              '_pdf_IT', '_pdf_LE', '_pdf_OC', '_pdf_BM', 'reviewStamp', 'sessionId',
              'pulse', 'groupId', 'conduitSize', 'from', 'to', 'equipType', 'size', 'label',
              'defaultText', 'category', 'borderRadius', 'labelFontSize', 'labelFontFamily',
              'labelFontWeight', 'wireType', 'wireSize', 'circuitId', 'voltage',
            ]);
            const projectFieldKeys = new Set(customFields.map((f: any) => f.key));
            const first = selectedMarkups[0];
            if (!first?.properties) return null;
            const perMarkupKeys = Object.keys(first.properties).filter(k =>
              !STANDARD_KEYS.has(k) && !projectFieldKeys.has(k) && !k.startsWith('_pdf_') &&
              typeof first.properties[k] !== 'object'
            );
            if (perMarkupKeys.length === 0) return null;
            return perMarkupKeys.map(key => (
              <Box key={key} mb={1.5} display="flex" alignItems="center" gap={1} width="100%" sx={{ pointerEvents: canEdit ? 'auto' : 'none' }}>
                <Typography sx={{ ...labelSx, mb: 0, minWidth: 80, flexShrink: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'text.secondary' }}>{key}</Typography>
                <InputBase fullWidth value={gv(key) || ''} onChange={e => handleMentionInput(e, key)} sx={{ ...inputSx, flex: 1, px: 1 }} placeholder="" />
                <IconButton size="small" onClick={() => {
                  selectedMarkups.forEach(m => {
                    const { [key]: _, ...rest } = m.properties || {};
                    // Pass _fullProperties to signal complete replacement (not merge)
                    onUpdateProperties(m.id, { _fullProperties: rest });
                  });
                }} sx={{ p: 0.3, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                  <CloseIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Box>
            ));
          })()}
          <Box sx={{ mt: 1, pointerEvents: canEdit ? 'auto' : 'none' }}>
            {isAddingField ? (
              <Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <InputBase autoFocus size="small" placeholder="Field name" value={newFieldName}
                    onChange={e => { setNewFieldName(e.target.value); setAddFieldError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddField(); if (e.key === 'Escape') { setIsAddingField(false); setAddFieldError(''); } }}
                    sx={{ ...inputSx, flex: 1, px: 1 }} />
                  <IconButton size="small" onClick={handleAddField} sx={{ p: 0.3, color: gold }}><CheckIcon sx={{ fontSize: 14 }} /></IconButton>
                  <IconButton size="small" onClick={() => { setIsAddingField(false); setAddFieldError(''); }}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
                </Box>
                {addFieldError && (
                  <Typography sx={{ fontSize: '0.68rem', color: 'error.main', mt: 0.5 }}>{addFieldError}</Typography>
                )}
                <FormControlLabel
                  control={<Checkbox size="small" checked={addFieldForAll} onChange={e => setAddFieldForAll(e.target.checked)} sx={{ p: 0.3, color: gold, '&.Mui-checked': { color: gold } }} />}
                  label={<Typography sx={{ fontSize: '0.70rem', fontWeight: 600 }}>Apply to all markups</Typography>}
                  sx={{ mt: 0.5, ml: 0 }}
                />
              </Box>
            ) : (
              <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, '&:hover': { textDecoration: 'underline' } }} onClick={() => setIsAddingField(true)}>+ {t('addParameter', 'Add Parameter')}</Typography>
            )}
          </Box>
        </Box>
        {/* Permissions section — ONLY for owner or admin */}
        {isSingle && markup && (isAdmin || (currentUserId != null && markup.authorId === currentUserId)) && (
          <>
            <Divider />
            <Box sx={{ ...sectionSx, pointerEvents: canEdit ? 'auto' : 'none' }}>
              <Typography sx={labelSx}>{t('permissions', 'Permissions')}</Typography>

              {/* Show note when multi-selection contains markups not owned by current user */}
              {isMulti && !isAdmin && currentUserId != null && selectedMarkups.some(m => m.authorId !== currentUserId) && (
                <Box sx={{ mb: 1.5, px: 1, py: 0.75, borderRadius: '6px', bgcolor: alpha(gold, 0.08), border: `1px solid ${alpha(gold, 0.2)}` }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.4 }}>
                    Permission changes apply only to <strong>your markups</strong> in this selection. Others' markups are skipped.
                  </Typography>
                </Box>
              )}

              {/* Edit permissions */}
              {(() => {
                const restricted = isRestricted('allowedEditUserIds');
                const selectedIds = (Array.isArray(gv('allowedEditUserIds')) ? gv('allowedEditUserIds') : []).filter((id: string) => id !== '*');
                return (
                  <Box sx={{ mb: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="caption" color="text.secondary">{t('allowedEditors', 'Allowed to Edit')}</Typography>
                      <FormControlLabel
                        control={<Checkbox size="small" checked={restricted} onChange={e => handleRestrictToggle('allowedEditUserIds', e.target.checked)} sx={{ p: 0.5, color: gold, '&.Mui-checked': { color: gold } }} />}
                        label={<Typography sx={{ fontSize: '0.70rem', fontWeight: 600 }}>Restrict</Typography>}
                      />
                    </Box>
                    {!restricted
                      ? <Box sx={{ px: 1, py: 0.5, borderRadius: '4px', bgcolor: alpha('#4caf50', 0.08), border: '1px solid', borderColor: alpha('#4caf50', 0.2) }}>
                          <Typography sx={{ fontSize: '0.74rem', color: 'success.main', fontWeight: 600 }}>Everyone can edit</Typography>
                        </Box>
                      : <Select multiple fullWidth size="small" value={selectedIds}
                          onChange={e => handleLocalChange('allowedEditUserIds', e.target.value, true)}
                          renderValue={(sel: any) => { const arr = Array.isArray(sel) ? sel : []; return arr.length === 0 ? <em style={{ fontSize: '0.78rem', color: 'var(--mui-palette-error-main)' }}>Nobody</em> : arr.map((id: string) => projectUsers.find(u => u.id === id)?.name || id).join(', '); }}
                          sx={{ ...inputSx, '& .MuiSelect-select': { py: 0.5, px: 1 } }}
                          MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', border: 1, borderColor: 'divider', maxHeight: 240 } } }}
                        >
                          {projectUsers.map(u => (
                            <MenuItem key={u.id} value={u.id} sx={{ fontSize: '0.82rem' }}>
                              <Checkbox size="small" checked={selectedIds.includes(u.id)} sx={{ p: 0.5, mr: 0.5, color: gold, '&.Mui-checked': { color: gold } }} />
                              {u.name || u.email}
                            </MenuItem>
                          ))}
                        </Select>
                    }
                    {restricted && selectedIds.length === 0 && (
                      <Typography sx={{ fontSize: '0.70rem', color: 'error.main', mt: 0.5 }}>Nobody can edit (except owner &amp; admins)</Typography>
                    )}
                  </Box>
                );
              })()}

              {/* Delete permissions */}
              {(() => {
                const restricted = isRestricted('allowedDeleteUserIds');
                const selectedIds = (Array.isArray(gv('allowedDeleteUserIds')) ? gv('allowedDeleteUserIds') : []).filter((id: string) => id !== '*');
                return (
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="caption" color="text.secondary">{t('allowedDeleters', 'Allowed to Delete')}</Typography>
                      <FormControlLabel
                        control={<Checkbox size="small" checked={restricted} onChange={e => handleRestrictToggle('allowedDeleteUserIds', e.target.checked)} sx={{ p: 0.5, color: gold, '&.Mui-checked': { color: gold } }} />}
                        label={<Typography sx={{ fontSize: '0.70rem', fontWeight: 600 }}>Restrict</Typography>}
                      />
                    </Box>
                    {!restricted
                      ? <Box sx={{ px: 1, py: 0.5, borderRadius: '4px', bgcolor: alpha('#4caf50', 0.08), border: '1px solid', borderColor: alpha('#4caf50', 0.2) }}>
                          <Typography sx={{ fontSize: '0.74rem', color: 'success.main', fontWeight: 600 }}>Everyone can delete</Typography>
                        </Box>
                      : <Select multiple fullWidth size="small" value={selectedIds}
                          onChange={e => handleLocalChange('allowedDeleteUserIds', e.target.value, true)}
                          renderValue={(sel: any) => { const arr = Array.isArray(sel) ? sel : []; return arr.length === 0 ? <em style={{ fontSize: '0.78rem', color: 'var(--mui-palette-error-main)' }}>Nobody</em> : arr.map((id: string) => projectUsers.find(u => u.id === id)?.name || id).join(', '); }}
                          sx={{ ...inputSx, '& .MuiSelect-select': { py: 0.5, px: 1 } }}
                          MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', border: 1, borderColor: 'divider', maxHeight: 240 } } }}
                        >
                          {projectUsers.map(u => (
                            <MenuItem key={u.id} value={u.id} sx={{ fontSize: '0.82rem' }}>
                              <Checkbox size="small" checked={selectedIds.includes(u.id)} sx={{ p: 0.5, mr: 0.5, color: gold, '&.Mui-checked': { color: gold } }} />
                              {u.name || u.email}
                            </MenuItem>
                          ))}
                        </Select>
                    }
                    {restricted && selectedIds.length === 0 && (
                      <Typography sx={{ fontSize: '0.70rem', color: 'error.main', mt: 0.5 }}>Nobody can delete (except owner &amp; admins)</Typography>
                    )}
                  </Box>
                );
              })()}
            </Box>
          </>
        )}
        
        </Box>
      </Box>
    </Paper>
  );
});

export default MarkupPropertiesPanel;
