import { memo, useState, useEffect } from "react";
import {
  Box, IconButton, Tooltip, Toolbar, Typography, useTheme, alpha, Select, MenuItem, ListSubheader, Menu, ListItemIcon, ListItemText, InputBase, useMediaQuery, Popover, CircularProgress, Slider
} from "@mui/material";
import Divider from "@mui/material/Divider";
import PanToolIcon from "@mui/icons-material/PanTool";
import RectangleIcon from "@mui/icons-material/Rectangle";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import TextFormatIcon from "@mui/icons-material/TextFormat";
import CreateIcon from "@mui/icons-material/Create";
import HighlightIcon from "@mui/icons-material/Highlight";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import StraightenIcon from "@mui/icons-material/Straighten";
import PolylineIcon from "@mui/icons-material/Polyline";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import ChangeHistoryIcon from "@mui/icons-material/ChangeHistory";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DownloadIcon from "@mui/icons-material/Download";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import LayersIcon from "@mui/icons-material/Layers";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import TimelineIcon from "@mui/icons-material/Timeline";
import EastIcon from "@mui/icons-material/East";
import ArticleIcon from "@mui/icons-material/Article";
import ViewDayIcon from "@mui/icons-material/ViewDay";
import VerticalSplitIcon from "@mui/icons-material/VerticalSplit";
import AbcIcon from "@mui/icons-material/Abc";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import TuneIcon from "@mui/icons-material/Tune";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import RouteIcon from "@mui/icons-material/Route";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";

export type DrawTool =
  | "select"
  | "pan"
  | "textSelect"
  | "pen"
  | "highlighter"
  | "line"
  | "arrow"
  | "rect"
  | "circle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "star"
  | "cloud"
  | "callout"
  | "text"
  | "measure"
  | "polyline"
  | "routeTemplate"
  | "image";

export type LineStyle = "solid" | "dashed" | "dotted" | "dash-dot" | "long-dash" | "short-dash" | "dash-dot-dot" | "long-dash-dot";
export type ArrowEnd = "none" | "arrow" | "open-arrow" | "circle" | "diamond" | "square";

export const SHAPE_TOOLS: { key: DrawTool; icon: React.ReactNode; label: string }[] = [
  { key: "rect", icon: <RectangleIcon fontSize="small" />, label: "Rectangle" },
  { key: "circle", icon: <CircleOutlinedIcon fontSize="small" />, label: "Circle" },
  { key: "ellipse", icon: <CircleOutlinedIcon fontSize="small" sx={{ transform: "scaleX(1.4)" }} />, label: "Ellipse" },
  { key: "triangle", icon: <ChangeHistoryIcon fontSize="small" />, label: "Triangle" },
  { key: "diamond", icon: <ChangeHistoryIcon fontSize="small" sx={{ transform: "rotate(45deg) scale(0.8)" }} />, label: "Diamond" },
  { key: "hexagon", icon: <HexagonOutlinedIcon fontSize="small" />, label: "Hexagon" },
  { key: "star", icon: <StarOutlineIcon fontSize="small" />, label: "Star" },
];

export const LINE_STYLES: { key: LineStyle; label: string; dash: number[] }[] = [
  { key: "solid", label: "Solid", dash: [] },
  { key: "dashed", label: "Dashed", dash: [12, 6] },
  { key: "dotted", label: "Dotted", dash: [2, 4] },
  { key: "dash-dot", label: "Dash-Dot", dash: [15, 6, 3, 6] },
  { key: "dash-dot-dot", label: "Dash-Dot-Dot", dash: [15, 6, 3, 6, 3, 6] },
  { key: "long-dash", label: "Long Dash", dash: [25, 8] },
  { key: "short-dash", label: "Short Dash", dash: [6, 4] },
  { key: "long-dash-dot", label: "L-Dash-Dot", dash: [25, 8, 3, 8] },
];

