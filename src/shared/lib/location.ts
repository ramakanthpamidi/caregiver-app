/**
 * GPS Location helper
 *
 * Provides a best-effort single-shot position fix for embedding lat/lng in
 * medical alert payloads.  Returns null coordinates if location cannot be
 * obtained (permission denied, timeout, library not installed, etc.).
 *
 * Requires: npm install @react-native-community/geolocation
 *           (auto-links on RN 0.60+; permissions already in manifests)
 */

import { Platform, PermissionsAndroid } from 'react-native';

export type LatLng = { lat: number; lng: number };

type GeoSuccess = (pos: { coords: { latitude: number; longitude: number } }) => void;
type GeoError   = (err?: any) => void;
type GeoOptions = { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number };
type GeoApi     = { getCurrentPosition: (s: GeoSuccess, e: GeoError, o?: GeoOptions) => void };

/** Timeout for a single position fix (ms). */
// const POSITION_TIMEOUT = 8000; // replaced by inline values below

let _cachedGeo: GeoApi | null | undefined; // undefined = not yet resolved

function resolveGeo(): GeoApi | null {
  if (_cachedGeo !== undefined) return _cachedGeo;
  // 1. Try @react-native-community/geolocation (install: npm install @react-native-community/geolocation)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-community/geolocation');
    const api: GeoApi = mod?.default ?? mod;
    if (typeof api?.getCurrentPosition === 'function') {
      console.log('[Location] Using @react-native-community/geolocation');
      _cachedGeo = api;
      return api;
    }
  } catch {
    console.warn('[Location] @react-native-community/geolocation not installed — run: npm install @react-native-community/geolocation && npx react-native run-android');
  }

  // 2. Fall back to navigator.geolocation (available in some RN versions)
  // eslint-disable-next-line no-undef
  const nav = (globalThis as any).navigator;
  if (nav && typeof nav.geolocation?.getCurrentPosition === 'function') {
    console.log('[Location] Using navigator.geolocation fallback');
    return nav.geolocation as GeoApi;
  }

  console.warn('[Location] No geolocation API available — location will be null');
  _cachedGeo = null;
  return null;
}

/**
 * Request location permission on Android (iOS uses Info.plist automatically).
 * Returns true if permission was granted.
 */
async function ensurePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    // Check if already granted (e.g. via the BLE permission flow)
    const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (already) return true;

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'This app needs your location for emergency medical alerts.',
        buttonPositive: 'OK',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Get the device's current GPS coordinates (best-effort).
 * Returns null if location is unavailable for any reason.
 */
export async function getCurrentPosition(): Promise<LatLng | null> {
  const geo = resolveGeo();
  if (!geo) return null;

  const permitted = await ensurePermission();
  if (!permitted) {
    console.warn('[Location] Location permission not granted');
    return null;
  }

  return new Promise<LatLng | null>((resolve) => {
    geo.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        console.log(`[Location] Got position: ${lat}, ${lng}`);
        resolve({ lat, lng });
      },
      (err) => {
        console.warn('[Location] getCurrentPosition error:', err);
        resolve(null);
      },
      {
        enableHighAccuracy: false,  // allow network/cell tower location (faster indoors)
        timeout: 15000,             // 15 s — more forgiving indoors
        maximumAge: 300000,         // accept a cached fix up to 5 min old (temperature/glucose readings don't need sub-minute precision)
      },
    );
  });
}
