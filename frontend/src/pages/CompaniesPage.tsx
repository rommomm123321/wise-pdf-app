import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Avatar,
  IconButton,
  Tooltip,
  useMediaQuery,
  InputAdornment,
  Tabs,
  Tab,
  Menu,
} from "@mui/material";
import toast from "react-hot-toast";
import BusinessIcon from "@mui/icons-material/Business";
import ApartmentIcon from "@mui/icons-material/Apartment";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import StoreIcon from "@mui/icons-material/Store";
import FactoryIcon from "@mui/icons-material/Factory";
import CorporateFareIcon from "@mui/icons-material/CorporateFare";
import DomainIcon from "@mui/icons-material/Domain";
import EngineeringIcon from "@mui/icons-material/Engineering";
import BuildIcon from "@mui/icons-material/Build";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import FoundationIcon from "@mui/icons-material/Foundation";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import ArchitectureIcon from "@mui/icons-material/Architecture";
import ScienceIcon from "@mui/icons-material/Science";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import ConstructionIcon from "@mui/icons-material/Construction";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import GavelIcon from "@mui/icons-material/Gavel";
import PublicIcon from "@mui/icons-material/Public";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";
import PeopleIcon from "@mui/icons-material/People";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import FolderIcon from "@mui/icons-material/Folder";
import DescriptionIcon from "@mui/icons-material/Description";
import SecurityIcon from "@mui/icons-material/Security";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useTranslation } from "react-i18next";
import { useCompanyStats } from "../hooks/useCompany";
import dayjs from "dayjs";
import ColumnVisibilityMenu, {
  type Column,
} from "../components/common/ColumnVisibilityMenu";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { useAuth } from "../contexts/AuthContext";
import RenameDialog from "../components/filemanager/RenameDialog";
import ConfirmDialog from "../components/filemanager/ConfirmDialog";
import { MOBILE_BREAKPOINT, MOBILE_BREAKPOINT_PX } from "../constants";

const COMPANY_ICONS = [
  BusinessIcon,
  ApartmentIcon,
  LocationCityIcon,
  StoreIcon,
  FactoryIcon,
  CorporateFareIcon,
  DomainIcon,
  EngineeringIcon,
  BuildIcon,
  AccountBalanceIcon,
  FoundationIcon,
  PrecisionManufacturingIcon,
  ArchitectureIcon,
  ScienceIcon,
  WarehouseIcon,
  ConstructionIcon,
  HomeWorkIcon,
  AccountTreeIcon,
  GavelIcon,
  PublicIcon,
];

const COMPANY_COLORS = [
  "#f44336",
  "#e91e63",
  "#9c27b0",
  "#673ab7",
  "#3f51b5",
  "#2196f3",
  "#03a9f4",
  "#00bcd4",
  "#009688",
  "#4caf50",
  "#8bc34a",
  "#cddc39",
  "#ffeb3b",
  "#ffc107",
  "#ff9800",
  "#ff5722",
  "#795548",
  "#9e9e9e",
  "#607d8b",
];

const getCompanyVisuals = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash);
  return {
    Icon: COMPANY_ICONS[index % COMPANY_ICONS.length],
    color: COMPANY_COLORS[index % COMPANY_COLORS.length],
  };
};

const COMPANIES_COLUMNS: Column[] = [
  { key: "companyName", label: "Company Name", required: true },
  { key: "createdAt", label: "Created At" },
  { key: "users", label: "Users" },
  { key: "projects", label: "Projects" },
  { key: "folders", label: "Folders" },
  { key: "documents", label: "Documents" },
  { key: "customRoles", label: "Custom Roles" },
  { key: "tags", label: "Tags" },
];

interface CompanyCardProps {
  company: any;
  t: any;
  visibleCols: string[];
}

