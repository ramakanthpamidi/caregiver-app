import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MeasurementKind = 'spo2' | 'bp' | 'temp' | 'glucose' | 'battery' | 'unknown';

export type LiveReading = {
  kind: MeasurementKind;
  text: string;
  ts: number;
  values?: Record<string, number>;
};

type DeviceReadings = Partial<Record<MeasurementKind, LiveReading>>;

const readingsByDevice = new Map<string, DeviceReadings>();
const listeners = new Set<() => void>();

// --- persistence: keep the last real readings across reload/restart, like the
// weight/BMI card does. Only genuine readings reach setLiveReading (the fake
// "0/0" placeholder seeding was removed), so nothing bogus gets persisted.
const STORAGE_KEY = 'liveReadings.v1';
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const obj: Record<string, DeviceReadings> = {};
      for (const [key, value] of readingsByDevice) obj[key] = value;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj)).catch(() => {});
    } catch {
      // ignore serialization/storage failures
    }
  }, 400);
}

/**
 * Load persisted readings into the in-memory store. Runs once at startup and
 * never clobbers a fresher in-memory reading that arrived before hydration.
 */
export async function hydrateLiveReadings(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, DeviceReadings>;
    if (!obj || typeof obj !== 'object') return;
    let changed = false;
    for (const [deviceId, readings] of Object.entries(obj)) {
      if (!readings || typeof readings !== 'object') continue;
      const merged: DeviceReadings = { ...(readingsByDevice.get(deviceId) || {}) };
      for (const [kind, reading] of Object.entries(readings)) {
        const r = reading as LiveReading | undefined;
        if (!r || typeof r.ts !== 'number' || typeof r.text !== 'string') continue;
        const current = merged[kind as MeasurementKind];
        if (!current || r.ts > current.ts) {
          merged[kind as MeasurementKind] = r;
          changed = true;
        }
      }
      readingsByDevice.set(deviceId, merged);
    }
    if (changed) emit();
  } catch {
    // ignore malformed cache
  }
}

function normalizeDeviceId(deviceId: string): string {
  return String(deviceId || '').trim().toUpperCase();
}

/** Same MAC can be stored as AA:BB:… or AABB… — try both when looking up. */
function deviceIdKeys(deviceId: string): string[] {
  const raw = normalizeDeviceId(deviceId);
  if (!raw) return [];
  const compact = raw.replace(/[^0-9A-F]/g, '');
  const keys = [raw];
  if (compact && compact !== raw) keys.push(compact);
  if (/^[0-9A-F]{12}$/.test(compact)) {
    const coloned = compact.match(/.{2}/g)?.join(':') || '';
    if (coloned && !keys.includes(coloned)) keys.push(coloned);
  }
  return keys;
}

function readingsForDevice(deviceId: string): DeviceReadings | undefined {
  for (const key of deviceIdKeys(deviceId)) {
    const found = readingsByDevice.get(key);
    if (found) return found;
  }
  return undefined;
}

function emit() {
  for (const l of Array.from(listeners)) {
    try {
      l();
    } catch {
      // ignore
    }
  }
}

export function setLiveReading(deviceId: string, reading: LiveReading) {
  const key = normalizeDeviceId(deviceId);
  if (!key) return;
  const prev = readingsByDevice.get(key) || {};
  readingsByDevice.set(key, { ...prev, [reading.kind]: reading });
  emit();
  scheduleSave();
}

export function clearLiveReadings(deviceId: string) {
  const key = normalizeDeviceId(deviceId);
  if (!key) return;
  readingsByDevice.delete(key);
  emit();
  scheduleSave();
}

export function clearAllLiveReadings() {
  readingsByDevice.clear();
  emit();
  scheduleSave();
}

/**
 * Clear only the readings for the given device ids. readingsByDevice is a
 * module-level singleton shared across every patient profile in the app (it
 * is keyed only by device MAC, with no profile scoping), so a caregiver
 * viewing one profile clearing "this patient's" readings must not wipe
 * another profile's cached live vitals — prefer this over clearAllLiveReadings
 * whenever the caller knows which devices belong to the current profile.
 */
export function clearLiveReadingsForDevices(deviceIds: Array<string | null | undefined>) {
  let changed = false;
  for (const id of deviceIds) {
    if (!id) continue;
    for (const key of deviceIdKeys(id)) {
      if (readingsByDevice.delete(key)) changed = true;
    }
  }
  if (changed) {
    emit();
    scheduleSave();
  }
}

/** Clear a single measurement kind for one device (e.g. hide just the BP card). */
export function clearLiveReadingKind(deviceId: string, kind: MeasurementKind) {
  let changed = false;
  for (const key of deviceIdKeys(deviceId)) {
    const prev = readingsByDevice.get(key);
    if (!prev || !(kind in prev)) continue;
    const next: DeviceReadings = { ...prev };
    delete next[kind];
    if (Object.keys(next).length === 0) readingsByDevice.delete(key);
    else readingsByDevice.set(key, next);
    changed = true;
  }
  if (!changed) return;
  emit();
  scheduleSave();
}

export function getLiveReadingsSnapshot(): Map<string, DeviceReadings> {
  return new Map(readingsByDevice);
}

export function subscribeLiveReadings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLiveReadings() {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeLiveReadings(() => setTick((t) => t + 1)), []);

  return useMemo(() => getLiveReadingsSnapshot(), [tick]);
}

export function getBestReadingText(deviceId: string, kind: MeasurementKind): string | null {
  const reading = readingsForDevice(deviceId)?.[kind];
  return reading?.text ?? null;
}

/** Newest reading of a kind across every device (Home/Trends fallback). */
export function getLatestReadingOfKind(kind: MeasurementKind): LiveReading | null {
  let best: LiveReading | null = null;
  for (const device of readingsByDevice.values()) {
    const reading = device?.[kind];
    if (!reading) continue;
    if (!best || reading.ts > best.ts) best = reading;
  }
  return best;
}

export function getReadingsForDevice(deviceId: string): DeviceReadings | undefined {
  return readingsForDevice(deviceId);
}

/** Get the most recent reading timestamp for a device (across all measurement kinds) */
export function getLatestReadingTimestamp(deviceId: string): number | null {
  const device = readingsForDevice(deviceId);
  if (!device) return null;
  let latest = 0;
  for (const reading of Object.values(device)) {
    if (reading && reading.ts > latest) {
      latest = reading.ts;
    }
  }
  return latest > 0 ? latest : null;
}

/** Check if we have any live readings for a device */
export function hasLiveReadings(deviceId: string): boolean {
  const device = readingsForDevice(deviceId);
  return !!device && Object.keys(device).length > 0;
}

// Restore persisted readings as soon as this module is first imported (app
// start), so the Home cards show the last real value instead of blank on reload.
void hydrateLiveReadings();
