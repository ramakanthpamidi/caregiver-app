import { useEffect, useMemo, useState } from 'react';

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

function normalizeDeviceId(deviceId: string): string {
  return String(deviceId || '').trim().toUpperCase();
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
}

export function clearLiveReadings(deviceId: string) {
  const key = normalizeDeviceId(deviceId);
  if (!key) return;
  readingsByDevice.delete(key);
  emit();
}

export function clearAllLiveReadings() {
  readingsByDevice.clear();
  emit();
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
  const key = normalizeDeviceId(deviceId);
  if (!key) return null;
  const device = readingsByDevice.get(key);
  const reading = device?.[kind];
  return reading?.text ?? null;
}

/** Get the most recent reading timestamp for a device (across all measurement kinds) */
export function getLatestReadingTimestamp(deviceId: string): number | null {
  const key = normalizeDeviceId(deviceId);
  if (!key) return null;
  const device = readingsByDevice.get(key);
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
  const key = normalizeDeviceId(deviceId);
  if (!key) return false;
  const device = readingsByDevice.get(key);
  return !!device && Object.keys(device).length > 0;
}
