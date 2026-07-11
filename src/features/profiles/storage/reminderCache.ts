import { getSecureItem, setSecureItem, removeSecureItem } from '../../../shared/storage/secureLocalStorage';

import type { ProfileReminder } from '../api/profileApi';

const KEY_PREFIX = 'remindersCache.v1.profile.';

export type CachedReminder = ProfileReminder & {
  local_only?: boolean;
};

function key(profileId: number) {
  return `${KEY_PREFIX}${profileId}`;
}

export function newLocalReminderId(): number {
  // negative IDs to avoid colliding with server IDs
  return -1 * (Date.now() + Math.floor(Math.random() * 1000));
}

export async function getCachedReminders(profileId: number): Promise<CachedReminder[]> {
  const raw = await getSecureItem(key(profileId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedReminders(profileId: number, reminders: CachedReminder[]): Promise<void> {
  await setSecureItem(key(profileId), JSON.stringify(reminders));
}

export async function addOrUpdateCachedReminder(profileId: number, reminder: CachedReminder): Promise<CachedReminder[]> {
  const existing = await getCachedReminders(profileId);
  const next = [...existing];
  const idx = next.findIndex((r) => Number(r.id) === Number(reminder.id));
  if (idx >= 0) next[idx] = { ...next[idx], ...reminder };
  else next.unshift(reminder);
  await setCachedReminders(profileId, next);
  return next;
}

export async function replaceCachedReminderId(
  profileId: number,
  oldId: number,
  newReminder: CachedReminder
): Promise<CachedReminder[]> {
  const existing = await getCachedReminders(profileId);
  const newId = Number(newReminder.id);
  const next = existing.filter((r) => Number(r.id) !== Number(oldId) && Number(r.id) !== newId);
  next.unshift({ ...newReminder, local_only: false });
  await setCachedReminders(profileId, next);
  return next;
}

export async function removeCachedReminder(profileId: number, reminderId: number): Promise<CachedReminder[]> {
  const existing = await getCachedReminders(profileId);
  const next = existing.filter((r) => Number(r.id) !== Number(reminderId));
  await setCachedReminders(profileId, next);
  return next;
}

export async function clearCachedReminders(profileId: number): Promise<void> {
  await removeSecureItem(key(profileId));
}
