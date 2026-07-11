export const API_BASE_URL = 'https://bpscaregiver.com';

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
