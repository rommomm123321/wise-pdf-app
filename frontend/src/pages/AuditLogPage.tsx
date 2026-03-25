import { useState, useEffect } from "react";
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
  Avatar,
  Chip,
  CircularProgress,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Button,
  useMediaQuery,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import dayjs, { Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";
import { useAuditLogs } from "../hooks/useAuditLogs";
import { useUsers } from "../hooks/useUsers";
import { useProjects } from "../hooks/useProjects";
import ColumnVisibilityMenu from "../components/common/ColumnVisibilityMenu";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { MOBILE_BREAKPOINT_PX } from "../constants";

const AUDIT_COLUMNS = [
  { id: "date", label: "Date & Time" },
  { id: "user", label: "User" },
  { id: "action", label: "Action" },
  { id: "details", label: "Context Details" },
];

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "UPLOAD",
  "DOWNLOAD",
  "MARKUP_CREATE",
  "MARKUP_UPDATE",
  "MARKUP_DELETE",
  "ROLE_CHANGE",
  "ASSIGN",
  "UNASSIGN",
  "INVITE",
  "PERMISSION_CHANGE",
];

// Comprehensive color map for actions
const actionColors: Record<string, any> = {
  CREATE: { color: "success", label: "Create" },
  UPDATE: { color: "info", label: "Update" },
  DELETE: { color: "error", label: "Delete" },
  UPLOAD: { color: "warning", label: "Upload" },
  DOWNLOAD: { color: "secondary", label: "Download" },
  MARKUP_CREATE: { color: "success", label: "Markup+" },
  MARKUP_UPDATE: { color: "info", label: "Markup~" },
  MARKUP_DELETE: { color: "error", label: "Markup-" },
  ROLE_CHANGE: { color: "primary", label: "Role" },
  ASSIGN: { color: "success", label: "Assign" },
  UNASSIGN: { color: "warning", label: "Unassign" },
  INVITE: { color: "primary", label: "Invite" },
  PERMISSION_CHANGE: { color: "warning", label: "Perms" },
};

