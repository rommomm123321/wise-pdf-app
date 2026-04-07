import React from 'react';
import { Box, Typography, IconButton, Button, Slider, Tooltip, useTheme, alpha, useMediaQuery } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';

interface CompareToolbarProps {
  oldColor: string;
  newColor: string;
  opacity: number;
  onOpacityChange: (val: number) => void;
  showOld: boolean;
  showNew: boolean;
  onToggleOld: () => void;
  onToggleNew: () => void;
  onClose: () => void;
  onExport?: () => void;
  onSave?: () => void;
  oldLabel?: string;
  newLabel?: string;
}

export default function CompareToolbar({
  oldColor, newColor, opacity, onOpacityChange,
  showOld, showNew, onToggleOld, onToggleNew,
  onClose, onExport, onSave, oldLabel = 'Old', newLabel = 'New',
}: CompareToolbarProps) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const isMobile = useMediaQuery('(max-width:1050px)');

  // Layer toggle button
  const LayerBtn = ({ active, color, label, onClick }: { active: boolean; color: string; label: string; onClick: () => void }) => (
    <Box onClick={onClick} sx={{
      display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
      px: isMobile ? 0.6 : 0.75, py: 0.3, borderRadius: '6px', flexShrink: 0,
      bgcolor: active ? alpha(color, 0.18) : 'transparent',
      border: `1.5px solid ${active ? color : theme.palette.divider}`,
      '&:hover': { borderColor: color, bgcolor: alpha(color, 0.12) },
    }}>
      <Box sx={{ width: isMobile ? 7 : 9, height: isMobile ? 7 : 9, borderRadius: '2px', bgcolor: color }} />
      <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', fontWeight: 600, color: active ? color : 'text.disabled' }}>{label}</Typography>
      {active ? <VisibilityIcon sx={{ fontSize: isMobile ? 11 : 13 }} /> : <VisibilityOffIcon sx={{ fontSize: isMobile ? 11 : 13 }} />}
    </Box>
  );

  // ── MOBILE: appears directly above the mobile toolbar, same width style ──
  if (isMobile) {
    return (
      <Box sx={{
        position: 'fixed', bottom: 62, left: 12, right: 12,
        zIndex: 1299,
        display: 'flex', alignItems: 'center', gap: '4px',
        px: '6px', py: '4px', borderRadius: '14px',
        bgcolor: alpha(theme.palette.background.paper, 0.97),
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: '0 -2px 16px rgba(0,0,0,0.2)',
      }}>
        <LayerBtn active={showOld} color={oldColor} label={oldLabel} onClick={onToggleOld} />
        <LayerBtn active={showNew} color={newColor} label={newLabel} onClick={onToggleNew} />
        <Slider value={opacity} onChange={(_, v) => onOpacityChange(v as number)}
          min={10} max={90} step={5} size="small"
          sx={{ color: gold, flex: 1, mx: 0.5, minWidth: 30, '& .MuiSlider-thumb': { width: 10, height: 10 } }} />
        {onExport && <IconButton size="small" onClick={onExport} sx={{ p: '3px', color: gold }}><DownloadIcon sx={{ fontSize: 16 }} /></IconButton>}
        {onSave && <IconButton size="small" onClick={onSave} sx={{ p: '3px', color: gold }}><SaveIcon sx={{ fontSize: 16 }} /></IconButton>}
        <IconButton size="small" onClick={onClose} sx={{ p: '3px', color: 'error.main' }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
      </Box>
    );
  }

  // ── DESKTOP: clean bar directly under PdfToolbar ──
  return (
    <Box sx={{
      position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
      zIndex: 50,
      display: 'flex', alignItems: 'center', gap: 0.75,
      px: 1.25, py: '4px', borderRadius: '10px',
      bgcolor: alpha(theme.palette.background.paper, 0.95),
      backdropFilter: 'blur(16px)',
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
    }}>
      <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: gold }}>
        COMPARE
      </Typography>

      <Box sx={{ width: 1, height: 16, bgcolor: 'divider' }} />

      <LayerBtn active={showOld} color={oldColor} label={oldLabel} onClick={onToggleOld} />
      <LayerBtn active={showNew} color={newColor} label={newLabel} onClick={onToggleNew} />

      <Box sx={{ width: 1, height: 16, bgcolor: 'divider' }} />

      <Slider value={opacity} onChange={(_, v) => onOpacityChange(v as number)}
        min={10} max={90} step={5} size="small"
        sx={{ color: gold, width: 60, '& .MuiSlider-thumb': { width: 10, height: 10 } }} />
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, minWidth: 22 }}>{opacity}%</Typography>

      <Box sx={{ width: 1, height: 16, bgcolor: 'divider' }} />

      {onExport && (
        <Tooltip title="Download comparison PDF">
          <IconButton size="small" onClick={onExport} sx={{ p: '3px', color: gold }}><DownloadIcon sx={{ fontSize: 15 }} /></IconButton>
        </Tooltip>
      )}
      {onSave && (
        <Tooltip title="Save to project">
          <IconButton size="small" onClick={onSave} sx={{ p: '3px', color: gold }}><SaveIcon sx={{ fontSize: 15 }} /></IconButton>
        </Tooltip>
      )}
      <Tooltip title="Exit compare">
        <IconButton size="small" onClick={onClose} sx={{ p: '3px', color: 'text.disabled', '&:hover': { color: 'error.main' } }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
      </Tooltip>
    </Box>
  );
}
