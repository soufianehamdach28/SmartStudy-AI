import { create } from 'zustand';
import type { UserProfile } from '@smartstudy/shared';
import {
  apiClient,
  onSessionExpired,
} from '../../../shared/api/client';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
} from '../../../shared/lib/token-storage';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  user: UserProfile | null;
  status: AuthStatus;
  error: string | null;

  loadSession: () => Promise<void>;
  setAuth: (user: UserProfile) => void;
  logout: () => Promise<void>;
  handleSessionExpired: () => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  loadSession: async () => {
    set({ status: 'loading', error: null });

    try {
      const accessToken = await getAccessToken();
      const refreshToken = await getRefreshToken();

      // If neither token is present, we are definitely unauthenticated
      if (!accessToken && !refreshToken) {
        set({ user: null, status: 'unauthenticated' });
        return;
      }

      // Fetch user profile; if accessToken is expired, apiClient interceptor will rotate it
      const response = await apiClient.get<UserProfile>('/me');
      set({ user: response.data, status: 'authenticated', error: null });
    } catch (err) {
      // If fetching /me or token rotation fails, purge tokens and set unauthenticated
      await clearTokens();
      set({ user: null, status: 'unauthenticated' });
    }
  },

  setAuth: (user: UserProfile) => {
    set({ user, status: 'authenticated', error: null });
  },

  logout: async () => {
    set({ status: 'loading' });

    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        // Attempt revocation on backend
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Ignore network / server failure on logout
    } finally {
      await clearTokens();
      set({ user: null, status: 'unauthenticated', error: null });
    }
  },

  handleSessionExpired: () => {
    set({ user: null, status: 'unauthenticated', error: null });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));

// Automatically reset store when the refresh interceptor detects expired/revoked session
onSessionExpired(() => {
  useAuthStore.getState().handleSessionExpired();
});
