import { getSecureItem, setSecureItem, removeSecureItem } from '../../../shared/storage/secureLocalStorage';

import type { ProfileGoal } from '../api/profileApi';

const KEY_PREFIX = 'goalsCache.v1.profile.';

export type CachedGoal = ProfileGoal & {
  local_only?: boolean;
};

function key(profileId: number) {
  return `${KEY_PREFIX}${profileId}`;
}

export function newLocalGoalId(): number {
  return -1 * (Date.now() + Math.floor(Math.random() * 1000));
}

export async function getCachedGoals(profileId: number): Promise<CachedGoal[]> {
  const raw = await getSecureItem(key(profileId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedGoals(profileId: number, goals: CachedGoal[]): Promise<void> {
  await setSecureItem(key(profileId), JSON.stringify(goals));
}

export async function addOrUpdateCachedGoal(profileId: number, goal: CachedGoal): Promise<CachedGoal[]> {
  const existing = await getCachedGoals(profileId);
  const next = [...existing];
  const idx = next.findIndex((g) => Number(g.id) === Number(goal.id));
  if (idx >= 0) next[idx] = { ...next[idx], ...goal };
  else next.unshift(goal);
  await setCachedGoals(profileId, next);
  return next;
}

export async function replaceCachedGoalId(profileId: number, oldId: number, newGoal: CachedGoal): Promise<CachedGoal[]> {
  const existing = await getCachedGoals(profileId);
  const newId = Number(newGoal.id);
  const next = existing.filter((g) => Number(g.id) !== Number(oldId) && Number(g.id) !== newId);
  next.unshift({ ...newGoal, local_only: false });
  await setCachedGoals(profileId, next);
  return next;
}

export async function removeCachedGoal(profileId: number, goalId: number): Promise<CachedGoal[]> {
  const existing = await getCachedGoals(profileId);
  const next = existing.filter((g) => Number(g.id) !== Number(goalId));
  await setCachedGoals(profileId, next);
  return next;
}

export async function clearCachedGoals(profileId: number): Promise<void> {
  await removeSecureItem(key(profileId));
}
