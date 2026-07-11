/**
 * persistedLiveReadings.ts
 *
 * Saves the most recent Temperature and SpO2 readings per profile to
 * EncryptedStorage so they survive app restarts.
 * (BP and Glucose are fetched from the server, so they don't need this.)
 */
import { getSecureItem, setSecureItem } from '../../../shared/storage/secureLocalStorage';

export interface PersistedLiveReadings {
  tempC?: number;
  tempTs?: number;
  spo2?: number;
  pulse?: number;
  spo2Ts?: number;
}

function storageKey(profileId: number): string {
  return `live_persist_v1_${profileId}`;
}

export async function savePersistedLiveReadings(
  profileId: number,
  data: PersistedLiveReadings,
): Promise<void> {
  try {
    const existing = await loadPersistedLiveReadings(profileId);
    await setSecureItem(storageKey(profileId), JSON.stringify({ ...existing, ...data }));
  } catch {
    // fail silently — this is a best-effort cache
  }
}

export async function loadPersistedLiveReadings(
  profileId: number,
): Promise<PersistedLiveReadings> {
  try {
    const raw = await getSecureItem(storageKey(profileId));
    if (!raw) return {};
    return JSON.parse(raw) as PersistedLiveReadings;
  } catch {
    return {};
  }
}

export async function clearPersistedLiveReadings(profileId: number): Promise<void> {
  try {
    const { removeSecureItem } = await import('../../../shared/storage/secureLocalStorage');
    await removeSecureItem(storageKey(profileId));
  } catch {}
}
