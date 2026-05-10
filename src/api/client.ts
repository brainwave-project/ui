import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

/**
 * Axios base instance — all requests go through Kong (/api prefix).
 * In dev, Vite proxies /api → Kong (see vite.config.ts).
 * In prod, the app is served from the same origin as Kong.
 */
export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ── Request interceptor — attach Bearer token ─────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// ── Response interceptor — handle 401 → refresh → retry ──────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.set('Authorization', `Bearer ${token}`);
          return apiClient(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return apiClient(original);
      } catch (err) {
        processQueue(err, null);
        clearSession();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ── Token helpers ─────────────────────────────────────────────────────────

function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, setTokens } = useAuthStore.getState();
  if (!refreshToken) throw new Error('No refresh token');

  const res = await axios.post<{ access_token: string; refresh_token: string }>(
    '/api/auth/refresh',
    { refresh_token: refreshToken },
  );

  const { access_token, refresh_token } = res.data;
  setTokens(access_token, refresh_token);
  return access_token;
}

function clearSession() {
  useAuthStore.getState().logout();
}
