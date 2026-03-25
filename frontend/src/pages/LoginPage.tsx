import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Stack } from '@mui/material';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

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
    try {
      await login(credentialResponse.credential);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Auth failed', error);
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
      }}
    >
      <Box textAlign="center" mb={6}>
        <img src="https://wise-bim.com/logo-short.png" alt="Wise Logo" style={{ height: 100, marginBottom: 24 }} />
        <Typography variant="h5" color="text.secondary">
          {t('appDescription')}
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} justifyContent="center" alignItems="center">
        <Card sx={{ minWidth: { xs: 300, sm: 400 }, maxWidth: 440 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              {t('loginTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={4}>
              {t('loginDescription')}
            </Typography>

            {clientId ? (
              <GoogleOAuthProvider clientId={clientId}>
                <Box display="flex" justifyContent="center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => console.log('Login Failed')}
                    useOneTap
                  />
                </Box>
              </GoogleOAuthProvider>
            ) : (
              <Typography
                variant="body2"
                color="error"
                sx={{ bgcolor: 'rgba(255,0,0,0.1)', p: 2, borderRadius: 2 }}
              >
                {t('noConfigWarn')}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
