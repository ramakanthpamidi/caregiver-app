/**
 * Alert Storage
 * 
 * Manages local storage of health alerts with offline queue support.
 * Alerts are stored locally and synced to server when online.
 */

import { getSecureItem, removeSecureItem, setSecureItem } from '../../../shared/storage/secureLocalStorage';
import { getAlertMessage, getAlertTitle, type HealthStatusLevel } from '../../../shared/lib/healthThresholds';
import { getMedicalEvents, type MedicalEventRow } from '../../profiles/api/profileApi';

const KEY_ALERTS = 'alerts.v1';
const KEY_ALERT_SYNC_STATE = 'alerts.remoteSync.v1';
const MAX_LOCAL_ALERTS = 100;
const REMOTE_ALERT_PAGE_SIZE = 200;

type AlertSyncState = Record<string, { latestRemoteTimestamp: number }>;

export type AlertSeverity = 'critical' | 'warning' | 'good' | 'excellent';

export interface LocalAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  deviceName: string;
  deviceId: string;
  readingType: 'bp' | 'spo2' | 'glucose' | 'temp';
  reading: string;
  values: Record<string, number>;
  timestamp: number; // epoch ms
  profileId: number;
  isUnread: boolean;
  isSynced: boolean;
  remoteEventId?: number | null;
}

const remoteSyncInFlight = new Map<number, Promise<number>>();
let remoteSyncGeneration = 0;

function nowId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isReadingType(value: unknown): value is LocalAlert['readingType'] {
  return value === 'bp' || value === 'spo2' || value === 'glucose' || value === 'temp';
}

function parseTimestampMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    const asDate = Date.parse(value);
    if (Number.isFinite(asDate)) return asDate;
  }
  return 0;
}

function toPayloadRecord(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      // ignore invalid payload JSON
    }
  }
  return {};
}

function toNumericRecord(value: unknown): Record<string, number> {
  const source = toPayloadRecord(value);
  const numeric: Record<string, number> = {};
  for (const [key, raw] of Object.entries(source)) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      numeric[key] = parsed;
    }
  }
  return numeric;
}

function normalizeHealthStatus(value: unknown): HealthStatusLevel | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'warning') return 'Warning';
  if (normalized === 'good') return 'Good';
  if (normalized === 'excellent') return 'Excellent';
  return null;
}

function normalizeSeverity(value: unknown, status?: HealthStatusLevel | null): AlertSeverity | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'warning') return 'warning';
  if (normalized === 'good') return 'good';
  if (normalized === 'excellent') return 'excellent';
  return status ? healthStatusToSeverity(status) : null;
}

function inferReadingType(payload: Record<string, any>, values: Record<string, number>, event: MedicalEventRow): LocalAlert['readingType'] | null {
  if (isReadingType(payload.readingType)) {
    return payload.readingType;
  }

  if (typeof values.sys === 'number' || typeof values.dia === 'number') return 'bp';
  if (typeof values.spo2 === 'number') return 'spo2';
  if (typeof values.mgdl === 'number') return 'glucose';
  if (typeof values.celsius === 'number') return 'temp';

  const text = [
    payload.title,
    payload.message,
    payload.readingType,
    event.device_name,
    event.factory_name,
    event.event_type,
  ]
    .map((entry) => String(entry || '').toLowerCase())
    .join(' ');

  if (text.includes('pressure') || text.includes('bp')) return 'bp';
  if (text.includes('oxygen') || text.includes('spo2')) return 'spo2';
  if (text.includes('glucose') || text.includes('sugar')) return 'glucose';
  if (text.includes('temp')) return 'temp';
  return null;
}

function formatReadingText(readingType: LocalAlert['readingType'], values: Record<string, number>, fallback?: unknown): string {
  const fallbackText = typeof fallback === 'string' ? fallback.trim() : '';
  if (fallbackText) return fallbackText;

  if (readingType === 'bp') {
    const sys = values.sys;
    const dia = values.dia;
    if (Number.isFinite(sys) && Number.isFinite(dia)) {
      return `${sys}/${dia} mmHg`;
    }
  }

  if (readingType === 'spo2') {
    const spo2 = values.spo2;
    const pulse = values.pulse;
    if (Number.isFinite(spo2) && Number.isFinite(pulse)) {
      return `${spo2}% / ${pulse} bpm`;
    }
    if (Number.isFinite(spo2)) {
      return `${spo2}%`;
    }
  }

  if (readingType === 'glucose' && Number.isFinite(values.mgdl)) {
    return `${values.mgdl} mg/dL`;
  }

  if (readingType === 'temp' && Number.isFinite(values.celsius)) {
    return `${values.celsius.toFixed(1)}°C`;
  }

  return fallbackText;
}

