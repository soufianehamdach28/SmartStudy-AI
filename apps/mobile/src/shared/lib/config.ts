/**
 * Public, non-secret configuration for the mobile app.
 * Never put API keys or other secrets here: the mobile bundle is public.
 *
 * Development API host — change this one line when your network changes:
 *   - physical phone over Wi-Fi : your computer's LAN IP (run `hostname -I`)
 *   - Android emulator          : 10.0.2.2 (alias for the host machine)
 *   - iOS simulator             : localhost
 */
const DEV_API_HOST = '192.168.1.244';

export const config = {
  apiBaseUrl: __DEV__
    ? `http://${DEV_API_HOST}:3000`
    : 'https://api.smartstudy.example',
} as const;
