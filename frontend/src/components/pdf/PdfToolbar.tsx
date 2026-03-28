import { memo, useState, useEffect } from "react";
import {
  Box, IconButton, Tooltip, Toolbar, Typography, useTheme, alpha, Select, MenuItem, ListSubheader, Menu, ListItemIcon, ListItemText, InputBase, useMediaQuery, Slider, Popover, CircularProgress
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
import LayersIcon from "@mui/icons-material/Layers";
import TimelineIcon from "@mui/icons-material/Timeline";
import EastIcon from "@mui/icons-material/East";
import ArticleIcon from "@mui/icons-material/Article";
import ViewDayIcon from "@mui/icons-material/ViewDay";
import VerticalSplitIcon from "@mui/icons-material/VerticalSplit";
import AbcIcon from "@mui/icons-material/Abc";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
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
  | "polyline";

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
  const visualStrokeWidth = 1.2 + (width / 50) * 4.8;
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
}

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
}: PdfToolbarProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const gold = theme.palette.primary.main;

  // Breakpoints: progressive collapse
  const isXS = useMediaQuery("(max-width:650px)");
  const isSM = useMediaQuery("(max-width:1150px)");
  const isMD = useMediaQuery("(max-width:1400px)");
  // Bottom bar visible at ≤1050px — hide scale/version from toolbar to avoid duplication
  const isBottomBarVisible = useMediaQuery("(max-width:1050px)");

  const [pageInput, setPageInput] = useState(currentPage.toString());
  const [localColor, setLocalColor] = useState(activeColor);
  useEffect(() => { setLocalColor(activeColor); }, [activeColor]);
  const [shapeMenuAnchor, setShapeMenuAnchor] = useState<null | HTMLElement>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [widthAnchor, setWidthAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => { setPageInput(currentPage.toString()); }, [currentPage]);

  const handlePageSubmit = () => {
    const val = parseInt(pageInput);
    if (!isNaN(val) && val >= 1 && val <= numPages) onPageChange(val);
    else setPageInput(currentPage.toString());
  };

  // Unified button styles — same as Pen/tool buttons
  const btnSx = {
    borderRadius: "6px", p: "6px", color: "text.secondary", transition: "all 0.2s",
    "&:hover": { bgcolor: alpha(gold, 0.08), color: gold },
    "&.Mui-disabled": { opacity: 0.3 }
  };
  const activeBtnSx = {
    ...btnSx,
    bgcolor: alpha(gold, 0.12), color: gold, fontWeight: 700,
    "&:hover": { bgcolor: alpha(gold, 0.18) }
  };
  const dividerSx = { mx: 0.5, height: 24, alignSelf: "center", borderColor: alpha(theme.palette.divider, 0.6) };

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
    <Toolbar variant="dense" sx={{
      minHeight: 44, gap: 0.5, px: "8px !important",
      borderBottom: 1, borderColor: "divider", bgcolor: "background.paper",
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
          <Box display="flex" alignItems="center">
            <IconButton size="small" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} sx={btnSx}>
              <KeyboardArrowLeftIcon fontSize="small" />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.5 }}>
              <InputBase
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handlePageSubmit(); }}
                onBlur={handlePageSubmit}
                sx={{ width: 35, fontSize: "0.75rem", fontWeight: 600, textAlign: "center", bgcolor: isDark ? alpha(gold, 0.1) : alpha(gold, 0.05), borderRadius: "4px", "& input": { textAlign: "center", p: "2px 0" } }}
              />
              <Box component="span" sx={{ fontSize: "0.75rem", opacity: 0.6 }}>/</Box>
              <Typography variant="caption" sx={{ opacity: 0.6, fontSize: "0.75rem" }}>{numPages}</Typography>
            </Box>
            <IconButton size="small" onClick={() => onPageChange(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages} sx={btnSx}>
              <KeyboardArrowRightIcon fontSize="small" />
            </IconButton>
            {pageMarkupCount > 0 && (
              <Box sx={{ px: 0.75, py: 0.15, borderRadius: '10px', bgcolor: alpha(gold, 0.15), color: gold, fontSize: '0.62rem', fontWeight: 700, lineHeight: 1.4, minWidth: 18, textAlign: 'center' }}>
                {pageMarkupCount}
              </Box>
            )}
          </Box>
          <Divider orientation="vertical" flexItem sx={dividerSx} />

          {/* Scroll Mode */}
          <Box display="flex" gap={0.5}>
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
            <Tooltip title={t("splitView", "Split View")}>
              <IconButton size="small" onClick={() => onScrollModeChange("split")} sx={scrollMode === "split" ? activeBtnSx : btnSx}>
                <VerticalSplitIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Divider orientation="vertical" flexItem sx={dividerSx} />

          {/* Zoom */}
          <Box display="flex" alignItems="center">
            <IconButton size="small" onClick={onZoomOut} sx={btnSx}><ZoomOutIcon fontSize="small" /></IconButton>
            <Typography variant="caption" sx={{ minWidth: 35, textAlign: "center", fontWeight: 700, fontSize: "0.7rem" }}>
              {Math.round(zoom * 100)}%
            </Typography>
            <IconButton size="small" onClick={onZoomIn} sx={btnSx}><ZoomInIcon fontSize="small" /></IconButton>
          </Box>
          <Divider orientation="vertical" flexItem sx={dividerSx} />
        </>
      )}

      {/* Core Drawing Tools */}
      <Box display="flex" gap={0.5}>
        <Tooltip title="Select (V)">
          <IconButton size="small" sx={tool === "select" ? activeBtnSx : btnSx} onClick={() => onToolChange("select")}>
            <AdsClickIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {!isXS && (
          <Tooltip title="Pan (Space)">
            <IconButton size="small" sx={tool === "pan" ? activeBtnSx : btnSx} onClick={() => onToolChange("pan")}>
              <PanToolIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Select Text">
          <IconButton size="small" sx={tool === "textSelect" ? activeBtnSx : btnSx} onClick={() => onToolChange("textSelect")}>
            <AbcIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {canMarkup && (
          <>
            <Tooltip title="Pen (P)">
              <IconButton size="small" sx={tool === "pen" ? activeBtnSx : btnSx} onClick={() => onToolChange("pen")}>
                <CreateIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Highlighter (H)">
              <IconButton size="small" sx={tool === "highlighter" ? activeBtnSx : btnSx} onClick={() => onToolChange("highlighter")}>
                <HighlightIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {!isSM && (
              <>
                <Tooltip title="Line (L)">
                  <IconButton size="small" sx={tool === "line" ? activeBtnSx : btnSx} onClick={() => onToolChange("line")}>
                    <TimelineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Arrow (A)">
                  <IconButton size="small" sx={tool === "arrow" ? activeBtnSx : btnSx} onClick={() => onToolChange("arrow")}>
                    <EastIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Shapes">
                  <Box
                    display="flex"
                    sx={SHAPE_TOOLS.some((s) => s.key === tool) ? activeBtnSx : propBlockSx}
                    onClick={(e) => setShapeMenuAnchor(e.currentTarget)}
                  >
                    {SHAPE_TOOLS.find((s) => s.key === tool)?.icon || <RectangleIcon fontSize="small" />}
                  </Box>
                </Tooltip>
              </>
            )}

            {!isMD && (
              <>
                <Tooltip title="Cloud (C)">
                  <IconButton size="small" sx={tool === "cloud" ? activeBtnSx : btnSx} onClick={() => onToolChange("cloud")}>
                    <CloudQueueIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Text (T)">
                  <IconButton size="small" sx={tool === "text" ? activeBtnSx : btnSx} onClick={() => onToolChange("text")}>
                    <TextFormatIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cloud+ (O)">
                  <IconButton size="small" sx={tool === "callout" ? activeBtnSx : btnSx} onClick={() => onToolChange("callout")}>
                    <Box sx={{ position: 'relative', display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                      <CloudQueueIcon sx={{ fontSize: 18 }} />
                      <Box sx={{ position: 'absolute', bottom: 1, right: -1, fontSize: 10, fontWeight: 900, lineHeight: 1, color: 'inherit' }}>+</Box>
                    </Box>
                  </IconButton>
                </Tooltip>
                <Tooltip title="Measure (M)">
                  <IconButton size="small" sx={tool === "measure" ? activeBtnSx : btnSx} onClick={() => onToolChange("measure")}>
                    <StraightenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Polyline (K) — click points, dblclick to finish">
                  <IconButton size="small" sx={tool === "polyline" ? activeBtnSx : btnSx} onClick={() => onToolChange("polyline")}>
                    <PolylineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </>
        )}
      </Box>

      <Divider orientation="vertical" flexItem sx={dividerSx} />

      {/* Color circle — hidden when canMarkup=false */}
      {canMarkup && (
        <Box sx={{ position: "relative", width: 22, height: 22, mx: 0.5, flexShrink: 0 }}>
          <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: localColor, border: "2px solid", borderColor: "divider" }} />
          <input
            type="color"
            value={localColor}
            onChange={(e) => setLocalColor(e.target.value)}
            onBlur={(e) => onColorChange(e.target.value)}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
          />
        </Box>
      )}

      {/* Width interactive range — hidden on narrow or when canMarkup=false */}
      {canMarkup && !isSM && (
        <>
          <Tooltip title="Stroke Width">
            <Box sx={propBlockSx} onClick={(e) => setWidthAnchor(e.currentTarget)}>
              {/* Mini line preview showing current width */}
              <Box sx={{ width: 28, height: 20, display: "flex", alignItems: "center" }}>
                <svg width="28" height="20" style={{ overflow: "visible" }}>
                  <line x1="0" y1="10" x2="28" y2="10"
                    stroke="currentColor"
                    strokeWidth={Math.max(1, Math.min(5, 1 + (activeStrokeWidth / 50) * 4))}
                    strokeLinecap="round"
                  />
                </svg>
              </Box>
            </Box>
          </Tooltip>
          <Popover
            open={Boolean(widthAnchor)}
            anchorEl={widthAnchor}
            onClose={() => setWidthAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            transformOrigin={{ vertical: "top", horizontal: "center" }}
            PaperProps={{
              sx: {
                p: 2, width: 180, borderRadius: "10px",
                border: 1, borderColor: "divider",
                bgcolor: "background.paper",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
              }
            }}
          >
            <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.8, mb: 1.5 }}>
              Width: {activeStrokeWidth}px
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Slider
                size="small"
                value={activeStrokeWidth}
                min={1}
                max={50}
                onChange={(_, v) => onStrokeWidthChange(v as number)}
                sx={{
                  color: gold,
                  "& .MuiSlider-thumb": { width: 12, height: 12 }
                }}
              />
              <Typography variant="body2" fontWeight={700} sx={{ minWidth: 28, fontSize: "0.75rem", color: gold }}>
                {activeStrokeWidth}
              </Typography>
            </Box>
            {/* Live line preview */}
            <Box sx={{ mt: 1.5, height: 24, display: "flex", alignItems: "center", bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", borderRadius: "6px", px: 1 }}>
              <svg width="100%" height="24" style={{ overflow: "visible" }}>
                <line
                  x1="4" y1="12" x2="calc(100% - 4px)" y2="12"
                  stroke={activeColor}
                  strokeWidth={1.2 + (activeStrokeWidth / 50) * 4.8}
                  strokeDasharray={LINE_STYLES.find(s => s.key === activeLineStyle)?.dash.map(d => d / 2.5).join(",") || "none"}
                  strokeLinecap="round"
                />
              </svg>
            </Box>
          </Popover>

          {/* Line style dropdown — visual */}
          <Box sx={propBlockSx}>
            <Select
              size="small"
              value={activeLineStyle}
              onChange={(e) => onLineStyleChange(e.target.value as LineStyle)}
              IconComponent={() => null}
              sx={inlineSelectSx}
              renderValue={(val) => <LinePreview style={val as LineStyle} width={2} previewWidth={56} />}
              MenuProps={styledMenuProps}
            >
              {LINE_STYLES.map((s) => (
                <MenuItem key={s.key} value={s.key} sx={{ px: 1.5 }}>
                  <LinePreview style={s.key} width={2} previewWidth={130} />
                </MenuItem>
              ))}
            </Select>
          </Box>
        </>
      )}

      {/* RIGHT SIDE — auto push */}
      <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5, pr: 1 }}>

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

        {/* Download buttons */}
        {(onDownloadClean || onExportPdf) && (
          <Divider orientation="vertical" flexItem sx={dividerSx} />
        )}
        {onDownloadClean && (
          <Tooltip title={t("downloadClean", "Download (clean PDF)")}>
            <IconButton size="small" sx={btnSx} onClick={onDownloadClean}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {onExportPdf && (
          <Tooltip title={isExporting ? t("exportingPdf", "Exporting…") : t("exportPdf", "Download with markups")}>
            <span>
              <IconButton size="small" sx={btnSx} onClick={onExportPdf} disabled={isExporting}>
                <LayersIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Bluebeam import — shown when PDF has embedded annotations not yet imported */}
        {embeddedAnnotCount > 0 && onImportAnnotations && (
          <>
            <Divider orientation="vertical" flexItem sx={dividerSx} />
            <Tooltip title={isImporting
              ? t("importingAnnots", "Importing…")
              : t("importAnnots", `Import ${embeddedAnnotCount} annotation${embeddedAnnotCount !== 1 ? 's' : ''} from PDF (Bluebeam)`)}>
              <span>
                <IconButton
                  size="small"
                  onClick={onImportAnnotations}
                  disabled={isImporting}
                  sx={{
                    ...btnSx,
                    color: 'warning.main',
                    border: '1px solid',
                    borderColor: 'warning.main',
                    borderRadius: 1,
                    px: 0.75,
                    gap: 0.5,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {isImporting
                    ? <CircularProgress size={14} color="inherit" />
                    : <SystemUpdateAltIcon fontSize="small" />}
                  <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                    {embeddedAnnotCount}
                  </Box>
                </IconButton>
              </span>
            </Tooltip>
          </>
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
        {isSM && (
          <>
            <ListSubheader sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, color: gold, bgcolor: "background.paper" }}>VIEW</ListSubheader>
            <MenuItem onClick={() => { onScrollModeChange("page"); setMoreMenuAnchor(null); }} selected={scrollMode === "page"}>
              <ListItemIcon><ArticleIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Single Page" />
            </MenuItem>
            <MenuItem onClick={() => { onScrollModeChange("continuous"); setMoreMenuAnchor(null); }} selected={scrollMode === "continuous"}>
              <ListItemIcon><ViewDayIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Continuous Scroll" />
            </MenuItem>
            <MenuItem onClick={() => { onScrollModeChange("split"); setMoreMenuAnchor(null); }} selected={scrollMode === "split"}>
              <ListItemIcon><VerticalSplitIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Split View" />
            </MenuItem>
            <Divider />
          </>
        )}

        <ListSubheader sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, color: gold, bgcolor: "background.paper" }}>TOOLS</ListSubheader>
        {isXS && (
          <MenuItem onClick={() => { onToolChange("pan"); setMoreMenuAnchor(null); }} selected={tool === "pan"}>
            <ListItemIcon><PanToolIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Pan" />
          </MenuItem>
        )}
        {canMarkup && isSM && (
          <>
            <MenuItem onClick={() => { onToolChange("line"); setMoreMenuAnchor(null); }} selected={tool === "line"}>
              <ListItemIcon><TimelineIcon fontSize="small" /></ListItemIcon><ListItemText primary="Line" />
            </MenuItem>
            <MenuItem onClick={() => { onToolChange("arrow"); setMoreMenuAnchor(null); }} selected={tool === "arrow"}>
              <ListItemIcon><EastIcon fontSize="small" /></ListItemIcon><ListItemText primary="Arrow" />
            </MenuItem>
            {SHAPE_TOOLS.map(s => (
              <MenuItem key={s.key} onClick={() => { onToolChange(s.key); setMoreMenuAnchor(null); }} selected={tool === s.key}>
                <ListItemIcon>{s.icon}</ListItemIcon><ListItemText primary={s.label} />
              </MenuItem>
            ))}
          </>
        )}
        {canMarkup && isMD && (
          <>
            <MenuItem onClick={() => { onToolChange("cloud"); setMoreMenuAnchor(null); }} selected={tool === "cloud"}>
              <ListItemIcon><CloudQueueIcon fontSize="small" /></ListItemIcon><ListItemText primary="Cloud" />
            </MenuItem>
            <MenuItem onClick={() => { onToolChange("text"); setMoreMenuAnchor(null); }} selected={tool === "text"}>
              <ListItemIcon><TextFormatIcon fontSize="small" /></ListItemIcon><ListItemText primary="Text" />
            </MenuItem>
            <MenuItem onClick={() => { onToolChange("callout"); setMoreMenuAnchor(null); }} selected={tool === "callout"}>
              <ListItemIcon>
                <Box sx={{ position: 'relative', display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <CloudQueueIcon sx={{ fontSize: 18 }} />
                  <Box sx={{ position: 'absolute', bottom: 1, right: -1, fontSize: 10, fontWeight: 900, lineHeight: 1 }}>+</Box>
                </Box>
              </ListItemIcon><ListItemText primary="Cloud+" />
            </MenuItem>
            <MenuItem onClick={() => { onToolChange("measure"); setMoreMenuAnchor(null); }} selected={tool === "measure"}>
              <ListItemIcon><StraightenIcon fontSize="small" /></ListItemIcon><ListItemText primary="Measure" />
            </MenuItem>
          </>
        )}

        {canMarkup && isSM && (
          <>
            <Divider />
            <ListSubheader sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, color: gold, bgcolor: "background.paper" }}>PROPERTIES</ListSubheader>
            <Box p={1.5}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: gold, display: "block", mb: 1 }}>
                WIDTH: {activeStrokeWidth}px
              </Typography>
              <Slider
                size="small"
                value={activeStrokeWidth}
                min={1} max={50}
                onChange={(_, v) => onStrokeWidthChange(v as number)}
                sx={{ color: gold, mx: 0, width: "100%" }}
              />
              <Box sx={{ mt: 1.5, height: 20, display: "flex", alignItems: "center" }}>
                <svg width="100%" height="20">
                  <line x1="0" y1="10" x2="100%" y2="10"
                    stroke={activeColor}
                    strokeWidth={1.2 + (activeStrokeWidth / 50) * 4.8}
                    strokeLinecap="round"
                  />
                </svg>
              </Box>
            </Box>
            <Box px={1.5} pb={1}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.5 }}>LINE STYLE</Typography>
              <Select
                size="small"
                fullWidth
                value={activeLineStyle}
                onChange={(e) => onLineStyleChange(e.target.value as LineStyle)}
                renderValue={(val) => <LinePreview style={val as LineStyle} width={2} previewWidth={130} />}
                MenuProps={styledMenuProps}
                sx={{ bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" }}
              >
                {LINE_STYLES.map(s => (
                  <MenuItem key={s.key} value={s.key} sx={{ px: 1.5 }}>
                    <LinePreview style={s.key} width={2} previewWidth={160} />
                  </MenuItem>
                ))}
              </Select>
            </Box>
          </>
        )}
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
    </Toolbar>
  );
});

export default PdfToolbar;
