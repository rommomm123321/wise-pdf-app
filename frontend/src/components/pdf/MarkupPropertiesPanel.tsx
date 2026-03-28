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
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { apiFetch } from '../../lib/api';
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
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: gold }}>
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

const MarkupPropertiesPanel = memo(function MarkupPropertiesPanel({
  open, selectedMarkups, onClose, onUpdateProperties, projectId, onAction, markups: allMarkups, canEdit = true, currentUserId, isAdmin = false, docScale = '1:1'
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
  const { data: projectUsers = [] } = useProjectUsers(projectId);
  const saveTimerRef = useRef<any>(null);

  const [commentDraft, setCommentDraft] = useState<string | null>(null);
  const [commentFocused, setCommentFocused] = useState(false);
  const [threadDraft, setThreadDraft] = useState('');
  const [presets, setPresets] = useState<any[]>([]);
  const [savePresetName, setSavePresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  useEffect(() => {
    if (open && projectId) {
      setLoadingFields(true);
      apiFetch(`/api/project-markup-fields/${projectId}`)
        .then(data => { if (Array.isArray(data)) setCustomFields(data); })
        .catch(err => console.error(err))
        .finally(() => setLoadingFields(false));
      apiFetch<any>('/api/presets')
        .then(res => { if (Array.isArray(res?.data)) setPresets(res.data); })
        .catch(() => {});
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
  const VISUAL_KEYS = new Set(['stroke', 'fill', 'fillOpacity', 'strokeWidth', 'lineStyle', 'fontSize', 'textColor', 'borderColor', 'borderWidth', 'arrowSize', 'arrowStyle']);

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

  const handleAddField = async () => {
    if (!newFieldName.trim() || !projectId) return;
    const res = await apiFetch(`/api/project-markup-fields/${projectId}`, { method: 'POST', body: JSON.stringify({ key: newFieldName.trim(), type: 'text' }) });
    setCustomFields(prev => [...prev, res]); setNewFieldName(''); setIsAddingField(false);
  };

  const handleMentionInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: string) => {
    const value = e.target.value;
    const caretPos = e.target.selectionStart || 0;
    const textBeforeCaret = value.substring(0, caretPos);
    const lastAtIdx = textBeforeCaret.lastIndexOf('@');
    
    if (field === 'comment') {
      setCommentDraft(value);
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
    const currentVal = mentionTargetField === 'comment' ? (commentDraft ?? gv('comment') ?? '') : (gv(mentionTargetField) || '');
    const lastAtIdx = currentVal.lastIndexOf('@');
    const newVal = currentVal.substring(0, lastAtIdx) + `@${user.name || user.email} ` + currentVal.substring(lastAtIdx + mentionQuery.length + 1);
    
    if (mentionTargetField === 'comment') {
      setCommentDraft(newVal);
      setCommentFocused(true); // stay in edit mode after selection
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

  const PRESET_VISUAL_KEYS = ['stroke', 'fill', 'fillOpacity', 'strokeWidth', 'lineStyle', 'textColor', 'fontSize'];

  const applyPreset = (preset: any) => {
    if (!canEdit) return;
    (preset.fields || []).forEach((f: any) => {
      if (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '') {
        handleLocalChange(f.key, f.defaultValue, true);
      }
    });
  };

  const handleSavePreset = async () => {
    if (!savePresetName.trim()) return;
    const fields = PRESET_VISUAL_KEYS
      .map(k => ({ key: k, type: ['stroke', 'fill', 'textColor'].includes(k) ? 'color' : 'number', defaultValue: gv(k) }))
      .filter(f => f.defaultValue !== undefined && f.defaultValue !== '__varies__' && f.defaultValue !== null);
    try {
      const res = await apiFetch<any>('/api/presets', { method: 'POST', body: JSON.stringify({ name: savePresetName.trim(), fields }) });
      if (res?.data) setPresets(prev => [res.data, ...prev]);
      setSavePresetName('');
      setIsSavingPreset(false);
    } catch (err) { console.error(err); }
  };

  if (!open || (selectedMarkups || []).length === 0) return null;

  const isSingle = (selectedMarkups || []).length === 1;
  const isMulti = (selectedMarkups || []).length > 1;
  const markup = isSingle ? selectedMarkups[0] : null;
  const markupType = isSingle ? markup?.type : null;
  const hasFill = ['rect', 'circle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'cloud', 'callout', 'text'].includes(markupType || '') || isMulti;
  const hasFillOpacity = hasFill;
  const hasLineStyle = !['pen', 'highlighter', 'text'].includes(markupType || '') || isMulti;
  const hasStrokeWidth = !['text'].includes(markupType || '') || isMulti || (markupType === 'text');
  const hasFontSize = ['text', 'callout'].includes(markupType || '') || isMulti;
  const hasTextColor = ['text', 'callout'].includes(markupType || '') || isMulti;
  const isTextType = markupType === 'text' && !isMulti;

  const sectionSx = { px: 1.5, py: 1.5, width: '100%', boxSizing: 'border-box' };
  const labelSx = { fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.5, display: 'block' };
  const inputSx = { height: 28, fontSize: '0.75rem', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: '4px', '& fieldset': { borderColor: 'divider' }, '&:hover fieldset': { borderColor: alpha(gold, 0.4) }, '&.Mui-focused fieldset': { borderColor: `${gold} !important` } };
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
        <Typography variant="subtitle2" fontWeight={700}>{isMulti ? `${selectedMarkups.length} ${t('selected', 'Selected')}` : (markup?.properties?.subject || markup?.type || t('properties', 'Properties'))}</Typography>
        <IconButton size="small" onClick={onClose} sx={{ p: 0.5 }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
      </Box>
      {!canEdit && (
        <Box sx={{ mx: 2, mb: 1, mt: 1, px: 1.5, py: 0.75, borderRadius: '6px', bgcolor: 'warning.main', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon sx={{ fontSize: 14, color: 'warning.contrastText' }} />
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'warning.contrastText' }}>
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
            </Box>
          )}
        </Box>

        {/* Creator / Updater info */}
        {isSingle && markup && (
          <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            {markup.author && (
              <Box display="flex" alignItems="center" gap={0.75}>
                <PersonIcon sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.2 }}>
                  {t('createdBy', 'Created by')} <strong style={{ color: 'inherit' }}>{markup.author?.name || markup.author?.email || '—'}</strong>
                  {markup.createdAt && <> · {dayjs(markup.createdAt).format('MM/DD/YY HH:mm')}</>}
                </Typography>
              </Box>
            )}
            {markup.updatedBy && (
              <Box display="flex" alignItems="center" gap={0.75}>
                <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.2 }}>
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
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
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
        {/* Polyline length display + show/hide toggle */}
        {markupType === 'polyline' && (
          <Box sx={{ px: 1.5, py: 1 }}>
            {isSingle && markup?.properties?.pathLength != null && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
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
              label={<Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Show length on canvas</Typography>}
              sx={{ ml: 0 }}
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
                    <IconButton size="small" onClick={() => handleLocalChange('fill', 'transparent', true)} sx={{ p: 0.5 }}><Typography sx={{ fontSize: '0.6rem', fontWeight: 700 }}>NONE</Typography></IconButton>
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
                      <IconButton size="small" onClick={() => handleLocalChange('fill', 'transparent', true)} sx={{ p: 0.5 }}><Typography sx={{ fontSize: '0.6rem', fontWeight: 700 }}>NONE</Typography></IconButton>
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
                  }} sx={{ p: 0.5, fontSize: '0.6rem', fontWeight: 700, color: (gv('strokeWidth') ?? 0) > 0 ? gold : 'text.disabled' }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700 }}>{(gv('strokeWidth') ?? 0) > 0 ? 'ON' : 'OFF'}</Typography>
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
                    ? <em style={{ fontSize: '0.72rem' }}>{t('varies', 'Varies')}</em>
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
          {/* Callout-specific: text box background fill */}
          {markupType === 'callout' && !isMulti && (
            <Box mb={2}>
              <Typography sx={labelSx} mb={0.5}>Text Box Fill</Typography>
              <Box display="flex" gap={1} alignItems="center">
                <Box sx={{ position: 'relative', width: 28, height: 28 }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: getColorValue(gv('textBoxFill'), '#ffffff'), border: '1px solid #ccc' }} />
                  <input type="color" value={isVaries(gv('textBoxFill')) ? '#9e9e9e' : (gv('textBoxFill') || '#ffffff')} onChange={e => handleLocalChange('textBoxFill', e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </Box>
                <IconButton size="small" onClick={() => handleLocalChange('textBoxFill', 'transparent', true)} sx={{ p: 0.5 }}><Typography sx={{ fontSize: '0.6rem', fontWeight: 700 }}>NONE</Typography></IconButton>
              </Box>
            </Box>
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
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
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
                const active = (gv('status') || 'open') === key;
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
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: active ? 700 : 500, color: active ? STATUS_COLORS[key] : 'text.secondary', lineHeight: 1 }}>
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
                      sx={{ fontSize: '0.65rem', minWidth: 0, py: 0.25, px: 1.5, textTransform: 'none' }}
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
                sx={{ ...inputSx, height: 'auto', p: 1, borderRadius: '4px', border: '1px solid', borderColor: 'divider', minHeight: 62, fontSize: '0.75rem', lineHeight: 1.5, pointerEvents: 'auto', cursor: canEdit ? 'text' : 'default' }}
                onClick={() => { if (canEdit) setCommentFocused(true); }}
              >
                <MentionText text={gv('comment') || ''} projectUsers={projectUsers} />
              </Box>
            )}
          </Box>
          <Popover open={mentionOpen && Boolean(mentionAnchorRef.current)} anchorEl={mentionAnchorRef.current} onClose={() => setMentionOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} disableAutoFocus disableEnforceFocus slotProps={{ paper: { sx: { width: 200, maxHeight: 250, overflowY: 'auto', zIndex: 3000 } } }}>
            <List dense onMouseDown={(e) => e.preventDefault()}>{projectUsers.filter(u => !mentionQuery || (u.name || u.email).toLowerCase().includes(mentionQuery.toLowerCase())).map(user => <ListItemButton key={user.id} onClick={() => handleSelectMention(user)}><ListItemIcon sx={{ minWidth: 32 }}><Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem' }}>{(user.name || user.email)[0].toUpperCase()}</Avatar></ListItemIcon><ListItemText primary={user.name || user.email} primaryTypographyProps={{ fontSize: '0.75rem', noWrap: true }} /></ListItemButton>)}</List>
          </Popover>

          {/* Thread / Replies */}
          {isSingle && (
            <Box mt={2}>
              <Typography sx={labelSx}>{t('replies', 'Replies')}</Typography>
              {((gv('thread') as any[]) || []).map((entry: any) => (
                <Box key={entry.id} sx={{ mb: 1, p: 1, borderRadius: '6px', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: '1px solid', borderColor: 'divider', position: 'relative' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: gold }}>{entry.authorName || '?'}</Typography>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>{entry.createdAt ? dayjs(entry.createdAt).format('MM/DD HH:mm') : ''}</Typography>
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
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.primary', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{entry.text}</Typography>
                </Box>
              ))}
              {canEdit && (
                <Box display="flex" gap={1} mt={1}>
                  <InputBase
                    fullWidth multiline maxRows={3}
                    placeholder={t('addReply', 'Add a reply…')}
                    value={threadDraft}
                    onChange={e => setThreadDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && threadDraft.trim()) {
                        e.preventDefault();
                        const newEntry = { id: Date.now().toString(), authorId: currentUserId || '', authorName: markup?.author?.name || markup?.author?.email || 'Me', text: threadDraft.trim(), createdAt: new Date().toISOString() };
                        handleLocalChange('thread', [...((gv('thread') as any[]) || []), newEntry], true);
                        setThreadDraft('');
                      }
                    }}
                    sx={{ ...inputSx, height: 'auto', p: 1, fontSize: '0.72rem' }}
                  />
                  <Button size="small" variant="contained" disabled={!threadDraft.trim()} sx={{ fontSize: '0.62rem', minWidth: 0, py: 0.5, px: 1.5, textTransform: 'none', alignSelf: 'flex-end' }}
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
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('applyToAllMarkups', 'Apply to All')}</Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1.2 }}>text fields → all markups</Typography>
                </Box>
              }
            />
          </Tooltip>
        </Box>
        <Divider />
        {/* Style Presets */}
        <Box sx={{ ...sectionSx, pointerEvents: canEdit ? 'auto' : 'none' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.75}>
            <Typography sx={labelSx}>{t('stylePresets', 'Style Presets')}</Typography>
            {canEdit && !isSavingPreset && (
              <Typography variant="caption" sx={{ cursor: 'pointer', fontWeight: 600, color: 'primary.main', fontSize: '0.62rem', '&:hover': { textDecoration: 'underline' } }} onClick={() => setIsSavingPreset(true)}>
                + {t('saveStyle', 'Save current')}
              </Typography>
            )}
            {canEdit && isSavingPreset && (
              <Box display="flex" gap={0.5} alignItems="center">
                <InputBase
                  autoFocus
                  value={savePresetName}
                  onChange={e => setSavePresetName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') { setIsSavingPreset(false); setSavePresetName(''); } }}
                  placeholder="Preset name"
                  sx={{ ...inputSx, px: 1, height: 24, fontSize: '0.7rem', width: 100 }}
                />
                <IconButton size="small" onClick={handleSavePreset} disabled={!savePresetName.trim()} sx={{ p: 0.25, color: gold }}><CheckIcon sx={{ fontSize: 13 }} /></IconButton>
                <IconButton size="small" onClick={() => { setIsSavingPreset(false); setSavePresetName(''); }} sx={{ p: 0.25 }}><CloseIcon sx={{ fontSize: 13 }} /></IconButton>
              </Box>
            )}
          </Box>
          {presets.length === 0 ? (
            <Typography sx={{ fontSize: '0.63rem', color: 'text.disabled', fontStyle: 'italic' }}>No presets yet</Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {presets.map((p: any) => {
                const strokeField = (p.fields || []).find((f: any) => f.key === 'stroke');
                return (
                  <Tooltip key={p.id} title={`Apply: ${p.name}`} placement="top">
                    <Box
                      onClick={() => applyPreset(p)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5,
                        px: 1, py: 0.3, borderRadius: '10px', cursor: canEdit ? 'pointer' : 'default',
                        border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover',
                        transition: 'all 0.1s',
                        '&:hover': canEdit ? { borderColor: alpha(gold, 0.5), bgcolor: alpha(gold, 0.08) } : {},
                      }}
                    >
                      {strokeField && (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: strokeField.defaultValue || gold, flexShrink: 0 }} />
                      )}
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, lineHeight: 1 }}>{p.name}</Typography>
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          )}
        </Box>
        <Divider />
        <Box sx={sectionSx}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} sx={{ pointerEvents: canEdit ? 'auto' : 'none' }}><Typography sx={labelSx}>{t('customParameters', 'Custom Parameters')}</Typography>{loadingFields && <CircularProgress size={12} color="inherit" />}</Box>
          {customFields.map(field => (
            <Box key={field.id} mb={1.5} display="flex" alignItems="center" gap={1} width="100%" sx={{ pointerEvents: canEdit ? 'auto' : 'none' }}>
              <Typography sx={{ ...labelSx, mb: 0, minWidth: 80, flexShrink: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{field.label || field.key}</Typography>
              <InputBase fullWidth value={gv(field.key) || ''} onChange={e => handleMentionInput(e, field.key)} sx={{ ...inputSx, flex: 1, px: 1 }} placeholder="" />
            </Box>
          ))}
          <Box sx={{ mt: 1, pointerEvents: canEdit ? 'auto' : 'none' }}>
            {isAddingField ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <InputBase autoFocus size="small" placeholder="Field name" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddField(); }} sx={{ ...inputSx, flex: 1, px: 1 }} />
                <IconButton size="small" onClick={() => setIsAddingField(false)}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
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
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.4 }}>
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
                        label={<Typography sx={{ fontSize: '0.6rem', fontWeight: 600 }}>Restrict</Typography>}
                      />
                    </Box>
                    {!restricted
                      ? <Box sx={{ px: 1, py: 0.5, borderRadius: '4px', bgcolor: alpha('#4caf50', 0.08), border: '1px solid', borderColor: alpha('#4caf50', 0.2) }}>
                          <Typography sx={{ fontSize: '0.68rem', color: 'success.main', fontWeight: 600 }}>Everyone can edit</Typography>
                        </Box>
                      : <Select multiple fullWidth size="small" value={selectedIds}
                          onChange={e => handleLocalChange('allowedEditUserIds', e.target.value, true)}
                          renderValue={(sel: any) => { const arr = Array.isArray(sel) ? sel : []; return arr.length === 0 ? <em style={{ fontSize: '0.72rem', color: 'var(--mui-palette-error-main)' }}>Nobody</em> : arr.map((id: string) => projectUsers.find(u => u.id === id)?.name || id).join(', '); }}
                          sx={{ ...inputSx, '& .MuiSelect-select': { py: 0.5, px: 1 } }}
                          MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', border: 1, borderColor: 'divider', maxHeight: 240 } } }}
                        >
                          {projectUsers.map(u => (
                            <MenuItem key={u.id} value={u.id} sx={{ fontSize: '0.75rem' }}>
                              <Checkbox size="small" checked={selectedIds.includes(u.id)} sx={{ p: 0.5, mr: 0.5, color: gold, '&.Mui-checked': { color: gold } }} />
                              {u.name || u.email}
                            </MenuItem>
                          ))}
                        </Select>
                    }
                    {restricted && selectedIds.length === 0 && (
                      <Typography sx={{ fontSize: '0.62rem', color: 'error.main', mt: 0.5 }}>Nobody can edit (except owner &amp; admins)</Typography>
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
                        label={<Typography sx={{ fontSize: '0.6rem', fontWeight: 600 }}>Restrict</Typography>}
                      />
                    </Box>
                    {!restricted
                      ? <Box sx={{ px: 1, py: 0.5, borderRadius: '4px', bgcolor: alpha('#4caf50', 0.08), border: '1px solid', borderColor: alpha('#4caf50', 0.2) }}>
                          <Typography sx={{ fontSize: '0.68rem', color: 'success.main', fontWeight: 600 }}>Everyone can delete</Typography>
                        </Box>
                      : <Select multiple fullWidth size="small" value={selectedIds}
                          onChange={e => handleLocalChange('allowedDeleteUserIds', e.target.value, true)}
                          renderValue={(sel: any) => { const arr = Array.isArray(sel) ? sel : []; return arr.length === 0 ? <em style={{ fontSize: '0.72rem', color: 'var(--mui-palette-error-main)' }}>Nobody</em> : arr.map((id: string) => projectUsers.find(u => u.id === id)?.name || id).join(', '); }}
                          sx={{ ...inputSx, '& .MuiSelect-select': { py: 0.5, px: 1 } }}
                          MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', border: 1, borderColor: 'divider', maxHeight: 240 } } }}
                        >
                          {projectUsers.map(u => (
                            <MenuItem key={u.id} value={u.id} sx={{ fontSize: '0.75rem' }}>
                              <Checkbox size="small" checked={selectedIds.includes(u.id)} sx={{ p: 0.5, mr: 0.5, color: gold, '&.Mui-checked': { color: gold } }} />
                              {u.name || u.email}
                            </MenuItem>
                          ))}
                        </Select>
                    }
                    {restricted && selectedIds.length === 0 && (
                      <Typography sx={{ fontSize: '0.62rem', color: 'error.main', mt: 0.5 }}>Nobody can delete (except owner &amp; admins)</Typography>
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
