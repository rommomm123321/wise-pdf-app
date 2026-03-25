import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import dayjs from "dayjs";
import {
  Box,
  Typography,
  CircularProgress,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  LinearProgress,
  Stack,
  Divider,
  Tooltip,
  IconButton,
  useTheme,
  useMediaQuery,
  Grid,
  Button,
  Chip,
  Menu,
  MenuItem,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ShareIcon from "@mui/icons-material/Share";
import FolderIcon from "@mui/icons-material/Folder";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import VisibilityIcon from "@mui/icons-material/Visibility";
import HistoryIcon from "@mui/icons-material/History";
import UpgradeIcon from "@mui/icons-material/Upgrade";
import DownloadIcon from "@mui/icons-material/Download";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useProject } from "../hooks/useProjects";
import {
  useFolderContents,
  useCreateFolder,
  useUploadDocument,
  useDeleteDocument,
  useReplaceDocument,
  useUpdateFolder,
  useDeleteFolder,
  useBulkDeleteFolders,
  useBulkDeleteDocuments,
  useMoveFolder,
  useBulkMoveFolders,
  useBulkMoveDocuments,
} from "../hooks/useFolderContents";
import { useFolderTree, useRootFolder } from "../hooks/useFolderTree";
import { useMyProjectPermissions } from "../hooks/usePermissions";
import { useItemPermissions } from "../hooks/useSharing";
import { useUserPreferences } from "../hooks/useUserPreferences";
import Breadcrumbs from "../components/filemanager/Breadcrumbs";
import FileManagerToolbar, {
  type SortOption,
  type ViewMode,
  type GroupOption,
} from "../components/filemanager/FileManagerToolbar";
import FolderCard from "../components/filemanager/FolderCard";
import DocumentCard from "../components/filemanager/DocumentCard";
import FolderRow from "../components/filemanager/FolderRow";
import DocumentRow from "../components/filemanager/DocumentRow";
import CreateFolderDialog from "../components/filemanager/CreateFolderDialog";
import ReplaceDocumentDialog from "../components/filemanager/ReplaceDocumentDialog";
import RenameDialog from "../components/filemanager/RenameDialog";
import ConfirmDialog from "../components/filemanager/ConfirmDialog";
import ShareDialog from "../components/filemanager/ShareDialog";
import BulkActionsToolbar from "../components/layout/BulkActionsToolbar";
import MoveToFolderDialog from "../components/filemanager/MoveToFolderDialog";
import DocumentVersionsDialog from "../components/filemanager/DocumentVersionsDialog";
import toast from "react-hot-toast";
import { MOBILE_BREAKPOINT } from "../constants";

function FolderMobileCard({
  folder,
  t,
  navigate,
  onRename,
  onDelete,
  onShare,
  canEdit,
  canDelete,
  canManage,
  isSelected,
  onSelect,
  selectionMode,
}: any) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setAnchorEl(e.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 1.5,
        borderRadius: 2,
        position: "relative",
        bgcolor: isSelected ? "action.selected" : "background.paper",
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? "primary.main" : "divider",
        cursor: "pointer",
      }}
      onClick={() =>
        selectionMode
          ? onSelect(folder.id)
          : navigate(`/projects/${folder.projectId}/folders/${folder.id}`)
      }
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
          {selectionMode && (
            <Checkbox
              size="small"
              checked={isSelected}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(folder.id);
              }}
              sx={{ p: 0 }}
            />
          )}
          <FolderIcon color="primary" sx={{ fontSize: 24, flexShrink: 0 }} />
          <Typography variant="body1" fontWeight={700} noWrap>
            {folder.name}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleMenuOpen}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mt={1}
      >
        <Typography variant="caption" color="text.secondary">
          {dayjs(folder.createdAt).format("DD MMM YYYY")}
        </Typography>
        <Chip
          label={t("folder")}
          size="small"
          variant="outlined"
          sx={{ height: 18, fontSize: "0.65rem" }}
        />
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleMenuClose();
            navigate(`/projects/${folder.projectId}/folders/${folder.id}`);
          }}
        >
          <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
          {t("open")}
        </MenuItem>
        {canEdit && (
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleMenuClose();
              onRename(folder.id, folder.name);
            }}
          >
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            {t("rename")}
          </MenuItem>
        )}
        {canManage && (
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleMenuClose();
              onShare(folder.id);
            }}
          >
            <ShareIcon fontSize="small" sx={{ mr: 1 }} />
            {t("share")}
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleMenuClose();
              onDelete(folder.id);
            }}
            sx={{ color: "error.main" }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            {t("delete")}
          </MenuItem>
        )}
      </Menu>
    </Paper>
  );
}

