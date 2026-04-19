import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import type { LoginCredentials, AuthUser } from '@/types/auth';

/** Decodes the JWT payload (no signature verification — Kong already validated it) */
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

export function useLogin() {
  const { setTokens, setUser } = useAuthStore();
  const addToast = useUIStore((s) => s.addToast);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess(data) {
      setTokens(data.access_token, data.refresh_token);
      try {
        setUser(decodePayload(data.access_token));
      } catch { /* token decode failed — user state left null, no crash */ }
      navigate('/dashboard');
    },
    onError() {
      addToast({ type: 'error', message: 'Invalid credentials. Please try again.' });
    },
  });
}
