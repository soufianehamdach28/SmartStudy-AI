import type { UserProfile } from '@smartstudy/shared';
import { useAuthStore } from './auth.store';
import { apiClient } from '../../../shared/api/client';
import * as tokenStorage from '../../../shared/lib/token-storage';

describe('useAuthStore', () => {
  const mockUser: UserProfile = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: 'student@example.com',
    role: 'STUDENT',
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStorage.clearTokens();
    useAuthStore.setState({ user: null, status: 'idle', error: null });
  });

  it('starts with initial idle state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });

  describe('loadSession', () => {
    it('sets status to unauthenticated when no tokens are stored', async () => {
      await useAuthStore.getState().loadSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
      expect(state.user).toBeNull();
    });

    it('sets status to authenticated when tokens exist and /me succeeds', async () => {
      await tokenStorage.saveTokens({
        accessToken: 'valid-access-token',
        refreshToken: 'valid-refresh-token',
      });

      jest.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockUser,
      });

      await useAuthStore.getState().loadSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.user).toEqual(mockUser);
      expect(apiClient.get).toHaveBeenCalledWith('/me');
    });

    it('clears tokens and sets unauthenticated when /me fails', async () => {
      await tokenStorage.saveTokens({
        accessToken: 'bad-access-token',
        refreshToken: 'bad-refresh-token',
      });

      jest.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Unauthorized'));
      const clearTokensSpy = jest.spyOn(tokenStorage, 'clearTokens');

      await useAuthStore.getState().loadSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
      expect(state.user).toBeNull();
      expect(clearTokensSpy).toHaveBeenCalled();
    });
  });

  describe('setAuth', () => {
    it('updates user and sets status to authenticated', () => {
      useAuthStore.getState().setAuth(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.status).toBe('authenticated');
      expect(state.error).toBeNull();
    });
  });

  describe('logout', () => {
    it('calls /auth/logout with refreshToken, clears tokens, and sets unauthenticated', async () => {
      useAuthStore.setState({ user: mockUser, status: 'authenticated' });
      await tokenStorage.saveTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({});
      const clearSpy = jest.spyOn(tokenStorage, 'clearTokens');

      await useAuthStore.getState().logout();

      expect(postSpy).toHaveBeenCalledWith('/auth/logout', {
        refreshToken: 'refresh-token',
      });
      expect(clearSpy).toHaveBeenCalled();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.status).toBe('unauthenticated');
    });

    it('still clears tokens and sets unauthenticated even if /auth/logout network call fails', async () => {
      useAuthStore.setState({ user: mockUser, status: 'authenticated' });
      await tokenStorage.saveTokens({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      jest.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Network error'));
      const clearSpy = jest.spyOn(tokenStorage, 'clearTokens');

      await useAuthStore.getState().logout();

      expect(clearSpy).toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.status).toBe('unauthenticated');
    });
  });

  describe('handleSessionExpired', () => {
    it('resets user to null and status to unauthenticated', () => {
      useAuthStore.setState({ user: mockUser, status: 'authenticated' });

      useAuthStore.getState().handleSessionExpired();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.status).toBe('unauthenticated');
    });
  });
});