function sameNumericValues(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (key !== rightKeys[index]) return false;
    if (left[key] !== right[key]) return false;
  }
  return true;
}

function findMatchingLocalAlert(existing: LocalAlert[], incoming: LocalAlert): LocalAlert | undefined {
  if (incoming.remoteEventId != null) {
    const byRemoteEventId = existing.find((alert) => alert.remoteEventId === incoming.remoteEventId);
    if (byRemoteEventId) return byRemoteEventId;
  }

  return existing.find((alert) => {
    if (Number(alert.profileId) !== Number(incoming.profileId)) return false;
    if (alert.deviceId !== incoming.deviceId) return false;
    if (alert.readingType !== incoming.readingType) return false;
    if (alert.severity !== incoming.severity) return false;
    if (Math.abs((Number(alert.timestamp) || 0) - incoming.timestamp) >= 60000) return false;
    return sameNumericValues(alert.values || {}, incoming.values || {});
  });
}

async function getAlertSyncState(): Promise<AlertSyncState> {
  try {
    const raw = await getSecureItem(KEY_ALERT_SYNC_STATE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as AlertSyncState) : {};
  } catch {
    return {};
  }
}

async function saveAlertSyncState(state: AlertSyncState): Promise<void> {
  await setSecureItem(KEY_ALERT_SYNC_STATE, JSON.stringify(state));
}

async function updateAlertSyncState(profileId: number, latestRemoteTimestamp: number): Promise<void> {
  if (!Number.isFinite(profileId) || profileId <= 0) return;
  if (!Number.isFinite(latestRemoteTimestamp) || latestRemoteTimestamp <= 0) return;

  const current = await getAlertSyncState();
  const key = String(profileId);
  const previous = Number(current[key]?.latestRemoteTimestamp) || 0;
  if (latestRemoteTimestamp <= previous) return;

  current[key] = { latestRemoteTimestamp };
  await saveAlertSyncState(current);
}

function remoteEventToLocalAlert(event: MedicalEventRow): LocalAlert | null {
  const payload = toPayloadRecord(event.payload);
  const values = toNumericRecord(payload.values);
  const readingType = inferReadingType(payload, values, event);
  if (!readingType) return null;

  const timestamp = parseTimestampMs(event.ts);
  const profileId = Number(event.profile_id);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  if (!Number.isFinite(profileId) || profileId <= 0) return null;

  const status = normalizeHealthStatus(payload.status);
  const severity = normalizeSeverity(payload.severity, status);
  if (!severity) return null;

  const fallbackStatus = status ?? (severity === 'critical'
    ? 'Critical'
    : severity === 'warning'
      ? 'Warning'
      : severity === 'excellent'
        ? 'Excellent'
        : 'Good');

  const deviceName = String(event.device_name || event.factory_name || event.device_id || 'Medical device');
  const deviceId = String(event.device_id || event.device_ref || 'unknown-device');
  const title = String(payload.title || getAlertTitle(readingType, fallbackStatus, 'en'));
  const message = String(payload.message || getAlertMessage(readingType, fallbackStatus, values, 'en'));
  const reading = formatReadingText(readingType, values, payload.reading);

  return {
    id: event.id != null ? `remote-${event.id}` : `remote-${deviceId}-${timestamp}`,
    severity,
    title,
    message,
    deviceName,
    deviceId,
    readingType,
    reading,
    values,
    timestamp,
    profileId,
    isUnread: true,
    isSynced: true,
    remoteEventId: typeof event.id === 'number' ? event.id : null,
  };
}

