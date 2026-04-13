import { memo, useState, useEffect } from "react";
import {
  Box,
  IconButton,
  Tooltip,
  Toolbar,
  Typography,
  useTheme,
  alpha,
  Select,
  MenuItem,
  ListSubheader,
  Menu,
  ListItemIcon,
  ListItemText,
  InputBase,
  useMediaQuery,
  Popover,
  CircularProgress,
  Slider,
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
import ElectricalServicesIcon from "@mui/icons-material/ElectricalServices";
import EditNoteIcon from "@mui/icons-material/EditNote";
import ConstructionIcon from "@mui/icons-material/Construction";
import CheckIcon from "@mui/icons-material/Check";
import SpellcheckIcon from "@mui/icons-material/Spellcheck";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";
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
  | "image"
  | "electricalBox"
  | "stub"
  | "fitting"
  | "panel"
  | "wireTag"
  | "reviewStamp"
  | "stickyNote";

/** Configuration for electrical one-click placement tools */
export interface ElectricalConfig {
  tool: DrawTool;
  defaultText: string;
  size?: number; // normalized size (0..1)
  customProps: Record<string, any>;
  color: string;
  strokeWidth?: number;
  subject?: string;
}

export type LineStyle =
  | "solid"
  | "dashed"
  | "dotted"
  | "dash-dot"
  | "long-dash"
  | "short-dash"
  | "dash-dot-dot"
  | "long-dash-dot";
export type ArrowEnd =
  | "none"
  | "arrow"
  | "open-arrow"
  | "circle"
  | "diamond"
  | "square";

export const SHAPE_TOOLS: {
  key: DrawTool;
  icon: React.ReactNode;
  label: string;
}[] = [
  { key: "rect", icon: <RectangleIcon fontSize="small" />, label: "Rectangle" },
  {
    key: "circle",
    icon: <CircleOutlinedIcon fontSize="small" />,
    label: "Circle",
  },
  {
    key: "ellipse",
    icon: (
      <CircleOutlinedIcon fontSize="small" sx={{ transform: "scaleX(1.4)" }} />
    ),
    label: "Ellipse",
  },
  {
    key: "triangle",
    icon: <ChangeHistoryIcon fontSize="small" />,
    label: "Triangle",
  },
  {
    key: "diamond",
    icon: (
      <ChangeHistoryIcon
        fontSize="small"
        sx={{ transform: "rotate(45deg) scale(0.8)" }}
      />
    ),
    label: "Diamond",
  },
  {
    key: "hexagon",
    icon: <HexagonOutlinedIcon fontSize="small" />,
    label: "Hexagon",
  },
  { key: "star", icon: <StarOutlineIcon fontSize="small" />, label: "Star" },
];

/** Type icons for Tool Chest preset display */
const TOOL_CHEST_TYPE_ICONS: Record<string, React.ReactNode> = {
  rect: <RectangleIcon sx={{ fontSize: 16 }} />,
  line: <TimelineIcon sx={{ fontSize: 16 }} />,
  arrow: <EastIcon sx={{ fontSize: 16 }} />,
  text: <TextFormatIcon sx={{ fontSize: 16 }} />,
  circle: <CircleOutlinedIcon sx={{ fontSize: 16 }} />,
  ellipse: <CircleOutlinedIcon sx={{ fontSize: 16, transform: 'scaleX(1.4)' }} />,
  cloud: <CloudQueueIcon sx={{ fontSize: 16 }} />,
  pen: <CreateIcon sx={{ fontSize: 16 }} />,
  highlighter: <HighlightIcon sx={{ fontSize: 16 }} />,
  callout: <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />,
  polyline: <PolylineIcon sx={{ fontSize: 16 }} />,
  image: <ImageOutlinedIcon sx={{ fontSize: 16 }} />,
  measure: <StraightenIcon sx={{ fontSize: 16 }} />,
  routeTemplate: <RouteIcon sx={{ fontSize: 16 }} />,
  route: <RouteIcon sx={{ fontSize: 16 }} />,
  electricalBox: <ElectricalServicesIcon sx={{ fontSize: 16 }} />,
  stub: <ElectricalServicesIcon sx={{ fontSize: 16 }} />,
  panel: <ElectricalServicesIcon sx={{ fontSize: 16 }} />,
  wireTag: <ElectricalServicesIcon sx={{ fontSize: 16 }} />,
  reviewStamp: <PlaylistAddCheckIcon sx={{ fontSize: 16 }} />,
  stickyNote: <span style={{ fontSize: 14 }}>📝</span>,
};

/** Extract markupType from a preset (stored as special __markupType__ field entry) */
function getPresetMarkupType(preset: any): string | undefined {
  const entry = (preset.fields || []).find((f: any) => f.key === '__markupType__');
  return entry?.defaultValue || preset.markupType || undefined;
}

/** Get displayable fields (exclude the __markupType__ meta entry) */
function getPresetDisplayFields(preset: any): any[] {
  return (preset.fields || []).filter((f: any) => f.key !== '__markupType__' && f.key !== '__customStamp__');
}

/** Generate 1-2 letter initials from a name */
function getNameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const w = words[0] || '?';
  if (w.length <= 2) return w.toUpperCase();
  // Use first + first consonant after that
  const consonants = w.slice(1).match(/[bcdfghjklmnpqrstvwxyz]/i);
  return (w[0] + (consonants ? consonants[0] : w[1])).toUpperCase();
}

/** Deterministic color from string hash */
const PRESET_COLORS = ['#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#00bcd4','#009688','#4caf50','#ff9800','#ff5722','#795548','#607d8b'];
function getNameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return PRESET_COLORS[Math.abs(hash) % PRESET_COLORS.length];
}

export const LINE_STYLES: { key: LineStyle; label: string; dash: number[] }[] =
  [
    { key: "solid", label: "Solid", dash: [] },
    { key: "dashed", label: "Dashed", dash: [12, 6] },
    { key: "dotted", label: "Dotted", dash: [2, 4] },
    { key: "dash-dot", label: "Dash-Dot", dash: [15, 6, 3, 6] },
    { key: "dash-dot-dot", label: "Dash-Dot-Dot", dash: [15, 6, 3, 6, 3, 6] },
    { key: "long-dash", label: "Long Dash", dash: [25, 8] },
    { key: "short-dash", label: "Short Dash", dash: [6, 4] },
    { key: "long-dash-dot", label: "L-Dash-Dot", dash: [25, 8, 3, 8] },
  ];

