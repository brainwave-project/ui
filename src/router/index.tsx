import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { LoginPage }           from '@/pages/LoginPage';
import { SetPasswordPage }     from '@/pages/SetPasswordPage';
import { DashboardPage }       from '@/pages/DashboardPage';
import { DocumentDetailPage }  from '@/pages/DocumentDetailPage';
import { ChatPage }            from '@/pages/ChatPage';
import { UploadPage }          from '@/pages/UploadPage';
import { IngestionPage }       from '@/pages/knowops/IngestionPage';
import { RetrievalLabPage }    from '@/pages/knowops/RetrievalLabPage';
import { KnowDocumentsPage }   from '@/pages/knowops/KnowDocumentsPage';
import { ProfilePage }         from '@/pages/ProfilePage';
import { ObservabilityPage }   from '@/pages/ObservabilityPage';
import { LLMObservabilityPage } from '@/pages/LLMObservabilityPage';
import { ActivityPage }        from '@/pages/ActivityPage';
import { UsersPage }           from '@/pages/UsersPage';
import { AdminPage }           from '@/pages/AdminPage';

export const router = createBrowserRouter([
  /* Public */
  { path: '/login',        element: <LoginPage /> },
  { path: '/set-password', element: <SetPasswordPage /> },

  /* Protected shell */
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },

          /* Know Ops — the full RAG operations surface */
          { path: 'know-ops',            element: <Navigate to="/know-ops/retrieval" replace /> },
          { path: 'know-ops/ingestion',  element: <IngestionPage /> },
          { path: 'know-ops/retrieval',  element: <RetrievalLabPage /> },
          { path: 'know-ops/documents',  element: <KnowDocumentsPage /> },
          { path: 'know-ops/chat',       element: <ChatPage /> },

          /* Document detail + upload (shared by Know Ops Documents) */
          { path: 'documents/upload', element: <UploadPage /> },
          { path: 'documents/:id',    element: <DocumentDetailPage /> },

          /* Back-compat redirects for old top-level routes */
          { path: 'search',    element: <Navigate to="/know-ops/retrieval" replace /> },
          { path: 'chat',      element: <Navigate to="/know-ops/chat" replace /> },
          { path: 'documents', element: <Navigate to="/know-ops/documents" replace /> },

          { path: 'users',             element: <UsersPage /> },
          { path: 'admin',             element: <AdminPage /> },
          { path: 'observability',     element: <ObservabilityPage /> },
          { path: 'llm-observability', element: <LLMObservabilityPage /> },
          { path: 'activity',          element: <ActivityPage /> },
          { path: 'profile',           element: <ProfilePage /> },
        ],
      },
    ],
  },

  /* Fallback */
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