function CompanyCard({ company, t, visibleCols }: CompanyCardProps) {
  const { Icon, color } = getCompanyVisuals(company.id);
  const show = (key: string) => visibleCols.includes(key);

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
        position: "relative",
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar
            sx={{
              bgcolor: color,
              width: 48,
              height: 48,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <Icon />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" fontWeight={700} noWrap>
              {company.name}
            </Typography>
            {show("createdAt") && (
              <Typography variant="caption" color="text.secondary">
                {company.isArchived
                  ? `${t("deletedAt", "Deleted At")}: ${dayjs(company.updatedAt).format("DD MMM YYYY")}`
                  : `${t("createdAt")}: ${dayjs(company.createdAt).format("DD MMM YYYY")}`}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 2,
          }}
        >
          {show("users") && (
            <Box display="flex" alignItems="center" gap={1}>
              <PeopleIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {company.stats.users}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("users")}
                </Typography>
              </Box>
            </Box>
          )}
          {show("projects") && (
            <Box display="flex" alignItems="center" gap={1}>
              <FolderSpecialIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {company.stats.projects}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("projects")}
                </Typography>
              </Box>
            </Box>
          )}
          {show("folders") && (
            <Box display="flex" alignItems="center" gap={1}>
              <FolderIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {company.stats.folders}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("folders")}
                </Typography>
              </Box>
            </Box>
          )}
          {show("documents") && (
            <Box display="flex" alignItems="center" gap={1}>
              <DescriptionIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {company.stats.documents}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("documents")}
                </Typography>
              </Box>
            </Box>
          )}
          {show("customRoles") && (
            <Box display="flex" alignItems="center" gap={1}>
              <SecurityIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {company.stats.roles}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("customRoles")}
                </Typography>
              </Box>
            </Box>
          )}
          {show("tags") && (
            <Box display="flex" alignItems="center" gap={1}>
              <LocalOfferIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {company.stats.tags}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("tags")}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function CompanyMobileCard({
  company,
  t,
  visibleCols,
  onRename,
  onDelete,
  isAdmin,
}: any) {
  const { Icon, color } = getCompanyVisuals(company.id);
  const show = (key: string) => visibleCols.includes(key);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        mb={1.5}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar
            sx={{ bgcolor: color, width: 32, height: 32, fontSize: "1rem" }}
          >
            <Icon fontSize="small" />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body1" fontWeight={700} noWrap>
              {company.name}
            </Typography>
            {show("createdAt") && (
              <Typography variant="caption" color="text.secondary">
                {company.isArchived
                  ? `${t("deletedAt", "Deleted At")}: ${dayjs(company.updatedAt).format("DD MMM")}`
                  : `${t("createdAt")}: ${dayjs(company.createdAt).format("DD MMM YYYY")}`}
              </Typography>
            )}
          </Box>
        </Box>
        {isAdmin && (
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Box display="flex" flexWrap="wrap" gap={1}>
        {show("users") && (
          <Chip
            icon={<PeopleIcon sx={{ fontSize: "0.8rem !important" }} />}
            label={`${company.stats.users} ${t("users")}`}
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: "0.65rem" }}
          />
        )}
        {show("projects") && (
          <Chip
            icon={<FolderSpecialIcon sx={{ fontSize: "0.8rem !important" }} />}
            label={`${company.stats.projects} ${t("projects")}`}
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: "0.65rem" }}
          />
        )}
        {show("documents") && (
          <Chip
            icon={<DescriptionIcon sx={{ fontSize: "0.8rem !important" }} />}
            label={`${company.stats.documents} ${t("docs", "Docs")}`}
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: "0.65rem" }}
          />
        )}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onRename(company);
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1.5 }} />
          {t("rename")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onDelete(company);
          }}
          sx={{ color: "error.main" }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
          {t("delete")}
        </MenuItem>
      </Menu>
    </Paper>
  );
}

