import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [clientId, setClientId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // If already logged in, redirect based on role
  useEffect(() => {
    if (!user) return;
    const from = (location.state as any)?.from;
    if (from && from !== '/login') {
      navigate(from, { replace: true });
    } else if (user.systemRole === 'GENERAL_ADMIN') {
      navigate('/companies', { replace: true });
    } else {
      navigate('/projects', { replace: true });
    }
  }, [user]);

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

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setAuthError(null);
    try {
      await login(credentialResponse.credential);
      // useEffect above will handle redirect based on role
    } catch (error: any) {
      setAuthError(error?.message || 'Authentication failed');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        px: 2,
        bgcolor: '#0f0f0f',
      }}
    >
      {/* Logo */}
      <Box textAlign="center" mb={5}>
        <img src="https://wise-bim.com/logo-short.png" alt="Wise Logo" style={{ height: 100, marginBottom: 16 }} />
        <Typography variant="body1" sx={{ color: '#666', fontSize: '0.85rem' }}>
          {t('appDescription', 'Collaborative PDF Platform')}
        </Typography>
      </Box>

      {/* Card */}
      <Box sx={{
        width: '100%',
        maxWidth: 400,
        bgcolor: '#1a1a1a',
        borderRadius: 3,
        border: '1px solid #2a2a2a',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <Box sx={{ px: 4, py: 3, background: 'linear-gradient(135deg, #1a1a1a 0%, #1f1a0e 100%)', borderBottom: '1px solid #2a2a2a' }}>
          <Typography variant="h6" fontWeight={700} color="#fff">{t('loginTitle', 'Sign in')}</Typography>
          <Typography variant="body2" sx={{ color: '#666', mt: 0.5, fontSize: '0.8rem' }}>
            {t('loginDescription', 'Use your Google account to continue')}
          </Typography>
        </Box>

        {/* Body */}
        <Box sx={{ px: 4, py: 4 }}>
          {clientId ? (
            <GoogleOAuthProvider clientId={clientId}>
              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                <Box sx={{
                  '& > div': { borderRadius: '10px !important', overflow: 'hidden' },
                }}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setAuthError('Google login failed')}
                    useOneTap
                    theme="filled_black"
                    shape="rectangular"
                    text="signin_with"
                    size="large"
                    width="320"
                  />
                </Box>
                {authError && (
                  <Typography variant="caption" sx={{ color: '#f44', textAlign: 'center' }}>{authError}</Typography>
                )}
              </Box>
            </GoogleOAuthProvider>
          ) : (
            <Typography
              variant="body2"
              sx={{ color: '#f44', bgcolor: 'rgba(255,0,0,0.08)', p: 2, borderRadius: 2, textAlign: 'center' }}
            >
              {t('noConfigWarn')}
            </Typography>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ px: 4, py: 2, borderTop: '1px solid #2a2a2a', bgcolor: '#111' }}>
          <Typography variant="caption" sx={{ color: '#444', fontSize: '0.7rem' }}>
            By signing in you agree to our terms of service
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
