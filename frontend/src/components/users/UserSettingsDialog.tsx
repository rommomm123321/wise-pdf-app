import { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Typography, Box, Slider,
  Select, MenuItem, Switch, ToggleButtonGroup, ToggleButton,
  useTheme, useMediaQuery, alpha, IconButton,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import CloseIcon from '@mui/icons-material/Close';
import PaletteIcon from '@mui/icons-material/Palette';
import SecurityIcon from '@mui/icons-material/Security';
import TuneIcon from '@mui/icons-material/Tune';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import GroupsIcon from '@mui/icons-material/Groups';
// Tool icons
import AdsClickIcon from '@mui/icons-material/AdsClick';
import CreateIcon from '@mui/icons-material/Create';
import HighlightIcon from '@mui/icons-material/Highlight';
import RectangleIcon from '@mui/icons-material/Rectangle';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import TextFormatIcon from '@mui/icons-material/TextFormat';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import EastIcon from '@mui/icons-material/East';
import StraightenIcon from '@mui/icons-material/Straighten';
import PolylineIcon from '@mui/icons-material/Polyline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import RouteIcon from '@mui/icons-material/Route';
import ConstructionIcon from '@mui/icons-material/Construction';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useUserSettings } from '../../hooks/useUserSettings';

interface Props {
  open: boolean;
  onClose: () => void;
  user: { id: string; name?: string | null; email?: string; systemRole?: string } | null;
  presets?: Array<{ id: string; name: string; fields?: any[] }>;
  canMarkup?: boolean;
}

const LINE_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'dash-dot', label: 'Dash-Dot' },
];

const STATUSES = [
  { value: 'none', label: 'None' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'pending', label: 'For Review' },
  { value: 'completed', label: 'Completed' },
];

/** Card-style setting row */
function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      px: 1.5, py: 1, mb: 0.5, gap: 1,
      borderRadius: '10px',
      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
      transition: 'background 0.15s',
    }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3 }}>{label}</Typography>
        {sub && <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', lineHeight: 1.3, mt: 0.15 }}>{sub}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{children}</Box>
    </Box>
  );
}

/** Section header with icon */
function Section({ icon, title }: { icon: React.ReactNode; title: string }) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 2.5, mb: 1, px: 0.5 }}>
      <Box sx={{ color: gold, display: 'flex', '& svg': { fontSize: 18 } }}>{icon}</Box>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: alpha(gold, 0.8) }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: alpha(gold, 0.15), ml: 0.5 }} />
    </Box>
  );
}

