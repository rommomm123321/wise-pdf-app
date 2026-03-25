import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import SearchBar from '../search/SearchBar';

interface AppHeaderProps {
  onToggleSidebar: () => void;
}

export default function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const { user, logout, isImpersonating, stopImpersonating } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isExtraSmall = useMediaQuery('(max-width:450px)');
  const isDocView = location.pathname.includes('/documents/');
  const showBurger = isMobile || isDocView;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Impersonation banner */}
      {isImpersonating && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.drawer + 2,
          bgcolor: 'warning.main',
          color: 'warning.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          py: 0.5,
          px: 2,
        }}>
          <Typography variant="body2" fontWeight={600}>
            {t('impersonatingAs', 'Viewing as')}: {user?.name || user?.email}
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="inherit"
            startIcon={<ExitToAppIcon />}
            onClick={stopImpersonating}
            sx={{ color: 'warning.main', bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
          >
            {t('stopImpersonating', 'Back to admin')}
          </Button>
        </Box>
      )}

      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, top: isImpersonating ? '36px' : 0 }}>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
          {showBurger && (
            <IconButton color="inherit" edge="start" onClick={onToggleSidebar}>
              <MenuIcon />
            </IconButton>
          )}

          <Box
            sx={{ display: isExtraSmall ? 'none' : 'flex', alignItems: 'center', cursor: 'pointer', mr: 2, ml: 1, flexShrink: 0 }}
            onClick={() => navigate('/')}
          >
            <img src="https://wise-bim.com/logo-short.png" alt="Wise Logo" style={{ height: 32 }} />
          </Box>

          {!isExtraSmall && <SearchBar />}

          <Box sx={{ flexGrow: 1 }} />

          {/* Theme toggle */}
          <IconButton onClick={toggleTheme} color="inherit" size="small">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>

          {/* User menu */}
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: isImpersonating ? 'warning.main' : 'secondary.main', fontSize: '0.875rem' }}>
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled sx={{ opacity: '1 !important' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>{user?.name || user?.email}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.role?.name || user?.systemRole}</Typography>
              </Box>
            </MenuItem>
            {isImpersonating && (
              <MenuItem onClick={() => { setAnchorEl(null); stopImpersonating(); }}>
                <ExitToAppIcon fontSize="small" sx={{ mr: 1 }} />
                {t('stopImpersonating', 'Back to admin')}
              </MenuItem>
            )}
            {isExtraSmall && (
              <MenuItem onClick={() => navigate('/search')}>
                {t('search', 'Search')}
              </MenuItem>
            )}
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
    </>
  );
}
