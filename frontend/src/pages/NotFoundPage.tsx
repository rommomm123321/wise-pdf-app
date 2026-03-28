import { Box, Typography, Button, useTheme, alpha } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchOffIcon from '@mui/icons-material/SearchOff';

interface NotFoundPageProps {
  title?: string;
  message?: string;
}

export default function NotFoundPage({ title, message }: NotFoundPageProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100%"
      sx={{ bgcolor: 'background.default', p: 4 }}
    >
      <Box
        sx={{
          textAlign: 'center',
          maxWidth: 480,
          p: 6,
          borderRadius: '20px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.4)' : '0 24px 64px rgba(0,0,0,0.08)',
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 96, height: 96, borderRadius: '50%',
            bgcolor: alpha(gold, 0.1),
            border: `2px solid ${alpha(gold, 0.3)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mx: 'auto', mb: 3,
          }}
        >
          <SearchOffIcon sx={{ fontSize: 48, color: gold }} />
        </Box>

        {/* 404 */}
        <Typography
          sx={{
            fontSize: '5rem', fontWeight: 900, lineHeight: 1,
            color: gold, mb: 1, letterSpacing: '-4px',
            textShadow: isDark ? `0 0 40px ${alpha(gold, 0.4)}` : 'none',
          }}
        >
          404
        </Typography>

        <Typography variant="h5" fontWeight={700} mb={1.5}>
          {title || 'Not Found'}
        </Typography>

        <Typography variant="body2" color="text.secondary" mb={4} sx={{ lineHeight: 1.7 }}>
          {message || 'The resource you are looking for may have been deleted, moved, or never existed.'}
        </Typography>

        <Box display="flex" gap={1.5} justifyContent="center">
          <Button
            variant="outlined"
            onClick={() => navigate(-1)}
            sx={{ borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: gold, color: gold } }}
          >
            Go Back
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/projects')}
            sx={{ bgcolor: gold, color: '#000', fontWeight: 700, '&:hover': { bgcolor: alpha(gold, 0.85) } }}
          >
            All Projects
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
