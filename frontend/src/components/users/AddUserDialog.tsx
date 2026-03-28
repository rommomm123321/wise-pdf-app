import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Avatar,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  InputAdornment,
  useMediaQuery,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useTranslation } from 'react-i18next';
import { useSearchUsers, useAddToCompany } from '../../hooks/useUsers';
import { useCustomRoles } from '../../hooks/useCustomRoles';

interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AddUserDialog({ open, onClose }: AddUserDialogProps) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const { data: results = [], isLoading } = useSearchUsers(query);
  const { data: roles = [] } = useCustomRoles();
  const addToCompany = useAddToCompany();

  const handleAdd = async (userId: string) => {
    await addToCompany.mutateAsync({ userId, roleId: selectedRoleId || undefined });
  };

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>{t('addExistingUser')}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <Typography variant="body2" color="text.secondary">
            {t('addUserHint')}
          </Typography>

          <TextField
            autoFocus
            placeholder={t('searchByEmailOrName')}
            fullWidth
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <FormControl size="small" fullWidth>
            <InputLabel>{t('inviteRole')}</InputLabel>
            <Select value={selectedRoleId} label={t('inviteRole')} onChange={(e) => setSelectedRoleId(e.target.value)}>
              {roles.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {r.color && <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: r.color }} />}
                    {r.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Results */}
          {isLoading && query.length >= 2 && (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!isLoading && query.length >= 2 && results.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              {t('searchNoResults')}
            </Typography>
          )}

          {results.length > 0 && (
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {results.map((user: any) => (
                <ListItemButton
                  key={user.id}
                  onClick={() => handleAdd(user.id)}
                  disabled={addToCompany.isPending}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: user.role?.color || 'secondary.main' }}>
                      {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="body2" fontWeight={600}>
                          {user.name || user.email}
                        </Typography>
                        {user.role && (
                          <Chip label={user.role.name} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: user.role.color, color: '#fff' }} />
                        )}
                        {user.company ? (
                          <Chip label={user.company.name} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                        ) : (
                          <Chip label={t('noCompany')} size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                        )}
                      </Box>
                    }
                    secondary={user.email}
                  />
                  <PersonAddIcon fontSize="small" color="primary" />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">{t('cancelBtn')}</Button>
      </DialogActions>
    </Dialog>
  );
}
