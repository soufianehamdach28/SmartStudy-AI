import * as Keychain from 'react-native-keychain';

export const AUTH_KEYCHAIN_SERVICE = 'com.smartstudy.auth';
const AUTH_KEYCHAIN_USERNAME = 'auth_tokens';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Persists both access and refresh tokens securely in Keychain (iOS) / Keystore (Android).
 * Storing them together under a single service ensures atomic write operations.
 */
export async function saveTokens(tokens: AuthTokens): Promise<void> {
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw new Error('Both accessToken and refreshToken must be provided and non-empty.');
  }

  const payload = JSON.stringify({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });

  const result = await Keychain.setGenericPassword(AUTH_KEYCHAIN_USERNAME, payload, {
    service: AUTH_KEYCHAIN_SERVICE,
  });

  if (!result) {
    throw new Error('Failed to save authentication tokens to secure storage.');
  }
}

/**
 * Retrieves the stored tokens from secure storage.
 * Returns null if no tokens are found or if the payload is corrupted/unreadable.
 */
export async function getTokens(): Promise<AuthTokens | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: AUTH_KEYCHAIN_SERVICE,
    });

    if (!credentials || !credentials.password) {
      return null;
    }

    const parsed = JSON.parse(credentials.password);
    if (
      typeof parsed?.accessToken === 'string' &&
      typeof parsed?.refreshToken === 'string' &&
      parsed.accessToken.length > 0 &&
      parsed.refreshToken.length > 0
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      };
    }

    return null;
  } catch {
    // If decryption or JSON parsing fails, treat as missing tokens
    return null;
  }
}

/**
 * Helper to retrieve only the access token.
 */
export async function getAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  return tokens?.accessToken ?? null;
}

/**
 * Helper to retrieve only the refresh token.
 */
export async function getRefreshToken(): Promise<string | null> {
  const tokens = await getTokens();
  return tokens?.refreshToken ?? null;
}

/**
 * Clears all authentication tokens from secure storage (e.g. on logout or invalid refresh).
 */
export async function clearTokens(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({
      service: AUTH_KEYCHAIN_SERVICE,
    });
  } catch {
    // Suppress error if already cleared or reset fails
  }
}
