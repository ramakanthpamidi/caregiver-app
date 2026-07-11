import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_INSTALL_MARKER = '__install_marker_v1';

// Capture the ORIGINAL AsyncStorage methods at module load — before
// authTokenAsyncStoragePatch monkey-patches AsyncStorage to route secured keys
// back through getSecureItem. Using the originals here prevents infinite
// recursion (patched getItem -> getSecureItem -> AsyncStorage.getItem -> …).
const rawGetItem = AsyncStorage.getItem.bind(AsyncStorage);
const rawSetItem = AsyncStorage.setItem.bind(AsyncStorage);
const rawRemoveItem = AsyncStorage.removeItem.bind(AsyncStorage);

type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

let secureStore: SecureStoreModule | null | undefined;
let secureStoreUnavailable = false;

function getSecureStore(): SecureStoreModule | null {
  if (secureStoreUnavailable) return null;
  if (secureStore !== undefined) return secureStore;

  try {
    // Lazy require so missing native modules never crash route evaluation.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-secure-store') as SecureStoreModule;
    if (!mod?.getItemAsync || !mod?.setItemAsync || !mod?.deleteItemAsync) {
      secureStoreUnavailable = true;
      secureStore = null;
      return null;
    }
    secureStore = mod;
    return secureStore;
  } catch {
    secureStoreUnavailable = true;
    secureStore = null;
    return null;
  }
}

/**
 * expo-secure-store only allows alphanumeric, ".", "-", "_".
 * Map arbitrary app keys into a safe form while remaining stable.
 */
function toSecureStoreKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function runWithFallback<T>(
  secureFn: (store: SecureStoreModule) => Promise<T>,
  fallbackFn: () => Promise<T>,
): Promise<T> {
  const store = getSecureStore();
  if (!store) return fallbackFn();
  try {
    // Guard against a native secure-store call that never resolves (seen on some
    // New-Architecture builds) — if it stalls, fall back to AsyncStorage so app
    // launch and storage never hang.
    return await Promise.race<T>([
      secureFn(store),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('secure-store timeout')), 2500),
      ),
    ]);
  } catch {
    return fallbackFn();
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  const secureKey = toSecureStoreKey(key);
  return runWithFallback(
    async (store) => {
      const secureVal = await store.getItemAsync(secureKey);
      if (secureVal != null) return secureVal;

      const legacyVal = await rawGetItem(key);
      if (legacyVal != null) {
        try {
          await store.setItemAsync(secureKey, legacyVal);
          await rawRemoveItem(key);
        } catch {
          // keep legacy value if migration fails (e.g. value too large)
        }
      }
      return legacyVal;
    },
    () => rawGetItem(key),
  );
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  const secureKey = toSecureStoreKey(key);
  await runWithFallback(
    async (store) => {
      await store.setItemAsync(secureKey, value);
      await rawRemoveItem(key);
    },
    () => rawSetItem(key, value),
  );
}

export async function removeSecureItem(key: string): Promise<void> {
  const secureKey = toSecureStoreKey(key);
  await runWithFallback(
    async (store) => {
      await store.deleteItemAsync(secureKey);
      await rawRemoveItem(key);
    },
    () => rawRemoveItem(key),
  );
}

export async function multiRemoveSecureItems(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => removeSecureItem(key)));
}

export async function initializeSecureStorageForFreshInstall(): Promise<void> {
  try {
    const marker = await rawGetItem(KEY_INSTALL_MARKER);
    if (marker) return;

    // No bulk clear API equivalent is required for expo-secure-store;
    // keys are removed on logout / explicit multiRemove paths.
    await rawSetItem(KEY_INSTALL_MARKER, '1');
  } catch {
    // ignore init failures and let normal storage fallback behavior continue
  }
}