export const LinePreview = ({
  style,
  width = 1,
  previewWidth = 80,
  forceColor,
}: {
  style: LineStyle;
  width?: number;
  previewWidth?: number;
  forceColor?: string;
}) => {
  const dash = LINE_STYLES.find((s) => s.key === style)?.dash || [];
  const c = forceColor || "currentColor";
  const visualStrokeWidth = 1; // Always fixed thickness for UI previews
  return (
    <Box
      sx={{
        width: previewWidth,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="100%" height="100%" style={{ overflow: "visible" }}>
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke={c}
          strokeWidth={visualStrokeWidth}
          strokeDasharray={
            dash.length > 0 ? dash.map((d) => d / 2.5).join(",") : "none"
          }
          strokeLinecap="round"
        />
      </svg>
    </Box>
  );
};

export const STANDARD_SCALES = [
  { label: "1:1", value: "1:1" },
  {
    group: "Architectural",
    items: [
      { label: '1/16" = 1\'0"', value: '1/16"=1\'0"' },
      { label: '1/8" = 1\'0"', value: '1/8"=1\'0"' },
      { label: '3/16" = 1\'0"', value: '3/16"=1\'0"' },
      { label: '1/4" = 1\'0"', value: '1/4"=1\'0"' },
      { label: '3/8" = 1\'0"', value: '3/8"=1\'0"' },
      { label: '1/2" = 1\'0"', value: '1/2"=1\'0"' },
      { label: '3/4" = 1\'0"', value: '3/4"=1\'0"' },
      { label: '1" = 1\'0"', value: '1"=1\'0"' },
      { label: '1-1/2" = 1\'0"', value: '1-1/2"=1\'0"' },
      { label: '3" = 1\'0"', value: '3"=1\'0"' },
    ],
  },
  {
    group: "Engineering",
    items: [
      { label: "1\" = 10'", value: "1\"=10'" },
      { label: "1\" = 20'", value: "1\"=20'" },
      { label: "1\" = 30'", value: "1\"=30'" },
      { label: "1\" = 40'", value: "1\"=40'" },
      { label: "1\" = 50'", value: "1\"=50'" },
      { label: "1\" = 60'", value: "1\"=60'" },
    ],
  },
  {
    group: "Metric",
    items: [
      { label: "1:2", value: "1:2" },
      { label: "1:5", value: "1:5" },
      { label: "1:10", value: "1:10" },
      { label: "1:20", value: "1:20" },
      { label: "1:50", value: "1:50" },
      { label: "1:100", value: "1:100" },
      { label: "1:200", value: "1:200" },
      { label: "1:500", value: "1:500" },
      { label: "1:1000", value: "1:1000" },
    ],
  },
];

interface PdfToolbarProps {
  tool: DrawTool;
  onToolChange: (t: DrawTool) => void;
  activeColor: string;
  onColorChange: (c: string) => void;
  activeStrokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
  activeLineStyle: LineStyle;
  onLineStyleChange: (s: LineStyle) => void;
  docScale: string;
  onDocScaleChange: (s: string) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
  scrollMode: "page" | "continuous" | "split";
  onScrollModeChange: (m: "page" | "continuous" | "split") => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  versions?: any[];
  currentDocId?: string;
  onVersionChange?: (docId: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  canMarkup?: boolean;
  onExportPdf?: () => void;
  isExporting?: boolean;
  onDownloadClean?: () => void;
  pageMarkupCount?: number;
  embeddedAnnotCount?: number;
  onImportAnnotations?: () => void;
  isImporting?: boolean;
  onAddReviewStamp?: (stamp: ReviewStamp) => void;
  onElectricalSelect?: (config: ElectricalConfig) => void;
  draftMode?: boolean;
  draftCount?: number;
  onDraftModeToggle?: () => void;
  onApplyDrafts?: () => void;
  onDiscardDrafts?: () => void;
  // ─── Collaboration Mode ───
  collabMode?: 'personal' | 'live' | 'edit' | 'draft' | 'qaqc';
  onCollabModeChange?: (mode: 'personal' | 'live' | 'edit' | 'draft' | 'qaqc') => void;
  editLockUser?: { id: string; name: string } | null;
  connectedUsers?: Array<{ id: string; name: string; color: string }>;
  personalMarkupCount?: number;
  onPublishPersonal?: () => void;
  onDiscardPersonal?: () => void;
  onCompare?: () => void;
  isCompareMode?: boolean;
  // QA/QC Spell Check
  qaqcMode?: boolean;
  qaqcPanelOpen?: boolean;
  onToggleQaqcPanel?: () => void;
  onToggleQaqc?: () => void;
  spellErrorCount?: number;
  // Tool Chest
  presets?: Array<{ id: string; name: string; markupType?: string; fields: Array<{ key: string; defaultValue: string; type?: string }> }>;
  onApplyPreset?: (preset: any) => void;
  onDeletePreset?: (presetId: string) => void;
  propertiesHidden?: boolean;
  onToggleProperties?: () => void;
  historyOpen?: boolean;
  onToggleHistory?: () => void;
  // Compare sub-bar controls (rendered as dropdown under toolbar)
  compareControls?: {
    oldColor: string;
    newColor: string;
    opacity: number;
    showOld: boolean;
    showNew: boolean;
    oldLabel: string;
    newLabel: string;
    onToggleOld: () => void;
    onToggleNew: () => void;
    onOpacityChange: (v: number) => void;
    onExport?: () => void;
    onSave?: () => void;
    onDetectChanges?: () => void;
    isDetecting?: boolean;
    onClose: () => void;
  } | null;
}

// ─── Review Stamps — pre-built markup templates for document checking ───────
export interface ReviewStamp {
  id: string;
  label: string;
  icon: string; // emoji
  color: string; // hex
  subject: string; // maps to markup subject
  status?: string; // auto-set status
  comment?: string; // pre-filled comment
  type: DrawTool; // markup type (cloud, rect, text, arrow, callout, polyline, circle)
  category: string;
  /** Custom properties auto-applied to the markup */
  customProps?: Record<string, any>;
  /** For conduit: line thickness in strokeWidth */
  strokeWidth?: number;
  /** For text boxes: default text */
  defaultText?: string;
  /** Line style override */
  lineStyle?: string;
}

export const REVIEW_STAMPS: ReviewStamp[] = [
  // ── Status stamps — unique reviewStamp type, one-click placement ──
  // Shape: rounded rect with bold text + icon, filled background
  {
    id: "approved",
    label: "Approved",
    icon: "✓",
    color: "#4caf50",
    subject: "Approved",
    status: "accepted",
    type: "reviewStamp" as DrawTool,
    category: "Status",
    defaultText: "APPROVED",
    customProps: { stampShape: "rounded", stampFill: true },
  },
  {
    id: "rejected",
    label: "Rejected",
    icon: "✗",
    color: "#f44336",
    subject: "Rejected",
    status: "rejected",
    type: "reviewStamp" as DrawTool,
    category: "Status",
    defaultText: "REJECTED",
    customProps: { stampShape: "rounded", stampFill: true },
  },
  {
    id: "revise",
    label: "Revise & Resubmit",
    icon: "↻",
    color: "#ff9800",
    subject: "Revise & Resubmit",
    status: "cancelled",
    type: "reviewStamp" as DrawTool,
    category: "Status",
    defaultText: "REVISE",
    customProps: { stampShape: "rounded", stampFill: true },
  },
  {
    id: "for-review",
    label: "For Review",
    icon: "?",
    color: "#2196f3",
    subject: "For Review",
    status: "none",
    type: "reviewStamp" as DrawTool,
    category: "Status",
    defaultText: "FOR REVIEW",
    customProps: { stampShape: "rect", stampFill: false },
  },
  {
    id: "verified",
    label: "Verified",
    icon: "✔",
    color: "#00bcd4",
    subject: "Verified",
    status: "completed",
    type: "reviewStamp" as DrawTool,
    category: "Status",
    defaultText: "VERIFIED",
    customProps: { stampShape: "rounded", stampFill: true },
  },
  {
    id: "not-approved",
    label: "Not Approved",
    icon: "✗",
    color: "#b71c1c",
    subject: "Not Approved",
    status: "rejected",
    type: "reviewStamp" as DrawTool,
    category: "Status",
    defaultText: "NOT APPROVED",
    customProps: { stampShape: "rounded", stampFill: true },
  },

  // ── Issue markers — diamond/triangle shapes with text ──
  {
    id: "dim-error",
    label: "Dimension Error",
    icon: "📐",
    color: "#f44336",
    subject: "Dimension Error",
    type: "reviewStamp" as DrawTool,
    category: "Issues",
    defaultText: "DIM",
    customProps: { stampShape: "diamond" },
  },
  {
    id: "missing",
    label: "Missing Detail",
    icon: "⚠",
    color: "#ff9800",
    subject: "Missing Detail",
    type: "reviewStamp" as DrawTool,
    category: "Issues",
    defaultText: "⚠",
    customProps: { stampShape: "triangle", stampFill: true },
  },
  {
    id: "conflict",
    label: "Conflict",
    icon: "⚡",
    color: "#e91e63",
    subject: "Conflict",
    type: "reviewStamp" as DrawTool,
    category: "Issues",
    defaultText: "CONFLICT",
    customProps: { stampShape: "diamond" },
  },
  {
    id: "code-viol",
    label: "Code Violation",
    icon: "🚫",
    color: "#9c27b0",
    subject: "Code Violation",
    type: "reviewStamp" as DrawTool,
    category: "Issues",
    defaultText: "CODE",
    customProps: { stampShape: "circle" },
  },
  {
    id: "verify",
    label: "Verify in Field",
    icon: "❓",
    color: "#2196f3",
    subject: "Verify in Field",
    type: "reviewStamp" as DrawTool,
    category: "Issues",
    defaultText: "VERIFY",
    customProps: { stampShape: "circle" },
  },
  {
    id: "coord",
    label: "Coordinate",
    icon: "🔗",
    color: "#607d8b",
    subject: "Coordinate",
    type: "reviewStamp" as DrawTool,
    category: "Issues",
    defaultText: "COORD",
    customProps: { stampShape: "rect" },
  },

  // ── Communication — cloud/callout shapes ──
  {
    id: "note",
    label: "Note",
    icon: "📝",
    color: "#ffc107",
    subject: "Note",
    type: "reviewStamp" as DrawTool,
    category: "Notes",
    defaultText: "NOTE",
    customProps: { stampShape: "cloud" },
  },
  {
    id: "question",
    label: "Question",
    icon: "?",
    color: "#03a9f4",
    subject: "Question",
    type: "reviewStamp" as DrawTool,
    category: "Notes",
    defaultText: "?",
    customProps: { stampShape: "circle", stampFill: true },
  },
  {
    id: "rfi",
    label: "RFI",
    icon: "📋",
    color: "#795548",
    subject: "RFI",
    type: "reviewStamp" as DrawTool,
    category: "Notes",
    defaultText: "RFI",
    customProps: { stampShape: "rounded", stampFill: false },
    comment: "Request for Information: ",
  },
  {
    id: "attention",
    label: "Attention",
    icon: "❗",
    color: "#ff5722",
    subject: "Attention Required",
    type: "reviewStamp" as DrawTool,
    category: "Notes",
    defaultText: "!",
    customProps: { stampShape: "circle", stampFill: true },
  },

  // ── Favorites — quick-access review markers with distinctive icons on the sheet ──
  {
    id: "fav-sticky",
    label: "Sticky",
    icon: "📝",
    color: "#FFEB3B",
    subject: "Note",
    type: "stickyNote" as DrawTool,
    category: "Favorites",
    defaultText: "",
    customProps: { fill: "#FFEB3B", textColor: "#212121", fontSize: 14 },
  },
  {
    id: "fav-overlap",
    label: "Overlap",
    icon: "⊗",
    color: "#e53935",
    subject: "Overlap",
    type: "reviewStamp" as DrawTool,
    category: "Favorites",
    defaultText: "⊗ OVERLAP",
    customProps: { stampShape: "rounded", stampFill: true },
  },
  {
    id: "fav-font",
    label: "Font",
    icon: "Aa",
    color: "#5c6bc0",
    subject: "Font Issue",
    type: "reviewStamp" as DrawTool,
    category: "Favorites",
    defaultText: "Aa FONT",
    customProps: { stampShape: "rounded", stampFill: false },
  },
  {
    id: "fav-wrong",
    label: "Wrong",
    icon: "✗",
    color: "#d32f2f",
    subject: "Wrong",
    type: "reviewStamp" as DrawTool,
    category: "Favorites",
    defaultText: "✗ WRONG",
    customProps: { stampShape: "rounded", stampFill: true },
  },
  {
    id: "fav-info",
    label: "Info",
    icon: "ℹ",
    color: "#0288d1",
    subject: "Information",
    type: "reviewStamp" as DrawTool,
    category: "Favorites",
    defaultText: "ℹ INFO",
    customProps: { stampShape: "rounded", stampFill: true },
  },
  {
    id: "fav-missed",
    label: "Missed",
    icon: "⚠",
    color: "#ef6c00",
    subject: "Missed",
    type: "reviewStamp" as DrawTool,
    category: "Favorites",
    defaultText: "⚠ MISSED",
    customProps: { stampShape: "rounded", stampFill: true },
  },
  {
    id: "fav-other",
    label: "Other",
    icon: "…",
    color: "#78909c",
    subject: "Other",
    type: "reviewStamp" as DrawTool,
    category: "Favorites",
    defaultText: "… OTHER",
    customProps: { stampShape: "rounded", stampFill: false },
  },
  {
    id: "fav-dim",
    label: "Dimension",
    icon: "↔",
    color: "#f4511e",
    subject: "Dimension Issue",
    type: "reviewStamp" as DrawTool,
    category: "Favorites",
    defaultText: "↔ DIM",
    customProps: { stampShape: "rounded", stampFill: true },
  },
  {
    id: "fav-tag",
    label: "Tag",
    icon: "#",
    color: "#7b1fa2",
    subject: "Tag Issue",
    type: "reviewStamp" as DrawTool,
    category: "Favorites",
    defaultText: "# TAG",
    customProps: { stampShape: "rounded", stampFill: false },
  },
  {
    id: "fav-align",
    label: "Align",
    icon: "⫶",
    color: "#00897b",
    subject: "Alignment Issue",
    type: "reviewStamp" as DrawTool,
    category: "Favorites",
    defaultText: "⫶ ALIGN",
    customProps: { stampShape: "rounded", stampFill: false },
  },
  {
    id: "fav-callme",
    label: "Call Me",
    icon: "☎",
    color: "#1565c0",
    subject: "Call Me",
    type: "reviewStamp" as DrawTool,
    category: "Favorites",
    defaultText: "☎ CALL",
    customProps: { stampShape: "rounded", stampFill: true },
    comment: "Please call to discuss: ",
  },
];

const PdfToolbar = memo(function PdfToolbar({
  tool,
  onToolChange,
  activeColor,
  onColorChange,
  activeStrokeWidth,
  onStrokeWidthChange,
  activeLineStyle,
  onLineStyleChange,
  docScale,
  onDocScaleChange,
  zoom,
  onZoomIn,
  onZoomOut,
  currentPage,
  numPages,
  onPageChange,
  scrollMode,
  onScrollModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  versions = [],
  currentDocId,
  onVersionChange,
  sidebarOpen,
  onToggleSidebar,
  canMarkup = true,
  onExportPdf,
  isExporting = false,
  onDownloadClean,
  pageMarkupCount = 0,
  embeddedAnnotCount = 0,
  onImportAnnotations,
  isImporting = false,
  onAddReviewStamp,
  onElectricalSelect,
  draftMode = false,
  draftCount = 0,
  onDraftModeToggle,
  onApplyDrafts,
  onDiscardDrafts,
  onCompare,
  isCompareMode = false,
  qaqcMode = false,
  onToggleQaqc,
  qaqcPanelOpen,
  onToggleQaqcPanel,
  spellErrorCount = 0,
  compareControls,
  collabMode = 'personal',
  onCollabModeChange,
  editLockUser,
  connectedUsers = [],
  personalMarkupCount = 0,
  onPublishPersonal,
  onDiscardPersonal,
  presets = [],
  onApplyPreset,
  onDeletePreset,
  propertiesHidden,
  onToggleProperties,
  historyOpen = false,
  onToggleHistory,
}: PdfToolbarProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const gold = theme.palette.primary.main;

  // Breakpoints: progressive collapse
  const isXS = useMediaQuery("(max-width:650px)");
  const isSM = useMediaQuery("(max-width:1150px)");
  const isMD = useMediaQuery("(max-width:1920px)");
  // Bottom bar visible at ≤1050px — hide scale/version/download from toolbar to avoid duplication
  const isBottomBarVisible = useMediaQuery("(max-width:1050px)");
  // Hide right-side heavy items earlier to prevent overflow
  const hideRightHeavy = isSM;

  const [pageInput, setPageInput] = useState(currentPage.toString());
  const [localColor, setLocalColor] = useState(activeColor);
  const [collabAnchorEl, setCollabAnchorEl] = useState<HTMLElement | null>(null);
  const [downloadAnchor, setDownloadAnchor] = useState<null | HTMLElement>(null);
  useEffect(() => {
    setLocalColor(activeColor);
  }, [activeColor]);
  const [shapeMenuAnchor, setShapeMenuAnchor] = useState<null | HTMLElement>(
    null,
  );
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(
    null,
  );
  const [stampMenuAnchor, setStampMenuAnchor] = useState<null | HTMLElement>(
    null,
  );
  const [electricalAnchor, setElectricalAnchor] = useState<null | HTMLElement>(
    null,
  );
  const [widthAnchor, setWidthAnchor] = useState<null | HTMLElement>(null);
  const [colorAnchor, setColorAnchor] = useState<null | HTMLElement>(null);
  const [styleAnchor, setStyleAnchor] = useState<null | HTMLElement>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeAnchor, setCustomizeAnchor] = useState<null | HTMLElement>(
    null,
  );
  const [toolChestAnchor, setToolChestAnchor] = useState<null | HTMLElement>(null);

  // Toolbar customization: which tools are visible
  const [hiddenTools, setHiddenTools] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("pdfToolbarHidden") || "[]");
    } catch {
      return [];
    }
  });
  const toggleToolVisibility = (toolId: string) => {
    setHiddenTools((prev) => {
      const next = prev.includes(toolId)
        ? prev.filter((t) => t !== toolId)
        : [...prev, toolId];
      localStorage.setItem("pdfToolbarHidden", JSON.stringify(next));
      return next;
    });
  };
  const isToolVisible = (toolId: string) => !hiddenTools.includes(toolId);

  const DEFAULT_TOOL_ORDER = [
    "pan",
    "textSelect",
    "pen",
    "highlighter",
    "line",
    "arrow",
    "shapes",
    "cloud",
    "text",
    "callout",
    "measure",
    "polyline",
    "routeTemplate",
    "image",
    "stamps",
    "electrical",
  ];

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageSubmit = () => {
    const val = parseInt(pageInput);
    if (!isNaN(val) && val >= 1 && val <= numPages) onPageChange(val);
    else setPageInput(currentPage.toString());
  };

  // Unified button styles — same as Pen/tool buttons
  const btnSx = {
    borderRadius: "8px",
    p: "6px",
    color: "text.secondary",
    transition: "all 0.12s",
    "&:hover": {
      bgcolor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
      color: "text.primary",
    },
    "&.Mui-disabled": { opacity: 0.3 },
  };
  const activeBtnSx = {
    ...btnSx,
    bgcolor: alpha(gold, 0.15),
    color: gold,
    "&:hover": { bgcolor: alpha(gold, 0.22) },
  };
  const dividerSx = {
    mx: 0.5,
    height: 22,
    alignSelf: "center",
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
  };
  const pillSx = {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
    borderRadius: "10px",
    px: "4px",
    py: "3px",
  };

  // Property block — same hover as buttons
  const propBlockSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    px: "6px",
    py: "4px",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s",
    color: "text.secondary",
    height: 32,
    minWidth: 32,
    "&:hover": { bgcolor: alpha(gold, 0.08), color: gold },
  };

  const menuPaperSx = {
    mt: 1,
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    border: 1,
    borderColor: "divider",
    bgcolor: "background.paper",
    "& .MuiMenuItem-root": {
      fontSize: "0.75rem",
      gap: 1.5,
      borderRadius: "4px",
      mx: 0.5,
      my: 0.25,
    },
    "& .Mui-selected": {
      bgcolor: alpha(gold, 0.1) + " !important",
      color: gold,
      fontWeight: 600,
    },
  };

  // Select without arrow — inline transparent
  const inlineSelectSx = {
    height: 28,
    fontSize: "0.75rem",
    bgcolor: "transparent",
    color: "inherit",
    ".MuiOutlinedInput-notchedOutline": { border: "none" },
    ".MuiSelect-select": {
      p: "0 !important",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
  };

  // Styled dropdown menus (dark/light themed)
  const styledMenuProps = {
    anchorOrigin: { vertical: "bottom" as const, horizontal: "left" as const },
    transformOrigin: { vertical: "top" as const, horizontal: "left" as const },
    PaperProps: {
      sx: {
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        "& .MuiMenuItem-root": {
          fontSize: "0.75rem",
          borderRadius: "4px",
          mx: 0.5,
          my: 0.25,
          color: "text.primary",
          "&:hover": { bgcolor: alpha(gold, 0.08) },
          "&.Mui-selected": {
            bgcolor: alpha(gold, 0.12),
            color: gold,
            fontWeight: 600,
          },
        },
        "& .MuiListSubheader-root": {
          bgcolor: "background.paper",
          color: gold,
          fontSize: "0.65rem",
          fontWeight: 800,
          lineHeight: "32px",
        },
      },
    },
  };

  // ── Shared JSX fragments for drawing tools (used in both 1-row and 2-row layouts) ──
  const drawingToolsPill = canMarkup ? (
    <Box sx={pillSx}>
      {isToolVisible("pen") && (
        <Tooltip title="Pen (P)">
          <IconButton
            size="small"
            sx={tool === "pen" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("pen")}
          >
            <CreateIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {isToolVisible("highlighter") && (
        <Tooltip title="Highlighter (H)">
          <IconButton
            size="small"
            sx={tool === "highlighter" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("highlighter")}
          >
            <HighlightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {isToolVisible("line") && (
        <Tooltip title="Line (L)">
          <IconButton
            size="small"
            sx={tool === "line" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("line")}
          >
            <TimelineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {isToolVisible("arrow") && (
        <Tooltip title="Arrow (A)">
          <IconButton
            size="small"
            sx={tool === "arrow" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("arrow")}
          >
            <EastIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {isToolVisible("shapes") && (
        <Tooltip title="Shapes">
          <Box
            display="flex"
            sx={
              SHAPE_TOOLS.some((s) => s.key === tool)
                ? activeBtnSx
                : propBlockSx
            }
            onClick={(e) => setShapeMenuAnchor(e.currentTarget)}
          >
            {SHAPE_TOOLS.find((s) => s.key === tool)?.icon || (
              <RectangleIcon fontSize="small" />
            )}
          </Box>
        </Tooltip>
      )}
      {isToolVisible("cloud") && (
        <Tooltip title="Cloud (C)">
          <IconButton
            size="small"
            sx={tool === "cloud" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("cloud")}
          >
            <CloudQueueIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {isToolVisible("text") && (
        <Tooltip title="Text (T)">
          <IconButton
            size="small"
            sx={tool === "text" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("text")}
          >
            <TextFormatIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {isToolVisible("callout") && (
        <Tooltip title="Cloud+ (O)">
          <IconButton
            size="small"
            sx={tool === "callout" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("callout")}
          >
            <Box
              sx={{
                position: "relative",
                display: "inline-flex",
                width: 20,
                height: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CloudQueueIcon sx={{ fontSize: 18 }} />
              <Box
                sx={{
                  position: "absolute",
                  bottom: 1,
                  right: -1,
                  fontSize: 10,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "inherit",
                }}
              >
                +
              </Box>
            </Box>
          </IconButton>
        </Tooltip>
      )}
      {isToolVisible("measure") && (
        <Tooltip title="Measure (M)">
          <IconButton
            size="small"
            sx={tool === "measure" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("measure")}
          >
            <StraightenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {isToolVisible("polyline") && (
        <Tooltip title="Polyline (K) — click points, dblclick to finish">
          <IconButton
            size="small"
            sx={tool === "polyline" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("polyline")}
          >
            <PolylineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {isToolVisible("image") && (
        <Tooltip title="Image">
          <IconButton
            size="small"
            sx={tool === "image" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("image")}
          >
            <ImageOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  ) : null;

  const colorWidthStyleContent = canMarkup ? (
    <Box sx={pillSx}>
      {/* ── Color ── */}
      <Tooltip title="Color">
        <Box
          sx={{ ...propBlockSx, p: "5px" }}
          onClick={(e) => setColorAnchor(e.currentTarget)}
        >
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              bgcolor: localColor,
              flexShrink: 0,
              border: `2px solid ${alpha(isDark ? "#fff" : "#000", 0.15)}`,
              boxShadow: `0 0 0 2px ${alpha(localColor, 0.35)}`,
            }}
          />
        </Box>
      </Tooltip>

      {/* Width */}
      <Tooltip title="Stroke Width">
        <Box
          sx={{ ...propBlockSx, gap: "3px" }}
          onClick={(e) => setWidthAnchor(e.currentTarget)}
        >
          <svg
            width="28"
            height="14"
            style={{ overflow: "visible", flexShrink: 0 }}
          >
            <line
              x1="2"
              y1="7"
              x2="26"
              y2="7"
              stroke="currentColor"
              strokeWidth={Math.max(
                1,
                Math.min(5, 1 + (activeStrokeWidth / 50) * 4),
              )}
              strokeLinecap="round"
            />
          </svg>
          <Typography
            sx={{ fontSize: "0.6rem", fontWeight: 700, color: "inherit" }}
          >
            {activeStrokeWidth}px
          </Typography>
        </Box>
      </Tooltip>

      {/* Style */}
      <Tooltip title="Line Style">
        <Box sx={propBlockSx} onClick={(e) => setStyleAnchor(e.currentTarget)}>
          <LinePreview
            style={activeLineStyle}
            width={activeStrokeWidth}
            previewWidth={52}
          />
        </Box>
      </Tooltip>
    </Box>
  ) : null;

  const routeStampsElectricalPill = canMarkup ? (
    <Box sx={{ ...pillSx, mr: 0.5 }}>
      {isToolVisible("routeTemplate") && (
        <Tooltip title="Route Template">
          <IconButton
            size="small"
            sx={tool === "routeTemplate" ? activeBtnSx : btnSx}
            onClick={() => onToolChange("routeTemplate")}
          >
            <RouteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {onAddReviewStamp && isToolVisible("stamps") && (
        <Tooltip title="Review Stamps">
          <IconButton
            size="small"
            sx={tool === "reviewStamp" ? activeBtnSx : btnSx}
            onClick={(e) => setStampMenuAnchor(e.currentTarget)}
          >
            <PlaylistAddCheckIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {onElectricalSelect && isToolVisible("electrical") && (
        <Tooltip title="Electrical Elements">
          <IconButton
            size="small"
            sx={
              ["electricalBox", "stub", "panel", "wireTag"].includes(tool)
                ? activeBtnSx
                : btnSx
            }
            onClick={(e) => setElectricalAnchor(e.currentTarget)}
          >
            <ElectricalServicesIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  ) : null;

  // ── Navigation items (sidebar, select/pan/text, page nav, scroll mode, zoom) ──
  const navigationContent = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: "6px",
        flexShrink: 0,
      }}
    >
      {/* Sidebar toggle */}
      <IconButton size="small" onClick={onToggleSidebar} sx={btnSx}>
        {sidebarOpen ? (
          <MenuOpenIcon fontSize="small" />
        ) : (
          <MenuIcon fontSize="small" />
        )}
      </IconButton>
      <Divider orientation="vertical" flexItem sx={dividerSx} />

      {/* Page nav pill */}
      <Box sx={pillSx}>
        <IconButton
          size="small"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          sx={btnSx}
        >
          <KeyboardArrowLeftIcon fontSize="small" />
        </IconButton>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.5 }}>
          <InputBase
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePageSubmit();
            }}
            onBlur={handlePageSubmit}
            sx={{
              width: 32,
              fontSize: "0.75rem",
              fontWeight: 700,
              textAlign: "center",
              "& input": { textAlign: "center", p: "1px 0" },
            }}
          />
          <Box
            component="span"
            sx={{ fontSize: "0.72rem", opacity: 0.45, fontWeight: 500 }}
          >
            /
          </Box>
          <Typography
            variant="caption"
            sx={{ opacity: 0.55, fontSize: "0.72rem", fontWeight: 500 }}
          >
            {numPages}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
          disabled={currentPage >= numPages}
          sx={btnSx}
        >
          <KeyboardArrowRightIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Scroll Mode pill */}
      <Box sx={pillSx}>
        <Tooltip title={t("singlePage", "Single Page")}>
          <IconButton
            size="small"
            onClick={() => onScrollModeChange("page")}
            sx={scrollMode === "page" ? activeBtnSx : btnSx}
          >
            <ArticleIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("continuousScroll", "Continuous Scroll")}>
          <IconButton
            size="small"
            onClick={() => onScrollModeChange("continuous")}
            sx={scrollMode === "continuous" ? activeBtnSx : btnSx}
          >
            <ViewDayIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Zoom pill */}
      <Box sx={pillSx}>
        <Tooltip title="Zoom Out">
          <IconButton size="small" onClick={onZoomOut} sx={btnSx}>
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography
          variant="caption"
          sx={{
            minWidth: 38,
            textAlign: "center",
            fontWeight: 700,
            fontSize: "0.72rem",
          }}
        >
          {Math.round(zoom * 100)}%
        </Typography>
        <Tooltip title="Zoom In">
          <IconButton size="small" onClick={onZoomIn} sx={btnSx}>
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  // ── Right-side action items (customize, undo/redo, download, compare, scale/version) ──
  const actionsContent = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: "6px",
        flexShrink: 0,
      }}
    >
      {/* Customize toolbar button */}
      <Tooltip title="Customize toolbar">
        <IconButton
          size="small"
          sx={{
            ...btnSx,
            ...(customizeOpen
              ? { bgcolor: alpha(gold, 0.12), color: gold }
              : {}),
          }}
          onClick={(e) => {
            setCustomizeAnchor(e.currentTarget);
            setCustomizeOpen(true);
          }}
        >
          <TuneIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Tool Chest — custom markup presets */}
      {canMarkup && (
        <Tooltip title="Tool Chest">
          <IconButton size="small" onClick={(e) => setToolChestAnchor(e.currentTarget)}
            sx={{ ...btnSx, ...(Boolean(toolChestAnchor) ? { bgcolor: alpha(gold, 0.12), color: gold } : {}) }}>
            <ConstructionIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Undo / Redo */}
      {canMarkup && (
        <>
          <Tooltip title={`${t("undo", "Undo")} (Ctrl+Z)`}>
            <span>
              <IconButton
                size="small"
                sx={btnSx}
                onClick={onUndo}
                disabled={!canUndo}
              >
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={`${t("redo", "Redo")} (Ctrl+Y)`}>
            <span>
              <IconButton
                size="small"
                sx={btnSx}
                onClick={onRedo}
                disabled={!canRedo}
              >
                <RedoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}

      {/* Download button with styled dropdown */}
      {(onDownloadClean || onExportPdf) && (
        <>
          <Divider orientation="vertical" flexItem sx={dividerSx} />
          <Tooltip title="Download">
            <IconButton size="small" sx={btnSx} onClick={(e) => setDownloadAnchor(e.currentTarget)}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Popover
            open={Boolean(downloadAnchor)}
            anchorEl={downloadAnchor}
            onClose={() => setDownloadAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            transformOrigin={{ vertical: "top", horizontal: "center" }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1, borderRadius: "12px", minWidth: 220,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.2)`,
                  overflow: "hidden",
                },
              },
            }}
          >
            <Box sx={{ px: 1.5, py: 0.8, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`, bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
              <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, color: alpha(gold, 0.7) }}>
                DOWNLOAD
              </Typography>
            </Box>
            <Box sx={{ py: 0.5 }}>
              {onDownloadClean && (
                <Box onClick={() => { onDownloadClean(); setDownloadAnchor(null); }}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: alpha(gold, 0.08) }, transition: 'background 0.15s' }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: alpha('#4caf50', 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DownloadIcon sx={{ fontSize: 18, color: '#4caf50' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>Clean PDF</Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>Original without markups</Typography>
                  </Box>
                </Box>
              )}
              {onExportPdf && (
                <Box onClick={() => { if (!isExporting) { onExportPdf(); setDownloadAnchor(null); } }}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, cursor: isExporting ? 'wait' : 'pointer', opacity: isExporting ? 0.5 : 1, '&:hover': { bgcolor: isExporting ? undefined : alpha(gold, 0.08) }, transition: 'background 0.15s' }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: alpha(gold, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isExporting ? <CircularProgress size={16} sx={{ color: gold }} /> : <LayersIcon sx={{ fontSize: 18, color: gold }} />}
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{isExporting ? 'Exporting...' : 'With Markups'}</Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>PDF with all annotations baked in</Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Popover>
        </>
      )}

      {/* Import Bluebeam annotations button */}
      {onImportAnnotations && embeddedAnnotCount > 0 && (
        <Tooltip title={isImporting ? 'Importing...' : `Import ${embeddedAnnotCount} Bluebeam annotation${embeddedAnnotCount !== 1 ? 's' : ''}`}>
          <span>
            <IconButton size="small" sx={{ ...btnSx, color: '#ff9800', position: 'relative' }} onClick={onImportAnnotations} disabled={isImporting}>
              <SystemUpdateAltIcon fontSize="small" />
              <Box sx={{ position: 'absolute', top: 1, right: 1, width: 14, height: 14, borderRadius: '50%', bgcolor: '#ff9800', color: '#fff', fontSize: '0.55rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {embeddedAnnotCount > 99 ? '99+' : embeddedAnnotCount}
              </Box>
            </IconButton>
          </span>
        </Tooltip>
      )}

      {/* Compare button */}
      {onCompare && (
        <Tooltip title={isCompareMode ? "Comparing..." : "Compare revisions"}>
          <IconButton size="small" sx={isCompareMode ? activeBtnSx : btnSx} onClick={onCompare}>
            <CompareArrowsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Markup History panel toggle */}
      {onToggleHistory && (
        <Tooltip title={historyOpen ? "Close History" : "Markup History"}>
          <IconButton size="small" sx={historyOpen ? activeBtnSx : btnSx} onClick={onToggleHistory}>
            <ManageHistoryIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* QA/QC Review panel button — only in QA/QC mode */}
      {collabMode === 'qaqc' && onToggleQaqcPanel && (
        <Tooltip title={qaqcPanelOpen ? "Close QA/QC Review" : "Open QA/QC Review"}>
          <IconButton size="small" sx={qaqcPanelOpen ? activeBtnSx : btnSx} onClick={onToggleQaqcPanel}>
            <SpellcheckIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Properties panel toggle — rendered in Row 2 for two-row layout, here for one-row */}
      {!isMD && onToggleProperties && (
        <Tooltip title={propertiesHidden ? "Show properties panel" : "Hide properties panel"}>
          <IconButton size="small" sx={propertiesHidden ? btnSx : activeBtnSx} onClick={onToggleProperties}>
            <EditNoteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* ─── Collaboration Mode Pill — hidden for read-only users (no markup permission) ─── */}
      {onCollabModeChange && canMarkup && (() => {
        const modeColors: Record<string, string> = { personal: '#2196f3', live: '#4caf50', edit: '#ff9800', draft: '#ff9800', qaqc: '#e91e63' };
        const modeLabels: Record<string, string> = { personal: 'PERSONAL', live: 'LIVE', edit: 'EDIT', draft: 'DRAFT', qaqc: 'QA/QC' };
        const mc = modeColors[collabMode] || '#4caf50';
        const ml = modeLabels[collabMode] || 'LIVE';
        // Personal: show when localStorage has saved markups (actual changes made)
        // Draft: show when change count > 0
        const hasPersonalChanges = collabMode === 'personal' && (personalMarkupCount || 0) > 0;
        const hasEditChanges = collabMode === 'edit' && (draftCount || 0) > 0;
        const hasChanges = hasPersonalChanges || hasEditChanges || (collabMode === 'draft' && (draftCount || 0) > 0);
        return (
          <>
            <Box
              onClick={(e) => setCollabAnchorEl(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1, py: 0.25, borderRadius: '12px', ml: 0.5, cursor: 'pointer',
                bgcolor: alpha(mc, 0.12),
                border: `1.5px solid ${alpha(mc, 0.5)}`,
                '&:hover': { bgcolor: alpha(mc, 0.2) },
                transition: 'background-color 0.15s',
              }}
            >
              {/* Pulsing dot for Session mode */}
              <Box sx={{
                width: 7, height: 7, borderRadius: '50%', bgcolor: mc, flexShrink: 0,
                ...(collabMode === 'live' ? {
                  animation: 'collabPulse 2s ease-in-out infinite',
                  '@keyframes collabPulse': {
                    '0%,100%': { boxShadow: `0 0 0 0 ${alpha(mc, 0.5)}` },
                    '50%': { boxShadow: `0 0 0 4px ${alpha(mc, 0)}` },
                  },
                } : {}),
              }} />
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: mc, whiteSpace: 'nowrap', userSelect: 'none' }}>
                {ml}
              </Typography>

              {/* Avatar stack for session mode */}
              {(collabMode === 'live' || collabMode === 'edit') && connectedUsers.length > 0 && (
                <Tooltip title={connectedUsers.map(u => u.name).join(', ')}>
                  <Box sx={{ display: 'flex', ml: 0.25 }}>
                    {connectedUsers.slice(0, 3).map((u, i) => (
                      <Box key={u.id} sx={{
                        width: 20, height: 20, borderRadius: '50%', bgcolor: u.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6rem', fontWeight: 700, color: '#fff',
                        border: `1.5px solid ${isDark ? '#1e1e1e' : '#fff'}`,
                        ml: i > 0 ? '-6px' : 0, zIndex: 3 - i,
                      }}>
                        {(u.name || '?')[0].toUpperCase()}
                      </Box>
                    ))}
                    {connectedUsers.length > 3 && (
                      <Box sx={{
                        width: 20, height: 20, borderRadius: '50%',
                        bgcolor: isDark ? '#555' : '#bbb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.55rem', fontWeight: 700, color: '#fff',
                        border: `1.5px solid ${isDark ? '#1e1e1e' : '#fff'}`,
                        ml: '-6px', zIndex: 0,
                      }}>
                        +{connectedUsers.length - 3}
                      </Box>
                    )}
                  </Box>
                </Tooltip>
              )}

              {/* Apply/Discard buttons — only when there are actual changes */}
              {hasChanges && (
                <>
                  <Tooltip title={collabMode === 'personal' ? 'Publish changes' : 'Apply changes'}>
                    <IconButton size="small" onClick={(e) => {
                      e.stopPropagation();
                      if (collabMode === 'personal') onPublishPersonal?.();
                      else onApplyDrafts?.();
                    }} sx={{ p: 0.3, color: '#4caf50' }}>
                      <CheckIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Discard changes">
                    <IconButton size="small" onClick={(e) => {
                      e.stopPropagation();
                      if (collabMode === 'personal') onDiscardPersonal?.();
                      else onDiscardDrafts?.();
                    }} sx={{ p: 0.3, color: '#f44336' }}>
                      <CloseIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>

            {/* Mode selector dropdown */}
            <Popover
              open={Boolean(collabAnchorEl)}
              anchorEl={collabAnchorEl}
              onClose={() => setCollabAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              slotProps={{ paper: { sx: {
                mt: 0.5, borderRadius: '10px', minWidth: 220,
                bgcolor: isDark ? '#2a2a2a' : '#fff',
                border: `1px solid ${theme.palette.divider}`,
              }}}}
            >
              {(['personal', 'edit', 'live'] as const).map((mode) => {
                const colors: Record<string, string> = { personal: '#2196f3', live: '#4caf50', edit: '#ff9800' };
                const labels: Record<string, string> = { personal: 'Personal', live: 'Live', edit: 'Edit' };
                const descs: Record<string, string> = {
                  personal: 'View only — browse markups without editing',
                  live: 'Collaborate — create markups visible to all',
                  edit: 'Exclusive edit — full control, locks for others',
                };
                const isLocked = mode === 'edit' && !!editLockUser;
                const c = colors[mode];
                const isActive = collabMode === mode;
                return (
                  <Box
                    key={mode}
                    onClick={() => {
                      if (isLocked) return; // can't select if locked by another user
                      onCollabModeChange(mode);
                      setCollabAnchorEl(null);
                    }}
                    sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1, px: 1.5, py: 1,
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      opacity: isLocked ? 0.5 : 1,
                      bgcolor: isActive ? alpha(c, 0.1) : 'transparent',
                      '&:hover': { bgcolor: isLocked ? 'transparent' : alpha(c, 0.08) },
                      borderLeft: isActive ? `3px solid ${c}` : '3px solid transparent',
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c, mt: 0.7, flexShrink: 0 }} />
                    <Box>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: isActive ? 700 : 500, color: isActive ? c : 'text.primary' }}>
                        {labels[mode]}
                        {isLocked && ` (locked by ${editLockUser!.name})`}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.3 }}>
                        {descs[mode]}
                      </Typography>
                    </Box>
                    {isActive && <CheckIcon sx={{ fontSize: 16, color: c, ml: 'auto', mt: 0.3 }} />}
                  </Box>
                );
              })}
            </Popover>
          </>
        );
      })()}

      {/* Legacy Draft Mode fallback (if collabMode not wired up) */}
      {!onCollabModeChange && onDraftModeToggle && !draftMode && (
        <Tooltip title="Draft Mode — draw markups only visible to you">
          <IconButton size="small" sx={btnSx} onClick={onDraftModeToggle}>
            <EditNoteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {!onCollabModeChange && draftMode && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          px: 1, py: 0.25, borderRadius: '12px', ml: 0.5,
          bgcolor: alpha('#ff9800', 0.12),
          border: `1.5px solid ${alpha('#ff9800', 0.5)}`,
        }}>
          <EditNoteIcon sx={{ fontSize: 16, color: '#ff9800' }} />
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#ff9800', whiteSpace: 'nowrap' }}>
            DRAFT{draftCount > 0 ? ` (${draftCount})` : ''}
          </Typography>
          {onApplyDrafts && draftCount > 0 && (
            <Tooltip title="Apply drafts — save to document">
              <IconButton size="small" onClick={onApplyDrafts} sx={{ p: 0.3, color: '#4caf50' }}>
                <CheckIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
          {onDiscardDrafts && (
            <Tooltip title="Discard drafts">
              <IconButton size="small" onClick={onDiscardDrafts} sx={{ p: 0.3, color: '#f44336' }}>
                <CloseIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {
        <>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ ...dividerSx, mx: 0.75 }}
          />

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
                group.items ? (
                  [
                    <ListSubheader
                      key={`h-${idx}`}
                      sx={{
                        lineHeight: "32px",
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        color: gold,
                        bgcolor: "background.paper",
                      }}
                    >
                      {group.group}
                    </ListSubheader>,
                    ...group.items.map((item) => (
                      <MenuItem
                        key={item.value}
                        value={item.value}
                        sx={{ fontSize: "0.75rem" }}
                      >
                        {item.label}
                      </MenuItem>
                    )),
                  ]
                ) : (
                  <MenuItem
                    key={group.value}
                    value={group.value}
                    sx={{ fontSize: "0.75rem", fontWeight: 700 }}
                  >
                    {group.label}
                  </MenuItem>
                ),
              )}
            </Select>
          </Box>

          {/* Version */}
          {versions.length > 0 && (
            <>
              <Divider
                orientation="vertical"
                flexItem
                sx={{ ...dividerSx, mx: 0.5 }}
              />
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
                    <MenuItem
                      key={v.id}
                      value={v.id}
                      sx={{ fontSize: "0.72rem" }}
                    >
                      V{versions.length - idx} —{" "}
                      {dayjs(v.createdAt).format("MM/DD/YY")}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </>
          )}
        </>
      }
    </Box>
  );

  return (
    <>
      <Box
        sx={{
          bgcolor: "background.paper",
          borderBottom: draftMode
            ? `2px solid ${alpha('#ff9800', 0.5)}`
            : `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
          boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {isMD ? (
          /* ── TWO ROWS (≤1920px): Row 1 nav+select+actions, Row 2 drawing tools ── */
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 42, px: '6px', gap: 0.5 }}>
              {navigationContent}
              {/* Select/Pan/TextSelect in Row 1 */}
              <Box sx={pillSx}>
                <Tooltip title="Select (V)">
                  <IconButton size="small" sx={tool === "select" ? activeBtnSx : btnSx} onClick={() => onToolChange("select")}>
                    <AdsClickIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {isToolVisible('pan') && (
                  <Tooltip title="Pan (Space)">
                    <IconButton size="small" sx={tool === "pan" ? activeBtnSx : btnSx} onClick={() => onToolChange("pan")}>
                      <PanToolIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isToolVisible('textSelect') && (
                  <Tooltip title="Text Select">
                    <IconButton size="small" sx={tool === "textSelect" ? activeBtnSx : btnSx} onClick={() => onToolChange("textSelect")}>
                      <AbcIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Box sx={{ flex: 1 }} />
              {actionsContent}
            </Box>
            {canMarkup && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: '6px', py: '2px', minHeight: 36,
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                overflowX: 'auto', overflowY: 'hidden',
                scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
                '& > *': { flexShrink: 0 },
              }}>
                {drawingToolsPill}
                {colorWidthStyleContent}
                {routeStampsElectricalPill}
                {/* Properties toggle — rightmost in Row 2 */}
                {onToggleProperties && (
                  <Box sx={{ ml: 'auto' }}>
                    <Tooltip title={propertiesHidden ? "Show properties" : "Hide properties"}>
                      <IconButton size="small" sx={propertiesHidden ? btnSx : activeBtnSx} onClick={onToggleProperties}>
                        <EditNoteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            )}
          </>
        ) : (
          /* ── ONE ROW (>1400px): everything inline ── */
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              minHeight: 44,
              px: "6px",
              gap: 0.5,
            }}
          >
            {navigationContent}
            {canMarkup && (
              <>
                <Box sx={pillSx}>
                  <Tooltip title="Select (V)">
                    <IconButton
                      size="small"
                      sx={tool === "select" ? activeBtnSx : btnSx}
                      onClick={() => onToolChange("select")}
                    >
                      <AdsClickIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {isToolVisible("pan") && (
                    <Tooltip title="Pan (Space)">
                      <IconButton
                        size="small"
                        sx={tool === "pan" ? activeBtnSx : btnSx}
                        onClick={() => onToolChange("pan")}
                      >
                        <PanToolIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {isToolVisible("textSelect") && (
                    <Tooltip title="Text Select">
                      <IconButton
                        size="small"
                        sx={tool === "textSelect" ? activeBtnSx : btnSx}
                        onClick={() => onToolChange("textSelect")}
                      >
                        <AbcIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                {drawingToolsPill}
                {colorWidthStyleContent}
                {routeStampsElectricalPill}
              </>
            )}
            <Box sx={{ flex: 1 }} />
            {actionsContent}
          </Box>
        )}
      </Box>

      {/* Color Popover (always rendered, used by both layouts) */}
      <Popover
        disableScrollLock
        open={Boolean(colorAnchor)}
        anchorEl={colorAnchor}
        onClose={() => setColorAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        PaperProps={{
          sx: {
            p: 1.5,
            borderRadius: "14px",
            border: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            width: 214,
          },
        }}
      >
        <Typography
          sx={{
            fontSize: "0.6rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "text.disabled",
            mb: 1,
          }}
        >
          Color
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={0.75} mb={1.25}>
          {[
            "#d32f2f",
            "#f57c00",
            "#f9a825",
            "#388e3c",
            "#1976d2",
            "#7b1fa2",
            "#546e7a",
            "#000000",
            "#ffffff",
            "#795548",
          ].map((c) => (
            <Box
              key={c}
              onClick={() => {
                onColorChange(c);
                setLocalColor(c);
                setColorAnchor(null);
              }}
              sx={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                bgcolor: c,
                cursor: "pointer",
                flexShrink: 0,
                border:
                  activeColor === c
                    ? `2.5px solid ${isDark ? "#fff" : "#333"}`
                    : `1.5px solid ${alpha(isDark ? "#fff" : "#000", 0.12)}`,
                outline:
                  activeColor === c ? `2px solid ${alpha(c, 0.6)}` : "none",
                transition: "transform 0.1s",
                "&:hover": { transform: "scale(1.18)" },
              }}
            />
          ))}
          <Box
            sx={{
              position: "relative",
              width: 22,
              height: 22,
              borderRadius: "50%",
              overflow: "hidden",
              border: `1.5px dashed ${alpha(theme.palette.text.secondary, 0.35)}`,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                width: "100%",
                height: "100%",
                background:
                  "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)",
              }}
            />
            <input
              type="color"
              value={localColor}
              onChange={(e) => {
                setLocalColor(e.target.value);
                onColorChange(e.target.value);
              }}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: "pointer",
                width: "100%",
                height: "100%",
              }}
            />
          </Box>
        </Box>
        <Box
          sx={{
            height: 22,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            px: 1,
            bgcolor: alpha(theme.palette.text.primary, 0.04),
          }}
        >
          <svg width="100%" height="14" style={{ overflow: "visible" }}>
            <line
              x1="4"
              y1="7"
              x2="calc(100% - 4px)"
              y2="7"
              stroke={activeColor}
              strokeWidth={1.2 + (activeStrokeWidth / 50) * 4.8}
              strokeDasharray={
                LINE_STYLES.find((s) => s.key === activeLineStyle)
                  ?.dash.map((d) => d / 2.5)
                  .join(",") || undefined
              }
              strokeLinecap="round"
            />
          </svg>
        </Box>
      </Popover>

      {/* Width Popover */}
      <Popover
        disableScrollLock
        open={Boolean(widthAnchor)}
        anchorEl={widthAnchor}
        onClose={() => setWidthAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        PaperProps={{
          sx: {
            p: 1.5,
            borderRadius: "14px",
            border: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            width: 220,
          },
        }}
      >
        <Typography
          sx={{
            fontSize: "0.6rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "text.disabled",
            mb: 1,
          }}
        >
          Stroke Width
        </Typography>
        <Box
          sx={{ px: 1, pt: 4, pb: 1, width: "100%", boxSizing: "border-box" }}
        >
          <Slider
            value={activeStrokeWidth}
            onChange={(_, v) => onStrokeWidthChange(v as number)}
            min={1}
            max={50}
            valueLabelDisplay="on"
            valueLabelFormat={(v) => `${v}`}
            sx={{
              color: gold,
              "& .MuiSlider-thumb": {
                width: 16,
                height: 16,
                "&:hover, &.Mui-focusVisible": {
                  boxShadow: `0px 0px 0px 8px ${alpha(gold, 0.16)}`,
                },
              },
              "& .MuiSlider-valueLabel": {
                fontSize: "0.65rem",
                fontWeight: 700,
                color: "background.paper",
                bgcolor: "text.primary",
                borderRadius: "4px",
                p: 0.25,
              },
            }}
          />
        </Box>
        <Box
          sx={{
            height: 28,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            px: 1,
            bgcolor: alpha(theme.palette.text.primary, 0.04),
          }}
        >
          <svg width="100%" height="28" style={{ overflow: "visible" }}>
            <line
              x1="4"
              y1="14"
              x2="calc(100% - 4px)"
              y2="14"
              stroke={activeColor}
              strokeWidth={Math.max(1, Math.min(activeStrokeWidth, 20))}
              strokeDasharray={
                LINE_STYLES.find((s) => s.key === activeLineStyle)
                  ?.dash.map((d) => d / 2.5)
                  .join(",") || undefined
              }
              strokeLinecap="round"
            />
          </svg>
        </Box>
      </Popover>

      {/* Style Popover */}
      <Popover
        disableScrollLock
        open={Boolean(styleAnchor)}
        anchorEl={styleAnchor}
        onClose={() => setStyleAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        PaperProps={{
          sx: {
            p: 1.5,
            borderRadius: "14px",
            border: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            width: 284,
          },
        }}
      >
        <Typography
          sx={{
            fontSize: "0.6rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "text.disabled",
            mb: 1,
          }}
        >
          Line Style
        </Typography>
        <Box display="grid" gridTemplateColumns="1fr" gap={0.75}>
          {LINE_STYLES.map(({ key, label, dash }) => {
            const active = activeLineStyle === key;
            const dashAttr =
              dash.length > 0 ? dash.map((d) => d / 2.5).join(",") : undefined;
            return (
              <Box
                key={key}
                onClick={() => {
                  onLineStyleChange(key);
                  setStyleAnchor(null);
                }}
                sx={{
                  height: 32,
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  px: 2,
                  bgcolor: active
                    ? alpha(gold, 0.13)
                    : alpha(theme.palette.text.primary, 0.04),
                  border: `1.5px solid ${active ? alpha(gold, 0.6) : "transparent"}`,
                  transition: "all 0.12s",
                  "&:hover": { bgcolor: alpha(gold, 0.08) },
                }}
              >
                <svg
                  width="100%"
                  height="10"
                  style={{ overflow: "visible", flexShrink: 0 }}
                >
                  <line
                    x1="0"
                    y1="5"
                    x2="100%"
                    y2="5"
                    stroke={active ? gold : isDark ? "#aaa" : "#555"}
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeDasharray={dashAttr}
                  />
                </svg>
              </Box>
            );
          })}
        </Box>
      </Popover>

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
          <MenuItem
            onClick={() => {
              onScrollModeChange("page");
              setMoreMenuAnchor(null);
            }}
            selected={scrollMode === "page"}
          >
            <ListItemIcon>
              <ArticleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Single Page" />
          </MenuItem>
        )}
        {isSM && (
          <MenuItem
            onClick={() => {
              onScrollModeChange("continuous");
              setMoreMenuAnchor(null);
            }}
            selected={scrollMode === "continuous"}
          >
            <ListItemIcon>
              <ViewDayIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Continuous Scroll" />
          </MenuItem>
        )}
        {isSM && <Divider />}

        <ListSubheader
          sx={{
            lineHeight: "32px",
            fontSize: "0.65rem",
            fontWeight: 800,
            color: gold,
            bgcolor: "background.paper",
          }}
        >
          TOOLS
        </ListSubheader>
        {isXS && (
          <MenuItem
            onClick={() => {
              onToolChange("pan");
              setMoreMenuAnchor(null);
            }}
            selected={tool === "pan"}
          >
            <ListItemIcon>
              <PanToolIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Pan" />
          </MenuItem>
        )}
        {canMarkup && isSM && (
          <MenuItem
            onClick={() => {
              onToolChange("line");
              setMoreMenuAnchor(null);
            }}
            selected={tool === "line"}
          >
            <ListItemIcon>
              <TimelineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Line" />
          </MenuItem>
        )}
        {canMarkup && isSM && (
          <MenuItem
            onClick={() => {
              onToolChange("arrow");
              setMoreMenuAnchor(null);
            }}
            selected={tool === "arrow"}
          >
            <ListItemIcon>
              <EastIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Arrow" />
          </MenuItem>
        )}
        {canMarkup &&
          isSM &&
          SHAPE_TOOLS.map((s) => (
            <MenuItem
              key={s.key}
              onClick={() => {
                onToolChange(s.key);
                setMoreMenuAnchor(null);
              }}
              selected={tool === s.key}
            >
              <ListItemIcon>{s.icon}</ListItemIcon>
              <ListItemText primary={s.label} />
            </MenuItem>
          ))}
        {canMarkup && isMD && (
          <MenuItem
            onClick={() => {
              onToolChange("cloud");
              setMoreMenuAnchor(null);
            }}
            selected={tool === "cloud"}
          >
            <ListItemIcon>
              <CloudQueueIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Cloud" />
          </MenuItem>
        )}
        {canMarkup && isMD && (
          <MenuItem
            onClick={() => {
              onToolChange("text");
              setMoreMenuAnchor(null);
            }}
            selected={tool === "text"}
          >
            <ListItemIcon>
              <TextFormatIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Text" />
          </MenuItem>
        )}
        {canMarkup && isMD && (
          <MenuItem
            onClick={() => {
              onToolChange("callout");
              setMoreMenuAnchor(null);
            }}
            selected={tool === "callout"}
          >
            <ListItemIcon>
              <Box
                sx={{
                  position: "relative",
                  display: "inline-flex",
                  width: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CloudQueueIcon sx={{ fontSize: 18 }} />
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 1,
                    right: -1,
                    fontSize: 10,
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  +
                </Box>
              </Box>
            </ListItemIcon>
            <ListItemText primary="Cloud+" />
          </MenuItem>
        )}
        {canMarkup && isMD && (
          <MenuItem
            onClick={() => {
              onToolChange("measure");
              setMoreMenuAnchor(null);
            }}
            selected={tool === "measure"}
          >
            <ListItemIcon>
              <StraightenIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Measure" />
          </MenuItem>
        )}

        {/* Review Stamps in More Menu */}
        {canMarkup &&
          onAddReviewStamp &&
          (isMD || !isToolVisible("stamps")) && (
            <>
              <Divider />
              <ListSubheader
                sx={{
                  lineHeight: "32px",
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  color: gold,
                  bgcolor: "background.paper",
                }}
              >
                REVIEW STAMPS
              </ListSubheader>
              {REVIEW_STAMPS.map((s) => (
                <MenuItem
                  key={s.id}
                  onClick={() => {
                    onAddReviewStamp(s);
                    setMoreMenuAnchor(null);
                  }}
                >
                  <ListItemIcon>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: s.color,
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={s.label}
                    secondary={s.category}
                    secondaryTypographyProps={{ sx: { fontSize: "0.65rem" } }}
                  />
                </MenuItem>
              ))}
            </>
          )}

        {canMarkup && isSM && (
          <>
            <Divider />
            <ListSubheader
              sx={{
                lineHeight: "32px",
                fontSize: "0.65rem",
                fontWeight: 800,
                color: gold,
                bgcolor: "background.paper",
              }}
            >
              PROPERTIES
            </ListSubheader>
            <Box p={1.5} pt={2.5}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: "text.disabled",
                  display: "block",
                  mb: 1,
                  textTransform: "uppercase",
                  fontSize: "0.6rem",
                  letterSpacing: "0.07em",
                }}
              >
                Width
              </Typography>
              <Box
                sx={{ px: 1, pb: 2, width: "100%", boxSizing: "border-box" }}
              >
                <Slider
                  value={activeStrokeWidth}
                  onChange={(_, v) => onStrokeWidthChange(v as number)}
                  min={1}
                  max={50}
                  valueLabelDisplay="on"
                  valueLabelFormat={(v) => `${v}`}
                  sx={{
                    color: gold,
                    "& .MuiSlider-thumb": { width: 16, height: 16 },
                    "& .MuiSlider-valueLabel": {
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: "background.paper",
                      bgcolor: "text.primary",
                      borderRadius: "4px",
                      p: 0.25,
                    },
                  }}
                />
              </Box>
              <Box
                sx={{
                  height: 28,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  px: 1,
                  bgcolor: alpha(theme.palette.text.primary, 0.04),
                }}
              >
                <svg width="100%" height="28" style={{ overflow: "visible" }}>
                  <line
                    x1="4"
                    y1="14"
                    x2="calc(100% - 4px)"
                    y2="14"
                    stroke={activeColor}
                    strokeWidth={Math.max(1, Math.min(activeStrokeWidth, 20))}
                    strokeDasharray={
                      LINE_STYLES.find((s) => s.key === activeLineStyle)
                        ?.dash.map((d) => d / 2.5)
                        .join(",") || undefined
                    }
                    strokeLinecap="round"
                  />
                </svg>
              </Box>
            </Box>
            <Box px={1.5} pb={1}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: "text.disabled",
                  display: "block",
                  mb: 0.75,
                  textTransform: "uppercase",
                  fontSize: "0.6rem",
                  letterSpacing: "0.07em",
                }}
              >
                Line Style
              </Typography>
              <Box display="grid" gridTemplateColumns="1fr" gap={0.5}>
                {LINE_STYLES.map(({ key, label, dash }) => {
                  const active = activeLineStyle === key;
                  const dashAttr =
                    dash.length > 0
                      ? dash.map((d) => d / 2.5).join(",")
                      : undefined;
                  return (
                    <Box
                      key={key}
                      onClick={() => onLineStyleChange(key)}
                      sx={{
                        height: 32,
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        px: 2,
                        bgcolor: active
                          ? alpha(gold, 0.13)
                          : alpha(theme.palette.text.primary, 0.04),
                        border: `1.5px solid ${active ? alpha(gold, 0.6) : "transparent"}`,
                      }}
                    >
                      <svg
                        width="100%"
                        height="10"
                        style={{ overflow: "visible", flexShrink: 0 }}
                      >
                        <line
                          x1="0"
                          y1="5"
                          x2="100%"
                          y2="5"
                          stroke={active ? gold : isDark ? "#aaa" : "#555"}
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeDasharray={dashAttr}
                        />
                      </svg>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </>
        )}

        {isBottomBarVisible &&
          (onDownloadClean ||
            onExportPdf ||
            (versions && versions.length > 0)) && <Divider />}
        {isBottomBarVisible &&
          (onDownloadClean ||
            onExportPdf ||
            (versions && versions.length > 0)) && (
            <ListSubheader
              sx={{
                lineHeight: "32px",
                fontSize: "0.65rem",
                fontWeight: 800,
                color: gold,
                bgcolor: "background.paper",
              }}
            >
              FILE
            </ListSubheader>
          )}
        {isBottomBarVisible && onDownloadClean && (
          <MenuItem
            onClick={() => {
              onDownloadClean();
              setMoreMenuAnchor(null);
            }}
          >
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Download PDF" />
          </MenuItem>
        )}
        {isBottomBarVisible && onExportPdf && (
          <MenuItem
            onClick={() => {
              if (!isExporting) {
                onExportPdf();
                setMoreMenuAnchor(null);
              }
            }}
            disabled={isExporting}
          >
            <ListItemIcon>
              <LayersIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Export with markups" />
          </MenuItem>
        )}
        {isBottomBarVisible && versions && versions.length > 0 && <Divider />}
        {isBottomBarVisible && versions && versions.length > 0 && (
          <ListSubheader
            sx={{
              lineHeight: "32px",
              fontSize: "0.65rem",
              fontWeight: 800,
              color: gold,
              bgcolor: "background.paper",
            }}
          >
            VERSION
          </ListSubheader>
        )}
        {isBottomBarVisible &&
          versions &&
          versions.length > 0 &&
          versions.map((ver: any, idx: number) => (
            <MenuItem
              key={ver.id}
              selected={currentDocId === ver.id}
              onClick={() => {
                onVersionChange?.(ver.id);
                setMoreMenuAnchor(null);
              }}
            >
              <ListItemText
                primary={`V${versions.length - idx} — ${new Date(ver.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
              />
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
            onClick={() => {
              onToolChange(s.key);
              setShapeMenuAnchor(null);
            }}
          >
            <ListItemIcon>{s.icon}</ListItemIcon>
            <ListItemText primary={s.label} />
          </MenuItem>
        ))}
      </Menu>

      {/* Toolbar customization popover */}
      <Popover
        disableScrollLock
        open={customizeOpen}
        anchorEl={customizeAnchor}
        onClose={() => setCustomizeOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            mt: 0.5,
            p: 2,
            minWidth: 240,
            borderRadius: "12px",
            border: 1,
            borderColor: "divider",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            bgcolor: "background.paper",
          },
        }}
      >
        <Typography
          sx={{
            fontSize: "0.7rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "text.secondary",
            mb: 1.5,
          }}
        >
          Customize Toolbar
        </Typography>
        {[
          {
            id: "pan",
            label: "Pan",
            icon: <PanToolIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "textSelect",
            label: "Text Select",
            icon: <AbcIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "pen",
            label: "Pen",
            icon: <CreateIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "highlighter",
            label: "Highlighter",
            icon: <HighlightIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "line",
            label: "Line",
            icon: <TimelineIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "arrow",
            label: "Arrow",
            icon: <EastIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "shapes",
            label: "Shapes",
            icon: <RectangleIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "cloud",
            label: "Cloud",
            icon: <CloudQueueIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "text",
            label: "Text",
            icon: <TextFormatIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "callout",
            label: "Callout",
            icon: <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "measure",
            label: "Measure",
            icon: <StraightenIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "polyline",
            label: "Polyline",
            icon: <PolylineIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "routeTemplate",
            label: "Route Template",
            icon: <RouteIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "image",
            label: "Image",
            icon: <ImageOutlinedIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "stamps",
            label: "Review Stamps",
            icon: <PlaylistAddCheckIcon sx={{ fontSize: 16 }} />,
          },
          {
            id: "electrical",
            label: "Electrical",
            icon: <ElectricalServicesIcon sx={{ fontSize: 16 }} />,
          },
        ].map((item) => {
          const visible = isToolVisible(item.id);
          return (
            <Box
              key={item.id}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              py={0.35}
              sx={{ opacity: visible ? 1 : 0.5 }}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <Box
                  sx={{
                    color: visible ? gold : "text.disabled",
                    display: "flex",
                    width: 20,
                  }}
                >
                  {item.icon}
                </Box>
                <Typography sx={{ fontSize: "0.8rem" }}>
                  {item.label}
                </Typography>
              </Box>
              <Box
                onClick={() => toggleToolVisibility(item.id)}
                sx={{
                  width: 36,
                  height: 20,
                  borderRadius: "10px",
                  bgcolor: visible
                    ? gold
                    : alpha(theme.palette.text.secondary, 0.2),
                  cursor: "pointer",
                  position: "relative",
                  transition: "background-color 0.2s",
                  flexShrink: 0,
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: "2px",
                    left: visible ? "18px" : "2px",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    bgcolor: "white",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    transition: "left 0.2s cubic-bezier(0.4,0,0.2,1)",
                  }}
                />
              </Box>
            </Box>
          );
        })}
        <Divider sx={{ my: 1 }} />
        <Typography
          onClick={() => {
            setHiddenTools([]);
            localStorage.removeItem("pdfToolbarHidden");
          }}
          sx={{
            fontSize: "0.72rem",
            color: gold,
            cursor: "pointer",
            textAlign: "center",
            fontWeight: 600,
            "&:hover": { opacity: 0.8 },
          }}
        >
          Reset to defaults
        </Typography>
      </Popover>

      {/* Review Stamps + Electrical Elements Popover */}
      <Popover
        disableScrollLock
        open={Boolean(stampMenuAnchor)}
        anchorEl={stampMenuAnchor}
        onClose={() => setStampMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        PaperProps={{
          sx: {
            p: 0,
            borderRadius: "12px",
            border: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            width: 280,
            maxHeight: "75vh",
            overflowY: "auto",
            "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "rgba(128,128,128,0.2)",
              borderRadius: 4,
            },
          },
        }}
      >
        {["Favorites", "Status", "Issues", "Notes"].map((cat) => {
          const stamps = REVIEW_STAMPS.filter((s) => s.category === cat);
          if (stamps.length === 0) return null;
          return (
            <Box key={cat}>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.6,
                  bgcolor: isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.02)",
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    color: alpha(gold, 0.7),
                  }}
                >
                  {cat}
                </Typography>
              </Box>
              <Box sx={{ px: 0.5, py: 0.5 }}>
                {stamps.map((s) => {
                  const shape = s.customProps?.stampShape || "rounded";
                  const hasFill = s.customProps?.stampFill !== false;
                  const iconBorderRadius =
                    shape === "circle"
                      ? "50%"
                      : shape === "rounded"
                        ? "6px"
                        : shape === "diamond"
                          ? "2px"
                          : "2px";
                  const iconTransform =
                    shape === "diamond"
                      ? "rotate(45deg) scale(0.75)"
                      : shape === "triangle"
                        ? ""
                        : "";
                  return (
                    <Box
                      key={s.id}
                      onClick={() => {
                        onAddReviewStamp?.(s);
                        setStampMenuAnchor(null);
                      }}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 1,
                        py: 0.5,
                        borderRadius: "6px",
                        cursor: "pointer",
                        "&:hover": { bgcolor: alpha(s.color, 0.1) },
                        transition: "background 0.1s",
                      }}
                    >
                      {/* Shape icon with symbol */}
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: iconBorderRadius,
                          border: `2px solid ${s.color}`,
                          bgcolor: hasFill ? s.color : "transparent",
                          color: hasFill ? "#fff" : s.color,
                          fontSize: "0.75rem",
                          fontWeight: 900,
                          lineHeight: 1,
                          transform: iconTransform || undefined,
                        }}
                      >
                        <span
                          style={{
                            transform: iconTransform
                              ? `rotate(-45deg) scale(${1 / 0.75})`
                              : undefined,
                            fontSize: "0.8rem",
                          }}
                        >
                          {s.icon}
                        </span>
                      </Box>
                      <Typography
                        sx={{ fontSize: "0.8rem", flex: 1, fontWeight: 500 }}
                      >
                        {s.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Popover>

      {/* Electrical Elements Popover */}
      <Popover
        disableScrollLock
        open={Boolean(electricalAnchor)}
        anchorEl={electricalAnchor}
        onClose={() => setElectricalAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        PaperProps={{
          sx: {
            p: 0,
            borderRadius: "12px",
            border: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            width: 280,
            maxHeight: "75vh",
            overflowY: "auto",
            "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "rgba(128,128,128,0.2)",
              borderRadius: 4,
            },
          },
        }}
      >
        {/* Conduit */}
        {(() => {
          const conduits = [
            { id: "c-3/4", label: '3/4"', sw: 1, ih: 1.25 },
            { id: "c-1", label: '1"', sw: 2, ih: 1.5 },
            { id: "c-1.25", label: '1-1/4"', sw: 2, ih: 2 },
            { id: "c-1.5", label: '1-1/2"', sw: 3, ih: 2.5 },
            { id: "c-2", label: '2"', sw: 3, ih: 3 },
            { id: "c-2.5", label: '2-1/2"', sw: 4, ih: 3.5 },
            { id: "c-3", label: '3"', sw: 5, ih: 4 },
            { id: "c-4", label: '4"', sw: 6, ih: 5 },
            { id: "c-6", label: '6"', sw: 8, ih: 6 },
          ];
          return (
            <Box>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.6,
                  bgcolor: isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.02)",
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    color: alpha(gold, 0.7),
                  }}
                >
                  Conduit
                </Typography>
              </Box>
              <Box sx={{ px: 0.5, py: 0.5 }}>
                {conduits.map((c) => (
                  <Box
                    key={c.id}
                    onClick={() => {
                      onElectricalSelect?.({
                        tool: "polyline",
                        defaultText: c.label.replace(" Conduit", ""),
                        size: 0,
                        customProps: {
                          conduitSize: c.label.replace(" Conduit", ""),
                          redlineLabel: c.label.replace(" Conduit", ""),
                        },
                        color: "#1565c0",
                        strokeWidth: c.sw,
                        subject: `Conduit ${c.label.replace(" Conduit", "")}`,
                      });
                      setElectricalAnchor(null);
                    }}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      px: 1,
                      py: 0.4,
                      borderRadius: "6px",
                      cursor: "pointer",
                      "&:hover": { bgcolor: alpha("#1565c0", 0.1) },
                    }}
                  >
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1.5px solid #1565c0",
                        borderRadius: "3px",
                        bgcolor: alpha("#1565c0", 0.05),
                      }}
                    >
                      <Box
                        sx={{ width: 14, height: c.ih, bgcolor: "#1565c0" }}
                      />
                    </Box>
                    <Typography
                      sx={{ fontSize: "0.8rem", flex: 1, fontWeight: 500 }}
                    >
                      {c.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.6rem",
                        color: "text.disabled",
                        fontFamily: "monospace",
                      }}
                    >
                      {c.sw}px
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })()}

        {/* Boxes — simplified: JB, PB, Custom */}
        <Box>
          <Box
            sx={{
              px: 1.5,
              py: 0.6,
              bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.6rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: alpha(gold, 0.7),
              }}
            >
              Boxes
            </Typography>
          </Box>
          <Box sx={{ px: 0.5, py: 0.5 }}>
            {[
              {
                id: "jb",
                label: "Junction Box (JB)",
                text: "JB",
                props: { boxType: "JB" },
              },
              {
                id: "pb",
                label: "Pull Box (PB)",
                text: "PB",
                props: { boxType: "PB" },
              },
              {
                id: "custom",
                label: "Custom Box",
                text: "CB",
                props: { boxType: "Custom" },
              },
            ].map((item) => (
              <Box
                key={item.id}
                onClick={() => {
                  onElectricalSelect?.({
                    tool: "electricalBox",
                    defaultText: item.text,
                    size: 0.03,
                    customProps: item.props,
                    color: "#f9a825",
                    subject: item.label,
                  });
                  setElectricalAnchor(null);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1,
                  py: 0.5,
                  borderRadius: "6px",
                  cursor: "pointer",
                  "&:hover": { bgcolor: alpha("#f9a825", 0.1) },
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "3px",
                    border: "1.5px solid #f9a825",
                    bgcolor: alpha("#f9a825", 0.08),
                    fontSize: "0.55rem",
                    fontWeight: 800,
                    color: "#f9a825",
                  }}
                >
                  {item.text || "?"}
                </Box>
                <Typography
                  sx={{ fontSize: "0.8rem", flex: 1, fontWeight: 500 }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Stubs */}
        <Box>
          <Box
            sx={{
              px: 1.5,
              py: 0.6,
              bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.6rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: alpha(gold, 0.7),
              }}
            >
              Stubs
            </Typography>
          </Box>
          <Box sx={{ px: 0.5, py: 0.5 }}>
            {[
              {
                id: "stub-up",
                label: "Stub Up",
                text: "SU",
                dir: "up",
                color: "#757575",
              },
              {
                id: "stub-down",
                label: "Stub Down",
                text: "SD",
                dir: "down",
                color: "#424242",
              },
            ].map((item) => (
              <Box
                key={item.id}
                onClick={() => {
                  onElectricalSelect?.({
                    tool: "stub",
                    defaultText: item.text,
                    size: 0.018,
                    customProps: { stubDirection: item.dir },
                    color: item.color,
                    subject: item.label,
                  });
                  setElectricalAnchor(null);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1,
                  py: 0.5,
                  borderRadius: "6px",
                  cursor: "pointer",
                  "&:hover": { bgcolor: alpha(item.color, 0.1) },
                  transition: "background 0.1s",
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    border: `1.5px solid ${item.color}`,
                    bgcolor: alpha(item.color, 0.08),
                    fontSize: "0.5rem",
                    fontWeight: 800,
                    color: item.color,
                  }}
                >
                  {item.text}
                </Box>
                <Typography
                  sx={{ fontSize: "0.8rem", flex: 1, fontWeight: 500 }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Supports */}
        <Box>
          <Box
            sx={{
              px: 1.5,
              py: 0.6,
              bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.6rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: alpha(gold, 0.7),
              }}
            >
              Supports
            </Typography>
          </Box>
          <Box sx={{ px: 0.5, py: 0.5 }}>
            {[
              {
                id: "sup-trap",
                label: "Trapeze",
                text: "TRAP",
                props: {
                  supportType: "Trapeze",
                  supportShape: "trapeze",
                  fontSize: 3,
                },
                size: 0.04,
              },
              {
                id: "sup-uni",
                label: "Unistrut",
                text: "UNI",
                props: {
                  supportType: "Unistrut",
                  supportShape: "unistrut",
                  fontSize: 3,
                },
                size: 0.04,
              },
              {
                id: "sup-hgr",
                label: "Hanger",
                text: "HGR",
                props: { supportType: "Hanger", supportShape: "hanger" },
                size: 0.012,
              },
            ].map((item) => (
              <Box
                key={item.id}
                onClick={() => {
                  onElectricalSelect?.({
                    tool: "electricalBox",
                    defaultText: item.text,
                    size: item.size,
                    customProps: item.props,
                    color: "#ff8f00",
                    subject: item.label,
                  });
                  setElectricalAnchor(null);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1,
                  py: 0.5,
                  borderRadius: "6px",
                  cursor: "pointer",
                  "&:hover": { bgcolor: alpha("#ff8f00", 0.1) },
                  transition: "background 0.1s",
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "3px",
                    border: "1.5px solid #ff8f00",
                    bgcolor: alpha("#ff8f00", 0.08),
                    fontSize: "0.4rem",
                    fontWeight: 800,
                    color: "#ff8f00",
                  }}
                >
                  {item.text}
                </Box>
                <Typography
                  sx={{ fontSize: "0.8rem", flex: 1, fontWeight: 500 }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Equipment */}
        <Box>
          <Box
            sx={{
              px: 1.5,
              py: 0.6,
              bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.6rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: alpha(gold, 0.7),
              }}
            >
              Equipment
            </Typography>
          </Box>
          <Box sx={{ px: 0.5, py: 0.5 }}>
            {[
              {
                id: "eq-panel",
                label: "Panel",
                text: "PANEL",
                size: 0.05,
                props: { equipType: "Panel" },
              },
              {
                id: "eq-disconnect",
                label: "Disconnect",
                text: "DISC",
                size: 0.04,
                props: { equipType: "Disconnect" },
              },
              {
                id: "eq-xfmr",
                label: "Transformer",
                text: "XFMR",
                size: 0.04,
                props: { equipType: "Transformer" },
              },
              {
                id: "eq-motor",
                label: "Motor",
                text: "M",
                size: 0.03,
                props: { equipType: "Motor" },
              },
            ].map((item) => (
              <Box
                key={item.id}
                onClick={() => {
                  onElectricalSelect?.({
                    tool: "panel",
                    defaultText: item.text,
                    size: item.size,
                    customProps: item.props,
                    color: "#d32f2f",
                    strokeWidth: item.id === "eq-panel" ? 3 : 2,
                    subject: item.label,
                  });
                  setElectricalAnchor(null);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1,
                  py: 0.5,
                  borderRadius: "6px",
                  cursor: "pointer",
                  "&:hover": { bgcolor: alpha("#d32f2f", 0.1) },
                  transition: "background 0.1s",
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "3px",
                    border: "2px solid #d32f2f",
                    bgcolor: alpha("#d32f2f", 0.08),
                    fontSize: item.text.length > 2 ? "0.4rem" : "0.5rem",
                    fontWeight: 800,
                    color: "#d32f2f",
                  }}
                >
                  {item.text}
                </Box>
                <Typography
                  sx={{ fontSize: "0.8rem", flex: 1, fontWeight: 500 }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Wire Tags */}
        <Box>
          <Box
            sx={{
              px: 1.5,
              py: 0.6,
              bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.6rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: alpha(gold, 0.7),
              }}
            >
              Tags
            </Typography>
          </Box>
          <Box sx={{ px: 0.5, py: 0.5 }}>
            {[
              {
                id: "wire-tag",
                label: "Wire Tag",
                tool: "wireTag" as DrawTool,
                defaultText: "#12 AWG",
                color: "#ff6f00",
                icon: "\u26A1",
                customProps: { wireSize: "12 AWG" },
                subject: "Wire Tag",
              },
              {
                id: "home-run",
                label: "Home Run",
                tool: "arrow" as DrawTool,
                defaultText: "HR",
                color: "#ff6f00",
                icon: "\u2192",
                customProps: { tagType: "homerun" },
                subject: "Home Run",
              },
              {
                id: "feeder-tag",
                label: "Feeder Tag",
                tool: "wireTag" as DrawTool,
                defaultText: "FEEDER",
                color: "#d32f2f",
                icon: "F",
                customProps: { tagType: "feeder" },
                subject: "Feeder Tag",
              },
              {
                id: "circuit-label",
                label: "Circuit Label",
                tool: "wireTag" as DrawTool,
                defaultText: "CKT-1",
                color: "#1565c0",
                icon: "#",
                customProps: { tagType: "circuit" },
                subject: "Circuit Label",
              },
            ].map((item) => (
              <Box
                key={item.id}
                onClick={() => {
                  onElectricalSelect?.({
                    tool: item.tool,
                    defaultText: item.defaultText,
                    customProps: item.customProps,
                    color: item.color,
                    subject: item.subject,
                  });
                  setElectricalAnchor(null);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1,
                  py: 0.5,
                  borderRadius: "6px",
                  cursor: "pointer",
                  "&:hover": { bgcolor: alpha(item.color, 0.1) },
                  transition: "background 0.1s",
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "3px",
                    border: `1.5px solid ${item.color}`,
                    bgcolor: alpha(item.color, 0.08),
                    fontSize: item.icon.length > 1 ? "0.45rem" : "0.7rem",
                    fontWeight: 800,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </Box>
                <Typography
                  sx={{ fontSize: "0.8rem", flex: 1, fontWeight: 500 }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Popover>

      {/* ─── Tool Chest Popover — matches Review Stamps style ─── */}
      <Popover
        disableScrollLock
        open={Boolean(toolChestAnchor)}
        anchorEl={toolChestAnchor}
        onClose={() => setToolChestAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        PaperProps={{
          sx: {
            p: 0, borderRadius: "12px", border: 1, borderColor: "divider",
            bgcolor: "background.paper", boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            width: 240, maxHeight: "75vh", overflowY: "auto",
            "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(128,128,128,0.2)", borderRadius: 4 },
          },
        }}
      >
        <Box sx={{ px: 1.5, py: 0.6, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: alpha(gold, 0.7) }}>
            Tool Chest
          </Typography>
        </Box>
        <Box sx={{ px: 0.5, py: 0.5 }}>
          {presets.map((preset) => {
            const displayFields = getPresetDisplayFields(preset);
            const strokeField = displayFields.find((f: any) => f.key === "stroke");
            const mType = getPresetMarkupType(preset);
            const isCustomStamp = mType === 'customStamp';
            const typeIcon = mType && !isCustomStamp ? TOOL_CHEST_TYPE_ICONS[mType] : null;
            // Custom stamps: generate unique initials + color from name
            const rawIconColor = isCustomStamp ? getNameColor(preset.name) : (strokeField?.defaultValue || gold);
            // Guard against 'transparent' or invalid CSS colors that break alpha()
            const iconColor = (!rawIconColor || rawIconColor === 'transparent' || rawIconColor === 'none') ? gold : rawIconColor;
            const initials = isCustomStamp ? getNameInitials(preset.name) : null;
            return (
              <Box key={preset.id}
                onClick={() => { if (onApplyPreset) onApplyPreset(preset); setToolChestAnchor(null); }}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.75,
                  px: 1, py: 0.5, borderRadius: "6px", cursor: "pointer",
                  "&:hover": { bgcolor: alpha(iconColor, 0.1) },
                  transition: "background 0.1s",
                }}
              >
                <Box sx={{
                  width: 24, height: 24, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: isCustomStamp ? "6px" : "6px",
                  border: `2px solid ${iconColor}`,
                  bgcolor: isCustomStamp ? iconColor : "transparent",
                  color: isCustomStamp ? "#fff" : iconColor,
                  fontSize: isCustomStamp ? "0.65rem" : undefined,
                  fontWeight: 900, lineHeight: 1,
                  '& svg': { fontSize: 14 },
                }}>
                  {isCustomStamp ? initials : (typeIcon || <ConstructionIcon sx={{ fontSize: 14 }} />)}
                </Box>
                <Typography noWrap sx={{ fontSize: "0.8rem", flex: 1, fontWeight: 500 }}>
                  {preset.name}
                </Typography>
                {onDeletePreset && (
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDeletePreset(preset.id); }}
                    sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'error.main' }, flexShrink: 0 }}>
                    <CloseIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                )}
              </Box>
            );
          })}
        </Box>
        {presets.length === 0 && (
          <Typography
            sx={{
              fontSize: "0.72rem",
              color: "text.disabled",
              fontStyle: "italic",
              textAlign: "center",
              py: 2,
            }}
          >
            No presets yet. Save one from the Properties panel.
          </Typography>
        )}
      </Popover>

      {/* Compare sub-bar rendered in DocumentViewPage via absolute positioning */}
    </>
  );
});

export default PdfToolbar;
