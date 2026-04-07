import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Select, MenuItem, RadioGroup, Radio, FormControlLabel, Slider, IconButton,
  useTheme, alpha, Divider, useMediaQuery,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export interface CompareConfig {
  oldDocId: string;
  newDocId: string;
  oldColor: string;
  newColor: string;
  opacity: number;
  pageMode: 'all' | 'range' | 'custom';
  pageRange: [number, number];
  customMapping: { oldPage: number; newPage: number }[];
  alignMode: 'direct' | 'manual';
}

interface CompareDialogProps {
  open: boolean;
  onClose: () => void;
  onCompare: (config: CompareConfig) => void;
  currentDocId: string;
  versions: { id: string; createdAt: string; name?: string }[];
  numPages: number;
  pageLabels?: string[];
}

export default function CompareDialog({
  open, onClose, onCompare, currentDocId, versions, numPages, pageLabels = [],
}: CompareDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;
  const isMobile = useMediaQuery('(max-width:550px)');

  const [oldDocId, setOldDocId] = useState('');
  const [newDocId, setNewDocId] = useState('');
  const [oldColor, setOldColor] = useState('#CC0000');
  const [newColor, setNewColor] = useState('#00AA44');
  const [opacity, setOpacity] = useState(50);
  const [pageMode, setPageMode] = useState<'all' | 'range' | 'custom'>('all');
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(numPages);
  const [customMapping, setCustomMapping] = useState<{ oldPage: number; newPage: number }[]>([
    { oldPage: 0, newPage: 0 },
  ]);

  // Reset selections when dialog opens or document changes
  React.useEffect(() => {
    if (!open) return;
    const curIdx = versions.findIndex(v => v.id === currentDocId);
    // Default: old = previous version, new = current
    const prevId = curIdx > 0 ? versions[curIdx - 1]?.id : (versions.length > 1 ? versions[1]?.id : '');
    setOldDocId(prevId || '');
    setNewDocId(currentDocId);
    setRangeEnd(numPages);
  }, [open, currentDocId, versions, numPages]);

  const versionLabel = (id: string) => {
    const idx = versions.findIndex(v => v.id === id);
    if (idx < 0) return id.slice(0, 8);
    return `Rev ${versions.length - idx}`;
  };

  const pageLabel = (idx: number) => pageLabels[idx] || `Page ${idx + 1}`;

  const handleCompare = () => {
    onCompare({ oldDocId, newDocId, oldColor, newColor, opacity, pageMode, pageRange: [rangeStart, rangeEnd], customMapping, alignMode: 'direct' });
  };

  const addCustomPair = () => setCustomMapping(prev => [...prev, { oldPage: 0, newPage: 0 }]);
  const removeCustomPair = (i: number) => setCustomMapping(prev => prev.filter((_, idx) => idx !== i));
  const updateCustomPair = (i: number, field: 'oldPage' | 'newPage', val: number) => {
    setCustomMapping(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  };

  // ── Shared styles matching MarkupTable / Search section ──
  const selectSx = {
    height: 36, fontSize: '0.85rem',
    '.MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(gold, 0.5) },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: gold },
    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    '& .MuiSelect-select': { py: '7px !important', fontSize: '0.85rem' },
    '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
  };
  const menuProps = {
    PaperProps: {
      sx: {
        bgcolor: 'background.paper', border: 1, borderColor: 'divider',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxHeight: 300,
        '& .MuiMenuItem-root': { fontSize: '0.85rem', py: 0.6, borderRadius: '4px', mx: 0.3, '&:hover': { bgcolor: alpha(gold, 0.08) } },
      },
    },
  };

  const sectionLabel = (text: string) => (
    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', mb: 1 }}>
      {text}
    </Typography>
  );

  const canCompare = oldDocId && oldDocId !== newDocId;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}
      PaperProps={{ sx: {
        borderRadius: isMobile ? 0 : '16px',
        border: isMobile ? 0 : 1, borderColor: 'divider',
        bgcolor: 'background.paper',
        ...(isMobile && { m: 0 }),
      } }}>

      {/* ── Title ── */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, px: isMobile ? 2 : 3 }}>
        <CompareArrowsIcon sx={{ color: gold }} />
        <Typography sx={{ flex: 1, fontWeight: 700, fontSize: isMobile ? '0.95rem' : '1.05rem' }}>
          Document Comparison
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: '8px !important', px: isMobile ? 2 : 3 }}>

        {/* ── Version selection — stacked vertically ── */}
        {sectionLabel('Revisions')}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: oldColor, mb: 0.5 }}>
              Old (Base)
            </Typography>
            <Select size="small" fullWidth value={oldDocId} onChange={e => setOldDocId(e.target.value)} sx={selectSx} MenuProps={menuProps}>
              {versions.filter(v => v.id !== newDocId).map(v => (
                <MenuItem key={v.id} value={v.id}>
                  Rev {versions.length - versions.indexOf(v)} — {new Date(v.createdAt).toLocaleDateString()}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: newColor, mb: 0.5 }}>
              New (Target)
            </Typography>
            <Select size="small" fullWidth value={newDocId} onChange={e => setNewDocId(e.target.value)} sx={selectSx} MenuProps={menuProps}>
              {versions.filter(v => v.id !== oldDocId).map(v => {
                const isCurrent = v.id === currentDocId;
                return (
                  <MenuItem key={v.id} value={v.id}>
                    Rev {versions.length - versions.indexOf(v)} — {new Date(v.createdAt).toLocaleDateString()}
                    {isCurrent ? ' (current)' : ''}
                  </MenuItem>
                );
              })}
            </Select>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* ── Page selection ── */}
        {sectionLabel('Pages to Compare')}
        <RadioGroup value={pageMode} onChange={e => setPageMode(e.target.value as any)} sx={{ mb: 1 }}>
          <FormControlLabel value="all" control={<Radio size="small" sx={{ color: gold, '&.Mui-checked': { color: gold }, p: 0.5 }} />}
            label={<Typography sx={{ fontSize: '0.85rem' }}>All pages (1:1 mapping)</Typography>} />
          <FormControlLabel value="range" control={<Radio size="small" sx={{ color: gold, '&.Mui-checked': { color: gold }, p: 0.5 }} />}
            label={<Typography sx={{ fontSize: '0.85rem' }}>Page range</Typography>} />
          <FormControlLabel value="custom" control={<Radio size="small" sx={{ color: gold, '&.Mui-checked': { color: gold }, p: 0.5 }} />}
            label={<Typography sx={{ fontSize: '0.85rem' }}>Custom page mapping</Typography>} />
        </RadioGroup>

        {/* Range — stacked vertically */}
        {pageMode === 'range' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2, pl: 3.5 }}>
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>From page</Typography>
              <Select size="small" fullWidth value={rangeStart} onChange={e => setRangeStart(Number(e.target.value))} sx={selectSx} MenuProps={menuProps}>
                {Array.from({ length: numPages }, (_, i) => (
                  <MenuItem key={i} value={i + 1}>{pageLabel(i)}</MenuItem>
                ))}
              </Select>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>To page</Typography>
              <Select size="small" fullWidth value={rangeEnd} onChange={e => setRangeEnd(Number(e.target.value))} sx={selectSx} MenuProps={menuProps}>
                {Array.from({ length: numPages }, (_, i) => (
                  <MenuItem key={i} value={i + 1}>{pageLabel(i)}</MenuItem>
                ))}
              </Select>
            </Box>
          </Box>
        )}

        {/* Custom mapping — stacked pairs */}
        {pageMode === 'custom' && (
          <Box sx={{ mb: 2, pl: 3.5 }}>
            {customMapping.map((pair, i) => (
              <Box key={i} sx={{
                display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.5,
                p: 1.5, borderRadius: '10px',
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                position: 'relative',
              }}>
                {/* Delete button */}
                <IconButton size="small" onClick={() => removeCustomPair(i)}
                  sx={{ position: 'absolute', top: 4, right: 4, p: 0.3, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>

                <Box>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: alpha(oldColor, 0.8), mb: 0.5 }}>OLD PAGE</Typography>
                  <Select size="small" fullWidth value={pair.oldPage} onChange={e => updateCustomPair(i, 'oldPage', Number(e.target.value))} sx={selectSx} MenuProps={menuProps}>
                    {Array.from({ length: numPages }, (_, j) => (
                      <MenuItem key={j} value={j}>{pageLabel(j)}</MenuItem>
                    ))}
                  </Select>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.25 }}>
                  <ArrowForwardIcon sx={{ fontSize: 16, color: 'text.disabled', transform: 'rotate(90deg)' }} />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: alpha(newColor, 0.8), mb: 0.5 }}>NEW PAGE</Typography>
                  <Select size="small" fullWidth value={pair.newPage} onChange={e => updateCustomPair(i, 'newPage', Number(e.target.value))} sx={selectSx} MenuProps={menuProps}>
                    {Array.from({ length: numPages }, (_, j) => (
                      <MenuItem key={j} value={j}>{pageLabel(j)}</MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 15 }} />} onClick={addCustomPair}
              sx={{ fontSize: '0.78rem', color: gold, textTransform: 'none', fontWeight: 600, mt: 0.5, '&:hover': { bgcolor: alpha(gold, 0.08) } }}>
              Add pair
            </Button>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* ── Overlay settings ── */}
        {sectionLabel('Overlay Settings')}

        {/* Colors — responsive row/column */}
        <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1.5 : 3, mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
            <Box sx={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: oldColor, border: '2px solid', borderColor: 'divider', cursor: 'pointer' }} />
              <input type="color" value={oldColor} onChange={e => setOldColor(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}>Old revision</Typography>
              <Typography sx={{ fontSize: '0.78rem', fontFamily: 'monospace', color: oldColor }}>{oldColor.toUpperCase()}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
            <Box sx={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: newColor, border: '2px solid', borderColor: 'divider', cursor: 'pointer' }} />
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}>New revision</Typography>
              <Typography sx={{ fontSize: '0.78rem', fontFamily: 'monospace', color: newColor }}>{newColor.toUpperCase()}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Opacity */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', minWidth: 55 }}>Opacity:</Typography>
          <Slider value={opacity} onChange={(_, v) => setOpacity(v as number)}
            min={10} max={90} step={5}
            sx={{ color: gold, flex: 1, '& .MuiSlider-thumb': { width: 16, height: 16 } }} />
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, minWidth: 35, textAlign: 'right' }}>{opacity}%</Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: isMobile ? 2 : 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.85rem' }}>Cancel</Button>
        <Button variant="contained" onClick={handleCompare} disabled={!canCompare}
          startIcon={<CompareArrowsIcon />} fullWidth={isMobile}
          sx={{ bgcolor: gold, color: '#000', fontWeight: 700, textTransform: 'none', fontSize: '0.88rem', py: 1, '&:hover': { bgcolor: alpha(gold, 0.85) } }}>
          Compare
        </Button>
      </DialogActions>
    </Dialog>
  );
}
