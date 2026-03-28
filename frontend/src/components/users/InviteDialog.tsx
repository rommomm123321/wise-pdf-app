import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  Checkbox,
  ListItemText,
  IconButton,
  Alert,
  List,
  ListItem,
  ListItemSecondaryAction,
  Autocomplete,
  useMediaQuery,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelIcon from '@mui/icons-material/Cancel';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../../hooks/useProjects';
import { useInvitations, useCreateInvitation, useCancelInvitation } from '../../hooks/useInvitations';
import { useUsers } from '../../hooks/useUsers';
import { useCustomRoles } from '../../hooks/useCustomRoles';
import { useAuth } from '../../contexts/AuthContext';
import { useAllCompanies } from '../../hooks/useCompany';

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function InviteDialog({ open, onClose }: InviteDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGeneralAdmin = user?.systemRole === 'GENERAL_ADMIN';
  const isMobile = useMediaQuery('(max-width:600px)');

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedProjects([]);
  };
  const { data: allCompanies = [] } = useAllCompanies();

  // For GENERAL_ADMIN: load projects only after company is selected
  // For regular admins: load all accessible projects (their company)
  const projectsQuery = useProjects(1, 200, isGeneralAdmin ? selectedCompanyId : undefined);
  const projectsList = (isGeneralAdmin && !selectedCompanyId) ? [] : (projectsQuery.data?.projects || []);
  
  const { data: invitations = [], refetch: refetchInvitations } = useInvitations();
  const usersQuery = useUsers(1, 1000);
  const allUsers = usersQuery.data?.users || [];
  const { data: customRoles = [] } = useCustomRoles();
  const createInvitation = useCreateInvitation();
  const cancelInvitation = useCancelInvitation();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('');

  // Auto-select first role when roles load
  const firstRoleId = customRoles[0]?.id || 'MEMBER';
  const effectiveRole = role || firstRoleId;
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<Dayjs | null>(dayjs().add(7, 'day'));
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'create' | 'pending'>('create');
  const [error, setError] = useState<string | null>(null);

  // Reset form state and refetch fresh data every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setEmail('');
    setRole('');
    setSelectedProjects([]);
    setSelectedCompanyId('');
    setInviteLink(null);
    setCopied(false);
    setError(null);
    refetchInvitations();
  }, [open]);

  const validateEmail = (e: string) => {
    return String(e).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
  };

  const handleCreate = async () => {
    setError(null);
    if (!email.trim() || !validateEmail(email)) {
      setError(t('errorInvalidEmail'));
      return;
    }
    if (isGeneralAdmin && !selectedCompanyId) {
      setError(t('errorSelectCompany', 'Please select a company first'));
      return;
    }

    try {
      const result = await createInvitation.mutateAsync({
        email: email.trim(),
        roleId: effectiveRole,
        projectIds: selectedProjects,
        ...(isGeneralAdmin ? { companyId: selectedCompanyId } : {}),
      });
      
      if (result.data?.token) {
        setInviteLink(`${window.location.origin}/invite/${result.data.token}`);
      }
      setEmail('');
      setSelectedProjects([]);
    } catch (err: any) {
      setError(err.message || 'Failed');
    }
  };

  const handleCopy = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pendingInvitations = invitations.filter((inv: any) => inv.status === 'PENDING');

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box 
          display="flex" 
          gap={1} 
          flexDirection={isMobile ? 'column' : 'row'}
        >
          <Button 
            variant={tab === 'create' ? 'contained' : 'outlined'} 
            size="small" 
            onClick={() => setTab('create')} 
            sx={{ borderRadius: 20, flex: 1 }}
          >
            {t('inviteUser')}
          </Button>
          <Button 
            variant={tab === 'pending' ? 'contained' : 'outlined'} 
            size="small" 
            onClick={() => setTab('pending')} 
            sx={{ borderRadius: 20, flex: 1 }}
          >
            {t('invitePending')} ({pendingInvitations.length})
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {tab === 'create' ? (
          <Box display="flex" flexDirection="column" gap={2.5} mt={2}>
            {error && <Alert severity="error">{error}</Alert>}
            
            <Autocomplete
              freeSolo
              options={allUsers.map((u: any) => u.email)}
              value={email}
              onInputChange={(_, newValue) => { setEmail(newValue); setError(null); }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label={t('inviteEmail')} 
                  placeholder="example@gmail.com" 
                  size="small" 
                  error={!!error} 
                  required 
                />
              )}
            />

            {isGeneralAdmin && (
              <FormControl size="small" fullWidth required>
                <InputLabel>{t('company', 'Company')}</InputLabel>
                <Select value={selectedCompanyId} label={t('company', 'Company')} onChange={(e) => handleCompanyChange(e.target.value)}>
                  {(allCompanies as any[]).map((c: any) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl size="small" fullWidth>
              <InputLabel>{t('inviteRole')}</InputLabel>
              <Select value={effectiveRole} label={t('inviteRole')} onChange={(e) => setRole(e.target.value)}>
                {customRoles.length > 0
                  ? customRoles.map((r: any) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)
                  : ['ADMIN', 'MEMBER', 'VIEWER'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)
                }
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth disabled={isGeneralAdmin && !selectedCompanyId}>
              <InputLabel>{t('inviteProjects')}</InputLabel>
              <Select multiple value={selectedProjects} label={t('inviteProjects')} onChange={(e) => setSelectedProjects(e.target.value as string[])} renderValue={(selected) => (
                <Box display="flex" gap={0.5} flexWrap="wrap">
                  {selected.map((id) => {
                    const p = projectsList.find((pr: any) => pr.id === id);
                    return <Chip key={id} label={p?.name || id} size="small" sx={{ height: 20 }} />;
                  })}
                </Box>
              )}
              >
                {projectsList.map((p: any) => (
                  <MenuItem key={p.id} value={p.id}>
                    <Checkbox checked={selectedProjects.includes(p.id)} size="small" />
                    <ListItemText primary={p.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <DatePicker
              label={t('expiresAt', 'Expires At')}
              value={expiresAt}
              onChange={(newValue) => setExpiresAt(newValue)}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />

            {inviteLink && (
              <Alert severity="success" icon={<ContentCopyIcon fontSize="inherit" />} sx={{ cursor: 'pointer' }} onClick={() => handleCopy(inviteLink)}>
                <Typography variant="caption" sx={{ wordBreak: 'break-all', fontWeight: 600 }}>{copied ? t('inviteCopied') : inviteLink}</Typography>
              </Alert>
            )}
          </Box>
        ) : (
          <Box mt={1}>
            {pendingInvitations.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>{t('noPendingInvitations')}</Typography>
            ) : (
              <List>
                {pendingInvitations.map((inv: any) => {
                  const link = `${window.location.origin}/invite/${inv.token}`;
                  return (
                    <ListItem key={inv.id} divider>
                      <ListItemText primary={inv.email} secondary={`${(customRoles as any[]).find((r) => r.id === (inv.roleId || (typeof inv.role === 'string' ? inv.role : inv.role?.id)))?.name || inv.role?.name || (typeof inv.role === 'string' ? inv.role : null) || inv.roleId || '—'} • Exp: ${new Date(inv.expiresAt).toLocaleDateString()}`} />
                      <ListItemSecondaryAction>
                        <IconButton size="small" onClick={() => handleCopy(link)} color="primary"><ContentCopyIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => cancelInvitation.mutate(inv.id)}><CancelIcon fontSize="small" /></IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">{t('close')}</Button>
        {tab === 'create' && <Button onClick={handleCreate} variant="contained" disabled={!email || createInvitation.isPending}>{createInvitation.isPending ? t('sending') : t('inviteSend')}</Button>}
      </DialogActions>
    </Dialog>
  );
}
