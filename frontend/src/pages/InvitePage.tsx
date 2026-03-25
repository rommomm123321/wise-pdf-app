import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';

interface InvitationInfo {
  email: string;
  role: { name: string; color: string | null } | null;
  companyName: string;
  projects: { id: string; name: string }[];
  expiresAt: string;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.googleClientId && data.googleClientId !== 'your_google_client_id_here') {
          setClientId(data.googleClientId);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invitations/info/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setInfo(data.data);
        } else {
          setError(data.error || 'Invalid invitation');
        }
      })
      .catch(() => setError('Failed to load invitation'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async (credentialResponse: any) => {
    setAccepting(true);
    try {
      const data = await apiFetch<{ status: string; token: string; user: any }>(
        `/api/invitations/accept/${token}`,
        {
          method: 'POST',
          body: JSON.stringify({ credential: credentialResponse.credential }),
        }
      );

      if (data.status === 'ok' && data.token) {
        localStorage.setItem('token', data.token);
        navigate('/');
        window.location.reload(); // Reload to pick up new auth state
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <Box minHeight="100vh" display="flex" justifyContent="center" alignItems="center">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box minHeight="100vh" display="flex" justifyContent="center" alignItems="center" px={2}>
        <Card sx={{ maxWidth: 440, width: '100%' }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} color="primary" gutterBottom>
              {t('appName')}
            </Typography>
            <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      px={2}
    >
      <Typography variant="h3" fontWeight={700} color="primary" gutterBottom>
        {t('appName')}
      </Typography>

      <Card sx={{ maxWidth: 500, width: '100%', mt: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom textAlign="center">
            {t('acceptInvitation')}
          </Typography>

          {info && (
            <Stack spacing={2} mt={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">{t('invitationCompany')}</Typography>
                <Typography variant="h6" fontWeight={600}>{info.companyName}</Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">{t('inviteRole')}</Typography>
                <Chip label={info.role?.name || t('noRole')} sx={{ mt: 0.5, bgcolor: info.role?.color || 'secondary.main', color: '#fff' }} />
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">{t('inviteEmail')}</Typography>
                <Typography variant="body1">{info.email}</Typography>
              </Box>

              {info.projects.length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {t('inviteProjects')}
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {info.projects.map((p) => (
                      <Chip key={p.id} label={p.name} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}

              <Box mt={2} textAlign="center">
                {accepting ? (
                  <CircularProgress />
                ) : clientId ? (
                  <GoogleOAuthProvider clientId={clientId}>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {t('inviteAcceptHint')}
                    </Typography>
                    <Box display="flex" justifyContent="center">
                      <GoogleLogin
                        onSuccess={handleAccept}
                        onError={() => setError('Google login failed')}
                      />
                    </Box>
                  </GoogleOAuthProvider>
                ) : (
                  <Alert severity="error">{t('noConfigWarn')}</Alert>
                )}
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
