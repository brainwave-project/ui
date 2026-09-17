import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
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
import { GovernancePage }      from '@/pages/GovernancePage';
import { ActivityPage }        from '@/pages/ActivityPage';
import { UsersPage }           from '@/pages/UsersPage';
import { AdminPage }           from '@/pages/AdminPage';
import { EvaluationLayout }        from '@/pages/evaluation/EvaluationLayout';
import { DatasetConstructionPage } from '@/pages/evaluation/DatasetConstructionPage';
import { DataLabPage }             from '@/pages/evaluation/DataLabPage';
import { RetrievalEvalPage }       from '@/pages/evaluation/RetrievalEvalPage';
import { ExperimentsPage }         from '@/pages/evaluation/ExperimentsPage';
import { StatsLabPage }            from '@/pages/evaluation/StatsLabPage';
import { LearningPathPage }        from '@/pages/evaluation/LearningPathPage';

/**
 * Evaluation — backed by the standalone Eval Lab API on the lean eval stack.
 *
 * That stack deliberately has no Keycloak, Kong or auth-hub, so nobody can log in
 * while it runs. In development the section is therefore reachable without a
 * session; in a production build it sits behind ProtectedRoute like everything
 * else (and its API does not exist there at all).
 */
const evaluationRoute: RouteObject = {
  path: 'evaluation',
  element: <EvaluationLayout />,
  children: [
    { index: true,          element: <Navigate to="/evaluation/dataset" replace /> },
    { path: 'dataset',      element: <DatasetConstructionPage /> },
    { path: 'dataset/:datasetId', element: <DatasetConstructionPage /> },
    { path: 'data-lab',     element: <DataLabPage /> },
    { path: 'retrieval',    element: <RetrievalEvalPage /> },
    { path: 'experiments',  element: <ExperimentsPage /> },
    { path: 'stats',        element: <StatsLabPage /> },
    { path: 'learn',        element: <LearningPathPage /> },
  ],
};

const EVAL_WITHOUT_LOGIN = import.meta.env.DEV;

export const router = createBrowserRouter([
  /* Public */
  { path: '/login',        element: <LoginPage /> },
  { path: '/set-password', element: <SetPasswordPage /> },

  /* Evaluation without a session — dev builds only (see note above) */
  ...(EVAL_WITHOUT_LOGIN ? [{ element: <AppLayout />, children: [evaluationRoute] }] : []),

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

          ...(EVAL_WITHOUT_LOGIN ? [] : [evaluationRoute]),

          /* Document detail + upload (shared by Know Ops Documents) */
          { path: 'documents/upload', element: <UploadPage /> },
          { path: 'documents/:id',    element: <DocumentDetailPage /> },

          /* Back-compat redirects for old top-level routes */
          { path: 'search',    element: <Navigate to="/know-ops/retrieval" replace /> },
          { path: 'chat',      element: <Navigate to="/know-ops/chat" replace /> },
          { path: 'documents', element: <Navigate to="/know-ops/documents" replace /> },

          /* Platform */
          { path: 'users',             element: <UsersPage /> },
          { path: 'admin',             element: <AdminPage /> },
          { path: 'governance',        element: <GovernancePage /> },
          { path: 'observability',     element: <ObservabilityPage /> },
          { path: 'activity',          element: <ActivityPage /> },
          { path: 'profile',           element: <ProfilePage /> },

          /* LLM Traces was folded into Observability → LLMs */
          { path: 'llm-observability', element: <Navigate to="/observability" replace /> },
        ],
      },
    ],
  },

  /* Fallback */
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
