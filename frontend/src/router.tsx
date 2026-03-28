import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectPage from './pages/ProjectPage';
import UsersPage from './pages/UsersPage';
import InvitePage from './pages/InvitePage';
import DocumentViewPage from './pages/DocumentViewPage';
import AuditLogPage from './pages/AuditLogPage';
import CompaniesPage from './pages/CompaniesPage';
import GlobalErrorBoundary from './components/layout/GlobalErrorBoundary';
import NotFoundPage from './pages/NotFoundPage';

import { useAuth } from './contexts/AuthContext';

function IndexRedirect() {
  const { user } = useAuth();
  if (user?.systemRole === 'GENERAL_ADMIN') {
    return <Navigate to="/companies" replace />;
  }
  return <Navigate to="/projects" replace />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <GlobalErrorBoundary />,
  },
  // Public route — invitation acceptance
  {
    path: '/invite/:token',
    element: <InvitePage />,
  },
  {
    element: <ProtectedRoute />,
    errorElement: <GlobalErrorBoundary />,
    children: [
      { path: '/', element: <IndexRedirect /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/projects/:projectId', element: <ProjectPage /> },
      { path: '/projects/:projectId/folders/:folderId', element: <ProjectPage /> },
      { path: '/projects/:projectId/documents/:documentId', element: <DocumentViewPage /> },
      { path: '/users', element: <UsersPage /> },
      { path: '/audit-logs', element: <AuditLogPage /> },
      { path: '/companies', element: <CompaniesPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
