import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { Box, Typography, Button, Paper, useTheme } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function GlobalErrorBoundary() {
  const error = useRouteError();
  const theme = useTheme();
  
  let errorMessage = 'An unexpected application error occurred.';
  if (isRouteErrorResponse(error)) {
    errorMessage = `${error.status} ${error.statusText} - ${error.data}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  // Reload the application (fixes module Hot-Reloading crashes)
  const handleReload = () => {
    window.location.href = '/';
  };

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'background.default',
      p: 3
    }}>
      <Paper elevation={0} sx={{ 
        p: { xs: 3, sm: 5 }, 
        maxWidth: 500, 
        width: '100%',
        textAlign: 'center',
        border: 1, 
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff'
      }}>
        <ErrorOutlineIcon color="error" sx={{ fontSize: 64, mb: 2, opacity: 0.9 }} />
        
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Oops! Something went wrong.
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          {errorMessage}
        </Typography>

        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<RefreshIcon />}
          onClick={handleReload}
          disableElevation
          sx={{ borderRadius: 2, px: 3, py: 1 }}
        >
          Reload Application
        </Button>
      </Paper>
    </Box>
  );
}
