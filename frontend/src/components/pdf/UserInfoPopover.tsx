import { useState, useEffect } from 'react';
import { Popover, Box, Typography, Avatar, Chip, Divider, alpha, useTheme, CircularProgress } from '@mui/material';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface UserInfoPopoverProps {
  userId: string | null;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

export default function UserInfoPopover({ userId, anchorEl, onClose }: UserInfoPopoverProps) {
  const theme = useTheme();
  const { user: currentUser } = useAuth();
  const isGeneralAdmin = currentUser?.systemRole === 'GENERAL_ADMIN';
  const gold = theme.palette.primary.main;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    setLoading(true);
    apiFetch(`/api/users/${userId}/profile`)
      .then(res => setProfile(res.data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId]);

  const open = Boolean(anchorEl) && Boolean(userId);
  const initials = profile ? ((profile.name || profile.email || '?')[0]).toUpperCase() : '?';

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      disableAutoFocus
      slotProps={{ paper: { sx: { width: 260, p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } } }}
    >
      {loading ? (
        <Box display="flex" justifyContent="center" py={2}><CircularProgress size={20} /></Box>
      ) : profile ? (
        <Box>
          <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
            <Avatar sx={{ bgcolor: gold, width: 40, height: 40, fontSize: '1rem', fontWeight: 700 }}>{initials}</Avatar>
            <Box minWidth={0}>
              <Typography fontWeight={700} fontSize="0.85rem" noWrap>{profile.name || profile.email}</Typography>
              <Typography fontSize="0.7rem" color="text.secondary" noWrap>{profile.email}</Typography>
            </Box>
          </Box>
          <Divider sx={{ mb: 1 }} />
          {profile.role && (
            <Box display="flex" alignItems="center" gap={1} mb={0.75}>
              <Typography fontSize="0.65rem" color="text.secondary" sx={{ minWidth: 56, flexShrink: 0 }}>Role</Typography>
              <Chip
                label={profile.role.name}
                size="small"
                sx={{
                  fontSize: '0.62rem', height: 18,
                  bgcolor: profile.role.color ? alpha(profile.role.color, 0.15) : alpha(gold, 0.12),
                  color: profile.role.color || gold,
                  fontWeight: 600,
                }}
              />
            </Box>
          )}
          {profile.company && (
            <Box display="flex" alignItems="center" gap={1} mb={0.75}>
              <Typography fontSize="0.65rem" color="text.secondary" sx={{ minWidth: 56, flexShrink: 0 }}>Company</Typography>
              <Typography fontSize="0.72rem" fontWeight={600} noWrap>{profile.company.name}</Typography>
            </Box>
          )}
          {isGeneralAdmin && profile.systemRole && (
            <Box display="flex" alignItems="center" gap={1} mb={0.75}>
              <Typography fontSize="0.65rem" color="text.secondary" sx={{ minWidth: 56, flexShrink: 0 }}>System</Typography>
              <Typography fontSize="0.72rem" color="text.secondary" noWrap>
                {profile.systemRole === 'GENERAL_ADMIN' ? 'Admin' : profile.systemRole}
              </Typography>
            </Box>
          )}
          {profile.assignedProjects?.length > 0 && (
            <Box mt={1}>
              <Typography fontSize="0.65rem" color="text.secondary" mb={0.5}>
                Projects ({profile.assignedProjects.length})
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {profile.assignedProjects.slice(0, 5).map((ap: any) => (
                  <Chip
                    key={ap.projectId}
                    label={ap.project?.name || ap.projectId}
                    size="small"
                    sx={{ fontSize: '0.6rem', height: 18 }}
                  />
                ))}
                {profile.assignedProjects.length > 5 && (
                  <Typography fontSize="0.6rem" color="text.secondary" alignSelf="center">
                    +{profile.assignedProjects.length - 5} more
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      ) : null}
    </Popover>
  );
}