export const LinePreview = ({ style, width = 1, previewWidth = 80, forceColor }: { style: LineStyle, width?: number, previewWidth?: number, forceColor?: string }) => {
  const dash = LINE_STYLES.find((s) => s.key === style)?.dash || [];
  const c = forceColor || "currentColor";
  const visualStrokeWidth = 1; // Always fixed thickness for UI previews
  return (
    <Box sx={{ width: previewWidth, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="100%" height="100%" style={{ overflow: "visible" }}>
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke={c} strokeWidth={visualStrokeWidth} strokeDasharray={dash.length > 0 ? dash.map((d) => d / 2.5).join(",") : "none"} strokeLinecap="round" />
      </svg>
    </Box>
  );
};

export const STANDARD_SCALES = [
  { label: "1:1", value: "1:1" },
  { group: "Architectural", items: [{ label: '1/16" = 1\'0"', value: '1/16"=1\'0"' }, { label: '1/8" = 1\'0"', value: '1/8"=1\'0"' }, { label: '3/16" = 1\'0"', value: '3/16"=1\'0"' }, { label: '1/4" = 1\'0"', value: '1/4"=1\'0"' }, { label: '3/8" = 1\'0"', value: '3/8"=1\'0"' }, { label: '1/2" = 1\'0"', value: '1/2"=1\'0"' }, { label: '3/4" = 1\'0"', value: '3/4"=1\'0"' }, { label: '1" = 1\'0"', value: '1"=1\'0"' }, { label: '1-1/2" = 1\'0"', value: '1-1/2"=1\'0"' }, { label: '3" = 1\'0"', value: '3"=1\'0"' }] },
  { group: "Engineering", items: [{ label: "1\" = 10'", value: "1\"=10'" }, { label: "1\" = 20'", value: "1\"=20'" }, { label: "1\" = 30'", value: "1\"=30'" }, { label: "1\" = 40'", value: "1\"=40'" }, { label: "1\" = 50'", value: "1\"=50'" }, { label: "1\" = 60'", value: "1\"=60'" }] },
  { group: "Metric", items: [{ label: "1:2", value: "1:2" }, { label: "1:5", value: "1:5" }, { label: "1:10", value: "1:10" }, { label: "1:20", value: "1:20" }, { label: "1:50", value: "1:50" }, { label: "1:100", value: "1:100" }, { label: "1:200", value: "1:200" }, { label: "1:500", value: "1:500" }, { label: "1:1000", value: "1:1000" }] },
];

interface PdfToolbarProps {
  tool: DrawTool; onToolChange: (t: DrawTool) => void;
  activeColor: string; onColorChange: (c: string) => void;
  activeStrokeWidth: number; onStrokeWidthChange: (w: number) => void;
  activeLineStyle: LineStyle; onLineStyleChange: (s: LineStyle) => void;
  docScale: string; onDocScaleChange: (s: string) => void;
  zoom: number; onZoomIn: () => void; onZoomOut: () => void;
  currentPage: number; numPages: number; onPageChange: (page: number) => void;
  scrollMode: "page" | "continuous" | "split"; onScrollModeChange: (m: "page" | "continuous" | "split") => void;
  canUndo?: boolean; canRedo?: boolean; onUndo?: () => void; onRedo?: () => void;
  versions?: any[]; currentDocId?: string; onVersionChange?: (docId: string) => void;
  sidebarOpen: boolean; onToggleSidebar: () => void;
  canMarkup?: boolean;
  onExportPdf?: () => void;
  isExporting?: boolean;
  onDownloadClean?: () => void;
  pageMarkupCount?: number;
  embeddedAnnotCount?: number;
  onImportAnnotations?: () => void;
  isImporting?: boolean;
  onAddReviewStamp?: (stamp: ReviewStamp) => void;
  onCompare?: () => void;
  isCompareMode?: boolean;
  // Compare sub-bar controls (rendered as dropdown under toolbar)
  compareControls?: {
    oldColor: string; newColor: string; opacity: number;
    showOld: boolean; showNew: boolean;
    oldLabel: string; newLabel: string;
    onToggleOld: () => void; onToggleNew: () => void;
    onOpacityChange: (v: number) => void;
    onExport: () => void; onSave: () => void; onClose: () => void;
  } | null;
}

// ─── Review Stamps — pre-built markup templates for document checking ───────
export interface ReviewStamp {
  id: string;
  label: string;
  icon: string;      // emoji
  color: string;     // hex
  subject: string;   // maps to markup subject
  status?: string;   // auto-set status
  comment?: string;  // pre-filled comment
  type: DrawTool;    // markup type (cloud, rect, text, arrow, callout)
  category: string;
}

export const REVIEW_STAMPS: ReviewStamp[] = [
  // ── Status stamps ──
  { id: 'approved',    label: 'Approved',        icon: '✓', color: '#4caf50', subject: 'Approved',         status: 'accepted',  type: 'cloud',   category: 'Status' },
  { id: 'rejected',    label: 'Rejected',        icon: '✗', color: '#f44336', subject: 'Rejected',         status: 'rejected',  type: 'cloud',   category: 'Status' },
  { id: 'revise',      label: 'Revise & Resubmit', icon: '↻', color: '#ff9800', subject: 'Revise & Resubmit', status: 'cancelled', type: 'cloud',   category: 'Status' },
  { id: 'for-review',  label: 'For Review',      icon: '?', color: '#2196f3', subject: 'For Review',       status: 'none',      type: 'rect',    category: 'Status' },
  { id: 'verified',    label: 'Verified',        icon: '✔', color: '#00bcd4', subject: 'Verified',         status: 'completed', type: 'cloud',   category: 'Status' },

  // ── Issue types ──
  { id: 'dim-error',   label: 'Dimension Error', icon: '📐', color: '#f44336', subject: 'Dimension Error', type: 'callout', category: 'Issues' },
  { id: 'missing',     label: 'Missing Detail',  icon: '⚠',  color: '#ff9800', subject: 'Missing Detail',  type: 'callout', category: 'Issues' },
  { id: 'conflict',    label: 'Conflict',        icon: '⚡', color: '#e91e63', subject: 'Conflict',        type: 'callout', category: 'Issues' },
  { id: 'code-viol',   label: 'Code Violation',  icon: '🚫', color: '#9c27b0', subject: 'Code Violation',  type: 'callout', category: 'Issues' },
  { id: 'verify',      label: 'Verify',          icon: '❓', color: '#2196f3', subject: 'Verify in Field', type: 'arrow',   category: 'Issues' },
  { id: 'coord',       label: 'Coordinate',      icon: '🔗', color: '#607d8b', subject: 'Coordinate',      type: 'callout', category: 'Issues' },

  // ── Communication ──
  { id: 'note',        label: 'Note',            icon: '📝', color: '#ffc107', subject: 'Note',            type: 'callout', category: 'Notes' },
  { id: 'question',    label: 'Question',        icon: '❓', color: '#03a9f4', subject: 'Question',        type: 'callout', category: 'Notes' },
  { id: 'rfi',         label: 'RFI',             icon: '📋', color: '#795548', subject: 'RFI',             type: 'callout', category: 'Notes', comment: 'Request for Information: ' },
  { id: 'attention',   label: 'Attention',       icon: '❗', color: '#ff5722', subject: 'Attention Required', type: 'cloud', category: 'Notes' },
];

const PdfToolbar = memo(function PdfToolbar({
  tool, onToolChange,
  activeColor, onColorChange, activeStrokeWidth, onStrokeWidthChange,
  activeLineStyle, onLineStyleChange,
  docScale, onDocScaleChange,
  zoom, onZoomIn, onZoomOut,
  currentPage, numPages, onPageChange,
  scrollMode, onScrollModeChange,
  canUndo, canRedo, onUndo, onRedo,
  versions = [], currentDocId, onVersionChange,
  sidebarOpen, onToggleSidebar,
  canMarkup = true,
  onExportPdf,
  isExporting = false,
  onDownloadClean,
  pageMarkupCount = 0,
  embeddedAnnotCount = 0,
  onImportAnnotations,
  isImporting = false,
  onAddReviewStamp,
  onCompare,
  isCompareMode = false,
  compareControls,
}: PdfToolbarProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const gold = theme.palette.primary.main;

  // Breakpoints: progressive collapse
  const isXS = useMediaQuery("(max-width:650px)");
  const isSM = useMediaQuery("(max-width:1150px)");
  const isMD = useMediaQuery("(max-width:1400px)");
  // Bottom bar visible at ≤1050px — hide scale/version/download from toolbar to avoid duplication
  const isBottomBarVisible = useMediaQuery("(max-width:1050px)");
  // Hide right-side heavy items earlier to prevent overflow
  const hideRightHeavy = isSM;

  const [pageInput, setPageInput] = useState(currentPage.toString());
  const [localColor, setLocalColor] = useState(activeColor);
  useEffect(() => { setLocalColor(activeColor); }, [activeColor]);
  const [shapeMenuAnchor, setShapeMenuAnchor] = useState<null | HTMLElement>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [stampMenuAnchor, setStampMenuAnchor] = useState<null | HTMLElement>(null);
  const [widthAnchor, setWidthAnchor] = useState<null | HTMLElement>(null);
  const [colorAnchor, setColorAnchor] = useState<null | HTMLElement>(null);
  const [styleAnchor, setStyleAnchor] = useState<null | HTMLElement>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeAnchor, setCustomizeAnchor] = useState<null | HTMLElement>(null);

  // Toolbar customization: which tools are visible
  const [hiddenTools, setHiddenTools] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('pdfToolbarHidden') || '[]'); } catch { return []; }
  });
  const toggleToolVisibility = (toolId: string) => {
    setHiddenTools(prev => {
      const next = prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId];
      localStorage.setItem('pdfToolbarHidden', JSON.stringify(next));
      return next;
    });
  };
  const isToolVisible = (toolId: string) => !hiddenTools.includes(toolId);

  const DEFAULT_TOOL_ORDER = ['pan','textSelect','pen','highlighter','line','arrow','shapes','cloud','text','callout','measure','polyline','routeTemplate','image','stamps'];

  useEffect(() => { setPageInput(currentPage.toString()); }, [currentPage]);

  const handlePageSubmit = () => {
    const val = parseInt(pageInput);
    if (!isNaN(val) && val >= 1 && val <= numPages) onPageChange(val);
    else setPageInput(currentPage.toString());
  };

  // Unified button styles — same as Pen/tool buttons
  const btnSx = {
    borderRadius: "8px", p: "7px", color: "text.secondary", transition: "all 0.15s",
    "&:hover": { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', color: "text.primary" },
    "&.Mui-disabled": { opacity: 0.3 }
  };
  const activeBtnSx = {
    ...btnSx,
    bgcolor: alpha(gold, 0.15), color: gold,
    "&:hover": { bgcolor: alpha(gold, 0.22) }
  };
  const dividerSx = { mx: 0.75, height: 20, alignSelf: "center", borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' };
  // Pill group wrapper — groups tools like Miro
  const pillSx = {
    display: 'flex', alignItems: 'center', gap: '2px',
    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    borderRadius: '10px', px: '4px', py: '3px',
  };

  // Property block — same hover as buttons
  const propBlockSx = {
    display: "flex", alignItems: "center", justifyContent: "center",
    px: "6px", py: "4px", borderRadius: "6px", cursor: "pointer",
    transition: "all 0.2s", color: "text.secondary", height: 32, minWidth: 32,
    "&:hover": { bgcolor: alpha(gold, 0.08), color: gold }
  };

  const menuPaperSx = {
    mt: 1, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: 1, borderColor: "divider",
    bgcolor: "background.paper",
    "& .MuiMenuItem-root": { fontSize: "0.75rem", gap: 1.5, borderRadius: "4px", mx: 0.5, my: 0.25 },
    "& .Mui-selected": { bgcolor: alpha(gold, 0.1) + " !important", color: gold, fontWeight: 600 },
  };

  // Select without arrow — inline transparent
  const inlineSelectSx = {
    height: 28, fontSize: "0.75rem", bgcolor: "transparent", color: "inherit",
    ".MuiOutlinedInput-notchedOutline": { border: "none" },
    ".MuiSelect-select": { p: "0 !important", display: "flex", alignItems: "center", justifyContent: "center" }
  };

  // Styled dropdown menus (dark/light themed)
  const styledMenuProps = {
    PaperProps: {
      sx: {
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        "& .MuiMenuItem-root": {
          fontSize: "0.75rem", borderRadius: "4px", mx: 0.5, my: 0.25,
          color: "text.primary",
          "&:hover": { bgcolor: alpha(gold, 0.08) },
          "&.Mui-selected": { bgcolor: alpha(gold, 0.12), color: gold, fontWeight: 600 }
        },
        "& .MuiListSubheader-root": {
          bgcolor: "background.paper",
          color: gold,
          fontSize: "0.65rem",
          fontWeight: 800,
          lineHeight: "32px"
        }
      }
    }
  };

  return (
    <>
    <Toolbar variant="dense" sx={{
      minHeight: 48, gap: 1, px: "10px !important",
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
      bgcolor: 'background.paper',
      boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
      overflow: "hidden", flexWrap: "nowrap",
      "& .MuiBox-root": { flexShrink: 0 }
    }}>

      {/* Sidebar toggle */}
      <IconButton size="small" onClick={onToggleSidebar} sx={btnSx}>
        {sidebarOpen ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
      </IconButton>
      <Divider orientation="vertical" flexItem sx={dividerSx} />

      {/* Page Nav + Scroll Mode + Zoom — hide on narrow */}
      {!isSM && (
        <>
          {/* Page nav pill */}
          <Box sx={pillSx}>
            <IconButton size="small" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} sx={btnSx}>
              <KeyboardArrowLeftIcon fontSize="small" />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.5 }}>
              <InputBase
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handlePageSubmit(); }}
                onBlur={handlePageSubmit}
                sx={{ width: 32, fontSize: "0.75rem", fontWeight: 700, textAlign: "center", "& input": { textAlign: "center", p: "1px 0" } }}
              />
              <Box component="span" sx={{ fontSize: "0.72rem", opacity: 0.45, fontWeight: 500 }}>/</Box>
              <Typography variant="caption" sx={{ opacity: 0.55, fontSize: "0.72rem", fontWeight: 500 }}>{numPages}</Typography>
            </Box>
            <IconButton size="small" onClick={() => onPageChange(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages} sx={btnSx}>
              <KeyboardArrowRightIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Scroll Mode pill — single / continuous only */}
          <Box sx={pillSx}>
            <Tooltip title={t("singlePage", "Single Page")}>
              <IconButton size="small" onClick={() => onScrollModeChange("page")} sx={scrollMode === "page" ? activeBtnSx : btnSx}>
                <ArticleIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("continuousScroll", "Continuous Scroll")}>
              <IconButton size="small" onClick={() => onScrollModeChange("continuous")} sx={scrollMode === "continuous" ? activeBtnSx : btnSx}>
                <ViewDayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Zoom pill */}
          <Box sx={pillSx}>
            <Tooltip title="Zoom Out">
              <IconButton size="small" onClick={onZoomOut} sx={btnSx}><ZoomOutIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Typography variant="caption" sx={{ minWidth: 38, textAlign: "center", fontWeight: 700, fontSize: "0.72rem" }}>
              {Math.round(zoom * 100)}%
            </Typography>
            <Tooltip title="Zoom In">
              <IconButton size="small" onClick={onZoomIn} sx={btnSx}><ZoomInIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Box>
        </>
      )}

      {/* Core Drawing Tools */}
      <Box sx={pillSx}>
        <Tooltip title="Select (V)">
          <IconButton size="small" sx={tool === "select" ? activeBtnSx : btnSx} onClick={() => onToolChange("select")}>
            <AdsClickIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {isToolVisible('pan') && !isXS && (
          <Tooltip title="Pan (Space)">
            <IconButton size="small" sx={tool === "pan" ? activeBtnSx : btnSx} onClick={() => onToolChange("pan")}>
              <PanToolIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {isToolVisible('textSelect') && (
          <Tooltip title="Select Text">
            <IconButton size="small" sx={tool === "textSelect" ? activeBtnSx : btnSx} onClick={() => onToolChange("textSelect")}>
              <AbcIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {canMarkup && (
          <>
            {isToolVisible('pen') && (
              <Tooltip title="Pen (P)">
                <IconButton size="small" sx={tool === "pen" ? activeBtnSx : btnSx} onClick={() => onToolChange("pen")}>
                  <CreateIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {isToolVisible('highlighter') && (
              <Tooltip title="Highlighter (H)">
                <IconButton size="small" sx={tool === "highlighter" ? activeBtnSx : btnSx} onClick={() => onToolChange("highlighter")}>
                  <HighlightIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {!isSM && (
              <>
                {isToolVisible('line') && (
                  <Tooltip title="Line (L)">
                    <IconButton size="small" sx={tool === "line" ? activeBtnSx : btnSx} onClick={() => onToolChange("line")}>
                      <TimelineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isToolVisible('arrow') && (
                  <Tooltip title="Arrow (A)">
                    <IconButton size="small" sx={tool === "arrow" ? activeBtnSx : btnSx} onClick={() => onToolChange("arrow")}>
                      <EastIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isToolVisible('shapes') && (
                  <Tooltip title="Shapes">
                    <Box
                      display="flex"
                      sx={SHAPE_TOOLS.some((s) => s.key === tool) ? activeBtnSx : propBlockSx}
                      onClick={(e) => setShapeMenuAnchor(e.currentTarget)}
                    >
                      {SHAPE_TOOLS.find((s) => s.key === tool)?.icon || <RectangleIcon fontSize="small" />}
                    </Box>
                  </Tooltip>
                )}
              </>
            )}

            {!isMD && (
              <>
                {isToolVisible('cloud') && (
                  <Tooltip title="Cloud (C)">
                    <IconButton size="small" sx={tool === "cloud" ? activeBtnSx : btnSx} onClick={() => onToolChange("cloud")}>
                      <CloudQueueIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isToolVisible('text') && (
                  <Tooltip title="Text (T)">
                    <IconButton size="small" sx={tool === "text" ? activeBtnSx : btnSx} onClick={() => onToolChange("text")}>
                      <TextFormatIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isToolVisible('callout') && (
                  <Tooltip title="Cloud+ (O)">
                    <IconButton size="small" sx={tool === "callout" ? activeBtnSx : btnSx} onClick={() => onToolChange("callout")}>
                      <Box sx={{ position: 'relative', display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                        <CloudQueueIcon sx={{ fontSize: 18 }} />
                        <Box sx={{ position: 'absolute', bottom: 1, right: -1, fontSize: 10, fontWeight: 900, lineHeight: 1, color: 'inherit' }}>+</Box>
                      </Box>
                    </IconButton>
                  </Tooltip>
                )}
                {isToolVisible('measure') && (
                  <Tooltip title="Measure (M)">
                    <IconButton size="small" sx={tool === "measure" ? activeBtnSx : btnSx} onClick={() => onToolChange("measure")}>
                      <StraightenIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isToolVisible('polyline') && (
                  <Tooltip title="Polyline (K) — click points, dblclick to finish">
                    <IconButton size="small" sx={tool === "polyline" ? activeBtnSx : btnSx} onClick={() => onToolChange("polyline")}>
                      <PolylineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isToolVisible('routeTemplate') && canMarkup && (
                  <Tooltip title="Route Template — click points, dblclick to finish">
                    <IconButton size="small" sx={tool === "routeTemplate" ? activeBtnSx : btnSx} onClick={() => onToolChange("routeTemplate")}>
                      <RouteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isToolVisible('image') && (
                  <Tooltip title="Image">
                    <IconButton size="small" sx={tool === "image" ? activeBtnSx : btnSx} onClick={() => onToolChange("image")}>
                      <ImageOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {/* ── Review Stamps — hidden last on narrow, in Customize Toolbar ── */}
                {onAddReviewStamp && isToolVisible('stamps') && !isMD && (
                  <Tooltip title="Review Stamps">
                    <IconButton size="small" sx={btnSx} onClick={(e) => setStampMenuAnchor(e.currentTarget)}>
                      <PlaylistAddCheckIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}
          </>
        )}
      </Box>

      {/* Color + stroke — hidden when canMarkup=false */}
      {canMarkup && (
        <Box sx={pillSx}>

          {/* ── Color ── */}
          <Tooltip title="Color">
            <Box sx={{ ...propBlockSx, p: '5px' }} onClick={(e) => setColorAnchor(e.currentTarget)}>
              <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: localColor, flexShrink: 0, border: `2px solid ${alpha(isDark ? '#fff' : '#000', 0.15)}`, boxShadow: `0 0 0 2px ${alpha(localColor, 0.35)}` }} />
            </Box>
          </Tooltip>
          <Popover open={Boolean(colorAnchor)} anchorEl={colorAnchor} onClose={() => setColorAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            PaperProps={{ sx: { p: 1.5, borderRadius: '14px', border: 1, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', width: 214 } }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'text.disabled', mb: 1 }}>Color</Typography>
            <Box display="flex" flexWrap="wrap" gap={0.75} mb={1.25}>
              {['#d32f2f','#f57c00','#f9a825','#388e3c','#1976d2','#7b1fa2','#546e7a','#000000','#ffffff','#795548'].map(c => (
                <Box key={c} onClick={() => { onColorChange(c); setLocalColor(c); setColorAnchor(null); }} sx={{
                  width: 22, height: 22, borderRadius: '50%', bgcolor: c, cursor: 'pointer', flexShrink: 0,
                  border: activeColor === c ? `2.5px solid ${isDark ? '#fff' : '#333'}` : `1.5px solid ${alpha(isDark ? '#fff' : '#000', 0.12)}`,
                  outline: activeColor === c ? `2px solid ${alpha(c, 0.6)}` : 'none',
                  transition: 'transform 0.1s', '&:hover': { transform: 'scale(1.18)' },
                }} />
              ))}
              <Box sx={{ position: 'relative', width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: `1.5px dashed ${alpha(theme.palette.text.secondary, 0.35)}`, cursor: 'pointer', flexShrink: 0 }}>
                <Box sx={{ width: '100%', height: '100%', background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} />
                <input type="color" value={localColor} onChange={e => { setLocalColor(e.target.value); onColorChange(e.target.value); }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
              </Box>
            </Box>
            <Box sx={{ height: 22, borderRadius: '8px', display: 'flex', alignItems: 'center', px: 1, bgcolor: alpha(theme.palette.text.primary, 0.04) }}>
              <svg width="100%" height="14" style={{ overflow: 'visible' }}>
                <line x1="4" y1="7" x2="calc(100% - 4px)" y2="7" stroke={activeColor}
                  strokeWidth={1.2 + (activeStrokeWidth / 50) * 4.8}
                  strokeDasharray={LINE_STYLES.find(s => s.key === activeLineStyle)?.dash.map(d => d / 2.5).join(',') || undefined}
                  strokeLinecap="round" />
              </svg>
            </Box>
          </Popover>

          {/* ── Width + Style — hidden on narrow ── */}
          {!isSM && (
          <>
          {/* Width */}
          <Tooltip title="Stroke Width">
            <Box sx={{ ...propBlockSx, gap: '3px' }} onClick={(e) => setWidthAnchor(e.currentTarget)}>
              <svg width="28" height="14" style={{ overflow: 'visible', flexShrink: 0 }}>
                <line x1="2" y1="7" x2="26" y2="7" stroke="currentColor"
                  strokeWidth={Math.max(1, Math.min(5, 1 + (activeStrokeWidth / 50) * 4))} strokeLinecap="round" />
              </svg>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'inherit' }}>{activeStrokeWidth}px</Typography>
            </Box>
          </Tooltip>
          <Popover open={Boolean(widthAnchor)} anchorEl={widthAnchor} onClose={() => setWidthAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            PaperProps={{ sx: { p: 1.5, borderRadius: '14px', border: 1, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', width: 220 } }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'text.disabled', mb: 1 }}>Stroke Width</Typography>
            <Box sx={{ px: 1, pt: 4, pb: 1, width: '100%', boxSizing: 'border-box' }}>
              <Slider
                value={activeStrokeWidth}
                onChange={(_, v) => onStrokeWidthChange(v as number)}
                min={1} max={50}
                valueLabelDisplay="on"
                valueLabelFormat={(v) => `${v}`}
                sx={{
                  color: gold,
                  '& .MuiSlider-thumb': {
                    width: 16, height: 16,
                    '&:hover, &.Mui-focusVisible': { boxShadow: `0px 0px 0px 8px ${alpha(gold, 0.16)}` },
                  },
                  '& .MuiSlider-valueLabel': {
                    fontSize: '0.65rem', fontWeight: 700, color: 'background.paper', bgcolor: 'text.primary', borderRadius: '4px', p: 0.25,
                  }
                }}
              />
            </Box>
            <Box sx={{ height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', px: 1, bgcolor: alpha(theme.palette.text.primary, 0.04) }}>
              <svg width="100%" height="28" style={{ overflow: 'visible' }}>
                <line x1="4" y1="14" x2="calc(100% - 4px)" y2="14" stroke={activeColor}
                  strokeWidth={Math.max(1, Math.min(activeStrokeWidth, 20))}
                  strokeDasharray={LINE_STYLES.find(s => s.key === activeLineStyle)?.dash.map(d => d / 2.5).join(',') || undefined}
                  strokeLinecap="round" />
              </svg>
            </Box>
          </Popover>

          {/* Style */}
          <Tooltip title="Line Style">
            <Box sx={propBlockSx} onClick={(e) => setStyleAnchor(e.currentTarget)}>
              <LinePreview style={activeLineStyle} width={activeStrokeWidth} previewWidth={52} />
            </Box>
          </Tooltip>
          <Popover open={Boolean(styleAnchor)} anchorEl={styleAnchor} onClose={() => setStyleAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            PaperProps={{ sx: { p: 1.5, borderRadius: '14px', border: 1, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', width: 284 } }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'text.disabled', mb: 1 }}>Line Style</Typography>
            <Box display="grid" gridTemplateColumns="1fr" gap={0.75}>
              {LINE_STYLES.map(({ key, label, dash }) => {
                const active = activeLineStyle === key;
                const dashAttr = dash.length > 0 ? dash.map(d => d / 2.5).join(',') : undefined;
                return (
                  <Box key={key} onClick={() => { onLineStyleChange(key); setStyleAnchor(null); }} sx={{
                    height: 32, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', px: 2,
                    bgcolor: active ? alpha(gold, 0.13) : alpha(theme.palette.text.primary, 0.04),
                    border: `1.5px solid ${active ? alpha(gold, 0.6) : 'transparent'}`,
                    transition: 'all 0.12s', '&:hover': { bgcolor: alpha(gold, 0.08) },
                  }}>
                    <svg width="100%" height="10" style={{ overflow: 'visible', flexShrink: 0 }}>
                      <line x1="0" y1="5" x2="100%" y2="5" stroke={active ? gold : (isDark ? '#aaa' : '#555')}
                        strokeWidth="1" strokeLinecap="round" strokeDasharray={dashAttr} />
                    </svg>
                  </Box>
                );
              })}
            </Box>
          </Popover>
          </>
          )}
        </Box>
      )}

      {/* RIGHT SIDE — auto push */}
      <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.75, pr: 0.5 }}>

        {/* Customize toolbar button */}
        <Tooltip title="Customize toolbar">
          <IconButton size="small" sx={{ ...btnSx, ...(customizeOpen ? { bgcolor: alpha(gold, 0.12), color: gold } : {}) }}
            onClick={(e) => { setCustomizeAnchor(e.currentTarget); setCustomizeOpen(true); }}>
            <TuneIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* More menu for collapsed items */}
        {(isXS || isSM || isMD) && (
          <IconButton size="small" sx={btnSx} onClick={(e) => setMoreMenuAnchor(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}

        {/* Undo / Redo — hidden when canMarkup=false */}
        {canMarkup && (
          <>
            <Tooltip title={`${t("undo", "Undo")} (Ctrl+Z)`}>
              <span>
                <IconButton size="small" sx={btnSx} onClick={onUndo} disabled={!canUndo}>
                  <UndoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={`${t("redo", "Redo")} (Ctrl+Y)`}>
              <span>
                <IconButton size="small" sx={btnSx} onClick={onRedo} disabled={!canRedo}>
                  <RedoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}

        {/* Download buttons — always shown on desktop */}
        {!isBottomBarVisible && (onDownloadClean || onExportPdf) && (
          <Divider orientation="vertical" flexItem sx={dividerSx} />
        )}
        {!isBottomBarVisible && onDownloadClean && (
          <Tooltip title={t("downloadClean", "Download (clean PDF)")}>
            <IconButton size="small" sx={btnSx} onClick={onDownloadClean}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {!isBottomBarVisible && onExportPdf && (
          <Tooltip title={isExporting ? t("exportingPdf", "Exporting…") : t("exportPdf", "Download with markups")}>
            <span>
              <IconButton size="small" sx={btnSx} onClick={onExportPdf} disabled={isExporting}>
                <LayersIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Compare button */}
        {!isBottomBarVisible && onCompare && (
          <Tooltip title={isCompareMode ? "Comparing..." : "Compare revisions"}>
            <IconButton size="small" sx={isCompareMode ? activeBtnSx : btnSx} onClick={onCompare}>
              <CompareArrowsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {!isBottomBarVisible && (
          <>
            <Divider orientation="vertical" flexItem sx={{ ...dividerSx, mx: 0.75 }} />

            {/* Scale */}
            <Box sx={propBlockSx}>
              <Select
                size="small"
                value={docScale}
                onChange={(e) => onDocScaleChange(e.target.value)}
                IconComponent={() => null}
                sx={{ ...inlineSelectSx, minWidth: 44, fontWeight: 700 }}
                MenuProps={styledMenuProps}
              >
                {STANDARD_SCALES.map((group, idx) =>
                  group.items
                    ? [
                      <ListSubheader key={`h-${idx}`} sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", color: gold, bgcolor: "background.paper" }}>
                        {group.group}
                      </ListSubheader>,
                      ...group.items.map((item) => (
                        <MenuItem key={item.value} value={item.value} sx={{ fontSize: "0.75rem" }}>
                          {item.label}
                        </MenuItem>
                      ))
                    ]
                    : <MenuItem key={group.value} value={group.value} sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                      {group.label}
                    </MenuItem>
                )}
              </Select>
            </Box>

            {/* Version */}
            {versions.length > 0 && (
              <>
                <Divider orientation="vertical" flexItem sx={{ ...dividerSx, mx: 0.5 }} />
                <Box sx={propBlockSx}>
                  <Select
                    size="small"
                    value={currentDocId}
                    onChange={(e) => onVersionChange?.(e.target.value)}
                    IconComponent={() => null}
                    sx={{ ...inlineSelectSx, minWidth: 100, fontWeight: 700 }}
                    MenuProps={styledMenuProps}
                  >
                    {versions.map((v: any, idx: number) => (
                      <MenuItem key={v.id} value={v.id} sx={{ fontSize: "0.72rem" }}>
                        V{versions.length - idx} — {dayjs(v.createdAt).format("MM/DD/YY")}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </>
            )}
          </>
        )}
      </Box>

      {/* More Menu (collapsed tools at narrow widths) */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={() => setMoreMenuAnchor(null)}
        PaperProps={{ sx: { ...menuPaperSx, width: 240, maxHeight: "80vh" } }}
      >
        {/* Scroll mode in more menu when hidden */}
        {isSM && <Divider />}
        {isSM && (
          <MenuItem onClick={() => { onScrollModeChange("page"); setMoreMenuAnchor(null); }} selected={scrollMode === "page"}>
            <ListItemIcon><ArticleIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Single Page" />
          </MenuItem>
        )}
        {isSM && (
          <MenuItem onClick={() => { onScrollModeChange("continuous"); setMoreMenuAnchor(null); }} selected={scrollMode === "continuous"}>
            <ListItemIcon><ViewDayIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Continuous Scroll" />
          </MenuItem>
        )}
        {isSM && <Divider />}

        <ListSubheader sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, color: gold, bgcolor: "background.paper" }}>TOOLS</ListSubheader>
        {isXS && (
          <MenuItem onClick={() => { onToolChange("pan"); setMoreMenuAnchor(null); }} selected={tool === "pan"}>
            <ListItemIcon><PanToolIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Pan" />
          </MenuItem>
        )}
        {canMarkup && isSM && (
          <MenuItem onClick={() => { onToolChange("line"); setMoreMenuAnchor(null); }} selected={tool === "line"}>
            <ListItemIcon><TimelineIcon fontSize="small" /></ListItemIcon><ListItemText primary="Line" />
          </MenuItem>
        )}
        {canMarkup && isSM && (
          <MenuItem onClick={() => { onToolChange("arrow"); setMoreMenuAnchor(null); }} selected={tool === "arrow"}>
            <ListItemIcon><EastIcon fontSize="small" /></ListItemIcon><ListItemText primary="Arrow" />
          </MenuItem>
        )}
        {canMarkup && isSM && SHAPE_TOOLS.map(s => (
          <MenuItem key={s.key} onClick={() => { onToolChange(s.key); setMoreMenuAnchor(null); }} selected={tool === s.key}>
            <ListItemIcon>{s.icon}</ListItemIcon><ListItemText primary={s.label} />
          </MenuItem>
        ))}
        {canMarkup && isMD && (
          <MenuItem onClick={() => { onToolChange("cloud"); setMoreMenuAnchor(null); }} selected={tool === "cloud"}>
            <ListItemIcon><CloudQueueIcon fontSize="small" /></ListItemIcon><ListItemText primary="Cloud" />
          </MenuItem>
        )}
        {canMarkup && isMD && (
          <MenuItem onClick={() => { onToolChange("text"); setMoreMenuAnchor(null); }} selected={tool === "text"}>
            <ListItemIcon><TextFormatIcon fontSize="small" /></ListItemIcon><ListItemText primary="Text" />
          </MenuItem>
        )}
        {canMarkup && isMD && (
          <MenuItem onClick={() => { onToolChange("callout"); setMoreMenuAnchor(null); }} selected={tool === "callout"}>
            <ListItemIcon>
              <Box sx={{ position: 'relative', display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                <CloudQueueIcon sx={{ fontSize: 18 }} />
                <Box sx={{ position: 'absolute', bottom: 1, right: -1, fontSize: 10, fontWeight: 900, lineHeight: 1 }}>+</Box>
              </Box>
            </ListItemIcon><ListItemText primary="Cloud+" />
          </MenuItem>
        )}
        {canMarkup && isMD && (
          <MenuItem onClick={() => { onToolChange("measure"); setMoreMenuAnchor(null); }} selected={tool === "measure"}>
            <ListItemIcon><StraightenIcon fontSize="small" /></ListItemIcon><ListItemText primary="Measure" />
          </MenuItem>
        )}

        {/* Review Stamps in More Menu */}
        {canMarkup && onAddReviewStamp && (isMD || !isToolVisible('stamps')) && (
          <>
            <Divider />
            <ListSubheader sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, color: gold, bgcolor: "background.paper" }}>REVIEW STAMPS</ListSubheader>
            {REVIEW_STAMPS.map(s => (
              <MenuItem key={s.id} onClick={() => { onAddReviewStamp(s); setMoreMenuAnchor(null); }}>
                <ListItemIcon><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} /></ListItemIcon>
                <ListItemText primary={s.label} secondary={s.category} secondaryTypographyProps={{ sx: { fontSize: '0.65rem' } }} />
              </MenuItem>
            ))}
          </>
        )}

        {canMarkup && isSM && (
          <>
            <Divider />
            <ListSubheader sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, color: gold, bgcolor: "background.paper" }}>PROPERTIES</ListSubheader>
            <Box p={1.5} pt={2.5}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', display: 'block', mb: 1, textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: '0.07em' }}>Width</Typography>
              <Box sx={{ px: 1, pb: 2, width: '100%', boxSizing: 'border-box' }}>
                <Slider
                  value={activeStrokeWidth}
                  onChange={(_, v) => onStrokeWidthChange(v as number)}
                  min={1} max={50}
                  valueLabelDisplay="on"
                  valueLabelFormat={(v) => `${v}`}
                  sx={{
                    color: gold,
                    '& .MuiSlider-thumb': { width: 16, height: 16 },
                    '& .MuiSlider-valueLabel': { fontSize: '0.65rem', fontWeight: 700, color: 'background.paper', bgcolor: 'text.primary', borderRadius: '4px', p: 0.25 }
                  }}
                />
              </Box>
              <Box sx={{ height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', px: 1, bgcolor: alpha(theme.palette.text.primary, 0.04) }}>
                <svg width="100%" height="28" style={{ overflow: 'visible' }}>
                  <line x1="4" y1="14" x2="calc(100% - 4px)" y2="14" stroke={activeColor}
                    strokeWidth={Math.max(1, Math.min(activeStrokeWidth, 20))}
                    strokeDasharray={LINE_STYLES.find(s => s.key === activeLineStyle)?.dash.map(d => d / 2.5).join(',') || undefined}
                    strokeLinecap="round" />
                </svg>
              </Box>
            </Box>
            <Box px={1.5} pb={1}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.disabled', display: 'block', mb: 0.75, textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: '0.07em' }}>Line Style</Typography>
              <Box display="grid" gridTemplateColumns="1fr" gap={0.5}>
                {LINE_STYLES.map(({ key, label, dash }) => {
                  const active = activeLineStyle === key;
                  const dashAttr = dash.length > 0 ? dash.map(d => d / 2.5).join(',') : undefined;
                  return (
                    <Box key={key} onClick={() => onLineStyleChange(key)} sx={{
                      height: 32, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', px: 2,
                      bgcolor: active ? alpha(gold, 0.13) : alpha(theme.palette.text.primary, 0.04),
                      border: `1.5px solid ${active ? alpha(gold, 0.6) : 'transparent'}`,
                    }}>
                      <svg width="100%" height="10" style={{ overflow: 'visible', flexShrink: 0 }}>
                        <line x1="0" y1="5" x2="100%" y2="5" stroke={active ? gold : (isDark ? '#aaa' : '#555')}
                          strokeWidth="1" strokeLinecap="round" strokeDasharray={dashAttr} />
                      </svg>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </>
        )}

        {isBottomBarVisible && (onDownloadClean || onExportPdf || (versions && versions.length > 0)) && <Divider />}
        {isBottomBarVisible && (onDownloadClean || onExportPdf || (versions && versions.length > 0)) && (
          <ListSubheader sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, color: gold, bgcolor: "background.paper" }}>FILE</ListSubheader>
        )}
        {isBottomBarVisible && onDownloadClean && (
          <MenuItem onClick={() => { onDownloadClean(); setMoreMenuAnchor(null); }}>
            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Download PDF" />
          </MenuItem>
        )}
        {isBottomBarVisible && onExportPdf && (
          <MenuItem onClick={() => { if (!isExporting) { onExportPdf(); setMoreMenuAnchor(null); } }} disabled={isExporting}>
            <ListItemIcon><LayersIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Export with markups" />
          </MenuItem>
        )}
        {isBottomBarVisible && versions && versions.length > 0 && <Divider />}
        {isBottomBarVisible && versions && versions.length > 0 && (
          <ListSubheader sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, color: gold, bgcolor: "background.paper" }}>VERSION</ListSubheader>
        )}
        {isBottomBarVisible && versions && versions.length > 0 && versions.map((ver: any, idx: number) => (
          <MenuItem key={ver.id} selected={currentDocId === ver.id} onClick={() => { onVersionChange?.(ver.id); setMoreMenuAnchor(null); }}>
            <ListItemText primary={`V${versions.length - idx} — ${new Date(ver.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`} />
          </MenuItem>
        ))}
      </Menu>

      {/* Shape picker menu */}
      <Menu
        anchorEl={shapeMenuAnchor}
        open={Boolean(shapeMenuAnchor)}
        onClose={() => setShapeMenuAnchor(null)}
        PaperProps={{ sx: menuPaperSx }}
      >
        {SHAPE_TOOLS.map((s) => (
          <MenuItem
            key={s.key}
            selected={tool === s.key}
            onClick={() => { onToolChange(s.key); setShapeMenuAnchor(null); }}
          >
            <ListItemIcon>{s.icon}</ListItemIcon>
            <ListItemText primary={s.label} />
          </MenuItem>
        ))}
      </Menu>

      {/* Toolbar customization popover */}
      <Popover
        open={customizeOpen}
        anchorEl={customizeAnchor}
        onClose={() => setCustomizeOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 0.5, p: 2, minWidth: 240, borderRadius: '12px',
            border: 1, borderColor: 'divider',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            bgcolor: 'background.paper',
          }
        }}
      >
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', mb: 1.5 }}>
          Customize Toolbar
        </Typography>
        {[
          { id: 'pan',         label: 'Pan',         icon: <PanToolIcon sx={{ fontSize: 16 }} /> },
          { id: 'textSelect',  label: 'Text Select',  icon: <AbcIcon sx={{ fontSize: 16 }} /> },
          { id: 'pen',         label: 'Pen',         icon: <CreateIcon sx={{ fontSize: 16 }} /> },
          { id: 'highlighter', label: 'Highlighter', icon: <HighlightIcon sx={{ fontSize: 16 }} /> },
          { id: 'line',        label: 'Line',        icon: <TimelineIcon sx={{ fontSize: 16 }} /> },
          { id: 'arrow',       label: 'Arrow',       icon: <EastIcon sx={{ fontSize: 16 }} /> },
          { id: 'shapes',      label: 'Shapes',      icon: <RectangleIcon sx={{ fontSize: 16 }} /> },
          { id: 'cloud',       label: 'Cloud',       icon: <CloudQueueIcon sx={{ fontSize: 16 }} /> },
          { id: 'text',        label: 'Text',        icon: <TextFormatIcon sx={{ fontSize: 16 }} /> },
          { id: 'callout',     label: 'Callout',     icon: <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} /> },
          { id: 'measure',     label: 'Measure',     icon: <StraightenIcon sx={{ fontSize: 16 }} /> },
          { id: 'polyline',    label: 'Polyline',    icon: <PolylineIcon sx={{ fontSize: 16 }} /> },
          { id: 'routeTemplate', label: 'Route Template', icon: <RouteIcon sx={{ fontSize: 16 }} /> },
          { id: 'image',       label: 'Image',       icon: <ImageOutlinedIcon sx={{ fontSize: 16 }} /> },
          { id: 'stamps',      label: 'Review Stamps', icon: <PlaylistAddCheckIcon sx={{ fontSize: 16 }} /> },
        ].map(item => {
          const visible = isToolVisible(item.id);
          return (
            <Box key={item.id} display="flex" alignItems="center" justifyContent="space-between" py={0.35} sx={{ opacity: visible ? 1 : 0.5 }}>
              <Box display="flex" alignItems="center" gap={1}>
                <Box sx={{ color: visible ? gold : 'text.disabled', display: 'flex', width: 20 }}>{item.icon}</Box>
                <Typography sx={{ fontSize: '0.8rem' }}>{item.label}</Typography>
              </Box>
              <Box onClick={() => toggleToolVisibility(item.id)} sx={{ width: 36, height: 20, borderRadius: '10px', bgcolor: visible ? gold : alpha(theme.palette.text.secondary, 0.2), cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}>
                <Box sx={{ position: 'absolute', top: '2px', left: visible ? '18px' : '2px', width: 16, height: 16, borderRadius: '50%', bgcolor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)' }} />
              </Box>
            </Box>
          );
        })}
        <Divider sx={{ my: 1 }} />
        <Typography
          onClick={() => { setHiddenTools([]); localStorage.removeItem('pdfToolbarHidden'); }}
          sx={{ fontSize: '0.72rem', color: gold, cursor: 'pointer', textAlign: 'center', fontWeight: 600, '&:hover': { opacity: 0.8 } }}
        >
          Reset to defaults
        </Typography>
      </Popover>

      {/* Review Stamps Popover (desktop icon click) */}
      <Popover open={Boolean(stampMenuAnchor)} anchorEl={stampMenuAnchor} onClose={() => setStampMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{ sx: { p: 1.5, borderRadius: '12px', border: 1, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', width: 240, maxHeight: 400 } }}>
        {['Status', 'Issues', 'Notes'].map(cat => {
          const stamps = REVIEW_STAMPS.filter(s => s.category === cat);
          if (stamps.length === 0) return null;
          return (
            <Box key={cat} sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.disabled', mb: 0.5, px: 0.5 }}>{cat}</Typography>
              {stamps.map(s => (
                <Box key={s.id} onClick={() => { onAddReviewStamp?.(s); setStampMenuAnchor(null); }}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: '6px', cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(s.color, 0.12) }, transition: 'background 0.1s' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.82rem', flex: 1 }}>{s.label}</Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>{s.type}</Typography>
                </Box>
              ))}
            </Box>
          );
        })}
      </Popover>
    </Toolbar>
      {/* Compare sub-bar rendered in DocumentViewPage via absolute positioning */}
    </>
  );
});

export default PdfToolbar;