export default function UserSettingsDialog({ open, onClose, user, presets = [], canMarkup = true }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { mode, toggleTheme } = useThemeMode();
  const [s, set] = useUserSettings(user?.id);
  const gold = useMemo(() => theme.palette.primary.main, [theme.palette.primary.main]);
  const [wheelSearch, setWheelSearch] = useState('');
  const isDark = theme.palette.mode === 'dark';

  const swSx = { '& .MuiSwitch-switchBase.Mui-checked': { color: gold }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: gold } };
  const slW = isMobile ? 90 : 110;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : '14px', bgcolor: isDark ? '#1a1a1a' : '#fafafa' } }}>

      {/* Header */}
      <DialogTitle sx={{
        fontWeight: 800, fontSize: '1.1rem', pb: 0.5, pt: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: alpha(gold, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', color: gold }}>
            <TuneIcon sx={{ fontSize: 18 }} />
          </Box>
          Settings
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.disabled', '&:hover': { color: 'text.primary' } }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      {/* User info */}
      {user && (
        <Box sx={{ px: 3, pb: 1 }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
            {user.name || user.email} {user.systemRole === 'GENERAL_ADMIN' && (
              <Box component="span" sx={{ ml: 0.5, px: 0.75, py: 0.1, borderRadius: '4px', bgcolor: alpha(gold, 0.15), color: gold, fontSize: '0.62rem', fontWeight: 700 }}>Admin</Box>
            )}
          </Typography>
        </Box>
      )}

      <DialogContent sx={{ pt: 0, pb: 3, px: isMobile ? 2 : 3 }}>

        {/* ── MARKUP DEFAULTS ── */}
        <Section icon={<PaletteIcon />} title="Markup Defaults" />

        <Row label="Default Color" sub="Applied to new markups">
          <Box sx={{ position: 'relative', width: 32, height: 28, borderRadius: '8px', overflow: 'hidden', border: `2px solid ${gold}` }}>
            <Box sx={{ width: '100%', height: '100%', bgcolor: s.defaultColor }} />
            <input type="color" value={s.defaultColor} onChange={e => set({ defaultColor: e.target.value })}
              onClick={e => e.stopPropagation()} title="" aria-label="Pick color"
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
          </Box>
        </Row>

        <Row label="Stroke Width">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: '6px', bgcolor: alpha(gold, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: gold }}>{s.defaultStrokeWidth}</Typography>
            </Box>
            <Slider value={s.defaultStrokeWidth} onChange={(_, v) => set({ defaultStrokeWidth: v as number })}
              min={1} max={10} step={1} sx={{ width: slW, color: gold }} />
          </Box>
        </Row>

        <Row label="Line Style">
          <Select size="small" value={s.defaultLineStyle} onChange={e => set({ defaultLineStyle: e.target.value })}
            sx={{ minWidth: 85, height: 28, fontSize: '0.76rem', borderRadius: '8px' }}>
            {LINE_STYLES.map(ls => <MenuItem key={ls.value} value={ls.value} sx={{ fontSize: '0.76rem' }}>{ls.label}</MenuItem>)}
          </Select>
        </Row>

        <Row label="Font Size">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: '6px', bgcolor: alpha(gold, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: gold }}>{s.defaultFontSize}</Typography>
            </Box>
            <Slider value={s.defaultFontSize} onChange={(_, v) => set({ defaultFontSize: v as number })}
              min={8} max={32} step={1} sx={{ width: slW, color: gold }} />
          </Box>
        </Row>

        <Row label="Default Subject" sub="Pre-fill Subject on new markups">
          <input value={s.defaultSubject} onChange={e => set({ defaultSubject: e.target.value })}
            placeholder="e.g. QC Review"
            style={{
              width: isMobile ? 95 : 120, height: 28, borderRadius: 8,
              border: `1.5px solid ${theme.palette.divider}`, padding: '0 8px',
              fontSize: '0.78rem', background: 'transparent', color: theme.palette.text.primary,
              outline: 'none',
            }} />
        </Row>

        <Row label="Default Status" sub="Auto-set status on new markups">
          <Select size="small" value={s.defaultStatus} onChange={e => set({ defaultStatus: e.target.value })}
            sx={{ minWidth: 95, height: 28, fontSize: '0.76rem', borderRadius: '8px' }}>
            {STATUSES.map(st => <MenuItem key={st.value} value={st.value} sx={{ fontSize: '0.76rem' }}>{st.label}</MenuItem>)}
          </Select>
        </Row>

        <Row label="Measurement Units">
          <ToggleButtonGroup exclusive size="small" value={s.measurementUnits}
            onChange={(_, v) => { if (v) set({ measurementUnits: v }); }}
            sx={{ height: 28, '& .Mui-selected': { bgcolor: `${alpha(gold, 0.15)} !important`, color: `${gold} !important`, fontWeight: 700 } }}>
            <ToggleButton value="metric" sx={{ px: 1.5, fontSize: '0.7rem', textTransform: 'none', borderRadius: '8px 0 0 8px' }}>Metric</ToggleButton>
            <ToggleButton value="imperial" sx={{ px: 1.5, fontSize: '0.7rem', textTransform: 'none', borderRadius: '0 8px 8px 0' }}>Imperial</ToggleButton>
          </ToggleButtonGroup>
        </Row>

        {/* ── PERMISSIONS ── */}
        <Section icon={<SecurityIcon />} title="Permissions" />

        <Row label="Allow others to edit" sub="When OFF, only you and admins can modify your markups">
          <Switch checked={s.allowOthersEdit} onChange={(_, v) => set({ allowOthersEdit: v })} size="small" sx={swSx} />
        </Row>

        <Row label="Allow others to delete" sub="When OFF, only you and admins can remove your markups">
          <Switch checked={s.allowOthersDelete} onChange={(_, v) => set({ allowOthersDelete: v })} size="small" sx={swSx} />
        </Row>

        {/* ── BEHAVIOR ── */}
        <Section icon={<TuneIcon />} title="Behavior" />

        <Row label="Auto-select after drawing" sub="Switch to Select tool after placing a markup">
          <Switch checked={s.autoSelectAfterDraw} onChange={(_, v) => set({ autoSelectAfterDraw: v })} size="small" sx={swSx} />
        </Row>

        <Row label="Confirm before delete" sub="Ask for confirmation before removing markups">
          <Switch checked={s.confirmOnDelete} onChange={(_, v) => set({ confirmOnDelete: v })} size="small" sx={swSx} />
        </Row>

        <Row label="Snap to grid" sub="Align markups to grid when moving">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Switch checked={s.snapToGrid} onChange={(_, v) => set({ snapToGrid: v })} size="small" sx={swSx} />
            {s.snapToGrid && (
              <Select size="small" value={s.gridSize} onChange={e => set({ gridSize: e.target.value as number })}
                sx={{ height: 24, fontSize: '0.7rem', minWidth: 50, borderRadius: '6px' }}>
                {[5, 10, 15, 20, 25, 50].map(g => <MenuItem key={g} value={g} sx={{ fontSize: '0.7rem' }}>{g}px</MenuItem>)}
              </Select>
            )}
          </Box>
        </Row>

        <Row label="Show polyline length" sub="Display measurement on polylines by default">
          <Switch checked={s.showPolylineLength} onChange={(_, v) => set({ showPolylineLength: v })} size="small" sx={swSx} />
        </Row>

        <Row label="Pulse review markups" sub="Glowing animation on review stamps and flagged markups">
          <Switch checked={s.pulseReviewMarkups} onChange={(_, v) => set({ pulseReviewMarkups: v })} size="small" sx={swSx} />
        </Row>

        {s.pulseReviewMarkups && (
          <>
            <Row label="Pulse color" sub="Color of the pulsation glow">
              <Box sx={{ position: 'relative', width: 24, height: 24 }}>
                <Box sx={{ width: 24, height: 24, borderRadius: '6px', bgcolor: s.pulseColor, border: `2px solid ${gold}` }} />
                <input type="color" value={s.pulseColor} onChange={e => set({ pulseColor: e.target.value })}
                  onClick={e => e.stopPropagation()} title=""
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
              </Box>
            </Row>
            <Row label="Pulse intensity">
              <ToggleButtonGroup exclusive size="small" value={s.pulseIntensity}
                onChange={(_, v) => { if (v) set({ pulseIntensity: v }); }}
                sx={{ height: 28, '& .Mui-selected': { bgcolor: `${alpha(gold, 0.15)} !important`, color: `${gold} !important` } }}>
                <ToggleButton value="low" sx={{ px: 1, fontSize: '0.68rem', textTransform: 'none' }}>Low</ToggleButton>
                <ToggleButton value="medium" sx={{ px: 1, fontSize: '0.68rem', textTransform: 'none' }}>Med</ToggleButton>
                <ToggleButton value="high" sx={{ px: 1, fontSize: '0.68rem', textTransform: 'none' }}>High</ToggleButton>
              </ToggleButtonGroup>
            </Row>
          </>
        )}

        {/* ── INTERFACE ── */}
        <Section icon={<DesktopWindowsIcon />} title="Interface" />

        <Row label="Show author on markup" sub="Display creator name on each markup directly on the canvas">
          <Switch checked={s.showAuthorOnMarkup} onChange={(_, v) => set({ showAuthorOnMarkup: v })} size="small" sx={swSx} />
        </Row>

        <Row label="Theme" sub="Switch between light and dark mode">
          <ToggleButtonGroup exclusive value={mode} onChange={() => toggleTheme()} size="small"
            sx={{ height: 28, '& .Mui-selected': { bgcolor: `${alpha(gold, 0.15)} !important`, color: `${gold} !important`, fontWeight: 700 } }}>
            <ToggleButton value="light" sx={{ px: 1.5, fontSize: '0.7rem', textTransform: 'none', borderRadius: '8px 0 0 8px' }}>
              <LightModeIcon sx={{ fontSize: 14, mr: 0.5 }} /> Light
            </ToggleButton>
            <ToggleButton value="dark" sx={{ px: 1.5, fontSize: '0.7rem', textTransform: 'none', borderRadius: '0 8px 8px 0' }}>
              <DarkModeIcon sx={{ fontSize: 14, mr: 0.5 }} /> Dark
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>

        {/* ── QUICK WHEEL — Dota-style slot editor ── */}
        {canMarkup && <Section icon={<TuneIcon />} title="Quick Wheel (Q / Middle Click)" />}

        {canMarkup && (() => {
          const ALL_TOOLS = [
            // Standard
            { id: 'select', label: 'Select', color: '#607d8b', group: 'Standard', icon: <AdsClickIcon sx={{ fontSize: 14 }} /> },
            { id: 'pen', label: 'Pen', color: '#f44336', group: 'Standard', icon: <CreateIcon sx={{ fontSize: 14 }} /> },
            { id: 'highlighter', label: 'Highlight', color: '#ffeb3b', group: 'Standard', icon: <HighlightIcon sx={{ fontSize: 14 }} /> },
            { id: 'rect', label: 'Rectangle', color: '#2196f3', group: 'Standard', icon: <RectangleIcon sx={{ fontSize: 14 }} /> },
            { id: 'circle', label: 'Circle', color: '#00bcd4', group: 'Standard', icon: <CircleOutlinedIcon sx={{ fontSize: 14 }} /> },
            { id: 'cloud', label: 'Cloud', color: '#9c27b0', group: 'Standard', icon: <CloudQueueIcon sx={{ fontSize: 14 }} /> },
            { id: 'callout', label: 'Callout', color: '#ff9800', group: 'Standard', icon: <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} /> },
            { id: 'text', label: 'Text', color: '#4caf50', group: 'Standard', icon: <TextFormatIcon sx={{ fontSize: 14 }} /> },
            { id: 'line', label: 'Line', color: '#795548', group: 'Standard', icon: <HorizontalRuleIcon sx={{ fontSize: 14 }} /> },
            { id: 'arrow', label: 'Arrow', color: '#e91e63', group: 'Standard', icon: <EastIcon sx={{ fontSize: 14 }} /> },
            { id: 'measure', label: 'Measure', color: '#00bcd4', group: 'Standard', icon: <StraightenIcon sx={{ fontSize: 14 }} /> },
            { id: 'polyline', label: 'Polyline', color: '#ff5722', group: 'Standard', icon: <PolylineIcon sx={{ fontSize: 14 }} /> },
            { id: 'image', label: 'Image', color: '#607d8b', group: 'Standard', icon: <ImageOutlinedIcon sx={{ fontSize: 14 }} /> },
            // Review — Sticky Note
            { id: 'stickyNote', label: 'Sticky Note', color: '#FFEB3B', group: 'Review', icon: <span style={{ fontSize: 14 }}>📝</span> },
            // Review Stamps — Status
            { id: 'stamp-approved', label: 'Approved', color: '#4caf50', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-rejected', label: 'Rejected', color: '#f44336', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-revise', label: 'Revise & Resubmit', color: '#ff9800', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-review', label: 'For Review', color: '#2196f3', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-verified', label: 'Verified', color: '#00bcd4', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-not-approved', label: 'Not Approved', color: '#f44336', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            // Review Stamps — Issues
            { id: 'stamp-dim-error', label: 'Dimension Error', color: '#e91e63', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-missing', label: 'Missing Detail', color: '#ff5722', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-conflict', label: 'Conflict', color: '#f44336', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-code-viol', label: 'Code Violation', color: '#d32f2f', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-verify', label: 'Verify', color: '#ff9800', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-coord', label: 'Coordinate', color: '#ff9800', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            // Review Stamps — Notes
            { id: 'stamp-note', label: 'Note', color: '#2196f3', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-question', label: 'Question', color: '#9c27b0', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-rfi', label: 'RFI', color: '#e91e63', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-attention', label: 'Attention', color: '#ff5722', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            // Review Stamps — Favorites
            { id: 'stamp-fav-overlap', label: 'Overlap', color: '#e53935', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-fav-font', label: 'Font', color: '#5c6bc0', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-fav-wrong', label: 'Wrong', color: '#d32f2f', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-fav-info', label: 'Info', color: '#0288d1', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-fav-missed', label: 'Missed', color: '#ef6c00', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-fav-other', label: 'Other', color: '#78909c', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-fav-dim', label: 'Dimension', color: '#f4511e', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-fav-tag', label: 'Tag', color: '#7b1fa2', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-fav-align', label: 'Align', color: '#00897b', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            { id: 'stamp-fav-callme', label: 'Call Me', color: '#1565c0', group: 'Review', icon: <PlaylistAddCheckIcon sx={{ fontSize: 14 }} /> },
            // Electrical — Conduit
            { id: 'elec-conduit-3/4', label: '3/4" Conduit', color: '#ff5722', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-conduit-1', label: '1" Conduit', color: '#ff5722', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-conduit-1.5', label: '1-1/2" Conduit', color: '#ff5722', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-conduit-2', label: '2" Conduit', color: '#ff5722', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-conduit-3', label: '3" Conduit', color: '#ff5722', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-conduit-4', label: '4" Conduit', color: '#ff5722', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            // Electrical — Boxes
            { id: 'electricalBox', label: 'Junction Box', color: '#795548', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-pullbox', label: 'Pull Box', color: '#795548', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-custombox', label: 'Custom Box', color: '#795548', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            // Electrical — Stubs & Supports
            { id: 'stub', label: 'Stub Up', color: '#607d8b', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-stubdown', label: 'Stub Down', color: '#607d8b', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-trapeze', label: 'Trapeze', color: '#607d8b', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-unistrut', label: 'Unistrut', color: '#607d8b', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-hanger', label: 'Hanger', color: '#607d8b', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            // Electrical — Equipment
            { id: 'panel', label: 'Panel', color: '#455a64', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-disconnect', label: 'Disconnect', color: '#455a64', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-transformer', label: 'Transformer', color: '#455a64', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-motor', label: 'Motor', color: '#455a64', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            // Electrical — Labels
            { id: 'wireTag', label: 'Wire Tag', color: '#9c27b0', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-homerun', label: 'Home Run', color: '#9c27b0', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-feeder', label: 'Feeder Tag', color: '#9c27b0', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'elec-circuit', label: 'Circuit Label', color: '#9c27b0', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            { id: 'routeTemplate', label: 'Route Template', color: '#00bcd4', group: 'Electrical', icon: <ElectricalServicesIcon sx={{ fontSize: 14 }} /> },
            // Tool Chest presets (dynamic)
            ...presets.map(p => {
              const rawStroke = (p.fields || []).find((f: any) => f.key === 'stroke')?.defaultValue;
              const stroke = (!rawStroke || rawStroke === 'transparent' || rawStroke === 'none') ? '#795548' : rawStroke;
              return { id: `preset-${p.id}`, label: p.name, color: stroke, group: 'Tool Chest', icon: <ConstructionIcon sx={{ fontSize: 14 }} /> };
            }),
          ];
          const toolMap = Object.fromEntries(ALL_TOOLS.map(t => [t.id, t]));
          const slots = s.wheelItems || [];
          const R = isMobile ? 65 : 80;
          const SZ = isMobile ? 32 : 38;

          return (
            <Box sx={{ mb: 1 }}>
              {/* Visual wheel preview */}
              <Box sx={{ position: 'relative', width: (R + SZ / 2) * 2 + 4, height: (R + SZ / 2) * 2 + 4, mx: 'auto', mb: 1.5 }}>
                {/* Ring */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <circle cx={R + SZ / 2 + 2} cy={R + SZ / 2 + 2} r={R} fill="none"
                    stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} strokeWidth={SZ + 4} />
                </svg>
                {/* Center */}
                <Box sx={{
                  position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                  width: 30, height: 30, borderRadius: '50%',
                  bgcolor: isDark ? '#333' : '#eee', border: `2px solid ${alpha(gold, 0.3)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.55rem', fontWeight: 800, color: gold,
                }}>Q</Box>
                {/* Slots */}
                {slots.map((id, idx) => {
                  const angle = ((Math.PI * 2) / slots.length) * idx - Math.PI / 2;
                  const cx = Math.cos(angle) * R + R + SZ / 2 + 2;
                  const cy = Math.sin(angle) * R + R + SZ / 2 + 2;
                  const t = toolMap[id];
                  return (
                    <Box key={idx} sx={{
                      position: 'absolute', left: cx - SZ / 2, top: cy - SZ / 2, width: SZ, height: SZ,
                      borderRadius: '10px', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      bgcolor: t ? alpha(t.color, 0.12) : (isDark ? '#2a2a2a' : '#f5f5f5'),
                      border: `2px solid ${t ? t.color : theme.palette.divider}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                      '&:hover': { transform: 'scale(1.1)', boxShadow: `0 0 0 3px ${alpha(t?.color || gold, 0.2)}` },
                    }}
                      onClick={() => {
                        // Remove this slot
                        const next = [...slots];
                        next.splice(idx, 1);
                        set({ wheelItems: next });
                      }}
                    >
                      <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: t?.color || '#999', mb: 0.15 }} />
                      <Typography sx={{ fontSize: '0.42rem', fontWeight: 700, lineHeight: 1, color: t?.color || 'text.disabled' }}>
                        {t?.label || '?'}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* Tool palette — search + add to wheel */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <input
                  placeholder="Search tools..."
                  value={wheelSearch}
                  onChange={e => setWheelSearch(e.target.value)}
                  style={{
                    flex: 1, height: 28, borderRadius: 8, border: `1.5px solid ${theme.palette.divider}`,
                    padding: '0 10px', fontSize: '0.76rem', background: 'transparent',
                    color: theme.palette.text.primary, outline: 'none',
                  }}
                />
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: gold, whiteSpace: 'nowrap' }}>
                  {slots.length}/15
                </Typography>
              </Box>
              {['Standard', 'Review', 'Electrical', 'Tool Chest'].map(group => {
                const q = wheelSearch.toLowerCase();
                const groupTools = ALL_TOOLS.filter(t => t.group === group && !slots.includes(t.id) && (!q || t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)));
                if (groupTools.length === 0) return null;
                return (
                  <Box key={group} sx={{ mb: 1 }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: alpha(gold, 0.7), mb: 0.5, letterSpacing: 0.5 }}>
                      {group}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {groupTools.map((t: any) => (
                        <Box key={t.id} onClick={() => { if (slots.length >= 15) return; set({ wheelItems: [...slots, t.id] }); }}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 0.5,
                            px: 1, py: 0.4, borderRadius: '8px',
                            cursor: slots.length >= 15 ? 'not-allowed' : 'pointer',
                            border: `1.5px solid ${theme.palette.divider}`,
                            opacity: slots.length >= 15 ? 0.4 : 1,
                            '&:hover': slots.length < 15 ? { borderColor: t.color, bgcolor: alpha(t.color, 0.1) } : {},
                            transition: 'all 0.12s',
                          }}>
                          {t.icon ? <Box sx={{ display: 'flex', color: t.color, '& svg': { fontSize: 15 } }}>{t.icon}</Box> : <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: t.color }} />}
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, color: 'text.primary' }}>{t.label}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          );
        })()}

        {/* ── COLLABORATION ── */}
        <Section icon={<GroupsIcon />} title="Collaboration" />

        <Row label="Live cursors" sub="See where other users are working in real-time">
          <Switch checked={s.showCursors} onChange={(_, v) => set({ showCursors: v })} size="small" sx={swSx} />
        </Row>

        <Row label="Auto-import annotations" sub="Import Bluebeam/Acrobat markups on first open">
          <Switch checked={s.autoImportAnnotations} onChange={(_, v) => set({ autoImportAnnotations: v })} size="small" sx={swSx} />
        </Row>

      </DialogContent>
    </Dialog>
  );
}
