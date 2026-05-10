import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

/**
 * Wraps any route that requires authentication.
 * If the user is not authenticated, redirects to /login.
 * Preserves the attempted URL so we can redirect back after login.
 */
export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
