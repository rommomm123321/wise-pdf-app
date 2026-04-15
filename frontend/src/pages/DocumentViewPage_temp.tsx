import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Box,
  CircularProgress,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Popover,
  List,
  ListItemButton,
  Avatar,
  useMediaQuery,
  IconButton,
  InputBase,
  Select,
  ListSubheader,
  Slider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from "@mui/material";
import Divider from "@mui/material/Divider";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";
import dayjs from "dayjs";
import FlipToFrontIcon from "@mui/icons-material/FlipToFront";
import FlipToBackIcon from "@mui/icons-material/FlipToBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import ArticleIcon from "@mui/icons-material/Article";
import ViewDayIcon from "@mui/icons-material/ViewDay";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DownloadIcon from "@mui/icons-material/Download";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import LayersIcon from "@mui/icons-material/Layers";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import TuneIcon from "@mui/icons-material/Tune";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import PanToolIcon from "@mui/icons-material/PanTool";
import AbcIcon from "@mui/icons-material/Abc";
import CreateIcon from "@mui/icons-material/Create";
import HighlightIcon from "@mui/icons-material/Highlight";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import EastIcon from "@mui/icons-material/East";
import StraightenIcon from "@mui/icons-material/Straighten";
import PolylineIcon from "@mui/icons-material/Polyline";
import RectangleIcon from "@mui/icons-material/Rectangle";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import TextFormatIcon from "@mui/icons-material/TextFormat";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import ChangeHistoryIcon from "@mui/icons-material/ChangeHistory";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useTranslation } from "react-i18next";

// react-pdf
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { apiFetch } from "../lib/api";
import {
  useMarkups,
  useUpdateMarkup,
  useDeleteMarkup,
  useCreateMarkup,
  useAwareness,
  useSetLocalCursor,
  getYjsProvider,
  type Markup,
  type AwarenessUser,
} from "../hooks/useMarkups";
import { useMyProjectPermissions } from "../hooks/usePermissions";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useProjectUsers } from "../hooks/useProjectUsers";
import { useAuth } from "../contexts/AuthContext";

// Components
import NotFoundPage from "./NotFoundPage";
import PdfToolbar, {
  type DrawTool,
  type LineStyle,
  type ReviewStamp,
  type ElectricalConfig,
  STANDARD_SCALES,
  LINE_STYLES,
  LinePreview,
  REVIEW_STAMPS,
} from "../components/pdf/PdfToolbar";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import CompareDialog, {
  type CompareConfig,
} from "../components/pdf/CompareDialog";
// CompareToolbar is now embedded in PdfToolbar (desktop) and mobile toolbar (mobile)
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import RouteIcon from "@mui/icons-material/Route";
import ConstructionIcon from "@mui/icons-material/Construction";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import ElectricalServicesIcon from "@mui/icons-material/ElectricalServices";
import SpellcheckIcon from "@mui/icons-material/Spellcheck";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { downloadComparisonPdf } from "../utils/exportComparisonPdf";
import RouteWizardDialog from "../components/pdf/RouteWizardDialog";
import ReviewPanel from "../components/pdf/ReviewPanel";
import MarkupHistoryPanel from "../components/pdf/MarkupHistoryPanel";
import {
  loadDictionary,
  checkPdfText,
  type SpellError,
} from "../lib/spellCheck";
import {
  generateRoutes,
  buildRoute,
  type GeneratedRoute,
} from "../lib/routingAlgorithm";
import PdfSidebar from "../components/pdf/PdfSidebar";
import MarkupPropertiesPanel, {
  TOOL_CHEST_STYLE_KEYS,
  SIMPLE_PRESET_TYPES,
} from "../components/pdf/MarkupPropertiesPanel";
import MarkupLayer from "../components/pdf/MarkupLayer";
import TileViewer, {
  type TileViewerHandle,
  type DocInfo,
} from "../components/pdf/TileViewer";
import MarkupOverlay from "../components/pdf/MarkupOverlay";
import MarkupViewportCanvas from "../components/pdf/MarkupViewportCanvas";
import VectorSharpenOverlay from "../components/pdf/VectorSharpenOverlay";
import { PdfErrorBoundary } from "../components/pdf/PdfErrorBoundary";
import MarkupWheel, { type WheelItem } from "../components/pdf/MarkupWheel";
import { exportPdfWithMarkups } from "../utils/exportPdfWithMarkups";
import { exportPdfPixelPerfect } from "../utils/exportPdfPixelPerfect";
import { exportPdfBluebeam } from "../utils/exportPdfBluebeam";
import {
  detectAndParseAnnotations,
  type ImportedMarkup,
} from "../utils/importAnnotationsFromPdf";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useMarkupPresets } from "../hooks/useMarkupPresets";
import { useUserSettings } from "../hooks/useUserSettings";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Worker from CDN matching the exact pdfjs version bundled inside react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Stable options object â€" created once, not on every render
const PDF_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  enableXfa: false,
  disableRange: false,
  disableStream: false,
  disableAutoFetch: false,
} as const;

const SearchHighlightLayer = memo(
  ({
    pageIndex,
    keyword,
    scale,
    pdfDoc,
  }: {
    pageIndex: number;
    keyword: string;
    scale: number;
    pdfDoc: any;
  }) => {
    const [matches, setMatches] = useState<
      { x: number; y: number; w: number; h: number }[]
    >([]);

    useEffect(() => {
      if (!keyword || keyword.length < 2 || !pdfDoc) {
        setMatches([]);
        return;
      }

      const findText = async () => {
        try {
          const page = await pdfDoc.getPage(pageIndex + 1);
          const textContent = await page.getTextContent();
          const viewport = page.getViewport({ scale: 1 });
          const items = textContent.items as any[];

          // Same logic as handleSearch: build fullText with positional gap detection
          let fullText = "";
          const offsets: { start: number; item: any }[] = [];
          for (let j = 0; j < items.length; j++) {
            const item = items[j];
            if (typeof item.str !== "string") continue;
            offsets.push({ start: fullText.length, item });
            fullText += item.str;
            if (item.hasEOL) {
              fullText += "\n";
            } else if (j < items.length - 1 && !fullText.endsWith(" ")) {
              const next = items[j + 1];
              if (next && typeof next.transform?.[4] === "number") {
                const curX = item.transform[4] + (item.width || 0);
                if (next.transform[4] - curX > 1) fullText += " ";
              }
            }
          }

          const normalizedKeyword = keyword.replace(/\s+/g, " ").trim();
          const flexEscaped = normalizedKeyword
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            .replace(/ /g, "\\s+");
          const regex = new RegExp(flexEscaped, "gi");

          const results: any[] = [];
          let match;
          while ((match = regex.exec(fullText)) !== null) {
            let bestItem = offsets[0]?.item;
            for (const o of offsets) {
              if (o.start <= match.index) bestItem = o.item;
              else break;
            }
            if (!bestItem) continue;
            const tx = pdfjs.Util.transform(
              viewport.transform,
              bestItem.transform,
            );
            const itemH =
              bestItem.height || Math.abs(bestItem.transform[0]) || 12;
            results.push({
              x: tx[4],
              y: tx[5] - itemH,
              w: bestItem.width || 50,
              h: itemH,
            });
          }
          setMatches(results);
        } catch (e) {
          console.error(e);
        }
      };
      findText();
    }, [pageIndex, keyword, pdfDoc]);

    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          width: "100%",
          height: "100%",
          zIndex: 4,
        }}
      >
        {matches.map((m, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: m.x * scale,
              top: m.y * scale,
              width: m.w * scale,
              height: m.h * scale,
              backgroundColor: "rgba(66, 133, 244, 0.35)",
              borderRadius: "2px",
              mixBlendMode: "multiply",
            }}
          />
        ))}
      </div>
    );
  },
);

// DPR capped by zoom level: at small zoom high DPR wastes rendering work
// (4x more pixels on Retina at 0.3 zoom that nobody can see)
const getPageDPR = (scale: number) => {
  if (scale < 0.5) return 1;
  if (scale < 1.0) return Math.min(window.devicePixelRatio, 1.5);
  return Math.min(window.devicePixelRatio, 2);
};

const PageContainer = memo(
  ({
    pageIndex,
    pdfWidth,
    pdfHeight,
    scale,
    markups,
    tool,
    activeColor,
    activeStrokeWidth,
    activeLineStyle,
    docScale,
    hiddenLayers,
    selectedMarkupIds,
    handleMarkupAdded,
    handleMarkupSelected,
    handleMarkupModified,
    handleMarkupDeleted,
    handleContextMenu,
    searchKeyword,
    pdfDoc,
    currentUserId,
    isAdmin,
    canMarkup,
    onCanvasMention,
    renderDelay,
    activeSessionId,
  }: any) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // Stagger initial render: page 0 immediate, each subsequent page +30ms
    // Keeps PDF.js worker queue ordered by page proximity to viewport
    const [isClose, setIsClose] = useState(renderDelay === 0);
    const [isNear, setIsNear] = useState(renderDelay === 0);
    // Always keep last-good render as snapshot â€" shown immediately when scale changes
    const snapshotRef = useRef<string | null>(null);
    const [showSnapshot, setShowSnapshot] = useState(false);
    const prevScaleRef = useRef<number>(scale);

    // After each successful render: store canvas as snapshot for next re-render
    const handleRenderSuccess = useCallback(() => {
      const canvas = containerRef.current?.querySelector(
        "canvas",
      ) as HTMLCanvasElement | null;
      if (canvas && canvas.width > 0) {
        try {
          snapshotRef.current = canvas.toDataURL();
        } catch {
          /* tainted canvas */
        }
      }
      setShowSnapshot(false);
    }, []);

    // When scale changes: show stored snapshot instantly to cover the re-render gap
    useEffect(() => {
      if (scale === prevScaleRef.current) return;
      prevScaleRef.current = scale;
      if (snapshotRef.current) setShowSnapshot(true);
    }, [scale]);

    // Stagger render start: unlock rendering after delay so visible pages go first
    useEffect(() => {
      if (renderDelay === 0) return;
      const t = setTimeout(() => {
        setIsClose(true);
        setIsNear(true);
      }, renderDelay);
      return () => clearTimeout(t);
    }, [renderDelay]);

    const W = pdfWidth * scale,
      H = pdfHeight * scale;

    return (
      <Box
        ref={containerRef}
        sx={{
          position: "relative",
          mb: 2,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          display: "inline-block",
          overflow: "visible",
          width: W,
          height: H,
          contain: "layout style",
        }}
      >
        {isClose ? (
          <>
            <Page
              pageNumber={pageIndex + 1}
              scale={scale}
              devicePixelRatio={getPageDPR(scale)}
              renderTextLayer={tool === "textSelect"}
              renderAnnotationLayer={false}
              loading={
                <Box sx={{ width: W, height: H, bgcolor: "grey.100" }} />
              }
              onRenderSuccess={handleRenderSuccess}
            />
            <SearchHighlightLayer
              pageIndex={pageIndex}
              keyword={searchKeyword}
              scale={scale}
              pdfDoc={pdfDoc}
            />
            {/* Snapshot overlay: last-good render shown while PDF.js redraws at new scale */}
            {showSnapshot && snapshotRef.current && (
              <img
                src={snapshotRef.current}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: W,
                  height: H,
                  zIndex: 4,
                  objectFit: "fill",
                  display: "block",
                }}
                alt=""
              />
            )}
          </>
        ) : (
          <Box sx={{ width: W, height: H, bgcolor: "background.paper" }} />
        )}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 10,
            pointerEvents:
              tool === "pan" || tool === "textSelect" ? "none" : "auto",
          }}
        >
          {isNear && (markups.length > 0 || tool !== "select") && (
            <MarkupLayer
              pageNumber={pageIndex}
              width={W}
              height={H}
              scale={scale}
              markups={markups}
              tool={tool}
              activeColor={activeColor}
              activeStrokeWidth={activeStrokeWidth}
              activeLineStyle={activeLineStyle}
              docScale={docScale}
              hiddenLayers={hiddenLayers}
              selectedMarkupIds={selectedMarkupIds}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              canMarkup={canMarkup}
              activeSessionId={activeSessionId}
              onMarkupAdded={handleMarkupAdded}
              onMarkupSelected={handleMarkupSelected}
              onMarkupModified={handleMarkupModified}
              onMarkupDeleted={handleMarkupDeleted}
              onContextMenu={handleContextMenu}
              onCanvasMention={onCanvasMention}
            />
          )}
        </Box>
      </Box>
    );
  },
  (prev: any, next: any) => {
    // Custom memo comparison: only re-render if this page's actual data changed
    return (
      prev.markups === next.markups &&
      prev.tool === next.tool &&
      prev.scale === next.scale &&
      prev.pdfWidth === next.pdfWidth &&
      prev.pdfHeight === next.pdfHeight &&
      prev.activeColor === next.activeColor &&
      prev.activeStrokeWidth === next.activeStrokeWidth &&
      prev.activeLineStyle === next.activeLineStyle &&
      prev.docScale === next.docScale &&
      prev.searchKeyword === next.searchKeyword &&
      prev.pdfDoc === next.pdfDoc &&
      prev.currentUserId === next.currentUserId &&
      prev.isAdmin === next.isAdmin &&
      prev.canMarkup === next.canMarkup &&
      prev.hiddenLayers?.join(",") === next.hiddenLayers?.join(",") &&
      prev.selectedMarkupIds?.join(",") === next.selectedMarkupIds?.join(",")
    );
  },
);