export default function CompaniesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT_PX})`);
  const isExtraSmall = useMediaQuery("(max-width:480px)");
  const { data: companies = [], isLoading } = useCompanyStats();

  const { preferences, updatePreferences } = useUserPreferences();
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  type ViewMode = "grid" | "list";
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("companies-view-mode") as ViewMode;
    if (saved) return saved;
    return window.innerWidth < MOBILE_BREAKPOINT ? "grid" : "list";
  });
  const { user } = useAuth();
  const isAdmin = user?.systemRole === "GENERAL_ADMIN";
  const [tab, setTab] = useState(0);

  // Create Company state
  const [openCompanyDialog, setOpenCompanyDialog] = useState(false);

  // Rename / Delete state
  const [renameCompany, setRenameCompany] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const requiredKeys = COMPANIES_COLUMNS.filter((c) => c.required).map(
      (c) => c.key,
    );
    if (preferences && preferences.columnVisibility?.companies) {
      const saved = preferences.columnVisibility.companies;
      // Ensure required columns are always present
      const combined = Array.from(new Set([...requiredKeys, ...saved]));
      setVisibleCols(combined);
    } else {
      setVisibleCols(COMPANIES_COLUMNS.map((c) => c.key));
    }
  }, [preferences]);

  const handleColsChange = (newCols: string[]) => {
    const requiredKeys = COMPANIES_COLUMNS.filter((c) => c.required).map(
      (c) => c.key,
    );
    const finalCols = Array.from(new Set([...requiredKeys, ...newCols]));
    setVisibleCols(finalCols);
    updatePreferences({
      columnVisibility: {
        ...(preferences.columnVisibility || {}),
        companies: finalCols,
      },
    });
  };

  const showCol = (id: string) => visibleCols.includes(id);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["company-stats"] });
    queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    queryClient.invalidateQueries({ queryKey: ["all-companies"] });
  };

  const createCompanyMut = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/api/companies", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      setOpenCompanyDialog(false);
      invalidateAll();
      toast.success(t("companyCreated", "Company created successfully"));
    },
    onError: (err: any) => toast.error(err.message || t("errorCreateCompany")),
  });

  const renameCompanyMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch(`/api/companies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      setRenameCompany(null);
      invalidateAll();
      toast.success(t("companyRenamed", "Company renamed successfully"));
    },
    onError: (err: any) => toast.error(err.message || t("errorRenameCompany")),
  });

  const deleteCompanyMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteCompany(null);
      invalidateAll();
      toast.success(t("companyArchived", "Company archived successfully"));
    },
    onError: (err: any) => toast.error(err.message || t("errorArchiveCompany")),
  });

  const processedCompanies = useMemo(() => {
    let result = companies.filter((c: any) =>
      tab === 0 ? !c.isArchived : c.isArchived,
    );
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c: any) => c.name.toLowerCase().includes(q));
    }
    result.sort((a: any, b: any) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "date")
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      if (sortBy === "users") return b.stats.users - a.stats.users;
      if (sortBy === "projects") return b.stats.projects - a.stats.projects;
      return 0;
    });
    return result;
  }, [companies, searchQuery, sortBy, tab]);

  if (isLoading)
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ px: { xs: 1, sm: 1, md: 1 }, py: { xs: 1, sm: 1 } }}>
      <Box
        display="flex"
        flexWrap="wrap"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
        gap={2}
      >
        <Typography
          variant={isExtraSmall ? "h6" : "h5"}
          fontWeight={800}
          sx={{ letterSpacing: -0.5 }}
        >
          {t("companiesStats", "Companies")}
          <Typography
            component="span"
            color="text.secondary"
            fontWeight={500}
            sx={{ ml: 1, fontSize: "0.9em" }}
          >
            ({processedCompanies.length})
          </Typography>
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tab} onChange={(_, newTab) => setTab(newTab)}>
          <Tab label={t("active", "Active")} />
          <Tab label={t("archive", "Archive")} />
        </Tabs>
      </Box>

      {/* Toolbar */}
      <Box display="flex" flexDirection="column" gap={1.5} mb={3}>
        <Box
          display="flex"
          flexDirection="row"
          flexWrap="wrap"
          alignItems="center"
          justifyContent="space-between"
          gap={1.5}
          sx={{ width: "100%" }}
        >
          {/* Group 1: Filters (Search & Sort) */}
          <Box
            display="flex"
            flexDirection={isExtraSmall ? "column" : "row"}
            alignItems={isExtraSmall ? "stretch" : "center"}
            gap={1.5}
            sx={{
              flexGrow: 1,
              minWidth: { xs: "100%", sm: 400, md: "auto" },
              flexBasis: { xs: "100%", sm: "auto" },
            }}
          >
            <TextField
              size="small"
              placeholder={t("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 200 }}
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
              sx={{ minWidth: 140, width: isExtraSmall ? "100%" : "auto" }}
            >
              <InputLabel>{t("sortBy")}</InputLabel>
              <Select
                value={sortBy}
                label={t("sortBy")}
                onChange={(e) => setSortBy(e.target.value as string)}
              >
                <MenuItem value="name">{t("sortByName")}</MenuItem>
                <MenuItem value="date">{t("sortByDate")}</MenuItem>
                <MenuItem value="users">{t("users")}</MenuItem>
                <MenuItem value="projects">{t("projects")}</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Group 2: Actions & View Controls */}
          <Box
            display="flex"
            alignItems="center"
            justifyContent="flex-end"
            gap={1}
            sx={{
              flexGrow: { xs: 1, sm: 0 },
              width: { xs: "100%", sm: "auto" },
              flexWrap: "nowrap",
              minWidth: 0,
            }}
          >
            {!isMobile && (
              <Box
                display="flex"
                alignItems="center"
                gap={1}
                sx={{ flexShrink: 0 }}
              >
                <ToggleButtonGroup
                  size="small"
                  value={viewMode}
                  exclusive
                  onChange={(_, v) => {
                    if (v) {
                      setViewMode(v);
                      localStorage.setItem("companies-view-mode", v);
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
                {viewMode === "list" && (
                  <ColumnVisibilityMenu
                    columns={COMPANIES_COLUMNS.map((c) => ({
                      ...c,
                      label: t(c.key),
                    }))}
                    visible={visibleCols}
                    onChange={handleColsChange}
                  />
                )}
              </Box>
            )}

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenCompanyDialog(true)}
              size={isExtraSmall ? "small" : "medium"}
              sx={{
                fontWeight: 600,
                flexGrow: isExtraSmall ? 1 : 0,
                whiteSpace: "nowrap",
              }}
            >
              {t("createCompanyBtn")}
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: 3 }}>
        {viewMode === "grid" ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: 3,
            }}
          >
            {processedCompanies.length === 0 ? (
              <Box
                sx={{
                  gridColumn: "1/-1",
                  py: 6,
                  textAlign: "center",
                  bgcolor: "action.hover",
                  borderRadius: 2,
                }}
              >
                <Typography color="text.secondary">
                  {t("noCompaniesFound")}
                </Typography>
              </Box>
            ) : (
              processedCompanies.map((c: any) => (
                <CompanyCard
                  key={c.id}
                  company={c}
                  t={t}
                  visibleCols={visibleCols}
                />
              ))
            )}
          </Box>
        ) : isMobile ? (
          <Box>
            {processedCompanies.length === 0 ? (
              <Box
                sx={{
                  py: 6,
                  textAlign: "center",
                  bgcolor: "action.hover",
                  borderRadius: 2,
                }}
              >
                <Typography color="text.secondary">
                  {t("noCompaniesFound")}
                </Typography>
              </Box>
            ) : (
              processedCompanies.map((c: any) => (
                <CompanyMobileCard
                  key={c.id}
                  company={c}
                  t={t}
                  visibleCols={visibleCols}
                  onRename={setRenameCompany}
                  onDelete={setDeleteCompany}
                  isAdmin={isAdmin}
                />
              ))
            )}
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ borderRadius: 2, overflowX: "auto", width: "100%" }}
          >
            <Table size="small">
              <TableHead sx={{ bgcolor: "action.hover" }}>
                <TableRow>
                  {showCol("companyName") && (
                    <TableCell sx={{ pl: 2 }}>
                      <b>{t("companyName")}</b>
                    </TableCell>
                  )}
                  {!isMobile && showCol("createdAt") && (
                    <TableCell>
                      <b>
                        {tab === 0
                          ? t("createdAt")
                          : t("deletedAt", "Deleted At")}
                      </b>
                    </TableCell>
                  )}
                  {!isMobile && showCol("users") && (
                    <TableCell align="center">
                      <b>{t("users")}</b>
                    </TableCell>
                  )}
                  {!isMobile && showCol("projects") && (
                    <TableCell align="center">
                      <b>{t("projects")}</b>
                    </TableCell>
                  )}
                  {!isMobile && showCol("folders") && (
                    <TableCell align="center">
                      <b>{t("folders")}</b>
                    </TableCell>
                  )}
                  {!isMobile && showCol("documents") && (
                    <TableCell align="center">
                      <b>{t("documents")}</b>
                    </TableCell>
                  )}
                  {!isMobile && showCol("customRoles") && (
                    <TableCell align="center">
                      <b>{t("customRoles")}</b>
                    </TableCell>
                  )}
                  {!isMobile && showCol("tags") && (
                    <TableCell align="center">
                      <b>{t("tags")}</b>
                    </TableCell>
                  )}
                  <TableCell align="right" sx={{ pr: 2 }}>
                    <b>{t("actions")}</b>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {processedCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      align="center"
                      sx={{ py: 3, color: "text.secondary" }}
                    >
                      {t("noCompaniesFound")}
                    </TableCell>
                  </TableRow>
                ) : (
                  processedCompanies.map((company: any) => (
                    <TableRow key={company.id} hover>
                      {showCol("companyName") && (
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar
                              sx={{
                                bgcolor: getCompanyVisuals(company.id).color,
                                width: 32,
                                height: 32,
                              }}
                            >
                              {(() => {
                                const { Icon } = getCompanyVisuals(company.id);
                                return <Icon sx={{ fontSize: 18 }} />;
                              })()}
                            </Avatar>
                            <Typography variant="body2" fontWeight={600}>
                              {company.name}
                            </Typography>
                          </Box>
                        </TableCell>
                      )}
                      {!isMobile && showCol("createdAt") && (
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(
                              company.isArchived
                                ? company.updatedAt
                                : company.createdAt,
                            ).format("DD MMM YYYY, HH:mm")}
                          </Typography>
                        </TableCell>
                      )}
                      {!isMobile && showCol("users") && (
                        <TableCell align="center">
                          <Chip
                            label={company.stats.users}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ minWidth: 40 }}
                          />
                        </TableCell>
                      )}
                      {!isMobile && showCol("projects") && (
                        <TableCell align="center">
                          <Chip
                            label={company.stats.projects}
                            size="small"
                            sx={{ minWidth: 40 }}
                          />
                        </TableCell>
                      )}
                      {!isMobile && showCol("folders") && (
                        <TableCell align="center">
                          <Chip
                            label={company.stats.folders}
                            size="small"
                            sx={{ minWidth: 40, bgcolor: "action.selected" }}
                          />
                        </TableCell>
                      )}
                      {!isMobile && showCol("documents") && (
                        <TableCell align="center">
                          <Chip
                            label={company.stats.documents}
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ minWidth: 40 }}
                          />
                        </TableCell>
                      )}
                      {!isMobile && showCol("customRoles") && (
                        <TableCell align="center">
                          <Chip
                            label={company.stats.roles}
                            size="small"
                            sx={{
                              minWidth: 40,
                              bgcolor: "action.disabledBackground",
                            }}
                          />
                        </TableCell>
                      )}
                      {!isMobile && showCol("tags") && (
                        <TableCell align="center">
                          <Chip
                            label={company.stats.tags}
                            size="small"
                            sx={{ minWidth: 40 }}
                          />
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <Box display="flex" justifyContent="flex-end" gap={0.5}>
                          <Tooltip title={t("rename", "Rename")}>
                            <IconButton
                              size="small"
                              onClick={() =>
                                setRenameCompany({
                                  id: company.id,
                                  name: company.name,
                                })
                              }
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t("delete")}>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() =>
                                setDeleteCompany({
                                  id: company.id,
                                  name: company.name,
                                })
                              }
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Create Company Dialog */}
      <RenameDialog
        open={openCompanyDialog}
        onClose={() => setOpenCompanyDialog(false)}
        title={t("dialogCreateCompanyTitle", "Create Company")}
        placeholder={t("companyNamePlaceholder", "Enter company name...")}
        initialValue=""
        onSubmit={(name) => {
          createCompanyMut.mutate(name.trim());
        }}
      />

      {/* Rename Company Dialog */}
      <RenameDialog
        open={!!renameCompany}
        onClose={() => setRenameCompany(null)}
        title={t("rename", "Rename Company")}
        initialValue={renameCompany?.name || ""}
        onSubmit={(newName) =>
          renameCompany &&
          renameCompanyMut.mutate({ id: renameCompany.id, name: newName })
        }
      />

      {/* Delete Company Dialog */}
      <ConfirmDialog
        open={!!deleteCompany}
        onClose={() => setDeleteCompany(null)}
        title={t("deleteCompany", "Delete Company")}
        message={t(
          "confirmDeleteCompanyMessage",
          `Are you sure you want to archive "${deleteCompany?.name}"? All projects and files will be preserved but inaccessible.`,
        )}
        onConfirm={() =>
          deleteCompany && deleteCompanyMut.mutate(deleteCompany.id)
        }
      />
    </Box>
  );
}