const AuditLogCard = ({
  log,
  showCol,
  t,
}: {
  log: any;
  showCol: (id: string) => boolean;
  t: any;
}) => {
  const cfg = actionColors[log.action] || {
    color: "default",
    label: log.action,
  };
  const initials = (log.user?.name || log.user?.email || "")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        mb={1.5}
      >
        <Chip
          label={log.action}
          size="small"
          color={cfg.color}
          variant="filled"
          sx={{
            fontSize: "0.7rem",
            fontWeight: 700,
            height: 24,
            borderRadius: 1,
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {dayjs(log.createdAt).format("DD MMM YYYY, HH:mm")}
        </Typography>
      </Box>

      {showCol("user") && (
        <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: "0.8rem",
              bgcolor: "primary.main",
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {log.user?.name || t("noName", "No Name")}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: "block" }}
            >
              {log.user?.email}
            </Typography>
          </Box>
        </Box>
      )}

      {showCol("details") && (
        <Box sx={{ bgcolor: "action.hover", p: 1, borderRadius: 1, mt: 1 }}>
          <Typography
            variant="caption"
            sx={{
              wordBreak: "break-all",
              fontFamily: "monospace",
              fontSize: "0.7rem",
              opacity: 0.8,
            }}
          >
            {JSON.stringify(log.details)}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default function AuditLogPage() {
  const { t } = useTranslation();
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT_PX})`);
  const [page, setPage] = useState(1);
  const limit = 25;

  const { preferences, updatePreferences } = useUserPreferences();
  const [visibleCols, setVisibleCols] = useState<string[]>([]);

  useEffect(() => {
    if (preferences && preferences.columnVisibility?.audit) {
      setVisibleCols(preferences.columnVisibility.audit);
    } else {
      setVisibleCols(AUDIT_COLUMNS.map((c) => c.id));
    }
  }, [preferences]);

  const handleColsChange = (newCols: string[]) => {
    setVisibleCols(newCols);
    updatePreferences({
      columnVisibility: {
        ...(preferences.columnVisibility || {}),
        audit: newCols,
      },
    });
  };

  const showCol = (id: string) => visibleCols.includes(id);

  // Filters state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);

  // Data sources for filters
  const usersQuery = useUsers(1, 1000);
  const usersList = usersQuery.data?.users || [];
  const projectsQuery = useProjects(1, 200);
  const projectsList = projectsQuery.data?.projects || [];

  const { data, isLoading } = useAuditLogs({
    userId: selectedUserId || undefined,
    action: selectedAction === "ALL" ? undefined : selectedAction,
    projectId: selectedProjectId === "ALL" ? undefined : selectedProjectId,
    startDate: startDate?.startOf("day").toISOString(),
    endDate: endDate?.endOf("day").toISOString(),
    limit,
    offset: (page - 1) * limit,
  });

  const logs = data?.data || [];
  const total = data?.total || 0;
  const pageCount = Math.ceil(total / limit);

  const handleClearAll = () => {
    setSelectedUserId(null);
    setSelectedAction("ALL");
    setSelectedProjectId("ALL");
    setStartDate(null);
    setEndDate(null);
    setPage(1);
  };

  const selectedUser =
    usersList.find((u: any) => u.id === selectedUserId) || null;
  const hasActiveFilters =
    !!selectedUserId ||
    selectedAction !== "ALL" ||
    selectedProjectId !== "ALL" ||
    !!startDate ||
    !!endDate;

  return (
    <Box sx={{ px: { xs: 1, sm: 1, md: 1 }, py: { xs: 1, sm: 1 } }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5" fontWeight={700}>
          {t("auditLogTitle", "Audit Logs")}
        </Typography>
        {hasActiveFilters && (
          <Button
            startIcon={<FilterListOffIcon />}
            onClick={handleClearAll}
            variant="outlined"
            size="small"
            color="error"
            sx={{ borderRadius: 2 }}
          >
            {t("clearFilters", "Reset Filters")}
          </Button>
        )}
      </Box>

      <Paper
        sx={{ p: { xs: 2, md: 2.5 }, mb: 3, borderRadius: 2 }}
        variant="outlined"
      >
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          {/* User filter */}
          <Box sx={{ flex: { xs: "1 1 100%", md: "1 1 250px" }, minWidth: 0 }}>
            <Autocomplete
              fullWidth
              options={usersList}
              value={selectedUser}
              getOptionLabel={(option: any) =>
                `${option.name || "User"} (${option.email})`
              }
              isOptionEqualToValue={(option: any, value: any) =>
                option.id === value?.id
              }
              renderOption={(props, option: any) => {
                const initials = (option.name || option.email || "")
                  .split(" ")
                  .map((w: string) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <Box
                    component="li"
                    {...props}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      py: 1,
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        fontSize: "0.75rem",
                        bgcolor: "primary.main",
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {option.name || "No Name"}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ display: "block" }}
                      >
                        {option.email}
                      </Typography>
                    </Box>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("filterByUser", "Filter by User")}
                  size="small"
                  placeholder={t(
                    "searchByUserPlaceholder",
                    "Start typing name...",
                  )}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        {selectedUser ? (
                          <Avatar
                            sx={{
                              width: 24,
                              height: 24,
                              fontSize: "0.6rem",
                              bgcolor: "primary.main",
                              mr: 0.5,
                            }}
                          >
                            {(selectedUser.name || selectedUser.email || "")
                              .split(" ")
                              .map((w: string) => w[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </Avatar>
                        ) : null}
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
              onChange={(_, value: any) => {
                setSelectedUserId(value?.id || null);
                setPage(1);
              }}
              loading={usersQuery.isLoading}
              noOptionsText={t("noUsersFound", "No users found")}
              slotProps={{
                paper: { sx: { borderRadius: 2, mt: 0.5 } },
                listbox: { sx: { maxHeight: 280 } },
              }}
            />
          </Box>

          {/* Action filter */}
          <Box
            sx={{
              flex: {
                xs: "1 1 100%",
                sm: "1 1 calc(50% - 8px)",
                md: "1 1 200px",
              },
              minWidth: 200,
            }}
          >
            <FormControl fullWidth size="small">
              <InputLabel>{t("filterByAction", "Action Type")}</InputLabel>
              <Select
                value={selectedAction}
                label={t("filterByAction", "Action Type")}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="ALL">
                  {t("allActions", "All Actions")}
                </MenuItem>
                {ACTIONS.map((a) => (
                  <MenuItem key={a} value={a}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: `${actionColors[a]?.color}.main`,
                        }}
                      />
                      {a}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Project filter */}
          <Box sx={{ flex: { xs: "1 1 100%", md: "1 1 250px" }, minWidth: 0 }}>
            <Autocomplete
              options={[
                { id: "ALL", name: t("allProjects", "All Projects") },
                ...projectsList,
              ]}
              getOptionLabel={(option: any) => option.name || ""}
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              value={
                selectedProjectId === "ALL"
                  ? { id: "ALL", name: t("allProjects", "All Projects") }
                  : projectsList.find(
                      (p: any) => p.id === selectedProjectId,
                    ) || { id: "ALL", name: t("allProjects", "All Projects") }
              }
              onChange={(_, newValue) => {
                setSelectedProjectId(newValue?.id || "ALL");
                setPage(1);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("filterByProject", "Project")}
                  size="small"
                />
              )}
            />
          </Box>

          {/* Date From */}
          <Box
            sx={{
              flex: { xs: "1 1 calc(50% - 8px)", md: "1 1 180px" },
              minWidth: 150,
            }}
          >
            <DatePicker
              label={t("dateFrom", "Date From")}
              value={startDate}
              onChange={(val) => {
                setStartDate(val);
                setPage(1);
              }}
              slotProps={{
                textField: { size: "small", fullWidth: true },
                popper: {
                  disablePortal: false,
                  modifiers: [
                    {
                      name: "preventOverflow",
                      options: { boundary: "window" },
                    },
                  ],
                },
              }}
            />
          </Box>

          {/* Date To */}
          <Box
            sx={{
              flex: { xs: "1 1 calc(50% - 8px)", md: "1 1 180px" },
              minWidth: 150,
            }}
          >
            <DatePicker
              label={t("dateTo", "Date To")}
              value={endDate}
              onChange={(val) => {
                setEndDate(val);
                setPage(1);
              }}
              slotProps={{ textField: { size: "small", fullWidth: true } }}
            />
          </Box>
          {!isMobile && (
            <Box display="flex" alignItems="center">
              <ColumnVisibilityMenu
                columns={AUDIT_COLUMNS.map((c) => ({
                  key: c.id,
                  label: t(c.id),
                }))}
                visible={visibleCols}
                onChange={handleColsChange}
              />
            </Box>
          )}
        </Box>
      </Paper>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={10}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {isMobile ? (
            <Box>
              {logs.map((log: any) => (
                <AuditLogCard key={log.id} log={log} showCol={showCol} t={t} />
              ))}
              {logs.length === 0 && (
                <Paper
                  variant="outlined"
                  sx={{ py: 8, textAlign: "center", borderRadius: 2 }}
                >
                  <Typography variant="body1" color="text.disabled">
                    {t(
                      "noLogsFound",
                      "No activity logs match your search criteria.",
                    )}
                  </Typography>
                </Paper>
              )}
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: 2, overflow: "hidden", width: "100%" }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {showCol("date") && (
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          bgcolor: "action.hover",
                          py: 1.5,
                          pl: 2,
                        }}
                      >
                        {t("date")}
                      </TableCell>
                    )}
                    {showCol("user") && (
                      <TableCell
                        sx={{ fontWeight: 700, bgcolor: "action.hover" }}
                      >
                        {t("user")}
                      </TableCell>
                    )}
                    {showCol("action") && (
                      <TableCell
                        sx={{ fontWeight: 700, bgcolor: "action.hover" }}
                      >
                        {t("action")}
                      </TableCell>
                    )}
                    {showCol("details") && (
                      <TableCell
                        sx={{ fontWeight: 700, bgcolor: "action.hover", pr: 2 }}
                      >
                        {t("details")}
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log: any) => {
                    const cfg = actionColors[log.action] || {
                      color: "default",
                      label: log.action,
                    };
                    return (
                      <TableRow key={log.id} hover>
                        {showCol("date") && (
                          <TableCell
                            sx={{
                              whiteSpace: "nowrap",
                              fontSize: "0.8rem",
                              pl: 2,
                            }}
                          >
                            {dayjs(log.createdAt).format(
                              "DD MMM YYYY, HH:mm:ss",
                            )}
                          </TableCell>
                        )}
                        {showCol("user") && (
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1.5}>
                              <Avatar
                                sx={{
                                  width: 28,
                                  height: 28,
                                  fontSize: "0.75rem",
                                  bgcolor: "primary.main",
                                }}
                              >
                                {log.user?.name?.[0] ||
                                  log.user?.email[0].toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                  sx={{ lineHeight: 1.2 }}
                                >
                                  {log.user?.name ||
                                    log.user?.email.split("@")[0]}
                                </Typography>
                                <Box
                                  display="flex"
                                  gap={0.5}
                                  alignItems="center"
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ fontSize: "0.7rem" }}
                                  >
                                    {log.user?.email}
                                  </Typography>
                                  {log.user?.company && (
                                    <Chip
                                      label={log.user.company.name}
                                      size="small"
                                      variant="outlined"
                                      sx={{ height: 14, fontSize: "0.5rem" }}
                                    />
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          </TableCell>
                        )}
                        {showCol("action") && (
                          <TableCell>
                            <Chip
                              label={log.action}
                              size="small"
                              color={cfg.color}
                              variant="filled"
                              sx={{
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                height: 20,
                                borderRadius: 1,
                              }}
                            />
                          </TableCell>
                        )}
                        {showCol("details") && (
                          <TableCell sx={{ pr: 2 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                wordBreak: "break-all",
                                opacity: 0.9,
                                fontFamily: "monospace",
                                bgcolor: "action.hover",
                                px: 1,
                                py: 0.2,
                                borderRadius: 0.5,
                                fontSize: "0.7rem",
                              }}
                            >
                              {JSON.stringify(log.details)}
                            </Typography>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                        <Typography variant="body1" color="text.disabled">
                          {t(
                            "noLogsFound",
                            "No activity logs match your search criteria.",
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box display="flex" justifyContent="center" mt={4} pb={5}>
            <Pagination
              count={pageCount}
              page={page}
              onChange={(_, p) => setPage(p)}
              color="primary"
              size="large"
            />
          </Box>
        </>
      )}
    </Box>
  );
}
