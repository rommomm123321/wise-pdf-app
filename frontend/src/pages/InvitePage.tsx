import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Divider,
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
        if (info?.companyName) {
          localStorage.setItem('welcomeToCompany', info.companyName);
        }
        navigate('/');
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <Box minHeight="100vh" display="flex" justifyContent="center" alignItems="center" sx={{ bgcolor: '#0f0f0f' }}>
        <CircularProgress sx={{ color: '#c9a227' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box minHeight="100vh" display="flex" justifyContent="center" alignItems="center" px={2} sx={{ bgcolor: '#0f0f0f' }}>
        <Box sx={{ maxWidth: 440, width: '100%', bgcolor: '#1a1a1a', borderRadius: 3, border: '1px solid #2a2a2a', p: 4, textAlign: 'center' }}>
          <img src="https://wise-bim.com/logo-short.png" alt="Wise Logo" style={{ height: 60, marginBottom: 12 }} />
          <Typography variant="h5" fontWeight={800} color="#fff" mb={3}>Redlines</Typography>
          <Alert severity="error">{error}</Alert>
        </Box>
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
      sx={{ bgcolor: '#0f0f0f' }}
    >
      {/* Logo */}
      <Box textAlign="center" mb={4}>
        <img src="https://wise-bim.com/logo-short.png" alt="Wise Logo" style={{ height: 80, marginBottom: 8 }} />
        <Typography variant="caption" sx={{ display: 'block', color: '#666', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 1 }}>Collaborative PDF Platform</Typography>
      </Box>

      {/* Card */}
      <Box sx={{ maxWidth: 480, width: '100%', bgcolor: '#1a1a1a', borderRadius: 3, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ px: 4, py: 3, borderBottom: '1px solid #2a2a2a', background: 'linear-gradient(135deg, #1a1a1a 0%, #1f1a0e 100%)' }}>
          <Typography variant="h6" fontWeight={700} color="#fff">{t('acceptInvitation')}</Typography>
          <Typography variant="body2" sx={{ color: '#666', mt: 0.5 }}>
            You've been invited to join a workspace
          </Typography>
        </Box>

        {/* Body */}
        {info && (
          <Box sx={{ px: 4, py: 3 }}>
            <Stack spacing={2.5}>
              {/* Company */}
              <Box>
                <Typography variant="caption" sx={{ color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, fontSize: '0.65rem' }}>
                  {t('invitationCompany')}
                </Typography>
                <Typography variant="h6" fontWeight={700} color="#fff" mt={0.5}>{info.companyName}</Typography>
              </Box>

              <Divider sx={{ borderColor: '#2a2a2a' }} />

              {/* Email + Role row */}
              <Box display="flex" gap={3} flexWrap="wrap">
                <Box flex={1} minWidth={140}>
                  <Typography variant="caption" sx={{ color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, fontSize: '0.65rem' }}>
                    {t('inviteEmail')}
                  </Typography>
                  <Typography variant="body2" color="#ccc" mt={0.5}>{info.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, fontSize: '0.65rem' }}>
                    {t('inviteRole')}
                  </Typography>
                  <Box mt={0.5}>
                    <Chip
                      label={info.role?.name || t('noRole')}
                      size="small"
                      sx={{ bgcolor: info.role?.color || '#c9a227', color: '#000', fontWeight: 700, fontSize: '0.72rem' }}
                    />
                  </Box>
                </Box>
              </Box>

              {/* Projects */}
              {info.projects.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, fontSize: '0.65rem' }}>
                    {t('inviteProjects')}
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
                    {info.projects.map((p) => (
                      <Chip key={p.id} label={p.name} size="small" variant="outlined" sx={{ borderColor: '#333', color: '#aaa', fontSize: '0.72rem' }} />
                    ))}
                  </Box>
                </Box>
              )}

              <Divider sx={{ borderColor: '#2a2a2a' }} />

              {/* Auth */}
              <Box>
                {accepting ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={32} sx={{ color: '#c9a227' }} />
                  </Box>
                ) : clientId ? (
                  <GoogleOAuthProvider clientId={clientId}>
                    <Typography variant="body2" sx={{ color: '#666', mb: 2, textAlign: 'center', fontSize: '0.8rem' }}>
                      {t('inviteAcceptHint', 'Sign in with Google to accept')}
                    </Typography>
                    {/* Hidden real GoogleLogin — provides secure credential flow */}
                    <Box sx={{ display: 'flex', justifyContent: 'center',
                      '& > div': { borderRadius: '10px !important', overflow: 'hidden' },
                      // Override Google button colors to match dark theme
                      '& iframe': { colorScheme: 'dark' },
                    }}>
                      <GoogleLogin
                        onSuccess={handleAccept}
                        onError={() => setError('Google login failed')}
                        theme="filled_black"
                        shape="rectangular"
                        text="continue_with"
                        size="large"
                        width="320"
                      />
                    </Box>
                  </GoogleOAuthProvider>
                ) : (
                  <Alert severity="error">{t('noConfigWarn')}</Alert>
                )}
              </Box>
            </Stack>
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ px: 4, py: 2, borderTop: '1px solid #2a2a2a', bgcolor: '#111' }}>
          <Typography variant="caption" sx={{ color: '#444', fontSize: '0.7rem' }}>
            Expires: {info ? new Date(info.expiresAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
