import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { LoginPage }           from '@/pages/LoginPage';
import { SetPasswordPage }     from '@/pages/SetPasswordPage';
import { DashboardPage }       from '@/pages/DashboardPage';
import { DocumentsPage }       from '@/pages/DocumentsPage';
import { DocumentDetailPage }  from '@/pages/DocumentDetailPage';
import { UploadPage }          from '@/pages/UploadPage';
import { ProfilePage }         from '@/pages/ProfilePage';
import { ObservabilityPage }   from '@/pages/ObservabilityPage';
import { ActivityPage }        from '@/pages/ActivityPage';
import { UsersPage }           from '@/pages/UsersPage';
import { AdminPage }           from '@/pages/AdminPage';

export const router = createBrowserRouter([
  /* Public */
  {
    path:    '/login',
    element: <LoginPage />,
  },
  {
    path:    '/set-password',
    element: <SetPasswordPage />,
  },

  /* Protected shell */
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true,              element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard',        element: <DashboardPage /> },
          { path: 'documents',        element: <DocumentsPage /> },
          { path: 'documents/upload', element: <UploadPage /> },
          { path: 'documents/:id',    element: <DocumentDetailPage /> },
          { path: 'users',            element: <UsersPage /> },
          { path: 'admin',            element: <AdminPage /> },
          { path: 'observability',    element: <ObservabilityPage /> },
          { path: 'activity',         element: <ActivityPage /> },
          { path: 'profile',          element: <ProfilePage /> },
        ],
      },
    ],
  },

  /* Fallback */
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
