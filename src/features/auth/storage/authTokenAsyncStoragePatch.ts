import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSecureItem,
  multiRemoveSecureItems,
  removeSecureItem,
  setSecureItem,
} from '../../../shared/storage/secureLocalStorage';

const AUTH_TOKEN_KEY = 'authToken';
const ACTIVE_PROFILE_ID_KEY = 'activeProfileId';
const PENDING_PROFILE_CONSENTS_KEY = 'pendingProfileConsents.v1';

const SECURE_KEYS = new Set<string>([
  AUTH_TOKEN_KEY,
  ACTIVE_PROFILE_ID_KEY,
  PENDING_PROFILE_CONSENTS_KEY,
]);

const SECURE_KEY_PREFIXES = [
  'profileConsentsCache.v1.',
  'profilePasswordAttempts.v1.',
];

const observedSecureKeys = new Set<string>(SECURE_KEYS);

function shouldSecureKey(key: string): boolean {
  if (SECURE_KEYS.has(key)) return true;
  for (const prefix of SECURE_KEY_PREFIXES) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

function rememberSecureKey(key: string): void {
  if (shouldSecureKey(key)) {
    observedSecureKeys.add(key);
  }
}

let installed = false;

export function installAuthTokenAsyncStoragePatch(): void {
  if (installed) return;
  installed = true;

  const originalGetItem = AsyncStorage.getItem.bind(AsyncStorage);
  const originalSetItem = AsyncStorage.setItem.bind(AsyncStorage);
  const originalRemoveItem = AsyncStorage.removeItem.bind(AsyncStorage);
  const originalMultiRemove = AsyncStorage.multiRemove.bind(AsyncStorage);
  const originalClear = AsyncStorage.clear.bind(AsyncStorage);

  AsyncStorage.getItem = (async (key: string, ...rest: any[]) => {
    if (!shouldSecureKey(key)) {
      return originalGetItem(key, ...rest);
    }
    rememberSecureKey(key);
    return getSecureItem(key);
  }) as typeof AsyncStorage.getItem;

  AsyncStorage.setItem = (async (key: string, value: string, ...rest: any[]) => {
    if (!shouldSecureKey(key)) {
      return originalSetItem(key, value, ...rest);
    }
    rememberSecureKey(key);
    return setSecureItem(key, value);
  }) as typeof AsyncStorage.setItem;

  AsyncStorage.removeItem = (async (key: string, ...rest: any[]) => {
    if (!shouldSecureKey(key)) {
      return originalRemoveItem(key, ...rest);
    }
    rememberSecureKey(key);
    return removeSecureItem(key);
  }) as typeof AsyncStorage.removeItem;

  AsyncStorage.multiRemove = (async (keys: readonly string[], ...rest: any[]) => {
    const list = Array.isArray(keys) ? keys.map((key) => String(key)) : [];
    const secureKeys = list.filter((key) => shouldSecureKey(key));
    for (const key of secureKeys) rememberSecureKey(key);
    if (secureKeys.length > 0) {
      await multiRemoveSecureItems(secureKeys);
    }
    // multiRemoveSecureItems already clears AsyncStorage copies for secure keys;
    // still clear any remaining non-secure keys via original path.
    const nonSecure = list.filter((key) => !shouldSecureKey(key));
    if (nonSecure.length === 0) return;
    return originalMultiRemove(nonSecure as string[], ...rest);
  }) as typeof AsyncStorage.multiRemove;

  AsyncStorage.clear = (async (...rest: any[]) => {
    await multiRemoveSecureItems(Array.from(observedSecureKeys));
    return originalClear(...rest);
  }) as typeof AsyncStorage.clear;
}
