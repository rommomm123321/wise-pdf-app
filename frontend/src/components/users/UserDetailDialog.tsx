import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Avatar,
  Chip,
  Select,
  MenuItem,
  Divider,
  TextField,
  IconButton,
  Tooltip,
  Autocomplete,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useProjects } from '../../hooks/useProjects';
import { useAllCompanies } from '../../hooks/useCompany';
import {
  useUserProfile,
  useUpdateRole,
  useAssignProject,
  useUnassignProject,
  useUpdateProjectPermissions,
} from '../../hooks/useUsers';
import {
  useCustomRoles,
  useCompanyTags,
  useCreateCompanyTag,
  useUpdateUserTags
} from '../../hooks/useCustomRoles';
import { apiFetch } from '../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ProjectPermissionRow from './ProjectPermissionRow';
import SelectiveAccessDialog from './SelectiveAccessDialog';

interface UserDetailDialogProps {
  userId: string;
  open: boolean;
  onClose: () => void;
}

const SYSTEM_ROLES = ['GENERAL_ADMIN', 'USER'] as const;

const getScrollbarSx = (theme: any) => ({
  '&::-webkit-scrollbar': {
    width: '6px',
    height: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    borderRadius: '10px',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
  },
});

export default function UserDetailDialog({ userId, open, onClose }: UserDetailDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user: currentUser, impersonate: impersonateUser } = useAuth();
  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(userId);
  const user = userProfile;

  const { data: projectsData } = useProjects(1, 100);
  const allProjects = projectsData?.projects ?? [];
  const { data: customRoles = [] } = useCustomRoles();
  const { data: allCompaniesData } = useAllCompanies();
  const allCompanies = allCompaniesData || [];
  
  const updateRole = useUpdateRole();
  const assignProject = useAssignProject();
  const unassignProject = useUnassignProject();
  const updatePermissions = useUpdateProjectPermissions();
  const { data: companyTags = [] } = useCompanyTags();
  const createTag = useCreateCompanyTag();
  const updateUserTags = useUpdateUserTags();

  // Granular removals — mark as stale without auto-refetch to prevent list reorder
  const invalidateUserOnly = () => {
    queryClient.invalidateQueries({ queryKey: ['users'], refetchType: 'none' });
    // Refetch only the query this dialog depends on
    queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
  };

  const removeFolderPerm = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/permissions/folders/id/${id}`, { method: 'DELETE' }),
    onSuccess: invalidateUserOnly,
  });
  const removeDocPerm = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/permissions/documents/id/${id}`, { method: 'DELETE' }),
    onSuccess: invalidateUserOnly,
  });

  // Granular additions/toggles
  const setFolderPerm = useMutation({
    mutationFn: ({ folderId, permissions }: any) =>
      apiFetch(`/api/permissions/folders/${folderId}/permissions/${userId}`, { method: 'PUT', body: JSON.stringify(permissions) }),
    onSuccess: invalidateUserOnly,
  });

  const [addProjectId, setAddProjectId] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [selectiveProject, setSelectiveProject] = useState<any>(null);

  const isMobile = useMediaQuery('(max-width:600px)');
  const isGeneralAdmin = currentUser?.systemRole === 'GENERAL_ADMIN';
  const isSelf = currentUser?.id === userId;
  const canManageUser = isGeneralAdmin || (currentUser?.role?.name === 'Admin' && user?.systemRole !== 'GENERAL_ADMIN');

  if (isProfileLoading) return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>
    </Dialog>
  );

  if (!user) return null;

  const sortedAssignedProjects = [...(user.assignedProjects || [])].sort((a: any, b: any) => {
    const nameA = a.project?.name || '';
    const nameB = b.project?.name || '';
    return nameA.localeCompare(nameB);
  });

  const assignedProjectIds = sortedAssignedProjects.map((ap: any) => ap.projectId);
  const availableProjects = allProjects.filter((p: any) => p.companyId === user.companyId && !assignedProjectIds.includes(p.id));

  const handleAddProject = () => {
    if (!addProjectId) return;
    assignProject.mutate(
      {
        userId: user.id,
        projectId: addProjectId,
        permissions: { canView: true, canEdit: false, canDelete: false, canDownload: true, canMarkup: true, canManage: false, scope: 'FULL' },
      },
      {
        onSuccess: () => {
          setAddProjectId('');
          toast.success(t('projectAssigned', 'Project assigned successfully'));
        },
        onError: (err: any) => toast.error(err.message || t('errorAssignProject')),
      }
    );
  };

  const onToggleFolder = (folderId: string, currentPerm: any | null) => {
    if (currentPerm) removeFolderPerm.mutate(currentPerm.id);
    else setFolderPerm.mutate({ folderId, permissions: { canView: true, canDownload: true } });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth 
      fullScreen={isMobile}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: user.systemRole === 'GENERAL_ADMIN' ? 'error.main' : 'primary.main' }}>
            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={600}>{user.name || user.email}</Typography>
            <Typography variant="body2" color="text.secondary">{user.email}</Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: isMobile ? 2 : 3, ...getScrollbarSx(theme) }}>
        {/* Roles and Company */}
        <Box 
          display="flex" 
          flexDirection={isMobile ? 'column' : 'row'} 
          gap={isMobile ? 2 : 4} 
          mb={3} 
          mt={1}
        >
          {isGeneralAdmin && (
            <>
              <Box flex={1}>
                <Typography variant="subtitle2" gutterBottom>{t('systemRole', 'System Role')}</Typography>
                <Box display="flex" gap={1} alignItems="center">
                  <Chip label={user.systemRole === 'GENERAL_ADMIN' ? 'General Admin' : 'User'} color={user.systemRole === 'GENERAL_ADMIN' ? 'error' : 'default'} size="small" />
                  {!isSelf && (
                    <Select
                      size="small"
                      value={user.systemRole}
                      onChange={(e) => updateRole.mutate({ userId: user.id, systemRole: e.target.value as any })}
                      sx={{ ml: 1, minWidth: 140 }}
                    >
                      {SYSTEM_ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  )}
                </Box>
              </Box>
              <Box flex={1}>
                <Typography variant="subtitle2" gutterBottom>{t('company', 'Company')}</Typography>
                <Select
                  fullWidth
                  size="small"
                  value={user.companyId || ''}
                  onChange={(e) => {
                    if (e.target.value !== user.companyId) {
                      if (window.confirm(t('confirmChangeCompany', 'Changing company will remove all current project assignments and tags. Proceed?'))) {
                        updateRole.mutate({ userId: user.id, companyId: e.target.value });
                      }
                    }
                  }}
                  displayEmpty
                  disabled={isSelf}
                >
                  <MenuItem value=""><em>{t('noCompany', 'No Company')}</em></MenuItem>
                  {allCompanies.map((c: any) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </Box>
            </>
          )}
          <Box flex={1}>
            <Typography variant="subtitle2" gutterBottom>{t('companyRole', 'Role')}</Typography>
            {canManageUser ? (
              <Autocomplete
                fullWidth
                size="small"
                options={[{ id: '', name: t('noRole') }, ...customRoles]}
                getOptionLabel={(option) => option.name || ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={user.roleId ? (customRoles.find((r: any) => r.id === user.roleId) || { id: '', name: t('noRole') }) : { id: '', name: t('noRole') }}
                onChange={(_, newValue) => {
                  updateRole.mutate({ userId: user.id, roleId: newValue?.id || null });
                }}
                renderInput={(params) => <TextField {...params} placeholder={t('searchRole', 'Search Role...')} />}
                renderOption={(props, option: any) => (
                  <li {...props}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {option.id === '' ? option.name : (
                        <>
                          {option.color && <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: option.color }} />}
                          {option.name}
                          {option.isSystem && <Chip label="system" size="small" sx={{ height: 16, fontSize: '0.55rem', ml: 0.5 }} />}
                        </>
                      )}
                    </Box>
                  </li>
                )}
              />
            ) : (
              <Box display="flex" alignItems="center" gap={1}>
                {user.role?.color && <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: user.role.color }} />}
                <Typography variant="body1">{user.role?.name || t('noRole')}</Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Tags */}
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>{t('userTags')}</Typography>
          <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
            {(user.tags || []).map((tag: any) => (
              <Chip key={tag.id} label={tag.text} size="small" variant="outlined"
                onDelete={canManageUser ? () => updateUserTags.mutate({ userId: user.id, tagIds: user.tags.filter((tg:any)=>tg.id !== tag.id).map((tg:any)=>tg.id) }) : undefined}
                sx={{ color: tag.color, borderColor: tag.color }}
              />
            ))}
            {user.tags?.length === 0 && <Typography variant="body2" color="text.secondary"><em>{t('noTags', 'No tags')}</em></Typography>}
          </Box>
          {canManageUser && (
            <Box 
              display="flex" 
              flexDirection={isMobile ? 'column' : 'row'} 
              gap={1} 
              alignItems={isMobile ? 'stretch' : 'center'}
            >
              <Select
                size="small"
                displayEmpty
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const currentTagIds = (user.tags || []).map((tg: any) => tg.id);
                    updateUserTags.mutate({ userId: user.id, tagIds: [...currentTagIds, e.target.value] });
                  }
                }}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="" disabled>{t('addTag', 'Add tag...')}</MenuItem>
                {companyTags.filter((ct: any) => !(user.tags || []).some((ut: any) => ut.id === ct.id)).map((ct: any) => (
                  <MenuItem key={ct.id} value={ct.id}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: ct.color }} />
                      {ct.text}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              <TextField
                size="small"
                placeholder={t('newTag', 'New tag...')}
                value={newTagText}
                onChange={(e: any) => setNewTagText(e.target.value)}
                sx={{ minWidth: 120 }}
                onKeyDown={(e: any) => {
                  if (e.key === 'Enter' && newTagText.trim()) {
                    createTag.mutate({ text: newTagText.trim() }, {
                      onSuccess: (res: any) => {
                        const tagId = res?.data?.id;
                        if (tagId) {
                          const currentTagIds = (user.tags || []).map((tg: any) => tg.id);
                          updateUserTags.mutate({ userId: user.id, tagIds: [...currentTagIds, tagId] });
                        }
                        setNewTagText('');
                      }
                    });
                  }
                }}
              />
            </Box>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Permissions */}
        {canManageUser ? (
          <>
            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>{t('permissions')}</Typography>
              <Box 
                display="flex" 
                flexDirection={isMobile ? 'column' : 'row'} 
                gap={1}
                sx={{ width: isMobile ? '100%' : 'auto' }}
              >
                <Autocomplete
                  size="small"
                  options={availableProjects}
                  getOptionLabel={(option: any) => option.name || ''}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={availableProjects.find((p: any) => p.id === addProjectId) || null}
                  onChange={(_, newValue) => setAddProjectId(newValue?.id || '')}
                  sx={{ minWidth: isMobile ? '100%' : 180, flexGrow: 1 }}
                  renderInput={(params) => <TextField {...params} placeholder={t('assignToProject', 'Assign to project')} />}
                />
                <Button variant="contained" size="small" onClick={handleAddProject} disabled={!addProjectId}>{t('assignBtn')}</Button>
              </Box>
            </Box>

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
              {sortedAssignedProjects.map((ap: any) => {
                const projectFolders = (user.folderPermissions || []).filter((fp: any) => fp.folder?.projectId === ap.projectId);
                const projectDocs = (user.documentPermissions || []).filter((dp: any) => dp.document?.folder?.projectId === ap.projectId);

                return (
                  <Box key={ap.id}>
                    <ProjectPermissionRow
                      projectName={ap.project?.name || ap.projectId}
                      scope={ap.scope}
                      permissions={ap}
                      roleId={ap.roleId}
                      availableRoles={customRoles}
                      onPermissionChange={(key, value) => updatePermissions.mutate({ userId: user.id, projectId: ap.projectId, permissions: { [key]: value } })}
                      onRemove={() => unassignProject.mutate({ userId: user.id, projectId: ap.projectId })}
                      onEditSelective={() => setSelectiveProject({ id: ap.projectId, name: ap.project?.name })}
                      disabled={!canManageUser}
                    />
                    
                    {ap.scope === 'SELECTIVE' && (
                      <Box sx={{ pl: 4, py: 1, bgcolor: 'action.hover' }}>
                        {projectFolders.length === 0 && projectDocs.length === 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', ml: 2 }}>
                            {t('noSelectiveItems')}
                          </Typography>
                        )}
                        {projectFolders.map((fp: any) => (
                          <Box key={fp.id} display="flex" alignItems="center" gap={1} py={0.5}>
                            <FolderIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                            <Typography variant="body2" sx={{ flexGrow: 1, fontSize: '0.8rem' }}>{fp.folder?.name}</Typography>
                            {canManageUser && (
                              <Tooltip title={t('removeAccess')}>
                                <IconButton size="small" onClick={() => removeFolderPerm.mutate(fp.id)}>
                                  <DeleteIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        ))}
                        {projectDocs.map((dp: any) => (
                          <Box key={dp.id} display="flex" alignItems="center" gap={1} py={0.5}>
                            <DescriptionIcon sx={{ fontSize: 16, color: 'error.main' }} />
                            <Typography variant="body2" sx={{ flexGrow: 1, fontSize: '0.8rem' }}>{dp.document?.name}</Typography>
                            {canManageUser && (
                              <Tooltip title={t('removeAccess')}>
                                <IconButton size="small" onClick={() => removeDocPerm.mutate(dp.id)}>
                                  <DeleteIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </>
        ) : (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{t('assignedProjects', 'Assigned Projects')}</Typography>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
              {sortedAssignedProjects.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', p: 1 }}>{t('noProjectAssignments')}</Typography>
              ) : (
                sortedAssignedProjects.map((ap: any) => (
                  <Box key={ap.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, '&:not(:last-child)': { borderBottom: 1, borderColor: 'divider' } }}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <FolderSpecialIcon color="primary" sx={{ fontSize: 20 }} />
                      <Typography variant="body2" fontWeight={600}>{ap.project?.name}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      {ap.role && (
                        <Chip label={ap.role.name} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: ap.role.color, color: '#fff' }} />
                      )}
                      <Chip label={ap.scope === 'FULL' ? t('scopeFull') : t('scopeSelective')} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        {isGeneralAdmin && !isSelf && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={() => {
              onClose();
              impersonateUser(userId);
            }}
            sx={{ mr: 'auto' }}
          >
            {t('viewAsUser', 'View as this user')}
          </Button>
        )}
        <Button onClick={onClose} color="inherit">{t('close')}</Button>
      </DialogActions>

      {selectiveProject && (
        <SelectiveAccessDialog
          open={!!selectiveProject}
          onClose={() => setSelectiveProject(null)}
          userId={user.id}
          projectId={selectiveProject?.id}
          projectName={selectiveProject?.project?.name}
          folderPermissions={user.folderPermissions || []}
          onToggleFolder={onToggleFolder}
        />
      )}
    </Dialog>
  );
}
