import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import AppShell from './AppShell';
import NoAccessPage from '../../pages/NoAccessPage';

// Routes that require admin privileges (GENERAL_ADMIN or company Admin role)
const ADMIN_ONLY_PATHS = ['/users', '/audit-logs'];

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Unassigned user splash screen intervention
  if (!user.companyId && user.systemRole !== 'GENERAL_ADMIN') {
    return <NoAccessPage />;
  }

  // Check admin-only routes
  const isAdminPath = ADMIN_ONLY_PATHS.some(p => location.pathname.startsWith(p));
  if (isAdminPath) {
    const isGeneralAdmin = user.systemRole === 'GENERAL_ADMIN';
    const isCompanyAdmin = user.role?.name === 'Admin';
    if (!isGeneralAdmin && !isCompanyAdmin) {
      return <Navigate to="/projects" replace />;
    }
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