function mergeRemoteAlerts(existing: LocalAlert[], remoteAlerts: LocalAlert[]): { alerts: LocalAlert[]; importedCount: number; changed: boolean } {
  if (remoteAlerts.length === 0) {
    return { alerts: existing, importedCount: 0, changed: false };
  }

  const merged = [...existing];
  let importedCount = 0;
  let changed = false;

  for (const remoteAlert of remoteAlerts) {
    const match = findMatchingLocalAlert(merged, remoteAlert);
    if (!match) {
      merged.push(remoteAlert);
      importedCount += 1;
      changed = true;
      continue;
    }

    const nextAlert: LocalAlert = {
      ...remoteAlert,
      id: match.id,
      isUnread: match.isUnread,
      isSynced: true,
      remoteEventId: remoteAlert.remoteEventId ?? match.remoteEventId ?? null,
    };

    const index = merged.findIndex((candidate) => candidate.id === match.id);
    if (index >= 0) {
      const current = merged[index];
      const shouldReplace =
        current.remoteEventId !== nextAlert.remoteEventId ||
        current.isSynced !== nextAlert.isSynced ||
        current.deviceName !== nextAlert.deviceName ||
        current.title !== nextAlert.title ||
        current.message !== nextAlert.message ||
        current.reading !== nextAlert.reading;
      if (shouldReplace) {
        merged[index] = nextAlert;
        changed = true;
      }
    }
  }

  return { alerts: merged, importedCount, changed };
}

/**
 * Convert HealthStatusLevel to AlertSeverity
 */
export function healthStatusToSeverity(status: HealthStatusLevel): AlertSeverity {
  switch (status) {
    case 'Critical':
      return 'critical';
    case 'Warning':
      return 'warning';
    case 'Good':
      return 'good';
    case 'Excellent':
      return 'excellent';
  }
}

/**
 * Get all stored alerts
 */
