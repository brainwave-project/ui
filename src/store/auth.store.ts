import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types/auth';

interface AuthState {
  accessToken:  string | null;
  refreshToken: string | null;
  user:         AuthUser | null;
  isAuthenticated: boolean;

  setTokens(accessToken: string, refreshToken: string): void;
  setUser(user: AuthUser): void;
  logout(): void;
}

/**
 * Auth store — persisted to localStorage under key 'bw_auth'.
 *
 * NOTE: Storing tokens in localStorage is acceptable for an upskilling project.
 * In production, access tokens should be in memory and refresh tokens in
 * httpOnly cookies (requires a BFF or cookie-aware proxy layer).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken:     null,
      refreshToken:    null,
      user:            null,
      isAuthenticated: false,

      setTokens(accessToken, refreshToken) {
        set({ accessToken, refreshToken, isAuthenticated: true });
      },

      setUser(user) {
        set({ user });
      },

      logout() {
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'bw_auth',
      partialize: (state) => ({
        accessToken:     state.accessToken,
        refreshToken:    state.refreshToken,
        user:            state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