const DocumentViewPage = memo(() => {
  const { projectId: urlProjectId, documentId = "" } = useParams<{
    projectId?: string;
    documentId: string;
  }>();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === "dark";
  const gold = theme.palette.primary.main;
  const isSM = useMediaQuery("(max-width:1050px)");

  // â"€â"€â"€ 1. State â"€â"€â"€
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // pdfFile passed directly to react-pdf â€" PDF.js uses range requests, no full download
  const [pdfFile, setPdfFile] = useState<{
    url: string;
    httpHeaders: Record<string, string>;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({
    current: 0,
    total: 0,
    phase: "",
  });
  const [tool, setTool] = useState<DrawTool>("select");
  const [activeColor, setActiveColor] = useState("#d32f2f");
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(2);
  const [activeLineStyle, setActiveLineStyle] = useState<LineStyle>("solid");
  const [docScale, setDocScale] = useState<string>(
    () => localStorage.getItem("pdfDocScale") || "1:1",
  );
  const [sidebarTab, setSidebarTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedMarkupIds, setSelectedMarkupIds] = useState<string[]>([]);
  // Active review stamp -- when set, new markups auto-get stamp properties
  const activeReviewStampRef = useRef<ReviewStamp | null>(null);
  // Active electrical config -- for one-click electrical element placement
  const [activeElectricalConfig, setActiveElectricalConfig] = useState<
    import("../components/pdf/PdfToolbar").ElectricalConfig | null
  >(null);
  const activeElectricalConfigRef = useRef<
    import("../components/pdf/PdfToolbar").ElectricalConfig | null
  >(null);
  // Custom stamp data — when set, next reviewStamp placement creates a composite of saved markups
  const customStampDataRef = useRef<{ name: string; markups: any[] } | null>(
    null,
  );
  // Tool Chest: extra style properties from last applied simple preset, merged into created markups
  const pendingPresetPropsRef = useRef<{
    markupType: string;
    extraProps: Record<string, any>;
  } | null>(null);

  // --- PDF OCG Layers state ---
  const [pdfLayers, setPdfLayers] = useState<
    { name: string; visible: boolean }[]
  >([]);

  // --- Compare mode state ---
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareConfig, setCompareConfig] = useState<CompareConfig | null>(
    null,
  );
  const [compareShowOld, setCompareShowOld] = useState(true);
  const [compareShowNew, setCompareShowNew] = useState(true);
  const [compareShowMarkups, setCompareShowMarkups] = useState(true);
  const [compareProcessing, setCompareProcessing] = useState(false); // blocks UI during compare operations

  // --- Rendering engine toggle: false = old (MarkupOverlay), true = new (MarkupViewportCanvas) ---
  const [useViewportCanvas, setUseViewportCanvas] = useState(false);

  // --- Markup History panel state ---
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  // --- QA/QC Spell Check state ---
  const [qaqcMode, setQaqcMode] = useState(false);
  const [qaqcPanelOpen, setQaqcPanelOpen] = useState(false);
  const [spellErrors, setSpellErrors] = useState<SpellError[]>([]);
  const [activeSpellError, setActiveSpellError] = useState<SpellError | null>(
    null,
  );
  const [spellScope, setSpellScope] = useState<"page" | "document">("document");
  const [isSpellChecking, setIsSpellChecking] = useState(false);
  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set());

  // Mobile floating toolbar state
  const mobileToolbarRef = useRef<HTMLDivElement>(null);
  const mobileDragRef = useRef<{
    isDragging: boolean;
    startPointerX: number;
    startPointerY: number;
    startPosX: number;
    startPosY: number;
    currentX: number;
    currentY: number;
  }>({
    isDragging: false,
    startPointerX: 0,
    startPointerY: 0,
    startPosX: 0,
    startPosY: 0,
    currentX: 0,
    currentY: 0,
  });
  const [mobileToolbarStyle, setMobileToolbarStyle] =
    useState<React.CSSProperties>({
      left: "50%",
      bottom: "16px",
      top: "auto",
      transform: "translateX(-50%)",
    });
  const [mobileDownloadOpen, setMobileDownloadOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileStampAnchor, setMobileStampAnchor] =
    useState<null | HTMLElement>(null);
  const [mobileElectricalAnchor, setMobileElectricalAnchor] =
    useState<null | HTMLElement>(null);
  const [mobileStampSheet, setMobileStampSheet] = useState(false);
  const [mobileElectricalSheet, setMobileElectricalSheet] = useState(false);
  const [mobileToolChestSheet, setMobileToolChestSheet] = useState(false);
  // Markup Wheel (middle-click radial menu)
  const [wheelOpen, setWheelOpen] = useState(false);
  const [wheelPos, setWheelPos] = useState({ x: 0, y: 0 });
  const [markupClipboard, setMarkupClipboard] = useState<any[]>([]);

  // Viewer State
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(() => {
    // Restore last viewed page from sessionStorage (survives reload)
    if (documentId) {
      const saved = sessionStorage.getItem(`page-${documentId}`);
      if (saved) return Math.max(1, parseInt(saved) || 1);
    }
    return 1;
  });
  const [splitRightPage, setSplitRightPage] = useState<number>(2);
  const [splitLeftZoom, setSplitLeftZoom] = useState<number>(0.3);
  const [splitRightZoom, setSplitRightZoom] = useState<number>(0.3);
  const splitLeftScrollRef = useRef<HTMLDivElement>(null);
  const splitRightScrollRef = useRef<HTMLDivElement>(null);
  const [pageLabels, setPageLabels] = useState<string[]>([]);
  // P2-4: track whether pdfjs outline has already set labels so tile-server onDocInfo can't overwrite them
  const pageLabelsFromOutlineRef = useRef(false);
  const [zoom, setZoom] = useState<number>(0.3);
  const [displayScale, setDisplayScale] = useState<number>(0.3);
  const [scrollMode, setScrollMode] = useState<"page" | "continuous" | "split">(
    () =>
      (localStorage.getItem("pdfScrollMode") as
        | "page"
        | "continuous"
        | "split") || "continuous",
  );
  const [pageDimensions, setPageDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 800, height: 1131 });
  // Cached PDFDocumentProxy â€" loaded once per pdfData, shared by search and bookmark handlers
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const pdfDocCleanupRef = useRef<any>(null);

  // Bluebeam / PDF annotation import
  const [embeddedAnnots, setEmbeddedAnnots] = useState<ImportedMarkup[] | null>(
    null,
  );
  const [isImporting, setIsImporting] = useState(false);

  const zoomDebounceRef = useRef<any>(null);
  // Ref to the transform box so we can update CSS directly without React re-render
  const transformBoxRef = useRef<HTMLDivElement>(null);
  // Tracks the live display scale as a ref (never stale in event handlers)
  const displayScaleRef = useRef<number>(0.3);
  // Tracks the committed zoom as a ref (never stale in event handlers)
  const zoomRef = useRef<number>(0.3);

  const updateActualZoom = useCallback((newZoom: number) => {
    if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
    zoomDebounceRef.current = setTimeout(() => {
      setZoom(newZoom);
    }, 300);
  }, []);

  // When zoom settles: sync refs + reset CSS transform.
  // Snapshot overlay in each PageContainer covers the re-render flash.
  useEffect(() => {
    zoomRef.current = zoom;
    displayScaleRef.current = zoom;
    setDisplayScale(zoom);
    if (transformBoxRef.current) {
      transformBoxRef.current.style.transform = "scale(1)";
    }
  }, [zoom]);

  const handleZoom = useCallback(
    (delta: number) => {
      setDisplayScale((prev) => {
        const next = Math.max(
          0.1,
          Math.min(10, Math.round((prev + delta) * 100) / 100),
        );
        displayScaleRef.current = next;
        // Apply CSS transform immediately â€" instant visual feedback, no re-render
        if (transformBoxRef.current) {
          transformBoxRef.current.style.transform = `scale(${next / zoomRef.current})`;
        }
        updateActualZoom(next);
        return next;
      });
    },
    [updateActualZoom],
  );

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    markupId: string;
  } | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<string[]>([]);
  const [routeWizardOpen, setRouteWizardOpen] = useState(false);
  const [routePanelClickMode, setRoutePanelClickMode] = useState(false);
  const [routeMultiClickMode, setRouteMultiClickMode] = useState(false);
  const [routeMultiClickPoints, setRouteMultiClickPoints] = useState<
    { x: number; y: number }[]
  >([]);
  // Refs for synchronous access in click handlers (React state lags behind)
  const routeModeRef = useRef<"off" | "panel" | "multi">("off");
  const routePointsRef = useRef<{ x: number; y: number }[]>([]);
  const [routePanelClickData, setRoutePanelClickData] = useState<{
    templateId: string;
    endpoints: any[];
    spacing: number;
    conduit?: any;
  } | null>(null);
  const [searchResults, setSearchResults] = useState<
    {
      pageIndex: number;
      text: string;
      before: string;
      after: string;
      matchIndex: number;
      x: number;
      y: number;
      w?: number;
      h?: number;
      markupId?: string;
    }[]
  >([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [activeSearchKeyword, setActiveSearchKeyword] = useState("");
  const [searchScope, setSearchScope] = useState<"document" | "page">(
    "document",
  );
  const [searchMode, setSearchMode] = useState<"exact" | "contains" | "fuzzy">(
    "contains",
  );
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState<
    number | null
  >(null);
  const [canvasMentionData, setCanvasMentionData] = useState<{
    anchor: HTMLElement;
    query: string;
    onSelect: (name: string) => void;
    cursorPos?: { top: number; left: number };
  } | null>(null);

  // --- Collaboration Mode ---
  type CollabMode = "personal" | "live" | "edit" | "draft" | "qaqc";
  const [collabMode, setCollabMode] = useState<CollabMode>("personal");
  const [editLockUser, setEditLockUser] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [personalMarkups, setPersonalMarkups] = useState<any[]>([]);
  const personalMarkupsRef = useRef<any[]>([]); // always-fresh ref for callbacks
  const personalSnapshotRef = useRef<any[]>([]); // snapshot of Y.js markups at time of disconnect
  const lastPermToastRef = useRef<number>(0); // debounce permission denied toasts
  const lastNonEditableToastRef = useRef<string>(""); // debounce "switch to edit mode" toasts
  const liveSessionMarkupIds = useRef(new Set<string>()); // track markups created in live session
  // Unique session ID — stamped into every markup created in this browser session.
  // Rotated after Publish so published markups become "server-owned" (locked in Personal/Live).
  // Persisted alongside personal markups so it survives page reload.
  const [sessionId, setSessionId] = useState(() => {
    // Only restore sessionId if there are actual personal markups saved (not for Live mode leftovers)
    if (documentId) {
      try {
        const hasPersonal = localStorage.getItem(
          `personal-markups-${documentId}`,
        );
        if (hasPersonal) {
          const saved = localStorage.getItem(`session-id-${documentId}`);
          if (saved) return saved;
        }
      } catch {
        /* */
      }
    }
    return crypto.randomUUID();
  });

  // Persist sessionId to localStorage; restore when documentId changes
  useEffect(() => {
    if (!documentId) return;
    try {
      localStorage.setItem(`session-id-${documentId}`, sessionId);
    } catch {
      /* */
    }
  }, [sessionId, documentId]);
  // When switching documents, load the saved sessionId only if personal markups exist
  useEffect(() => {
    if (!documentId) return;
    try {
      const hasPersonal = localStorage.getItem(
        `personal-markups-${documentId}`,
      );
      if (hasPersonal) {
        const saved = localStorage.getItem(`session-id-${documentId}`);
        if (saved) {
          setSessionId(saved);
          return;
        }
      }
      setSessionId(crypto.randomUUID());
    } catch {
      setSessionId(crypto.randomUUID());
    }
  }, [documentId]);

  // Keep ref in sync with state (for callbacks that need always-fresh data)
  useEffect(() => {
    personalMarkupsRef.current = personalMarkups;
  }, [personalMarkups]);

  // Legacy draft state (now driven by collabMode)
  const draftMode = collabMode === "draft";
  const [draftMarkups, setDraftMarkups] = useState<any[]>([]);
  const draftMarkupsRef = useRef<any[]>([]);
  useEffect(() => {
    draftMarkupsRef.current = draftMarkups;
  }, [draftMarkups]);
  // Discard-changes confirmation dialog (replaces window.confirm)
  const [discardDialog, setDiscardDialog] = useState<{
    open: boolean;
    message: string;
    targetMode: CollabMode | null;
  }>({ open: false, message: "", targetMode: null });
  // Delete confirmation dialog (replaces window.confirm)
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    ids: string[];
    count: number;
    skipped: number;
  }>({ open: false, ids: [], count: 0, skipped: 0 });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tileViewerRef = useRef<TileViewerHandle>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollModeRef = useRef(scrollMode);
  const prevToolRef = useRef<DrawTool>("select");

  // --- 2. Data Hooks ---
  const projectId = urlProjectId || doc?.folder?.projectId;
  const {
    data: markups = [],
    refetch: refetchMarkups,
    flushMarkups,
  } = useMarkups(documentId);
  const connectedUsers = useAwareness(documentId);
  const { setLocalCursor, clearLocalCursor } = useSetLocalCursor(documentId);
  const { mutateAsync: createMarkup } = useCreateMarkup();
  const { mutateAsync: updateMarkupAPI } = useUpdateMarkup();
  const { mutateAsync: deleteMarkupAPI } = useDeleteMarkup();
  const {
    push: pushHistory,
    undo,
    redo,
    clear: clearHistory,
    canUndo,
    canRedo,
  } = useUndoRedo();
  const { data: projectUsers = [] } = useProjectUsers(projectId);
  const { token, isLoading: authLoading, user } = useAuth();
  const [userSettings] = useUserSettings(user?.id);

  // Apply user settings defaults — on first load AND when settings change
  const prevSettingsRef = useRef("");
  useEffect(() => {
    if (!user?.id) return;
    const key = `${userSettings.defaultColor}|${userSettings.defaultStrokeWidth}|${userSettings.defaultLineStyle}|${userSettings.defaultFontSize}`;
    if (prevSettingsRef.current === key) return;
    prevSettingsRef.current = key;
    setActiveColor(userSettings.defaultColor);
    setActiveStrokeWidth(userSettings.defaultStrokeWidth);
    setActiveLineStyle(userSettings.defaultLineStyle as LineStyle);
  }, [
    user?.id,
    userSettings.defaultColor,
    userSettings.defaultStrokeWidth,
    userSettings.defaultLineStyle,
    userSettings.defaultFontSize,
  ]);
  const queryClient = useQueryClient();
  const isAdmin = user?.systemRole === "GENERAL_ADMIN";
  const { data: myPerms } = useMyProjectPermissions(projectId);
  const canMarkup = (() => {
    const hasPermission = isAdmin || myPerms?.canMarkup !== false;
    if (!hasPermission) return false;
    if (collabMode === "personal") return true; // can create new markups (stored locally)
    if (collabMode === "live") return true; // can create own markups (goes to Y.js)
    if (collabMode === "edit") return true; // full edit (stored locally until publish)
    return false;
  })();
  const canDownload = isAdmin || myPerms?.canDownload !== false;

  // Force Live mode for users without markup permission — they are always in read-only view
  useEffect(() => {
    if (
      myPerms &&
      !isAdmin &&
      myPerms.canMarkup === false &&
      collabMode !== "live"
    ) {
      setCollabMode("live");
    }
  }, [myPerms, isAdmin, collabMode]);

  // Session-scope restriction: in Personal/Live mode, only markups created in THIS session
  // (matching sessionId in properties) are editable. Edit mode: null = standard permission check.
  // MarkupLayer uses this to set lockMovement on non-session markups.
  const activeSessionId =
    collabMode === "personal" || collabMode === "live" ? sessionId : null;

  // â"€â"€â"€ 4. Memos â"€â"€â"€
  const selectedMarkups = useMemo(() => {
    // Use visibleMarkups source depending on mode to find selected markups
    const allVisible =
      collabMode === "personal"
        ? [...(markups || []), ...personalMarkups]
        : collabMode === "draft" ||
            collabMode === "edit" ||
            collabMode === "qaqc"
          ? draftMarkups.length > 0
            ? draftMarkups
            : markups || []
          : markups || [];
    return allVisible.filter((m: any) => selectedMarkupIds.includes(m.id));
  }, [markups, selectedMarkupIds, collabMode, personalMarkups, draftMarkups]);

  // Stable per-page markup arrays â€" only update pages that actually changed
  const prevMarkupsByPageRef = useRef<Record<number, any[]>>({});
  const markupsByPage = useMemo(() => {
    const newMap: Record<number, any[]> = {};
    // Use visibleMarkups so personal/edit mode markups are included in split view
    const source =
      collabMode === "personal"
        ? [...(markups || []), ...personalMarkups]
        : collabMode === "draft" ||
            collabMode === "edit" ||
            collabMode === "qaqc"
          ? draftMarkups.length > 0
            ? draftMarkups
            : markups || []
          : markups || [];
    source.forEach((m: any) => {
      if (!newMap[m.pageNumber]) newMap[m.pageNumber] = [];
      newMap[m.pageNumber].push(m);
    });
    const result: Record<number, any[]> = {};
    const allPages = new Set([
      ...Object.keys(newMap).map(Number),
      ...Object.keys(prevMarkupsByPageRef.current).map(Number),
    ]);
    for (const page of allPages) {
      const newMks = newMap[page] || [];
      const oldMks = prevMarkupsByPageRef.current[page] || [];
      const mkHash = (a: any[]) =>
        a.map((m) => `${m.id}:${m.updatedAt || ""}`).join("|");
      if (
        newMks.length === oldMks.length &&
        mkHash(newMks) === mkHash(oldMks)
      ) {
        result[page] = oldMks; // stable reference â€" PageContainer won't re-render
      } else {
        result[page] = newMks;
      }
    }
    prevMarkupsByPageRef.current = result;
    return result;
  }, [markups, collabMode, personalMarkups, draftMarkups]);

  const canEditMarkup = useMemo(() => {
    if (!selectedMarkups.length) return true;
    // Personal / Live: only markups created in THIS session (matching sessionId) are editable
    if (collabMode === "personal" || collabMode === "live") {
      return selectedMarkups.every(
        (m: any) => m.properties?.sessionId === sessionId,
      );
    }
    // Edit mode: can edit ANY markup (respecting permissions/allowedEditUserIds)
    if (isAdmin) return true;
    return selectedMarkups.every((m: any) => {
      if (user?.id != null && m.authorId === user.id) return true;
      const ids = m.allowedEditUserIds;
      if (!ids || ids.includes("*")) return true;
      if (ids.length === 0) return false;
      return user?.id != null && ids.includes(user.id);
    });
  }, [selectedMarkups, isAdmin, user, collabMode, sessionId]);

  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [propertiesHidden, setPropertiesHidden] = useState(false); // user manually hides panel

  // â"€â"€â"€ 5. Handlers â"€â"€â"€
  const handleContextMenu = useCallback((e: MouseEvent, markupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, markupId });
  }, []);

  // Called only from canvas events (user-initiated clicks) â€" opens panel
  const handleMarkupSelected = useCallback(
    (ids: string[]) => {
      // Expand selection to include all group members (search both Y.js + personal markups)
      const allMarkups = [...(markups || []), ...personalMarkups];
      const expandedIds = new Set(ids);
      for (const id of ids) {
        const m = allMarkups.find((mk: any) => mk.id === id);
        if (m?.properties?.groupId) {
          allMarkups
            .filter(
              (mk: any) => mk.properties?.groupId === m.properties.groupId,
            )
            .forEach((mk: any) => expandedIds.add(mk.id));
        }
      }
      const finalIds = Array.from(expandedIds);
      setSelectedMarkupIds(finalIds);
      if (!propertiesHidden && collabMode !== "qaqc")
        setPropertiesOpen(finalIds.length > 0);

      // Toast when user selects a non-session markup in personal/live mode (debounced per markup)
      if (
        finalIds.length === 1 &&
        (collabMode === "personal" || collabMode === "live")
      ) {
        const clickedId = finalIds[0];
        const clickedMarkup = allMarkups.find((m: any) => m.id === clickedId);
        const isSessionMarkup =
          clickedMarkup?.properties?.sessionId === sessionId;
        if (!isSessionMarkup && lastNonEditableToastRef.current !== clickedId) {
          lastNonEditableToastRef.current = clickedId;
          toast("Switch to Edit mode to modify existing markups", {
            duration: 2000,
            icon: "\uD83D\uDD12",
          });
        }
      }
    },
    [propertiesHidden, markups, collabMode, personalMarkups, sessionId],
  );

  const handleMarkupModified = useCallback(
    async (modifiedMarkup: any) => {
      const original = (markups || []).find(
        (m: Markup) => m.id === modifiedMarkup.id,
      );
      if (!original) return;

      const updateData: any = {
        id: modifiedMarkup.id,
        coordinates: modifiedMarkup.coordinates,
      };
      if (modifiedMarkup.properties) {
        updateData.properties = {
          ...original.properties,
          ...modifiedMarkup.properties,
        };
      }

      if (modifiedMarkup.isMoving) {
        // During drag: DON'T write to Yjs â€" prevents lag from 60fps DB writes.
        // Final position is saved on object:modified (mouse up).
        return;
      }

      const updatedBy = {
        id: user?.id || "",
        name: user?.name || user?.email || "Unknown",
      };
      const updatedAt = new Date().toISOString();
      Object.assign(updateData, { updatedBy, updatedAt });

      await updateMarkupAPI(updateData);
      pushHistory({
        type: "update",
        markupId: modifiedMarkup.id,
        before: original,
        after: { ...original, ...updateData },
      });
      refetchMarkups();
    },
    [markups, updateMarkupAPI, pushHistory, refetchMarkups, user],
  );

  // Persist current page to sessionStorage so it survives reload
  useEffect(() => {
    if (documentId && currentPage > 0) {
      sessionStorage.setItem(`page-${documentId}`, String(currentPage));
    }
  }, [documentId, currentPage]);

  // Restore saved page after document loads (continuous mode needs explicit navigation)
  const hasRestoredPageRef = useRef(false);
  useEffect(() => {
    if (hasRestoredPageRef.current || !documentId || numPages < 2) return;
    const saved = sessionStorage.getItem(`page-${documentId}`);
    const savedPage = saved ? parseInt(saved) : 1;
    if (savedPage > 1 && savedPage <= numPages) {
      hasRestoredPageRef.current = true;
      // Defer so TileViewer has built its layout
      setTimeout(() => {
        tileViewerRef.current?.navigateToPage(savedPage, true);
      }, 200);
    } else {
      hasRestoredPageRef.current = true;
    }
  }, [documentId, numPages]);

  const handleJumpToPage = useCallback(
    (pageIndex: number) => {
      if (pageIndex < 1 || pageIndex > numPages) return;
      setCurrentPage(pageIndex);
      // Use imperative TileViewer navigation -- works correctly in both page and
      // continuous modes without fighting against TileViewer's internal scroll state.
      tileViewerRef.current?.navigateToPage(pageIndex, true);
      tileViewerRef.current?.prioritizePage(pageIndex - 1);
    },
    [numPages],
  );

  const handleJumpToMarkup = useCallback(
    (ids: string[]) => {
      const markupId = ids[0];
      if (!markupId) return;
      const m = (markups || []).find((m: any) => m.id === markupId);
      if (!m) return;
      setSelectedMarkupIds([markupId]);
      setPropertiesOpen(true);

      const coords = m.coordinates;

      // Get tile-server page dimensions for the markup's page (NOT pdfjs pageDimensions).
      // pdfjs returns 595×842 for A4 but markup coords are in tile-server space (1190×1684).
      const pageSize = tileViewerRef.current?.getPageSize(m.pageNumber);
      const pw = pageSize?.w ?? pageDimensions.width * 2;
      const ph = pageSize?.h ?? pageDimensions.height * 2;

      // Compute markup center in page-pixel coordinates (0..pw, 0..ph)
      let cx = pw / 2;
      let cy = ph / 2;
      if (coords.left !== undefined) {
        cx = (coords.left + (coords.width || 0) / 2) * pw;
        cy = (coords.top + (coords.height || 0) / 2) * ph;
      } else if (coords.x1 !== undefined) {
        cx = ((coords.x1 + coords.x2) / 2) * pw;
        cy = ((coords.y1 + coords.y2) / 2) * ph;
      }

      // Use at least 150% zoom so the markup is clearly readable
      const TARGET_ZOOM = Math.max(displayScale, 1.5);

      if (tileViewerRef.current) {
        // In page mode, switch to the correct page first, then navigate after layout rebuilds.
        // In continuous mode navigateToPagePoint works directly.
        const doNavigate = () => {
          tileViewerRef.current!.navigateToPagePoint(
            m.pageNumber,
            cx,
            cy,
            TARGET_ZOOM,
          );
          tileViewerRef.current!.prioritizePage(m.pageNumber);
        };

        if (scrollMode === "page" && currentPage !== m.pageNumber + 1) {
          // Switch page first -- navigateToPagePoint will detect layout missing and store
          // as pendingNavigationRef, executed automatically once pageLayouts rebuilds.
          setCurrentPage(m.pageNumber + 1);
          tileViewerRef.current.navigateToPage(m.pageNumber + 1, true);
        }
        doNavigate(); // stores pending if layout not ready yet
      } else {
        handleJumpToPage(m.pageNumber + 1);
      }
    },
    [
      markups,
      pageDimensions,
      displayScale,
      handleJumpToPage,
      scrollMode,
      currentPage,
    ],
  );

  const handleJumpToSearchMatch = useCallback(
    (idx: number) => {
      const match = searchResults[idx] as any;
      if (!match) return;
      setActiveSearchResultIndex(idx);

      // Markup result → jump to markup (handles cross-page internally)
      if (match.markupId) {
        handleJumpToMarkup([match.markupId]);
        return;
      }

      const TARGET_ZOOM = 1.5;
      const pageIdx = match.pageIndex ?? 0;

      if (tileViewerRef.current) {
        // In page mode, switch to the correct page first so layout is available.
        if (scrollMode === "page" && currentPage !== pageIdx + 1) {
          setCurrentPage(pageIdx + 1);
          tileViewerRef.current.navigateToPage(pageIdx + 1, true);
        }

        // Search results use pdfjs scale=1 coordinates (e.g. 595-wide for A4).
        // navigateToPagePoint expects tile-server coordinates (2×, e.g. 1190-wide).
        const tileSize = tileViewerRef.current.getPageSize(pageIdx);
        const coordScale = tileSize ? tileSize.w / pageDimensions.width : 2;
        const cx =
          ((match.x || 0) + (match.width || match.w || 0) / 2) * coordScale;
        const cy =
          ((match.y || 0) + (match.height || match.h || 0) / 2) * coordScale;
        tileViewerRef.current.navigateToPagePoint(pageIdx, cx, cy, TARGET_ZOOM);
        tileViewerRef.current.prioritizePage(pageIdx);
      } else {
        // Fallback: at least jump to the right page
        handleJumpToPage(pageIdx + 1);
      }
    },
    [
      searchResults,
      handleJumpToMarkup,
      handleJumpToPage,
      pageDimensions.width,
      scrollMode,
      currentPage,
    ],
  );

  const handleSearch = useCallback(
    async (keyword: string) => {
      setActiveSearchKeyword(keyword);
      setActiveSearchResultIndex(null);
      if (!keyword || keyword.length < 2 || !pdfDoc) {
        setSearchResults([]);
        setIsSearching(false);
        setSearchProgress(0);
        return;
      }
      setIsSearching(true);
      setSearchProgress(0);
      setSearchResults([]);
      try {
        const pdf = pdfDoc;
        const results: any[] = [],
          totalPages = pdf.numPages;
        // Normalize keyword: collapse whitespace so "A  B" matches "A B" in PDF
        const normalizedKeyword = keyword.replace(/\s+/g, " ").trim();
        const escaped = normalizedKeyword.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        let regexStr: string;
        if (searchMode === "exact") {
          // Exact word match — bounded by word boundaries
          regexStr = `\\b${escaped.replace(/ /g, "\\s+")}\\b`;
        } else if (searchMode === "fuzzy") {
          // Fuzzy — characters can have optional separators between (tolerates spacing/hyphens)
          regexStr = escaped
            .split("")
            .map((ch) => (ch === " " ? "\\s+" : ch))
            .join("[\\s\\-_.,]*");
        } else {
          // Contains (default) — substring match, flexible whitespace
          regexStr = escaped.replace(/ /g, "\\s+");
        }
        const regex = new RegExp(regexStr, "gi");
        const start = searchScope === "page" ? currentPage : 1,
          end = searchScope === "page" ? currentPage : totalPages;
        for (let i = start; i <= end; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });

          // Search main text content stream.
          // Build a flat string from all items so matches spanning multiple items are found.
          const textContent = await page.getTextContent();
          const items = textContent.items as any[];
          // Build fullText and offset map for coordinate lookup
          let fullText = "";
          const offsets: { start: number; item: any }[] = [];
          for (let j = 0; j < items.length; j++) {
            const item = items[j];
            if (typeof item.str !== "string") continue;
            offsets.push({ start: fullText.length, item });
            fullText += item.str;
            // Add separator: EOL â†' newline, otherwise use item's own trailing space (don't add extra)
            if (item.hasEOL) {
              fullText += "\n";
            } else if (j < items.length - 1 && !fullText.endsWith(" ")) {
              // Check positional gap: if next item is far away, add space
              const next = items[j + 1];
              if (next && typeof next.transform?.[4] === "number") {
                const curX = item.transform[4] + (item.width || 0);
                const gap = next.transform[4] - curX;
                if (gap > 1) fullText += " ";
              }
            }
          }
          regex.lastIndex = 0;
          let match;
          while ((match = regex.exec(fullText)) !== null) {
            let bestItem = offsets[0]?.item;
            let bestItemStart = 0;
            for (const o of offsets) {
              if (o.start <= match.index) {
                bestItem = o.item;
                bestItemStart = o.start;
              } else break;
            }
            if (!bestItem) continue;
            const matchEnd = match.index + match[0].length;

            // Collect ALL text items that overlap with this match.
            // Instead of ratio-based sub-item positioning (which loses the last glyph
            // because PDF.js width = advance-width, not bounding-box), we highlight
            // from the LEFT edge of the first overlapping item to the RIGHT edge
            // of the last overlapping item. This always fully covers the match.
            let xMin = Infinity,
              xMax = -Infinity;
            let itemH = 12;
            let yBase = 0;

            for (const o of offsets) {
              const oStart = o.start;
              const oEnd = oStart + (o.item.str?.length || 0);
              // Skip items completely before or after the match
              if (oEnd <= match.index) continue;
              if (oStart >= matchEnd) break;
              // This item overlaps the match
              const oTx = pdfjs.Util.transform(
                viewport.transform,
                o.item.transform,
              );
              const oW = o.item.width || 50;
              const oH = Math.abs(oTx[3]) || o.item.height || 12;
              const oLeft = oTx[4];
              const oRight = oLeft + oW;
              // If match starts mid-item, estimate X offset proportionally
              let left = oLeft;
              if (oStart < match.index) {
                const charsBefore = match.index - oStart;
                left = oLeft + oW * (charsBefore / (o.item.str?.length || 1));
              }
              // If match ends mid-item, estimate right edge proportionally
              let right = oRight;
              if (oEnd > matchEnd) {
                const charsInMatch = matchEnd - oStart;
                right = oLeft + oW * (charsInMatch / (o.item.str?.length || 1));
              }
              xMin = Math.min(xMin, left);
              xMax = Math.max(xMax, right);
              if (oH > itemH) itemH = oH;
              yBase = oTx[5]; // baseline Y from last overlapping item
            }

            // Fallback if no items matched (shouldn't happen)
            if (xMin === Infinity) {
              const tx = pdfjs.Util.transform(
                viewport.transform,
                bestItem.transform,
              );
              xMin = tx[4];
              xMax = tx[4] + (bestItem.width || 50);
              itemH = Math.abs(tx[3]) || 12;
              yBase = tx[5];
            }

            // Add 1 average char width as right padding for glyph overshoot
            const avgCharW =
              (bestItem.width || 50) / (bestItem.str?.length || 1);
            const xOffset = xMin - 1;
            const wMatch = Math.max(xMax - xMin + avgCharW * 0.5 + 2, 5);

            const snippet = fullText.replace(/\s+/g, " ");
            const snipIdx = match.index;
            results.push({
              pageIndex: i - 1,
              matchIndex: results.length,
              text: match[0].replace(/\s+/g, " "),
              before: snippet.substring(Math.max(0, snipIdx - 30), snipIdx),
              after: snippet.substring(
                snipIdx + match[0].length,
                snipIdx + match[0].length + 30,
              ),
              x: xOffset,
              y: yBase - itemH - 1,
              w: wMatch,
              h: itemH + 2,
            });
          }

          // Search PDF annotations (free text, stamps, form fields, callouts, etc.)
          const annotations = await page.getAnnotations();
          for (const annot of annotations) {
            // Collect all text fields an annotation may have
            const annotTexts: string[] = [];
            if (annot.contents) annotTexts.push(annot.contents);
            if (annot.fieldValue && typeof annot.fieldValue === "string")
              annotTexts.push(annot.fieldValue);
            if (annot.alternativeText) annotTexts.push(annot.alternativeText);
            if (annot.richTextContent) annotTexts.push(annot.richTextContent);
            if (annot.defaultAppearance?.text)
              annotTexts.push(annot.defaultAppearance.text);
            for (const str of annotTexts) {
              regex.lastIndex = 0;
              let match;
              while ((match = regex.exec(str)) !== null) {
                // rect: [x1, y1, x2, y2] in PDF coordinates
                const rect = annot.rect || [0, 0, 0, 0];
                const tx = pdfjs.Util.transform(viewport.transform, [
                  1,
                  0,
                  0,
                  1,
                  rect[0],
                  rect[1],
                ]);
                results.push({
                  pageIndex: i - 1,
                  matchIndex: results.length,
                  text: str,
                  before: str.substring(0, match.index),
                  after: str.substring(match.index + keyword.length),
                  x: tx[4],
                  y: tx[5],
                });
              }
            }
          }

          setSearchProgress(
            searchScope === "document"
              ? Math.round((i / totalPages) * 100)
              : 100,
          );
          if (results.length > 500) break;
        }

        // Also search through markup properties (subject, comment, canvas text, custom fields)
        const markupList = markups || [];
        const startPage = searchScope === "page" ? currentPage - 1 : 0;
        const endPage = searchScope === "page" ? currentPage - 1 : Infinity;
        for (const m of markupList) {
          const pageIdx = m.pageNumber || 0;
          if (pageIdx < startPage || pageIdx > endPage) continue;
          const props = m.properties || {};
          const coords = m.coordinates || {};
          // Collect all text fields (including custom fields)
          const textFields = [
            props.subject,
            props.comment,
            props.text,
            m.type,
            ...Object.entries(props)
              .filter(
                ([k]) =>
                  ![
                    "stroke",
                    "fill",
                    "fillOpacity",
                    "strokeWidth",
                    "lineStyle",
                    "fontSize",
                    "textColor",
                    "zIndex",
                    "locked",
                    "isPastedOrDuplicated",
                    "borderColor",
                    "borderWidth",
                    "arrowSize",
                    "arrowStyle",
                    "fontFamily",
                    "fontWeight",
                    "fontStyle",
                    "text",
                    "subject",
                    "comment",
                  ].includes(k),
              )
              .map(([, v]) => (typeof v === "string" ? v : "")),
          ]
            .filter(Boolean)
            .join(" ");
          regex.lastIndex = 0;
          const match = regex.exec(textFields);
          if (match) {
            const matchInText = textFields.indexOf(match[0]);
            results.push({
              pageIndex: pageIdx,
              matchIndex: results.length,
              text: textFields,
              before: textFields.substring(0, matchInText),
              after: textFields.substring(matchInText + keyword.length),
              x: (coords.left ?? coords.x1 ?? 0) * pageDimensions.width,
              y: (coords.top ?? coords.y1 ?? 0) * pageDimensions.height,
              markupId: m.id, // flag: this is a markup result
            });
          }
        }

        setSearchResults(results);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    },
    [pdfDoc, searchScope, currentPage, markups, pageDimensions],
  );

  const handleResetSearch = useCallback(() => {
    setActiveSearchKeyword("");
    setSearchResults([]);
    setActiveSearchResultIndex(null);
    setSearchProgress(0);
    setIsSearching(false);
  }, []);

  const handleJumpToBookmark = useCallback(
    async (dest: any) => {
      if (!pdfDoc) return;
      try {
        let pageNumber = -1;
        if (Array.isArray(dest)) {
          const pageIndex = await pdfDoc.getPageIndex(dest[0]);
          pageNumber = pageIndex + 1;
        } else if (typeof dest === "string") {
          const resolved = await pdfDoc.getDestination(dest);
          if (resolved) {
            const pageIndex = await pdfDoc.getPageIndex(resolved[0]);
            pageNumber = pageIndex + 1;
          }
        }
        if (pageNumber > 0) handleJumpToPage(pageNumber);
      } catch (e) {
        console.error("Failed to jump to bookmark:", e);
      }
    },
    [pdfDoc, handleJumpToPage],
  );

  const handleUpdateProperties = useCallback(
    async (markupId: string, data: any) => {
      // Draft/Personal markup -- update locally
      const { _fullProperties: dfp, ...draftData } = data as any;
      if (
        (collabMode === "draft" || collabMode === "edit") &&
        draftMarkups.some((dm) => dm.id === markupId)
      ) {
        setDraftMarkups((prev) =>
          prev.map((dm) => {
            if (dm.id !== markupId) return dm;
            return {
              ...dm,
              ...draftData,
              properties: dfp
                ? dfp
                : draftData.properties
                  ? { ...dm.properties, ...draftData.properties }
                  : dm.properties,
              updatedAt: new Date().toISOString(),
            };
          }),
        );
        return;
      }
      if (
        collabMode === "personal" &&
        personalMarkups.some((pm) => pm.id === markupId)
      ) {
        setPersonalMarkups((prev) => {
          const next = prev.map((pm) => {
            if (pm.id !== markupId) return pm;
            return {
              ...pm,
              ...data,
              properties: data.properties
                ? { ...pm.properties, ...data.properties }
                : pm.properties,
              updatedAt: new Date().toISOString(),
            };
          });
          if (documentId)
            try {
              localStorage.setItem(
                `personal-markups-${documentId}`,
                JSON.stringify(next),
              );
            } catch {
              /* */
            }
          return next;
        });
        return;
      }
      const original = (markups || []).find((m: Markup) => m.id === markupId);
      // Permission check: only owner/admin/allowed users can edit
      if (
        original &&
        !isAdmin &&
        !(user?.id != null && original.authorId === user.id)
      ) {
        const eids = (original as any).allowedEditUserIds;
        if (
          eids &&
          !eids.includes("*") &&
          (eids.length === 0 || !(user?.id != null && eids.includes(user.id)))
        ) {
          const now = Date.now();
          if (now - lastPermToastRef.current > 2000) {
            lastPermToastRef.current = now;
            toast.error("No permission to edit this markup", {
              duration: 2000,
            });
          }
          return;
        }
        if ((original as any).properties?.locked) {
          const now = Date.now();
          if (now - lastPermToastRef.current > 2000) {
            lastPermToastRef.current = now;
            toast.error("No permission to edit this markup", {
              duration: 2000,
            });
          }
          return;
        }
      }
      // _fullProperties = complete replacement (used for deleting custom params)
      const { _fullProperties, ...restData } = data as any;
      const updateData = {
        ...restData,
        ...(_fullProperties ? { properties: _fullProperties } : {}),
        updatedBy: {
          id: user?.id || "",
          name: user?.name || user?.email || "Unknown",
        },
        updatedAt: new Date().toISOString(),
      };
      if (_fullProperties) {
        await updateMarkupAPI({
          id: markupId,
          properties: _fullProperties,
          _replaceProperties: true,
          updatedBy: updateData.updatedBy,
          updatedAt: updateData.updatedAt,
        } as any);
      } else {
        await updateMarkupAPI({ id: markupId, ...updateData });
      }
      // Flush Y.js → React state immediately so canvas reflects the change in real-time
      // (bypasses the 100ms adaptive throttle for large documents)
      flushMarkups();
      if (original)
        pushHistory({
          type: "update",
          markupId,
          before: original,
          after: { ...original, ...updateData },
        });
    },
    [
      markups,
      updateMarkupAPI,
      pushHistory,
      user,
      collabMode,
      draftMarkups,
      personalMarkups,
      documentId,
      flushMarkups,
    ],
  );

  const handleDeleteMarkup = useCallback(
    async (markupIds: string | string[]) => {
      const ids = Array.isArray(markupIds) ? markupIds : [markupIds];
      for (const id of ids) {
        const original = (markups || []).find((m: Markup) => m.id === id);
        await deleteMarkupAPI(id);
        if (original)
          pushHistory({ type: "delete", markupId: id, before: original });
      }
      setSelectedMarkupIds((prev) => {
        const next = prev.filter((id) => !ids.includes(id));
        if (next.length === 0) setPropertiesOpen(false);
        return next;
      });
      setTimeout(() => refetchMarkups(), 100);
    },
    [deleteMarkupAPI, pushHistory, refetchMarkups],
  );

  const handleMarkupAdded = useCallback(
    async (newMarkup: any) => {
      // Custom stamp placement — intercept to create multiple markups at cursor position
      const customStamp = customStampDataRef.current;
      if (customStamp && newMarkup.properties?.__isCustomStamp) {
        customStampDataRef.current = null;
        activeElectricalConfigRef.current = null;
        setActiveElectricalConfig(null);
        const cx =
          (newMarkup.coordinates?.left || 0) +
          (newMarkup.coordinates?.width || 0) / 2;
        const cy =
          (newMarkup.coordinates?.top || 0) +
          (newMarkup.coordinates?.height || 0) / 2;
        const groupId = crypto.randomUUID();

        for (const sm of customStamp.markups) {
          const coords = JSON.parse(JSON.stringify(sm.coordinates));
          const dx = sm._offsetX || 0;
          const dy = sm._offsetY || 0;
          // Place at click position + relative offset from original center
          if (coords.left !== undefined) {
            coords.left = cx + dx - (coords.width || 0) / 2;
            coords.top = cy + dy - (coords.height || 0) / 2;
          } else if (coords.x1 !== undefined) {
            const origCx = ((coords.x1 || 0) + (coords.x2 || 0)) / 2;
            const origCy = ((coords.y1 || 0) + (coords.y2 || 0)) / 2;
            const shiftX = cx + dx - origCx;
            const shiftY = cy + dy - origCy;
            coords.x1 += shiftX;
            coords.y1 += shiftY;
            coords.x2 += shiftX;
            coords.y2 += shiftY;
          }
          if (Array.isArray(coords.points)) {
            const avgX =
              coords.points.reduce((s: number, p: any) => s + p.x, 0) /
              coords.points.length;
            const avgY =
              coords.points.reduce((s: number, p: any) => s + p.y, 0) /
              coords.points.length;
            const shiftX = cx + dx - avgX;
            const shiftY = cy + dy - avgY;
            coords.points = coords.points.map((p: any) => ({
              x: p.x + shiftX,
              y: p.y + shiftY,
            }));
          }
          // Callout sub-coords
          if (coords.cloud) {
            coords.cloud.left =
              (coords.cloud.left || 0) +
              (cx + dx) -
              ((coords.cloud.left || 0) + (coords.cloud.width || 0) / 2);
            coords.cloud.top =
              (coords.cloud.top || 0) +
              (cy + dy) -
              ((coords.cloud.top || 0) + (coords.cloud.height || 0) / 2);
          }
          if (coords.textBox) {
            coords.textBox.left =
              (coords.textBox.left || 0) +
              (cx + dx) -
              ((coords.textBox.left || 0) + (coords.textBox.width || 0) / 2);
            coords.textBox.top =
              (coords.textBox.top || 0) +
              (cy + dy) -
              ((coords.textBox.top || 0) + (coords.textBox.height || 0) / 2);
          }

          await createMarkup({
            type: sm.type,
            pageNumber: newMarkup.pageNumber ?? currentPage - 1,
            coordinates: coords,
            properties: { ...sm.properties, groupId },
            documentId,
            allowedEditUserIds: userSettings.allowOthersEdit ? ["*"] : [],
            allowedDeleteUserIds: userSettings.allowOthersDelete ? ["*"] : [],
          });
        }

        refetchMarkups();
        toast.success(
          `Placed "${customStamp.name}" (${customStamp.markups.length} markups)`,
        );
        return; // Don't create the reviewStamp markup itself
      }

      // Apply active review stamp properties if set
      const stamp = activeReviewStampRef.current;
      if (stamp) {
        const props = newMarkup.properties || {};
        props.subject = stamp.subject;
        if (stamp.status) props.status = stamp.status;
        if (stamp.comment)
          props.comment = (props.comment || "") + stamp.comment;
        if (stamp.defaultText) props.text = stamp.defaultText;
        if (stamp.lineStyle) props.lineStyle = stamp.lineStyle;
        // Apply custom properties (conduitSize, boxType, fittingType, etc.)
        if (stamp.customProps) {
          Object.entries(stamp.customProps).forEach(([k, v]) => {
            props[k] = v;
          });
        }
        props.reviewStamp = stamp.id;
        // Auto-enable pulse if user setting is ON
        if (userSettings.pulseReviewMarkups) props.pulse = true;
        newMarkup.properties = props;
        // Clear stamp after use (one-shot)
        activeReviewStampRef.current = null;
      }

      // Apply active electrical config properties (including conduit polylines)
      const elecConfig = activeElectricalConfigRef.current;
      if (
        elecConfig &&
        [
          "electricalBox",
          "stub",
          "panel",
          "wireTag",
          "polyline",
          "arrow",
        ].includes(newMarkup.type)
      ) {
        const props = newMarkup.properties || {};
        if (elecConfig.subject) props.subject = elecConfig.subject;
        if (elecConfig.defaultText && !props.text)
          props.text = elecConfig.defaultText;
        if (elecConfig.customProps) {
          Object.entries(elecConfig.customProps).forEach(([k, v]) => {
            props[k] = v;
          });
        }
        newMarkup.properties = props;
        // Keep config active for rapid placement (don't clear)
      }

      // ['*'] = everyone can edit/delete by default
      const res = await createMarkup({
        ...newMarkup,
        documentId,
        pageNumber: newMarkup.pageNumber ?? 0,
        allowedEditUserIds: userSettings.allowOthersEdit ? ["*"] : [],
        allowedDeleteUserIds: userSettings.allowOthersDelete ? ["*"] : [],
      });
      if (res?.id)
        pushHistory({ type: "create", markupId: res.id, after: res });
      refetchMarkups();
      return res;
    },
    [
      documentId,
      refetchMarkups,
      createMarkup,
      pushHistory,
      projectUsers,
      currentPage,
    ],
  );

  // Snapshot of markups when entering draft mode (for revert on discard)
  const draftSnapshotRef = useRef<any[]>([]);
  const prevDocIdRef = useRef<string | undefined>(documentId);

  // Draft mode — NO persistence (temporary by design, lost on reload)

  // --- Draft / Personal Mode wrappers ---
  // In draft mode ALL operations (add/modify/delete) go to draftMarkups (local copy).
  // On Apply: diff against snapshot, push changes to Y.js.
  // On Discard: revert to snapshot (no Y.js changes).
  const handleMarkupAddedDraft = useCallback(
    async (m: any) => {
      // Apply review stamp properties (text, subject, stampShape, etc.)
      const stamp = activeReviewStampRef.current;
      if (stamp && m.type === 'reviewStamp') {
        const props = { ...(m.properties || {}) };
        props.subject = stamp.subject;
        if (stamp.status) props.status = stamp.status;
        if (stamp.defaultText) props.text = stamp.defaultText;
        if (stamp.lineStyle) props.lineStyle = stamp.lineStyle;
        if (stamp.customProps) Object.entries(stamp.customProps).forEach(([k, v]) => { props[k] = v; });
        props.reviewStamp = stamp.id;
        if (userSettings.pulseReviewMarkups) props.pulse = true;
        m = { ...m, properties: props };
        activeReviewStampRef.current = null;
      }
      // Apply electrical config for electrical types
      const elecConfig = activeElectricalConfigRef.current;
      if (elecConfig && ['electricalBox', 'stub', 'panel', 'wireTag'].includes(m.type)) {
        const props = { ...(m.properties || {}) };
        if (elecConfig.subject) props.subject = elecConfig.subject;
        if (elecConfig.defaultText && !props.text) props.text = elecConfig.defaultText;
        if (elecConfig.customProps) Object.entries(elecConfig.customProps).forEach(([k, v]) => { props[k] = v; });
        m = { ...m, properties: props };
      }
      // Merge Tool Chest preset extra props (fill, fontSize, etc.) into markup properties
      let mWithPreset = m;
      const pendingPreset = pendingPresetPropsRef.current;
      if (pendingPreset && pendingPreset.markupType === m.type) {
        mWithPreset = {
          ...m,
          properties: { ...m.properties, ...pendingPreset.extraProps },
        };
      }
      // Stamp sessionId into every markup so we can identify which session created it
      const stamped = {
        ...mWithPreset,
        properties: { ...mWithPreset.properties, sessionId },
      };
      if (collabMode === "draft" || collabMode === "edit") {
        const draftId = stamped.id || crypto.randomUUID();
        const newDraft = {
          ...stamped,
          id: draftId,
          authorId: user?.id,
          authorName: user?.name || user?.email || "Unknown",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          properties: { ...stamped.properties, _draftNew: true },
        };
        setDraftMarkups((prev) => [...prev, newDraft]);
        pushHistory({ type: "create", markupId: draftId, after: newDraft });
      } else if (collabMode === "personal") {
        const newId = stamped.id || crypto.randomUUID();
        const newMarkup = {
          ...stamped,
          id: newId,
          authorId: user?.id,
          author: {
            id: user?.id || "",
            name: user?.name || user?.email || "Unknown",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setPersonalMarkups((prev) => {
          const next = [...prev, newMarkup];
          if (documentId)
            try {
              localStorage.setItem(
                `personal-markups-${documentId}`,
                JSON.stringify(next),
              );
            } catch {
              /* */
            }
          return next;
        });
        pushHistory({ type: "create", markupId: newId, after: newMarkup });
      } else {
        // Live mode: goes to Y.js immediately, track session ID
        const res = await handleMarkupAdded(stamped);
        if (collabMode === "live" && res?.id) {
          liveSessionMarkupIds.current.add(res.id);
          pushHistory({ type: "create", markupId: res.id, after: res });
        }
      }
      // Auto-select after draw: switch back to select tool
      if (userSettings.autoSelectAfterDraw) {
        setTimeout(() => setTool('select'), 50);
      }
    },
    [collabMode, handleMarkupAdded, user, documentId, sessionId, pushHistory, userSettings.autoSelectAfterDraw],
  );

  const handleMarkupModifiedDraft = useCallback(
    async (modifiedMarkup: any) => {
      if (collabMode === "draft" || collabMode === "edit") {
        // Modify in local draftMarkups (includes both new drafts and snapshotted existing markups)
        const before = draftMarkupsRef.current.find(
          (dm: any) => dm.id === modifiedMarkup.id,
        );
        setDraftMarkups((prev) =>
          prev.map((dm) => {
            if (dm.id !== modifiedMarkup.id) return dm;
            return {
              ...dm,
              coordinates: modifiedMarkup.coordinates ?? dm.coordinates,
              properties: modifiedMarkup.properties
                ? { ...dm.properties, ...modifiedMarkup.properties }
                : dm.properties,
              updatedAt: new Date().toISOString(),
            };
          }),
        );
        if (before)
          pushHistory({
            type: "update",
            markupId: modifiedMarkup.id,
            before,
            after: { ...before, ...modifiedMarkup },
          });
        return;
      } else if (collabMode === "personal") {
        // Modify only markups in personalMarkups (check inside updater to avoid stale closure)
        const before = personalMarkupsRef.current.find(
          (pm: any) => pm.id === modifiedMarkup.id,
        );
        setPersonalMarkups((prev) => {
          const isOwn = prev.some((pm: any) => pm.id === modifiedMarkup.id);
          if (!isOwn) return prev; // not a personal markup — ignore
          const next = prev.map((pm) => {
            if (pm.id !== modifiedMarkup.id) return pm;
            return {
              ...pm,
              coordinates: modifiedMarkup.coordinates ?? pm.coordinates,
              properties: modifiedMarkup.properties
                ? { ...pm.properties, ...modifiedMarkup.properties }
                : pm.properties,
              updatedAt: new Date().toISOString(),
            };
          });
          if (documentId)
            try {
              localStorage.setItem(
                `personal-markups-${documentId}`,
                JSON.stringify(next),
              );
            } catch {
              /* */
            }
          return next;
        });
        if (before)
          pushHistory({
            type: "update",
            markupId: modifiedMarkup.id,
            before,
            after: { ...before, ...modifiedMarkup },
          });
        return;
      }
      // Live mode: verify session ownership before modifying Y.js
      if (collabMode === "live") {
        const mk = (markups || []).find((m: any) => m.id === modifiedMarkup.id);
        if (mk && mk.properties?.sessionId !== sessionId) return; // not our session
        const before = mk;
        await handleMarkupModified(modifiedMarkup);
        if (before)
          pushHistory({
            type: "update",
            markupId: modifiedMarkup.id,
            before,
            after: { ...before, ...modifiedMarkup },
          });
        return;
      }
      await handleMarkupModified(modifiedMarkup);
    },
    [
      collabMode,
      handleMarkupModified,
      documentId,
      sessionId,
      markups,
      personalMarkups,
      pushHistory,
    ],
  );

  const handleDeleteMarkupDraft = useCallback(
    async (markupIds: string | string[]) => {
      const ids = Array.isArray(markupIds) ? markupIds : [markupIds];
      if (collabMode === "draft" || collabMode === "edit") {
        // Delete from local draftMarkups only (never touches Y.js in draft/edit mode)
        const deleted = draftMarkupsRef.current.filter((dm: any) =>
          ids.includes(dm.id),
        );
        setDraftMarkups((prev) => prev.filter((dm) => !ids.includes(dm.id)));
        setSelectedMarkupIds((prev) => {
          const next = prev.filter((id) => !ids.includes(id));
          if (next.length === 0) setPropertiesOpen(false);
          return next;
        });
        deleted.forEach((dm) =>
          pushHistory({ type: "delete", markupId: dm.id, before: dm }),
        );
      } else if (collabMode === "personal") {
        const deleted = personalMarkupsRef.current.filter((pm: any) =>
          ids.includes(pm.id),
        );
        setPersonalMarkups((prev) => {
          const next = prev.filter((pm) => !ids.includes(pm.id));
          if (documentId)
            try {
              localStorage.setItem(
                `personal-markups-${documentId}`,
                JSON.stringify(next),
              );
            } catch {
              /* */
            }
          return next;
        });
        setSelectedMarkupIds((prev) => {
          const next = prev.filter((id) => !ids.includes(id));
          if (next.length === 0) setPropertiesOpen(false);
          return next;
        });
        deleted.forEach((pm) =>
          pushHistory({ type: "delete", markupId: pm.id, before: pm }),
        );
      } else {
        // Live mode: only allow deleting markups created in THIS session
        if (collabMode === "live") {
          const ownIds = ids.filter((id) => {
            const mk = (markups || []).find((m: any) => m.id === id);
            return mk?.properties?.sessionId === sessionId;
          });
          if (ownIds.length === 0) return;
          const deletedLive = (markups || []).filter((m: any) =>
            ownIds.includes(m.id),
          );
          await handleDeleteMarkup(ownIds.length === 1 ? ownIds[0] : ownIds);
          deletedLive.forEach((m) =>
            pushHistory({ type: "delete", markupId: m.id, before: m }),
          );
        } else {
          await handleDeleteMarkup(markupIds);
        }
      }
    },
    [
      collabMode,
      handleDeleteMarkup,
      documentId,
      markups,
      sessionId,
      pushHistory,
    ],
  );

  // Helper: clear edit mode localStorage
  const clearEditStorage = useCallback(() => {
    if (!documentId) return;
    localStorage.removeItem(`edit-drafts-${documentId}`);
    localStorage.removeItem(`edit-snapshot-${documentId}`);
    localStorage.removeItem(`edit-userId-${documentId}`);
  }, [documentId]);

  const handleApplyDrafts = useCallback(async () => {
    // Use ref to always read the latest draftMarkups (avoids stale closure)
    const drafts = draftMarkupsRef.current;
    const snapshot = draftSnapshotRef.current;
    const snapshotMap = new Map(snapshot.map((m: any) => [m.id, m]));
    const currentMap = new Map(drafts.map((m: any) => [m.id, m]));
    let count = 0;

    // 1. New markups (not in snapshot)
    for (const dm of drafts) {
      if (dm.properties?._draftNew) {
        const { _draftNew, ...cleanProps } = dm.properties;
        await handleMarkupAdded({
          ...dm,
          id: undefined,
          properties: cleanProps,
        });
        count++;
      }
    }

    // 2. Modified markups (in snapshot, but changed)
    for (const dm of drafts) {
      if (dm.properties?._draftNew) continue;
      const orig = snapshotMap.get(dm.id);
      if (!orig) continue;
      if (JSON.stringify(orig) !== JSON.stringify(dm)) {
        await handleMarkupModified({
          id: dm.id,
          coordinates: dm.coordinates,
          properties: dm.properties,
        });
        count++;
      }
    }

    // 3. Deleted markups (in snapshot, not in current)
    const deletedIds = snapshot
      .filter((m: any) => !currentMap.has(m.id))
      .map((m: any) => m.id);
    if (deletedIds.length > 0) {
      await handleDeleteMarkup(deletedIds);
      count += deletedIds.length;
    }

    // Release edit lock if we were in edit mode
    if (collabMode === "edit") {
      const provider = getYjsProvider(documentId || "");
      if (provider) {
        provider.awareness.setLocalStateField("user", {
          ...provider.awareness.getLocalState()?.user,
          editLock: false,
        });
      }
    }

    setDraftMarkups([]);
    draftSnapshotRef.current = [];
    clearEditStorage();
    if (documentId) localStorage.removeItem(`draft-state-${documentId}`);
    // Rotate sessionId so published markups become locked in Personal/Live
    setSessionId(crypto.randomUUID());
    setCollabMode("personal");
    toast.success(`Applied ${count} change(s)`, { duration: 2000 });
    // Refresh markup history panel so new events appear immediately
    queryClient.invalidateQueries({ queryKey: ["markup-history", documentId] });
  }, [
    draftMarkups,
    handleMarkupAdded,
    handleMarkupModified,
    handleDeleteMarkup,
    documentId,
    collabMode,
    clearEditStorage,
    queryClient,
  ]);

  const handleDiscardDrafts = useCallback(() => {
    // Revert: just clear draftMarkups, Y.js was never touched
    // Release edit lock if we were in edit mode
    if (collabMode === "edit") {
      const provider = getYjsProvider(documentId || "");
      if (provider) {
        provider.awareness.setLocalStateField("user", {
          ...provider.awareness.getLocalState()?.user,
          editLock: false,
        });
      }
    }

    setDraftMarkups([]);
    draftSnapshotRef.current = [];
    clearEditStorage();
    if (documentId) localStorage.removeItem(`draft-state-${documentId}`);
    setCollabMode("personal");
    toast("Discarded all draft/edit changes", { duration: 1500 });
  }, [documentId, collabMode, clearEditStorage]);

  // --- Collaboration Mode handlers ---
  const handleCollabModeChange = useCallback(
    (mode: CollabMode) => {
      const prevMode = collabMode;
      if (mode === prevMode) return;

      // --- Leaving Live mode: clear session tracking ---
      if (prevMode === "live" && mode !== "live") {
        liveSessionMarkupIds.current.clear();
      }

      // --- Leaving Personal mode: check for unsaved personal markups ---
      if (prevMode === "personal" && mode !== "personal" && mode !== "live") {
        // Live mode auto-publishes, so no dialog needed for personal→live
        if (personalMarkups.length > 0) {
          setDiscardDialog({
            open: true,
            message: `You have ${personalMarkups.length} unsaved personal markup(s). Discard them?`,
            targetMode: mode,
          });
          return;
        }
        // Clean up localStorage
        if (documentId)
          localStorage.removeItem(`personal-markups-${documentId}`);
        setPersonalMarkups([]);
      }

      // --- Leaving Edit mode: check for unsaved changes ---
      if (prevMode === "edit" && mode !== "edit") {
        // Release edit lock
        const provider = getYjsProvider(documentId || "");
        if (provider) {
          provider.awareness.setLocalStateField("user", {
            ...provider.awareness.getLocalState()?.user,
            editLock: false,
          });
        }
        // Check for unsaved edit changes
        const markupKey = (m: any) =>
          JSON.stringify({ c: m.coordinates, p: m.properties });
        const hasRealChanges =
          draftMarkups.some((m: any) => m.properties?._draftNew) ||
          draftSnapshotRef.current.some(
            (s: any) => !draftMarkups.find((d: any) => d.id === s.id),
          ) ||
          draftMarkups.some((d: any) => {
            const orig = draftSnapshotRef.current.find(
              (s: any) => s.id === d.id,
            );
            return orig && markupKey(orig) !== markupKey(d);
          });
        if (hasRealChanges) {
          setDiscardDialog({
            open: true,
            message: "You have unsaved edit changes. Discard them?",
            targetMode: mode,
          });
          return;
        }
        setDraftMarkups([]);
        draftSnapshotRef.current = [];
        clearEditStorage();
      }

      // --- Leaving Draft mode: check for unsaved changes ---
      if (prevMode === "draft" && mode !== "draft") {
        const markupKey = (m: any) =>
          JSON.stringify({ c: m.coordinates, p: m.properties });
        const hasRealChanges =
          draftMarkups.some((m: any) => m.properties?._draftNew) ||
          draftSnapshotRef.current.some(
            (s: any) => !draftMarkups.find((d: any) => d.id === s.id),
          ) ||
          draftMarkups.some((d: any) => {
            const orig = draftSnapshotRef.current.find(
              (s: any) => s.id === d.id,
            );
            return orig && markupKey(orig) !== markupKey(d);
          });
        if (hasRealChanges) {
          setDiscardDialog({
            open: true,
            message: "You have unsaved draft changes. Discard them?",
            targetMode: mode,
          });
          return;
        }
        setDraftMarkups([]);
        draftSnapshotRef.current = [];
      }

      // --- Entering Personal mode ---
      if (mode === "personal") {
        setPersonalMarkups([]);
        liveSessionMarkupIds.current.clear();
        toast("Personal mode \u2014 create new markups, view existing", {
          icon: "\uD83D\uDD35",
          duration: 2000,
        });
      }

      // --- Entering Live mode ---
      if (mode === "live") {
        // If coming from personal with unpublished markups, publish them first
        if (prevMode === "personal" && personalMarkups.length > 0) {
          toast("Publishing personal markups before going live", {
            duration: 2000,
          });
          // Async publish — fire and forget, markups go to Y.js
          (async () => {
            for (const m of personalMarkups) {
              try {
                await handleMarkupAdded({ ...m, id: undefined });
              } catch {
                /* */
              }
            }
            setPersonalMarkups([]);
            if (documentId)
              localStorage.removeItem(`personal-markups-${documentId}`);
            // Rotate sessionId — published markups become locked
            setSessionId(crypto.randomUUID());
          })();
        }
        liveSessionMarkupIds.current.clear();
        toast("Live mode \u2014 real-time collaboration", {
          icon: "\uD83D\uDFE2",
          duration: 2000,
        });
      }

      // --- Entering Edit mode (exclusive lock, snapshot all, work locally) ---
      if (mode === "edit") {
        if (editLockUser) {
          toast.error(`${editLockUser.name} is currently editing`, {
            duration: 3000,
          });
          return;
        }
        // Set edit lock via awareness
        const provider = getYjsProvider(documentId || "");
        if (provider) {
          provider.awareness.setLocalStateField("user", {
            ...provider.awareness.getLocalState()?.user,
            editLock: true,
            editLockTime: Date.now(),
          });
        }
        // Snapshot ALL current markups into draftMarkups for full local editing
        const snapshot = [...(markups || [])];
        draftSnapshotRef.current = snapshot;
        setDraftMarkups(snapshot);
        toast.success(
          "Edit mode \u2014 document locked for you. Publish or Discard when done.",
          { duration: 2000 },
        );
      }

      // --- Entering Draft mode (legacy, hidden but preserved) ---
      if (mode === "draft" && prevMode !== "draft") {
        const snapshot = [...(markups || [])];
        draftSnapshotRef.current = snapshot;
        setDraftMarkups(snapshot);
      }

      // QA/QC mode (hidden but code preserved)
      if (mode === "qaqc") {
        setQaqcMode(true);
      } else if (prevMode === "qaqc") {
        setQaqcMode(false);
        setQaqcPanelOpen(false);
        setSpellErrors([]);
      }

      setCollabMode(mode);
    },
    [
      collabMode,
      markups,
      documentId,
      draftMarkups,
      editLockUser,
      personalMarkups,
      handleMarkupAdded,
      clearEditStorage,
    ],
  );

  // Confirm discard handler — called when user accepts the discard dialog.
  // Directly transitions mode without re-checking (avoids double-discard).
  const handleDiscardConfirm = useCallback(() => {
    const mode = discardDialog.targetMode;
    setDiscardDialog({ open: false, message: "", targetMode: null });
    if (!mode) return;

    // Release edit lock if leaving edit mode
    if (collabMode === "edit") {
      const provider = getYjsProvider(documentId || "");
      if (provider) {
        provider.awareness.setLocalStateField("user", {
          ...provider.awareness.getLocalState()?.user,
          editLock: false,
        });
      }
    }

    // Clean up all local state from the current mode
    setDraftMarkups([]);
    draftSnapshotRef.current = [];
    clearEditStorage();
    setPersonalMarkups([]);
    if (documentId) localStorage.removeItem(`personal-markups-${documentId}`);
    liveSessionMarkupIds.current.clear();

    // Apply target mode directly
    setCollabMode(mode);

    // Mode-specific setup
    if (mode === "personal") {
      toast("Personal mode — create new markups, view existing", {
        icon: "\uD83D\uDD35",
        duration: 2000,
      });
    } else if (mode === "live") {
      liveSessionMarkupIds.current.clear();
      toast.success("Live mode — real-time collaboration", { duration: 2000 });
    } else if (mode === "edit") {
      const snapshot = [...(markups || [])];
      draftSnapshotRef.current = snapshot;
      setDraftMarkups(snapshot);
      toast.success("Edit mode — document locked for you", { duration: 2000 });
    }
  }, [
    discardDialog.targetMode,
    collabMode,
    documentId,
    markups,
    clearEditStorage,
  ]);

  const handlePublishPersonal = useCallback(async () => {
    if (!documentId) return;
    // Use ref to always read the latest personal markups (avoids stale closure)
    const toPublish = personalMarkupsRef.current;
    if (toPublish.length === 0) return;
    let count = 0;
    let failed = 0;
    for (const m of toPublish) {
      try {
        await handleMarkupAdded({ ...m, id: undefined });
        count++;
      } catch {
        failed++;
      }
    }

    setPersonalMarkups([]);
    personalSnapshotRef.current = [];
    localStorage.removeItem(`personal-markups-${documentId}`);
    setSessionId(crypto.randomUUID());
    toast.success(`Published ${count} markup(s)`, { duration: 2000 });
    if (failed > 0)
      toast.error(`${failed} markup(s) failed to publish`, { duration: 3000 });
    // Refresh markup history panel so new events appear immediately
    queryClient.invalidateQueries({ queryKey: ["markup-history", documentId] });
  }, [documentId, handleMarkupAdded, queryClient]);

  const handleDiscardPersonal = useCallback(() => {
    if (!documentId) return;
    // Y.js stays connected — just clear local personal markups
    setPersonalMarkups([]);
    personalSnapshotRef.current = [];
    localStorage.removeItem(`personal-markups-${documentId}`);
    toast("Discarded personal markups", { duration: 1500 });
  }, [documentId]);

  // Edit lock heartbeat — refresh timestamp every 60s so other clients know the lock is alive.
  // If a user disconnects (closes tab/loses internet), the lock becomes stale after LOCK_TTL.
  const LOCK_TTL = 5 * 60 * 1000; // 5 minutes
  useEffect(() => {
    if (collabMode !== "edit" || !documentId) return;
    const iv = setInterval(() => {
      const provider = getYjsProvider(documentId);
      if (provider) {
        provider.awareness.setLocalStateField("user", {
          ...provider.awareness.getLocalState()?.user,
          editLock: true,
          editLockTime: Date.now(),
        });
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, [collabMode, documentId]);

  // Persist Edit mode drafts to localStorage — only if there are real changes
  useEffect(() => {
    if (!documentId || collabMode !== "edit") return;
    const snap = draftSnapshotRef.current;
    const markupKey = (m: any) =>
      JSON.stringify({ c: m.coordinates, p: m.properties });
    const hasNew = draftMarkups.some((m: any) => m.properties?._draftNew);
    const hasDeleted = snap.some(
      (s: any) => !draftMarkups.find((d: any) => d.id === s.id),
    );
    const hasModified = draftMarkups.some((d: any) => {
      if (d.properties?._draftNew) return false;
      const orig = snap.find((s: any) => s.id === d.id);
      return orig && markupKey(orig) !== markupKey(d);
    });
    if (hasNew || hasDeleted || hasModified) {
      try {
        localStorage.setItem(
          `edit-drafts-${documentId}`,
          JSON.stringify(draftMarkups),
        );
        localStorage.setItem(
          `edit-snapshot-${documentId}`,
          JSON.stringify(snap),
        );
        localStorage.setItem(`edit-userId-${documentId}`, user?.id || "");
      } catch {
        /* */
      }
    } else {
      // No real changes — don't persist (clean reload will go to Personal)
      clearEditStorage();
    }
  }, [draftMarkups, collabMode, documentId, user?.id, clearEditStorage]);

  // Visible markups -- depends on collab mode
  const visibleMarkups = useMemo(() => {
    if (collabMode === "draft" || collabMode === "qaqc") {
      return (draftMarkups.length > 0 ? draftMarkups : markups || []).filter(
        Boolean,
      );
    }
    if (collabMode === "edit") {
      // Edit mode uses draftMarkups as the local working copy — no fallback to Y.js markups
      // so that deletions are immediately reflected (draftMarkups.length can be 0 after all deletes)
      return draftMarkups.filter(Boolean);
    }
    if (collabMode === "personal") {
      // Personal: Y.js markups (read-only) + personal session markups (editable)
      return [...(markups || []), ...personalMarkups].filter(Boolean);
    }
    // live — all see the same Y.js markups
    return (markups || []).filter(Boolean);
  }, [collabMode, markups, draftMarkups, personalMarkups, user?.id]);

  // Auto-refresh markup history when markups change (live mode, or after Y.js sync)
  const markupsLenRef = useRef(0);
  useEffect(() => {
    const len = (markups || []).length;
    if (len !== markupsLenRef.current && markupsLenRef.current > 0) {
      // Markups array changed — debounce history refresh
      const t = setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["markup-history", documentId],
        });
      }, 1500);
      markupsLenRef.current = len;
      return () => clearTimeout(t);
    }
    markupsLenRef.current = len;
  }, [markups, documentId, queryClient]);

  const handleGenerateRoutes = useCallback(
    async (startPoint: { x: number; y: number }) => {
      if (!routePanelClickData) return;
      const { templateId, endpoints, spacing } = routePanelClickData;
      const template = (markups || []).find((m: any) => m.id === templateId);
      if (!template?.coordinates?.points) return;
      const backbone = template.coordinates.points as {
        x: number;
        y: number;
      }[];

      if (endpoints.length === 0) {
        toast.error("Select at least one markup (device) first", {
          duration: 2000,
        });
        routeModeRef.current = "off";
        setRoutePanelClickMode(false);
        return;
      }

      const epData = endpoints.map((m: any) => {
        const c = m.coordinates || {};
        let cx: number, cy: number;
        if (c.points && c.points.length > 0) {
          cx =
            c.points.reduce((s: number, p: any) => s + p.x, 0) /
            c.points.length;
          cy =
            c.points.reduce((s: number, p: any) => s + p.y, 0) /
            c.points.length;
        } else {
          cx = (c.left || 0) + (c.width || 0) / 2;
          cy = (c.top || 0) + (c.height || 0) / 2;
        }
        return {
          point: { x: cx, y: cy },
          label: m.properties?.subject || m.id?.slice(0, 6) || "",
        };
      });
      const conduit = routePanelClickData.conduit as any;
      const routes = generateRoutes(startPoint, epData, backbone, spacing);
      for (const r of routes) {
        await handleMarkupAddedDraft({
          type: "polyline",
          pageNumber: currentPage - 1,
          coordinates: { points: r.points },
          properties: {
            stroke: conduit?.conduitSize ? "#1565c0" : "#FF0000",
            strokeWidth: conduit?.strokeWidth || 2,
            lineStyle: "solid",
            from: r.from,
            to: r.to,
            showLength: true,
            subject: conduit?.conduitSize
              ? `Conduit ${conduit.conduitSize}`
              : `Route ${r.from} → ${r.to}`,
            ...(conduit?.conduitSize
              ? {
                  conduitSize: conduit.conduitSize,
                  redlineLabel: conduit.conduitSize,
                }
              : {}),
          },
        });
      }
      toast.success(`Created ${routes.length} route(s)`, { duration: 2000 });
      // Clean up state after device routing
      routeModeRef.current = "off";
      setRoutePanelClickMode(false);
      setRoutePanelClickData(null);
    },
    [routePanelClickData, markups, handleMarkupAddedDraft, currentPage],
  );

  // Multi-click route: finish on double-click -- creates route from collected points along backbone
  const handleFinishMultiClickRoute = useCallback(async () => {
    const pts = routePointsRef.current;
    if (pts.length < 2 || !routePanelClickData) {
      routeModeRef.current = "off";
      routePointsRef.current = [];
      setRouteMultiClickMode(false);
      setRouteMultiClickPoints([]);
      return;
    }
    const { templateId, spacing } = routePanelClickData;
    const template = (markups || []).find((m: any) => m.id === templateId);
    const backbone = template?.coordinates?.points as
      | { x: number; y: number }[]
      | undefined;

    // Create route segments: A→B, B→C, C→D etc.
    for (let i = 0; i < pts.length - 1; i++) {
      const start = pts[i];
      const end = pts[i + 1];
      let routePoints: { x: number; y: number }[];

      if (backbone && backbone.length >= 2) {
        routePoints = buildRoute(start, end, backbone, 0, 0);
      } else {
        routePoints = [start, end];
      }

      await handleMarkupAddedDraft({
        type: "route",
        pageNumber: currentPage - 1,
        coordinates: { points: routePoints },
        properties: {
          stroke: "#FF0000",
          strokeWidth: 2,
          lineStyle: "solid",
          from: `Point ${String.fromCharCode(65 + i)}`,
          to: `Point ${String.fromCharCode(65 + i + 1)}`,
          showLength: false,
        },
      });
    }
    toast.success(`Created ${pts.length - 1} route segment(s)`, {
      duration: 2000,
    });
    routeModeRef.current = "off";
    routePointsRef.current = [];
    setRouteMultiClickMode(false);
    setRouteMultiClickPoints([]);
    setRoutePanelClickData(null);
  }, [routePanelClickData, markups, handleMarkupAddedDraft, currentPage]);

  const handleHighlightAll = useCallback(
    async (color: string) => {
      if (!searchResults.length || !pageDimensions.width) return;
      const pageW = pageDimensions.width;
      const pageH = pageDimensions.height;
      for (const result of searchResults) {
        if ((result as any).markupId) continue;
        if (!result.w || !result.h) continue;
        await handleMarkupAddedDraft({
          type: "highlighter",
          pageNumber: result.pageIndex,
          coordinates: {
            left: result.x / pageW,
            top: result.y / pageH,
            width: result.w / pageW,
            height: result.h / pageH,
          },
          properties: {
            stroke: color,
            strokeWidth: 12,
            originalWidth: pageW,
            originalHeight: pageH,
          },
        });
      }
    },
    [searchResults, pageDimensions, handleMarkupAddedDraft],
  );

  const handleDuplicateMarkups = useCallback(async () => {
    const toDup = selectedMarkups.length > 0 ? [...selectedMarkups] : [];
    if (toDup.length === 0 && contextMenu?.markupId) {
      const m = (markups || []).find((m: any) => m.id === contextMenu.markupId);
      if (m) toDup.push(m);
    }
    if (toDup.length === 0) return;
    for (const m of toDup) {
      const { id, author, createdAt, authorId, pageNumber, ...rest } = m;
      const coords = { ...rest.coordinates };
      // Offset so duplicate is visibly shifted; keep on the original markup's page
      const off = 0.04;
      if (coords.left !== undefined) {
        coords.left = Math.min(0.95, coords.left + off);
        coords.top = Math.min(0.95, coords.top + off);
      } else if (coords.x1 !== undefined) {
        coords.x1 += off;
        coords.y1 += off;
        coords.x2 += off;
        coords.y2 += off;
      }
      const newProps = JSON.parse(JSON.stringify(rest.properties || {}));

      // Prevent duplicate notifications; clear comment on duplicate (custom params preserved)
      newProps.isPastedOrDuplicated = true;
      delete newProps.comment; // Don't duplicate comments
      if (newProps.subject)
        newProps.subject = newProps.subject.replace(
          /@([a-zA-Z0-9_.\-\s]+)/g,
          "$1",
        );

      // Route through handleMarkupAddedDraft so it respects current mode (Personal/Edit/Live)
      await handleMarkupAddedDraft({
        ...rest,
        type: m.type,
        coordinates: coords,
        properties: newProps,
        pageNumber: m.pageNumber,
        allowedEditUserIds: m.allowedEditUserIds ?? ["*"],
        allowedDeleteUserIds: m.allowedDeleteUserIds ?? ["*"],
      });
    }
  }, [
    selectedMarkups,
    contextMenu,
    markups,
    handleMarkupAddedDraft,
    currentPage,
    documentId,
    projectUsers,
  ]);

  const handleMarkupAction = useCallback(
    (action: string, markupId: string) => {
      if (action === "duplicate") {
        handleDuplicateMarkups();
        return;
      }
      // Search in all visible markups (including personal/draft mode markups)
      const allVisible = [...(markups || []), ...personalMarkups, ...draftMarkups];
      const m = allVisible.find((m: any) => m.id === markupId);
      if (!m) return;
      if (action === "lock" || action === "unlock") {
        // Only owner, admin, or users in allowedEditUserIds can lock/unlock
        const canLock =
          isAdmin ||
          (user?.id != null && m.authorId === user.id) ||
          !m.allowedEditUserIds ||
          m.allowedEditUserIds.includes("*") ||
          (m.allowedEditUserIds.length > 0 &&
            user?.id != null &&
            m.allowedEditUserIds.includes(user.id));
        if (!canLock) {
          toast.error("Cannot lock/unlock — no edit permission", {
            duration: 2000,
          });
          return;
        }
        handleUpdateProperties(markupId, {
          properties: { ...m.properties, locked: action === "lock" },
        });
        return;
      }
      // Check edit permission before z-order change
      const canEditZ =
        isAdmin ||
        (user?.id != null && m.authorId === user.id) ||
        !m.allowedEditUserIds ||
        m.allowedEditUserIds.includes("*") ||
        (m.allowedEditUserIds.length > 0 &&
          user?.id != null &&
          m.allowedEditUserIds.includes(user.id));
      if (!canEditZ || m.properties?.locked) {
        toast.error("Cannot reorder — markup is locked or no permission", {
          duration: 2000,
        });
        return;
      }
      const sorted = [...allVisible].sort(
        (a, b) => (a.properties?.zIndex || 0) - (b.properties?.zIndex || 0),
      );
      const minZ = sorted[0]?.properties?.zIndex || 0,
        maxZ = sorted[sorted.length - 1]?.properties?.zIndex || 0;
      let newZ = m.properties?.zIndex || 0;
      if (action === "front") newZ = maxZ + 1;
      else if (action === "back") newZ = minZ - 1;
      else if (action === "forward") newZ += 1;
      else if (action === "backward") newZ -= 1;
      // Only send zIndex — don't spread m.properties to avoid overwriting other markups' data
      handleUpdateProperties(markupId, {
        properties: { zIndex: newZ },
      });
    },
    [markups, personalMarkups, draftMarkups, handleDuplicateMarkups, handleUpdateProperties, isAdmin, user],
  );

  // Clear undo/redo history on mode switch
  useEffect(() => {
    clearHistory();
  }, [collabMode, clearHistory]);

  const handleUndo = useCallback(async () => {
    const action = undo();
    if (!action) return;
    try {
      if (collabMode === "personal") {
        // Personal mode: undo in local personalMarkups
        if (action.type === "create") {
          setPersonalMarkups((prev) =>
            prev.filter((m) => m.id !== action.markupId),
          );
        } else if (action.type === "update" && action.before) {
          setPersonalMarkups((prev) =>
            prev.map((m) =>
              m.id === action.markupId ? { ...m, ...action.before } : m,
            ),
          );
        } else if (action.type === "delete" && action.before) {
          setPersonalMarkups((prev) => [...prev, action.before]);
        }
      } else if (collabMode === "edit" || collabMode === "draft") {
        // Edit/Draft mode: undo in local draftMarkups
        if (action.type === "create") {
          setDraftMarkups((prev) =>
            prev.filter((m) => m.id !== action.markupId),
          );
        } else if (action.type === "update" && action.before) {
          setDraftMarkups((prev) =>
            prev.map((m) =>
              m.id === action.markupId ? { ...m, ...action.before } : m,
            ),
          );
        } else if (action.type === "delete" && action.before) {
          setDraftMarkups((prev) => [...prev, action.before]);
        }
      } else {
        // Live mode: undo via server API
        if (action.type === "create") await deleteMarkupAPI(action.markupId);
        else if (action.type === "update" && action.before)
          await updateMarkupAPI({ id: action.markupId, ...action.before });
        else if (action.type === "delete" && action.before)
          await createMarkup(action.before);
        refetchMarkups();
      }
    } catch (e) {
      console.error(e);
      toast.error("Undo failed", { duration: 2000 });
    }
  }, [
    undo,
    collabMode,
    deleteMarkupAPI,
    updateMarkupAPI,
    createMarkup,
    refetchMarkups,
  ]);

  const handleRedo = useCallback(async () => {
    const action = redo();
    if (!action) return;
    try {
      if (collabMode === "personal") {
        if (action.type === "create" && action.after) {
          setPersonalMarkups((prev) => [...prev, action.after]);
        } else if (action.type === "update" && action.after) {
          setPersonalMarkups((prev) =>
            prev.map((m) =>
              m.id === action.markupId ? { ...m, ...action.after } : m,
            ),
          );
        } else if (action.type === "delete") {
          setPersonalMarkups((prev) =>
            prev.filter((m) => m.id !== action.markupId),
          );
        }
      } else if (collabMode === "edit" || collabMode === "draft") {
        if (action.type === "create" && action.after) {
          setDraftMarkups((prev) => [...prev, action.after]);
        } else if (action.type === "update" && action.after) {
          setDraftMarkups((prev) =>
            prev.map((m) =>
              m.id === action.markupId ? { ...m, ...action.after } : m,
            ),
          );
        } else if (action.type === "delete") {
          setDraftMarkups((prev) =>
            prev.filter((m) => m.id !== action.markupId),
          );
        }
      } else {
        // Live mode: redo via server API
        if (action.type === "create" && action.after)
          await createMarkup(action.after);
        else if (action.type === "update" && action.after)
          await updateMarkupAPI({ id: action.markupId, ...action.after });
        else if (action.type === "delete")
          await deleteMarkupAPI(action.markupId);
        refetchMarkups();
      }
    } catch (e) {
      console.error(e);
      toast.error("Redo failed", { duration: 2000 });
    }
  }, [
    redo,
    collabMode,
    deleteMarkupAPI,
    updateMarkupAPI,
    createMarkup,
    refetchMarkups,
  ]);

  // --- Compare handlers ------------------------------------------------------
  const handleStartCompare = useCallback(
    async (config: CompareConfig) => {
      setCompareDialogOpen(false);
      if (!token) return;
      setCompareProcessing(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(
            `/prepare/${config.oldDocId}?token=${encodeURIComponent(token)}`,
            { method: "POST" },
          ),
          fetch(
            `/prepare/${config.newDocId}?token=${encodeURIComponent(token)}`,
            { method: "POST" },
          ),
        ]);
        if (!r1.ok) throw new Error(`prepare old failed: ${r1.status}`);
        if (!r2.ok) throw new Error(`prepare new failed: ${r2.status}`);
      } catch (e) {
        toast.error("Failed to prepare revisions. Try again.", {
          duration: 3000,
        });
        setCompareProcessing(false);
        return;
      }

      setCompareShowOld(true);
      setCompareShowNew(true);
      setCompareShowMarkups(true);
      setCompareConfig(config);
      setCompareProcessing(false);

      // Auto-enter edit mode so markups placed during comparison are isolated
      if (collabMode !== "edit" && collabMode !== "draft") {
        handleCollabModeChange("edit");
      }
    },
    [token, collabMode, handleCollabModeChange],
  );

  const handleExitCompare = useCallback(() => {
    setCompareConfig(null);
    // Notify user about draft/edit markups from comparison session
    if (
      (collabMode === "draft" || collabMode === "edit") &&
      draftMarkups.length > 0
    ) {
      const newDrafts = draftMarkups.filter(
        (dm: any) => dm.properties?._draftNew,
      );
      if (newDrafts.length > 0) {
        toast(
          `You have ${newDrafts.length} markup(s) from comparison. Use Publish or Discard in the toolbar.`,
          { duration: 5000, icon: "\uD83D\uDCDD" },
        );
      } else {
        toast("Comparison closed", { duration: 1500 });
      }
    } else {
      toast("Comparison closed", { duration: 1500 });
    }
  }, [collabMode, draftMarkups]);

  // --- Detect Changes (auto-place revision clouds at changed areas) ---
  const [isDetectingChanges, setIsDetectingChanges] = useState(false);
  const handleDetectChanges = useCallback(async () => {
    if (!compareConfig || !token) return;
    setIsDetectingChanges(true);
    const toastId = toast.loading("Detecting changes...");
    try {
      const totalPages = numPages || 0;
      let totalClouds = 0;

      for (let page = 0; page < totalPages; page++) {
        // Determine old page mapping
        let oldPage = page;
        if (compareConfig.pageMode === "custom") {
          const pair = compareConfig.customMapping.find(
            (p) => p.newPage === page,
          );
          if (pair) oldPage = pair.oldPage;
        } else if (compareConfig.pageMode === "range") {
          const [start, end] = compareConfig.pageRange;
          if (page < start - 1 || page > end - 1) continue; // skip pages outside range
        }

        const res = await fetch(
          `/compare/detect/${compareConfig.oldDocId}/${documentId}/${oldPage}/${page}?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) continue;
        const regions: { x: number; y: number; w: number; h: number }[] =
          await res.json();

        for (const r of regions) {
          await handleMarkupAddedDraft({
            type: "cloud",
            pageNumber: page,
            coordinates: { left: r.x, top: r.y, width: r.w, height: r.h },
            properties: {
              stroke: "#CC0000",
              strokeWidth: 2,
              fill: "transparent",
              fillOpacity: 0,
              lineStyle: "solid",
              subject: "REVISION CLOUD",
              comment: "Auto-detected change",
              status: "none",
            },
          });
          totalClouds++;
        }

        if (totalPages > 5) {
          toast.loading(`Scanning page ${page + 1} of ${totalPages}...`, {
            id: toastId,
          });
        }
      }

      toast.success(`Found ${totalClouds} changed area(s)`, {
        id: toastId,
        duration: 3000,
      });
    } catch (e: any) {
      toast.error(`Detection failed: ${e.message}`, {
        id: toastId,
        duration: 3000,
      });
    } finally {
      setIsDetectingChanges(false);
    }
  }, [compareConfig, token, documentId, numPages, handleMarkupAddedDraft]);

  // --- QA/QC Spell Check handlers ---
  const [spellLang, setSpellLang] = useState("en_US");

  const runSpellCheck = useCallback(
    async (scope: "page" | "document", ignored: Set<string>) => {
      if (!pdfDoc) {
        toast.error("PDF not loaded yet");
        return;
      }
      setIsSpellChecking(true);
      try {
        await loadDictionary();
        const pages = scope === "page" ? [currentPage - 1] : ("all" as const);
        const errors = await checkPdfText(pdfDoc, pages);
        setSpellErrors(
          errors.filter((e) => !ignored.has(e.word.toLowerCase())),
        );
      } catch (e: any) {
        toast.error("Spell check failed");
        console.error(e);
      } finally {
        setIsSpellChecking(false);
      }
    },
    [pdfDoc, currentPage],
  );

  // Spell check runs when user opens the panel and clicks Spell Check tab, not on mode enter

  const handleToggleQaqc = useCallback(async () => {
    if (qaqcMode) {
      setQaqcMode(false);
      setSpellErrors([]);
      return;
    }
    setQaqcMode(true);
    await runSpellCheck(spellScope, ignoredWords);
  }, [qaqcMode, spellScope, ignoredWords, runSpellCheck]);

  const handleSpellScopeChange = useCallback(
    async (scope: "page" | "document") => {
      setSpellScope(scope);
      if (qaqcMode) {
        await runSpellCheck(scope, ignoredWords);
      }
    },
    [qaqcMode, ignoredWords, runSpellCheck],
  );

  // Language removed — English only

  const handleJumpToSpellError = useCallback(
    (err: SpellError) => {
      const pageIdx = err.pageNumber ?? 0;
      const TARGET_ZOOM = 2.5; // zoom in close to see the word

      if (tileViewerRef.current) {
        if (scrollMode === "page" && currentPage !== pageIdx + 1) {
          setCurrentPage(pageIdx + 1);
          tileViewerRef.current.navigateToPage(pageIdx + 1, true);
        }
        // err.x/y are normalized 0-1 from pdfjs viewport (scale=1).
        // Convert to tile-server coords (2× pdfjs).
        const tileSize = tileViewerRef.current.getPageSize(pageIdx);
        const tw = tileSize?.w || 1190;
        const th = tileSize?.h || 1684;
        const cx = (err.x ?? 0.5) * tw;
        const cy = (err.y ?? 0.5) * th;
        tileViewerRef.current.navigateToPagePoint(pageIdx, cx, cy, TARGET_ZOOM);
        tileViewerRef.current.prioritizePage(pageIdx);
        // Store active spell error for highlight overlay
        setActiveSpellError(err);
        setTimeout(() => setActiveSpellError(null), 4000); // clear highlight after 4s
      } else {
        setCurrentPage(pageIdx + 1);
      }
    },
    [scrollMode, currentPage],
  );

  // Fix word not applicable for PDF text spell check (PDF is read-only)

  const handleIgnoreSpellWord = useCallback((word: string) => {
    const lower = word.toLowerCase();
    setIgnoredWords((prev) => {
      const next = new Set(prev);
      next.add(lower);
      return next;
    });
    setSpellErrors((prev) =>
      prev.filter((e) => e.word.toLowerCase() !== lower),
    );
  }, []);

  // Toggle PDF OCG layer visibility
  const handleTogglePdfLayer = useCallback((layerName: string) => {
    setPdfLayers((prev) =>
      prev.map((l) =>
        l.name === layerName ? { ...l, visible: !l.visible } : l,
      ),
    );
    // TODO: pdfjs OCG toggle requires re-rendering pages via optionalContentConfigPromise
    // For now this just tracks state -- full render toggle requires pdfjs integration
  }, []);

  // Export comparison as PDF with OCG layers (Bluebeam compatible)
  const handleExportCompare = useCallback(async () => {
    if (!compareConfig || !token || compareProcessing) return;
    setCompareProcessing(true);
    const toastId = toast.loading("Generating comparison PDF...");
    try {
      const oldDocLabel = (() => {
        const idx = (doc?.versions || []).findIndex(
          (v: any) => v.id === compareConfig.oldDocId,
        );
        return idx >= 0 ? `Rev${(doc?.versions?.length || 0) - idx}` : "old";
      })();
      const baseName = (doc?.name || "document").replace(/\.pdf$/i, "");
      const dateSuffix = new Date().toISOString().slice(0, 10);

      await downloadComparisonPdf({
        token,
        oldDocId: compareConfig.oldDocId,
        newDocId: compareConfig.newDocId,
        oldColor: compareConfig.oldColor,
        newColor: compareConfig.newColor,
        opacity: compareConfig.opacity,
        pageMapping:
          compareConfig.pageMode === "custom"
            ? (() => {
                const map: number[] = [];
                for (let i = 0; i < numPages; i++) {
                  const pair = compareConfig.customMapping.find(
                    (p) => p.newPage === i,
                  );
                  map.push(pair ? pair.oldPage : i);
                }
                return map;
              })()
            : undefined,
        oldLabel: oldDocLabel,
        newLabel: "Current",
        filename: `${baseName}_compare_${oldDocLabel}_vs_Current_${dateSuffix}.pdf`,
        onProgress: (current, total) => {
          const phases = [
            "Downloading PDFs...",
            "Embedding pages...",
            "Building layers...",
            "Saving PDF...",
          ];
          toast.loading(phases[current] || `Processing...`, { id: toastId });
        },
      });

      toast.success("Comparison PDF downloaded", {
        id: toastId,
        duration: 3000,
      });
    } catch (e) {
      console.error("Compare export failed:", e);
      toast.error("Failed to export comparison PDF", {
        id: toastId,
        duration: 3000,
      });
    } finally {
      setCompareProcessing(false);
    }
  }, [compareConfig, compareProcessing, token, documentId, numPages, doc]);

  // Save comparison PDF to the same folder as the current document
  const handleSaveCompare = useCallback(async () => {
    if (!compareConfig || !token || !doc?.folderId || compareProcessing) return;
    setCompareProcessing(true);
    const toastId = toast.loading("Generating comparison PDF...");
    try {
      const { generateComparisonPdf } =
        await import("../utils/exportComparisonPdf");
      const oldDocLabel = (() => {
        const idx = (doc?.versions || []).findIndex(
          (v: any) => v.id === compareConfig.oldDocId,
        );
        return idx >= 0 ? `Rev${(doc?.versions?.length || 0) - idx}` : "old";
      })();
      const baseName = (doc?.name || "document").replace(/\.pdf$/i, "");
      const dateSuffix = new Date().toISOString().slice(0, 10);
      const filename = `${baseName}_compare_${oldDocLabel}_vs_Current_${dateSuffix}.pdf`;

      toast.loading("Building PDF with layers...", { id: toastId });
      const bytes = await generateComparisonPdf({
        token,
        oldDocId: compareConfig.oldDocId,
        newDocId: compareConfig.newDocId,
        oldColor: compareConfig.oldColor,
        newColor: compareConfig.newColor,
        opacity: compareConfig.opacity,
        oldLabel: oldDocLabel,
        newLabel: "Current",
        onProgress: (cur, total) => {
          const phases = [
            "Downloading...",
            "Embedding pages...",
            "Building layers...",
            "Finalizing...",
          ];
          toast.loading(phases[cur] || "Processing...", { id: toastId });
        },
      });

      // Upload to the same folder as the current document
      toast.loading("Saving to project...", { id: toastId });
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
        filename,
      );
      formData.append("folderId", doc.folderId);

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const result = await res.json();
      // Refresh file explorer so new file appears immediately
      queryClient.invalidateQueries({ queryKey: ["folder-contents"] });
      queryClient.invalidateQueries({ queryKey: ["folder-tree"] });
      toast.success(`Saved: ${filename}`, { id: toastId, duration: 4000 });
    } catch (e) {
      console.error("Save compare failed:", e);
      toast.error("Failed to save comparison", { id: toastId, duration: 3000 });
    } finally {
      setCompareProcessing(false);
    }
  }, [compareConfig, compareProcessing, token, documentId, doc]);

  // --- Review Stamp handler --------------------------------------------------
  const handleAddReviewStamp = useCallback((stamp: ReviewStamp) => {
    setTool(stamp.type);
    setActiveColor(stamp.color);
    if (stamp.strokeWidth) setActiveStrokeWidth(stamp.strokeWidth);
    activeReviewStampRef.current = stamp;
    // Also set electrical config so cursor preview works
    const stampConfig: import("../components/pdf/PdfToolbar").ElectricalConfig =
      {
        tool: stamp.type as any,
        defaultText: stamp.defaultText || stamp.subject,
        size: 0.08,
        customProps: stamp.customProps || {},
        color: stamp.color,
        subject: stamp.subject,
      };
    activeElectricalConfigRef.current = stampConfig;
    setActiveElectricalConfig(stampConfig);
    toast.success(`${stamp.label} -- draw on the document`, { duration: 2000 });
  }, []);

  // --- Electrical element handler ---------------------------------------------
  const handleElectricalSelect = useCallback(
    (config: import("../components/pdf/PdfToolbar").ElectricalConfig) => {
      setTool(config.tool);
      setActiveColor(config.color);
      if (config.strokeWidth) setActiveStrokeWidth(config.strokeWidth);
      activeElectricalConfigRef.current = config;
      setActiveElectricalConfig(config);
      // Apply stamp properties when the markup is created
      activeReviewStampRef.current = null; // clear any active stamp
      toast.success(
        `${config.subject || config.defaultText} -- click to place`,
        { duration: 2000 },
      );
    },
    [],
  );

  // ─── Tool Chest: presets from API ───
  const { data: toolChestPresets = [] } = useMarkupPresets();

  const handleApplyPreset = useCallback((preset: any) => {
    // Extract markupType from __markupType__ meta field
    const typeEntry = (preset.fields || []).find(
      (f: any) => f.key === "__markupType__",
    );
    const markupType = typeEntry?.defaultValue || preset.markupType;
    const displayFields = (preset.fields || []).filter(
      (f: any) => f.key !== "__markupType__" && f.key !== "__customStamp__",
    );

    // Custom stamp detection
    const customStampField = (preset.fields || []).find(
      (f: any) => f.key === "__customStamp__",
    );
    if (customStampField) {
      const stampData = JSON.parse(customStampField.defaultValue);
      customStampDataRef.current = { name: preset.name, markups: stampData };
      setTool("reviewStamp" as DrawTool);
      activeElectricalConfigRef.current = {
        tool: "reviewStamp" as any,
        defaultText: preset.name,
        size: 0.1,
        customProps: { __isCustomStamp: true, __stampMarkups: stampData },
        color: stampData[0]?.properties?.stroke || "#d32f2f",
      };
      setActiveElectricalConfig(activeElectricalConfigRef.current);
      activeReviewStampRef.current = null;
      toast.success(`Custom stamp "${preset.name}" — click to place`, {
        duration: 2000,
      });
      return;
    }

    // Apply basic style properties to draw state
    const extraProps: Record<string, any> = {};
    let presetColor = "";
    let presetStrokeWidth = 0;
    for (const f of displayFields) {
      if (
        f.defaultValue === undefined ||
        f.defaultValue === null ||
        f.defaultValue === ""
      )
        continue;
      const val = f.type === "number" ? Number(f.defaultValue) : f.defaultValue;
      switch (f.key) {
        case "stroke":
          setActiveColor(String(val));
          presetColor = String(val);
          break;
        case "strokeWidth":
          setActiveStrokeWidth(Number(val));
          presetStrokeWidth = Number(val);
          break;
        case "lineStyle":
          setActiveLineStyle(
            String(val) as import("../components/pdf/PdfToolbar").LineStyle,
          );
          break;
        default:
          // Store all other style properties (fill, fontSize, fontFamily, cloudArcSize, etc.)
          extraProps[f.key] =
            f.type === "number" ? Number(f.defaultValue) : f.defaultValue;
          break;
      }
    }

    // Switch tool if markupType is specified
    if (markupType) {
      setTool(markupType as import("../components/pdf/PdfToolbar").DrawTool);
      activeReviewStampRef.current = null;

      // For composite markups (reviewStamp, electricalBox, stub, panel) — build electricalConfig
      // so cursor preview matches the preset's appearance
      const compositeTypes = [
        "reviewStamp",
        "electricalBox",
        "stub",
        "panel",
        "wireTag",
      ];
      if (compositeTypes.includes(markupType)) {
        const cfg: import("../components/pdf/PdfToolbar").ElectricalConfig = {
          tool: markupType as any,
          defaultText: extraProps.text || preset.name,
          size: markupType === "reviewStamp" ? 0.08 : 0.03,
          color: presetColor || "#d32f2f",
          ...(presetStrokeWidth ? { strokeWidth: presetStrokeWidth } : {}),
          subject: extraProps.subject || preset.name,
          customProps: {
            stampShape: extraProps.stampShape,
            stampFill: extraProps.stampFill,
            stubDirection: extraProps.stubDirection,
            supportShape: extraProps.supportShape,
            boxType: extraProps.boxType,
            fill: extraProps.fill,
            textColor: extraProps.textColor,
            borderRadius: extraProps.borderRadius,
          },
        };
        activeElectricalConfigRef.current = cfg;
        setActiveElectricalConfig(cfg);
      } else {
        activeElectricalConfigRef.current = null;
        setActiveElectricalConfig(null);
      }
    }

    // Store extra props to be merged into the next created markup of this type.
    // extraProps OVERRIDE m.properties defaults (fill, fontSize, fontFamily, etc.)
    if (markupType && Object.keys(extraProps).length > 0) {
      pendingPresetPropsRef.current = { markupType, extraProps };
    } else if (markupType) {
      pendingPresetPropsRef.current = null;
    }

    toast.success(`Tool Chest: ${preset.name} activated`, { duration: 2000 });
  }, []);

  const [stampNameDialog, setStampNameDialog] = useState<{
    open: boolean;
    resolve?: (name: string | null) => void;
  }>({ open: false });
  const [stampNameInput, setStampNameInput] = useState("");

  const askStampName = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      setStampNameInput("");
      setStampNameDialog({ open: true, resolve });
    });
  }, []);

  const handleSaveCustomStamp = useCallback(async () => {
    const selected = selectedMarkups;
    if (selected.length === 0) return;

    const name = await askStampName();
    if (!name?.trim()) return;

    // Calculate bounding box center of all selected markups
    let minX = 1,
      minY = 1,
      maxX = 0,
      maxY = 0;
    for (const m of selected) {
      const c = m.coordinates || {};
      const l = c.left ?? c.x1 ?? 0;
      const t = c.top ?? c.y1 ?? 0;
      const r = c.left !== undefined ? l + (c.width || 0) : (c.x2 ?? l);
      const b = c.top !== undefined ? t + (c.height || 0) : (c.y2 ?? t);
      minX = Math.min(minX, l);
      minY = Math.min(minY, t);
      maxX = Math.max(maxX, r);
      maxY = Math.max(maxY, b);
    }
    const cx = (minX + maxX) / 2,
      cy = (minY + maxY) / 2;

    // Store each markup's data relative to center
    const stampMarkups = selected.map((m) => ({
      type: m.type,
      coordinates: JSON.parse(JSON.stringify(m.coordinates)),
      properties: JSON.parse(JSON.stringify(m.properties || {})),
      _offsetX:
        (m.coordinates?.left ?? m.coordinates?.x1 ?? 0) +
        (m.coordinates?.width || 0) / 2 -
        cx,
      _offsetY:
        (m.coordinates?.top ?? m.coordinates?.y1 ?? 0) +
        (m.coordinates?.height || 0) / 2 -
        cy,
    }));

    const fields = [
      {
        key: "__customStamp__",
        type: "text" as const,
        defaultValue: JSON.stringify(stampMarkups),
      },
      {
        key: "__markupType__",
        type: "text" as const,
        defaultValue: "customStamp",
      },
    ];

    try {
      await apiFetch("/api/presets", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          fields,
          markupType: "customStamp",
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["markupPresets"] });
      toast.success(
        `Custom stamp "${name}" saved with ${selected.length} markup(s)`,
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to save custom stamp");
    }
  }, [selectedMarkups, queryClient]);

  // Save a single simple markup's STYLE to Tool Chest (same as Properties Panel button)
  const handleSaveStyleToChest = useCallback(async () => {
    const m = selectedMarkups?.[0];
    if (!m) return;
    const name = await askStampName();
    if (!name?.trim()) return;
    const props = m.properties || {};
    const fields: any[] = [
      { key: "__markupType__", type: "text", defaultValue: m.type },
      ...TOOL_CHEST_STYLE_KEYS.filter(
        (k: string) =>
          props[k] !== undefined && props[k] !== null && props[k] !== "",
      ).map((k: string) => ({
        key: k,
        type: typeof props[k] === "number" ? "number" : "text",
        defaultValue: String(props[k]),
      })),
    ];
    try {
      await apiFetch("/api/presets", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), fields, markupType: m.type }),
      });
      queryClient.invalidateQueries({ queryKey: ["markupPresets"] });
      toast.success(`"${name.trim()}" saved to Tool Chest`);
    } catch (e: any) {
      toast.error(e.message || "Failed to save to Tool Chest");
    }
  }, [selectedMarkups, queryClient, askStampName]);

  const handleExportPdf = useCallback(async () => {
    if (isExporting) return;
    if (!pdfDoc) {
      toast.error("Document is still loading. Please wait and try again.");
      return;
    }
    setIsExporting(true);
    setExportProgress({ current: 0, total: 0, phase: "Preparing..." });

    const toastId = toast.loading("Preparing export...", {
      duration: Infinity,
    });

    try {
      await exportPdfPixelPerfect({
        pdfDocProxy: pdfDoc,
        allMarkups: markups,
        numPages,
        docScale,
        hiddenLayers,
        docName: doc?.name || "document",
        navigateToPage: async (page: number) => {
          if (tileViewerRef.current) {
            tileViewerRef.current.navigateToPage(page);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        },
        onProgress: (current, total, phase) => {
          setExportProgress({ current, total, phase });
          toast.loading(`Exporting: ${phase}`, { id: toastId });
        },
      });
      toast.success(`Exported ${doc?.name || "document"} with markups`, {
        id: toastId,
        duration: 3000,
      });
    } catch (e) {
      console.error("PDF export failed:", e);
      toast.error("Export failed. Please try again.", {
        id: toastId,
        duration: 4000,
      });
    } finally {
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0, phase: "" });
    }
  }, [pdfDoc, isExporting, markups, numPages, docScale, hiddenLayers, doc]);

  const handleDownloadClean = useCallback(async () => {
    if (!documentId || !token) {
      toast.error("Document is still loading. Please wait and try again.");
      return;
    }
    const toastId = toast.loading("Downloading PDF...");
    try {
      const r = await fetch(`/api/documents/${documentId}/proxy`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // Stream download with progress
      const total = parseInt(r.headers.get("content-length") || "0", 10);
      const reader = r.body?.getReader();
      if (!reader) {
        const blob = await r.blob();
        triggerBlobDownload(blob, doc?.name || `document_${documentId}.pdf`);
        toast.success("Download complete", { id: toastId, duration: 2000 });
        return;
      }
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) {
          const pct = Math.round((received / total) * 100);
          const mb = (received / 1024 / 1024).toFixed(1);
          toast.loading(`Downloading: ${mb} MB (${pct}%)`, { id: toastId });
        } else {
          toast.loading(
            `Downloading: ${(received / 1024 / 1024).toFixed(1)} MB`,
            { id: toastId },
          );
        }
      }
      const blob = new Blob(chunks as BlobPart[], { type: "application/pdf" });
      triggerBlobDownload(blob, doc?.name || `document_${documentId}.pdf`);
      toast.success(`Downloaded ${doc?.name || "document"}`, {
        id: toastId,
        duration: 2000,
      });
    } catch (e) {
      console.error("Download failed:", e);
      toast.error("Download failed", { id: toastId, duration: 3000 });
    }
  }, [documentId, token, doc]);

  // --- Paste image from clipboard (external screenshot / copied image) --------
  const handlePasteImage = useCallback(
    async (file: File) => {
      if (!canMarkup) return;
      const targetPageIdx = currentPage - 1;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = async () => {
          const pageSize = tileViewerRef.current?.getPageSize(targetPageIdx);
          const pw = pageSize?.w || 1190;
          const ph = pageSize?.h || 1684;
          const targetW = 0.3;
          const aspect = img.height / img.width;
          const targetH = targetW * (pw / ph) * aspect;
          const res = await createMarkup({
            type: "image",
            documentId,
            pageNumber: targetPageIdx,
            coordinates: {
              left: 0.1,
              top: 0.1,
              width: targetW,
              height: Math.min(targetH, 0.8),
            },
            properties: {
              imageData: dataUrl,
              stroke: "transparent",
              strokeWidth: 0,
            },
          });
          if (res?.id) {
            setSelectedMarkupIds([res.id]);
            pushHistory({ type: "create", markupId: res.id, after: res });
            refetchMarkups();
            toast.success("Image pasted from clipboard", { duration: 2000 });
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [
      canMarkup,
      currentPage,
      documentId,
      createMarkup,
      pushHistory,
      refetchMarkups,
    ],
  );

  const handlePasteMarkups = useCallback(
    async (clipboardEvent?: ClipboardEvent) => {
      // Check for image paste from external clipboard first
      if (clipboardEvent?.clipboardData?.files?.length) {
        const file = Array.from(clipboardEvent.clipboardData.files).find((f) =>
          f.type.startsWith("image/"),
        );
        if (file) {
          handlePasteImage(file);
          return;
        }
      }
      if (markupClipboard.length === 0) return;
      const newIds: string[] = [];

      // Determine paste target: cursor position on page (via TileViewer screenToWorld + worldToPage)
      let targetPageIdx = currentPage - 1;
      let cursorNx = -1,
        cursorNy = -1; // normalized 0-1 on target page
      const tv = tileViewerRef.current;
      if (tv) {
        const world = tv.screenToWorld(
          mouseClientRef.current.x,
          mouseClientRef.current.y,
        );
        if (world) {
          const pg = tv.worldToPage(world.x, world.y);
          if (pg) {
            targetPageIdx = pg.pageIndex;
            cursorNx = pg.nx;
            cursorNy = pg.ny;
          }
        }
      }

      // Compute bounding box center of all copied markups (to offset them to cursor)
      let clipCx = 0.5,
        clipCy = 0.5;
      if (cursorNx >= 0 && markupClipboard.length > 0) {
        let sumX = 0,
          sumY = 0,
          count = 0;
        for (const m of markupClipboard) {
          const c = m.coordinates || {};
          // Callout: center is the midpoint between cloud center and textBox center
          if (c.cloud) {
            const cl = c.cloud;
            const tb = c.textBox || cl;
            const ccx =
              ((cl.left || 0) +
                (cl.width || 0) / 2 +
                (tb.left || 0) +
                (tb.width || 0) / 2) /
              2;
            const ccy =
              ((cl.top || 0) +
                (cl.height || 0) / 2 +
                (tb.top || 0) +
                (tb.height || 0) / 2) /
              2;
            sumX += ccx;
            sumY += ccy;
            count++;
          } else if (c.left !== undefined) {
            sumX += (c.left || 0) + (c.width || 0) / 2;
            sumY += (c.top || 0) + (c.height || 0) / 2;
            count++;
          } else if (c.x1 !== undefined) {
            sumX += ((c.x1 || 0) + (c.x2 || 0)) / 2;
            sumY += ((c.y1 || 0) + (c.y2 || 0)) / 2;
            count++;
          } else if (Array.isArray(c.points) && c.points.length > 0) {
            const px =
              c.points.reduce((s: number, p: any) => s + (p.x || 0), 0) /
              c.points.length;
            const py =
              c.points.reduce((s: number, p: any) => s + (p.y || 0), 0) /
              c.points.length;
            sumX += px;
            sumY += py;
            count++;
          }
        }
        if (count > 0) {
          clipCx = sumX / count;
          clipCy = sumY / count;
        }
      }

      // Offset: move from clipboard center to cursor position
      const dx = cursorNx >= 0 ? cursorNx - clipCx : 0.02;
      const dy = cursorNy >= 0 ? cursorNy - clipCy : 0.02;

      for (const m of markupClipboard) {
        const { id, author, createdAt, authorId, pageNumber, ...rest } = m;
        const newCoords = JSON.parse(JSON.stringify(rest.coordinates || {}));

        // Move markup center to cursor position
        if (newCoords.left !== undefined) {
          newCoords.left = Math.max(
            0,
            Math.min(0.95, (newCoords.left || 0) + dx),
          );
          newCoords.top = Math.max(
            0,
            Math.min(0.95, (newCoords.top || 0) + dy),
          );
        } else if (newCoords.x1 !== undefined) {
          newCoords.x1 = Math.max(0, Math.min(0.95, (newCoords.x1 || 0) + dx));
          newCoords.y1 = Math.max(0, Math.min(0.95, (newCoords.y1 || 0) + dy));
          newCoords.x2 = Math.max(0, Math.min(0.95, (newCoords.x2 || 0) + dx));
          newCoords.y2 = Math.max(0, Math.min(0.95, (newCoords.y2 || 0) + dy));
        }
        if (Array.isArray(newCoords.points)) {
          newCoords.points = newCoords.points.map((p: any) => ({
            x: Math.max(0, Math.min(0.98, (p.x || 0) + dx)),
            y: Math.max(0, Math.min(0.98, (p.y || 0) + dy)),
          }));
        }
        // Callout: also move textBox and cloud sub-coordinates
        if (newCoords.cloud) {
          newCoords.cloud.left = Math.max(
            0,
            Math.min(0.95, (newCoords.cloud.left || 0) + dx),
          );
          newCoords.cloud.top = Math.max(
            0,
            Math.min(0.95, (newCoords.cloud.top || 0) + dy),
          );
        }
        if (newCoords.textBox) {
          newCoords.textBox.left = Math.max(
            0,
            Math.min(0.95, (newCoords.textBox.left || 0) + dx),
          );
          newCoords.textBox.top = Math.max(
            0,
            Math.min(0.95, (newCoords.textBox.top || 0) + dy),
          );
        }
        if (newCoords.tail) {
          newCoords.tail.x = Math.max(
            0,
            Math.min(0.98, (newCoords.tail.x || 0) + dx),
          );
          newCoords.tail.y = Math.max(
            0,
            Math.min(0.98, (newCoords.tail.y || 0) + dy),
          );
        }

        const newProps = JSON.parse(JSON.stringify(rest.properties || {}));
        newProps.isPastedOrDuplicated = true;
        delete newProps.comment;
        if (newProps.subject) {
          newProps.subject = newProps.subject.replace(
            /@([a-zA-Z0-9_.\-\s]+)/g,
            "$1",
          );
        }

        // Route through handleMarkupAddedDraft so it respects current mode
        await handleMarkupAddedDraft({
          ...rest,
          type: m.type,
          coordinates: newCoords,
          properties: newProps,
          pageNumber: targetPageIdx,
        });
      }
      if (newIds.length > 0) {
        setSelectedMarkupIds(newIds);
        refetchMarkups();
        toast.success(
          `Pasted ${newIds.length} markup${newIds.length > 1 ? "s" : ""} on page ${currentPage}`,
          { duration: 2000 },
        );
      }
    },
    [
      markupClipboard,
      handlePasteImage,
      currentPage,
      documentId,
      createMarkup,
      pushHistory,
      refetchMarkups,
    ],
  );

  // Track mouse position for paste-at-cursor (store raw clientX/Y for screenToWorld)
  const mouseClientRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      mouseClientRef.current = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  // Double-tap to open markup wheel (mobile)
  const lastTapRef = useRef(0);
  useEffect(() => {
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        const touch = e.changedTouches[0];
        if (touch && canMarkup) {
          setWheelPos({ x: touch.clientX, y: touch.clientY });
          setWheelOpen(true);
        }
      }
      lastTapRef.current = now;
    };
    document.addEventListener("touchend", onTouchEnd);
    return () => document.removeEventListener("touchend", onTouchEnd);
  }, []);

  // Track cursor position for Y.js awareness (collaboration cursors)
  useEffect(() => {
    if (collabMode !== "live" && collabMode !== "edit") {
      clearLocalCursor();
      return;
    }

    const onMove = (e: MouseEvent) => {
      const viewer = tileViewerRef.current;
      if (!viewer) return;
      const world = viewer.screenToWorld(e.clientX, e.clientY);
      if (!world) {
        clearLocalCursor();
        return;
      }
      const pagePoint = viewer.worldToPage(world.x, world.y);
      if (pagePoint)
        setLocalCursor(pagePoint.pageIndex, pagePoint.nx, pagePoint.ny);
      else clearLocalCursor();
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    return () => document.removeEventListener("mousemove", onMove);
  }, [collabMode, setLocalCursor, clearLocalCursor]);

  // --- Edit Lock detection via Y.js awareness ---
  useEffect(() => {
    if (!documentId) {
      setEditLockUser(null);
      return;
    }
    const provider = getYjsProvider(documentId);
    if (!provider) {
      setEditLockUser(null);
      return;
    }
    const awareness = provider.awareness;
    const checkLock = () => {
      const states = awareness.getStates() as Map<number, { user?: any }>;
      let foundLock: { id: string; name: string } | null = null;
      const now = Date.now();
      states.forEach((state) => {
        if (state.user?.editLock && state.user.id !== user?.id) {
          // Ignore stale locks (no heartbeat for > LOCK_TTL)
          const lockAge = now - (state.user.editLockTime || 0);
          if (lockAge < LOCK_TTL) {
            foundLock = { id: state.user.id, name: state.user.name };
          }
        }
      });
      const lockResult = foundLock as { id: string; name: string } | null;
      setEditLockUser(lockResult);
      // If someone else took edit lock and we're in edit mode, force back to personal
      if (lockResult && collabMode === "edit") {
        setCollabMode("personal");
        toast.error(
          `${lockResult.name} took edit control — you were switched to Personal mode`,
          { duration: 4000 },
        );
      }
    };
    awareness.on("change", checkLock);
    checkLock(); // initial check
    return () => {
      awareness.off("change", checkLock);
    };
  }, [documentId, user?.id, collabMode]);

  const handleDocScaleChange = useCallback(
    async (newScale: string) => {
      setDocScale(newScale);
      localStorage.setItem("pdfDocScale", newScale);
      try {
        await apiFetch(`/api/documents/${documentId}/scale`, {
          method: "PATCH",
          body: JSON.stringify({ scale: newScale }),
        });
      } catch {
        /* scale persisted to localStorage; server save is optional */
      }
    },
    [documentId],
  );

  // Mobile toolbar drag handlers
  const handleMobileDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = mobileToolbarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const posX = rect.left + rect.width / 2;
    const posY = rect.top + rect.height / 2;
    // Lock size during drag
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    mobileDragRef.current = {
      isDragging: true,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startPosX: posX,
      startPosY: posY,
      currentX: posX,
      currentY: posY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleMobileDragMove = useCallback((e: React.PointerEvent) => {
    if (!mobileDragRef.current.isDragging) return;
    e.preventDefault();
    const el = mobileToolbarRef.current;
    if (!el) return;
    const W = el.offsetWidth;
    const H = el.offsetHeight;
    const dx = e.clientX - mobileDragRef.current.startPointerX;
    const dy = e.clientY - mobileDragRef.current.startPointerY;
    const newX = Math.max(
      W / 2 + 8,
      Math.min(
        window.innerWidth - W / 2 - 8,
        mobileDragRef.current.startPosX + dx,
      ),
    );
    const newY = Math.max(
      H / 2 + 8,
      Math.min(
        window.innerHeight - H / 2 - 8,
        mobileDragRef.current.startPosY + dy,
      ),
    );
    mobileDragRef.current.currentX = newX;
    mobileDragRef.current.currentY = newY;
    // Direct DOM update for 60fps smoothness -- no React re-render during drag
    el.style.left = `${newX}px`;
    el.style.top = `${newY}px`;
    el.style.bottom = "auto";
    el.style.transform = "translate(-50%, -50%)";
  }, []);

  const handleMobileDragEnd = useCallback((_e: React.PointerEvent) => {
    if (!mobileDragRef.current.isDragging) return;
    mobileDragRef.current.isDragging = false;
    // Unlock size after drag
    const el = mobileToolbarRef.current;
    if (el) { el.style.width = ''; el.style.height = ''; }
    // Commit to React state so position survives re-renders
    setMobileToolbarStyle({
      left: `${mobileDragRef.current.currentX}px`,
      top: `${mobileDragRef.current.currentY}px`,
      bottom: "auto",
      transform: "translate(-50%, -50%)",
    });
  }, []);

  // Sync scrollMode ref and persist to localStorage
  useEffect(() => {
    scrollModeRef.current = scrollMode;
    localStorage.setItem("pdfScrollMode", scrollMode);
    // When entering split view, initialise each panel's zoom to the current display scale
    if (scrollMode === "split") {
      setSplitLeftZoom(displayScaleRef.current);
      setSplitRightZoom(displayScaleRef.current);
    }
  }, [scrollMode]);

  // Highlighter default width 12px â€" restore 2px when leaving
  useEffect(() => {
    if (tool === prevToolRef.current) return;
    prevToolRef.current = tool;
    if (tool === "highlighter") setActiveStrokeWidth(12);
  }, [tool]);

  // --- 6. Effects ---
  // Reset per-document state immediately on document switch so the sidebar
  // never shows stale data from the previous file while the new one loads.
  useEffect(() => {
    // Release edit lock on previous document when switching
    if (prevDocIdRef.current && prevDocIdRef.current !== documentId) {
      const prevProvider = getYjsProvider(prevDocIdRef.current);
      if (prevProvider) {
        const prevState = prevProvider.awareness.getLocalState();
        if (prevState?.user?.editLock) {
          prevProvider.awareness.setLocalStateField("user", {
            ...prevState.user,
            editLock: false,
          });
        }
      }
    }
    setPageLabels([]);
    setBookmarks([]);
    setBookmarksLoaded(false);
    pageLabelsFromOutlineRef.current = false;
    setNumPages(0);
    setCurrentPage(1);
    setSearchResults([]);
    setActiveSearchKeyword("");
    setSelectedMarkupIds([]);
    setPropertiesOpen(false);
    // Exit compare mode when switching documents
    setCompareConfig(null);
    setCompareShowOld(true);
    setCompareShowNew(true);

    // Reset drafts
    setDraftMarkups([]);
    draftSnapshotRef.current = [];

    // Personal mode keeps Y.js connected for reading — always ensure connected
    const provider = getYjsProvider(documentId || "");
    if (provider && !provider.wsconnected) provider.connect();

    // --- Restore Edit mode if user was editing this document ---
    const savedEditDrafts = documentId
      ? localStorage.getItem(`edit-drafts-${documentId}`)
      : null;
    const savedEditSnapshot = documentId
      ? localStorage.getItem(`edit-snapshot-${documentId}`)
      : null;
    const savedEditUserId = documentId
      ? localStorage.getItem(`edit-userId-${documentId}`)
      : null;
    let restoredEdit = false;
    if (savedEditDrafts && savedEditUserId === user?.id) {
      try {
        const drafts = JSON.parse(savedEditDrafts);
        const snapshot = savedEditSnapshot ? JSON.parse(savedEditSnapshot) : [];
        if (Array.isArray(drafts) && drafts.length > 0) {
          // Check if edit lock is available (no one else is editing)
          const states = provider?.awareness?.getStates();
          let lockTaken = false;
          if (states) {
            const now = Date.now();
            states.forEach((state: any, clientId: number) => {
              if (
                clientId !== provider?.awareness?.clientID &&
                state?.user?.editLock
              ) {
                const lockAge = now - (state.user.editLockTime || 0);
                if (lockAge < LOCK_TTL) lockTaken = true;
              }
            });
          }
          if (!lockTaken) {
            // Re-acquire edit lock and restore
            restoredEdit = true;
            if (provider) {
              provider.awareness.setLocalStateField("user", {
                ...provider.awareness.getLocalState()?.user,
                editLock: true,
                editLockTime: Date.now(),
              });
            }
            setCollabMode("edit");
            setDraftMarkups(drafts);
            draftSnapshotRef.current = snapshot;
            setPersonalMarkups([]);
            toast("Restored edit session — your unsaved changes are safe", {
              duration: 3000,
              icon: "\uD83D\uDFE0",
            });
          } else {
            // Someone else took the lock — can't restore edit, offer to publish or discard
            restoredEdit = false;
            // Clean up stale edit data
            localStorage.removeItem(`edit-drafts-${documentId}`);
            localStorage.removeItem(`edit-snapshot-${documentId}`);
            localStorage.removeItem(`edit-userId-${documentId}`);
            toast.error(
              "Another user is editing — your unsaved edit changes were discarded",
              { duration: 4000 },
            );
          }
        }
      } catch {
        localStorage.removeItem(`edit-drafts-${documentId}`);
        localStorage.removeItem(`edit-snapshot-${documentId}`);
        localStorage.removeItem(`edit-userId-${documentId}`);
      }
    }

    // --- Restore Personal mode if user had unpublished markups ---
    let restoredPersonal = false;
    if (!restoredEdit) {
      const savedPersonal = documentId
        ? localStorage.getItem(`personal-markups-${documentId}`)
        : null;
      if (savedPersonal) {
        try {
          const savedMarkups = JSON.parse(savedPersonal);
          if (Array.isArray(savedMarkups) && savedMarkups.length > 0) {
            restoredPersonal = true;
            setCollabMode("personal");
            setPersonalMarkups(savedMarkups);
            personalSnapshotRef.current = [];
            toast(
              "Restored personal mode — your unpublished markups are safe",
              { duration: 3000, icon: "\uD83D\uDD35" },
            );
          }
        } catch {
          if (documentId)
            localStorage.removeItem(`personal-markups-${documentId}`);
        }
      }
    }

    if (!restoredEdit && !restoredPersonal) {
      // Default to Personal mode
      setCollabMode("personal");
      setPersonalMarkups([]);
      personalSnapshotRef.current = [];
    }

    // Clear live session tracking
    liveSessionMarkupIds.current.clear();

    prevDocIdRef.current = documentId;
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;
    apiFetch(`/api/documents/${documentId}/info`)
      .then((res) => {
        setDoc(res.data);
        if (res.data?.scale) setDocScale(res.data.scale);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [documentId]);

  // Set PDF file source once auth is ready -- PDF.js streams only needed pages via range requests
  useEffect(() => {
    if (!documentId || authLoading || !token) {
      setPdfFile(null);
      return;
    }
    setPdfFile({
      url: `/api/documents/${documentId}/proxy`,
      httpHeaders: { Authorization: `Bearer ${token}` },
    });
  }, [documentId, token, authLoading]);

  // Load a single cached PDFDocumentProxy -- shared by search highlights and handlers.
  // Uses the same URL + auth header so PDF.js reuses its already-started stream.
  useEffect(() => {
    if (!pdfFile) {
      pdfDocCleanupRef.current?.destroy?.();
      pdfDocCleanupRef.current = null;
      setPdfDoc(null);
      return;
    }
    let cancelled = false;
    pdfjs
      .getDocument({ url: pdfFile.url, httpHeaders: pdfFile.httpHeaders })
      .promise.then(async (doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        pdfDocCleanupRef.current = doc;
        setPdfDoc(doc);
        // Extract metadata that was previously only fetched by react-pdf's onLoadSuccess:
        // page dimensions, page labels (bookmark names used as sheet titles), and outline.
        try {
          if (doc.numPages > 0) {
            const p1 = await doc.getPage(1);
            const vp = p1.getViewport({ scale: 1 });
            setPageDimensions({ width: vp.width, height: vp.height });
          }
          const rawLabels = await doc.getPageLabels();
          const outline = await doc.getOutline();
          setBookmarks(outline || []);
          setBookmarksLoaded(true);
          setNumPages(doc.numPages);

          // Build bookmark-title page labels:
          // flatten outline, resolve each dest → 0-based page index, use title as label.
          if (outline && outline.length > 0) {
            // When we have an outline, start with plain "1","2","3"… so that rawLabels
            // containing section/container names like "Sheets" cannot pollute page names.
            // Leaf outline items will override each slot with the real sheet title.
            const labelArr: string[] = Array.from(
              { length: doc.numPages },
              (_, i) => String(i + 1),
            );
            const flatOutline: any[] = [];
            // Depth-first traversal: collect ONLY leaf nodes (items with no children).
            // Parent/section nodes like "Sheets" are containers and should NOT be used as page names --
            // only their leaf children ("A101", "A102", …) are the real sheet names.
            const collect = (items: any[]) => {
              for (const it of items) {
                if (it.items?.length) {
                  collect(it.items);
                } else {
                  flatOutline.push(it);
                }
              }
            };
            collect(outline);
            for (const it of flatOutline) {
              if (!it.title || !it.dest) continue;
              try {
                let destArr = it.dest;
                if (typeof destArr === "string")
                  destArr = await doc.getDestination(destArr);
                if (!Array.isArray(destArr) || !destArr[0]) continue;
                const pageIdx = await doc.getPageIndex(destArr[0]);
                if (pageIdx >= 0 && pageIdx < doc.numPages) {
                  labelArr[pageIdx] = it.title;
                }
              } catch {
                /* ignore unresolvable dests */
              }
            }
            pageLabelsFromOutlineRef.current = true;
            setPageLabels(labelArr);
          } else {
            setPageLabels(rawLabels || []);
          }
        } catch (e) {
          console.error("[pageLabels]", e);
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
      pdfDocCleanupRef.current?.destroy?.();
      pdfDocCleanupRef.current = null;
      setPdfDoc(null);
    };
  }, [pdfFile]);

  // Detect embedded PDF annotations (Bluebeam / Acrobat) — display only, NO auto-import
  useEffect(() => {
    if (!pdfDoc) {
      setEmbeddedAnnots(null);
      return;
    }
    setEmbeddedAnnots(null);
    let cancelled = false;
    detectAndParseAnnotations(pdfDoc)
      .then((annots) => {
        if (cancelled) return;
        // Just show the annotations count as badge — never auto-import
        if (annots && annots.length > 0) {
          setEmbeddedAnnots(annots);
        } else {
          setEmbeddedAnnots([]);
        }
      })
      .catch(() => {
        if (!cancelled) setEmbeddedAnnots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || scrollModeRef.current === "page") {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const snapScrollLeft = container.scrollLeft;
        const snapScrollTop = container.scrollTop;

        const prevScale = displayScaleRef.current;
        const newScale = Math.max(0.1, Math.min(10, prevScale + delta));
        const ratio = newScale / prevScale;
        displayScaleRef.current = newScale;

        // Update CSS transform DIRECTLY on the DOM â€" no React re-render,
        // gives truly smooth GPU-only zoom like Bluebeam.
        if (transformBoxRef.current) {
          transformBoxRef.current.style.transform = `scale(${newScale / zoomRef.current})`;
        }

        // Adjust scroll so the point under cursor stays fixed
        requestAnimationFrame(() => {
          container.scrollLeft = (snapScrollLeft + cursorX) * ratio - cursorX;
          container.scrollTop = (snapScrollTop + cursorY) * ratio - cursorY;
        });

        // Debounced: commit zoom â†' triggers full re-render at new resolution
        updateActualZoom(newScale);

        // Update React state too (for mouse coordinate calculations, zoom %, etc.)
        // This re-render is fine since it's debounced via the same mechanism
        setDisplayScale(newScale);
      }
    };

    let isPanning = false,
      startX = 0,
      startY = 0,
      scrollLeft = 0,
      scrollTop = 0;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || tool === "pan") {
        e.preventDefault();
        isPanning = true;
        startX = e.pageX;
        startY = e.pageY;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
        container.style.cursor = "grabbing";
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      container.scrollLeft = scrollLeft - (e.pageX - startX);
      container.scrollTop = scrollTop - (e.pageY - startY);
    };
    const handleMouseUp = () => {
      if (isPanning) {
        isPanning = false;
        container.style.cursor = tool === "pan" ? "grab" : "auto";
      }
    };

    // â"€â"€ Touch pan (single finger, pan tool) â"€â"€
    let touchPanning = false,
      touchStartX = 0,
      touchStartY = 0,
      touchScrollL = 0,
      touchScrollT = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      } else if (e.touches.length === 1 && tool === "pan") {
        touchPanning = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchScrollL = container.scrollLeft;
        touchScrollT = container.scrollTop;
      }
    };
    let lastPinchDist = 0;
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastPinchDist > 0) {
          const delta = (dist - lastPinchDist) / 300;
          const next = Math.max(
            0.1,
            Math.min(
              10,
              Math.round((displayScaleRef.current + delta) * 100) / 100,
            ),
          );
          updateActualZoom(next);
          setDisplayScale(next);
        }
        lastPinchDist = dist;
      } else if (touchPanning && e.touches.length === 1) {
        container.scrollLeft =
          touchScrollL - (e.touches[0].clientX - touchStartX);
        container.scrollTop =
          touchScrollT - (e.touches[0].clientY - touchStartY);
      }
    };
    const handleTouchEnd = () => {
      touchPanning = false;
      lastPinchDist = 0;
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);
    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [tool, updateActualZoom]);

  // â"€â"€ Split-view: independent wheel-zoom per panel â"€â"€
  useEffect(() => {
    if (scrollMode !== "split") return;
    const makeFn =
      (setter: React.Dispatch<React.SetStateAction<number>>) =>
      (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setter((prev) =>
          Math.max(0.1, Math.min(10, Math.round((prev + delta) * 100) / 100)),
        );
      };
    const leftEl = splitLeftScrollRef.current;
    const rightEl = splitRightScrollRef.current;
    const leftFn = makeFn(setSplitLeftZoom);
    const rightFn = makeFn(setSplitRightZoom);
    leftEl?.addEventListener("wheel", leftFn, { passive: false });
    rightEl?.addEventListener("wheel", rightFn, { passive: false });
    return () => {
      leftEl?.removeEventListener("wheel", leftFn);
      rightEl?.removeEventListener("wheel", rightFn);
    };
  }, [scrollMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Undo / Redo — handled before ANY early returns so they always work
      // Ctrl+Z = undo, Ctrl+Y or Ctrl+Shift+Z = redo
      if (
        ctrl &&
        !tag.match(/^(INPUT|SELECT)$/) &&
        !(e.target as HTMLElement).isContentEditable
      ) {
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (key === "y" || (key === "z" && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Cancel route click modes on Escape
      if (key === "escape" && (routePanelClickMode || routeMultiClickMode)) {
        routeModeRef.current = "off";
        routePointsRef.current = [];
        setRoutePanelClickMode(false);
        setRouteMultiClickMode(false);
        setRouteMultiClickPoints([]);
        setRoutePanelClickData(null);
        toast("Routing cancelled", { duration: 1500 });
        return;
      }
      // Block browser-native shortcuts that interfere with PDF viewer
      if (ctrl && ["f", "p", "s", "a"].includes(key)) {
        e.preventDefault();
        return;
      }
      // Q = toggle markup wheel at mouse position
      if (!ctrl && key === "q") {
        e.preventDefault();
        setWheelOpen((prev) => {
          if (!prev) {
            const mx = mouseClientRef.current.x || window.innerWidth / 2;
            const my = mouseClientRef.current.y || window.innerHeight / 2;
            setWheelPos({ x: mx, y: my });
          }
          return !prev;
        });
        return;
      }
      // When user has no markup permission, only allow select/pan shortcuts
      if (!canMarkup) {
        const readOnlyShortcuts: Record<string, DrawTool> = {
          v: "select",
          " ": "pan",
        };
        if (!ctrl && readOnlyShortcuts[key]) {
          e.preventDefault();
          setTool(readOnlyShortcuts[key]);
        }
        return;
      }
      const toolShortcuts: Record<string, DrawTool> = {
        v: "select",
        " ": "pan",
        p: "pen",
        h: "highlighter",
        l: "line",
        a: "arrow",
        r: "rect",
        c: "cloud",
        t: "text",
        o: "callout",
        m: "measure",
        k: "polyline",
      };
      if (!ctrl && toolShortcuts[key]) {
        e.preventDefault();
        setTool(toolShortcuts[key]);
        return;
      }
      if (key === "delete" || key === "backspace") {
        if (selectedMarkupIds.length > 0) {
          e.preventDefault();
          const deletableIds = selectedMarkupIds.filter((id) => {
            const m = (markups || []).find((x: any) => x.id === id);
            if (!m) return true;
            if (isAdmin || (user?.id != null && m.authorId === user.id))
              return true;
            const dids = m.allowedDeleteUserIds;
            if (!dids || dids.includes("*")) return true;
            if (dids.length === 0) return false;
            return user?.id != null && dids.includes(user.id);
          });
          const skipped = selectedMarkupIds.length - deletableIds.length;
          if (deletableIds.length > 0) {
            if (userSettings.confirmOnDelete) {
              setDeleteDialog({
                open: true,
                ids: deletableIds,
                count: deletableIds.length,
                skipped,
              });
              return;
            }
            handleDeleteMarkupDraft(deletableIds);
            if (skipped > 0)
              toast(
                `Deleted ${deletableIds.length}, skipped ${skipped} locked/protected`,
                { duration: 2000 },
              );
          } else if (skipped > 0) {
            toast.error(
              `Cannot delete — ${skipped} markup(s) are locked or protected`,
              { duration: 2000 },
            );
          }
        }
        return;
      }
      if (ctrl && key === "c") {
        if (selectedMarkups.length > 0) {
          e.preventDefault();
          setMarkupClipboard([...selectedMarkups]);
        }
        return;
      }
      if (ctrl && key === "v") {
        // Don't prevent default here -- we need the paste event for image clipboard
        return;
      }
      if (ctrl && key === "d") {
        e.preventDefault();
        handleDuplicateMarkups();
        return;
      }
      if (ctrl && key === "g" && !e.shiftKey) {
        e.preventDefault();
        if (selectedMarkupIds.length >= 2) {
          const groupId = crypto.randomUUID();
          for (const id of selectedMarkupIds) {
            const m = (markups || []).find((mk: any) => mk.id === id);
            if (m)
              handleUpdateProperties(id, {
                properties: { ...m.properties, groupId },
              });
          }
          toast.success(`Grouped ${selectedMarkupIds.length} markups`, {
            duration: 1500,
          });
        }
        return;
      }
      if (ctrl && key === "g" && e.shiftKey) {
        e.preventDefault();
        for (const id of selectedMarkupIds) {
          const m = (markups || []).find((mk: any) => mk.id === id);
          if (m?.properties?.groupId) {
            const gid = m.properties.groupId;
            const groupMembers = (markups || []).filter(
              (mk: any) => mk.properties?.groupId === gid,
            );
            for (const gm of groupMembers) {
              const { groupId: _, ...rest } = gm.properties || {};
              handleUpdateProperties(gm.id, { _fullProperties: rest });
            }
            toast.success(`Ungrouped ${groupMembers.length} markups`, {
              duration: 1500,
            });
            break;
          }
        }
        return;
      }
      // (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z are handled at the top of this handler)
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedMarkupIds,
    selectedMarkups,
    markups,
    user,
    isAdmin,
    canMarkup,
    handleDeleteMarkupDraft,
    handleDuplicateMarkups,
    handleUndo,
    handleRedo,
    handlePasteMarkups,
    handleUpdateProperties,
    routePanelClickMode,
  ]);

  // Prevent browser context menu — but show our custom menu if markups selected
  useEffect(() => {
    const prevent = (e: MouseEvent) => {
      e.preventDefault();
      // If markups are selected and right-click is on the viewer area, show context menu
      if (selectedMarkupIds.length > 0) {
        const firstId = selectedMarkupIds[0];
        setContextMenu({
          mouseX: e.clientX,
          mouseY: e.clientY,
          markupId: firstId,
        });
      }
    };
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, [selectedMarkupIds]);

  // Middle mouse button → open markup wheel (capture phase to beat TileViewer pan)
  useEffect(() => {
    // Middle click removed from wheel — back to default browser/pan behavior
    const onMiddle = (_e: MouseEvent) => {};
    window.addEventListener("mousedown", onMiddle, true);

    // Mobile: double-tap → open markup wheel
    let lastTapTime = 0;
    const onDoubleTap = (e: TouchEvent) => {
      if (e.touches.length !== 2) return; // two-finger tap
      const now = Date.now();
      if (now - lastTapTime < 400) {
        e.preventDefault();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        setWheelPos({ x: cx, y: cy });
        setWheelOpen(true);
      }
      lastTapTime = now;
    };
    document.addEventListener("touchstart", onDoubleTap, true);

    return () => {
      window.removeEventListener("mousedown", onMiddle, true);
      document.removeEventListener("touchstart", onDoubleTap, true);
    };
  }, []);

  // Global paste handler -- handles both markup paste and image paste from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      )
        return;
      e.preventDefault();
      handlePasteMarkups(e);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePasteMarkups]);

  // Auto-jump to markup from notification link (?markupId=...)
  const notifMarkupId = searchParams.get("markupId");
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!notifMarkupId || !markups?.length || !pdfFile) return;
    const m = (markups as any[]).find((x: any) => x.id === notifMarkupId);
    if (!m) return;
    // small delay so the PDF page renders
    const t = setTimeout(() => {
      handleJumpToMarkup([notifMarkupId]);
      // Remove it from the URL so it doesn't trigger again on re-renders
      setSearchParams(
        (prev) => {
          prev.delete("markupId");
          return prev;
        },
        { replace: true },
      );
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifMarkupId, markups?.length, pdfFile]);

  const onDocumentLoadSuccess = async (pdf: any) => {
    setNumPages(pdf.numPages);
    try {
      const page = await pdf.getPage(1),
        viewport = page.getViewport({ scale: 1 });
      setPageDimensions({ width: viewport.width, height: viewport.height });
      const labels = await pdf.getPageLabels();
      setPageLabels(labels || []);
      const outline = await pdf.getOutline();
      setBookmarks(outline || []);
      setBookmarksLoaded(true);

      // Detect OCG (Optional Content Groups) layers -- Bluebeam overlay PDFs have these
      try {
        const ocConfig = await pdf.getOptionalContentConfig();
        if (ocConfig) {
          const groups = ocConfig.getGroups();
          if (groups && typeof groups === "object") {
            const layers: { name: string; visible: boolean }[] = [];
            for (const [id, group] of Object.entries(groups) as any) {
              if (group?.name) {
                layers.push({
                  name: group.name,
                  visible: group.visible !== false,
                });
              }
            }
            setPdfLayers(layers);
          }
        }
      } catch {
        /* no OCG support or no layers */
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Import embedded PDF annotations (Bluebeam compatibility)
  // Uses Y.js createMarkup so markups sync in real-time to all connected clients
  const handleImportAnnotations = useCallback(async () => {
    if (!embeddedAnnots || embeddedAnnots.length === 0) return;
    setIsImporting(true);
    const tid = toast.loading(
      `Importing ${embeddedAnnots.length} annotation${embeddedAnnots.length !== 1 ? "s" : ""}â€¦`,
    );
    try {
      for (const annot of embeddedAnnots) {
        await createMarkup({
          ...annot,
          documentId,
          allowedEditUserIds: userSettings.allowOthersEdit ? ["*"] : [],
          allowedDeleteUserIds: userSettings.allowOthersDelete ? ["*"] : [],
        });
      }
      setEmbeddedAnnots([]); // hide the badge after import
      toast.success(
        `Imported ${embeddedAnnots.length} annotation${embeddedAnnots.length !== 1 ? "s" : ""} from PDF`,
        { id: tid },
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed", { id: tid });
    } finally {
      setIsImporting(false);
    }
  }, [embeddedAnnots, documentId, createMarkup]);

  const handleToggleLayer = useCallback((t: string) => {
    setHiddenLayers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }, []);

  // â"€â"€â"€ 7. Render â"€â"€â"€
  const viewerBg = isDark ? "#121212" : "#8d8d8d";
  if ((authLoading || loading) && !doc)
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <CircularProgress />
      </Box>
    );
  if (!doc)
    return (
      <NotFoundPage
        title="Document Not Found"
        message="This document may have been deleted or you don't have access to it."
      />
    );

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        color: "text.primary",
        overflow: "hidden",
      }}
    >
      {!isSM && (
        <PdfToolbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          tool={tool}
          onToolChange={(t) => {
            setTool(t);
            activeElectricalConfigRef.current = null;
            setActiveElectricalConfig(null);
            activeReviewStampRef.current = null;
          }}
          activeColor={activeColor}
          onColorChange={setActiveColor}
          activeStrokeWidth={activeStrokeWidth}
          onStrokeWidthChange={setActiveStrokeWidth}
          activeLineStyle={activeLineStyle}
          onLineStyleChange={setActiveLineStyle}
          docScale={docScale}
          onDocScaleChange={handleDocScaleChange}
          zoom={displayScale}
          onZoomIn={() => handleZoom(0.1)}
          onZoomOut={() => handleZoom(-0.1)}
          currentPage={currentPage}
          numPages={numPages}
          onPageChange={handleJumpToPage}
          scrollMode={scrollMode}
          onScrollModeChange={setScrollMode}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          versions={doc?.versions}
          currentDocId={documentId}
          onVersionChange={(v) =>
            (window.location.href = `/projects/${projectId}/documents/${v}`)
          }
          canMarkup={canMarkup}
          onDownloadClean={canDownload ? handleDownloadClean : undefined}
          onExportPdf={canDownload ? handleExportPdf : undefined}
          pdfLoaded={!!pdfDoc}
          isExporting={canDownload ? isExporting : false}
          pageMarkupCount={
            (markups || []).filter(
              (m: any) =>
                m.pageNumber === currentPage - 1 && m.type !== "auto-highlight",
            ).length
          }
          embeddedAnnotCount={embeddedAnnots?.length ?? 0}
          onImportAnnotations={canMarkup ? handleImportAnnotations : undefined}
          isImporting={isImporting}
          onAddReviewStamp={canMarkup ? handleAddReviewStamp : undefined}
          onElectricalSelect={canMarkup ? handleElectricalSelect : undefined}
          onCompare={
            doc?.versions?.length > 1
              ? () => setCompareDialogOpen(true)
              : undefined
          }
          qaqcMode={qaqcMode}
          onToggleQaqc={handleToggleQaqc}
          qaqcPanelOpen={qaqcPanelOpen}
          onToggleQaqcPanel={() => {
            setQaqcPanelOpen((prev) => {
              if (!prev) setPropertiesOpen(false); // close properties when opening QA/QC
              return !prev;
            });
          }}
          spellErrorCount={spellErrors.length}
          draftMode={draftMode || collabMode === "edit"}
          draftCount={(() => {
            if (collabMode !== "draft" && collabMode !== "edit") return 0;
            const snap = draftSnapshotRef.current;
            const snapIds = new Set(snap.map((m: any) => m.id));
            const curIds = new Set(draftMarkups.map((m: any) => m.id));
            const added = draftMarkups.filter(
              (m: any) => m.properties?._draftNew,
            ).length;
            const deleted = snap.filter((m: any) => !curIds.has(m.id)).length;
            const modified = draftMarkups.filter((m: any) => {
              if (m.properties?._draftNew) return false;
              if (!snapIds.has(m.id)) return false;
              const orig = snap.find((o: any) => o.id === m.id);
              const _k = (o: any) =>
                JSON.stringify({ c: o.coordinates, p: o.properties });
              return orig && _k(orig) !== _k(m);
            }).length;
            return added + deleted + modified;
          })()}
          onApplyDrafts={handleApplyDrafts}
          onDiscardDrafts={handleDiscardDrafts}
          collabMode={collabMode}
          onCollabModeChange={handleCollabModeChange}
          editLockUser={editLockUser}
          connectedUsers={connectedUsers}
          personalMarkupCount={personalMarkups.length}
          onPublishPersonal={handlePublishPersonal}
          onDiscardPersonal={handleDiscardPersonal}
          isCompareMode={!!compareConfig}
          compareControls={
            compareConfig
              ? {
                  oldColor: compareConfig.oldColor,
                  newColor: compareConfig.newColor,
                  opacity: compareConfig.opacity,
                  showOld: compareShowOld,
                  showNew: compareShowNew,
                  oldLabel: (() => {
                    const idx = (doc?.versions || []).findIndex(
                      (v: any) => v.id === compareConfig.oldDocId,
                    );
                    return idx >= 0
                      ? `Rev ${(doc?.versions?.length || 0) - idx}`
                      : "Old";
                  })(),
                  newLabel: (() => {
                    const idx = (doc?.versions || []).findIndex(
                      (v: any) => v.id === compareConfig.newDocId,
                    );
                    return idx >= 0
                      ? `Rev ${(doc?.versions?.length || 0) - idx}`
                      : "New";
                  })(),
                  onToggleOld: () => setCompareShowOld((p) => !p),
                  onToggleNew: () => setCompareShowNew((p) => !p),
                  onOpacityChange: (v: number) =>
                    setCompareConfig((prev) =>
                      prev ? { ...prev, opacity: v } : null,
                    ),
                  onDetectChanges: handleDetectChanges,
                  isDetecting: isDetectingChanges,
                  onClose: handleExitCompare,
                  showMarkups: compareShowMarkups,
                  onToggleMarkups: () => setCompareShowMarkups((p) => !p),
                }
              : null
          }
          presets={toolChestPresets as any}
          onApplyPreset={handleApplyPreset}
          onDeletePreset={async (id: string) => {
            try {
              await apiFetch(`/api/presets/${id}`, { method: "DELETE" });
              queryClient.invalidateQueries({ queryKey: ["markupPresets"] });
              toast.success("Preset deleted");
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
          propertiesHidden={propertiesHidden}
          onToggleProperties={() =>
            setPropertiesHidden((h) => {
              if (!h) setPropertiesOpen(false);
              return !h;
            })
          }
          historyOpen={historyOpen}
          onToggleHistory={() => setHistoryOpen((h) => !h)}
        />
      )}

      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* -- Desktop Compare Bar -- inside content area, absolute top -- */}
        {compareConfig &&
          !isSM &&
          (() => {
            const cmpOld = (() => {
              const idx = (doc?.versions || []).findIndex(
                (v: any) => v.id === compareConfig.oldDocId,
              );
              return idx >= 0
                ? `Rev ${(doc?.versions?.length || 0) - idx}`
                : "Old";
            })();
            const cmpNew = (() => {
              const idx = (doc?.versions || []).findIndex(
                (v: any) => v.id === compareConfig.newDocId,
              );
              return idx >= 0
                ? `Rev ${(doc?.versions?.length || 0) - idx}`
                : "New";
            })();
            const layerBtn = (
              active: boolean,
              color: string,
              label: string,
              toggle: () => void,
            ) => (
              <Box
                onClick={toggle}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  cursor: "pointer",
                  px: 1,
                  py: 0.4,
                  borderRadius: "8px",
                  flexShrink: 0,
                  bgcolor: active ? alpha(color, 0.15) : "transparent",
                  border: `1.5px solid ${active ? color : theme.palette.divider}`,
                  "&:hover": { borderColor: color, bgcolor: alpha(color, 0.1) },
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "3px",
                    bgcolor: color,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: active ? color : "text.disabled",
                  }}
                >
                  {label}
                </Typography>
              </Box>
            );
            return (
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 100,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: "6px",
                  borderRadius: "14px",
                  bgcolor: alpha(theme.palette.background.paper, 0.96),
                  backdropFilter: "blur(16px)",
                  border: `1px solid ${theme.palette.divider}`,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                }}
              >
                {layerBtn(compareShowOld, compareConfig.oldColor, cmpOld, () =>
                  setCompareShowOld((p) => !p),
                )}
                {layerBtn(compareShowNew, compareConfig.newColor, cmpNew, () =>
                  setCompareShowNew((p) => !p),
                )}
                <Slider
                  size="small"
                  value={compareConfig.opacity}
                  min={10}
                  max={90}
                  step={5}
                  onChange={(_, v) =>
                    setCompareConfig((prev) =>
                      prev ? { ...prev, opacity: v as number } : null,
                    )
                  }
                  sx={{
                    color: gold,
                    flex: 1,
                    minWidth: 160,
                    mx: 0.5,
                    "& .MuiSlider-thumb": { width: 14, height: 14 },
                    "& .MuiSlider-rail": { opacity: 0.25 },
                  }}
                />
                <Typography
                  sx={{ fontSize: "0.75rem", fontWeight: 600, minWidth: 28 }}
                >
                  {compareConfig.opacity}%
                </Typography>
                <Tooltip
                  title={compareShowMarkups ? "Hide markups" : "Show markups"}
                >
                  <IconButton
                    size="small"
                    onClick={() => setCompareShowMarkups((p) => !p)}
                    sx={{
                      p: "5px",
                      color: compareShowMarkups ? gold : "text.disabled",
                      "&:hover": { bgcolor: alpha(gold, 0.12) },
                    }}
                  >
                    <LayersIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Auto-detect changes (place revision clouds)">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleDetectChanges}
                      disabled={isDetectingChanges}
                      sx={{
                        p: "5px",
                        color: gold,
                        "&:hover": { bgcolor: alpha(gold, 0.12) },
                      }}
                    >
                      {isDetectingChanges ? (
                        <CircularProgress size={16} sx={{ color: gold }} />
                      ) : (
                        <AutoFixHighIcon sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Exit compare">
                  <IconButton
                    size="small"
                    onClick={handleExitCompare}
                    sx={{
                      p: "5px",
                      color: "text.disabled",
                      "&:hover": { color: "error.main" },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            );
          })()}

        <PdfSidebar
          key={`sidebar-${documentId}`}
          open={sidebarOpen}
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          markups={visibleMarkups}
          selectedMarkupIds={selectedMarkupIds}
          onMarkupSelect={handleJumpToMarkup}
          onMarkupOpen={handleJumpToMarkup}
          onDeleteMarkup={handleDeleteMarkupDraft}
          hiddenLayers={hiddenLayers}
          onToggleLayer={handleToggleLayer}
          searchResults={searchResults}
          isSearching={isSearching}
          searchProgress={searchProgress}
          onSearch={handleSearch}
          jumpToPage={handleJumpToPage}
          searchKeyword={activeSearchKeyword}
          onSearchKeywordChange={setActiveSearchKeyword}
          bookmarks={bookmarks}
          bookmarksLoaded={bookmarksLoaded}
          numPages={numPages}
          onJumpToBookmark={handleJumpToBookmark}
          pdfData={pdfFile?.url}
          currentPage={currentPage}
          pageLabels={pageLabels}
          searchScope={searchScope}
          onSearchScopeChange={setSearchScope}
          searchMode={searchMode}
          onSearchModeChange={setSearchMode}
          onResetSearch={handleResetSearch}
          activeSearchResultIndex={activeSearchResultIndex}
          onSearchResultSelect={handleJumpToSearchMatch}
          onHighlightAll={handleHighlightAll}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          documentId={documentId}
          token={token || undefined}
          onBulkUpdateProperty={(ids, key, value) =>
            ids.forEach((id) => {
              const m = (markups || []).find((x: any) => x.id === id);
              if (m)
                handleUpdateProperties(id, {
                  properties: { ...m.properties, [key]: value },
                });
            })
          }
          pdfLayers={pdfLayers}
          onTogglePdfLayer={handleTogglePdfLayer}
        />

        {scrollMode === "split" ? (
          /* â"€â"€ SPLIT VIEW â"€â"€ two independent panels side by side â"€â"€ */
          <Box
            sx={{
              flexGrow: 1,
              display: "flex",
              height: "100%",
              overflow: "hidden",
              gap: "1px",
              bgcolor: "divider",
            }}
          >
            {(["left", "right"] as const).map((side) => {
              const pg = side === "left" ? currentPage : splitRightPage;
              const setPg =
                side === "left" ? setCurrentPage : setSplitRightPage;
              const panelZoom =
                side === "left" ? splitLeftZoom : splitRightZoom;
              const setPanelZoom =
                side === "left" ? setSplitLeftZoom : setSplitRightZoom;
              const scrollRef =
                side === "left" ? splitLeftScrollRef : splitRightScrollRef;
              return (
                <Box
                  key={side}
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    bgcolor: viewerBg,
                  }}
                >
                  {/* Panel scroll area â€" block-level overflow so centering works correctly at any zoom */}
                  <Box
                    ref={scrollRef}
                    sx={{
                      flex: 1,
                      overflow: "auto",
                      p: 2,
                      textAlign: "center",
                      "&::-webkit-scrollbar": { width: "6px", height: "6px" },
                      "&::-webkit-scrollbar-thumb": {
                        background: "rgba(128,128,128,0.3)",
                        borderRadius: "6px",
                      },
                    }}
                  >
                    {pdfFile && (
                      <Document
                        file={pdfFile}
                        onLoadSuccess={
                          side === "left" ? onDocumentLoadSuccess : undefined
                        }
                        loading={<CircularProgress />}
                      >
                        <Box sx={{ display: "inline-block" }}>
                          <PageContainer
                            pageIndex={pg - 1}
                            renderDelay={0}
                            pdfWidth={pageDimensions.width}
                            pdfHeight={pageDimensions.height}
                            scale={panelZoom}
                            markups={markupsByPage[pg - 1] || []}
                            tool={tool}
                            activeColor={activeColor}
                            activeStrokeWidth={activeStrokeWidth}
                            activeLineStyle={activeLineStyle}
                            docScale={docScale}
                            hiddenLayers={hiddenLayers}
                            selectedMarkupIds={selectedMarkupIds}
                            handleMarkupAdded={handleMarkupAddedDraft}
                            handleMarkupSelected={handleMarkupSelected}
                            handleMarkupModified={handleMarkupModifiedDraft}
                            handleMarkupDeleted={handleDeleteMarkupDraft}
                            handleContextMenu={handleContextMenu}
                            searchKeyword={activeSearchKeyword}
                            pdfDoc={pdfDoc}
                            currentUserId={user?.id}
                            isAdmin={isAdmin}
                            canMarkup={canMarkup}
                            activeSessionId={activeSessionId}
                            onCanvasMention={setCanvasMentionData}
                          />
                        </Box>
                      </Document>
                    )}
                  </Box>
                  {/* Per-panel navigation bar: page nav + independent zoom */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 0.5,
                      px: 1.5,
                      py: 0.5,
                      borderTop: 1,
                      borderColor: "divider",
                      bgcolor: "background.paper",
                      flexShrink: 0,
                    }}
                  >
                    {/* Page navigation */}
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.25 }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => setPg((p) => Math.max(1, p - 1))}
                        disabled={pg <= 1}
                        sx={{ p: 0.5 }}
                      >
                        <KeyboardArrowLeftIcon fontSize="small" />
                      </IconButton>
                      <Typography
                        variant="caption"
                        sx={{
                          minWidth: 52,
                          textAlign: "center",
                          fontWeight: 600,
                          fontSize: "0.68rem",
                        }}
                      >
                        {pg} / {numPages}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setPg((p) => Math.min(numPages, p + 1))}
                        disabled={pg >= numPages}
                        sx={{ p: 0.5 }}
                      >
                        <KeyboardArrowRightIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    {/* Zoom */}
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.25 }}
                    >
                      <IconButton
                        size="small"
                        onClick={() =>
                          setPanelZoom((z) =>
                            Math.max(0.1, Math.round((z - 0.1) * 100) / 100),
                          )
                        }
                        sx={{ p: 0.5, borderRadius: "6px" }}
                      >
                        <Typography
                          sx={{
                            fontSize: "1rem",
                            lineHeight: 1,
                            fontWeight: 400,
                          }}
                        >
                          âˆ'
                        </Typography>
                      </IconButton>
                      <Typography
                        variant="caption"
                        sx={{
                          minWidth: 34,
                          textAlign: "center",
                          fontWeight: 700,
                          fontSize: "0.68rem",
                        }}
                      >
                        {Math.round(panelZoom * 100)}%
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setPanelZoom((z) =>
                            Math.min(10, Math.round((z + 0.1) * 100) / 100),
                          )
                        }
                        sx={{ p: 0.5, borderRadius: "6px" }}
                      >
                        <Typography
                          sx={{
                            fontSize: "1rem",
                            lineHeight: 1,
                            fontWeight: 400,
                          }}
                        >
                          +
                        </Typography>
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          /* â"€â"€ NORMAL VIEW -- TileViewer (Go tile server) -- */
          <Box
            sx={{
              flexGrow: 1,
              height: "100%",
              position: "relative",
              overflow: "hidden",
              cursor:
                routePanelClickMode || routeMultiClickMode
                  ? "crosshair"
                  : undefined,
            }}
            onClick={
              routePanelClickMode || routeMultiClickMode
                ? (e: React.MouseEvent) => {
                    e.stopPropagation();
                    const tv = tileViewerRef.current;
                    if (!tv) return;
                    const world = tv.screenToWorld(e.clientX, e.clientY);
                    if (!world) return;
                    const pageCoord = tv.worldToPage(world.x, world.y);
                    if (!pageCoord) return;
                    const pt = {
                      x: Math.max(0, Math.min(1, pageCoord.nx)),
                      y: Math.max(0, Math.min(1, pageCoord.ny)),
                    };

                    const mode = routeModeRef.current;
                    if (mode === "panel") {
                      handleGenerateRoutes(pt);
                    } else if (mode === "multi") {
                      routePointsRef.current = [...routePointsRef.current, pt];
                      setRouteMultiClickPoints([...routePointsRef.current]);
                      toast(
                        `Point ${String.fromCharCode(64 + routePointsRef.current.length)} placed. Double-click to finish.`,
                        { duration: 1500 },
                      );
                    }
                  }
                : undefined
            }
            onDoubleClick={
              routePanelClickMode || routeMultiClickMode
                ? (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (routeModeRef.current === "multi") {
                      handleFinishMultiClickRoute();
                    }
                  }
                : undefined
            }
          >
            {(routePanelClickMode || routeMultiClickMode) && (
              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 1500,
                  bgcolor: alpha(gold, 0.9),
                  color: "#000",
                  px: 2,
                  py: 0.5,
                  borderRadius: 2,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  pointerEvents: "none",
                }}
              >
                {routeModeRef.current === "panel" &&
                  "Click to set start point (panel)"}
                {routeModeRef.current === "multi" &&
                  `Route: ${routeMultiClickPoints.length} point${routeMultiClickPoints.length !== 1 ? "s" : ""} -- click to add, double-click to finish`}
              </Box>
            )}
            {token && (
              <PdfErrorBoundary>
                <TileViewer
                  ref={tileViewerRef}
                  documentId={documentId}
                  token={token}
                  scale={zoom}
                  scrollMode={scrollMode as "page" | "continuous"}
                  currentPage={currentPage}
                  tool={tool}
                  onDocInfo={(info) => {
                    setNumPages(info.pageCount);

                    // P2-4: only set labels from tile-server if pdfjs outline hasn't provided them yet.
                    // This prevents tile-server plain numbers from overwriting real bookmark titles.
                    if (!pageLabelsFromOutlineRef.current) {
                      const labels = info.pages.map(
                        (p, i) => p.label || `${i + 1}`,
                      );
                      setPageLabels(labels);
                    }

                    // Note: pageDimensions is set from pdfjs (scale=1) only -- not from tile-server.
                    // Tile-server pages are 2× scale which would break search coord calculations.
                  }}
                  onZoom={(z) => {
                    setZoom(z);
                    setDisplayScale(z);
                  }}
                  onPageChange={setCurrentPage}
                  searchResults={searchResults}
                  activeSearchResultIndex={activeSearchResultIndex}
                  compareConfig={
                    compareConfig
                      ? {
                          oldDocId: compareConfig.oldDocId,
                          newDocId: compareConfig.newDocId,
                          oldColor: compareConfig.oldColor,
                          newColor: compareConfig.newColor,
                          opacity: compareConfig.opacity,
                          showOld: compareShowOld,
                          showNew: compareShowNew,
                          pageMapping:
                            compareConfig.pageMode === "custom"
                              ? (() => {
                                  const map: number[] = [];
                                  for (let i = 0; i < numPages; i++) {
                                    const pair =
                                      compareConfig.customMapping.find(
                                        (p) => p.newPage === i,
                                      );
                                    map.push(pair ? pair.oldPage : i);
                                  }
                                  return map;
                                })()
                              : undefined,
                        }
                      : null
                  }
                >
                  {(viewport, docInfo, layouts, cW, cH) => (
                    <>
                      {/* Vector sharpening: pdfjs renders visible area at exact DPR after scroll settles */}
                      <VectorSharpenOverlay
                        pdfDoc={pdfDoc}
                        viewport={viewport}
                        pageLayouts={layouts}
                        containerWidth={cW}
                        containerHeight={cH}
                      />
                      {/* Toggle between old (MarkupOverlay) and new (MarkupViewportCanvas) rendering engine */}
                      {useViewportCanvas ? (
                        <MarkupViewportCanvas
                          viewport={viewport}
                          pageLayouts={layouts}
                          containerWidth={cW}
                          containerHeight={cH}
                          markups={compareConfig && !compareShowMarkups ? [] : visibleMarkups}
                          tool={tool}
                          activeColor={activeColor}
                          activeStrokeWidth={activeStrokeWidth}
                          canMarkup={canMarkup}
                          isAdmin={isAdmin}
                          currentUserId={user?.id}
                          activeSessionId={activeSessionId || undefined}
                          onMarkupSelected={handleMarkupSelected}
                          onMarkupModified={handleMarkupModifiedDraft}
                          onMarkupAdded={handleMarkupAddedDraft}
                          onMarkupDeleted={handleDeleteMarkupDraft}
                          onDeselect={() => { setSelectedMarkupIds([]); setPropertiesOpen(false); }}
                          onContextMenu={(e: any, ids: string[]) => handleContextMenu(e, ids[0] || '')}
                          showAuthorOnMarkup={userSettings.showAuthorOnMarkup}
                        />
                      ) : (
                        <MarkupOverlay
                          viewport={viewport}
                          docInfo={docInfo}
                          layouts={layouts}
                          containerWidth={cW}
                          containerHeight={cH}
                          markups={
                            compareConfig && !compareShowMarkups
                              ? []
                              : visibleMarkups
                          }
                          tool={tool}
                          activeColor={activeColor}
                          activeStrokeWidth={activeStrokeWidth}
                          activeLineStyle={activeLineStyle}
                          docScale={docScale}
                          hiddenLayers={hiddenLayers}
                          selectedMarkupIds={selectedMarkupIds}
                          currentUserId={user?.id}
                          isAdmin={isAdmin}
                          canMarkup={canMarkup}
                          activeSessionId={activeSessionId}
                          onMarkupAdded={handleMarkupAddedDraft}
                          onMarkupSelected={handleMarkupSelected}
                          onMarkupModified={handleMarkupModifiedDraft}
                          onMarkupDeleted={handleDeleteMarkupDraft}
                          onContextMenu={handleContextMenu}
                          onCanvasMention={setCanvasMentionData}
                          onSwitchToSelect={() => setTool("select")}
                          electricalConfig={activeElectricalConfig}
                          pdfDoc={pdfDoc}
                          pdfFile={pdfFile}
                          pdfOptions={PDF_OPTIONS}
                          pdfjsPageWidth={pageDimensions.width}
                          searchResults={searchResults}
                          activeSearchResultIndex={activeSearchResultIndex}
                          snapGrid={
                            userSettings.snapToGrid
                              ? userSettings.gridSize
                              : undefined
                          }
                          pulseColor={
                            userSettings.pulseReviewMarkups
                              ? (userSettings as any).pulseColor
                              : undefined
                          }
                          pulseIntensity={
                            userSettings.pulseReviewMarkups
                              ? (userSettings as any).pulseIntensity
                              : undefined
                          }
                          showAuthorOnMarkup={userSettings.showAuthorOnMarkup}
                        />
                      )}
                      {/* Spell error highlight overlay */}
                      {activeSpellError &&
                        layouts.map((page) => {
                          if (page.index !== activeSpellError.pageNumber)
                            return null;
                          const currentCssScale =
                            viewport.zoom /
                            (viewport.zoom > 1
                              ? Math.min(viewport.zoom, 2)
                              : 1);
                          const px = (activeSpellError.x ?? 0.5) * page.w;
                          const py = (activeSpellError.y ?? 0.5) * page.h;
                          const cc = cW / viewport.zoom / 2;
                          const sx =
                            (cc + page.worldX + px - viewport.x) *
                              viewport.zoom -
                            30;
                          const sy =
                            (page.worldY + py - viewport.y) * viewport.zoom -
                            10;
                          return (
                            <div
                              key="spell-hl"
                              style={{
                                position: "absolute",
                                left: sx,
                                top: sy,
                                width: 60,
                                height: 24,
                                borderRadius: 4,
                                border: "2px solid #f44336",
                                backgroundColor: "rgba(244, 67, 54, 0.15)",
                                pointerEvents: "none",
                                zIndex: 25,
                                animation:
                                  "spellPulse 1.5s ease-in-out infinite",
                              }}
                            >
                              <style>{`@keyframes spellPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(244,67,54,0.5); } 50% { box-shadow: 0 0 12px 4px rgba(244,67,54,0.3); } }`}</style>
                            </div>
                          );
                        })}
                      {/* Collaboration cursor overlay — Miro-style with name pill */}
                      {(collabMode === "live" || collabMode === "edit") &&
                        userSettings.showCursors &&
                        connectedUsers.length > 0 &&
                        layouts &&
                        docInfo && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              pointerEvents: "none",
                              zIndex: 50,
                            }}
                          >
                            {connectedUsers
                              .filter((u) => u.cursor)
                              .map((u) => {
                                const c = u.cursor!;
                                const layout = layouts[c.pageIndex];
                                if (!layout) return null;
                                const pageInfo = docInfo.pages?.[c.pageIndex];
                                if (!pageInfo) return null;
                                const worldX = layout.worldX + c.x * pageInfo.w;
                                const worldY = layout.worldY + c.y * pageInfo.h;
                                const screenX =
                                  (worldX - viewport.x) * viewport.zoom +
                                  cW / 2;
                                const screenY =
                                  (worldY - viewport.y) * viewport.zoom;
                                if (
                                  screenX < -50 ||
                                  screenX > cW + 50 ||
                                  screenY < -50 ||
                                  screenY > cH + 50
                                )
                                  return null;
                                return (
                                  <div
                                    key={u.id}
                                    style={{
                                      position: "absolute",
                                      left: screenX,
                                      top: screenY,
                                      transition:
                                        "left 0.15s ease-out, top 0.15s ease-out",
                                    }}
                                  >
                                    {/* Cursor arrow */}
                                    <svg
                                      width="18"
                                      height="22"
                                      viewBox="0 0 18 22"
                                      fill="none"
                                      style={{
                                        filter:
                                          "drop-shadow(0 1px 3px rgba(0,0,0,0.35))",
                                      }}
                                    >
                                      <path
                                        d="M1 1L17 13L9 13L5 21L1 1Z"
                                        fill={u.color}
                                        stroke="#fff"
                                        strokeWidth="1"
                                      />
                                    </svg>
                                    {/* Name pill — Miro style */}
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: 16,
                                        top: 16,
                                        whiteSpace: "nowrap",
                                        background: u.color,
                                        color: "#fff",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        letterSpacing: "0.02em",
                                        padding: "2px 8px",
                                        borderRadius: "8px",
                                        lineHeight: "16px",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                                        maxWidth: 120,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {u.name}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                    </>
                  )}
                </TileViewer>
              </PdfErrorBoundary>
            )}
          </Box>
        )}

        <MarkupPropertiesPanel
          open={propertiesOpen && !propertiesHidden}
          onClose={() => {
            setSelectedMarkupIds([]);
            setPropertiesOpen(false);
          }}
          selectedMarkups={selectedMarkups}
          onUpdateProperties={handleUpdateProperties}
          onDeleteMarkup={handleDeleteMarkupDraft}
          documentId={documentId}
          projectId={projectId}
          onAction={handleMarkupAction}
          markups={visibleMarkups}
          canEdit={canMarkup ? canEditMarkup : false}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          docScale={docScale}
          onPresetSaved={() =>
            queryClient.invalidateQueries({ queryKey: ["markupPresets"] })
          }
        />

        <ReviewPanel
          open={qaqcPanelOpen}
          onClose={() => {
            setQaqcPanelOpen(false);
          }}
          documentId={documentId}
          projectId={projectId || ""}
          currentPage={currentPage}
          numPages={numPages}
          userId={user?.id || ""}
          userName={user?.name || user?.email}
          projectUsers={
            projectUsers?.map((u: any) => ({
              id: u.id,
              name: u.name || u.email,
              email: u.email,
            })) || []
          }
          spellErrors={spellErrors}
          spellScope={spellScope}
          onSpellScopeChange={handleSpellScopeChange}
          onJumpToSpellError={handleJumpToSpellError}
          onFixSpellWord={() => {}}
          onIgnoreSpellWord={handleIgnoreSpellWord}
          isSpellChecking={isSpellChecking}
          onRunSpellCheck={() => runSpellCheck(spellScope, ignoredWords)}
          onJumpToPage={(page) => {
            setCurrentPage(page);
            tileViewerRef.current?.navigateToPage(page);
          }}
          onPlacePin={(pageNumber, x, y, itemId) => {
            // Just save coordinates — don't create markup (it creates garbage)
            // The coordinates are already saved via the ReviewItem API
            toast.success(`Pinned to page ${pageNumber + 1}`);
          }}
          versions={doc?.versions}
          onLoadPreviousReview={(prevReview) => {
            // Place pins from previous review on current drawing for re-inspection
            const failItems = (prevReview.items || []).filter(
              (i: any) => i.result === "fail" && i.pinX != null,
            );
            for (const item of failItems) {
              handleMarkupAddedDraft({
                type: "cloud",
                pageNumber: item.pageNumber ?? 0,
                coordinates: {
                  left: (item.pinX || 0) - 0.03,
                  top: (item.pinY || 0) - 0.03,
                  width: 0.06,
                  height: 0.06,
                },
                properties: {
                  subject: `RE-INSPECT: ${item.templateItemId}`,
                  comment: item.comment || "Previous review issue",
                  stroke: "#ff9800",
                  strokeWidth: 3,
                  fill: "transparent",
                  lineStyle: "dashed",
                },
              });
            }
            toast.success(
              `Loaded ${failItems.length} issue(s) from previous review for re-inspection`,
            );
          }}
        />

        {/* ═══ MARKUP HISTORY PANEL ═══ */}
        {historyOpen && documentId && (
          <MarkupHistoryPanel
            documentId={documentId}
            isAdmin={isAdmin}
            numPages={numPages}
            onClose={() => setHistoryOpen(false)}
            onRestored={() => {
              window.location.reload();
            }}
            onNavigateToMarkup={(markupId, pageNumber, snapshotCoords) => {
              // Try live markup first
              const m = markups?.find((mk: any) => mk.id === markupId);
              if (m) {
                handleJumpToMarkup([markupId]);
                return;
              }
              // Fallback: use snapshot coordinates (works for deleted markups too)
              if (tileViewerRef.current && snapshotCoords) {
                const pageSize = tileViewerRef.current.getPageSize(pageNumber);
                const pw = pageSize?.w ?? 1190;
                const ph = pageSize?.h ?? 1684;
                let cx = pw / 2,
                  cy = ph / 2;
                if (snapshotCoords.left !== undefined) {
                  cx =
                    (snapshotCoords.left + (snapshotCoords.width || 0) / 2) *
                    pw;
                  cy =
                    ((snapshotCoords.top || 0) +
                      (snapshotCoords.height || 0) / 2) *
                    ph;
                } else if (snapshotCoords.x1 !== undefined) {
                  cx = ((snapshotCoords.x1 + snapshotCoords.x2) / 2) * pw;
                  cy = ((snapshotCoords.y1 + snapshotCoords.y2) / 2) * ph;
                }
                const targetZoom = Math.max(displayScale, 1.5);
                if (scrollMode === "page" && currentPage !== pageNumber + 1) {
                  setCurrentPage(pageNumber + 1);
                  tileViewerRef.current.navigateToPage(pageNumber + 1, true);
                }
                tileViewerRef.current.navigateToPagePoint(
                  pageNumber,
                  cx,
                  cy,
                  targetZoom,
                );
                tileViewerRef.current.prioritizePage(pageNumber);
              } else if (tileViewerRef.current) {
                // No coordinates — just go to the page
                if (scrollMode === "page") setCurrentPage(pageNumber + 1);
                tileViewerRef.current.navigateToPage(pageNumber + 1);
              }
            }}
          />
        )}

        {/* ═══ MOBILE TOOLBAR ═══ */}
        {isSM &&
          (() => {
            const isDrawTool =
              tool !== "select" && tool !== "pan" && tool !== "textSelect";
            const hasPropsRow = !(
              ["select", "pan", "textSelect", "image"] as DrawTool[]
            ).includes(tool);
            const cmpOldLabel = compareConfig
              ? (() => {
                  const idx = (doc?.versions || []).findIndex(
                    (v: any) => v.id === compareConfig.oldDocId,
                  );
                  return idx >= 0
                    ? `Rev ${(doc?.versions?.length || 0) - idx}`
                    : "Old";
                })()
              : "";
            const cmpNewLabel = compareConfig
              ? (() => {
                  const idx = (doc?.versions || []).findIndex(
                    (v: any) => v.id === compareConfig.newDocId,
                  );
                  return idx >= 0
                    ? `Rev ${(doc?.versions?.length || 0) - idx}`
                    : "New";
                })()
              : "";
            const presetColors = [
              "#f44336",
              "#ff9800",
              "#4caf50",
              "#2196f3",
              "#9c27b0",
              "#000000",
              "#ffffff",
              "#795548",
              "#607d8b",
            ];
            const isCustomColor = !presetColors.includes(activeColor);
            const strokePresets = [1, 2, 3, 5, 8];

            const TOOL_LABEL: Record<DrawTool, string> = {
              select: "Select",
              pan: "Pan",
              textSelect: "Text Sel.",
              pen: "Pen",
              highlighter: "Highlight",
              text: "Text Box",
              image: "Image",
              line: "Line",
              arrow: "Arrow",
              measure: "Measure",
              polyline: "Polyline",
              rect: "Rectangle",
              circle: "Circle",
              ellipse: "Ellipse",
              triangle: "Triangle",
              diamond: "Diamond",
              hexagon: "Hexagon",
              star: "Star",
              cloud: "Cloud",
              callout: "Cloud+",
              routeTemplate: "Route",
              electricalBox: "Box",
              stub: "Stub",
              fitting: "Fitting",
              panel: "Panel",
              wireTag: "Wire Tag",
              reviewStamp: "Stamp",
              stickyNote: "Sticky",
            };

            const TOOL_ICON: Record<DrawTool, React.ReactNode> = {
              select: <AdsClickIcon />,
              pan: <PanToolIcon />,
              textSelect: <AbcIcon />,
              pen: <CreateIcon />,
              highlighter: <HighlightIcon />,
              text: <TextFormatIcon />,
              image: <ImageOutlinedIcon />,
              line: <HorizontalRuleIcon />,
              arrow: <EastIcon />,
              measure: <StraightenIcon />,
              polyline: <PolylineIcon />,
              rect: <RectangleIcon />,
              circle: <CircleOutlinedIcon />,
              ellipse: (
                <CircleOutlinedIcon
                  sx={{ transform: "scaleX(1.4) scaleY(0.75)" }}
                />
              ),
              triangle: <ChangeHistoryIcon />,
              diamond: (
                <ChangeHistoryIcon
                  sx={{ transform: "rotate(45deg) scale(0.9)" }}
                />
              ),
              hexagon: <HexagonOutlinedIcon />,
              star: <StarOutlineIcon />,
              cloud: <CloudQueueIcon />,
              routeTemplate: <RouteIcon />,
              electricalBox: <ElectricalServicesIcon />,
              stub: <ElectricalServicesIcon />,
              fitting: <ElectricalServicesIcon />,
              panel: <ElectricalServicesIcon />,
              wireTag: <ElectricalServicesIcon />,
              reviewStamp: <PlaylistAddCheckIcon />,
              stickyNote: <span style={{ fontSize: 14 }}>📝</span>,
              callout: (
                <Box
                  sx={{
                    position: "relative",
                    display: "inline-flex",
                    lineHeight: 0,
                  }}
                >
                  <CloudQueueIcon />
                  <Box
                    component="span"
                    sx={{
                      position: "absolute",
                      bottom: -1,
                      right: -5,
                      fontSize: "0.6rem",
                      fontWeight: 900,
                      fontFamily: "monospace",
                    }}
                  >
                    +
                  </Box>
                </Box>
              ),
            };

            // Popup placement relative to toolbar
            const getPlacement = () => {
              const el = mobileToolbarRef.current;
              if (!el)
                return {
                  ao: {
                    vertical: "top" as const,
                    horizontal: "center" as const,
                  },
                  to: {
                    vertical: "bottom" as const,
                    horizontal: "center" as const,
                  },
                };
              const rect = el.getBoundingClientRect();
              if (rect.top + rect.height / 2 > window.innerHeight * 0.5)
                return {
                  ao: {
                    vertical: "top" as const,
                    horizontal: "center" as const,
                  },
                  to: {
                    vertical: "bottom" as const,
                    horizontal: "center" as const,
                  },
                };
              return {
                ao: {
                  vertical: "bottom" as const,
                  horizontal: "center" as const,
                },
                to: { vertical: "top" as const, horizontal: "center" as const },
              };
            };
            const pl = getPlacement();

            const shadow =
              theme.palette.mode === "dark"
                ? "0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)"
                : "0 8px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.1)";

            // Compact icon button style — smaller on tiny screens
            const isXS = window.innerWidth < 400;
            const tbBtn = (active = false) => ({
              p: isXS ? "4px" : "6px",
              borderRadius: "9px",
              minWidth: isXS ? 28 : 'auto',
              color: active ? gold : "text.secondary",
              bgcolor: active ? alpha(gold, 0.12) : "transparent",
              "&:hover": { bgcolor: alpha(gold, 0.12), color: gold },
              "&.Mui-disabled": { opacity: 0.3 },
              '& .MuiSvgIcon-root': { fontSize: isXS ? 16 : 20 },
            });

            // Tool chip for the bottom sheet
            const ToolChip = ({ t: tKey }: { t: DrawTool }) => {
              const active = tool === tKey;
              return (
                <Box
                  onClick={() => {
                    setTool(tKey);
                    setMobileToolsOpen(false);
                  }}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    px: "8px",
                    py: "9px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    flex: "1 1 60px",
                    maxWidth: 80,
                    bgcolor: active ? alpha(gold, 0.14) : "transparent",
                    color: active ? gold : "text.secondary",
                    border: `1.5px solid ${active ? alpha(gold, 0.45) : "transparent"}`,
                    transition: "all 0.13s",
                    "& svg": { fontSize: 22 },
                    "&:active": { transform: "scale(0.94)" },
                  }}
                >
                  {TOOL_ICON[tKey]}
                  <Typography
                    sx={{
                      fontSize: "0.58rem",
                      fontWeight: 600,
                      lineHeight: 1,
                      textAlign: "center",
                      color: "inherit",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {TOOL_LABEL[tKey]}
                  </Typography>
                </Box>
              );
            };

            const SectionLabel = ({ children }: { children: string }) => (
              <Typography
                sx={{
                  fontSize: "0.57rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  color: "text.disabled",
                  mb: 0.75,
                  px: 0.25,
                }}
              >
                {children}
              </Typography>
            );

            return (
              <>
                {/* ═══ PILL ═══ */}
                <Box
                  ref={mobileToolbarRef}
                  onPointerMove={handleMobileDragMove}
                  onPointerUp={handleMobileDragEnd}
                  sx={{
                    position: "fixed",
                    ...mobileToolbarStyle,
                    bgcolor: alpha(theme.palette.background.paper, 0.97),
                    backdropFilter: "blur(24px)",
                    borderRadius: "16px",
                    boxShadow: shadow,
                    zIndex: 1300,
                    userSelect: "none",
                    maxWidth: "calc(100vw - 32px)",
                    '@media (max-width: 749px)': {
                      width: 'calc(100vw - 32px)',
                    },
                  }}
                >
                  {/* -- Compare row -- above main, inside pill -- */}
                  {compareConfig && (
                    <Box
                      display="flex"
                      alignItems="center"
                      sx={{
                        px: "6px",
                        py: "4px",
                        gap: "4px",
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                      }}
                    >
                      <Box
                        onClick={() => setCompareShowOld((p) => !p)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                          cursor: "pointer",
                          px: 0.5,
                          py: 0.25,
                          borderRadius: "5px",
                          flexShrink: 0,
                          bgcolor: compareShowOld
                            ? alpha(compareConfig.oldColor, 0.15)
                            : "transparent",
                          border: `1.5px solid ${compareShowOld ? compareConfig.oldColor : theme.palette.divider}`,
                        }}
                      >
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: 1,
                            bgcolor: compareConfig.oldColor,
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: "0.62rem",
                            fontWeight: 600,
                            color: compareShowOld
                              ? compareConfig.oldColor
                              : "text.disabled",
                          }}
                        >
                          {cmpOldLabel}
                        </Typography>
                      </Box>
                      <Box
                        onClick={() => setCompareShowNew((p) => !p)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                          cursor: "pointer",
                          px: 0.5,
                          py: 0.25,
                          borderRadius: "5px",
                          flexShrink: 0,
                          bgcolor: compareShowNew
                            ? alpha(compareConfig.newColor, 0.15)
                            : "transparent",
                          border: `1.5px solid ${compareShowNew ? compareConfig.newColor : theme.palette.divider}`,
                        }}
                      >
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: 1,
                            bgcolor: compareConfig.newColor,
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: "0.62rem",
                            fontWeight: 600,
                            color: compareShowNew
                              ? compareConfig.newColor
                              : "text.disabled",
                          }}
                        >
                          {cmpNewLabel}
                        </Typography>
                      </Box>
                      <Slider
                        size="small"
                        value={compareConfig.opacity}
                        min={10}
                        max={90}
                        step={5}
                        onChange={(_, v) =>
                          setCompareConfig((prev) =>
                            prev ? { ...prev, opacity: v as number } : null,
                          )
                        }
                        sx={{
                          color: gold,
                          flex: 1,
                          mx: 0.5,
                          "& .MuiSlider-thumb": { width: 10, height: 10 },
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: "0.58rem",
                          fontWeight: 700,
                          minWidth: 20,
                          textAlign: "center",
                          color: "text.secondary",
                        }}
                      >
                        {compareConfig.opacity}%
                      </Typography>
                      <Tooltip
                        title={
                          compareShowMarkups ? "Hide markups" : "Show markups"
                        }
                      >
                        <IconButton
                          size="small"
                          onClick={() => setCompareShowMarkups((p) => !p)}
                          sx={{
                            p: "3px",
                            color: compareShowMarkups ? gold : "text.disabled",
                          }}
                        >
                          <LayersIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Auto-detect changes">
                        <span>
                          <IconButton
                            size="small"
                            onClick={handleDetectChanges}
                            disabled={isDetectingChanges}
                            sx={{ p: "3px", color: gold }}
                          >
                            {isDetectingChanges ? (
                              <CircularProgress
                                size={12}
                                sx={{ color: gold }}
                              />
                            ) : (
                              <AutoFixHighIcon sx={{ fontSize: 14 }} />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={handleExitCompare}
                        sx={{ p: "3px", color: "error.main" }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  )}

                  {/* -- Main buttons -- */}
                  <Box
                    display="flex"
                    alignItems="center"
                    sx={{
                      px: "4px",
                      py: "2px",
                      gap: "0px",
                      flexWrap: "nowrap",
                      justifyContent: "center",
                      '@media (max-width: 749px)': { flexWrap: 'wrap' },
                    }}
                  >
                    {/* Drag handle */}
                    <Box
                      onPointerDown={handleMobileDragStart}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        px: "2px",
                        color: "text.disabled",
                        cursor: "grab",
                        touchAction: "none",
                        "&:active": { cursor: "grabbing" },
                      }}
                    >
                      <DragIndicatorIcon sx={{ fontSize: 15 }} />
                    </Box>

                    {/* Sidebar */}
                    <IconButton
                      size="small"
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      sx={tbBtn(sidebarOpen)}
                    >
                      {sidebarOpen ? (
                        <MenuOpenIcon sx={{ fontSize: 19 }} />
                      ) : (
                        <MenuIcon sx={{ fontSize: 19 }} />
                      )}
                    </IconButton>

                    <Divider
                      orientation="vertical"
                      flexItem
                      sx={{
                        height: 18,
                        mx: "3px",
                        alignSelf: "center",
                        opacity: 0.3,
                      }}
                    />

                    {/* Page navigation */}
                    <IconButton
                      size="small"
                      onClick={() =>
                        handleJumpToPage(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage <= 1}
                      sx={tbBtn()}
                    >
                      <KeyboardArrowLeftIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1px",
                        px: "4px",
                        py: "2px",
                        bgcolor: alpha(gold, 0.07),
                        borderRadius: "7px",
                        mx: "1px",
                      }}
                    >
                      <InputBase
                        value={currentPage}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v)) handleJumpToPage(v);
                        }}
                        sx={{
                          width: 20,
                          "& input": {
                            textAlign: "center",
                            p: 0,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                          },
                        }}
                      />
                      <Typography sx={{ fontSize: "0.62rem", opacity: 0.45 }}>
                        /
                      </Typography>
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 600 }}>
                        {numPages}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() =>
                        handleJumpToPage(Math.min(numPages, currentPage + 1))
                      }
                      disabled={currentPage >= numPages}
                      sx={tbBtn()}
                    >
                      <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
                    </IconButton>

                    {/* Scroll mode toggle */}
                    <IconButton
                      size="small"
                      onClick={() =>
                        setScrollMode(
                          scrollMode === "continuous" ? "page" : "continuous",
                        )
                      }
                      title={
                        scrollMode === "continuous"
                          ? "Single page"
                          : "Continuous scroll"
                      }
                      sx={tbBtn(false)}
                    >
                      {scrollMode === "continuous" ? (
                        <ViewDayIcon sx={{ fontSize: 18 }} />
                      ) : (
                        <ArticleIcon sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>

                    {/* Active tool button + Review Stamps */}
                    {canMarkup && (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => setMobileToolsOpen(true)}
                          sx={{
                            p: "6px",
                            borderRadius: "9px",
                            color: isDrawTool ? gold : "text.secondary",
                            bgcolor: isDrawTool
                              ? alpha(gold, 0.12)
                              : "transparent",
                            "& svg": { fontSize: 19 },
                            "&:hover": {
                              bgcolor: alpha(gold, 0.12),
                              color: gold,
                            },
                          }}
                        >
                          {TOOL_ICON[tool]}
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => setMobileStampSheet(true)}
                          sx={{
                            p: "6px",
                            borderRadius: "9px",
                            color: "text.secondary",
                            "& svg": { fontSize: 19 },
                            "&:hover": {
                              bgcolor: alpha(gold, 0.12),
                              color: gold,
                            },
                          }}
                        >
                          <PlaylistAddCheckIcon sx={{ fontSize: 19 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => setMobileElectricalSheet(true)}
                          sx={{
                            p: "6px",
                            borderRadius: "9px",
                            color: "text.secondary",
                            "& svg": { fontSize: 19 },
                            "&:hover": {
                              bgcolor: alpha(gold, 0.12),
                              color: gold,
                            },
                          }}
                        >
                          <ElectricalServicesIcon sx={{ fontSize: 19 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => setMobileToolChestSheet(true)}
                          sx={{
                            p: "6px",
                            borderRadius: "9px",
                            color: "text.secondary",
                            "& svg": { fontSize: 19 },
                            "&:hover": {
                              bgcolor: alpha(gold, 0.12),
                              color: gold,
                            },
                          }}
                        >
                          <ConstructionIcon sx={{ fontSize: 19 }} />
                        </IconButton>
                      </>
                    )}

                    <Divider
                      orientation="vertical"
                      flexItem
                      sx={{
                        height: 18,
                        mx: "3px",
                        alignSelf: "center",
                        opacity: 0.3,
                      }}
                    />

                    {/* Undo / Redo */}
                    <IconButton
                      size="small"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      sx={tbBtn()}
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
                      </svg>
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      sx={tbBtn()}
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
                      </svg>
                    </IconButton>

                    <Divider
                      orientation="vertical"
                      flexItem
                      sx={{
                        height: 18,
                        mx: "3px",
                        alignSelf: "center",
                        opacity: 0.3,
                      }}
                    />

                    {/* Download — only if user has download permission */}
                    {canDownload && (
                      <IconButton
                        size="small"
                        onClick={() => setMobileDownloadOpen(true)}
                        sx={tbBtn()}
                      >
                        <DownloadIcon sx={{ fontSize: 19 }} />
                      </IconButton>
                    )}

                    {/* QA/QC panel button — only in QA/QC mode (mobile) */}
                    {collabMode === "qaqc" && (
                      <IconButton
                        size="small"
                        onClick={() =>
                          setQaqcPanelOpen((prev) => {
                            if (!prev) setPropertiesOpen(false);
                            return !prev;
                          })
                        }
                        sx={tbBtn(qaqcPanelOpen)}
                      >
                        <SpellcheckIcon sx={{ fontSize: 19 }} />
                      </IconButton>
                    )}

                    {/* Markup History (mobile) */}
                    <IconButton
                      size="small"
                      onClick={() => setMobileHistoryOpen(true)}
                      sx={tbBtn(mobileHistoryOpen)}
                    >
                      <ManageHistoryIcon sx={{ fontSize: 19 }} />
                    </IconButton>

                    {/* Compare (mobile) */}
                    {doc?.versions?.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={() => setCompareDialogOpen(true)}
                        sx={tbBtn(!!compareConfig)}
                      >
                        <CompareArrowsIcon sx={{ fontSize: 19 }} />
                      </IconButton>
                    )}

                    <Divider
                      orientation="vertical"
                      flexItem
                      sx={{
                        height: 18,
                        mx: "3px",
                        alignSelf: "center",
                        opacity: 0.3,
                      }}
                    />

                    {/* Collab mode indicator (mobile) — icon-based */}
                    {(() => {
                      const modeColor =
                        collabMode === "live"
                          ? "#4caf50"
                          : collabMode === "personal"
                            ? "#2196f3"
                            : collabMode === "edit"
                              ? "#ff9800"
                              : collabMode === "qaqc"
                                ? "#e91e63"
                                : "#ff9800";
                      // Compute changes count for personal/draft
                      const hasChanges = (() => {
                        if (collabMode === "personal") {
                          // Show Publish/Discard only when user has made actual changes
                          return personalMarkups.length > 0;
                        }
                        if (collabMode === "draft" || collabMode === "edit") {
                          const snap = draftSnapshotRef.current;
                          const curIds = new Set(
                            draftMarkups.map((m: any) => m.id),
                          );
                          const hasNew = draftMarkups.some(
                            (m: any) => m.properties?._draftNew,
                          );
                          const hasDeleted = snap.some(
                            (m: any) => !curIds.has(m.id),
                          );
                          const hasModified = draftMarkups.some((m: any) => {
                            if (m.properties?._draftNew) return false;
                            const orig = snap.find((o: any) => o.id === m.id);
                            const _k = (o: any) =>
                              JSON.stringify({
                                c: o.coordinates,
                                p: o.properties,
                              });
                            return orig && _k(orig) !== _k(m);
                          });
                          return hasNew || hasDeleted || hasModified;
                        }
                        return false;
                      })();
                      // Icons: Session = wifi/signal, Personal = person, Draft = edit
                      const modeIcon =
                        collabMode === "live" ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill={modeColor}
                          >
                            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                          </svg>
                        ) : collabMode === "personal" ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill={modeColor}
                          >
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                        ) : collabMode === "edit" ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill={modeColor}
                          >
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                          </svg>
                        ) : (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill={modeColor}
                          >
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                          </svg>
                        );
                      return (
                        <Box
                          onClick={(e: React.MouseEvent) => {
                            const modes: CollabMode[] = [
                              "personal",
                              "edit",
                              "live",
                            ];
                            const idx = modes.indexOf(collabMode);
                            handleCollabModeChange(
                              modes[(idx + 1) % modes.length],
                            );
                          }}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            px: "5px",
                            py: "3px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            bgcolor: alpha(modeColor, 0.12),
                            border: `1.5px solid ${alpha(modeColor, 0.4)}`,
                            "&:active": { transform: "scale(0.95)" },
                          }}
                        >
                          {/* Mode icon */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              lineHeight: 0,
                              ...(collabMode === "live" && {
                                animation: "pulse 2s infinite",
                                "@keyframes pulse": {
                                  "0%,100%": { opacity: 1 },
                                  "50%": { opacity: 0.4 },
                                },
                              }),
                            }}
                          >
                            {modeIcon}
                          </Box>
                          {/* Session: avatar dots */}
                          {(collabMode === "live" || collabMode === "edit") &&
                            connectedUsers.length > 0 && (
                              <Box sx={{ display: "flex" }}>
                                {connectedUsers.slice(0, 2).map((u: any) => (
                                  <Box
                                    key={u.id}
                                    sx={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: "50%",
                                      ml: "-3px",
                                      bgcolor: u.color || "#888",
                                      border: "1.5px solid",
                                      borderColor: "background.paper",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "0.42rem",
                                      fontWeight: 800,
                                      color: "#fff",
                                    }}
                                  >
                                    {(u.name || "?")[0].toUpperCase()}
                                  </Box>
                                ))}
                                {connectedUsers.length > 2 && (
                                  <Box
                                    sx={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: "50%",
                                      ml: "-3px",
                                      bgcolor: "grey.600",
                                      border: "1.5px solid",
                                      borderColor: "background.paper",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "0.4rem",
                                      fontWeight: 800,
                                      color: "#fff",
                                    }}
                                  >
                                    +{connectedUsers.length - 2}
                                  </Box>
                                )}
                              </Box>
                            )}
                          {/* Apply/Discard — only when there are actual changes */}
                          {hasChanges && (
                            <>
                              <Box
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  if (collabMode === "personal")
                                    handlePublishPersonal();
                                  else handleApplyDrafts();
                                }}
                                sx={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: "50%",
                                  bgcolor: "#4caf50",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  ml: "2px",
                                  cursor: "pointer",
                                }}
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="#fff"
                                >
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                              </Box>
                              <Box
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  if (collabMode === "personal")
                                    handleDiscardPersonal();
                                  else handleDiscardDrafts();
                                }}
                                sx={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: "50%",
                                  bgcolor: "#f44336",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                }}
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="#fff"
                                >
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                              </Box>
                            </>
                          )}
                        </Box>
                      );
                    })()}

                    <Divider
                      orientation="vertical"
                      flexItem
                      sx={{
                        height: 18,
                        mx: "3px",
                        alignSelf: "center",
                        opacity: 0.3,
                      }}
                    />

                    {/* Doc scale */}
                    <Select
                      size="small"
                      value={docScale}
                      onChange={(e) =>
                        handleDocScaleChange(e.target.value as string)
                      }
                      variant="standard"
                      disableUnderline
                      IconComponent={() => null}
                      sx={{
                        fontSize: "0.63rem",
                        fontWeight: 700,
                        color: "text.secondary",
                        minWidth: 36,
                        "& .MuiSelect-select": { p: "0 2px" },
                      }}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            bgcolor: "background.paper",
                            borderRadius: "12px",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                          },
                        },
                      }}
                    >
                      {STANDARD_SCALES.map((g: any, idx: number) =>
                        g.items ? (
                          [
                            <ListSubheader
                              key={`h-${idx}`}
                              sx={{
                                lineHeight: "28px",
                                fontSize: "0.58rem",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                color: gold,
                                bgcolor: "background.paper",
                              }}
                            >
                              {g.group}
                            </ListSubheader>,
                            ...g.items.map((item: any) => (
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
                            key={g.value}
                            value={g.value}
                            sx={{ fontSize: "0.75rem", fontWeight: 700 }}
                          >
                            {g.label}
                          </MenuItem>
                        ),
                      )}
                    </Select>

                    {/* Version */}
                    {doc?.versions && doc.versions.length > 0 && (
                      <>
                        <Divider
                          orientation="vertical"
                          flexItem
                          sx={{
                            height: 18,
                            mx: "3px",
                            alignSelf: "center",
                            opacity: 0.3,
                          }}
                        />
                        <Select
                          size="small"
                          value={documentId}
                          variant="standard"
                          disableUnderline
                          IconComponent={() => null}
                          onChange={(e) => {
                            window.location.href = `/projects/${projectId}/documents/${e.target.value}`;
                          }}
                          sx={{
                            fontSize: "0.63rem",
                            fontWeight: 700,
                            minWidth: 52,
                            "& .MuiSelect-select": { p: "0 2px" },
                          }}
                          MenuProps={{
                            PaperProps: {
                              sx: {
                                bgcolor: "background.paper",
                                borderRadius: "12px",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                              },
                            },
                          }}
                        >
                          {doc.versions.map((v: any, idx: number) => (
                            <MenuItem
                              key={v.id}
                              value={v.id}
                              sx={{ fontSize: "0.72rem" }}
                            >
                              V{doc.versions.length - idx} --{" "}
                              {dayjs(v.createdAt).format("MM/DD/YY")}
                            </MenuItem>
                          ))}
                        </Select>
                      </>
                    )}

                    {/* Properties panel toggle (mobile) */}
                    <IconButton
                      size="small"
                      onClick={() =>
                        setPropertiesHidden((h) => {
                          if (!h) setPropertiesOpen(false);
                          return !h;
                        })
                      }
                      sx={tbBtn(!propertiesHidden)}
                    >
                      <EditNoteIcon
                        sx={{
                          fontSize: 18,
                          opacity: propertiesHidden ? 0.35 : 1,
                        }}
                      />
                    </IconButton>
                  </Box>

                  {/* -- Properties row -- visible for drawing tools -- */}
                  {hasPropsRow && (
                    <Box
                      sx={{
                        borderTop: `1px solid ${alpha(theme.palette.divider, 0.35)}`,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        px: "8px",
                        py: "5px",
                      }}
                    >
                      {/* Color dot → native picker */}
                      <Box
                        component="label"
                        sx={{
                          position: "relative",
                          flexShrink: 0,
                          cursor: "pointer",
                          lineHeight: 0,
                        }}
                      >
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            bgcolor: activeColor,
                            outline: `2px solid ${alpha(theme.palette.divider, 0.5)}`,
                            outlineOffset: "1.5px",
                            boxShadow:
                              activeColor === "#ffffff"
                                ? `inset 0 0 0 1px ${alpha("#000", 0.15)}`
                                : "none",
                          }}
                        />
                        <input
                          type="color"
                          value={activeColor}
                          onChange={(e) => setActiveColor(e.target.value)}
                          style={{
                            position: "absolute",
                            inset: 0,
                            opacity: 0,
                            width: "100%",
                            height: "100%",
                            cursor: "pointer",
                          }}
                        />
                      </Box>

                      <Box
                        sx={{
                          width: "1px",
                          height: 14,
                          bgcolor: "divider",
                          flexShrink: 0,
                          opacity: 0.35,
                        }}
                      />

                      {/* Stroke width -- range slider */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          flex: 1,
                          minWidth: 0,
                          px: "2px",
                        }}
                      >
                        <Slider
                          size="small"
                          min={1}
                          max={20}
                          step={1}
                          value={activeStrokeWidth}
                          onChange={(_, v) => setActiveStrokeWidth(v as number)}
                          sx={{
                            color: gold,
                            height: 3,
                            p: "8px 0",
                            "& .MuiSlider-thumb": {
                              width: 12,
                              height: 12,
                              transition: "none",
                              "&:hover": {
                                boxShadow: `0 0 0 6px ${alpha(gold, 0.16)}`,
                              },
                            },
                            "& .MuiSlider-rail": { opacity: 0.22 },
                            "& .MuiSlider-track": { border: "none" },
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            minWidth: 16,
                            textAlign: "right",
                            color: "text.secondary",
                            flexShrink: 0,
                            lineHeight: 1,
                          }}
                        >
                          {activeStrokeWidth}
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          width: "1px",
                          height: 14,
                          bgcolor: "divider",
                          flexShrink: 0,
                          opacity: 0.35,
                        }}
                      />

                      {/* Line style dropdown */}
                      <Select
                        size="small"
                        value={activeLineStyle}
                        onChange={(e) =>
                          setActiveLineStyle(e.target.value as any)
                        }
                        variant="standard"
                        disableUnderline
                        sx={{
                          flexShrink: 0,
                          "& .MuiSelect-select": {
                            p: "0 18px 0 2px",
                            display: "flex",
                            alignItems: "center",
                            minHeight: "unset !important",
                          },
                          "& .MuiSelect-icon": {
                            right: 0,
                            color: "text.disabled",
                            fontSize: "16px",
                          },
                        }}
                        renderValue={(val) => (
                          <LinePreview
                            style={val as any}
                            previewWidth={42}
                            forceColor={theme.palette.text.secondary}
                          />
                        )}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              bgcolor: "background.paper",
                              borderRadius: "12px",
                              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                              minWidth: 90,
                            },
                          },
                        }}
                      >
                        {LINE_STYLES.map((ls) => (
                          <MenuItem
                            key={ls.key}
                            value={ls.key}
                            sx={{ py: "6px" }}
                          >
                            <LinePreview
                              style={ls.key}
                              previewWidth={60}
                              forceColor={theme.palette.text.primary}
                            />
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>
                  )}
                </Box>

                {/* ═══ TOOLS BOTTOM SHEET ═══ */}
                <Box
                  sx={{
                    display: mobileToolsOpen ? "block" : "none",
                    position: "fixed",
                    inset: 0,
                    bgcolor: "rgba(0,0,0,0.45)",
                    zIndex: 1400,
                    backdropFilter: "blur(2px)",
                  }}
                  onClick={() => setMobileToolsOpen(false)}
                />
                <Box
                  sx={{
                    position: "fixed",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1401,
                    bgcolor: "background.paper",
                    borderRadius: "20px 20px 0 0",
                    boxShadow: "0 -8px 48px rgba(0,0,0,0.25)",
                    transform: mobileToolsOpen
                      ? "translateY(0)"
                      : "translateY(110%)",
                    transition: "transform 0.27s cubic-bezier(0.32,0.72,0,1)",
                    maxHeight: "72vh",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Handle */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      pt: 1.5,
                      pb: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 4,
                        bgcolor: "divider",
                        borderRadius: 2,
                      }}
                    />
                  </Box>
                  {/* Header */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 2,
                      pb: 1,
                      flexShrink: 0,
                    }}
                  >
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
                      Markup Tools
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setMobileToolsOpen(false)}
                      sx={{ color: "text.secondary" }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    </IconButton>
                  </Box>

                  {/* Tool grid + Properties */}
                  <Box sx={{ overflowY: "auto", px: 2, pb: 3 }}>
                    <SectionLabel>Navigation</SectionLabel>
                    <Box display="flex" gap={0.75} mb={1.5}>
                      <ToolChip t="select" />
                      <ToolChip t="pan" />
                      <ToolChip t="textSelect" />
                    </Box>
                    <SectionLabel>Drawing</SectionLabel>
                    <Box display="flex" gap={0.75} mb={1}>
                      <ToolChip t="pen" />
                      <ToolChip t="highlighter" />
                      <ToolChip t="text" />
                      <ToolChip t="image" />
                    </Box>
                    <SectionLabel>Lines</SectionLabel>
                    <Box display="flex" gap={0.75} mb={1}>
                      <ToolChip t="line" />
                      <ToolChip t="arrow" />
                      <ToolChip t="measure" />
                      <ToolChip t="polyline" />
                    </Box>
                    <SectionLabel>Shapes</SectionLabel>
                    <Box display="flex" gap={0.75} mb={1} flexWrap="wrap">
                      <ToolChip t="rect" />
                      <ToolChip t="circle" />
                      <ToolChip t="ellipse" />
                      <ToolChip t="triangle" />
                      <ToolChip t="diamond" />
                      <ToolChip t="hexagon" />
                      <ToolChip t="star" />
                    </Box>
                    <SectionLabel>Cloud</SectionLabel>
                    <Box display="flex" gap={0.75} mb={1} flexWrap="wrap">
                      <ToolChip t="cloud" />
                      <ToolChip t="callout" />
                    </Box>
                    <SectionLabel>Routing</SectionLabel>
                    <Box display="flex" gap={0.75} mb={2}>
                      <ToolChip t="routeTemplate" />
                    </Box>
                  </Box>
                </Box>

                {/* ═══ DOWNLOAD POPUP ═══ */}
                <Popover
                  open={mobileDownloadOpen}
                  anchorEl={mobileToolbarRef.current}
                  onClose={() => setMobileDownloadOpen(false)}
                  anchorOrigin={pl.ao}
                  transformOrigin={pl.to}
                  slotProps={{
                    paper: {
                      sx: {
                        bgcolor: "background.paper",
                        borderRadius: "16px",
                        boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
                        minWidth: 230,
                        overflow: "hidden",
                        mt: pl.ao.vertical === "top" ? "-8px" : "8px",
                      },
                    },
                  }}
                >
                  <Box sx={{ p: 1.5 }}>
                    <Typography
                      sx={{
                        px: 1,
                        pb: 0.75,
                        color: "text.disabled",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        fontSize: "0.57rem",
                        letterSpacing: "0.08em",
                        display: "block",
                      }}
                    >
                      Download
                    </Typography>
                    <MenuItem
                      onClick={() => {
                        handleDownloadClean();
                        setMobileDownloadOpen(false);
                      }}
                      sx={{
                        borderRadius: "10px",
                        gap: 1.5,
                        py: 1.25,
                        "&:hover": { bgcolor: alpha(gold, 0.08) },
                      }}
                    >
                      <DownloadIcon
                        sx={{ fontSize: 20, color: "text.secondary" }}
                      />
                      <Box>
                        <Typography
                          sx={{ fontSize: "0.85rem", fontWeight: 600 }}
                        >
                          Without markups
                        </Typography>
                        <Typography
                          sx={{ fontSize: "0.7rem", color: "text.secondary" }}
                        >
                          Clean PDF file
                        </Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        handleExportPdf();
                        setMobileDownloadOpen(false);
                      }}
                      sx={{
                        borderRadius: "10px",
                        gap: 1.5,
                        py: 1.25,
                        "&:hover": { bgcolor: alpha(gold, 0.08) },
                      }}
                    >
                      <LayersIcon sx={{ fontSize: 20, color: gold }} />
                      <Box>
                        <Typography
                          sx={{ fontSize: "0.85rem", fontWeight: 600 }}
                        >
                          With markups
                        </Typography>
                        <Typography
                          sx={{ fontSize: "0.7rem", color: "text.secondary" }}
                        >
                          PDF with annotations
                        </Typography>
                      </Box>
                    </MenuItem>
                  </Box>
                </Popover>

                {/* Mobile Review Stamps -- bottom sheet like tools */}
                <Box
                  sx={{
                    display: mobileStampSheet ? "block" : "none",
                    position: "fixed",
                    inset: 0,
                    bgcolor: "rgba(0,0,0,0.45)",
                    zIndex: 1400,
                    backdropFilter: "blur(2px)",
                  }}
                  onClick={() => setMobileStampSheet(false)}
                />
                <Box
                  sx={{
                    position: "fixed",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1401,
                    bgcolor: "background.paper",
                    borderRadius: "20px 20px 0 0",
                    boxShadow: "0 -8px 48px rgba(0,0,0,0.25)",
                    transform: mobileStampSheet
                      ? "translateY(0)"
                      : "translateY(110%)",
                    transition: "transform 0.27s cubic-bezier(0.32,0.72,0,1)",
                    maxHeight: "72vh",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      pt: 1.5,
                      pb: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 4,
                        bgcolor: "divider",
                        borderRadius: 2,
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 2,
                      pb: 1,
                      flexShrink: 0,
                    }}
                  >
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
                      Review Stamps
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setMobileStampSheet(false)}
                      sx={{ color: "text.secondary" }}
                    >
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                  <Box sx={{ overflowY: "auto", flex: 1, px: 2, pb: 3 }}>
                    {["Favorites", "Status", "Issues", "Notes"].map((cat) => {
                      const stamps = REVIEW_STAMPS.filter(
                        (s) => s.category === cat,
                      );
                      if (stamps.length === 0) return null;
                      return (
                        <Box key={cat} sx={{ mb: 1 }}>
                          <SectionLabel>{cat}</SectionLabel>
                          <Box display="flex" gap={0.75} flexWrap="wrap">
                            {stamps.map((s) => {
                              const shape =
                                s.customProps?.stampShape || "rounded";
                              const hasFill =
                                s.customProps?.stampFill !== false;
                              const active = false;
                              return (
                                <Box
                                  key={s.id}
                                  onClick={() => {
                                    handleAddReviewStamp(s);
                                    setMobileStampSheet(false);
                                  }}
                                  sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "4px",
                                    px: "6px",
                                    py: "9px",
                                    borderRadius: "12px",
                                    cursor: "pointer",
                                    flex: "1 1 60px",
                                    maxWidth: 80,
                                    bgcolor: "transparent",
                                    color: s.color,
                                    border: `1.5px solid transparent`,
                                    transition: "all 0.13s",
                                    "&:active": {
                                      transform: "scale(0.94)",
                                      bgcolor: alpha(s.color, 0.1),
                                    },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: 28,
                                      height: 28,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      borderRadius:
                                        shape === "circle"
                                          ? "50%"
                                          : shape === "rounded"
                                            ? "8px"
                                            : "4px",
                                      border: `2px solid ${s.color}`,
                                      bgcolor: hasFill
                                        ? s.color
                                        : "transparent",
                                      color: hasFill ? "#fff" : s.color,
                                      fontSize: "0.9rem",
                                      fontWeight: 900,
                                      transform:
                                        shape === "diamond"
                                          ? "rotate(45deg) scale(0.75)"
                                          : undefined,
                                    }}
                                  >
                                    <span
                                      style={{
                                        transform:
                                          shape === "diamond"
                                            ? `rotate(-45deg) scale(${1 / 0.75})`
                                            : undefined,
                                      }}
                                    >
                                      {s.icon}
                                    </span>
                                  </Box>
                                  <Typography
                                    sx={{
                                      fontSize: "0.55rem",
                                      fontWeight: 600,
                                      lineHeight: 1,
                                      textAlign: "center",
                                      color: "text.secondary",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {s.label.length > 10
                                      ? s.label.split(" ")[0]
                                      : s.label}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                  {/* end scroll */}
                </Box>
                {/* end sheet */}

                {/* Mobile Electrical Elements -- bottom sheet */}
                <Box
                  sx={{
                    display: mobileElectricalSheet ? "block" : "none",
                    position: "fixed",
                    inset: 0,
                    bgcolor: "rgba(0,0,0,0.45)",
                    zIndex: 1400,
                    backdropFilter: "blur(2px)",
                  }}
                  onClick={() => setMobileElectricalSheet(false)}
                />
                <Box
                  sx={{
                    position: "fixed",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1401,
                    bgcolor: "background.paper",
                    borderRadius: "20px 20px 0 0",
                    boxShadow: "0 -8px 48px rgba(0,0,0,0.25)",
                    transform: mobileElectricalSheet
                      ? "translateY(0)"
                      : "translateY(110%)",
                    transition: "transform 0.27s cubic-bezier(0.32,0.72,0,1)",
                    maxHeight: "72vh",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      pt: 1.5,
                      pb: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 4,
                        bgcolor: "divider",
                        borderRadius: 2,
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 2,
                      pb: 1,
                      flexShrink: 0,
                    }}
                  >
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
                      Electrical Elements
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setMobileElectricalSheet(false)}
                      sx={{ color: "text.secondary" }}
                    >
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                  <Box sx={{ overflowY: "auto", flex: 1, px: 2, pb: 3 }}>
                    {(() => {
                      // Unified chip style matching ToolChip from Markup Tools
                      const EChip = ({
                        icon,
                        label,
                        color: c,
                        onClick: oc,
                      }: {
                        icon: React.ReactNode;
                        label: string;
                        color: string;
                        onClick: () => void;
                      }) => (
                        <Box
                          onClick={() => {
                            oc();
                            setMobileElectricalSheet(false);
                          }}
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            px: "6px",
                            py: "9px",
                            borderRadius: "12px",
                            cursor: "pointer",
                            flex: "1 1 60px",
                            maxWidth: 80,
                            color: c,
                            border: "1.5px solid transparent",
                            transition: "all 0.13s",
                            "&:active": {
                              transform: "scale(0.94)",
                              bgcolor: alpha(c, 0.1),
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "8px",
                              border: `2px solid ${c}`,
                              bgcolor: alpha(c, 0.08),
                              color: c,
                              fontSize: "0.55rem",
                              fontWeight: 800,
                              lineHeight: 1,
                            }}
                          >
                            {icon}
                          </Box>
                          <Typography
                            sx={{
                              fontSize: "0.55rem",
                              fontWeight: 600,
                              lineHeight: 1,
                              textAlign: "center",
                              color: "text.secondary",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {label}
                          </Typography>
                        </Box>
                      );
                      const conduitIcon = (sw: number) => (
                        <Box
                          sx={{
                            width: 14,
                            height: Math.max(1, Math.min(sw, 4)),
                            bgcolor: "currentColor",
                            borderRadius: sw > 2 ? 0.5 : 0,
                          }}
                        />
                      );
                      return (
                        <>
                          <SectionLabel>Conduit</SectionLabel>
                          <Box display="flex" gap={0.75} flexWrap="wrap" mb={1}>
                            {[
                              { l: '3/4"', sw: 1 },
                              { l: '1"', sw: 2 },
                              { l: '1¼"', sw: 2 },
                              { l: '1½"', sw: 3 },
                              { l: '2"', sw: 3 },
                              { l: '2½"', sw: 4 },
                              { l: '3"', sw: 5 },
                              { l: '4"', sw: 6 },
                              { l: '6"', sw: 8 },
                            ].map((c) => (
                              <EChip
                                key={c.l}
                                icon={conduitIcon(c.sw)}
                                label={c.l}
                                color="#1565c0"
                                onClick={() =>
                                  handleElectricalSelect({
                                    tool: "polyline",
                                    defaultText: c.l,
                                    size: 0,
                                    customProps: {
                                      conduitSize: c.l,
                                      redlineLabel: c.l,
                                    },
                                    color: "#1565c0",
                                    strokeWidth: c.sw,
                                    subject: `Conduit ${c.l}`,
                                  })
                                }
                              />
                            ))}
                          </Box>
                          <SectionLabel>Boxes</SectionLabel>
                          <Box display="flex" gap={0.75} flexWrap="wrap" mb={1}>
                            {[
                              { l: "JB", t: "JB" },
                              { l: "PB", t: "PB" },
                              { l: "Custom", t: "CB" },
                            ].map((b) => (
                              <EChip
                                key={b.l}
                                icon={<span>{b.t || "?"}</span>}
                                label={b.l}
                                color="#f9a825"
                                onClick={() =>
                                  handleElectricalSelect({
                                    tool: "electricalBox",
                                    defaultText: b.t,
                                    size: 0.03,
                                    customProps: { boxType: b.t || "Custom" },
                                    color: "#f9a825",
                                    subject:
                                      b.l === "Custom"
                                        ? "Custom Box"
                                        : `${b.t} Box`,
                                  })
                                }
                              />
                            ))}
                          </Box>
                          <SectionLabel>Stubs</SectionLabel>
                          <Box display="flex" gap={0.75} flexWrap="wrap" mb={1}>
                            <EChip
                              icon={<span>SU</span>}
                              label="Stub Up"
                              color="#757575"
                              onClick={() =>
                                handleElectricalSelect({
                                  tool: "stub",
                                  defaultText: "SU",
                                  size: 0.018,
                                  customProps: { stubDirection: "up" },
                                  color: "#757575",
                                  subject: "Stub Up",
                                })
                              }
                            />
                            <EChip
                              icon={<span>SD</span>}
                              label="Stub Down"
                              color="#424242"
                              onClick={() =>
                                handleElectricalSelect({
                                  tool: "stub",
                                  defaultText: "SD",
                                  size: 0.018,
                                  customProps: { stubDirection: "down" },
                                  color: "#424242",
                                  subject: "Stub Down",
                                })
                              }
                            />
                          </Box>
                          <SectionLabel>Supports</SectionLabel>
                          <Box display="flex" gap={0.75} flexWrap="wrap" mb={1}>
                            {[
                              { l: "Trapeze", s: "trapeze", sz: 0.04 },
                              { l: "Unistrut", s: "unistrut", sz: 0.04 },
                              { l: "Hanger", s: "hanger", sz: 0.012 },
                            ].map((s) => (
                              <EChip
                                key={s.l}
                                icon={
                                  <ElectricalServicesIcon
                                    sx={{ fontSize: 16 }}
                                  />
                                }
                                label={s.l}
                                color="#ff8f00"
                                onClick={() =>
                                  handleElectricalSelect({
                                    tool: "electricalBox",
                                    defaultText:
                                      s.l === "Hanger"
                                        ? ""
                                        : s.l.slice(0, 4).toUpperCase(),
                                    size: s.sz,
                                    customProps: {
                                      supportType: s.l,
                                      supportShape: s.s,
                                      ...(s.s !== "hanger"
                                        ? { fontSize: 3 }
                                        : {}),
                                    },
                                    color: "#ff8f00",
                                    subject: s.l,
                                  })
                                }
                              />
                            ))}
                          </Box>
                          <SectionLabel>Equipment</SectionLabel>
                          <Box display="flex" gap={0.75} flexWrap="wrap" mb={1}>
                            <EChip
                              icon={
                                <span style={{ fontSize: "0.45rem" }}>PNL</span>
                              }
                              label="Panel"
                              color="#d32f2f"
                              onClick={() =>
                                handleElectricalSelect({
                                  tool: "panel",
                                  defaultText: "PANEL",
                                  size: 0.05,
                                  customProps: { equipType: "Panel" },
                                  color: "#d32f2f",
                                  strokeWidth: 3,
                                  subject: "Panel",
                                })
                              }
                            />
                            <EChip
                              icon={
                                <span style={{ fontSize: "0.4rem" }}>DISC</span>
                              }
                              label="Disconnect"
                              color="#d32f2f"
                              onClick={() =>
                                handleElectricalSelect({
                                  tool: "panel",
                                  defaultText: "DISC",
                                  size: 0.04,
                                  customProps: { equipType: "Disconnect" },
                                  color: "#d32f2f",
                                  subject: "Disconnect",
                                })
                              }
                            />
                            <EChip
                              icon={
                                <span style={{ fontSize: "0.4rem" }}>XFMR</span>
                              }
                              label="Transformer"
                              color="#d32f2f"
                              onClick={() =>
                                handleElectricalSelect({
                                  tool: "stub",
                                  defaultText: "XFMR",
                                  size: 0.025,
                                  customProps: { equipType: "Transformer" },
                                  color: "#d32f2f",
                                  subject: "Transformer",
                                })
                              }
                            />
                            <EChip
                              icon={<span>M</span>}
                              label="Motor"
                              color="#d32f2f"
                              onClick={() =>
                                handleElectricalSelect({
                                  tool: "stub",
                                  defaultText: "M",
                                  size: 0.02,
                                  customProps: { equipType: "Motor" },
                                  color: "#d32f2f",
                                  subject: "Motor",
                                })
                              }
                            />
                          </Box>
                          <SectionLabel>Tags</SectionLabel>
                          <Box display="flex" gap={0.75} flexWrap="wrap" mb={1}>
                            <EChip
                              icon={<span>⚡</span>}
                              label="Wire Tag"
                              color="#ff6f00"
                              onClick={() =>
                                handleElectricalSelect({
                                  tool: "wireTag",
                                  defaultText: "#12 AWG",
                                  size: 0,
                                  customProps: { wireSize: "12 AWG" },
                                  color: "#ff6f00",
                                  subject: "Wire Tag",
                                })
                              }
                            />
                            <EChip
                              icon={<span>→</span>}
                              label="Home Run"
                              color="#ff6f00"
                              onClick={() =>
                                handleElectricalSelect({
                                  tool: "arrow",
                                  defaultText: "HR",
                                  size: 0,
                                  customProps: { tagType: "homerun" },
                                  color: "#ff6f00",
                                  subject: "Home Run",
                                })
                              }
                            />
                            <EChip
                              icon={
                                <span style={{ fontSize: "0.4rem" }}>FDR</span>
                              }
                              label="Feeder"
                              color="#d32f2f"
                              onClick={() =>
                                handleElectricalSelect({
                                  tool: "wireTag",
                                  defaultText: "FEEDER",
                                  size: 0,
                                  customProps: { tagType: "feeder" },
                                  color: "#d32f2f",
                                  subject: "Feeder Tag",
                                })
                              }
                            />
                            <EChip
                              icon={
                                <span style={{ fontSize: "0.4rem" }}>CKT</span>
                              }
                              label="Circuit"
                              color="#1565c0"
                              onClick={() =>
                                handleElectricalSelect({
                                  tool: "wireTag",
                                  defaultText: "CKT-1",
                                  size: 0,
                                  customProps: { tagType: "circuit" },
                                  color: "#1565c0",
                                  subject: "Circuit Label",
                                })
                              }
                            />
                          </Box>
                        </>
                      );
                    })()}
                  </Box>
                  {/* end scroll */}
                </Box>
                {/* end sheet */}

                {/* Mobile Tool Chest -- bottom sheet */}
                <Box
                  sx={{
                    display: mobileToolChestSheet ? "block" : "none",
                    position: "fixed",
                    inset: 0,
                    bgcolor: "rgba(0,0,0,0.45)",
                    zIndex: 1400,
                    backdropFilter: "blur(2px)",
                  }}
                  onClick={() => setMobileToolChestSheet(false)}
                />
                <Box
                  sx={{
                    position: "fixed",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1401,
                    bgcolor: "background.paper",
                    borderRadius: "20px 20px 0 0",
                    boxShadow: "0 -8px 48px rgba(0,0,0,0.25)",
                    transform: mobileToolChestSheet
                      ? "translateY(0)"
                      : "translateY(110%)",
                    transition: "transform 0.27s cubic-bezier(0.32,0.72,0,1)",
                    maxHeight: "72vh",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      pt: 1.5,
                      pb: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 4,
                        bgcolor: "divider",
                        borderRadius: 2,
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 2,
                      pb: 1,
                      flexShrink: 0,
                    }}
                  >
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
                      Tool Chest
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setMobileToolChestSheet(false)}
                      sx={{ color: "text.secondary" }}
                    >
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                  {canMarkup && selectedMarkupIds.length >= 1 && (
                    <Box sx={{ px: 2, pb: 1, flexShrink: 0 }}>
                      <Box
                        onClick={() => {
                          handleSaveCustomStamp();
                          setMobileToolChestSheet(false);
                        }}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 0.75,
                          py: 1,
                          borderRadius: "10px",
                          cursor: "pointer",
                          border: `1.5px dashed ${alpha(gold, 0.5)}`,
                          color: gold,
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          "&:active": {
                            bgcolor: alpha(gold, 0.1),
                            borderStyle: "solid",
                          },
                          transition: "all 0.15s",
                        }}
                      >
                        <ConstructionIcon sx={{ fontSize: 16 }} />
                        Save Current
                        {selectedMarkupIds.length > 1
                          ? ` (${selectedMarkupIds.length} markups)`
                          : ""}
                      </Box>
                    </Box>
                  )}
                  <Box sx={{ overflowY: "auto", flex: 1, px: 2, pb: 3 }}>
                    {toolChestPresets.length === 0 &&
                    selectedMarkupIds.length === 0 ? (
                      <Typography
                        sx={{
                          fontSize: "0.8rem",
                          color: "text.disabled",
                          fontStyle: "italic",
                          textAlign: "center",
                          py: 4,
                        }}
                      >
                        No presets yet. Save one from the Properties panel.
                      </Typography>
                    ) : (
                      <Box display="flex" gap={0.75} flexWrap="wrap">
                        {(toolChestPresets as any[]).map((preset: any) => {
                          const typeEntry = (preset.fields || []).find(
                            (f: any) => f.key === "__markupType__",
                          );
                          const mType =
                            typeEntry?.defaultValue || preset.markupType;
                          const isCS = mType === "customStamp";
                          const strokeField = (preset.fields || []).find(
                            (f: any) => f.key === "stroke",
                          );
                          // Custom stamps: deterministic color from name hash
                          const PCOLS = [
                            "#e91e63",
                            "#9c27b0",
                            "#673ab7",
                            "#3f51b5",
                            "#2196f3",
                            "#00bcd4",
                            "#009688",
                            "#4caf50",
                            "#ff9800",
                            "#ff5722",
                            "#795548",
                            "#607d8b",
                          ];
                          const nameHash = preset.name
                            .split("")
                            .reduce(
                              (h: number, c: string) =>
                                ((h << 5) - h + c.charCodeAt(0)) | 0,
                              0,
                            );
                          const rawIconColor = isCS
                            ? PCOLS[Math.abs(nameHash) % PCOLS.length]
                            : strokeField?.defaultValue || gold;
                          const iconColor =
                            !rawIconColor ||
                            rawIconColor === "transparent" ||
                            rawIconColor === "none"
                              ? gold
                              : rawIconColor;
                          // Initials: 1-2 letters from name
                          const words = preset.name.trim().split(/\s+/);
                          const initials =
                            words.length >= 2
                              ? (words[0][0] + words[1][0]).toUpperCase()
                              : preset.name.slice(0, 2).toUpperCase();
                          return (
                            <Box
                              key={preset.id}
                              onClick={() => {
                                handleApplyPreset(preset);
                                setMobileToolChestSheet(false);
                              }}
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "4px",
                                px: "6px",
                                py: "9px",
                                borderRadius: "12px",
                                cursor: "pointer",
                                flex: "1 1 60px",
                                maxWidth: 80,
                                color: iconColor,
                                border: "1.5px solid transparent",
                                transition: "all 0.13s",
                                "&:active": {
                                  transform: "scale(0.94)",
                                  bgcolor: alpha(iconColor, 0.1),
                                },
                              }}
                            >
                              <Box
                                sx={{
                                  width: 28,
                                  height: 28,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: "8px",
                                  border: `2px solid ${iconColor}`,
                                  bgcolor: isCS
                                    ? iconColor
                                    : alpha(iconColor, 0.08),
                                  color: isCS ? "#fff" : iconColor,
                                  fontSize: isCS ? "0.7rem" : undefined,
                                  fontWeight: 900,
                                  lineHeight: 1,
                                }}
                              >
                                {isCS ? (
                                  initials
                                ) : (
                                  <ConstructionIcon sx={{ fontSize: 16 }} />
                                )}
                              </Box>
                              <Typography
                                sx={{
                                  fontSize: "0.55rem",
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  textAlign: "center",
                                  color: "text.secondary",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: 70,
                                }}
                              >
                                {preset.name}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                  {/* end scroll */}
                </Box>
                {/* end sheet */}
              </>
            );
          })()}

        {/* ═══ MOBILE MARKUP HISTORY DRAWER ═══ */}
        {isSM && (
          <SwipeableDrawer
            anchor="bottom"
            open={mobileHistoryOpen}
            onOpen={() => setMobileHistoryOpen(true)}
            onClose={() => setMobileHistoryOpen(false)}
            disableSwipeToOpen
            ModalProps={{ keepMounted: false }}
            PaperProps={{
              sx: {
                height: "80vh",
                borderRadius: "20px 20px 0 0",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              },
            }}
          >
            {/* Drag handle */}
            <Box
              sx={{
                width: 40,
                height: 4,
                bgcolor: "divider",
                borderRadius: 2,
                mx: "auto",
                mt: 1.5,
                mb: 0.5,
                flexShrink: 0,
              }}
            />
            {documentId && (
              <MarkupHistoryPanel
                documentId={documentId}
                isAdmin={isAdmin}
                numPages={numPages}
                variant="drawer"
                onClose={() => setMobileHistoryOpen(false)}
                onRestored={() => {
                  setMobileHistoryOpen(false);
                  window.location.reload();
                }}
                onNavigateToMarkup={(markupId, pageNumber, snapshotCoords) => {
                  setMobileHistoryOpen(false);
                  const m = markups?.find((mk: any) => mk.id === markupId);
                  if (m) {
                    handleJumpToMarkup([markupId]);
                    return;
                  }
                  if (tileViewerRef.current && snapshotCoords) {
                    const pageSize =
                      tileViewerRef.current.getPageSize(pageNumber);
                    const pw = pageSize?.w ?? 1190;
                    const ph = pageSize?.h ?? 1684;
                    let cx = pw / 2,
                      cy = ph / 2;
                    if (snapshotCoords.left !== undefined) {
                      cx =
                        (snapshotCoords.left +
                          (snapshotCoords.width || 0) / 2) *
                        pw;
                      cy =
                        ((snapshotCoords.top || 0) +
                          (snapshotCoords.height || 0) / 2) *
                        ph;
                    } else if (snapshotCoords.x1 !== undefined) {
                      cx = ((snapshotCoords.x1 + snapshotCoords.x2) / 2) * pw;
                      cy = ((snapshotCoords.y1 + snapshotCoords.y2) / 2) * ph;
                    }
                    const targetZoom = Math.max(displayScale, 1.5);
                    if (scrollMode === "page") setCurrentPage(pageNumber + 1);
                    tileViewerRef.current.navigateToPagePoint(
                      pageNumber,
                      cx,
                      cy,
                      targetZoom,
                    );
                    tileViewerRef.current.prioritizePage(pageNumber);
                  } else if (tileViewerRef.current) {
                    if (scrollMode === "page") setCurrentPage(pageNumber + 1);
                    tileViewerRef.current.navigateToPage(pageNumber + 1);
                  }
                }}
              />
            )}
          </SwipeableDrawer>
        )}

        <Menu
          open={contextMenu !== null}
          onClose={() => setContextMenu(null)}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu !== null
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : undefined
          }
          slotProps={{
            paper: {
              sx: {
                minWidth: 160,
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                "& .MuiMenuItem-root": {
                  fontSize: "0.78rem",
                  gap: 1,
                  borderRadius: "4px",
                  mx: 0.5,
                  my: 0.25,
                },
                "& .MuiMenuItem-root:hover": { bgcolor: alpha(gold, 0.08) },
              },
            },
          }}
        >
          {canMarkup && (
            <MenuItem
              onClick={() => {
                handleMarkupAction("duplicate", contextMenu!.markupId);
                setContextMenu(null);
              }}
            >
              <ListItemIcon>
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText primary={t("duplicate", "Duplicate")} />
              <Typography variant="caption" color="text.secondary">
                Ctrl+D
              </Typography>
            </MenuItem>
          )}
          {canMarkup && <Divider sx={{ my: "4px !important" }} />}
          {/* Route Redline -- requires selected markups + route template on page */}
          {canMarkup &&
            selectedMarkupIds.length > 0 &&
            (markups || []).some(
              (m: any) =>
                m.type === "routeTemplate" && m.pageNumber === currentPage - 1,
            ) && (
              <>
                <MenuItem
                  onClick={() => {
                    setRouteWizardOpen(true);
                    setContextMenu(null);
                  }}
                >
                  <ListItemIcon>
                    <RouteIcon sx={{ fontSize: 16 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Route Redline"
                    secondary={`Route to ${selectedMarkupIds.length} device${selectedMarkupIds.length > 1 ? "s" : ""}`}
                    secondaryTypographyProps={{
                      sx: { fontSize: "0.6rem", color: "text.disabled" },
                    }}
                  />
                </MenuItem>
                <Divider sx={{ my: "4px !important" }} />
              </>
            )}
          {canMarkup && selectedMarkupIds.length >= 1 && (
            <>
              {/* Single simple markup → save style; multiple or compound → save as custom stamp */}
              {selectedMarkupIds.length === 1 &&
              SIMPLE_PRESET_TYPES.has(selectedMarkups?.[0]?.type) ? (
                <MenuItem
                  onClick={() => {
                    handleSaveStyleToChest();
                    setContextMenu(null);
                  }}
                >
                  <ListItemIcon>
                    <ConstructionIcon sx={{ fontSize: 16 }} />
                  </ListItemIcon>
                  <ListItemText primary="Save style to Tool Chest" />
                </MenuItem>
              ) : (
                <MenuItem
                  onClick={() => {
                    handleSaveCustomStamp();
                    setContextMenu(null);
                  }}
                >
                  <ListItemIcon>
                    <ConstructionIcon sx={{ fontSize: 16 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Save as Custom Stamp"
                    secondary={
                      selectedMarkupIds.length > 1
                        ? `${selectedMarkupIds.length} markups`
                        : undefined
                    }
                    secondaryTypographyProps={{
                      sx: { fontSize: "0.6rem", color: "text.disabled" },
                    }}
                  />
                </MenuItem>
              )}
              <Divider sx={{ my: "4px !important" }} />
            </>
          )}
          {/* Group / Ungroup */}
          {canMarkup && selectedMarkupIds.length >= 2 && (
            <MenuItem
              onClick={() => {
                const groupId = crypto.randomUUID();
                for (const id of selectedMarkupIds) {
                  const m = (markups || []).find((mk: any) => mk.id === id);
                  if (m)
                    handleUpdateProperties(id, {
                      properties: { ...m.properties, groupId },
                    });
                }
                toast.success(`Grouped ${selectedMarkupIds.length} markups`);
                setContextMenu(null);
              }}
            >
              <ListItemIcon>
                <GroupWorkIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText>Group (Ctrl+G)</ListItemText>
            </MenuItem>
          )}
          {canMarkup &&
            selectedMarkupIds.length >= 1 &&
            (() => {
              const selMarkup = (markups || []).find(
                (m: any) =>
                  selectedMarkupIds.includes(m.id) && m.properties?.groupId,
              );
              if (!selMarkup) return null;
              const groupCount = (markups || []).filter(
                (m: any) =>
                  m.properties?.groupId === selMarkup.properties.groupId,
              ).length;
              return (
                <MenuItem
                  onClick={() => {
                    const gid = selMarkup.properties.groupId;
                    const members = (markups || []).filter(
                      (m: any) => m.properties?.groupId === gid,
                    );
                    for (const gm of members) {
                      const { groupId: _, ...rest } = gm.properties || {};
                      handleUpdateProperties(gm.id, { _fullProperties: rest });
                    }
                    toast.success(`Ungrouped ${members.length} markups`);
                    setContextMenu(null);
                  }}
                >
                  <ListItemIcon>
                    <GroupWorkIcon sx={{ fontSize: 16, opacity: 0.5 }} />
                  </ListItemIcon>
                  <ListItemText>Ungroup ({groupCount})</ListItemText>
                </MenuItem>
              );
            })()}
          {canMarkup && <Divider sx={{ my: "4px !important" }} />}
          {canMarkup && (
            <MenuItem
              onClick={() => {
                handleMarkupAction("front", contextMenu!.markupId);
                setContextMenu(null);
              }}
            >
              <ListItemIcon>
                <FlipToFrontIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText primary={t("bringToFront", "Bring to Front")} />
            </MenuItem>
          )}
          {canMarkup && (
            <MenuItem
              onClick={() => {
                handleMarkupAction("back", contextMenu!.markupId);
                setContextMenu(null);
              }}
            >
              <ListItemIcon>
                <FlipToBackIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText primary={t("sendToBack", "Send to Back")} />
            </MenuItem>
          )}
          {canMarkup && <Divider sx={{ my: "4px !important" }} />}
          {canMarkup &&
            (markups.find((m: any) => m.id === contextMenu?.markupId)
              ?.properties?.locked ? (
              <MenuItem
                onClick={() => {
                  handleMarkupAction("unlock", contextMenu!.markupId);
                  setContextMenu(null);
                }}
              >
                <ListItemIcon>
                  <LockOpenIcon sx={{ fontSize: 16 }} />
                </ListItemIcon>
                <ListItemText primary={t("unlock", "Unlock")} />
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() => {
                  handleMarkupAction("lock", contextMenu!.markupId);
                  setContextMenu(null);
                }}
              >
                <ListItemIcon>
                  <LockIcon sx={{ fontSize: 16 }} />
                </ListItemIcon>
                <ListItemText primary={t("lock", "Lock")} />
              </MenuItem>
            ))}
          {canMarkup && <Divider sx={{ my: "4px !important" }} />}
          {canMarkup &&
            (() => {
              const cm = markups.find(
                (m: any) => m.id === contextMenu?.markupId,
              );
              const _dids = cm?.allowedDeleteUserIds;
              const canDel =
                !cm ||
                isAdmin ||
                (user?.id != null && cm.authorId === user.id) ||
                !_dids ||
                _dids.includes("*") ||
                (_dids.length > 0 &&
                  user?.id != null &&
                  _dids.includes(user.id));
              return canDel ? (
                <MenuItem
                  onClick={() => {
                    if (userSettings.confirmOnDelete) {
                      setDeleteDialog({
                        open: true,
                        ids: [contextMenu!.markupId],
                        count: 1,
                        skipped: 0,
                      });
                      setContextMenu(null);
                      return;
                    }
                    handleDeleteMarkupDraft(contextMenu!.markupId);
                    setContextMenu(null);
                  }}
                  sx={{ color: "error.main" }}
                >
                  <ListItemIcon>
                    <DeleteIcon sx={{ fontSize: 16, color: "error.main" }} />
                  </ListItemIcon>
                  <ListItemText primary={t("delete", "Delete")} />
                  <Typography variant="caption" color="error">
                    Del
                  </Typography>
                </MenuItem>
              ) : null;
            })()}
          <MenuItem
            onClick={() => {
              const m = markups.find(
                (mm: any) => mm.id === contextMenu?.markupId,
              );
              if (m) {
                setSelectedMarkupIds([m.id]);
                setPropertiesOpen(true);
              }
              setContextMenu(null);
            }}
          >
            <ListItemIcon>
              <ArticleIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primary={t("properties", "Properties")} />
          </MenuItem>
        </Menu>

        <Popover
          open={Boolean(canvasMentionData)}
          anchorReference="anchorPosition"
          anchorPosition={(() => {
            if (!canvasMentionData?.cursorPos || !canvasMentionData?.anchor)
              return undefined;
            const rect = canvasMentionData.anchor.getBoundingClientRect();
            return {
              top: rect.top + canvasMentionData.cursorPos.top,
              left: rect.left + canvasMentionData.cursorPos.left,
            };
          })()}
          onClose={() => setCanvasMentionData(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          disableAutoFocus
          disableEnforceFocus
          slotProps={{
            paper: {
              sx: {
                width: 200,
                maxHeight: 250,
                overflowY: "auto",
                zIndex: 3000,
              },
            },
          }}
        >
          <List dense>
            {projectUsers
              .filter(
                (u: any) =>
                  !canvasMentionData?.query ||
                  (u.name || u.email)
                    .toLowerCase()
                    .includes(canvasMentionData.query.toLowerCase()),
              )
              .map((user: any) => (
                <ListItemButton
                  key={user.id}
                  onClick={() =>
                    canvasMentionData?.onSelect(user.name || user.email)
                  }
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: "0.6rem" }}>
                      {(user.name || user.email)[0].toUpperCase()}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={user.name || user.email}
                    primaryTypographyProps={{
                      fontSize: "0.75rem",
                      noWrap: true,
                    }}
                  />
                </ListItemButton>
              ))}
          </List>
        </Popover>
      </Box>

      {/* -- Compare Dialog -- */}
      <CompareDialog
        open={compareDialogOpen}
        onClose={() => setCompareDialogOpen(false)}
        onCompare={handleStartCompare}
        currentDocId={documentId}
        versions={doc?.versions || []}
        numPages={numPages}
        pageLabels={pageLabels}
      />

      <RouteWizardDialog
        open={routeWizardOpen}
        onClose={() => setRouteWizardOpen(false)}
        templates={(markups || []).filter(
          (m: any) =>
            m.type === "routeTemplate" && m.pageNumber === currentPage - 1,
        )}
        selectedDevices={selectedMarkups}
        onStartRouting={(templateId, spacing, conduit) => {
          const endpoints = selectedMarkups.map((m: any) => m);
          setRoutePanelClickData({
            templateId,
            endpoints,
            spacing,
            conduit: conduit || null,
          });
          routeModeRef.current = "panel";
          routePointsRef.current = [];
          setRoutePanelClickMode(true);
          setRouteMultiClickMode(false);
          setRouteMultiClickPoints([]);
        }}
      />

      {/* Stamp name dialog */}
      <Dialog
        open={stampNameDialog.open}
        onClose={() => {
          stampNameDialog.resolve?.(null);
          setStampNameDialog({ open: false });
        }}
        PaperProps={{ sx: { borderRadius: "12px", minWidth: 320 } }}
      >
        <DialogTitle sx={{ fontSize: "1rem", fontWeight: 700, pb: 0.5 }}>
          Save as Custom Stamp
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography
            sx={{ fontSize: "0.8rem", color: "text.secondary", mb: 1.5 }}
          >
            {selectedMarkupIds.length} markup
            {selectedMarkupIds.length !== 1 ? "s" : ""} will be saved as a
            reusable stamp
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Stamp name"
            value={stampNameInput}
            onChange={(e) => setStampNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && stampNameInput.trim()) {
                stampNameDialog.resolve?.(stampNameInput.trim());
                setStampNameDialog({ open: false });
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              stampNameDialog.resolve?.(null);
              setStampNameDialog({ open: false });
            }}
            color="inherit"
            size="small"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              stampNameDialog.resolve?.(stampNameInput.trim());
              setStampNameDialog({ open: false });
            }}
            variant="contained"
            size="small"
            disabled={!stampNameInput.trim()}
            sx={{
              bgcolor: gold,
              color: "#000",
              "&:hover": { bgcolor: gold, filter: "brightness(1.1)" },
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Discard changes confirmation dialog */}
      <Dialog
        open={discardDialog.open}
        onClose={() =>
          setDiscardDialog({ open: false, message: "", targetMode: null })
        }
        PaperProps={{ sx: { borderRadius: "12px", minWidth: 340 } }}
      >
        <DialogTitle sx={{ fontSize: "1rem", fontWeight: 700, pb: 0.5 }}>
          Unsaved Changes
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
            {discardDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() =>
              setDiscardDialog({ open: false, message: "", targetMode: null })
            }
            color="inherit"
            size="small"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDiscardConfirm}
            variant="contained"
            size="small"
            color="error"
          >
            Discard
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() =>
          setDeleteDialog({ open: false, ids: [], count: 0, skipped: 0 })
        }
        PaperProps={{ sx: { borderRadius: "12px", minWidth: 340 } }}
      >
        <DialogTitle
          sx={{
            fontSize: "1rem",
            fontWeight: 700,
            pb: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <DeleteIcon sx={{ fontSize: 20, color: "error.main" }} />
          Delete Markup{deleteDialog.count !== 1 ? "s" : ""}
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
            {deleteDialog.count === 1
              ? "Are you sure you want to delete this markup? This action cannot be undone."
              : `Are you sure you want to delete ${deleteDialog.count} markup(s)? This action cannot be undone.`}
          </Typography>
          {deleteDialog.skipped > 0 && (
            <Typography
              sx={{ fontSize: "0.8rem", color: "warning.main", mt: 1 }}
            >
              {deleteDialog.skipped} locked/protected markup(s) will be skipped.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() =>
              setDeleteDialog({ open: false, ids: [], count: 0, skipped: 0 })
            }
            color="inherit"
            size="small"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              handleDeleteMarkupDraft(
                deleteDialog.ids.length === 1
                  ? deleteDialog.ids[0]
                  : deleteDialog.ids,
              );
              if (deleteDialog.skipped > 0)
                toast(
                  `Deleted ${deleteDialog.count}, skipped ${deleteDialog.skipped} locked/protected`,
                  { duration: 2000 },
                );
              setDeleteDialog({ open: false, ids: [], count: 0, skipped: 0 });
            }}
            variant="contained"
            size="small"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Markup Wheel — radial tool selector (press Q) */}
      <MarkupWheel
        open={wheelOpen}
        x={wheelPos.x}
        y={wheelPos.y}
        items={(() => {
          const allTools: Record<string, WheelItem> = {
            select: {
              id: "select",
              label: "Select",
              color: "#607d8b",
              tool: "select",
            },
            pen: { id: "pen", label: "Pen", color: "#f44336", tool: "pen" },
            highlighter: {
              id: "highlighter",
              label: "Highlight",
              color: "#ffeb3b",
              tool: "highlighter",
            },
            rect: {
              id: "rect",
              label: "Rectangle",
              color: "#2196f3",
              tool: "rect",
            },
            circle: {
              id: "circle",
              label: "Circle",
              color: "#00bcd4",
              tool: "circle",
            },
            cloud: {
              id: "cloud",
              label: "Cloud",
              color: "#9c27b0",
              tool: "cloud",
            },
            callout: {
              id: "callout",
              label: "Callout",
              color: "#ff9800",
              tool: "callout",
            },
            text: { id: "text", label: "Text", color: "#4caf50", tool: "text" },
            stickyNote: {
              id: "stickyNote",
              label: "Sticky Note",
              color: "#FFEB3B",
              tool: "stickyNote",
            },
            line: { id: "line", label: "Line", color: "#795548", tool: "line" },
            arrow: {
              id: "arrow",
              label: "Arrow",
              color: "#e91e63",
              tool: "arrow",
            },
            measure: {
              id: "measure",
              label: "Measure",
              color: "#00bcd4",
              tool: "measure",
            },
            polyline: {
              id: "polyline",
              label: "Polyline",
              color: "#ff5722",
              tool: "polyline",
            },
            image: {
              id: "image",
              label: "Image",
              color: "#607d8b",
              tool: "image",
            },
            // Review Stamps — all 16
            ...Object.fromEntries(
              REVIEW_STAMPS.map((s) => [
                `stamp-${s.id}`,
                {
                  id: `stamp-${s.id}`,
                  label: s.label,
                  color: s.color,
                  tool: "__stamp__",
                  config: s.id,
                },
              ]),
            ),
            // Electrical — all tools + conduits
            electricalBox: {
              id: "electricalBox",
              label: "Junction Box",
              color: "#795548",
              tool: "electricalBox",
            },
            "elec-pullbox": {
              id: "elec-pullbox",
              label: "Pull Box",
              color: "#795548",
              tool: "electricalBox",
            },
            "elec-custombox": {
              id: "elec-custombox",
              label: "Custom Box",
              color: "#795548",
              tool: "electricalBox",
            },
            stub: {
              id: "stub",
              label: "Stub Up",
              color: "#607d8b",
              tool: "stub",
            },
            "elec-stubdown": {
              id: "elec-stubdown",
              label: "Stub Down",
              color: "#607d8b",
              tool: "stub",
            },
            "elec-trapeze": {
              id: "elec-trapeze",
              label: "Trapeze",
              color: "#607d8b",
              tool: "electricalBox",
            },
            "elec-unistrut": {
              id: "elec-unistrut",
              label: "Unistrut",
              color: "#607d8b",
              tool: "electricalBox",
            },
            "elec-hanger": {
              id: "elec-hanger",
              label: "Hanger",
              color: "#607d8b",
              tool: "electricalBox",
            },
            panel: {
              id: "panel",
              label: "Panel",
              color: "#455a64",
              tool: "panel",
            },
            "elec-disconnect": {
              id: "elec-disconnect",
              label: "Disconnect",
              color: "#455a64",
              tool: "panel",
            },
            "elec-transformer": {
              id: "elec-transformer",
              label: "Transformer",
              color: "#455a64",
              tool: "panel",
            },
            "elec-motor": {
              id: "elec-motor",
              label: "Motor",
              color: "#455a64",
              tool: "panel",
            },
            wireTag: {
              id: "wireTag",
              label: "Wire Tag",
              color: "#9c27b0",
              tool: "wireTag",
            },
            "elec-homerun": {
              id: "elec-homerun",
              label: "Home Run",
              color: "#9c27b0",
              tool: "wireTag",
            },
            "elec-feeder": {
              id: "elec-feeder",
              label: "Feeder Tag",
              color: "#9c27b0",
              tool: "wireTag",
            },
            "elec-circuit": {
              id: "elec-circuit",
              label: "Circuit Label",
              color: "#9c27b0",
              tool: "wireTag",
            },
            routeTemplate: {
              id: "routeTemplate",
              label: "Route Template",
              color: "#00bcd4",
              tool: "routeTemplate",
            },
            "elec-conduit-3/4": {
              id: "elec-conduit-3/4",
              label: '3/4" Conduit',
              color: "#ff5722",
              tool: "polyline",
            },
            "elec-conduit-1": {
              id: "elec-conduit-1",
              label: '1" Conduit',
              color: "#ff5722",
              tool: "polyline",
            },
            "elec-conduit-1.5": {
              id: "elec-conduit-1.5",
              label: '1-1/2"',
              color: "#ff5722",
              tool: "polyline",
            },
            "elec-conduit-2": {
              id: "elec-conduit-2",
              label: '2" Conduit',
              color: "#ff5722",
              tool: "polyline",
            },
            "elec-conduit-3": {
              id: "elec-conduit-3",
              label: '3" Conduit',
              color: "#ff5722",
              tool: "polyline",
            },
            "elec-conduit-4": {
              id: "elec-conduit-4",
              label: '4" Conduit',
              color: "#ff5722",
              tool: "polyline",
            },
          };
          // Use user's configured wheel items
          const configured = (userSettings.wheelItems || [])
            .map((id) => allTools[id])
            .filter(Boolean) as WheelItem[];
          // Only user-configured items — no auto-additions
          return configured;
        })()}
        onSelect={(item) => {
          if (item.tool === "__preset__" && item.config) {
            handleApplyPreset(item.config);
          } else if (item.tool === "__stamp__" && item.config) {
            // Find matching review stamp by config ID
            const stamp = REVIEW_STAMPS.find((s) => s.id === item.config);
            if (stamp) handleAddReviewStamp(stamp);
          } else if (item.tool) {
            setTool(item.tool as DrawTool);
          }
        }}
        onClose={() => setWheelOpen(false)}
      />

      {/* -- Compare processing overlay -- blocks entire UI -- */}
      {compareProcessing && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            bgcolor: alpha(theme.palette.background.default, 0.75),
            backdropFilter: "blur(8px)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              p: 4,
              borderRadius: "20px",
              bgcolor: alpha(theme.palette.background.paper, 0.95),
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
            }}
          >
            <CircularProgress size={40} sx={{ color: gold }} />
            <Typography
              sx={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "text.primary",
              }}
            >
              Processing comparison...
            </Typography>
            <Typography
              sx={{
                fontSize: "0.78rem",
                color: "text.secondary",
                textAlign: "center",
                maxWidth: 280,
              }}
            >
              Please wait while the overlay is being generated. This may take a
              moment for large documents.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
});

export default DocumentViewPage;
