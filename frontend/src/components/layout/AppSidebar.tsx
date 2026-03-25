import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Box,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import BusinessIcon from '@mui/icons-material/Business';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import FolderTreeView from '../filemanager/FolderTreeView';
import { SIDEBAR_WIDTH } from '../../constants';

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function AppSidebar({ open, onClose }: AppSidebarProps) {
  const { user, isImpersonating } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md')); // md is 1024px
  const isDocView = location.pathname.includes('/documents/');
  const { projectId } = useParams<{ projectId?: string }>();

  // Check if we're inside a project route
  const inProject = location.pathname.startsWith('/projects/');
  const currentProjectId = projectId || (inProject ? location.pathname.split('/')[2] : undefined);

  const handleNav = (path: string) => {
    navigate(path);
    if (!isDesktop) onClose();
  };

  const isProjects = location.pathname === '/' || location.pathname.startsWith('/projects');
  const isUsersPage = location.pathname === '/users';
  const isAuditPage = location.pathname === '/audit-logs';
  const isAdmin = user?.systemRole === 'GENERAL_ADMIN' || user?.role?.name === 'Admin';

  const content = (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        bgcolor: 'background.paper',
        // Custom Scrollbar for the whole sidebar
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          borderRadius: '10px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        },
      }}
    >
      <Toolbar /> {/* Spacer for AppBar */}

      {/* Main nav */}
      <List sx={{ px: 1, py: 1 }}>
        {user?.systemRole === 'GENERAL_ADMIN' && (
          <ListItemButton
            selected={location.pathname === '/companies'}
            onClick={() => handleNav('/companies')}
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}><BusinessIcon /></ListItemIcon>
            <ListItemText primary={t('companies', 'Companies')} primaryTypographyProps={{ fontSize: '0.875rem' }} />
          </ListItemButton>
        )}

        <ListItemButton
          selected={isProjects}
          onClick={() => handleNav('/projects')}
          sx={{ borderRadius: 2, mb: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}><FolderSpecialIcon /></ListItemIcon>
          <ListItemText primary={t('projects')} primaryTypographyProps={{ fontSize: '0.875rem' }} />
        </ListItemButton>

        {isAdmin && (
          <ListItemButton
            selected={isUsersPage}
            onClick={() => handleNav('/users')}
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}><PeopleIcon /></ListItemIcon>
            <ListItemText primary={t('users')} primaryTypographyProps={{ fontSize: '0.875rem' }} />
          </ListItemButton>
        )}
        {isAdmin && (
          <ListItemButton
            selected={isAuditPage}
            onClick={() => handleNav('/audit-logs')}
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}><HistoryIcon /></ListItemIcon>
            <ListItemText primary={t('auditLogs', 'Audit Logs')} primaryTypographyProps={{ fontSize: '0.875rem' }} />
          </ListItemButton>
        )}
      </List>

      {/* Folder tree when inside a project */}
      {currentProjectId && (
        <Box 
          sx={{ 
            flex: 1, 
            overflowY: 'auto', 
            overflowX: 'hidden',
            px: 1,
            mt: 1,
            // Custom Scrollbar
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: '10px',
              transition: 'background 0.2s',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
            },
          }}
        >
          <FolderTreeView projectId={currentProjectId} onNavigate={!isDesktop ? onClose : undefined} />
        </Box>
      )}
    </Box>
  );

  // 1. Mobile variant (Drawer)
  if (!isDesktop) {
    return (
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        sx={{ 
          '& .MuiDrawer-paper': { 
            width: SIDEBAR_WIDTH,
            top: isImpersonating ? '36px' : 0,
            height: isImpersonating ? 'calc(100% - 36px)' : '100%',
          } 
        }}
        ModalProps={{ keepMounted: true }}
      >
        {content}
      </Drawer>
    );
  }

  // 2. Desktop PDF view variant (Persistent toggleable)
  if (isDocView) {
    return (
      <Box
        sx={{
          width: open ? SIDEBAR_WIDTH : 0,
          flexShrink: 0,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Drawer
          variant="persistent"
          open={open}
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { 
              width: SIDEBAR_WIDTH,
              boxSizing: 'border-box',
              top: isImpersonating ? '36px' : 0,
              height: isImpersonating ? 'calc(100% - 36px)' : '100%',
            },
          }}
        >
          {content}
        </Drawer>
      </Box>
    );
  }

  // 3. Desktop standard variant (Permanent)
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': { 
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
          top: isImpersonating ? '36px' : 0,
          height: isImpersonating ? 'calc(100% - 36px)' : '100%',
        },
      }}
    >
      {content}
    </Drawer>
  );
}
