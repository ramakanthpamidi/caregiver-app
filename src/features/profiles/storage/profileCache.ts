import { getSecureItem, setSecureItem, removeSecureItem } from '../../../shared/storage/secureLocalStorage';
import type { ProfileSummary } from '../api/profileApi';

const KEY_PROFILES_CACHE = 'profilesCache.v1';

export type CachedProfile = ProfileSummary & {
  local_only?: boolean;
};

export async function getCachedProfiles(): Promise<CachedProfile[]> {
  const raw = await getSecureItem(KEY_PROFILES_CACHE);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function setCachedProfiles(profiles: CachedProfile[]): Promise<void> {
  await setSecureItem(KEY_PROFILES_CACHE, JSON.stringify(profiles));
}

export function normalizeLabelForCompare(label: string): string {
  return String(label || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export async function addOrUpdateCachedProfile(profile: CachedProfile): Promise<CachedProfile[]> {
  const existing = await getCachedProfiles();
  const next = [...existing];

  const idx = next.findIndex((p) => Number(p.id) === Number(profile.id));
  if (idx >= 0) next[idx] = { ...next[idx], ...profile };
  else next.push(profile);

  // Keep deterministic ordering: created_at asc if present.
  next.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  await setCachedProfiles(next);
  return next;
}

export async function replaceCachedProfileId(oldId: number, newProfile: CachedProfile): Promise<CachedProfile[]> {
  const existing = await getCachedProfiles();
  const next = existing
    .filter((p) => Number(p.id) !== Number(oldId))
    .concat([{ ...newProfile, local_only: false }]);

  next.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  await setCachedProfiles(next);
  return next;
}

export async function hasDuplicateProfileLabel(label: string): Promise<boolean> {
  const want = normalizeLabelForCompare(label);
  if (!want) return false;
  const profiles = await getCachedProfiles();
  return profiles.some((p) => normalizeLabelForCompare(p.profile_label) === want);
}

export async function removeCachedProfile(profileId: number): Promise<CachedProfile[]> {
  const profiles = await getCachedProfiles();
  const next = profiles.filter((p) => Number(p.id) !== Number(profileId));
  await setCachedProfiles(next);
  return next;
}
