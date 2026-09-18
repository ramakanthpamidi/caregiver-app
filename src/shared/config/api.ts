import { Platform } from 'react-native';

/**
 * Production API host.
 */
const PROD_API_BASE_URL = 'https://bpscaregiver.com';

/**
 * Local Laravel backend (see backend/README.md).
 * - Android emulator → host machine via 10.0.2.2
 * - iOS simulator / web → 127.0.0.1
 * - Physical device: set EXPO_PUBLIC_API_HOST to your PC LAN IP (e.g. 192.168.1.20)
 * - Remote / tunneled API: include the port (e.g. 157.85.102.79:8085)
 */
function localApiBaseUrl(): string {
  const host =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_HOST) ||
    (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1');

  if (host.startsWith('http://') || host.startsWith('https://')) {
    return host.replace(/\/$/, '');
  }

  // Host already has a port — do not append the Laravel default :8000.
  if (/:\d+$/.test(host) || /^\[[^\]]+\]:\d+$/.test(host)) {
    return `http://${host}`;
  }

  return `http://${host}:8000`;
}

const LOCAL_API_BASE_URL = localApiBaseUrl();

/**
 * Dev builds use the local Laravel API; release builds use production.
 * Override anytime with EXPO_PUBLIC_API_BASE_URL.
 */
export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL) ||
  (__DEV__ ? LOCAL_API_BASE_URL : PROD_API_BASE_URL);

/**
 * Build a full API URL from a path.
 * - Accepts `/auth/login` or `auth/login`
 * - Passes through fully-qualified URLs unchanged
 */
export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const prefix = path.startsWith('/') ? '' : '/';
  return `${API_BASE_URL}${prefix}${path}`;
}