function DocumentMobileCard({
  doc,
  t,
  onShare,
  onVersions,
  onDelete,
  onReplace,
  canEdit,
  canDelete,
  canManage,
  canDownload,
  isSelected,
  onSelect,
  selectionMode,
  navigate,
  projectId,
}: any) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 1.5,
        borderRadius: 2,
        position: "relative",
        bgcolor: isSelected ? "action.selected" : "background.paper",
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? "primary.main" : "divider",
        cursor: "pointer",
      }}
      onClick={() =>
        selectionMode
          ? onSelect(doc.id)
          : navigate(`/projects/${projectId}/documents/${doc.id}`)
      }
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
          {selectionMode && (
            <Checkbox
              size="small"
              checked={isSelected}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(doc.id);
              }}
              sx={{ p: 0 }}
            />
          )}
          <PictureAsPdfIcon
            color="error"
            sx={{ fontSize: 24, flexShrink: 0 }}
          />
          <Typography variant="body1" fontWeight={700} noWrap>
            {doc.name}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleMenuOpen}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mt={1}
      >
        <Box display="flex" gap={1}>
          <Typography variant="caption" color="text.secondary">
            v{doc.version} • {dayjs(doc.createdAt).format("DD MMM YYYY")}
          </Typography>
        </Box>
        <Chip
          label={doc.type?.toUpperCase() || "FILE"}
          size="small"
          color="info"
          variant="outlined"
          sx={{ height: 18, fontSize: "0.65rem" }}
        />
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleMenuClose();
            navigate(`/projects/${projectId}/documents/${doc.id}`);
          }}
        >
          <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
          {t("open")}
        </MenuItem>
        {canDownload && (
          <MenuItem
            component="a"
            href={doc.storageUrl}
            target="_blank"
            rel="noopener"
            onClick={(e) => {
              e.stopPropagation();
              handleMenuClose();
            }}
          >
            <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
            {t("download")}
          </MenuItem>
        )}
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleMenuClose();
            onVersions(doc.id, doc.name);
          }}
        >
          <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
          {t("versions")}
        </MenuItem>
        {canEdit && (
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleMenuClose();
              onReplace(doc.id);
            }}
          >
            <UpgradeIcon fontSize="small" sx={{ mr: 1 }} />
            {t("replace")}
          </MenuItem>
        )}
        {canManage && (
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleMenuClose();
              onShare(doc.id, doc.name);
            }}
          >
            <ShareIcon fontSize="small" sx={{ mr: 1 }} />
            {t("share")}
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleMenuClose();
              onDelete(doc.id);
            }}
            sx={{ color: "error.main" }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            {t("delete")}
          </MenuItem>
        )}
      </Menu>
    </Paper>
  );
}

import FileDownloadIcon from "@mui/icons-material/FileDownload";

export const FILE_MANAGER_COLUMNS = [
  { key: "name", label: "Name", required: true },
  { key: "type", label: "Type" },
  { key: "date", label: "Date" },
  { key: "version", label: "Version" },
  { key: "actions", label: "Actions" },
];

import { MOBILE_BREAKPOINT_PX } from "../constants";

