import { getSecureItem, removeSecureItem, setSecureItem } from '../../../shared/storage/secureLocalStorage';

const KEY_AUTH_TOKEN = 'authToken';

export async function getAuthToken(): Promise<string | null> {
  return getSecureItem(KEY_AUTH_TOKEN);
}

export async function setAuthToken(token: string): Promise<void> {
  await setSecureItem(KEY_AUTH_TOKEN, token);
}

export async function clearAuthToken(): Promise<void> {
  await removeSecureItem(KEY_AUTH_TOKEN);
}
