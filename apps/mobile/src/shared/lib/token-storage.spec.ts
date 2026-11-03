import * as Keychain from 'react-native-keychain';
import {
  saveTokens,
  getTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  AUTH_KEYCHAIN_SERVICE,
} from './token-storage';

describe('token-storage', () => {
  const mockTokens = {
    accessToken: 'test-access-token-jwt',
    refreshToken: 'test-refresh-token-uuid',
  };

  beforeEach(async () => {
    // Reset mock keychain storage before each test
    const mock = Keychain as unknown as { __resetMockKeychain?: () => void };
    if (mock.__resetMockKeychain) {
      mock.__resetMockKeychain();
    }
    jest.clearAllMocks();
  });

  describe('saveTokens', () => {
    it('saves valid tokens to keychain successfully', async () => {
      await saveTokens(mockTokens);

      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
        'auth_tokens',
        JSON.stringify(mockTokens),
        { service: AUTH_KEYCHAIN_SERVICE },
      );

      const stored = await getTokens();
      expect(stored).toEqual(mockTokens);
    });

    it('throws when accessToken is empty or missing', async () => {
      await expect(
        saveTokens({ accessToken: '', refreshToken: 'valid-refresh' }),
      ).rejects.toThrow('Both accessToken and refreshToken must be provided and non-empty.');
    });

    it('throws when refreshToken is empty or missing', async () => {
      await expect(
        saveTokens({ accessToken: 'valid-access', refreshToken: '' }),
      ).rejects.toThrow('Both accessToken and refreshToken must be provided and non-empty.');
    });

    it('throws when Keychain.setGenericPassword returns false', async () => {
      jest.spyOn(Keychain, 'setGenericPassword').mockResolvedValueOnce(false);

      await expect(saveTokens(mockTokens)).rejects.toThrow(
        'Failed to save authentication tokens to secure storage.',
      );
    });
  });

  describe('getTokens', () => {
    it('returns null when no tokens are stored', async () => {
      const tokens = await getTokens();
      expect(tokens).toBeNull();
    });

    it('returns parsed tokens when stored correctly', async () => {
      await saveTokens(mockTokens);
      const tokens = await getTokens();
      expect(tokens).toEqual(mockTokens);
    });

    it('returns null if stored password is corrupted JSON', async () => {
      jest.spyOn(Keychain, 'getGenericPassword').mockResolvedValueOnce({
        service: AUTH_KEYCHAIN_SERVICE,
        username: 'auth_tokens',
        password: 'corrupted-non-json-data',
      } as Keychain.UserCredentials);

      const tokens = await getTokens();
      expect(tokens).toBeNull();
    });

    it('returns null if stored JSON has missing properties', async () => {
      jest.spyOn(Keychain, 'getGenericPassword').mockResolvedValueOnce({
        service: AUTH_KEYCHAIN_SERVICE,
        username: 'auth_tokens',
        password: JSON.stringify({ accessToken: 'only-access' }),
      } as Keychain.UserCredentials);

      const tokens = await getTokens();
      expect(tokens).toBeNull();
    });

    it('returns null if Keychain.getGenericPassword throws an exception', async () => {
      jest.spyOn(Keychain, 'getGenericPassword').mockRejectedValueOnce(
        new Error('Keystore hardware failure'),
      );

      const tokens = await getTokens();
      expect(tokens).toBeNull();
    });
  });

  describe('getAccessToken and getRefreshToken', () => {
    it('returns accessToken string when tokens exist', async () => {
      await saveTokens(mockTokens);
      const token = await getAccessToken();
      expect(token).toBe(mockTokens.accessToken);
    });

    it('returns refreshToken string when tokens exist', async () => {
      await saveTokens(mockTokens);
      const token = await getRefreshToken();
      expect(token).toBe(mockTokens.refreshToken);
    });

    it('returns null when tokens do not exist', async () => {
      expect(await getAccessToken()).toBeNull();
      expect(await getRefreshToken()).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('removes stored tokens completely', async () => {
      await saveTokens(mockTokens);
      expect(await getTokens()).toEqual(mockTokens);

      await clearTokens();

      expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
        service: AUTH_KEYCHAIN_SERVICE,
      });
      expect(await getTokens()).toBeNull();
    });

    it('does not throw even if resetGenericPassword throws', async () => {
      jest.spyOn(Keychain, 'resetGenericPassword').mockRejectedValueOnce(
        new Error('Failed to reset'),
      );

      await expect(clearTokens()).resolves.toBeUndefined();
    });
  });
});
