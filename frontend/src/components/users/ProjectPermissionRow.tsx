import { Box, Typography, Switch, IconButton, Tooltip, ToggleButtonGroup, ToggleButton, Select, MenuItem, FormControl } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useTranslation } from 'react-i18next';

interface Permission {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canDownload: boolean;
  canMarkup: boolean;
  canManage: boolean;
}

interface ProjectPermissionRowProps {
  projectName: string;
  scope: 'FULL' | 'SELECTIVE';
  permissions: Permission;
  roleId: string | null;
  availableRoles: any[];
  onPermissionChange: (key: string, value: any) => void;
  onRemove: () => void;
  onEditSelective?: () => void;
  disabled?: boolean;
}

const PERMISSION_KEYS: (keyof Permission)[] = [
  'canView',
  'canEdit',
  'canDelete',
  'canDownload',
  'canMarkup',
  'canManage',
];

export default function ProjectPermissionRow({
  projectName,
  scope,
  permissions,
  roleId,
  availableRoles,
  onPermissionChange,
  onRemove,
  onEditSelective,
  disabled = false,
}: ProjectPermissionRowProps) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        py: 1.5,
        px: 2,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" fontWeight={700} color="primary">
          {projectName}
        </Typography>

        <Box display="flex" alignItems="center" gap={1.5}>
          {/* Project Role Selector */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={roleId || ''}
              displayEmpty
              onChange={(e) => onPermissionChange('roleId', e.target.value || null)}
              disabled={disabled}
              sx={{ fontSize: '0.75rem', height: 30 }}
            >
              <MenuItem value=""><em>{t('noRole', 'Default')}</em></MenuItem>
              {availableRoles.map(r => (
                <MenuItem key={r.id} value={r.id} sx={{ fontSize: '0.75rem' }}>{r.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <ToggleButtonGroup
            size="small"
            value={scope}
            exclusive
            onChange={(_, val) => val && onPermissionChange('scope', val)}
            disabled={disabled}
            sx={{ height: 30 }}
          >
            <ToggleButton value="FULL" sx={{ fontSize: '0.65rem', px: 1 }}>{t('scopeFull')}</ToggleButton>
            <ToggleButton value="SELECTIVE" sx={{ fontSize: '0.65rem', px: 1 }}>{t('scopeSelective')}</ToggleButton>
          </ToggleButtonGroup>

          {scope === 'SELECTIVE' && onEditSelective && (
            <Tooltip title={t('editSelectiveAccess', 'Edit Selective Access')}>
              <IconButton size="small" color="primary" onClick={onEditSelective} disabled={disabled}>
                <AccountTreeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={t('unassignFromProject')}>
            <IconButton size="small" color="error" onClick={onRemove} disabled={disabled}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box display="flex" gap={0.5} flexWrap="wrap">
        {PERMISSION_KEYS.map((key) => (
          <Box key={key} display="flex" alignItems="center" sx={{ minWidth: 90 }}>
            <Switch
              size="small"
              checked={permissions[key]}
              onChange={(e) => onPermissionChange(key, e.target.checked)}
              disabled={disabled}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
              {t(key)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
