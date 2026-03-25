import { Box, Typography, Button, Paper } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export default function NoAccessPage() {
  const { logout } = useAuth();
  const { t } = useTranslation();

  return (
    <Box 
      display="flex" 
      justifyContent="center" 
      alignItems="center" 
      minHeight="100vh" 
      bgcolor="background.default"
    >
      <Paper 
        elevation={3} 
        sx={{ p: 5, maxWidth: 500, textAlign: 'center', borderRadius: 3 }}
      >
        <BlockIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
        <Typography variant="h4" fontWeight={700} mb={2}>
          {t('noAccessTitle', 'Access Denied')}
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          {t('noAccessMessage', 'Your account is currently not assigned to any active company or projects. You may have been deactivated or are pending assignment. Please contact an administrator for access.')}
        </Typography>
        <Button variant="contained" color="primary" onClick={logout} size="large">
          {t('logout', 'Sign Out')}
        </Button>
      </Paper>
    </Box>
  );
}