export default function ProjectPage() {
  const { projectId, folderId } = useParams<{
    projectId: string;
    folderId?: string;
  }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT_PX})`);
  const isExtraSmall = useMediaQuery("(max-width:480px)");
  const navigate = useNavigate();

  const { data: project } = useProject(projectId);
  const { data: tree } = useFolderTree(projectId);
  const { data: rootFolder, isLoading: rootLoading } = useRootFolder(projectId);
  const { data: perms } = useMyProjectPermissions(projectId);
  const { preferences, updatePreferences } = useUserPreferences();

  // Determine active folder ID: from URL or Root folder
  const activeFolderId = folderId || rootFolder?.id;

  const [docPage, setDocPage] = useState(1);
  // Reset page when navigating to a different folder
  useEffect(() => {
    setDocPage(1);
  }, [activeFolderId]);

  const { data: contents, isLoading: contentsLoading } = useFolderContents(
    activeFolderId,
    docPage,
    50,
  );
  const docPagination = contents?.pagination;

  const [fmColsLoaded, setFmColsLoaded] = useState(false);
  const [fmCols, setFmCols] = useState<string[]>(
    FILE_MANAGER_COLUMNS.map((c) => c.key),
  );

  useEffect(() => {
    if (!fmColsLoaded) {
      const stored = preferences?.columnVisibility?.fileManager;
      if (stored) {
        setFmCols(stored);
      }
      setFmColsLoaded(true);
    }
  }, [preferences?.columnVisibility?.fileManager, fmColsLoaded]);

  const handleFmColsChange = (cols: string[]) => {
    setFmCols(cols);
    updatePreferences({
      columnVisibility: {
        ...(preferences?.columnVisibility || {}),
        fileManager: cols,
      },
    });
  };

  const showFmCol = (key: string) => fmCols.includes(key);

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const { mutate: performUpload, uploads } = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const replaceDocument = useReplaceDocument();
  const bulkDeleteFolders = useBulkDeleteFolders();
  const bulkDeleteDocs = useBulkDeleteDocuments();
  const moveFolder = useMoveFolder();
  const bulkMoveFolders = useBulkMoveFolders();
  const bulkMoveDocs = useBulkMoveDocuments();

  const [searchQuery, setSearchQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");
  const [sortBy, setSortBy] = useState<SortOption>(
    () =>
      (localStorage.getItem(`project-${projectId}-sort`) as SortOption) ||
      "manual",
  );
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("redlines-view-mode") as ViewMode;
    if (saved) return saved;
    return window.innerWidth < MOBILE_BREAKPOINT ? "grid" : "list";
  });

  // Selection
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replaceDocId, setReplaceDocId] = useState<string | null>(null);
  const [renameFolderData, setRenameFolderData] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [shareFolderData, setShareFolderData] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [shareDocData, setShareDocData] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [versionsDocData, setVersionsDocData] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Drag-to-upload state
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  const folderSharing = useItemPermissions("folder", shareFolderData?.id);
  const docSharing = useItemPermissions("document", shareDocData?.id);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("redlines-view-mode", mode);
  };

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    localStorage.setItem(`project-${projectId}-sort`, sort);
  };

  const canEdit = perms?.canEdit ?? false;
  const canDelete = perms?.canDelete ?? false;
  const canDownload = perms?.canDownload ?? false;
  const canManage = perms?.canManage ?? false;

  // OS file drag-to-upload handlers
  const handleFilesDrop = useCallback(
    (targetFolderId: string | undefined, files: FileList | File[]) => {
      if (!targetFolderId) return;
      if (!canEdit) {
        alert(t("noPermissionToUpload"));
        return;
      }

      const fileArray = Array.from(files);
      performUpload({ folderId: targetFolderId, files: fileArray });
    },
    [canEdit, t, performUpload],
  );

  const handlePageDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!canEdit) return;
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [canEdit],
  );

  const handlePageDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!canEdit) return;
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        setIsDraggingFiles(true);
      }
    },
    [canEdit],
  );

  const handlePageDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDraggingFiles(false);
    }
  }, []);

  const handlePageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFiles(false);
      if (!canEdit || !activeFolderId) return;
      handleFilesDrop(activeFolderId, e.dataTransfer.files);
    },
    [canEdit, activeFolderId, handleFilesDrop],
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && activeFolderId) {
      handleFilesDrop(activeFolderId, e.target.files);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !activeFolderId) return;

    const { source, destination, type, draggableId } = result;

    // Cross-folder DnD: dropping onto a folder card/row
    if (destination.droppableId.startsWith("drop-folder-")) {
      if (!canEdit) return; // Permission check
      const targetFolderId = destination.droppableId.replace(
        "drop-folder-",
        "",
      );

      const isDraggingSelected =
        type === "FOLDER"
          ? selectedFolderIds.includes(draggableId)
          : selectedDocIds.includes(draggableId);

      if (isDraggingSelected) {
        if (selectedFolderIds.length > 0)
          bulkMoveFolders.mutate({
            folderIds: selectedFolderIds,
            targetFolderId,
          });
        if (selectedDocIds.length > 0)
          bulkMoveDocs.mutate({ documentIds: selectedDocIds, targetFolderId });
        setSelectedFolderIds([]);
        setSelectedDocIds([]);
      } else {
        if (type === "DOCUMENT") {
          bulkMoveDocs.mutate({ documentIds: [draggableId], targetFolderId });
        } else if (type === "FOLDER") {
          moveFolder.mutate({
            folderId: draggableId,
            parentId: targetFolderId,
          });
        }
      }
      return;
    }

    // Normal reorder within same droppable
    if (sortBy !== "manual") return;
    if (type === "FOLDER") {
      const items = Array.from(sortedFolders);
      const [reordered] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reordered);
      const folderOrder = { ...(preferences.folderOrder || {}) };
      folderOrder[activeFolderId] = items.map((i) => i.id);
      updatePreferences({ folderOrder });
    } else {
      const items = Array.from(sortedDocs);
      const [reordered] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reordered);
      const documentOrder = { ...(preferences.documentOrder || {}) };
      documentOrder[activeFolderId] = items.map((i) => i.id);
      updatePreferences({ documentOrder });
    }
  };

  const filteredContents = useMemo(() => {
    if (!contents) return { folders: [], documents: [] };
    const q = searchQuery.toLowerCase();
    return {
      folders: (contents.folders || []).filter((f: any) =>
        f.name.toLowerCase().includes(q),
      ),
      documents: (contents.documents || []).filter((d: any) =>
        d.name.toLowerCase().includes(q),
      ),
    };
  }, [contents, searchQuery]);

  const sortedFolders = useMemo(() => {
    const result = [...filteredContents.folders];
    if (
      sortBy === "manual" &&
      activeFolderId &&
      preferences.folderOrder?.[activeFolderId]
    ) {
      const order = preferences.folderOrder[activeFolderId];
      const orderMap = new Map(
        order.map((id: string, index: number) => [id, index]),
      );
      result.sort(
        (a, b) =>
          Number(orderMap.get(a.id) ?? 999) - Number(orderMap.get(b.id) ?? 999),
      );
    } else {
      result.sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "date")
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        return 0;
      });
    }
    return result;
  }, [
    filteredContents.folders,
    sortBy,
    activeFolderId,
    preferences.folderOrder,
  ]);

  const sortedDocs = useMemo(() => {
    const result = [...filteredContents.documents];
    if (
      sortBy === "manual" &&
      activeFolderId &&
      preferences.documentOrder?.[activeFolderId]
    ) {
      const order = preferences.documentOrder[activeFolderId];
      const orderMap = new Map(
        order.map((id: string, index: number) => [id, index]),
      );
      result.sort(
        (a, b) =>
          Number(orderMap.get(a.id) ?? 999) - Number(orderMap.get(b.id) ?? 999),
      );
    } else {
      result.sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "date")
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        if (sortBy === "version") return b.version - a.version;
        return 0;
      });
    }
    return result;
  }, [
    filteredContents.documents,
    sortBy,
    activeFolderId,
    preferences.documentOrder,
  ]);

  const breadcrumbItems = useMemo(() => {
    const items: { label: string; href?: string }[] = [];
    if (project)
      items.push({ label: project.name, href: `/projects/${projectId}` });
    if (activeFolderId && tree) {
      const flatFolders = flattenTree(tree);
      const path: any[] = [];
      let current = flatFolders.find((f) => f.id === activeFolderId);
      while (current) {
        path.unshift(current);
        current = current.parentId
          ? flatFolders.find((f) => f.id === current!.parentId)
          : undefined;
      }
      for (const folder of path.slice(1)) {
        items.push({
          label: folder.name,
          href: `/projects/${projectId}/folders/${folder.id}`,
        });
      }
    }
    return items;
  }, [project, activeFolderId, tree, projectId]);

  const toggleFolderSelect = (id: string) =>
    setSelectedFolderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  const toggleDocSelect = (id: string) =>
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const selectAllFolders = (checked: boolean) => {
    if (checked) {
      setSelectedFolderIds(sortedFolders.map((f: any) => f.id));
    } else {
      setSelectedFolderIds([]);
    }
  };

  const selectAllDocs = (checked: boolean) => {
    if (checked) {
      setSelectedDocIds(sortedDocs.map((d: any) => d.id));
    } else {
      setSelectedDocIds([]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedFolderIds.length > 0) {
      bulkDeleteFolders.mutate(selectedFolderIds, {
        onSuccess: () =>
          toast.success(t("foldersDeleted", "Folders deleted successfully")),
        onError: (err: any) =>
          toast.error(err.message || t("errorDeleteFolders")),
      });
    }
    if (selectedDocIds.length > 0) {
      bulkDeleteDocs.mutate(selectedDocIds, {
        onSuccess: () =>
          toast.success(
            t("documentsDeleted", "Documents deleted successfully"),
          ),
        onError: (err: any) =>
          toast.error(err.message || t("errorDeleteDocuments")),
      });
    }
    setSelectedFolderIds([]);
    setSelectedDocIds([]);
    setConfirmBulkDelete(false);
  };

  const handleBulkMove = (targetFolderId: string) => {
    if (selectedFolderIds.length > 0)
      bulkMoveFolders.mutate({ folderIds: selectedFolderIds, targetFolderId });
    if (selectedDocIds.length > 0)
      bulkMoveDocs.mutate({ documentIds: selectedDocIds, targetFolderId });
    setSelectedFolderIds([]);
    setSelectedDocIds([]);
  };

  const handleBulkDownload = async (onlyLatest: boolean) => {
    try {
      const toastId = toast.loading(t("downloading", "Preparing download..."));
      const response = await fetch("/api/folders/bulk/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          folderIds: selectedFolderIds,
          documentIds: selectedDocIds,
          onlyLatest,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `download_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(t("downloadComplete", "Download complete!"), {
        id: toastId,
      });
      setSelectedFolderIds([]);
      setSelectedDocIds([]);
    } catch (err: any) {
      toast.error(t("downloadFailed", "Download failed: ") + err.message);
    }
  };

  if (!projectId) return null;

  return (
    <Box
      onDragOver={handlePageDragOver}
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
      sx={{
        position: "relative",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        px: { xs: 1, sm: 1, md: 1 },
        py: { xs: 1, sm: 1 },
      }}
    >
      {/* Upload Progress Widget */}
      {uploads.length > 0 && (
        <Paper
          elevation={6}
          sx={{
            position: "fixed",
            bottom: isMobile ? 80 : 24,
            right: isMobile ? 16 : 24,
            width: isMobile ? "calc(100% - 32px)" : 340,
            maxHeight: 400,
            overflowY: "auto",
            zIndex: 1000,
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              p: 2,
              bgcolor: uploads.some((u) => u.status === "error")
                ? "error.main"
                : "primary.main",
              color: "primary.contrastText",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="subtitle2" fontWeight={700}>
              {t("uploadingFiles")} (
              {uploads.filter((u) => u.status === "completed").length}/
              {uploads.length})
            </Typography>
          </Box>
          <Stack spacing={0} divider={<Divider />}>
            {uploads.map((u, i) => (
              <Box key={i} sx={{ p: 1.5 }}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={0.5}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    sx={{ maxWidth: "80%" }}
                  >
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ fontWeight: 600 }}
                    >
                      {u.fileName}
                    </Typography>
                    {u.status === "error" && (
                      <Tooltip title={u.errorMessage || t("uploadErrorHint")}>
                        <ErrorIcon
                          sx={{
                            fontSize: 14,
                            color: "error.main",
                            cursor: "help",
                          }}
                        />
                      </Tooltip>
                    )}
                  </Box>
                  {u.status === "completed" && (
                    <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />
                  )}
                  {u.status === "error" && (
                    <ErrorIcon color="error" sx={{ fontSize: 16 }} />
                  )}
                  {u.status === "uploading" && (
                    <Typography variant="caption" color="primary">
                      {u.progress}%
                    </Typography>
                  )}
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={u.progress}
                  color={
                    u.status === "error"
                      ? "error"
                      : u.status === "completed"
                        ? "success"
                        : "primary"
                  }
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Drop Overlay */}
      {isDraggingFiles && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: "rgba(25, 118, 210, 0.1)",
            border: "2px dashed",
            borderColor: "primary.main",
            borderRadius: 2,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Paper
            sx={{
              p: isMobile ? 2 : 4,
              textAlign: "center",
              borderRadius: 4,
              boxShadow: 10,
              mx: 2,
            }}
          >
            <Typography
              variant={isMobile ? "h6" : "h5"}
              color="primary"
              fontWeight={700}
            >
              {t("dropFilesToUpload")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("dropFilesHint")}
            </Typography>
          </Paper>
        </Box>
      )}
      {/* Search Input for document navigation */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileUpload}
        multiple
        accept=".pdf"
      />

      {/* Header Layout (Unified with UsersPage) */}
      <Box
        display="flex"
        flexDirection={isMobile ? "column" : "row"}
        justifyContent="space-between"
        alignItems={isMobile ? "flex-start" : "center"}
        gap={2}
        mb={3}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant={isMobile ? "h6" : "h5"}
            fontWeight={800}
            noWrap
            sx={{ letterSpacing: -0.5 }}
          >
            {project?.name || "..."}
          </Typography>
          <Breadcrumbs items={breadcrumbItems} />
        </Box>

        {canEdit && (
          <Box
            display="flex"
            gap={1}
            flexWrap="wrap"
            sx={{ width: isMobile ? "100%" : "auto", flexShrink: 0 }}
          >
            <Button
              variant="outlined"
              startIcon={<CreateNewFolderIcon />}
              onClick={() => setShowCreateFolder(true)}
              size={isExtraSmall ? "small" : "medium"}
              sx={{ flexGrow: isExtraSmall ? 1 : 0, fontWeight: 600 }}
            >
              {t("createFolder")}
            </Button>
            <Button
              variant="contained"
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              size={isExtraSmall ? "small" : "medium"}
              sx={{ flexGrow: isExtraSmall ? 1 : 0, fontWeight: 600 }}
            >
              {t("uploadDocument")}
            </Button>
          </Box>
        )}
      </Box>

      {/* Toolbar — Filter block only */}
      <FileManagerToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        groupBy={groupBy}
        onGroupChange={setGroupBy}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        canEdit={canEdit}
        fmCols={fmCols}
        onFmColsChange={handleFmColsChange}
      />

      {contentsLoading || rootLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Folders Section */}
          {sortedFolders.length > 0 && (
            <Box mb={4}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1, display: "block" }}
              >
                {t("folders")} ({sortedFolders.length})
              </Typography>
              <Droppable
                droppableId="folders"
                type="FOLDER"
                direction={viewMode === "grid" ? "horizontal" : "vertical"}
              >
                {(provided) =>
                  viewMode === "grid" ? (
                    <Grid
                      container
                      spacing={isMobile ? 1.5 : 2}
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {sortedFolders.map((folder: any, index: number) => (
                        <Draggable
                          key={folder.id}
                          draggableId={folder.id}
                          index={index}
                          isDragDisabled={!canEdit && sortBy !== "manual"}
                        >
                          {(dragProv, snapshot) => (
                            <Grid
                              size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
                              key={folder.id}
                              ref={dragProv.innerRef}
                              {...dragProv.draggableProps}
                            >
                              <Box sx={{ height: "100%" }}>
                                <Droppable
                                  droppableId={`drop-folder-${folder.id}`}
                                  type="DOCUMENT"
                                  isDropDisabled={!canEdit}
                                >
                                  {(dropProv, dropSnap) => (
                                    <Box
                                      ref={dropProv.innerRef}
                                      {...dropProv.droppableProps}
                                      {...dragProv.dragHandleProps}
                                      sx={{
                                        height: "100%",
                                        opacity: snapshot.isDragging ? 0.8 : 1,
                                      }}
                                    >
                                      <FolderCard
                                        folder={{
                                          ...folder,
                                          projectId: projectId!,
                                        }}
                                        onRename={(id, name) =>
                                          setRenameFolderData({ id, name })
                                        }
                                        onDelete={(id) => setDeleteFolderId(id)}
                                        onShare={(id) =>
                                          setShareFolderData({
                                            id,
                                            name: folder.name,
                                          })
                                        }
                                        onDropFiles={handleFilesDrop}
                                        canEdit={canEdit}
                                        canDelete={canDelete}
                                        canManage={canManage}
                                        isSelected={selectedFolderIds.includes(
                                          folder.id,
                                        )}
                                        onSelect={toggleFolderSelect}
                                        selectionMode={
                                          selectedFolderIds.length > 0 ||
                                          selectedDocIds.length > 0
                                        }
                                        isDropTarget={dropSnap.isDraggingOver}
                                      />
                                      <Box sx={{ display: "none" }}>
                                        {dropProv.placeholder}
                                      </Box>
                                    </Box>
                                  )}
                                </Droppable>
                              </Box>
                            </Grid>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </Grid>
                  ) : isTablet ? (
                    <Box>
                      {sortedFolders.map((folder: any) => (
                        <FolderMobileCard
                          key={folder.id}
                          folder={{ ...folder, projectId: projectId! }}
                          t={t}
                          navigate={navigate}
                          onRename={(id: string, name: string) =>
                            setRenameFolderData({ id, name })
                          }
                          onDelete={(id: string) => setDeleteFolderId(id)}
                          onShare={(id: string) =>
                            setShareFolderData({ id, name: folder.name })
                          }
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canManage={canManage}
                          isSelected={selectedFolderIds.includes(folder.id)}
                          onSelect={toggleFolderSelect}
                          selectionMode={
                            selectedFolderIds.length > 0 ||
                            selectedDocIds.length > 0
                          }
                        />
                      ))}
                    </Box>
                  ) : (
                    <TableContainer
                      component={Paper}
                      variant="outlined"
                      sx={{ overflowX: "auto", borderRadius: 2 }}
                    >
                      <Table
                        size="small"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        <TableHead sx={{ bgcolor: "action.hover" }}>
                          <TableRow>
                            <TableCell
                              padding="checkbox"
                              sx={{ width: 44, pl: 1.5 }}
                            >
                              <Checkbox
                                size="small"
                                checked={
                                  sortedFolders.length > 0 &&
                                  selectedFolderIds.length ===
                                    sortedFolders.length
                                }
                                indeterminate={
                                  selectedFolderIds.length > 0 &&
                                  selectedFolderIds.length <
                                    sortedFolders.length
                                }
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>,
                                ) => selectAllFolders(e.target.checked)}
                              />
                            </TableCell>
                            {showFmCol("name") && (
                              <TableCell sx={{ pl: 0.5 }}>
                                <b>{t("name")}</b>
                              </TableCell>
                            )}
                            {!isMobile && showFmCol("type") && (
                              <TableCell>
                                <b>{t("type")}</b>
                              </TableCell>
                            )}
                            {!isMobile && showFmCol("date") && (
                              <TableCell>
                                <b>{t("date")}</b>
                              </TableCell>
                            )}
                            {!isMobile && showFmCol("version") && (
                              <TableCell>
                                <b>{t("version")}</b>
                              </TableCell>
                            )}
                            {showFmCol("actions") && (
                              <TableCell align="right" sx={{ pr: 1.5 }}>
                                <b>{t("actions")}</b>
                              </TableCell>
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedFolders.map((folder: any, index: number) => (
                            <Draggable
                              key={folder.id}
                              draggableId={folder.id}
                              index={index}
                              isDragDisabled={!canEdit && sortBy !== "manual"}
                            >
                              {(dragProv, snapshot) => (
                                <Droppable
                                  droppableId={`drop-folder-${folder.id}`}
                                  type="DOCUMENT"
                                  isDropDisabled={!canEdit}
                                >
                                  {(dropProv, dropSnap) => (
                                    <React.Fragment key={folder.id}>
                                      <FolderRow
                                        ref={(node) => {
                                          dragProv.innerRef(node);
                                          dropProv.innerRef(node as any);
                                        }}
                                        folder={{
                                          ...folder,
                                          projectId: projectId!,
                                        }}
                                        canEdit={canEdit}
                                        canDelete={canDelete}
                                        canManage={canManage}
                                        onRename={(id, name) =>
                                          setRenameFolderData({ id, name })
                                        }
                                        onDelete={(id) => setDeleteFolderId(id)}
                                        onShare={(id) =>
                                          setShareFolderData({
                                            id,
                                            name: folder.name,
                                          })
                                        }
                                        onDropFiles={handleFilesDrop}
                                        isSelected={selectedFolderIds.includes(
                                          folder.id,
                                        )}
                                        onSelect={toggleFolderSelect}
                                        selectionMode={
                                          selectedFolderIds.length > 0 ||
                                          selectedDocIds.length > 0
                                        }
                                        isDropTarget={dropSnap.isDraggingOver}
                                        isDragging={snapshot.isDragging}
                                        dragProps={dropProv.droppableProps}
                                        dragHandleProps={{
                                          ...dragProv.draggableProps,
                                          ...dragProv.dragHandleProps,
                                        }}
                                        showCol={showFmCol}
                                      />
                                      {dropProv.placeholder}
                                    </React.Fragment>
                                  )}
                                </Droppable>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )
                }
              </Droppable>
            </Box>
          )}

          {/* Documents Section */}
          {sortedDocs.length > 0 && (
            <Box mb={4}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1, display: "block" }}
              >
                {t("documents")} ({sortedDocs.length})
              </Typography>
              <Droppable
                droppableId="documents"
                type="DOCUMENT"
                direction={viewMode === "grid" ? "horizontal" : "vertical"}
              >
                {(provided) =>
                  viewMode === "grid" ? (
                    <Grid
                      container
                      spacing={isMobile ? 1.5 : 2}
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {sortedDocs.map((doc: any, index: number) => (
                        <Draggable
                          key={doc.id}
                          draggableId={doc.id}
                          index={index}
                          isDragDisabled={!canEdit && sortBy !== "manual"}
                        >
                          {(dragProv, snapshot) => (
                            <Grid
                              size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
                              key={doc.id}
                              ref={dragProv.innerRef}
                              {...dragProv.draggableProps}
                            >
                              <Box
                                sx={{
                                  height: "100%",
                                  opacity: snapshot.isDragging ? 0.8 : 1,
                                }}
                                {...dragProv.dragHandleProps}
                              >
                                <DocumentCard
                                  document={doc}
                                  projectId={projectId}
                                  onDelete={
                                    canDelete
                                      ? (id) => deleteDocument.mutate(id)
                                      : undefined
                                  }
                                  onReplace={
                                    canEdit
                                      ? (id) => setReplaceDocId(id)
                                      : undefined
                                  }
                                  onShare={(id, name) =>
                                    setShareDocData({ id, name })
                                  }
                                  canDownload={canDownload}
                                  canDelete={canDelete}
                                  canEdit={canEdit}
                                  canManage={canManage}
                                  isSelected={selectedDocIds.includes(doc.id)}
                                  onSelect={toggleDocSelect}
                                  selectionMode={
                                    selectedFolderIds.length > 0 ||
                                    selectedDocIds.length > 0
                                  }
                                  onShowVersions={(id, name) =>
                                    setVersionsDocData({ id, name })
                                  }
                                />
                              </Box>
                            </Grid>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </Grid>
                  ) : isTablet ? (
                    <Box>
                      {sortedDocs.map((doc: any) => (
                        <DocumentMobileCard
                          key={doc.id}
                          doc={doc}
                          t={t}
                          navigate={navigate}
                          projectId={projectId}
                          onReplace={(id: string) => setReplaceDocId(id)}
                          onDelete={(id: string) => deleteDocument.mutate(id)}
                          onShare={(id: string, name: string) =>
                            setShareDocData({ id, name })
                          }
                          onVersions={(id: string, name: string) =>
                            setVersionsDocData({ id, name })
                          }
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canManage={canManage}
                          canDownload={canDownload}
                          isSelected={selectedDocIds.includes(doc.id)}
                          onSelect={toggleDocSelect}
                          selectionMode={
                            selectedFolderIds.length > 0 ||
                            selectedDocIds.length > 0
                          }
                        />
                      ))}
                    </Box>
                  ) : (
                    <TableContainer
                      component={Paper}
                      variant="outlined"
                      sx={{ overflowX: "auto", borderRadius: 2 }}
                    >
                      <Table
                        size="small"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        <TableHead sx={{ bgcolor: "action.hover" }}>
                          <TableRow>
                            <TableCell padding="checkbox" sx={{ width: 48 }}>
                              <Checkbox
                                size="small"
                                checked={
                                  sortedDocs.length > 0 &&
                                  selectedDocIds.length === sortedDocs.length
                                }
                                indeterminate={
                                  selectedDocIds.length > 0 &&
                                  selectedDocIds.length < sortedDocs.length
                                }
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>,
                                ) => selectAllDocs(e.target.checked)}
                              />
                            </TableCell>
                            {showFmCol("name") && (
                              <TableCell>
                                <b>{t("name")}</b>
                              </TableCell>
                            )}
                            {!isMobile && showFmCol("type") && (
                              <TableCell>
                                <b>{t("type")}</b>
                              </TableCell>
                            )}
                            {!isMobile && showFmCol("date") && (
                              <TableCell>
                                <b>{t("date")}</b>
                              </TableCell>
                            )}
                            {!isMobile && showFmCol("version") && (
                              <TableCell>
                                <b>{t("version")}</b>
                              </TableCell>
                            )}
                            {showFmCol("actions") && (
                              <TableCell align="right">
                                <b>{t("actions")}</b>
                              </TableCell>
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedDocs.map((doc: any, index: number) => (
                            <Draggable
                              key={doc.id}
                              draggableId={doc.id}
                              index={index}
                              isDragDisabled={!canEdit && sortBy !== "manual"}
                            >
                              {(dragProv, snapshot) => (
                                <DocumentRow
                                  ref={dragProv.innerRef}
                                  document={doc}
                                  projectId={projectId}
                                  onDelete={
                                    canDelete
                                      ? (id) => deleteDocument.mutate(id)
                                      : undefined
                                  }
                                  onReplace={
                                    canEdit
                                      ? (id) => setReplaceDocId(id)
                                      : undefined
                                  }
                                  onShare={(id, name) =>
                                    setShareDocData({ id, name })
                                  }
                                  canDownload={canDownload}
                                  canDelete={canDelete}
                                  canEdit={canEdit}
                                  canManage={canManage}
                                  isSelected={selectedDocIds.includes(doc.id)}
                                  onSelect={toggleDocSelect}
                                  selectionMode={
                                    selectedFolderIds.length > 0 ||
                                    selectedDocIds.length > 0
                                  }
                                  isDragging={snapshot.isDragging}
                                  dragProps={dragProv.draggableProps}
                                  dragHandleProps={dragProv.dragHandleProps}
                                  showCol={showFmCol}
                                  onShowVersions={(id, name) =>
                                    setVersionsDocData({ id, name })
                                  }
                                />
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )
                }
              </Droppable>
            </Box>
          )}

          {docPagination && docPagination.totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={2} mb={2}>
              <Pagination
                count={docPagination.totalPages}
                page={docPage}
                onChange={(_, p) => setDocPage(p)}
                color="primary"
                size={isMobile ? "small" : "medium"}
              />
            </Box>
          )}

          {sortedFolders.length === 0 && sortedDocs.length === 0 && (
            <Box
              textAlign="center"
              py={8}
              bgcolor="background.paper"
              borderRadius={2}
            >
              <Typography variant="body1" color="text.secondary">
                {searchQuery
                  ? t("noSearchResults")
                  : contents && "noAccess" in contents && contents.noAccess
                    ? t("noAccess")
                    : t("emptyFolder")}
              </Typography>
            </Box>
          )}
        </DragDropContext>
      )}

      <BulkActionsToolbar
        selectedCount={selectedFolderIds.length + selectedDocIds.length}
        onClear={() => {
          setSelectedFolderIds([]);
          setSelectedDocIds([]);
        }}
        actions={[
          ...(canDownload
            ? [
                {
                  label: t("downloadLatest", "Download Latest"),
                  icon: <FileDownloadIcon />,
                  onClick: () => handleBulkDownload(true),
                },
              ]
            : []),
          ...(canDownload
            ? [
                {
                  label: t("downloadAllVersions", "Download All Versions"),
                  icon: <FileDownloadIcon />,
                  onClick: () => handleBulkDownload(false),
                },
              ]
            : []),
          ...(canDelete
            ? [
                {
                  label: t("delete"),
                  icon: <DeleteIcon />,
                  color: "error" as const,
                  onClick: () => setConfirmBulkDelete(true),
                },
              ]
            : []),
          ...(canEdit
            ? [
                {
                  label: t("move", "Move"),
                  icon: <DriveFileMoveIcon />,
                  onClick: () => setShowMoveDialog(true),
                },
              ]
            : []),
        ]}
      />

      <CreateFolderDialog
        open={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onSubmit={(name) => {
          createFolder.mutate(
            {
              name,
              projectId: projectId!,
              parentId: activeFolderId || undefined,
            },
            {
              onSuccess: () => {
                setShowCreateFolder(false);
                toast.success(
                  t("folderCreated", "Folder created successfully"),
                );
              },
              onError: (err: any) =>
                toast.error(err.message || t("errorCreateFolder")),
            },
          );
        }}
      />
      {/* Direct file input — no dialog */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0 && activeFolderId) {
            handleFilesDrop(activeFolderId, e.target.files);
            toast.success(t("uploadStarted", "Upload started"));
          }
          e.target.value = ""; // reset so same file can be re-selected
        }}
      />
      <ReplaceDocumentDialog
        open={!!replaceDocId}
        onClose={() => setReplaceDocId(null)}
        onReplace={(file) =>
          replaceDocId &&
          replaceDocument.mutate(
            { documentId: replaceDocId, file },
            { onSuccess: () => setReplaceDocId(null) },
          )
        }
        isReplacing={replaceDocument.isPending}
      />
      <RenameDialog
        open={!!renameFolderData}
        onClose={() => setRenameFolderData(null)}
        title={t("renameFolder")}
        initialValue={renameFolderData?.name || ""}
        onSubmit={(newName) => {
          renameFolderData &&
            updateFolder.mutate(
              { id: renameFolderData.id, name: newName },
              {
                onSuccess: () => {
                  setRenameFolderData(null);
                  toast.success(
                    t("folderRenamed", "Folder renamed successfully"),
                  );
                },
                onError: (err: any) =>
                  toast.error(err.message || t("errorRenameFolder")),
              },
            );
        }}
      />
      <ConfirmDialog
        open={!!deleteFolderId}
        onClose={() => setDeleteFolderId(null)}
        title={t("deleteFolder")}
        message={t("confirmDeleteMessage")}
        onConfirm={() => {
          deleteFolderId &&
            deleteFolder.mutate(deleteFolderId, {
              onSuccess: () => {
                setDeleteFolderId(null);
                toast.success(
                  t("folderDeleted", "Folder deleted successfully"),
                );
              },
              onError: (err: any) =>
                toast.error(err.message || t("errorDeleteFolder")),
            });
        }}
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        title={t("confirmDelete")}
        message={t("confirmDeleteMessage")}
        onConfirm={handleBulkDelete}
      />

      {showMoveDialog && projectId && (
        <MoveToFolderDialog
          open={showMoveDialog}
          onClose={() => setShowMoveDialog(false)}
          projectId={projectId}
          onSelect={handleBulkMove}
          excludeIds={selectedFolderIds}
        />
      )}

      {shareFolderData && (
        <ShareDialog
          open={!!shareFolderData}
          onClose={() => setShareFolderData(null)}
          title={shareFolderData.name}
          existingPermissions={folderSharing.permissions}
          onAddUser={(userId, permissions) =>
            folderSharing.addUserPermission({ userId, permissions })
          }
          onUpdatePermission={(userId, permissions) =>
            folderSharing.updatePermission({ userId, permissions })
          }
          onRemovePermission={(userId) =>
            folderSharing.removePermission(userId)
          }
        />
      )}

      {shareDocData && (
        <ShareDialog
          open={!!shareDocData}
          onClose={() => setShareDocData(null)}
          title={shareDocData.name}
          existingPermissions={docSharing.permissions}
          onAddUser={(userId, permissions) =>
            docSharing.addUserPermission({ userId, permissions })
          }
          onUpdatePermission={(userId, permissions) =>
            docSharing.updatePermission({ userId, permissions })
          }
          onRemovePermission={(userId) => docSharing.removePermission(userId)}
        />
      )}

      {versionsDocData && (
        <DocumentVersionsDialog
          open={!!versionsDocData}
          onClose={() => setVersionsDocData(null)}
          documentId={versionsDocData.id}
          documentName={versionsDocData.name}
          canDownload={canDownload}
          onSelectVersion={(vid) =>
            navigate(`/projects/${projectId}/documents/${vid}`)
          }
        />
      )}
    </Box>
  );
}

function flattenTree(nodes: any[]): any[] {
  const result: any[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) result.push(...flattenTree(node.children));
  }
  return result;
}
