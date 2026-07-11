import AsyncStorage from '@react-native-async-storage/async-storage';

export type ActiveProfileId = number | null;

type ActiveProfileListener = (id: ActiveProfileId) => void;
type VoidListener = () => void;

const activeProfileSubs = new Set<ActiveProfileListener>();
const profilesUpdatedSubs = new Set<VoidListener>();
const profileAvatarsUpdatedSubs = new Set<VoidListener>();

export function subscribeActiveProfileId(cb: ActiveProfileListener) {
  activeProfileSubs.add(cb);
  return () => {
    activeProfileSubs.delete(cb);
  };
}

export function emitActiveProfileId(id: ActiveProfileId) {
  for (const cb of Array.from(activeProfileSubs)) {
    try {
      cb(id);
    } catch {
      // ignore
    }
  }
}

export async function getActiveProfileId(): Promise<ActiveProfileId> {
  try {
    const stored = await AsyncStorage.getItem('activeProfileId');
    if (!stored) return null;
    const parsed = Number(stored);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function setActiveProfileId(id: ActiveProfileId) {
  if (id == null) {
    await AsyncStorage.removeItem('activeProfileId');
  } else {
    await AsyncStorage.setItem('activeProfileId', String(id));
  }
  emitActiveProfileId(id);
}

export function subscribeProfilesUpdated(cb: VoidListener) {
  profilesUpdatedSubs.add(cb);
  return () => {
    profilesUpdatedSubs.delete(cb);
  };
}

export function emitProfilesUpdated() {
  for (const cb of Array.from(profilesUpdatedSubs)) {
    try {
      cb();
    } catch {
      // ignore
    }
  }
}

export function subscribeProfileAvatarsUpdated(cb: VoidListener) {
  profileAvatarsUpdatedSubs.add(cb);
  return () => {
    profileAvatarsUpdatedSubs.delete(cb);
  };
}

export function emitProfileAvatarsUpdated() {
  for (const cb of Array.from(profileAvatarsUpdatedSubs)) {
    try {
      cb();
    } catch {
      // ignore
    }
  }
}

const trendsRefreshSubs = new Set<VoidListener>();

export function subscribeTrendsRefresh(cb: VoidListener) {
  trendsRefreshSubs.add(cb);
  return () => {
    trendsRefreshSubs.delete(cb);
  };
}

export function emitTrendsRefresh() {
  for (const cb of Array.from(trendsRefreshSubs)) {
    try {
      cb();
    } catch {
      // ignore
    }
  }
}
