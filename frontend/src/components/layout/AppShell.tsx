import { useState, useEffect } from 'react';
import { Box, Toolbar, useTheme, useMediaQuery } from '@mui/material';
import { useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import { SIDEBAR_WIDTH } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);
  const { isImpersonating } = useAuth();
  const location = useLocation();

  // Detect if we are on the DocumentViewPage
  const isDocView = location.pathname.includes('/documents/');

  // Sync sidebar state when screen size changes
  useEffect(() => {
    setSidebarOpen(isDesktop);
  }, [isDesktop]);

  return (
    <Box sx={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      pt: isImpersonating ? '36px' : 0
    }}>
      <AppHeader onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: isDocView ? 'hidden' : 'auto',
          bgcolor: 'background.default',
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          marginLeft: 0,
          ...(isDesktop && isDocView && sidebarOpen && {
            width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
            transition: theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.easeOut,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }),
        }}
      >
        <Toolbar /> {/* Spacer for fixed AppBar */}
        <Box sx={{
          p: isDocView ? 0 : 2,
          flexGrow: 1,
          overflow: isDocView ? 'hidden' : 'visible',
          display: isDocView ? 'flex' : 'block',
          flexDirection: isDocView ? 'column' : 'unset',
          width: '100%'
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