export async function getAlerts(): Promise<LocalAlert[]> {
  try {
    const raw = await getSecureItem(KEY_ALERTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save alerts to storage
 */
async function saveAlerts(alerts: LocalAlert[]): Promise<void> {
  // Keep only most recent MAX_LOCAL_ALERTS
  const sorted = [...alerts].sort((a, b) => b.timestamp - a.timestamp);
  const trimmed = sorted.slice(0, MAX_LOCAL_ALERTS);
  await setSecureItem(KEY_ALERTS, JSON.stringify(trimmed));
}

export async function clearAlertSyncState(): Promise<void> {
  await removeSecureItem(KEY_ALERT_SYNC_STATE);
}

export function cancelAlertSyncs(): void {
  remoteSyncGeneration += 1;
  remoteSyncInFlight.clear();
}

/**
 * Add a new alert
 */
export async function addAlert(alert: Omit<LocalAlert, 'id' | 'isUnread' | 'isSynced'>): Promise<LocalAlert | null> {
  const newAlert: LocalAlert = {
    ...alert,
    id: nowId(),
    isUnread: true,
    isSynced: false,
  };
  
  const existing = await getAlerts();
  
  // Check for duplicate (same type, device, and within 60 seconds)
  const isDuplicate = existing.some(a => 
    a.readingType === newAlert.readingType &&
    a.deviceId === newAlert.deviceId &&
    a.severity === newAlert.severity &&
    Math.abs(a.timestamp - newAlert.timestamp) < 60000
  );
  
  if (isDuplicate) {
    console.log('[AlertStorage] Skipping duplicate alert');
    return null;
  }
  
  await saveAlerts([newAlert, ...existing]);
  emitAlertsChanged();
  
  console.log('[AlertStorage] Added alert:', newAlert.title);
  return newAlert;
}

/**
 * Mark an alert as read
 */
export async function markAlertRead(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  const updated = alerts.map(a => 
    a.id === alertId ? { ...a, isUnread: false } : a
  );
  await saveAlerts(updated);
  emitAlertsChanged();
}

/**
 * Mark all alerts as read
 */
export async function markAllAlertsRead(): Promise<void> {
  const alerts = await getAlerts();
  const updated = alerts.map(a => ({ ...a, isUnread: false }));
  await saveAlerts(updated);
  emitAlertsChanged();
}

/**
 * Dismiss (delete) an alert
 */
export async function dismissAlert(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  const filtered = alerts.filter(a => a.id !== alertId);
  await saveAlerts(filtered);
  emitAlertsChanged();
}

/**
 * Mark an alert as synced
 */
export async function markAlertSynced(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  const updated = alerts.map(a =>
    a.id === alertId ? { ...a, isSynced: true } : a
  );
  await saveAlerts(updated);
}

/**
 * Get unsynced alerts for upload
 */
export async function getUnsyncedAlerts(): Promise<LocalAlert[]> {
  const alerts = await getAlerts();
  return alerts.filter(a => !a.isSynced);
}

/**
 * Get unread alert count
 */
export async function getUnreadAlertCount(): Promise<number> {
  const alerts = await getAlerts();
  return alerts.filter(a => a.isUnread).length;
}

/**
 * Get alert counts by severity
 */
export async function getAlertCounts(): Promise<{
  critical: number;
  warning: number;
  good: number;
  excellent: number;
}> {
  const alerts = await getAlerts();
  return {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    good: alerts.filter(a => a.severity === 'good').length,
    excellent: alerts.filter(a => a.severity === 'excellent').length,
  };
}

/**
 * Clear all alerts
 */
export async function clearAlerts(): Promise<void> {
  await removeSecureItem(KEY_ALERTS);
  emitAlertsChanged();
}

export async function syncRemoteAlertsForProfile(token: string, profileId: number): Promise<number> {
  if (!token) return 0;
  if (!Number.isFinite(profileId) || profileId <= 0) return 0;

  const existingTask = remoteSyncInFlight.get(profileId);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    const syncGeneration = remoteSyncGeneration;
    const syncState = await getAlertSyncState();
    const lastRemoteTimestamp = Number(syncState[String(profileId)]?.latestRemoteTimestamp) || 0;
    let latestRemoteTimestamp = lastRemoteTimestamp;
    const remoteAlerts: LocalAlert[] = [];
    let offset = 0;

    for (;;) {
      if (syncGeneration !== remoteSyncGeneration) {
        return 0;
      }

      const events = await getMedicalEvents(token, profileId, {
        limit: REMOTE_ALERT_PAGE_SIZE,
        offset,
      });

      if (!Array.isArray(events) || events.length === 0) {
        break;
      }

      let reachedOlderEvents = false;
      for (const event of events) {
        if (String(event.event_type || '').toLowerCase() !== 'alert') {
          continue;
        }

        const eventTimestamp = parseTimestampMs(event.ts);
        if (eventTimestamp > latestRemoteTimestamp) {
          latestRemoteTimestamp = eventTimestamp;
        }
        if (lastRemoteTimestamp > 0 && eventTimestamp > 0 && eventTimestamp < lastRemoteTimestamp) {
          reachedOlderEvents = true;
          break;
        }

        const remoteAlert = remoteEventToLocalAlert(event);
        if (remoteAlert) {
          remoteAlerts.push(remoteAlert);
        }
      }

      if (reachedOlderEvents || events.length < REMOTE_ALERT_PAGE_SIZE) {
        break;
      }

      offset += events.length;
    }

    if (syncGeneration !== remoteSyncGeneration) {
      return 0;
    }

    const existingAlerts = await getAlerts();
    const merged = mergeRemoteAlerts(existingAlerts, remoteAlerts);

    if (latestRemoteTimestamp > lastRemoteTimestamp) {
      await updateAlertSyncState(profileId, latestRemoteTimestamp);
    }

    if (syncGeneration !== remoteSyncGeneration) {
      return 0;
    }

    if (merged.changed) {
      await saveAlerts(merged.alerts);
      emitAlertsChanged();
    }

    return merged.importedCount;
  })();

  remoteSyncInFlight.set(profileId, task);

  try {
    return await task;
  } finally {
    if (remoteSyncInFlight.get(profileId) === task) {
      remoteSyncInFlight.delete(profileId);
    }
  }
}

export async function deleteAlertsByProfileAndPeriod(
  profileId: number,
  opts?: { fromTs?: number | null; toTs?: number | null }
): Promise<number> {
  const alerts = await getAlerts();
  const fromTs = opts?.fromTs ?? null;
  const toTs = opts?.toTs ?? null;

  const filtered = alerts.filter((alert) => {
    if (Number(alert.profileId) !== Number(profileId)) return true;

    const ts = Number(alert.timestamp) || 0;
    if (fromTs != null && ts < fromTs) return true;
    if (toTs != null && ts >= toTs) return true;

    return false;
  });

  const deleted = alerts.length - filtered.length;
  if (deleted > 0) {
    await saveAlerts(filtered);
    emitAlertsChanged();
  }

  return deleted;
}

// Listeners for alert changes
const alertListeners = new Set<() => void>();

function emitAlertsChanged(): void {
  for (const listener of Array.from(alertListeners)) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
  // Recompute badge after any alert change (add/read/dismiss)
  import('../lib/alertNotifications').then(({ refreshBadge }) => { void refreshBadge(); }).catch(() => {});
}

/**
 * Subscribe to alert changes
 */
export function subscribeAlerts(listener: () => void): () => void {
  alertListeners.add(listener);
  return () => {
    alertListeners.delete(listener);
  };
}

/**
 * Format timestamp for display
 */
export function formatAlertTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  
  // Show date
  const date = new Date(timestamp);
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[date.getMonth()]}`;
}
