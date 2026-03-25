import { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Box, Typography, IconButton,
  Paper, Select, MenuItem, Tooltip, useTheme, alpha, InputBase, Slider,
  CircularProgress, Divider, Popover, Avatar, List, ListItemButton, ListItemIcon, ListItemText, Checkbox, FormControlLabel, useMediaQuery
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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
import { LINE_STYLES } from './PdfToolbar';

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
  open, selectedMarkups, onClose, onUpdateProperties, projectId, onAction, markups: allMarkups
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

  const [mentionAnchor, setMentionAnchor] = useState<null | HTMLElement>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionTargetField, setMentionTargetField] = useState<'subject' | 'comment' | string | null>(null);
  const { data: projectUsers = [] } = useProjectUsers(projectId);
  const saveTimerRef = useRef<any>(null);

  useEffect(() => {
    if (open && projectId) {
      setLoadingFields(true);
      apiFetch(`/api/project-markup-fields/${projectId}`)
        .then(data => { if (Array.isArray(data)) setCustomFields(data); })
        .catch(err => console.error(err))
        .finally(() => setLoadingFields(false));
    }
  }, [open, projectId]);

  useEffect(() => { setLocalOverrides({}); }, [selectedMarkups]);

  const cv = useCallback((key: string) => getCommonValue(selectedMarkups, key), [selectedMarkups]);
  const gv = useCallback((key: string) => localOverrides[key] !== undefined ? localOverrides[key] : cv(key), [localOverrides, cv]);

  const savePropertyImmediate = useCallback((key: string, value: any) => {
    const targets = useTemplate ? allMarkups : selectedMarkups;
    targets.forEach(m => {
      if (key === 'allowedEditUserIds' || key === 'allowedDeleteUserIds') {
        onUpdateProperties(m.id, { [key]: value });
      } else {
        onUpdateProperties(m.id, { properties: { ...m.properties, [key]: value } });
      }
    });
  }, [selectedMarkups, allMarkups, useTemplate, onUpdateProperties]);

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
    handleLocalChange(field, value);
    if (lastAtIdx !== -1) {
      const query = textBeforeCaret.substring(lastAtIdx + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query); setMentionAnchor(e.target); setMentionTargetField(field);
        return;
      }
    }
    setMentionAnchor(null); setMentionTargetField(null);
  };

  const handleSelectMention = (user: ProjectUser) => {
    if (!mentionTargetField) return;
    const currentVal = gv(mentionTargetField) || '';
    const lastAtIdx = currentVal.lastIndexOf('@');
    const newVal = currentVal.substring(0, lastAtIdx) + `@${user.name || user.email} ` + currentVal.substring(lastAtIdx + mentionQuery.length + 1);
    handleLocalChange(mentionTargetField, newVal, true);
    setMentionAnchor(null); setMentionTargetField(null);
  };

  const handlePermissionAll = (field: string, checked: boolean) => {
    if (checked) handleLocalChange(field, projectUsers.map(u => u.id), true);
    else handleLocalChange(field, [], true);
  };

  if (!open || (selectedMarkups || []).length === 0) return null;

  const isSingle = (selectedMarkups || []).length === 1;
  const isMulti = (selectedMarkups || []).length > 1;
  const markup = isSingle ? selectedMarkups[0] : null;
  const markupType = isSingle ? markup?.type : null;
  const hasFill = ['rect', 'circle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star', 'cloud', 'callout'].includes(markupType || '') || isMulti;
  const hasFillOpacity = hasFill;
  const hasLineStyle = !['pen', 'highlighter', 'text'].includes(markupType || '') || isMulti;
  const hasStrokeWidth = !['text'].includes(markupType || '') || isMulti;
  const hasFontSize = ['text', 'callout'].includes(markupType || '') || isMulti;

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
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ ...sectionSx, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {isSingle && onAction && (
            <>
              <Tooltip title={t('bringToFront', 'Bring to Front')}><IconButton size="small" onClick={() => onAction('front', markup!.id)} sx={{ p: 0.5 }}><FlipToFrontIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title={t('sendToBack', 'Send to Back')}><IconButton size="small" onClick={() => onAction('back', markup!.id)} sx={{ p: 0.5 }}><FlipToBackIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title={markup?.properties?.locked ? t('unlock', 'Unlock') : t('lock', 'Lock')}><IconButton size="small" onClick={() => onAction(markup!.properties?.locked ? 'unlock' : 'lock', markup!.id)} sx={{ p: 0.5, color: markup?.properties?.locked ? gold : 'inherit' }}>{markup?.properties?.locked ? <LockIcon sx={{ fontSize: 16 }} /> : <LockOpenIcon sx={{ fontSize: 16 }} />}</IconButton></Tooltip>
            </>
          )}
        </Box>
        <Divider />
        <Box sx={sectionSx}>
          <Box display="flex" gap={2} mb={3}>
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
          </Box>
          {hasFillOpacity && <PropertySlider label={t('opacity', 'Opacity')} value={(gv('fillOpacity') ?? 1) * 100} onChange={(v: number) => handleLocalChange('fillOpacity', v / 100)} unit="%" />}
          {hasStrokeWidth && <PropertySlider label={t('strokeWidth', 'Width')} value={gv('strokeWidth') ?? 2} onChange={(v: number) => handleLocalChange('strokeWidth', v)} min={1} max={50} unit="px" />}
          {hasLineStyle && (
            <Box mb={1}>
              <Typography sx={labelSx}>{t('lineStyle', 'Line Style')}</Typography>
              <Select size="small" fullWidth value={isVaries(gv('lineStyle')) ? '__varies__' : (gv('lineStyle') || 'solid')} onChange={e => handleLocalChange('lineStyle', e.target.value, true)} sx={inputSx}>
                {isVaries(gv('lineStyle')) && <MenuItem value="__varies__"><em>{t('varies', 'Varies')}</em></MenuItem>}
                {LINE_STYLES.map(s => <MenuItem key={s.key} value={s.key}>{t(s.key, s.label)}</MenuItem>)}
              </Select>
            </Box>
          )}
          {hasFontSize && <PropertySlider label={t('fontSize', 'Font Size')} value={gv('fontSize') ?? 14} onChange={(v: number) => handleLocalChange('fontSize', v)} min={8} max={72} unit="px" />}
        </Box>
        <Divider />
        <Box sx={sectionSx}>
          <Typography sx={labelSx}>{t('common', 'General')}</Typography>
          <Box mb={1.5} display="flex" alignItems="center" gap={1} width="100%">
            <Typography sx={{ ...labelSx, mb: 0, minWidth: 80, flexShrink: 0 }}>{t('subject', 'Subject')}</Typography>
            <InputBase fullWidth value={gv('subject') || ''} onChange={e => handleMentionInput(e, 'subject')} sx={{ ...inputSx, flex: 1, px: 1 }} placeholder="" />
          </Box>
          <Box mb={1.5}>
            <Typography sx={labelSx}>{t('comment', 'Comment')}</Typography>
            <InputBase fullWidth multiline rows={3} value={gv('comment') || ''} onChange={e => handleMentionInput(e, 'comment')} sx={{ ...inputSx, height: 'auto', p: 1 }} placeholder="" />
          </Box>
          <Popover open={Boolean(mentionAnchor)} anchorEl={mentionAnchor} onClose={() => setMentionAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} disableAutoFocus disableEnforceFocus slotProps={{ paper: { sx: { width: 200, maxHeight: 250, overflowY: 'auto', zIndex: 3000 } } }}>
            <List dense>{projectUsers.filter(u => !mentionQuery || (u.name || u.email).toLowerCase().includes(mentionQuery.toLowerCase())).map(user => <ListItemButton key={user.id} onClick={() => handleSelectMention(user)}><ListItemIcon sx={{ minWidth: 32 }}><Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem' }}>{(user.name || user.email)[0].toUpperCase()}</Avatar></ListItemIcon><ListItemText primary={user.name || user.email} primaryTypographyProps={{ fontSize: '0.75rem', noWrap: true }} /></ListItemButton>)}</List>
          </Popover>
          <Divider sx={{ my: 2 }} />
          <FormControlLabel control={<Checkbox size="small" checked={useTemplate} onChange={e => setUseTemplate(e.target.checked)} sx={{ color: gold, '&.Mui-checked': { color: gold } }} />} label={<Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('applyToAllMarkups', 'All Markups')}</Typography>} />
        </Box>
        <Divider />
        <Box sx={sectionSx}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}><Typography sx={labelSx}>{t('customParameters', 'Custom Parameters')}</Typography>{loadingFields && <CircularProgress size={12} color="inherit" />}</Box>
          {customFields.map(field => (
            <Box key={field.id} mb={1.5} display="flex" alignItems="center" gap={1} width="100%">
              <Typography sx={{ ...labelSx, mb: 0, minWidth: 80, flexShrink: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{field.label || field.key}</Typography>
              <InputBase fullWidth value={gv(field.key) || ''} onChange={e => handleMentionInput(e, field.key)} sx={{ ...inputSx, flex: 1, px: 1 }} placeholder="" />
            </Box>
          ))}
          <Box sx={{ mt: 1 }}>
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
        <Divider />
        <Box sx={sectionSx}>
          <Typography sx={labelSx}>{t('permissions', 'Permissions')}</Typography>
          <Box sx={{ mt: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{t('allowedEditors', 'Allowed to Edit')}</Typography>
              <FormControlLabel control={<Checkbox size="small" checked={(gv('allowedEditUserIds') || []).length === projectUsers.length} onChange={e => handlePermissionAll('allowedEditUserIds', e.target.checked)} sx={{ p: 0.5, color: gold, '&.Mui-checked': { color: gold } }} />} label={<Typography sx={{ fontSize: '0.6rem' }}>ALL</Typography>} />
            </Box>
            <Select multiple fullWidth size="small" value={gv('allowedEditUserIds') || []} onChange={(e) => handleLocalChange('allowedEditUserIds', e.target.value)} renderValue={(selected: any) => selected.length === projectUsers.length ? 'ALL' : selected.map((id: string) => projectUsers.find(u => u.id === id)?.name || id).join(', ')} sx={{ ...inputSx, '& .MuiSelect-select': { py: 0.5, px: 1 } }}>
              {projectUsers.map(user => <MenuItem key={user.id} value={user.id}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><input type="checkbox" checked={(gv('allowedEditUserIds') || []).includes(user.id)} readOnly />{user.name || user.email}</Box></MenuItem>)}
            </Select>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{t('allowedDeleters', 'Allowed to Delete')}</Typography>
              <FormControlLabel control={<Checkbox size="small" checked={(gv('allowedDeleteUserIds') || []).length === projectUsers.length} onChange={e => handlePermissionAll('allowedDeleteUserIds', e.target.checked)} sx={{ p: 0.5, color: gold, '&.Mui-checked': { color: gold } }} />} label={<Typography sx={{ fontSize: '0.6rem' }}>ALL</Typography>} />
            </Box>
            <Select multiple fullWidth size="small" value={gv('allowedDeleteUserIds') || []} onChange={(e) => handleLocalChange('allowedDeleteUserIds', e.target.value)} renderValue={(selected: any) => selected.length === projectUsers.length ? 'ALL' : selected.map((id: string) => projectUsers.find(u => u.id === id)?.name || id).join(', ')} sx={{ ...inputSx, '& .MuiSelect-select': { py: 0.5, px: 1 } }}>
              {projectUsers.map(user => <MenuItem key={user.id} value={user.id}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><input type="checkbox" checked={(gv('allowedDeleteUserIds') || []).includes(user.id)} readOnly />{user.name || user.email}</Box></MenuItem>)}
            </Select>
          </Box>
        </Box>
        
        {/* Author info at the bottom */}
        {isSingle && markup && (
          <Box sx={{ mt: 'auto', p: 2, bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderTop: 1, borderColor: 'divider' }}>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <PersonIcon sx={{ fontSize: 14, color: gold }} />
              <Typography variant="caption" fontWeight={600}>{markup.author?.name || markup.author?.email || 'Unknown Author'}</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <AccessTimeIcon sx={{ fontSize: 14, opacity: 0.5 }} />
              <Typography variant="caption" color="text.secondary">{dayjs(markup.createdAt).format('MM/DD/YYYY HH:mm')}</Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
});

export default MarkupPropertiesPanel;
