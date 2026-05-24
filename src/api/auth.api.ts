import axios from 'axios';
import type { TokenResponse, LoginCredentials, SetPasswordRequest } from '@/types/auth';

// Auth calls bypass the interceptor (no Bearer token yet)
const plainClient = axios.create({ baseURL: '/api', timeout: 15_000 });

export const authApi = {
  /**
   * Direct grant — exchanges username/password for tokens.
   * Kong routes POST /api/auth/login → AuthHub.
   */
  login(credentials: LoginCredentials): Promise<TokenResponse> {
    return plainClient
      .post<TokenResponse>('/auth/login', credentials)
      .then((r) => r.data);
  },

  logout(idTokenHint?: string): Promise<void> {
    return plainClient
      .post('/auth/logout', idTokenHint ? { id_token_hint: idTokenHint } : {})
      .then(() => undefined);
  },

  refresh(refreshToken: string): Promise<TokenResponse> {
    return plainClient
      .post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken })
      .then((r) => r.data);
  },

  /**
   * Sets a permanent password for a user that logged in with a temporary one.
   * Backend uses Keycloak Admin API to update the password, then auto-logs in
   * and returns fresh tokens — the frontend lands straight on the dashboard.
   */
  setPassword(req: SetPasswordRequest): Promise<TokenResponse> {
    return plainClient
      .post<TokenResponse>('/auth/set-password', req)
      .then((r) => r.data);
  },
};
