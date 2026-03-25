import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  IconButton,
  Menu,
  MenuItem,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Pagination,
  useTheme,
  useMediaQuery,
  InputAdornment,
  Grid,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ShareIcon from "@mui/icons-material/Share";
import SearchIcon from "@mui/icons-material/Search";
import BusinessIcon from "@mui/icons-material/Business";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useBulkDeleteProjects,
} from "../hooks/useProjects";
import { useAuth } from "../contexts/AuthContext";
import { useCompany, useAllCompanies } from "../hooks/useCompany";
import { useItemPermissions } from "../hooks/useSharing";
import dayjs from "dayjs";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import ColumnVisibilityMenu, {
  type Column,
} from "../components/common/ColumnVisibilityMenu";
import RenameDialog from "../components/filemanager/RenameDialog";
import ConfirmDialog from "../components/filemanager/ConfirmDialog";
import ShareDialog from "../components/filemanager/ShareDialog";
import BulkActionsToolbar from "../components/layout/BulkActionsToolbar";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import { MOBILE_BREAKPOINT_PX } from "../constants";

function ProjectMobileCard({ project, t, navigate, onMenuOpen, isAdmin }: any) {
  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1.5,
        borderRadius: 2,
        position: "relative",
        overflow: "visible",
      }}
    >
      <CardActionArea onClick={() => navigate(`/projects/${project.id}`)}>
        <CardContent sx={{ p: 2 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            mb={1}
          >
            <Box
              display="flex"
              alignItems="center"
              gap={1.5}
              sx={{ minWidth: 0, flex: 1, pr: isAdmin ? 4 : 0 }}
            >
              <FolderIcon
                color="primary"
                sx={{ fontSize: 24, flexShrink: 0 }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body1" fontWeight={700} noWrap>
                  {project.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: "block" }}
                >
                  {project.company?.name || t("noCompany")} •{" "}
                  {dayjs(project.createdAt).format("DD MMM YYYY")}
                </Typography>
              </Box>
            </Box>
          </Box>

          {project.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                mb: 1.5,
                lineHeight: 1.4,
              }}
            >
              {project.description}
            </Typography>
          )}

          <Box display="flex" flexWrap="wrap" gap={1}>
            <Chip
              icon={<BusinessIcon sx={{ fontSize: "0.8rem !important" }} />}
              label={project.company?.name || t("noCompany")}
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.65rem" }}
            />
            {project.manager && (
              <Chip
                icon={
                  <ManageAccountsIcon sx={{ fontSize: "0.8rem !important" }} />
                }
                label={project.manager.name}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: "0.65rem" }}
              />
            )}
          </Box>
        </CardContent>
      </CardActionArea>
      {(isAdmin || project.permissions?.canManage) && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onMenuOpen(e, project);
          }}
          sx={{ position: "absolute", top: 12, right: 8, zIndex: 1 }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      )}
    </Card>
  );
}

const PROJECTS_COLUMNS: Column[] = [
  { key: "name", label: "Name", required: true },
  { key: "description", label: "Description" },
  { key: "company", label: "Company" },
  { key: "actions", label: "Actions" },
];

export type SortOption = "manual" | "name" | "date";

