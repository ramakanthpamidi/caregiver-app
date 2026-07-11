import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfileConsents, type ProfileConsentsPayload } from '../../profiles/api/profileApi';

const CACHE_PREFIX = 'profileConsentsCache.v1.';
const MIN_REFRESH_INTERVAL_MS = 5_000;

type Listener = (profileId: number, consents: ProfileConsentsPayload | null) => void;

const consentsByProfile = new Map<number, ProfileConsentsPayload>();
const listeners = new Set<Listener>();
const inFlight = new Map<number, Promise<ProfileConsentsPayload | null>>();
const lastRefreshAt = new Map<number, number>();

function emit(profileId: number, consents: ProfileConsentsPayload | null) {
  for (const cb of Array.from(listeners)) {
    try {
      cb(profileId, consents);
    } catch {
      // ignore
    }
  }
}

export function getProfileConsentsSnapshot(profileId: number): ProfileConsentsPayload | null {
  return consentsByProfile.get(profileId) ?? null;
}

export function subscribeProfileConsents(profileId: number, cb: (consents: ProfileConsentsPayload | null) => void): () => void {
  const wrapper: Listener = (id, consents) => {
    if (id !== profileId) return;
    cb(consents);
  };

  // fire immediately
  try {
    cb(getProfileConsentsSnapshot(profileId));
  } catch {
    // ignore
  }

  listeners.add(wrapper);
  return () => {
    listeners.delete(wrapper);
  };
}

export async function hydrateProfileConsentsFromCache(profileId: number): Promise<ProfileConsentsPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${profileId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // Trust payload shape; it came from our own write.
    consentsByProfile.set(profileId, parsed as ProfileConsentsPayload);
    emit(profileId, parsed as ProfileConsentsPayload);
    return parsed as ProfileConsentsPayload;
  } catch {
    return null;
  }
}

export async function setProfileConsentsSnapshot(profileId: number, consents: ProfileConsentsPayload | null): Promise<void> {
  if (consents) {
    consentsByProfile.set(profileId, consents);
    try {
      await AsyncStorage.setItem(`${CACHE_PREFIX}${profileId}`, JSON.stringify(consents));
    } catch {
      // ignore cache failure
    }
  } else {
    consentsByProfile.delete(profileId);
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${profileId}`);
    } catch {
      // ignore cache failure
    }
  }

  emit(profileId, consents);
}

export async function refreshProfileConsents(profileId: number, opts?: { force?: boolean }): Promise<ProfileConsentsPayload | null> {
  if (!Number.isFinite(profileId) || profileId <= 0) return null;

  const now = Date.now();
  const last = lastRefreshAt.get(profileId) ?? 0;
  if (!opts?.force && now - last < MIN_REFRESH_INTERVAL_MS) {
    return getProfileConsentsSnapshot(profileId);
  }

  const existing = inFlight.get(profileId);
  if (existing) return existing;

  const p = (async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return getProfileConsentsSnapshot(profileId);

      const consents = await getProfileConsents(token, profileId);
      if (consents) {
        lastRefreshAt.set(profileId, Date.now());
        await setProfileConsentsSnapshot(profileId, consents);
        return consents;
      }
      return getProfileConsentsSnapshot(profileId);
    } catch {
      return getProfileConsentsSnapshot(profileId);
    } finally {
      inFlight.delete(profileId);
    }
  })();

  inFlight.set(profileId, p);
  return p;
}
