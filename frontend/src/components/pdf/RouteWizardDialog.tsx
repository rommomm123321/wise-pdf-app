import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Select,
  MenuItem,
  TextField,
  IconButton,
  useTheme,
  alpha,
  Divider,
  useMediaQuery,
} from "@mui/material";
import RouteIcon from "@mui/icons-material/Route";
import CloseIcon from "@mui/icons-material/Close";

export interface ConduitInfo {
  conduitSize: string;
  strokeWidth: number;
}

export interface RouteWizardDialogProps {
  open: boolean;
  onClose: () => void;
  templates: any[]; // markups with type routeTemplate on current page
  selectedDevices: any[]; // currently selected markups (the devices/endpoints)
  onStartRouting: (
    templateId: string,
    spacing: number,
    conduit?: ConduitInfo,
  ) => void;
}

export default function RouteWizardDialog({
  open,
  onClose,
  templates,
  selectedDevices,
  onStartRouting,
}: RouteWizardDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useMediaQuery("(max-width:550px)");
  const gold = theme.palette.primary.main;

  const CONDUIT_OPTIONS: {
    label: string;
    size: string;
    strokeWidth: number;
  }[] = [
    { label: "None", size: "", strokeWidth: 2 },
    { label: '3/4"', size: '3/4"', strokeWidth: 2 },
    { label: '1"', size: '1"', strokeWidth: 2 },
    { label: '1-1/4"', size: '1-1/4"', strokeWidth: 2 },
    { label: '1-1/2"', size: '1-1/2"', strokeWidth: 3 },
    { label: '2"', size: '2"', strokeWidth: 3 },
    { label: '2-1/2"', size: '2-1/2"', strokeWidth: 4 },
    { label: '3"', size: '3"', strokeWidth: 5 },
    { label: '4"', size: '4"', strokeWidth: 6 },
    { label: '6"', size: '6"', strokeWidth: 8 },
  ];

  const [templateId, setTemplateId] = useState("");
  const [spacing, setSpacing] = useState(0.003);
  const [conduitIdx, setConduitIdx] = useState(0);

  // Reset when dialog opens
  useEffect(() => {
    if (!open) return;
    setTemplateId(templates.length === 1 ? templates[0].id : "");
    setSpacing(0.003);
    setConduitIdx(0);
  }, [open, templates]);

  const hasDevices = selectedDevices.length > 0;
  const canStart = templateId !== "" && hasDevices;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          bgcolor: "background.paper",
          border: isMobile ? 0 : 1,
          borderColor: alpha(gold, 0.3),
          borderRadius: isMobile ? 0 : 2,
        },
      }}
    >
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}
      >
        <RouteIcon sx={{ color: gold }} />
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
          Route Redline
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent
        sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2.5 }}
      >
        {/* Step 1: Select template */}
        <Box>
          <Typography
            variant="subtitle2"
            sx={{ mb: 0.5, color: "text.secondary", fontSize: "0.8rem" }}
          >
            1. Select Route Template
          </Typography>
          <Select
            fullWidth
            size="small"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            displayEmpty
            sx={{
              fontSize: "0.85rem",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: alpha(gold, 0.3),
              },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: gold },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: gold,
              },
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
            <Typography
              variant="caption"
              color="error"
              sx={{ mt: 0.5, display: "block" }}
            >
              No route templates on this page. Draw one first using the Route
              Template tool.
            </Typography>
          )}
        </Box>

        {/* Step 2: Conduit Type */}
        <Box>
          <Typography
            variant="subtitle2"
            sx={{ mb: 0.5, color: "text.secondary", fontSize: "0.8rem" }}
          >
            2. Conduit Type
          </Typography>
          <Select
            fullWidth
            size="small"
            value={conduitIdx}
            onChange={(e) => setConduitIdx(Number(e.target.value))}
            sx={{
              fontSize: "0.85rem",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: alpha(gold, 0.3),
              },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: gold },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: gold,
              },
            }}
          >
            {CONDUIT_OPTIONS.map((opt, i) => (
              <MenuItem key={i} value={i}>
                {opt.label}
                {opt.size ? ` (${opt.strokeWidth}px)` : ""}
              </MenuItem>
            ))}
          </Select>
        </Box>

        {/* Step 3: Spacing */}
        <Box>
          <Typography
            variant="subtitle2"
            sx={{ mb: 0.5, color: "text.secondary", fontSize: "0.8rem" }}
          >
            3. Parallel Spacing
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
              "& .MuiOutlinedInput-root": {
                fontSize: "0.85rem",
                "& fieldset": { borderColor: alpha(gold, 0.3) },
                "&:hover fieldset": { borderColor: gold },
                "&.Mui-focused fieldset": { borderColor: gold },
              },
            }}
          />
        </Box>

        {/* Step 4: Info */}
        <Box>
          <Typography
            variant="subtitle2"
            sx={{ mb: 0.5, color: "text.secondary", fontSize: "0.8rem" }}
          >
            4. {hasDevices ? "Set Panel Location" : "Draw Route Points"}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontSize: "0.82rem" }}
          >
            {hasDevices ? (
              <>
                After clicking <strong>Start Routing</strong>, click on the
                drawing to place the panel (start point). Routes will be
                generated from that point to each selected device (
                {selectedDevices.length} selected).
              </>
            ) : (
              <>
                After clicking <strong>Start Routing</strong>, click point by
                point on the drawing to trace the route. Double-click to finish.
                Each segment will follow the template backbone.
              </>
            )}
          </Typography>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          size="small"
          disabled={!canStart}
          onClick={() => {
            const conduit = CONDUIT_OPTIONS[conduitIdx];
            onStartRouting(
              templateId,
              spacing,
              conduit.size
                ? {
                    conduitSize: conduit.size,
                    strokeWidth: conduit.strokeWidth,
                  }
                : undefined,
            );
            onClose();
          }}
          sx={{
            bgcolor: gold,
            color: isDark ? "#000" : "#fff",
            "&:hover": { bgcolor: alpha(gold, 0.85) },
            "&.Mui-disabled": { bgcolor: alpha(gold, 0.3) },
          }}
        >
          Start Routing
        </Button>
      </DialogActions>
    </Dialog>
  );
}
