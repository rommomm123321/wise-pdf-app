import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Switch,
  IconButton,
  Chip,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useTranslation } from 'react-i18next';
import {
  useCustomRoles,
  useCreateCustomRole,
  useUpdateCustomRole,
  useDeleteCustomRole,
  type CustomRole,
} from '../../hooks/useCustomRoles';

interface CustomRoleDialogProps {
  open: boolean;
  onClose: () => void;
}

const PERMISSION_KEYS = [
  'defaultCanView',
  'defaultCanEdit',
  'defaultCanDelete',
  'defaultCanDownload',
  'defaultCanMarkup',
  'defaultCanManage',
] as const;

const PERM_LABELS: Record<string, string> = {
  defaultCanView: 'canView',
  defaultCanEdit: 'canEdit',
  defaultCanDelete: 'canDelete',
  defaultCanDownload: 'canDownload',
  defaultCanMarkup: 'canMarkup',
  defaultCanManage: 'canManage',
};

const COLORS = ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#FF9800', '#795548', '#607D8B'];

export default function CustomRoleDialog({ open, onClose }: CustomRoleDialogProps) {
  const { t } = useTranslation();
  const { data: roles = [] } = useCustomRoles();
  const createRole = useCreateCustomRole();
  const updateCustomRole = useUpdateCustomRole();
  const deleteRole = useDeleteCustomRole();

  const isMobile = useMediaQuery('(max-width:600px)');
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [perms, setPerms] = useState({
    defaultCanView: true,
    defaultCanEdit: false,
    defaultCanDelete: false,
    defaultCanDownload: true,
    defaultCanMarkup: false,
    defaultCanManage: false,
  });

  const resetForm = () => {
    setName('');
    setColor(COLORS[0]);
    setPerms({
      defaultCanView: true, defaultCanEdit: false, defaultCanDelete: false,
      defaultCanDownload: true, defaultCanMarkup: false, defaultCanManage: false,
    });
    setEditing(null);
    setCreating(false);
    setNameError(null);
  };

  const startCreate = () => {
    resetForm();
    setCreating(true);
  };

  const startEdit = (role: CustomRole) => {
    setName(role.name);
    setColor(role.color || COLORS[0]);
    setPerms({
      defaultCanView: role.defaultCanView,
      defaultCanEdit: role.defaultCanEdit,
      defaultCanDelete: role.defaultCanDelete,
      defaultCanDownload: role.defaultCanDownload,
      defaultCanMarkup: role.defaultCanMarkup,
      defaultCanManage: role.defaultCanManage,
    });
    setEditing(role);
    setCreating(false);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    setNameError(null);
    const onError = (err: any) => {
      const msg = err?.message || '';
      if (msg.includes('already exists')) {
        setNameError(t('roleNameExists', 'Role with this name already exists'));
      }
    };
    if (editing) {
      updateCustomRole.mutate({ id: editing.id, name: name.trim(), color, ...perms }, { onSuccess: resetForm, onError });
    } else {
      createRole.mutate({ name: name.trim(), color, ...perms }, { onSuccess: resetForm, onError });
    }
  };

  const isFormOpen = creating || !!editing;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        <Box 
          display="flex" 
          flexDirection={isMobile ? 'column' : 'row'} 
          justifyContent="space-between" 
          alignItems={isMobile ? 'flex-start' : 'center'}
          gap={1.5}
        >
          <Typography variant="h6" fontWeight={600}>{t('manageCompanyRoles', 'Manage Roles')}</Typography>
          {!isFormOpen && (
            <Button 
              size="small" 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={startCreate}
              fullWidth={isMobile}
            >
              {t('addRole', 'Add Role')}
            </Button>
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        {isFormOpen ? (
          <Box mt={1}>
            <TextField
              fullWidth
              size="small"
              label={t('roleName')}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(null); }}
              sx={{ mb: 2 }}
              required
              error={!!nameError}
              helperText={nameError}
            />

            <Typography variant="subtitle2" gutterBottom>{t('roleColor')}</Typography>
            <Box display="flex" gap={0.5} flexWrap="wrap" mb={3}>
              {COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setColor(c)}
                  sx={{
                    width: 24, height: 24, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                    border: color === c ? '2px solid #000' : 'none',
                    boxShadow: '0 0 2px rgba(0,0,0,0.2)'
                  }}
                />
              ))}
            </Box>

            <Typography variant="subtitle2" gutterBottom>
              {t('defaultPermissionsForRole', 'Default Permissions for this role')}
              <Tooltip title={t('permsHint', 'These permissions will be applied automatically when you assign a user with this role to a project.')}>
                <HelpOutlineIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', opacity: 0.6 }} />
              </Tooltip>
            </Typography>
            
            <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, mb: 2 }}>
              {PERMISSION_KEYS.map((key) => (
                <Box key={key} display="flex" alignItems="center" justifyContent="space-between" py={0.5}>
                  <Typography variant="body2">{t(PERM_LABELS[key])}</Typography>
                  <Switch
                    size="small"
                    checked={perms[key]}
                    onChange={(e) => setPerms({ ...perms, [key]: e.target.checked })}
                  />
                </Box>
              ))}
            </Box>

            <Box display="flex" gap={1} justifyContent="flex-end">
              <Button onClick={resetForm} color="inherit">{t('cancelBtn')}</Button>
              <Button variant="contained" onClick={handleSave} disabled={!name.trim()} sx={{ px: 4 }}>
                {t('save', 'Save')}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box mt={1}>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              {t('rolesSubtitle', 'Standard and custom roles available in your company.')}
            </Typography>
            
            {roles.map((role: CustomRole) => (
              <Box
                key={role.id}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                py={1.5}
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: role.color || '#999' }} />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{role.name}</Typography>
                    {role.isSystem && (
                      <Typography variant="caption" color="primary" sx={{ fontSize: '0.65rem', display: 'block' }}>
                        {t('systemRoleLabel', 'SYSTEM')}
                      </Typography>
                    )}
                  </Box>
                  <Chip label={`${role._count?.users || 0} users`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                </Box>
                <Box>
                  <IconButton size="small" onClick={() => startEdit(role)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {!role.isSystem && (
                    <IconButton size="small" color="error" onClick={() => deleteRole.mutate(role.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">{t('close', 'Close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
