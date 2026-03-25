import { useState, useMemo, useEffect } from 'react';
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
  IconButton,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Pagination,
  useMediaQuery,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { 
  useUsers, 
  useBulkDeleteUsers,
} from '../hooks/useUsers';
import { useCompanyTags, useCustomRoles } from '../hooks/useCustomRoles';
import InviteDialog from '../components/users/InviteDialog';
import AddUserDialog from '../components/users/AddUserDialog';
import UserDetailDialog from '../components/users/UserDetailDialog';
import CustomRoleDialog from '../components/users/CustomRoleDialog';
import BulkActionsToolbar from '../components/layout/BulkActionsToolbar';
import ConfirmDialog from '../components/filemanager/ConfirmDialog';
import ColumnVisibilityMenu, { type Column } from '../components/common/ColumnVisibilityMenu';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { MOBILE_BREAKPOINT_PX } from '../constants';

const USERS_COLUMNS: Column[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'tags', label: 'Tags' },
  { key: 'company', label: 'Company' },
  { key: 'projects', label: 'Projects' },
  { key: 'actions', label: 'Actions' },
];

function UserCard({ user, t, onEdit }: any) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1.5, position: 'relative' }}>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Avatar sx={{ width: 44, height: 44, bgcolor: user.role?.color || 'primary.main' }}>
          {user.name?.[0] || user.email[0].toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>{user.name || t('noName')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{user.email}</Typography>
        </Box>
        <IconButton size="small" onClick={() => onEdit(user.id)} sx={{ alignSelf: 'flex-start' }}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
        {user.role && (
          <Chip label={user.role.name} size="small" sx={{ bgcolor: user.role.color, color: '#fff', fontWeight: 600, height: 22 }} />
        )}
        {(user.tags || []).map((tag: any) => (
          <Chip key={tag.id} label={tag.text} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', color: tag.color, borderColor: tag.color }} />
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">{t('company')}</Typography>
          <Typography variant="body2">{user.company?.name || '-'}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">{t('projects')}</Typography>
          <Typography variant="body2" fontWeight={600}>{user.assignedProjects?.length || 0}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [userPage, setUserPage] = useState(1);
  const { data: usersData, isLoading } = useUsers(userPage, 20);
  const users = usersData?.users ?? [];
  const usersPagination = usersData?.pagination;
  const { data: companyTags = [] } = useCompanyTags();
  const { data: companyRoles = [] } = useCustomRoles();
  
  const bulkDelete = useBulkDeleteUsers();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [customRolesOpen, setCustomRolesOpen] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const { preferences, updatePreferences, isLoading: isPrefsLoading } = useUserPreferences();
  const [colsLoaded, setColsLoaded] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>(USERS_COLUMNS.map(c => c.key));

  useEffect(() => {
    if (!isPrefsLoading && !colsLoaded) {
      const allKeys = USERS_COLUMNS.map(c => c.key);
      const stored = preferences?.columnVisibility?.users;
      if (stored) {
        const requiredKeys = USERS_COLUMNS.filter(c => c.required).map(c => c.key);
        const missingRequired = requiredKeys.filter((k: string) => !stored.includes(k));
        const valid = stored.filter((k: string) => allKeys.includes(k));
        setVisibleCols([...valid, ...missingRequired]);
      } else {
        const oldStored = localStorage.getItem('users-visible-cols');
        if (oldStored) {
          try {
            const parsed = JSON.parse(oldStored) as string[];
            const requiredKeys = USERS_COLUMNS.filter(c => c.required).map(c => c.key);
            const missingRequired = requiredKeys.filter((k: string) => !parsed.includes(k));
            const valid = parsed.filter((k: string) => allKeys.includes(k));
            const migrated = [...valid, ...missingRequired];
            setVisibleCols(migrated);
            updatePreferences({ 
              columnVisibility: { ...(preferences?.columnVisibility || {}), users: migrated } 
            });
          } catch(e) {}
        }
      }
      setColsLoaded(true);
    }
  }, [preferences?.columnVisibility?.users, isPrefsLoading, colsLoaded, updatePreferences, preferences]);

  const handleColsChange = (cols: string[]) => {
    setVisibleCols(cols);
    updatePreferences({ 
      columnVisibility: { ...(preferences?.columnVisibility || {}), users: cols } 
    });
  };
  const showCol = (key: string) => visibleCols.includes(key);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Search, filter, sort
  const [search, setSearch] = useState('');
  const [filterRoleId, setFilterRoleId] = useState<string>('ALL');
  const [filterTagId, setFilterTagId] = useState<string>('ALL');
  const [filterCompanyId, setFilterCompanyId] = useState<string>('ALL');

  const isGeneralAdmin = currentUser?.systemRole === 'GENERAL_ADMIN';
  const isAdmin = isGeneralAdmin || currentUser?.role?.name === 'Admin';

  const filteredUsers = useMemo(() => {
    let result = [...users];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u => 
        (u.name || '').toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q)
      );
    }
    if (filterRoleId !== 'ALL') {
      result = result.filter(u => u.roleId === filterRoleId);
    }
    if (filterTagId !== 'ALL') {
      result = result.filter(u => u.tags?.some((t: any) => t.id === filterTagId));
    }
    if (filterCompanyId !== 'ALL') {
      result = result.filter(u => u.companyId === filterCompanyId);
    }
    
    // Default sort: newest first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return result;
  }, [users, search, filterRoleId, filterTagId, filterCompanyId]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = () => {
    bulkDelete.mutate(selectedIds, {
      onSuccess: () => {
        setSelectedIds([]);
        setConfirmBulkDelete(false);
        toast.success(t('usersDeleted', 'Users deleted successfully'));
      },
      onError: (err: any) => toast.error(err.message || t('errorDeleteUsers')),
    });
  };

  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT_PX})`);
  const isExtraSmall = useMediaQuery('(max-width:480px)');

  if (isLoading) return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>;

  return (
    <Box sx={{ px: { xs: 1, sm: 1, md: 1 }, py: { xs: 1, sm: 1 } }}>
      <Box
        display="flex"        flexDirection={isMobile ? 'column' : 'row'} 
        justifyContent="space-between" 
        alignItems={isMobile ? 'flex-start' : 'center'} 
        gap={2}
        mb={3}
      >
        <Typography variant="h5" fontWeight={700}>{t('users')} ({filteredUsers.length})</Typography>
        <Box 
          display="flex" 
          gap={1} 
          flexWrap="wrap" 
          sx={{ width: isMobile ? '100%' : 'auto' }}
        >
          {isAdmin && (
            <>
              <Button 
                variant="outlined" 
                startIcon={<AssignmentIndIcon />} 
                onClick={() => setCustomRolesOpen(true)}
                size={isExtraSmall ? 'small' : 'medium'}
                sx={{ flexGrow: isExtraSmall ? 1 : 0 }}
              >
                {t('customRoles')}
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<PersonSearchIcon />} 
                onClick={() => setAddUserOpen(true)}
                size={isExtraSmall ? 'small' : 'medium'}
                sx={{ flexGrow: isExtraSmall ? 1 : 0 }}
              >
                {t('addExistingUser')}
              </Button>
              <Button 
                variant="contained" 
                startIcon={<PersonAddIcon />} 
                onClick={() => setInviteOpen(true)}
                size={isExtraSmall ? 'small' : 'medium'}
                sx={{ flexGrow: isExtraSmall ? 1 : 0, width: isExtraSmall ? '100%' : 'auto' }}
              >
                {t('inviteUser')}
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Box 
        display="flex" 
        flexDirection="row" 
        flexWrap="wrap"
        alignItems="center" 
        justifyContent="space-between"
        gap={1.5}
        mb={3}
        sx={{ width: '100%' }}
      >
        {/* Group 1: Filters */}
        <Box 
          display="flex" 
          flexDirection={isExtraSmall ? 'column' : 'row'} 
          alignItems={isExtraSmall ? 'stretch' : 'center'} 
          gap={1.5} 
          sx={{ 
            flexGrow: 1, 
            minWidth: { xs: '100%', sm: 400, md: 'auto' },
            flexBasis: { xs: '100%', sm: 'auto' }
          }}
        >
          <TextField
            size="small"
            placeholder={t('searchUsers')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          
          <Box display="flex" gap={1} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>
            <FormControl size="small" sx={{ minWidth: 140, flex: 1 }}>
              <InputLabel>{t('filterByRole')}</InputLabel>
              <Select value={filterRoleId} label={t('filterByRole')} onChange={(e) => setFilterRoleId(e.target.value)}>
                <MenuItem value="ALL">{t('allRoles')}</MenuItem>
                {companyRoles.map((r: any) => (
                  <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
              <InputLabel>{t('tags')}</InputLabel>
              <Select value={filterTagId} label={t('tags')} onChange={(e) => setFilterTagId(e.target.value)}>
                <MenuItem value="ALL">{t('allTags')}</MenuItem>
                {companyTags.map((tag: any) => (
                  <MenuItem key={tag.id} value={tag.id}>{tag.text}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Group 2: Company Filter & Visibility */}
        <Box 
          display="flex" 
          alignItems="center" 
          gap={1.5}
        >
          {isGeneralAdmin && (
            <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
              <InputLabel>{t('filterByCompany', 'Company')}</InputLabel>
              <Select 
                value={filterCompanyId} 
                label={t('filterByCompany', 'Company')} 
                onChange={(e) => setFilterCompanyId(e.target.value)}
              >
                <MenuItem value="ALL">{t('allCompanies')}</MenuItem>
                {Array.from(new Map(users.filter((u: any) => u.company).map((u: any) => [u.company.id, u.company])).values()).map((company: any) => (
                  <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {!isMobile && (
            <ColumnVisibilityMenu 
              columns={USERS_COLUMNS.map(c => ({ ...c, label: t(c.key) }))} 
              visible={visibleCols} 
              onChange={handleColsChange} 
            />
          )}
        </Box>
      </Box>

      {isMobile ? (
        <Box>
          {filteredUsers.map((u: any) => (
            <UserCard 
              key={u.id} 
              user={u} 
              t={t} 
              showCol={showCol} 
              onEdit={setDetailUserId} 
            />
          ))}
          {filteredUsers.length === 0 && (
            <Box py={5} textAlign="center" color="text.secondary">
              <Typography>{t('noUsersFound', 'No users found')}</Typography>
            </Box>
          )}
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto', width: '100%' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ pl: 2 }}>
                  <Checkbox size="small"
                    indeterminate={selectedIds.length > 0 && selectedIds.length < filteredUsers.length}
                    checked={filteredUsers.length > 0 && selectedIds.length === filteredUsers.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? filteredUsers.map(u => u.id) : [])}
                  />
                </TableCell>
                {showCol('name') && <TableCell sx={{ fontWeight: 700 }}>{t('name')}</TableCell>}
                {showCol('email') && <TableCell sx={{ fontWeight: 700 }}>{t('email')}</TableCell>}
                {showCol('role') && <TableCell sx={{ fontWeight: 700 }}>{t('role')}</TableCell>}
                {showCol('tags') && <TableCell sx={{ fontWeight: 700 }}>{t('tags')}</TableCell>}
                {showCol('company') && <TableCell sx={{ fontWeight: 700 }}>{t('company')}</TableCell>}
                {showCol('projects') && <TableCell sx={{ fontWeight: 700 }}>{t('projects')}</TableCell>}
                {showCol('actions') && <TableCell align="right" sx={{ fontWeight: 700, pr: 2 }}>{t('actions')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((u: any) => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <TableRow key={u.id} hover selected={isSelected} onClick={() => toggleSelect(u.id)} sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox size="small" checked={isSelected} onChange={() => toggleSelect(u.id)} />
                  </TableCell>
                  {showCol('name') && (
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem', bgcolor: u.role?.color || 'primary.main' }}>
                          {u.name?.[0] || u.email[0].toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600}>{u.name || t('noName', 'No Name')}</Typography>
                      </Box>
                    </TableCell>
                  )}
                  {showCol('email') && <TableCell><Typography variant="body2" color="text.secondary">{u.email}</Typography></TableCell>}
                  {showCol('role') && (
                    <TableCell>
                      {u.role ? (
                        <Chip label={u.role.name} size="small" sx={{ bgcolor: u.role.color, color: '#fff', fontWeight: 600, height: 20, fontSize: '0.7rem' }} />
                      ) : <Typography variant="caption" color="text.secondary">User</Typography>}
                    </TableCell>
                  )}
                  {showCol('tags') && (
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {(u.tags || []).map((tag: any) => (
                          <Chip key={tag.id} label={tag.text} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', color: tag.color, borderColor: tag.color }} />
                        ))}
                      </Box>
                    </TableCell>
                  )}
                  {showCol('company') && <TableCell><Typography variant="body2" color="text.secondary">{u.company?.name || '-'}</Typography></TableCell>}
                  {showCol('projects') && (
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{u.assignedProjects?.length || 0} {t('projects')}</Typography>
                    </TableCell>
                  )}
                  {showCol('actions') && (
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => setDetailUserId(u.id)}><EditIcon fontSize="small" /></IconButton>
                    </TableCell>
                  )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {usersPagination && usersPagination.totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination count={usersPagination.totalPages} page={userPage} onChange={(_, p) => setUserPage(p)} color="primary" />
        </Box>
      )}

      <BulkActionsToolbar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          { label: t('delete'), icon: <DeleteIcon />, color: 'error', onClick: () => setConfirmBulkDelete(true) }
        ]}
      />

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <AddUserDialog open={addUserOpen} onClose={() => setAddUserOpen(false)} />
      {detailUserId && <UserDetailDialog userId={detailUserId} open={!!detailUserId} onClose={() => setDetailUserId(null)} />}
      <CustomRoleDialog open={customRolesOpen} onClose={() => setCustomRolesOpen(false)} />
      <ConfirmDialog open={confirmBulkDelete} onClose={() => setConfirmBulkDelete(false)} title={t('confirmDelete')} message={t('bulkDeleteConfirm')} onConfirm={handleBulkDelete} />
    </Box>
  );
}