export default function ProjectsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT_PX})`);

  const isGeneralAdmin = user?.systemRole === "GENERAL_ADMIN";

  const [projectPage, setProjectPage] = useState(1);
  const [filterCompanyId, setFilterCompanyId] = useState<"ALL" | string>("ALL");
  const { data: projectsData, isLoading: projectsLoading } = useProjects(
    projectPage,
    20,
    filterCompanyId,
  );
  const projects = projectsData?.projects ?? [];
  const projectsPagination = projectsData?.pagination;
  const { data: company } = useCompany();
  const { data: allCompanies = [] } = useAllCompanies();

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Dialog states
  const [openProjectDialog, setOpenProjectDialog] = useState(false);

  // Validation & Form states
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectCompanyId, setProjectCompanyId] = useState("");

  // Project Actions state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showRenameProject, setShowRenameProject] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [showShareProject, setShowShareProject] = useState(false);

  // Sharing Hook
  const {
    permissions: projectPerms,
    addUserPermission,
    updatePermission,
    removePermission,
  } = useItemPermissions("project", selectedProject?.id);

  // View mode & Filters
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () =>
      (localStorage.getItem("projects-view-mode") as "grid" | "list") || "grid",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>(
    () => (localStorage.getItem("projects-sort-by") as SortOption) || "manual",
  );

  const {
    preferences,
    updatePreferences,
    isLoading: isPrefsLoading,
  } = useUserPreferences();
  const [projectsColsLoaded, setProjectsColsLoaded] = useState(false);
  const [projectsCols, setProjectsCols] = useState<string[]>(
    PROJECTS_COLUMNS.map((c) => c.key),
  );

  useEffect(() => {
    if (!isPrefsLoading && !projectsColsLoaded) {
      const allKeys = PROJECTS_COLUMNS.map((c) => c.key);
      const stored = preferences?.columnVisibility?.projects;
      if (stored) {
        const requiredKeys = PROJECTS_COLUMNS.filter((c) => c.required).map(
          (c) => c.key,
        );
        const missingRequired = requiredKeys.filter(
          (k: string) => !stored.includes(k),
        );
        const valid = stored.filter((k: string) => allKeys.includes(k));
        setProjectsCols([...valid, ...missingRequired]);
      } else {
        const oldStored = localStorage.getItem("projects-visible-cols");
        if (oldStored) {
          try {
            const parsed = JSON.parse(oldStored) as string[];
            const requiredKeys = PROJECTS_COLUMNS.filter((c) => c.required).map(
              (c) => c.key,
            );
            const missingRequired = requiredKeys.filter(
              (k: string) => !parsed.includes(k),
            );
            const valid = parsed.filter((k: string) => allKeys.includes(k));
            const migrated = [...valid, ...missingRequired];
            setProjectsCols(migrated);
            updatePreferences({
              columnVisibility: {
                ...(preferences?.columnVisibility || {}),
                projects: migrated,
              },
            });
          } catch (e) {}
        }
      }
      setProjectsColsLoaded(true);
    }
  }, [
    preferences?.columnVisibility?.projects,
    isPrefsLoading,
    projectsColsLoaded,
    updatePreferences,
    preferences,
  ]);

  const handleProjectsColsChange = (cols: string[]) => {
    setProjectsCols(cols);
    updatePreferences({
      columnVisibility: {
        ...(preferences?.columnVisibility || {}),
        projects: cols,
      },
    });
  };
  const showProjectCol = (key: string) => projectsCols.includes(key);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const bulkDeleteProjects = useBulkDeleteProjects();
  const isProjectAdmin = user?.role?.name === "Admin";
  const isAdmin = isGeneralAdmin || isProjectAdmin;

  const displayRole = useMemo(() => {
    if (isGeneralAdmin) return "General Admin";
    if (isProjectAdmin) return "Admin";
    return user?.role?.name || "User";
  }, [isGeneralAdmin, isProjectAdmin, user?.role?.name]);

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    project: any,
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedProject(project);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCreateProject = () => {
    if (!projectName.trim()) {
      setProjectError(t("errorNameRequired"));
      return;
    }
    const finalCompanyId = isGeneralAdmin ? projectCompanyId : user?.companyId;
    if (!finalCompanyId) {
      setProjectError("Company ID is required");
      return;
    }
    createProject.mutate(
      {
        name: projectName,
        description: projectDesc,
        companyId: finalCompanyId,
      },
      {
        onSuccess: () => {
          setOpenProjectDialog(false);
          setProjectName("");
          setProjectDesc("");
          setProjectCompanyId("");
        },
      },
    );
  };

  const processedProjects = useMemo(() => {
    let result = [...projects];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q),
      );
    }
    if (sortBy === "manual" && preferences.projectOrder) {
      const orderMap = new Map(
        preferences.projectOrder.map((id: string, index: number) => [
          id,
          index,
        ]),
      );
      result.sort(
        (a, b) =>
          Number(orderMap.get(a.id) ?? -1) - Number(orderMap.get(b.id) ?? -1),
      );
    } else if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "date") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return { all: result };
  }, [projects, searchQuery, sortBy, preferences.projectOrder]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || sortBy !== "manual") return;
    const items = Array.from(processedProjects.all);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    updatePreferences({ projectOrder: items.map((i) => i.id) });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleBulkDelete = () => {
    bulkDeleteProjects.mutate(selectedIds, {
      onSuccess: () => {
        setSelectedIds([]);
        setConfirmBulkDelete(false);
      },
    });
  };

  const selectionMode = selectedIds.length > 0;

  return (
    <Box sx={{ px: { xs: 1, sm: 1, md: 1 }, py: { xs: 1, sm: 1 } }}>
      {/* Header Layout */}
      <Box
        display="flex"
        flexDirection={isTablet ? "column" : "row"}
        justifyContent="space-between"
        alignItems={isTablet ? "flex-start" : "center"}
        mb={4}
        gap={3}
      >
        <Box
          display="flex"
          alignItems="center"
          gap={isMobile ? 1.5 : 2}
          sx={{ width: "100%" }}
        >
          {!isMobile && (
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: "primary.main",
                boxShadow: 3,
              }}
            >
              <FolderIcon fontSize="large" />
            </Avatar>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {!isAdmin && isMobile ? (
              // Special Mobile Header for Non-Admins: Firm > Projects > Info
              <>
                <Typography
                  variant="h5"
                  fontWeight={800}
                  sx={{ letterSpacing: -0.5, mb: 0.5, color: "primary.main" }}
                >
                  {company?.name || t("yourFirm", "Your Firm")}
                </Typography>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    {t("projects")}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    |
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {processedProjects.all.length} {t("items", "items")}
                  </Typography>
                </Box>
              </>
            ) : (
              // Default Header
              <Box
                display="flex"
                flexDirection={isMobile ? "column" : "row"}
                alignItems={isMobile ? "flex-start" : "baseline"}
                gap={isMobile ? 0.5 : 1.5}
              >
                <Typography
                  variant={isMobile ? "h5" : "h4"}
                  fontWeight={800}
                  sx={{ letterSpacing: -0.5, whiteSpace: "nowrap" }}
                >
                  {t("projects")}
                </Typography>
                {!isGeneralAdmin && company && (
                  <Chip
                    icon={<BusinessIcon sx={{ fontSize: "1rem !important" }} />}
                    label={company.name}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{
                      fontWeight: 600,
                      ml: { xs: 0, sm: 1 },
                      height: 24,
                      alignSelf: "center",
                    }}
                  />
                )}
              </Box>
            )}

            <Box
              display="flex"
              alignItems="center"
              gap={1}
              mt={isMobile ? 0.5 : 0}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  maxWidth: isMobile ? 200 : "none",
                  wordBreak: "break-all",
                }}
              >
                {user?.email}
              </Typography>
              <Chip
                label={displayRole}
                size="small"
                sx={{
                  height: 18,
                  fontSize: "0.65rem",
                  bgcolor: "secondary.main",
                  color: "#fff",
                  fontWeight: 600,
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Spacer removed */}
      </Box>

      {/* Toolbar Section */}
      <Box
        display="flex"
        flexDirection={isMobile ? "column" : "row"}
        justifyContent="space-between"
        alignItems={isMobile ? "stretch" : "center"}
        mb={3}
        gap={2}
      >
        <Box
          display="flex"
          flexWrap="wrap"
          alignItems="center"
          gap={1.5}
          sx={{ flex: 1 }}
        >
          {isGeneralAdmin && (
            <FormControl
              size="small"
              sx={{ minWidth: isMobile ? "100%" : 180 }}
            >
              <InputLabel>{t("filterByCompany", "Company")}</InputLabel>
              <Select
                value={filterCompanyId}
                label={t("filterByCompany", "Company")}
                onChange={(e) => {
                  setFilterCompanyId(e.target.value);
                  setProjectPage(1);
                }}
              >
                <MenuItem value="ALL">
                  {t("allCompanies", "All Companies")}
                </MenuItem>
                {allCompanies.map((c: any) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            size="small"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1, minWidth: isMobile ? "100%" : 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <FormControl
            size="small"
            sx={{
              minWidth: 140,
              flexGrow: isMobile ? 1 : 0,
              width: isMobile ? "100%" : "auto",
            }}
          >
            <InputLabel>{t("sortBy")}</InputLabel>
            <Select
              value={sortBy}
              label={t("sortBy")}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption);
                localStorage.setItem(
                  "projects-sort-by",
                  e.target.value as string,
                );
              }}
            >
              <MenuItem value="manual">{t("sortManual")}</MenuItem>
              <MenuItem value="name">{t("sortByName")}</MenuItem>
              <MenuItem value="date">{t("sortByDate")}</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box
          display="flex"
          alignItems="center"
          gap={1}
          justifyContent={isMobile ? "flex-end" : "flex-end"}
          sx={{ width: isMobile ? "100%" : "auto", mt: isMobile ? 1 : 0 }}
        >
          {!isTablet && (
            <ToggleButtonGroup
              size="small"
              value={viewMode}
              exclusive
              onChange={(_, v) => {
                if (v) {
                  setViewMode(v);
                  localStorage.setItem("projects-view-mode", v);
                }
              }}
            >
              <ToggleButton value="grid">
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          {!isTablet && viewMode === "list" && (
            <ColumnVisibilityMenu
              columns={PROJECTS_COLUMNS.map((c) => ({ ...c, label: t(c.key) }))}
              visible={projectsCols}
              onChange={handleProjectsColsChange}
            />
          )}
          {(company || isGeneralAdmin) && isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenProjectDialog(true)}
              size={isMobile ? "small" : "medium"}
              sx={{ fontWeight: 600, flexGrow: isMobile ? 1 : 0 }}
            >
              {isMobile ? t("Create") : t("createProjectBtn")}
            </Button>
          )}
        </Box>
      </Box>

      {projectsLoading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : viewMode === "grid" ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable
            droppableId="projects-grid"
            direction={isMobile ? "vertical" : "horizontal"}
          >
            {(provided) => (
              <Grid
                container
                spacing={isMobile ? 1.5 : 2}
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {processedProjects.all.map((p: any, index: number) => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <Draggable
                      key={p.id}
                      draggableId={p.id}
                      index={index}
                      isDragDisabled={sortBy !== "manual" || selectionMode}
                    >
                      {(dragProv, snapshot) => (
                        <Grid
                          size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
                          ref={dragProv.innerRef}
                          {...dragProv.draggableProps}
                        >
                          <Box sx={{ width: "100%", p: 0.5 }}>
                            <Card
                              {...dragProv.dragHandleProps}
                              sx={{
                                height: "100%",
                                position: "relative",
                                transition: "all 0.2s",
                                border: isSelected ? "2px solid" : "1px solid",
                                borderColor: isSelected
                                  ? "primary.main"
                                  : "divider",
                                cursor: selectionMode
                                  ? "pointer"
                                  : sortBy === "manual"
                                    ? "grab"
                                    : "pointer",
                                opacity: snapshot.isDragging ? 0.8 : 1,
                                "&:hover": {
                                  boxShadow: 4,
                                  transform: "translateY(-2px)",
                                },
                              }}
                            >
                              {(selectionMode || isSelected) && (
                                <Checkbox
                                  size="small"
                                  checked={isSelected}
                                  sx={{
                                    position: "absolute",
                                    top: 4,
                                    left: 4,
                                    zIndex: 11,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelect(p.id);
                                  }}
                                />
                              )}
                              <CardActionArea
                                onClick={() =>
                                  selectionMode
                                    ? toggleSelect(p.id)
                                    : navigate(`/projects/${p.id}`)
                                }
                                sx={{ height: "100%" }}
                              >
                                <CardContent
                                  sx={{
                                    p: isMobile ? 2 : 3,
                                    pl:
                                      selectionMode || isSelected
                                        ? 5
                                        : isMobile
                                          ? 2
                                          : 3,
                                  }}
                                >
                                  <Box
                                    display="flex"
                                    alignItems="center"
                                    gap={1}
                                    mb={1}
                                  >
                                    <FolderIcon
                                      color="primary"
                                      sx={{ fontSize: isMobile ? 20 : 24 }}
                                    />
                                    <Typography
                                      variant={isMobile ? "body1" : "h6"}
                                      fontWeight={700}
                                      noWrap
                                    >
                                      {p.name}
                                    </Typography>
                                  </Box>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                      height: "3em",
                                      fontSize: isMobile
                                        ? "0.75rem"
                                        : "0.875rem",
                                    }}
                                  >
                                    {p.description || t("noDescription")}
                                  </Typography>
                                </CardContent>
                              </CardActionArea>
                              {!selectionMode &&
                                (isAdmin || p.permissions?.canManage) && (
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMenuOpen(e, p);
                                    }}
                                    sx={{
                                      position: "absolute",
                                      right: 4,
                                      top: 8,
                                      zIndex: 10,
                                    }}
                                  >
                                    <MoreVertIcon fontSize="small" />
                                  </IconButton>
                                )}
                            </Card>
                          </Box>
                        </Grid>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </Grid>
            )}
          </Droppable>
        </DragDropContext>
      ) : isTablet ? (
        <Box>
          {processedProjects.all.length === 0 ? (
            <Box
              sx={{
                py: 6,
                textAlign: "center",
                bgcolor: "action.hover",
                borderRadius: 2,
              }}
            >
              <Typography color="text.secondary">
                {t("noProjectsFound")}
              </Typography>
            </Box>
          ) : (
            processedProjects.all.map((p: any) => (
              <ProjectMobileCard
                key={p.id}
                project={p}
                t={t}
                navigate={navigate}
                onMenuOpen={handleMenuOpen}
                isAdmin={isAdmin}
              />
            ))
          )}
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ overflowX: "auto", width: "100%", borderRadius: 2 }}
        >
          <Table size={isMobile ? "small" : "medium"}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ pl: 2 }}>
                  <Checkbox
                    size="small"
                    indeterminate={
                      selectedIds.length > 0 &&
                      selectedIds.length < processedProjects.all.length
                    }
                    checked={
                      processedProjects.all.length > 0 &&
                      selectedIds.length === processedProjects.all.length
                    }
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked
                          ? processedProjects.all.map((p) => p.id)
                          : [],
                      )
                    }
                  />
                </TableCell>
                {showProjectCol("name") && (
                  <TableCell sx={{ fontWeight: 700 }}>{t("name")}</TableCell>
                )}
                {!isMobile && showProjectCol("description") && (
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t("description")}
                  </TableCell>
                )}
                {!isMobile && showProjectCol("company") && (
                  <TableCell sx={{ fontWeight: 700 }}>{t("company")}</TableCell>
                )}
                {showProjectCol("actions") && (
                  <TableCell align="right" sx={{ fontWeight: 700, pr: 2 }}>
                    {t("actions")}
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {processedProjects.all.map((p: any) => (
                <TableRow
                  key={p.id}
                  hover
                  selected={selectedIds.includes(p.id)}
                  sx={{ cursor: "pointer" }}
                  onClick={() =>
                    selectedIds.length > 0
                      ? toggleSelect(p.id)
                      : navigate(`/projects/${p.id}`)
                  }
                >
                  <TableCell
                    padding="checkbox"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      size="small"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => toggleSelect(p.id)}
                    />
                  </TableCell>
                  {showProjectCol("name") && (
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <FolderIcon color="primary" fontSize="small" />
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          noWrap
                          sx={{ maxWidth: isMobile ? 120 : 250 }}
                        >
                          {p.name}
                        </Typography>
                      </Box>
                    </TableCell>
                  )}
                  {!isMobile && showProjectCol("description") && (
                    <TableCell>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        noWrap
                        sx={{ maxWidth: 300 }}
                      >
                        {p.description || "-"}
                      </Typography>
                    </TableCell>
                  )}
                  {!isMobile && showProjectCol("company") && (
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {p.company?.name || "-"}
                      </Typography>
                    </TableCell>
                  )}
                  {showProjectCol("actions") && (
                    <TableCell
                      align="right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(isAdmin || p.permissions?.canManage) && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, p)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {projectsPagination && projectsPagination.totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4} mb={2}>
          <Pagination
            count={projectsPagination.totalPages}
            page={projectPage}
            onChange={(_, p) => setProjectPage(p)}
            color="primary"
            size={isMobile ? "small" : "medium"}
          />
        </Box>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {(isAdmin || selectedProject?.permissions?.canEdit) && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              setShowRenameProject(true);
            }}
          >
            <EditIcon fontSize="small" sx={{ mr: 1 }} /> {t("rename")}
          </MenuItem>
        )}
        {(isAdmin || selectedProject?.permissions?.canManage) && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              setShowShareProject(true);
            }}
          >
            <ShareIcon fontSize="small" sx={{ mr: 1 }} /> {t("share")}
          </MenuItem>
        )}
        {(isAdmin || selectedProject?.permissions?.canDelete) && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              setShowDeleteProject(true);
            }}
            sx={{ color: "error.main" }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> {t("delete")}
          </MenuItem>
        )}
      </Menu>

      <RenameDialog
        open={showRenameProject}
        onClose={() => setShowRenameProject(false)}
        title={t("renameProject")}
        initialValue={selectedProject?.name || ""}
        onSubmit={(newName) => {
          updateProject.mutate({ id: selectedProject.id, name: newName });
          setShowRenameProject(false);
        }}
      />
      <ConfirmDialog
        open={showDeleteProject}
        onClose={() => setShowDeleteProject(false)}
        title={t("deleteProject")}
        message={t("deleteProjectConfirm")}
        onConfirm={() => {
          deleteProject.mutate(selectedProject.id);
          setShowDeleteProject(false);
        }}
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        title={t("confirmDelete")}
        message={t("deleteProjectConfirm")}
        onConfirm={handleBulkDelete}
      />
      {selectedProject && (
        <ShareDialog
          open={showShareProject}
          onClose={() => setShowShareProject(false)}
          title={selectedProject.name}
          existingPermissions={projectPerms}
          onAddUser={(userId, perms) =>
            addUserPermission({ userId, permissions: perms })
          }
          onUpdatePermission={(userId, perms) =>
            updatePermission({ userId, permissions: perms })
          }
          onRemovePermission={(userId) => removePermission(userId)}
        />
      )}

      <Dialog
        open={openProjectDialog}
        onClose={() => setOpenProjectDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("dialogCreateProjectTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t("nameLabel")}
            fullWidth
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              setProjectError(null);
            }}
            sx={{ mb: 2 }}
            error={!!projectError}
            helperText={projectError}
            required
          />
          <TextField
            margin="dense"
            label={t("descLabel")}
            fullWidth
            multiline
            rows={3}
            value={projectDesc}
            onChange={(e) => setProjectDesc(e.target.value)}
            sx={{ mb: 2 }}
          />
          {isGeneralAdmin && (
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel>Company</InputLabel>
              <Select
                value={projectCompanyId}
                label="Company"
                onChange={(e) => setProjectCompanyId(e.target.value)}
              >
                {allCompanies.map((c: any) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenProjectDialog(false)} color="inherit">
            {t("cancelBtn")}
          </Button>
          <Button
            onClick={handleCreateProject}
            variant="contained"
            sx={{ px: 3 }}
          >
            {t("submitBtn")}
          </Button>
        </DialogActions>
      </Dialog>

      <BulkActionsToolbar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            label: t("delete"),
            icon: <DeleteIcon />,
            color: "error",
            onClick: () => setConfirmBulkDelete(true),
          },
        ]}
      />
    </Box>
  );
}
