import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Select, MenuItem, TextField, IconButton, useTheme, alpha, Divider,
} from '@mui/material';
import RouteIcon from '@mui/icons-material/Route';
import CloseIcon from '@mui/icons-material/Close';

export interface RouteWizardDialogProps {
  open: boolean;
  onClose: () => void;
  templates: any[]; // markups with type routeTemplate on current page
  selectedDevices: any[]; // currently selected markups (the devices/endpoints)
  onStartRouting: (templateId: string, spacing: number) => void;
}

export default function RouteWizardDialog({
  open, onClose, templates, selectedDevices, onStartRouting,
}: RouteWizardDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;

  const [templateId, setTemplateId] = useState('');
  const [spacing, setSpacing] = useState(0.005);

  // Reset when dialog opens
  useEffect(() => {
    if (!open) return;
    setTemplateId(templates.length === 1 ? templates[0].id : '');
    setSpacing(0.005);
  }, [open, templates]);

  const canStart = templateId !== '';
  const hasDevices = selectedDevices.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          border: 1,
          borderColor: alpha(gold, 0.3),
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <RouteIcon sx={{ color: gold }} />
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>Route Redline</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Step 1: Select template */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.8rem' }}>
            1. Select Route Template
          </Typography>
          <Select
            fullWidth
            size="small"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            displayEmpty
            sx={{
              fontSize: '0.85rem',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(gold, 0.3) },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: gold },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: gold },
            }}
          >
            <MenuItem value="" disabled>
              <em>Choose a template...</em>
            </MenuItem>
            {templates.map((t: any) => (
              <MenuItem key={t.id} value={t.id}>
                {t.properties?.subject || `Template ${t.id.slice(0, 6)}`}
              </MenuItem>
            ))}
          </Select>
          {templates.length === 0 && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
              No route templates on this page. Draw one first using the Route Template tool.
            </Typography>
          )}
        </Box>

        {/* Step 2: Spacing */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.8rem' }}>
            2. Parallel Spacing
          </Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            value={spacing}
            onChange={(e) => setSpacing(parseFloat(e.target.value) || 0)}
            inputProps={{ step: 0.001, min: 0, max: 0.1 }}
            helperText="Distance between parallel routes (0 = overlapping)"
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '0.85rem',
                '& fieldset': { borderColor: alpha(gold, 0.3) },
                '&:hover fieldset': { borderColor: gold },
                '&.Mui-focused fieldset': { borderColor: gold },
              },
            }}
          />
        </Box>

        {/* Step 3: Info */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'text.secondary', fontSize: '0.8rem' }}>
            3. {hasDevices ? 'Set Panel Location' : 'Draw Route Points'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
            {hasDevices ? (
              <>After clicking <strong>Start Routing</strong>, click on the drawing to place the panel (start point). Routes will be generated from that point to each selected device ({selectedDevices.length} selected).</>
            ) : (
              <>After clicking <strong>Start Routing</strong>, click point by point on the drawing to trace the route. Double-click to finish. Each segment will follow the template backbone.</>
            )}
          </Typography>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          size="small"
          disabled={!canStart}
          onClick={() => {
            onStartRouting(templateId, spacing);
            onClose();
          }}
          sx={{
            bgcolor: gold,
            color: isDark ? '#000' : '#fff',
            '&:hover': { bgcolor: alpha(gold, 0.85) },
            '&.Mui-disabled': { bgcolor: alpha(gold, 0.3) },
          }}
        >
          Start Routing
        </Button>
      </DialogActions>
    </Dialog>
  );
}
