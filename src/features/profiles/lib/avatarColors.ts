/**
 * Generate a consistent avatar color based on profile name.
 * This ensures the same profile always gets the same color across all components.
 * Colors are stored in AsyncStorage for persistence.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import base64 from 'react-native-base64';

const AVATAR_COLORS = [
  '#3B82F6', // Blue
  '#F59E0B', // Orange
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#EF4444', // Red
  '#6366F1', // Indigo
];

const STORAGE_KEY_LEGACY = 'profileAvatarColors.v1';
const STORAGE_KEY_PREFIX = 'profileAvatarColors.v2.'; // + <userKey>

let cachedStorageKey: string | null = null;
let cachedColorMap: Record<string, string> | null = null;

export function getCachedAvatarColor(profileId: number | string): string | null {
  if (!cachedColorMap) return null;
  const v = cachedColorMap[String(profileId)];
  return typeof v === 'string' && v.startsWith('#') ? v : null;
}

export async function primeAvatarColorCache(): Promise<void> {
  try {
    const storageKey = await getStorageKey();
    let raw = await AsyncStorage.getItem(storageKey);

    // One-time migration: if scoped key is empty but legacy key exists, copy it.
    if (!raw) {
      try {
        const legacy = await AsyncStorage.getItem(STORAGE_KEY_LEGACY);
        if (legacy) {
          await AsyncStorage.setItem(storageKey, legacy);
          raw = legacy;
        }
      } catch {
        // ignore
      }
    }

    cachedStorageKey = storageKey;
    cachedColorMap = raw ? JSON.parse(raw) : {};
  } catch {
    // If caching fails, just leave cache empty.
  }
}

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

async function getStorageKey(): Promise<string> {
  const userKey = await getUserKey();
  return `${STORAGE_KEY_PREFIX}${userKey}`;
}

/**
 * Get a stable hash from a string.
 * Uses a simple hash algorithm to convert string to number.
 */
function stringToHash(str: string): number {
  let hash = 0;
  const normalized = String(str || '').trim().toLowerCase();
  
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash);
}

/**
 * Get consistent avatar color for a profile name.
 * Same name will always return the same color.
 * 
 * @param profileName - The profile label/name
 * @returns Hex color string (e.g., '#3B82F6')
 */
export function getAvatarColorForProfile(profileName: string): string {
  const hash = stringToHash(profileName);
  const index = hash % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Get a random avatar color.
 * Intended for new profile creation, then persisted via saveAvatarColor.
 */
export function getRandomAvatarColor(): string {
  const index = Math.floor(Math.random() * AVATAR_COLORS.length);
  return AVATAR_COLORS[index];
}

/**
 * Get or retrieve saved avatar color for a profile ID.
 * If no color is saved, generates one based on name and saves it.
 * This ensures consistent colors across sessions.
 * 
 * @param profileId - The profile ID
 * @param profileName - The profile label/name (used for generation if no saved color)
 * @returns Promise<string> - Hex color string
 */
export async function getSavedAvatarColor(profileId: number | string, profileName: string): Promise<string> {
  try {
    const storageKey = await getStorageKey();
    let raw = await AsyncStorage.getItem(storageKey);
    
    // One-time migration: if scoped key is empty but legacy key exists, copy it.
    if (!raw) {
      try {
        const legacy = await AsyncStorage.getItem(STORAGE_KEY_LEGACY);
        if (legacy) {
          await AsyncStorage.setItem(storageKey, legacy);
          raw = legacy;
        }
      } catch {
        // ignore
      }
    }
    
    const colorMap: Record<string, string> = raw ? JSON.parse(raw) : {};
    const key = String(profileId);
    
    // If color exists and is valid, return it
    if (colorMap[key] && typeof colorMap[key] === 'string' && colorMap[key].startsWith('#')) {
      cachedStorageKey = storageKey;
      cachedColorMap = colorMap;
      return colorMap[key];
    }
    
    // Generate new color based on name
    const newColor = getAvatarColorForProfile(profileName);
    
    // Save for future use
    colorMap[key] = newColor;
    await AsyncStorage.setItem(storageKey, JSON.stringify(colorMap));

    cachedStorageKey = storageKey;
    cachedColorMap = colorMap;
    
    return newColor;
  } catch (error) {
    // Fallback to hash-based color if storage fails
    console.warn('Failed to get/save avatar color:', error);
    return getAvatarColorForProfile(profileName);
  }
}

/**
 * Save a specific color for a profile ID.
 * Useful when creating a new profile.
 * 
 * @param profileId - The profile ID
 * @param color - The hex color to save
 */
export async function saveAvatarColor(profileId: number | string, color: string): Promise<void> {
  try {
    const storageKey = await getStorageKey();
    const raw = await AsyncStorage.getItem(storageKey);
    const colorMap: Record<string, string> = raw ? JSON.parse(raw) : {};
    colorMap[String(profileId)] = color;
    await AsyncStorage.setItem(storageKey, JSON.stringify(colorMap));

    cachedStorageKey = storageKey;
    cachedColorMap = colorMap;
  } catch (error) {
    console.warn('Failed to save avatar color:', error);
  }
}

/**
 * Get initials from a name (up to 2 characters).
 * 
 * @param name - Profile name
 * @returns Initials (e.g., 'JD' for 'John Doe')
 */
export function getInitialsFromName(name: string): string {
  const s = String(name || '').trim();
  if (!s) return 'NA';
  
  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const second = (parts[1]?.[0] || parts[0]?.[1] || '');
  const initials = `${first}${second}`.toUpperCase();
  
  return initials || 'NA';
}
