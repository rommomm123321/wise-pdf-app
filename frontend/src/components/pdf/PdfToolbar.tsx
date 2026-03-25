import { memo, useState, useEffect } from "react";
import {
  Box, IconButton, Tooltip, Toolbar, Typography, useTheme, alpha, Select, MenuItem, ListSubheader, Menu, ListItemIcon, ListItemText, InputBase, useMediaQuery, Slider, Popover
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
import HistoryIcon from "@mui/icons-material/History";
import LineWeightIcon from "@mui/icons-material/LineWeight";
import PaletteIcon from "@mui/icons-material/Palette";
import TimelineIcon from "@mui/icons-material/Timeline";
import EastIcon from "@mui/icons-material/East";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";

export type DrawTool =
  | "select"
  | "pan"
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
  | "measure";

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
  scrollMode: "page" | "continuous"; onScrollModeChange: (m: "page" | "continuous") => void;
  canUndo?: boolean; canRedo?: boolean; onUndo?: () => void; onRedo?: () => void;
  versions?: any[]; currentDocId?: string; onVersionChange?: (docId: string) => void;
  sidebarOpen: boolean; onToggleSidebar: () => void;
}

const PdfToolbar = memo(function PdfToolbar({
  tool, onToolChange,
  activeColor, onColorChange, activeStrokeWidth, onStrokeWidthChange,
  activeLineStyle, onLineStyleChange,
  docScale, onDocScaleChange,
  zoom, onZoomIn, onZoomOut,
  currentPage, numPages, onPageChange,
  canUndo, canRedo, onUndo, onRedo,
  versions = [], currentDocId, onVersionChange,
  sidebarOpen, onToggleSidebar,
}: PdfToolbarProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const gold = theme.palette.primary.main;

  // STRICT BREAKPOINTS FOR 1500px GAP
  const isXS = useMediaQuery("(max-width:650px)"); 
  const isSM = useMediaQuery("(max-width:1150px)"); // Trigger bottom bar for meta earlier
  const isMD = useMediaQuery("(max-width:1400px)"); // Hide complex tools earlier

  const [pageInput, setPageInput] = useState(currentPage.toString());
  const [shapeMenuAnchor, setShapeMenuAnchor] = useState<null | HTMLElement>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [widthAnchor, setWidthAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => { setPageInput(currentPage.toString()); }, [currentPage]);

  const handlePageSubmit = () => {
    const val = parseInt(pageInput);
    if (!isNaN(val) && val >= 1 && val <= numPages) onPageChange(val);
    else setPageInput(currentPage.toString());
  };

  const btnSx = { borderRadius: "6px", p: "6px", color: "text.secondary", transition: "all 0.2s", "&:hover": { bgcolor: alpha(gold, 0.08), color: gold }, "&.Mui-disabled": { opacity: 0.3 } };
  const activeBtnSx = { ...btnSx, bgcolor: alpha(gold, 0.12), color: gold, fontWeight: 700, "&:hover": { bgcolor: alpha(gold, 0.18) } };
  const dividerSx = { mx: 0.5, height: 24, alignSelf: "center", borderColor: alpha(theme.palette.divider, 0.6) };
  const propertyBlockSx = { display: "flex", alignItems: "center", justifyContent: "center", px: "4px", py: "4px", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s", color: "text.secondary", height: 32, minWidth: 32, "&:hover": { bgcolor: alpha(gold, 0.08), color: gold } };
  
  const menuPaperSx = { 
    mt: 1, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: 1, borderColor: "divider",
    "& .MuiMenuItem-root": { fontSize: "0.75rem", py: 1, gap: 1.5, borderRadius: "4px", mx: 0.5, my: 0.25 },
    "& .Mui-selected": { bgcolor: alpha(gold, 0.1) + " !important", color: gold, fontWeight: 600 },
  };

  const selectSx = { height: 28, fontSize: "0.75rem", bgcolor: "transparent", color: "inherit", ".MuiOutlinedInput-notchedOutline": { border: "none" }, ".MuiSelect-select": { p: "0 !important", display: "flex", alignItems: "center", justifyContent: "center" } };

  return (
    <Toolbar variant="dense" sx={{ minHeight: 44, gap: 0.5, px: "8px !important", borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", overflow: "hidden", flexWrap: "nowrap", "& .MuiBox-root": { flexShrink: 0 } }}>
      <IconButton size="small" onClick={onToggleSidebar} sx={btnSx}>{sidebarOpen ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}</IconButton>
      <Divider orientation="vertical" flexItem sx={dividerSx} />

      {/* 1. Undo/Redo */}
      {!isSM && (
        <>
          <Box display="flex" gap={0.5}>
            <Tooltip title={t("undo", "Undo")}><span><IconButton size="small" sx={btnSx} onClick={onUndo} disabled={!canUndo}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title={t("redo", "Redo")}><span><IconButton size="small" sx={btnSx} onClick={onRedo} disabled={!canRedo}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
          </Box>
          <Divider orientation="vertical" flexItem sx={dividerSx} />
        </>
      )}

      {/* 2. Page Navigation - HIDE EARLY */}
      {!isSM && (
        <>
          <Box display="flex" alignItems="center">
            <IconButton size="small" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} sx={btnSx}><KeyboardArrowLeftIcon fontSize="small" /></IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.5 }}>
              <InputBase value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handlePageSubmit(); }} onBlur={handlePageSubmit} sx={{ width: 35, fontSize: "0.75rem", fontWeight: 600, textAlign: "center", bgcolor: isDark ? alpha(gold, 0.1) : alpha(gold, 0.05), borderRadius: "4px", "& input": { textAlign: "center", p: "2px 0" } }} />
              <Box component="span" sx={{ fontSize: "0.75rem", opacity: 0.6 }}>/</Box>
              <Typography variant="caption" sx={{ opacity: 0.6, fontSize: "0.75rem" }}>{numPages}</Typography>
            </Box>
            <IconButton size="small" onClick={() => onPageChange(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages} sx={btnSx}><KeyboardArrowRightIcon fontSize="small" /></IconButton>
          </Box>
          <Divider orientation="vertical" flexItem sx={dividerSx} />
        </>
      )}

      {/* 3. Zoom - HIDE EARLY */}
      {!isSM && (
        <>
          <Box display="flex" alignItems="center">
            <IconButton size="small" onClick={onZoomOut} sx={btnSx}><ZoomOutIcon fontSize="small" /></IconButton>
            <Typography variant="caption" sx={{ minWidth: 35, textAlign: "center", fontWeight: 700, fontSize: "0.7rem" }}>{Math.round(zoom * 100)}%</Typography>
            <IconButton size="small" onClick={onZoomIn} sx={btnSx}><ZoomInIcon fontSize="small" /></IconButton>
          </Box>
          <Divider orientation="vertical" flexItem sx={dividerSx} />
        </>
      )}

      {/* 4. Core Tools */}
      <Box display="flex" gap={0.5}>
        <Tooltip title="Select (V)"><IconButton size="small" sx={tool === "select" ? activeBtnSx : btnSx} onClick={() => onToolChange("select")}><AdsClickIcon fontSize="small" /></IconButton></Tooltip>
        {!isXS && <Tooltip title="Pan (Space)"><IconButton size="small" sx={tool === "pan" ? activeBtnSx : btnSx} onClick={() => onToolChange("pan")}><PanToolIcon fontSize="small" /></IconButton></Tooltip>}
        <Tooltip title="Pen (P)"><IconButton size="small" sx={tool === "pen" ? activeBtnSx : btnSx} onClick={() => onToolChange("pen")}><CreateIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Highlighter (H)"><IconButton size="small" sx={tool === "highlighter" ? activeBtnSx : btnSx} onClick={() => onToolChange("highlighter")}><HighlightIcon fontSize="small" /></IconButton></Tooltip>
        
        {!isSM && (
          <>
            <Tooltip title="Line (L)"><IconButton size="small" sx={tool === "line" ? activeBtnSx : btnSx} onClick={() => onToolChange("line")}><TimelineIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Arrow (A)"><IconButton size="small" sx={tool === "arrow" ? activeBtnSx : btnSx} onClick={() => onToolChange("arrow")}><EastIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Shapes">
              <Box display="flex" sx={SHAPE_TOOLS.some((s) => s.key === tool) ? activeBtnSx : propertyBlockSx} onClick={(e) => setShapeMenuAnchor(e.currentTarget)}>
                {SHAPE_TOOLS.find((s) => s.key === tool)?.icon || <RectangleIcon fontSize="small" />}
              </Box>
            </Tooltip>
          </>
        )}
        
        {!isMD && (
          <>
            <Tooltip title="Cloud (C)"><IconButton size="small" sx={tool === "cloud" ? activeBtnSx : btnSx} onClick={() => onToolChange("cloud")}><CloudQueueIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Text (T)"><IconButton size="small" sx={tool === "text" ? activeBtnSx : btnSx} onClick={() => onToolChange("text")}><TextFormatIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Callout (O)"><IconButton size="small" sx={tool === "callout" ? activeBtnSx : btnSx} onClick={() => onToolChange("callout")}><ChatBubbleOutlineIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Measure (M)"><IconButton size="small" sx={tool === "measure" ? activeBtnSx : btnSx} onClick={() => onToolChange("measure")}><StraightenIcon fontSize="small" /></IconButton></Tooltip>
          </>
        )}
      </Box>

      <Divider orientation="vertical" flexItem sx={dividerSx} />
      
      {/* 5. Quick Color */}
      <Box sx={{ ...propertyBlockSx, position: "relative", width: 22, height: 22, mx: 1, p: 0, minWidth: 22 }}>
        <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: activeColor }} />
        <input type="color" value={activeColor} onChange={(e) => onColorChange(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
      </Box>

      {!isSM && (
        <>
          <Box sx={propertyBlockSx} onClick={(e) => setWidthAnchor(e.currentTarget)}><LineWeightIcon fontSize="small" /></Box>
          <Popover open={Boolean(widthAnchor)} anchorEl={widthAnchor} onClose={() => setWidthAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} transformOrigin={{ vertical: "top", horizontal: "center" }} PaperProps={{ sx: { p: 1.5, width: 160, borderRadius: "10px", border: 1, borderColor: "divider" } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><Slider size="small" value={activeStrokeWidth} min={1} max={50} onChange={(_, v) => onStrokeWidthChange(v as number)} sx={{ color: gold }} /><Typography variant="body2" fontWeight={700} sx={{ minWidth: 25, fontSize: "0.7rem" }}>{activeStrokeWidth}</Typography></Box>
            <Box sx={{ height: 30, mt: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Box sx={{ width: "80%", height: Math.max(1, 1.2 + (activeStrokeWidth / 50) * 4.8), bgcolor: activeColor, borderRadius: "2px" }} /></Box>
          </Popover>

          <Box sx={propertyBlockSx}>
            <Select size="small" value={activeLineStyle} onChange={(e) => onLineStyleChange(e.target.value as LineStyle)} IconComponent={() => null} sx={selectSx} renderValue={(val) => <LinePreview style={val as LineStyle} width={2} previewWidth={60} />}>
              {LINE_STYLES.map((s) => <MenuItem key={s.key} value={s.key} sx={{ py: 1.5, px: 2 }}><LinePreview style={s.key} width={2} previewWidth={140} /></MenuItem>)}
            </Select>
          </Box>
        </>
      )}

      {/* 6. More Menu */}
      <Box sx={{ ml: "auto", display: "flex", alignItems: "center" }}>
        {(isXS || isSM || isMD) && (
          <IconButton size="small" sx={btnSx} onClick={(e) => setMoreMenuAnchor(e.currentTarget)}><MoreVertIcon fontSize="small" /></IconButton>
        )}
        <Menu anchorEl={moreMenuAnchor} open={Boolean(moreMenuAnchor)} onClose={() => setMoreMenuAnchor(null)} PaperProps={{ sx: { ...menuPaperSx, width: 240, maxHeight: "80vh" } }}>
          {isSM && (
            <>
              <MenuItem disabled={!canUndo} onClick={() => { onUndo?.(); setMoreMenuAnchor(null); }}><ListItemIcon><UndoIcon fontSize="small"/></ListItemIcon><ListItemText primary="Undo" /></MenuItem>
              <MenuItem disabled={!canRedo} onClick={() => { onRedo?.(); setMoreMenuAnchor(null); }}><ListItemIcon><RedoIcon fontSize="small"/></ListItemIcon><ListItemText primary="Redo" /></MenuItem>
              <Divider />
            </>
          )}
          <ListSubheader sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, color: gold }}>TOOLS</ListSubheader>
          {isXS && <MenuItem onClick={() => { onToolChange("pan"); setMoreMenuAnchor(null); }} selected={tool === "pan"}><ListItemIcon><PanToolIcon fontSize="small"/></ListItemIcon><ListItemText primary="Pan" /></MenuItem>}
          {isSM && (
            <>
              <MenuItem onClick={() => { onToolChange("line"); setMoreMenuAnchor(null); }} selected={tool === "line"}><ListItemIcon><TimelineIcon fontSize="small"/></ListItemIcon><ListItemText primary="Line" /></MenuItem>
              <MenuItem onClick={() => { onToolChange("arrow"); setMoreMenuAnchor(null); }} selected={tool === "arrow"}><ListItemIcon><EastIcon fontSize="small"/></ListItemIcon><ListItemText primary="Arrow" /></MenuItem>
              {SHAPE_TOOLS.map(s => <MenuItem key={s.key} onClick={() => { onToolChange(s.key); setMoreMenuAnchor(null); }} selected={tool === s.key}><ListItemIcon>{s.icon}</ListItemIcon><ListItemText primary={s.label} /></MenuItem>)}
            </>
          )}
          {isMD && (
            <>
              <MenuItem onClick={() => { onToolChange("cloud"); setMoreMenuAnchor(null); }} selected={tool === "cloud"}><ListItemIcon><CloudQueueIcon fontSize="small"/></ListItemIcon><ListItemText primary="Cloud" /></MenuItem>
              <MenuItem onClick={() => { onToolChange("text"); setMoreMenuAnchor(null); }} selected={tool === "text"}><ListItemIcon><TextFormatIcon fontSize="small"/></ListItemIcon><ListItemText primary="Text" /></MenuItem>
              <MenuItem onClick={() => { onToolChange("callout"); setMoreMenuAnchor(null); }} selected={tool === "callout"}><ListItemIcon><ChatBubbleOutlineIcon fontSize="small"/></ListItemIcon><ListItemText primary="Callout" /></MenuItem>
              <MenuItem onClick={() => { onToolChange("measure"); setMoreMenuAnchor(null); }} selected={tool === "measure"}><ListItemIcon><StraightenIcon fontSize="small"/></ListItemIcon><ListItemText primary="Measure" /></MenuItem>
            </>
          )}
          <Divider />
          <ListSubheader sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, color: gold }}>PROPERTIES</ListSubheader>
          {isSM && (
            <>
              <Box p={1}>
                <Typography variant="caption" sx={{ px: 1, fontWeight: 800, color: gold, display: "block", mb: 1 }}>WIDTH: {activeStrokeWidth}px</Typography>
                <Slider size="small" value={activeStrokeWidth} min={1} max={50} onChange={(_, v) => onStrokeWidthChange(v as number)} sx={{ color: gold, mx: 1, width: "calc(100% - 16px)" }} />
              </Box>
              <MenuItem sx={{ py: 0 }}><ListItemIcon><PaletteIcon fontSize="small"/></ListItemIcon>
                <Select size="small" fullWidth value={activeLineStyle} onChange={(e) => onLineStyleChange(e.target.value as LineStyle)} sx={{ fontSize: "0.75rem", ".MuiSelect-select": { py: 1 } }}>
                  {LINE_STYLES.map(s => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
                </Select>
              </MenuItem>
            </>
          )}
        </Menu>

        {!isSM && (
          <>
            <Divider orientation="vertical" flexItem sx={{ ...dividerSx, mx: 1.5 }} />
            <Box sx={propertyBlockSx}>
              <Select size="small" value={docScale} onChange={(e) => onDocScaleChange(e.target.value)} IconComponent={() => null} sx={{ ...selectSx, width: "auto", minWidth: 40, fontWeight: 700 }}>
                {STANDARD_SCALES.map((group, idx) => group.items ? [<ListSubheader key={`h-${idx}`} sx={{ lineHeight: "32px", fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", color: gold }}>{group.group}</ListSubheader>, ...group.items.map((item) => <MenuItem key={item.value} value={item.value} sx={{ fontSize: "0.75rem" }}>{item.label}</MenuItem>)] : <MenuItem key={group.value} value={group.value} sx={{ fontSize: "0.75rem", fontWeight: 700 }}>{group.label}</MenuItem>)}
              </Select>
            </Box>
            {versions.length > 0 && (
              <Box sx={{ ...propertyBlockSx, ml: 1, px: 1 }}>
                <HistoryIcon sx={{ fontSize: 16, mr: 0.5, color: gold }} />
                <Select size="small" value={currentDocId} onChange={(e) => onVersionChange?.(e.target.value)} IconComponent={() => null} sx={{ ...selectSx, width: "auto", minWidth: 40, fontWeight: 700 }}>
                  {versions.map((v: any, idx: number) => <MenuItem key={v.id} value={v.id} sx={{ fontSize: "0.72rem" }}>V{versions.length - idx} - {dayjs(v.createdAt).format("MM/DD/YY")}</MenuItem>)}
                </Select>
              </Box>
            )}
          </>
        )}
      </Box>
      <Menu anchorEl={shapeMenuAnchor} open={Boolean(shapeMenuAnchor)} onClose={() => setShapeMenuAnchor(null)} PaperProps={{ sx: menuPaperSx }}>
        {SHAPE_TOOLS.map((s) => <MenuItem key={s.key} selected={tool === s.key} onClick={() => { onToolChange(s.key); setShapeMenuAnchor(null); }}><ListItemIcon>{s.icon}</ListItemIcon><ListItemText primary={s.label} /></MenuItem>)}
      </Menu>
    </Toolbar>
  );
});

export default PdfToolbar;
