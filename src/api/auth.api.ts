import axios from 'axios';
import type { TokenResponse, LoginCredentials } from '@/types/auth';

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
};
