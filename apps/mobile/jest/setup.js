/* eslint-env jest */

// In-memory store for react-native-keychain mock
let mockKeychainStore = {};

jest.mock('react-native-keychain', () => {
  return {
    SECURITY_LEVEL: {
      ANY: 'ANY',
      SECURE_SOFTWARE: 'SECURE_SOFTWARE',
      SECURE_HARDWARE: 'SECURE_HARDWARE',
    },
    ACCESSIBLE: {
      WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
      AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock',
      ALWAYS: 'AccessibleAlways',
      WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'AccessibleWhenPasscodeSetThisDeviceOnly',
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly',
      ALWAYS_THIS_DEVICE_ONLY: 'AccessibleAlwaysThisDeviceOnly',
    },
    ACCESS_CONTROL: {
      USER_PRESENCE: 'UserPresence',
      BIOMETRY_ANY: 'BiometryAny',
      BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
      DEVICE_PASSCODE: 'DevicePasscode',
      APPLICATION_PASSWORD: 'ApplicationPassword',
      BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BiometryAnyOrDevicePasscode',
      BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE: 'BiometryCurrentSetOrDevicePasscode',
    },
    AUTHENTICATION_TYPE: {
      DEVICE_PASSCODE_OR_BIOMETRICS: 'AuthenticationTypeDevicePasscodeOrBiometrics',
      BIOMETRICS: 'AuthenticationTypeBiometrics',
    },
    setGenericPassword: jest.fn(async (username, password, options = {}) => {
      const service = options.service || 'default';
      mockKeychainStore[service] = { username, password, service };
      return { service, storage: 'mock' };
    }),
    getGenericPassword: jest.fn(async (options = {}) => {
      const service = options.service || 'default';
      if (!mockKeychainStore[service]) {
        return false;
      }
      return { ...mockKeychainStore[service] };
    }),
    resetGenericPassword: jest.fn(async (options = {}) => {
      const service = options.service || 'default';
      delete mockKeychainStore[service];
      return true;
    }),
    hasGenericPassword: jest.fn(async (options = {}) => {
      const service = options.service || 'default';
      return Boolean(mockKeychainStore[service]);
    }),
    // Test helper to clear store between tests
    __resetMockKeychain: () => {
      mockKeychainStore = {};
    },
  };
});
