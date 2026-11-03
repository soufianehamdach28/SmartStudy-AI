import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import {
  apiClient,
  rawClient,
  onSessionExpired,
  __resetRefreshState,
} from './client';
import * as tokenStorage from '../lib/token-storage';

describe('apiClient', () => {
  beforeEach(async () => {
    __resetRefreshState();
    jest.clearAllMocks();
    await tokenStorage.clearTokens();
  });

  const createAxiosResponse = (
    config: InternalAxiosRequestConfig,
    status = 200,
    data: unknown = { ok: true },
  ): AxiosResponse => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config,
  });

  const createAxiosError = (
    config: InternalAxiosRequestConfig,
    status: number,
    data: unknown,
  ): AxiosError => {
    const error = new AxiosError(
      `Request failed with status code ${status}`,
      status === 401 ? 'ERR_BAD_REQUEST' : 'ERR_BAD_RESPONSE',
      config,
      null,
      {
        status,
        statusText: 'Error',
        headers: {},
        config,
        data,
      } as AxiosResponse,
    );
    return error;
  };

  describe('Request Interceptor', () => {
    it('injects Authorization Bearer header when access token is present', async () => {
      await tokenStorage.saveTokens({
        accessToken: 'valid-access-token',
        refreshToken: 'valid-refresh-token',
      });

      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = jest.fn(async (config) => {
        capturedConfig = config;
        return createAxiosResponse(config);
      });

      await apiClient.get('/test-endpoint');

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig?.headers.Authorization).toBe('Bearer valid-access-token');
    });

    it('does not inject Authorization header when no access token exists', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = jest.fn(async (config) => {
        capturedConfig = config;
        return createAxiosResponse(config);
      });

      await apiClient.get('/public-endpoint');

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig?.headers.Authorization).toBeUndefined();
    });

    it('preserves existing custom Authorization header', async () => {
      await tokenStorage.saveTokens({
        accessToken: 'stored-token',
        refreshToken: 'stored-refresh',
      });

      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = jest.fn(async (config) => {
        capturedConfig = config;
        return createAxiosResponse(config);
      });

      await apiClient.get('/custom-auth', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });

      expect(capturedConfig?.headers.Authorization).toBe('Basic dXNlcjpwYXNz');
    });
  });

  describe('Response Interceptor & Token Refresh', () => {
    it('returns successful response unchanged', async () => {
      apiClient.defaults.adapter = jest.fn(async (config) => {
        return createAxiosResponse(config, 200, { message: 'hello' });
      });

      const res = await apiClient.get('/hello');
      expect(res.data).toEqual({ message: 'hello' });
    });

    it('refreshes token on 401 TOKEN_EXPIRED and retries the original request', async () => {
      await tokenStorage.saveTokens({
        accessToken: 'expired-access-token',
        refreshToken: 'valid-refresh-token',
      });

      let callCount = 0;
      apiClient.defaults.adapter = jest.fn(async (config) => {
        callCount++;
        if (callCount === 1) {
          throw createAxiosError(config, 401, {
            error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' },
          });
        }
        return createAxiosResponse(config, 200, { data: 'success after refresh' });
      });

      const refreshSpy = jest.spyOn(rawClient, 'post').mockResolvedValueOnce({
        data: {
          tokens: {
            accessToken: 'fresh-access-token',
            refreshToken: 'fresh-refresh-token',
            tokenType: 'Bearer',
            expiresIn: 900,
          },
          user: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'student@example.com',
            role: 'STUDENT',
            createdAt: new Date().toISOString(),
          },
        },
      });

      const res = await apiClient.get('/protected-resource');

      expect(refreshSpy).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'valid-refresh-token',
      });
      expect(res.data).toEqual({ data: 'success after refresh' });

      // Verify new tokens saved to secure storage
      const updatedTokens = await tokenStorage.getTokens();
      expect(updatedTokens?.accessToken).toBe('fresh-access-token');
      expect(updatedTokens?.refreshToken).toBe('fresh-refresh-token');
    });

    it('queues concurrent requests during refresh and replays all with the new token', async () => {
      await tokenStorage.saveTokens({
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token',
      });

      let req1Attempt = 0;
      let req2Attempt = 0;

      apiClient.defaults.adapter = jest.fn(async (config) => {
        if (config.url === '/endpoint-1') {
          req1Attempt++;
          if (req1Attempt === 1) {
            throw createAxiosError(config, 401, {
              error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
            });
          }
          return createAxiosResponse(config, 200, { result: 'one' });
        }
        if (config.url === '/endpoint-2') {
          req2Attempt++;
          if (req2Attempt === 1) {
            throw createAxiosError(config, 401, {
              error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
            });
          }
          return createAxiosResponse(config, 200, { result: 'two' });
        }
        return createAxiosResponse(config);
      });

      const refreshSpy = jest.spyOn(rawClient, 'post').mockImplementationOnce(async () => {
        // Small delay to ensure request 2 arrives while request 1 is refreshing
        await new Promise((resolve) => setTimeout(() => resolve(undefined), 30));
        return {
          data: {
            tokens: {
              accessToken: 'new-token-batch',
              refreshToken: 'new-refresh-batch',
              tokenType: 'Bearer',
              expiresIn: 900,
            },
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'batch@example.com',
              role: 'STUDENT',
              createdAt: new Date().toISOString(),
            },
          },
        } as AxiosResponse;
      });

      // Fire both requests concurrently
      const [res1, res2] = await Promise.all([
        apiClient.get('/endpoint-1'),
        apiClient.get('/endpoint-2'),
      ]);

      // Exactly ONE refresh request should have occurred
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(res1.data).toEqual({ result: 'one' });
      expect(res2.data).toEqual({ result: 'two' });
    });

    it('clears tokens and notifies session expiration when refresh fails', async () => {
      await tokenStorage.saveTokens({
        accessToken: 'expired-token',
        refreshToken: 'revoked-refresh-token',
      });

      const sessionExpiredHandler = jest.fn();
      const unsubscribe = onSessionExpired(sessionExpiredHandler);

      apiClient.defaults.adapter = jest.fn(async (config) => {
        throw createAxiosError(config, 401, {
          error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
        });
      });

      jest.spyOn(rawClient, 'post').mockRejectedValueOnce(
        createAxiosError({} as InternalAxiosRequestConfig, 401, {
          error: { code: 'UNAUTHORIZED', message: 'Refresh token revoked' },
        }),
      );

      await expect(apiClient.get('/fail-endpoint')).rejects.toThrow();

      // Tokens should be cleared and listener called
      expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);
      const storedTokens = await tokenStorage.getTokens();
      expect(storedTokens).toBeNull();

      unsubscribe();
    });

    it('rejects without refreshing if error is 401 UNAUTHORIZED (e.g. wrong password)', async () => {
      const refreshSpy = jest.spyOn(rawClient, 'post');

      apiClient.defaults.adapter = jest.fn(async (config) => {
        throw createAxiosError(config, 401, {
          error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        });
      });

      await expect(apiClient.post('/auth/login', {})).rejects.toThrow();
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('does not retry infinitely if retried request still returns 401 TOKEN_EXPIRED', async () => {
      await tokenStorage.saveTokens({
        accessToken: 'expired-1',
        refreshToken: 'refresh-1',
      });

      let attempts = 0;
      apiClient.defaults.adapter = jest.fn(async (config) => {
        attempts++;
        throw createAxiosError(config, 401, {
          error: { code: 'TOKEN_EXPIRED', message: 'Still expired' },
        });
      });

      jest.spyOn(rawClient, 'post').mockResolvedValue({
        data: {
          tokens: {
            accessToken: 'expired-2',
            refreshToken: 'refresh-2',
            tokenType: 'Bearer',
            expiresIn: 900,
          },
          user: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'loop@example.com',
            role: 'STUDENT',
            createdAt: new Date().toISOString(),
          },
        },
      } as AxiosResponse);

      await expect(apiClient.get('/still-failing')).rejects.toThrow();
      // Original call + exactly 1 retry
      expect(attempts).toBe(2);
    });
  });
});
