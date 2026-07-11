import AsyncStorage from '@react-native-async-storage/async-storage';
import base64 from 'react-native-base64';
import { emitProfileAvatarsUpdated } from './profileEvents';

// NOTE: Avatars are stored locally and should persist across logout/login.
// To avoid collisions across accounts, we scope storage by authenticated user id (from JWT).
const KEY_PROFILE_AVATARS_LEGACY = 'profileAvatars.v2';
const KEY_DRAFT_PROFILE_AVATAR_LEGACY = 'draftProfileAvatar.v1';

const KEY_PROFILE_AVATARS_PREFIX = 'profileAvatars.v3.'; // + <userKey>
const KEY_DRAFT_PROFILE_AVATAR_PREFIX = 'draftProfileAvatar.v2.'; // + <userKey>

function base64UrlToBase64(input: string): string {
  const s = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 2) return s + '==';
  if (pad === 3) return s + '=';
  if (pad === 1) return s + '===';
  return s;
}

function getJwtPayload(token: string): any | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const payloadB64 = base64UrlToBase64(parts[1]);
    const json = base64.decode(payloadB64);
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function getUserKey(): Promise<string> {
  try {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return 'anon';
    const payload = getJwtPayload(token);
    const v = payload?.userId ?? payload?.id ?? payload?.sub;
    if (v === undefined || v === null) return 'anon';
    const s = String(v).trim();
    return s.length > 0 ? s : 'anon';
  } catch {
    return 'anon';
  }
}

async function getAvatarStorageKey(): Promise<string> {
  const userKey = await getUserKey();
  return `${KEY_PROFILE_AVATARS_PREFIX}${userKey}`;
}

async function getDraftStorageKey(): Promise<string> {
  const userKey = await getUserKey();
  return `${KEY_DRAFT_PROFILE_AVATAR_PREFIX}${userKey}`;
}

export type ProfileAvatar = {
  uri: string;
  // Transform values are applied to the image inside the circular crop.
  // These are stored so the user’s chosen framing (zoom/position) persists.
  scale?: number; // default 1
  tx?: number; // default 0
  ty?: number; // default 0  // Image dimensions (scaled to fit circle at scale=1)
  imgW?: number;
  imgH?: number;};

export type ProfileAvatarMap = Record<string, ProfileAvatar>; // profileId -> avatar config

function normalizeAvatar(value: unknown): ProfileAvatar | null {
  if (!value) return null;
  if (typeof value === 'string') {
    // Back-compat with v1 storage that saved only a string uri.
    return { uri: value, scale: 1, tx: 0, ty: 0 };
  }
  if (typeof value === 'object') {
    const v: any = value as any;
    if (typeof v.uri !== 'string' || !v.uri) return null;
    return {
      uri: v.uri,
      scale: typeof v.scale === 'number' ? v.scale : 1,
      tx: typeof v.tx === 'number' ? v.tx : 0,
      ty: typeof v.ty === 'number' ? v.ty : 0,
      imgW: typeof v.imgW === 'number' ? v.imgW : undefined,
      imgH: typeof v.imgH === 'number' ? v.imgH : undefined,
    };
  }
  return null;
}

async function getMap(): Promise<ProfileAvatarMap> {
  const key = await getAvatarStorageKey();
  const raw = await AsyncStorage.getItem(key);

  // One-time migration: if the scoped key is empty but legacy key exists, copy it.
  if (!raw) {
    try {
      const legacy = await AsyncStorage.getItem(KEY_PROFILE_AVATARS_LEGACY);
      if (legacy) {
        await AsyncStorage.setItem(key, legacy);
        // Keep legacy data so we don't risk losing anything.
        // (Optional cleanup can be done later once migration is verified.)
      }
    } catch {
      // ignore
    }
  }

  const effectiveRaw = raw || (await AsyncStorage.getItem(key));
  if (!effectiveRaw) return {};
  try {
    const parsed = JSON.parse(effectiveRaw);
    if (!parsed || typeof parsed !== 'object') return {};

    const out: ProfileAvatarMap = {};
    for (const [k2, v2] of Object.entries(parsed as any)) {
      const normalized = normalizeAvatar(v2);
      if (normalized) out[String(k2)] = normalized;
    }
    return out;
  } catch {
    return {};
  }
}

async function setMap(map: ProfileAvatarMap): Promise<void> {
  const key = await getAvatarStorageKey();
  await AsyncStorage.setItem(key, JSON.stringify(map));
}

export async function getAllProfileAvatars(): Promise<ProfileAvatarMap> {
  return await getMap();
}

export async function getProfileAvatar(profileId: number): Promise<ProfileAvatar | null> {
  const map = await getMap();
  const v = map[String(profileId)];
  return v ? v : null;
}

export async function setProfileAvatar(profileId: number, avatar: ProfileAvatar | null): Promise<void> {
  const map = await getMap();
  const key = String(profileId);

  if (!avatar) {
    if (key in map) {
      delete map[key];
      await setMap(map);
      emitProfileAvatarsUpdated();
    }
    return;
  }

  map[key] = {
    uri: avatar.uri,
    scale: typeof avatar.scale === 'number' ? avatar.scale : 1,
    tx: typeof avatar.tx === 'number' ? avatar.tx : 0,
    ty: typeof avatar.ty === 'number' ? avatar.ty : 0,
    imgW: typeof avatar.imgW === 'number' ? avatar.imgW : undefined,
    imgH: typeof avatar.imgH === 'number' ? avatar.imgH : undefined,
  };
  await setMap(map);
  emitProfileAvatarsUpdated();
}

export async function migrateProfileAvatarId(oldProfileId: number, newProfileId: number): Promise<void> {
  const map = await getMap();
  const oldKey = String(oldProfileId);
  const newKey = String(newProfileId);

  if (!(oldKey in map)) return;

  map[newKey] = map[oldKey];
  delete map[oldKey];
  await setMap(map);
  emitProfileAvatarsUpdated();
}

export async function getDraftProfileAvatar(): Promise<ProfileAvatar | null> {
  const key = await getDraftStorageKey();
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    // One-time migration from legacy draft key.
    try {
      const legacy = await AsyncStorage.getItem(KEY_DRAFT_PROFILE_AVATAR_LEGACY);
      if (legacy) {
        await AsyncStorage.setItem(key, legacy);
      }
    } catch {
      // ignore
    }
  }

  const effectiveRaw = raw || (await AsyncStorage.getItem(key));
  if (!effectiveRaw) return null;
  try {
    return normalizeAvatar(JSON.parse(effectiveRaw));
  } catch {
    // Back-compat if it was stored as a raw uri string.
    return normalizeAvatar(effectiveRaw);
  }
}

export async function setDraftProfileAvatar(avatar: ProfileAvatar | null): Promise<void> {
  const key = await getDraftStorageKey();
  if (!avatar) {
    await AsyncStorage.removeItem(key);
    return;
  }

  const normalized = normalizeAvatar(avatar);
  if (!normalized) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, JSON.stringify(normalized));
}
