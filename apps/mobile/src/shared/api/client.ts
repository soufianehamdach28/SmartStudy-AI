import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_PREFIX, type AuthResponse, type ErrorCode } from '@smartstudy/shared';
import { config } from '../lib/config';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '../lib/token-storage';

export interface CustomRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export type SessionExpiredListener = () => void;

let sessionExpiredListeners: SessionExpiredListener[] = [];
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

/**
 * Register a listener invoked when a token refresh fails and the user session expires.
 * Returns an unregister function.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.push(listener);
  return () => {
    sessionExpiredListeners = sessionExpiredListeners.filter((l) => l !== listener);
  };
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  }
}

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

/**
 * Test helper to reset refresh queue state between unit tests.
 */
export function __resetRefreshState(): void {
  isRefreshing = false;
  failedQueue = [];
  sessionExpiredListeners = [];
}

export const API_BASE_URL = `${config.apiBaseUrl}${API_PREFIX}`;

/**
 * Un-intercepted axios client used strictly for token refresh to avoid recursive interceptor calls.
 */
export const rawClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Main application API client with automatic token injection and refresh rotation handling.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor: Inject Bearer token from secure storage
apiClient.interceptors.request.use(
  async (reqConfig) => {
    const token = await getAccessToken();
    if (token && !reqConfig.headers.Authorization) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: Handle 401 TOKEN_EXPIRED with concurrency-safe refresh queue
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: { code?: ErrorCode; message?: string } }>) => {
    const originalRequest = error.config as CustomRequestConfig | undefined;

    const isTokenExpired =
      error.response?.status === 401 &&
      error.response?.data?.error?.code === 'TOKEN_EXPIRED';

    // If not a token expiration error or no request config, propagate error
    if (!isTokenExpired || !originalRequest) {
      return Promise.reject(error);
    }

    // Do not retry more than once per request to avoid infinite loops
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    // If a refresh is already in progress, enqueue this request until the refresh settles
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        })
        .catch((queueErr) => Promise.reject(queueErr));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const currentRefreshToken = await getRefreshToken();
      if (!currentRefreshToken) {
        throw new Error('No refresh token available');
      }

      const refreshResponse = await rawClient.post<AuthResponse>('/auth/refresh', {
        refreshToken: currentRefreshToken,
      });

      const newTokens = refreshResponse.data.tokens;
      await saveTokens({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      });

      // Flush queue with the new access token
      processQueue(null, newTokens.accessToken);

      // Replay the original failed request
      originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      await clearTokens();
      notifySessionExpired();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
