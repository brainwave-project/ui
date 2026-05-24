import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import type { SetPasswordRequest, AuthUser } from '@/types/auth';

/** Decodes the JWT payload (no signature check — Kong already validated it). */
function decodePayload(token: string): AuthUser {
  const base64 = token.split('.')[1]!;
  const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
  const payload = JSON.parse(json) as Record<string, unknown>;
  return {
    sub:   payload['sub'] as string,
    email: (payload['email'] ?? payload['preferred_username'] ?? '') as string,
    roles: ((payload['realm_access'] as { roles?: string[] } | undefined)?.roles ?? []),
    exp:   payload['exp'] as number,
  };
}

/**
 * Mutation hook for the set-password flow.
 *
 * On success: stores fresh tokens, decodes user, toasts, navigates to /dashboard.
 * On error:   shows an error toast.
 */
export function useSetPassword() {
  const { setTokens, setUser } = useAuthStore();
  const addToast = useUIStore((s) => s.addToast);
  const navigate  = useNavigate();

  return useMutation({
    mutationFn: (req: SetPasswordRequest) => authApi.setPassword(req),

    onSuccess(data) {
      setTokens(data.access_token, data.refresh_token);
      try {
        setUser(decodePayload(data.access_token));
      } catch { /* ignore decode errors — user state stays null */ }
      addToast({ type: 'success', message: 'Password set. Welcome to Brainwave!' });
      navigate('/dashboard');
    },

    onError() {
      addToast({ type: 'error', message: 'Failed to set password. Please try again.' });
    },
  });
}
