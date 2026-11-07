import axios from 'axios';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from '@smartstudy/shared';
import { rawClient } from '../../../shared/api/client';

/**
 * Log in an existing user with email and password.
 * Uses rawClient to avoid triggering token refresh interceptors on auth endpoints.
 */
export async function loginUser(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await rawClient.post<AuthResponse>('/auth/login', credentials);
  return response.data;
}

/**
 * Register a new user with email and password.
 * Uses rawClient to avoid triggering token refresh interceptors on auth endpoints.
 */
export async function registerUser(credentials: RegisterRequest): Promise<AuthResponse> {
  const response = await rawClient.post<AuthResponse>('/auth/register', credentials);
  return response.data;
}

/**
 * Extract a user-friendly error message from an API or network error.
 */
export function parseAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Unable to connect to server. Please check your internet connection.';
    }

    const data = error.response.data as
      | { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
      | undefined;

    const code = data?.error?.code;
    const message = data?.error?.message;

    if (code === 'UNAUTHORIZED') {
      return 'Incorrect email or password. Please try again.';
    }

    if (code === 'VALIDATION_ERROR' && message) {
      return message;
    }

    if (code === 'RATE_LIMITED') {
      return 'Too many attempts. Please try again in a few moments.';
    }

    if (error.response.status === 409 || message?.toLowerCase().includes('already exists')) {
      return 'An account with this email already exists.';
    }

    if (message) {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}
