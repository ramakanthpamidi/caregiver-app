export const API_BASE_URL = 'http://157.85.102.79:8085';

function joinUrl(base: string, path: string): string {
  if (!path) return base;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const prefix = path.startsWith('/') ? '' : '/';
  return `${base}${prefix}${path}`;
}

/**
 * Build a full API URL from a path.
 * - Accepts `/auth/login` or `auth/login`
 * - Passes through fully-qualified URLs unchanged
 */
export function apiUrl(path: string): string {
  return joinUrl(API_BASE_URL, path);
}

export function authApiUrl(path: string): string {
  return apiUrl(path);
}
