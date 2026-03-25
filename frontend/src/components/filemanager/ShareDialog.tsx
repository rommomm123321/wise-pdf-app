import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Avatar,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  FormControlLabel,
  Switch,
  Autocomplete,
  Tooltip,
  Alert,
  Fade,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useUsers } from '../../hooks/useUsers';
import { useCustomRoles } from '../../hooks/useCustomRoles';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  existingPermissions: any[];
  onUpdatePermission: (userId: string, perms: any) => void;
  onRemovePermission: (userId: string) => void;
  onAddUser: (userId: string, perms: any) => void;
}

const PERM_KEYS = ['canView', 'canEdit', 'canDelete', 'canDownload', 'canMarkup', 'canManage'] as const;

export default function ShareDialog({
  open,
  onClose,
  title,
  existingPermissions,
  onUpdatePermission,
  onRemovePermission,
  onAddUser,
}: ShareDialogProps) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { data: usersData } = useUsers(1, 100);
  const { data: rolesData = [] } = useCustomRoles();
  const allUsers = usersData?.users ?? [];
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const isAdmin = currentUser?.systemRole === 'GENERAL_ADMIN' || currentUser?.role?.name === 'Admin';

  // Local state for permissions — optimistic updates, synced from server data
  const [localPerms, setLocalPerms] = useState<Record<string, any>>({});

  // Sync server data → local state (only when server data actually changes)
  useEffect(() => {
    const map: Record<string, any> = {};
    for (const p of existingPermissions) {
      if (p.userId) {
        map[p.userId] = {
          userId: p.userId,
          user: p.user,
          canView: p.canView ?? false,
          canEdit: p.canEdit ?? false,
          canDelete: p.canDelete ?? false,
          canDownload: p.canDownload ?? false,
          canMarkup: p.canMarkup ?? false,
          canManage: p.canManage ?? false,
        };
      }
    }
    setLocalPerms(map);
  }, [existingPermissions]);

  const permsList = useMemo(() => Object.values(localPerms), [localPerms]);

  const availableUsers = useMemo(() => {
    const existingIds = new Set(Object.keys(localPerms));
    return allUsers.filter((u: any) => !existingIds.has(u.id));
  }, [allUsers, localPerms]);

  const handleAddWithRole = (role: any) => {
    if (selectedUsers.length > 0) {
      const perms = {
        canView: role.defaultCanView ?? role.canView,
        canEdit: role.defaultCanEdit ?? role.canEdit,
        canDelete: role.defaultCanDelete ?? role.canDelete,
        canDownload: role.defaultCanDownload ?? role.canDownload,
        canMarkup: role.defaultCanMarkup ?? role.canMarkup,
        canManage: role.defaultCanManage ?? role.canManage,
      };
      
      // Add all selected users
      for (const u of selectedUsers) {
        onAddUser(u.id, perms);
        // Optimistic update
        setLocalPerms(prev => ({
          ...prev,
          [u.id]: { userId: u.id, user: u, ...perms },
        }));
      }

      setSelectedUsers([]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const getActiveRoleName = (perm: any) => {
    // Check custom roles first
    for (const role of rolesData) {
      const match = 
        perm.canView === role.defaultCanView &&
        perm.canEdit === role.defaultCanEdit &&
        perm.canDelete === role.defaultCanDelete &&
        perm.canDownload === role.defaultCanDownload &&
        perm.canMarkup === role.defaultCanMarkup &&
        perm.canManage === role.defaultCanManage;
      if (match) return role.name;
    }
    // Check simple presets
    if (perm.canEdit) return t('editor');
    if (perm.canView) return t('viewer');
    return t('custom', 'Custom');
  };

  const handleToggle = useCallback((userId: string, key: string, value: boolean) => {
    // Update local state immediately (optimistic)
    setLocalPerms(prev => {
      const current = prev[userId];
      if (!current) return prev;
      const updated = { ...current, [key]: value };
      // Send to server
      const permsToSend = {
        canView: updated.canView,
        canEdit: updated.canEdit,
        canDelete: updated.canDelete,
        canDownload: updated.canDownload,
        canMarkup: updated.canMarkup,
        canManage: updated.canManage,
      };
      onUpdatePermission(userId, permsToSend);
      return { ...prev, [userId]: updated };
    });
  }, [onUpdatePermission]);

  const handleRemove = useCallback((userId: string) => {
    onRemovePermission(userId);
    // Optimistic: remove from local state
    setLocalPerms(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, [onRemovePermission]);

  // Simple presets for regular users
  const simplePresets = [
    { id: 'viewer', name: t('viewer'), color: '#9E9E9E', canView: true, canEdit: false, canDelete: false, canDownload: true, canMarkup: false, canManage: false },
    { id: 'editor', name: t('editor'), color: '#2196F3', canView: true, canEdit: true, canDelete: false, canDownload: true, canMarkup: true, canManage: false },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('share', 'Share')}: {title}
      </DialogTitle>
      <DialogContent>
        <Box mb={3} mt={1}>
          <Typography variant="subtitle2" gutterBottom>
            {t('addUserToScope', 'Add users to this item')}
          </Typography>
          <Box display="flex" gap={1} mb={1}>
            <Autocomplete
              multiple
              fullWidth
              size="small"
              options={availableUsers}
              getOptionLabel={(option: any) => `${option.name || option.email} (${option.email})`}
              renderOption={(props, option: any) => (
                <Box component="li" {...props} key={option.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: option.role?.color || 'grey.500' }}>
                    {option.name?.[0]?.toUpperCase() || option.email[0].toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{option.name || option.email}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {option.email}{option.role ? ` · ${option.role.name}` : ''}{option.company ? ` · ${option.company.name}` : ''}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField {...params} placeholder={t('searchUsers', 'Search users...')} />
              )}
              onChange={(_, value: any[]) => setSelectedUsers(value)}
              value={selectedUsers}
            />
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap">
            {(isAdmin ? rolesData : simplePresets).map((role: any) => (
              <Button 
                key={role.id}
                size="small" 
                variant="outlined" 
                onClick={() => handleAddWithRole(role)} 
                disabled={selectedUsers.length === 0}
                sx={{ 
                  color: role.color ? role.color : 'inherit', 
                  borderColor: role.color ? role.color : 'inherit',
                  '&:hover': {
                    backgroundColor: role.color ? `${role.color}15` : 'rgba(0,0,0,0.04)',
                    borderColor: role.color || 'inherit'
                  }
                }}
              >
                + {role.name}
              </Button>
            ))}
            {isAdmin && rolesData.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('noRolesAvailable', 'No roles available. Configure roles in users tab.')}
              </Typography>
            )}
          </Box>
        </Box>

        <Fade in={showSuccess}>
          <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon fontSize="inherit" />}>
            {t('accessGranted', 'Access granted successfully!')}
          </Alert>
        </Fade>

        {isAdmin && (
          <>
            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              {t('whoHasAccess', 'Who has access')}
            </Typography>
            <List 
              dense 
              sx={{ 
                maxHeight: 400, 
                overflow: 'auto',
                pr: 1,
                '&::-webkit-scrollbar': { width: '6px' },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': { 
                  background: 'rgba(128, 128, 128, 0.3)', 
                  borderRadius: '10px' 
                },
                '&::-webkit-scrollbar-thumb:hover': { 
                  background: 'rgba(128, 128, 128, 0.5)' 
                },
              }}
            >
              {permsList.length === 0 ? (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  {t('noSpecificPermissions', 'No specific permissions set for this item.')}
                </Typography>
              ) : (
                permsList.map((perm) => {
                  const user = allUsers.find((u: any) => u.id === perm.userId) || perm.user;
                  const activePreset = getActiveRoleName(perm);
                  const isSelf = perm.userId === currentUser?.id;

                  return (
                    <ListItem key={perm.userId} sx={{ px: 0, py: 1, flexDirection: 'column', alignItems: 'stretch' }}>
                      <Box display="flex" alignItems="center" width="100%" mb={1}>
                        <ListItemAvatar sx={{ minWidth: 40 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={user?.name || user?.email}
                          secondary={
                            <Chip
                              label={activePreset}
                              size="small"
                              variant="outlined"
                              sx={{ height: 16, fontSize: '0.6rem', mt: 0.5 }}
                            />
                          }
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                        />
                        <IconButton size="small" color="error" onClick={() => handleRemove(perm.userId)} disabled={isSelf}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box display="flex" flexWrap="wrap" gap={1.5} pl={5}>
                        {PERM_KEYS.map((permKey) => (
                          <FormControlLabel
                            key={`${perm.userId}-${permKey}`}
                            control={
                              <Switch
                                size="small"
                                checked={!!perm[permKey]}
                                onChange={(e) => handleToggle(perm.userId, permKey, e.target.checked)}
                                disabled={isSelf}
                              />
                            }
                            label={
                              <Box display="flex" alignItems="center">
                                <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{t(permKey)}</Typography>
                                {permKey === 'canManage' && (
                                  <Tooltip title={t('canManageHint')}>
                                    <HelpOutlineIcon sx={{ fontSize: 10, ml: 0.3, opacity: 0.6 }} />
                                  </Tooltip>
                                )}
                              </Box>
                            }
                            sx={{ m: 0 }}
                          />
                        ))}
                      </Box>
                      <Divider sx={{ mt: 2, opacity: 0.5 }} />
                    </ListItem>
                  );
                })
              )}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">{t('close', 'Close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
