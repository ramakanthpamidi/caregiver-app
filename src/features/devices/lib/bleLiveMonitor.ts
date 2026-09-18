/**
 * Home Screen BLE Live Monitor
 *
 * Behavior (matching Kotlin app):
 * 1. Continuously scan for BLE devices with name containing "Yuwell"
 * 2. When a scanned device's MAC matches a user's registered device_id:
 *    - Mark device as "seen" and show initial "0" placeholder value
 * 3. Connect to the seen device and subscribe for notifications
 * 4. When notifications arrive, parse and display the actual data
 * 5. Pause only while higher-priority BLE work temporarily owns the adapter
 */

import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import base64 from 'react-native-base64';
import type { Device, Characteristic, Service } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bleManager, base64ToBytes, clearDeviceConnectionState, resetBleManager } from './bleManager';
import { setLiveReading, getLiveReadingsSnapshot, type MeasurementKind } from './liveReadings';
import { classifyMeasurementKind } from './deviceKind';
import { sendMedicalData, sendMedicalEvent } from '../../profiles/api/profileApi';
import { isOnlineSync } from '../../../shared/sync/networkSync';
import { enqueueMedicalData, enqueueMedicalEvent } from '../../../shared/sync/syncOutbox';
import { getCurrentPosition } from '../../../shared/lib/location';
import { notifyAilinkDeviceSeen } from '../../../shared/lib/ailinkScale';
import { notifyIcomonDeviceSeen } from '../../../shared/lib/icomonScale';
import type { DeviceSummary } from '../components/ScanDeviceCard';
import {
  evaluateBloodPressure,
  evaluateSpO2,
  evaluateGlucose,
  evaluateTemperature,
  getAlertTitle,
  getAlertMessage,
  formatReadingText,
  getDeviceNameForType,
  type HealthStatusLevel,
} from '../../../shared/lib/healthThresholds';
import { addAlert, healthStatusToSeverity } from '../../alerts/storage/alertStorage';
import { sendAlertNotification, refreshBadge } from '../../alerts/lib/alertNotifications';
import { getProfileConsentsSnapshot } from '../../legal/storage/profileConsentStore';
import { savePersistedLiveReadings } from '../storage/persistedLiveReadings';
import { scheduleDailySummaryNotification } from '../../../shared/notifications/dailySummaryNotification';

const UUIDS = {
  oximeterNotify: '0000ffe4-0000-1000-8000-00805f9b34fb',
  oximeterControl: '0000ffe9-0000-1000-8000-00805f9b34fb',
  bpMeasurement: '00002a35-0000-1000-8000-00805f9b34fb',
  bpIntermediate: '00002a36-0000-1000-8000-00805f9b34fb',
  thermometerMeasurement: '00002a1c-0000-1000-8000-00805f9b34fb',
  glucoseMeasurement: '00002a18-0000-1000-8000-00805f9b34fb',
  batteryLevel: '00002a19-0000-1000-8000-00805f9b34fb',
} as const;

function normalizeUuid(u?: string | null): string | null {
  if (!u) return null;
  const s = String(u).trim().toLowerCase().replace(/[{}]/g, '');
  if (!s) return null;
  if (/^[0-9a-f]{4}$/.test(s)) return `0000${s}-0000-1000-8000-00805f9b34fb`;
  if (/^[0-9a-f]{8}$/.test(s)) return `${s}-0000-1000-8000-00805f9b34fb`;
  return s;
}

function normalizeMac(mac?: string | null): string {
  if (!mac) return '';
  return mac.trim().toUpperCase();
}

function clamp(num: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, num));
}

function decodeSFloatLE(b0: number, b1: number): number {
  const raw = (b0 & 0xff) | ((b1 & 0xff) << 8);
  let mantissa = raw & 0x0fff;
  if (mantissa >= 0x0800) mantissa -= 0x1000;
  let exponent = (raw >> 12) & 0x0f;
  if (exponent >= 0x08) exponent -= 0x10;
  return mantissa * Math.pow(10, exponent);
}

function decodeIEEE11073FloatLE(bytes: number[], offset: number): number | null {
  if (bytes.length < offset + 4) return null;
  const b0 = bytes[offset] & 0xff;
  const b1 = bytes[offset + 1] & 0xff;
  const b2 = bytes[offset + 2] & 0xff;
  const b3 = bytes[offset + 3] & 0xff;
  const mantissaRaw = b0 | (b1 << 8) | (b2 << 16);
  let mantissa = mantissaRaw;
  if (mantissa >= 0x00800000) mantissa -= 0x01000000; // sign extend 24-bit
  let exponent = b3;
  if (exponent >= 0x80) exponent -= 0x100; // sign extend 8-bit
  return mantissa * Math.pow(10, exponent);
}

function parseOximeter(bytes: number[]) {
  // Yuwell proprietary frames (see ble/yuwellOximeter.js):
  // 0xFE-framed packets; id 0x55 is 1 Hz measurement (HR 16-bit BE, SpO2).
  // A single notification may batch several frames — scan every offset.
  let pulse: number | null = null;
  let spo2: number | null = null;

  for (let o = 0; o + 6 <= bytes.length; o++) {
    if ((bytes[o] & 0xff) !== 0xfe) continue;
    const id = bytes[o + 2] & 0xff;
    if (id === 0x55 && o + 6 <= bytes.length) {
      const hr = ((bytes[o + 3] & 0xff) << 8) | (bytes[o + 4] & 0xff);
      const s = bytes[o + 5] & 0xff;
      if (s >= 50 && s <= 100) spo2 = s;
      if (hr >= 20 && hr <= 220) pulse = hr;
      // Prefer the first valid measurement frame in the batch.
      if (spo2 != null) break;
    }
  }

  // Legacy / generic layout (some firmwares): pulse=bytes[4], spo2=bytes[5]
  if (spo2 === null && bytes.length >= 6) {
    const p = bytes[4] & 0xff;
    const s = bytes[5] & 0xff;
    if (p >= 20 && p <= 220) pulse = p;
    if (s >= 50 && s <= 100) spo2 = s;
  }

  // Adjacent-pair scan fallback
  if (spo2 === null) {
    for (let i = 0; i < bytes.length - 1; i++) {
      const a = bytes[i] & 0xff;
      const b = bytes[i + 1] & 0xff;
      if (a >= 20 && a <= 220 && b >= 50 && b <= 100) {
        pulse = a;
        spo2 = b;
        break;
      }
      if (b >= 20 && b <= 220 && a >= 50 && a <= 100) {
        pulse = b;
        spo2 = a;
        break;
      }
    }
  }

  if (spo2 === null) return null;
  const text =
    pulse != null && pulse > 0 ? `${spo2}% / ${pulse} bpm` : `${spo2}%`;
  return { pulse, spo2, text };
}

function parseBattery(bytes: number[]) {
  const pct = bytes.length > 0 ? clamp(bytes[0] & 0xff, 0, 100) : null;
  if (pct === null) return null;
  return { pct, text: `${pct}%` };
}

function parseBP(bytes: number[], uuid: string) {
  // Try simple byte indices first (works for some vendor implementations)
  const sys1 = bytes.length > 1 ? (bytes[1] & 0xff) : null;
  const dia1 = bytes.length > 3 ? (bytes[3] & 0xff) : null;
  const pulse1 = bytes.length > 14 ? (bytes[14] & 0xff) : null;

  const plausibleSys = sys1 !== null && sys1 >= 60 && sys1 <= 240 ? sys1 : null;
  const plausibleDia = dia1 !== null && dia1 >= 30 && dia1 <= 160 ? dia1 : null;
  const plausiblePulse = pulse1 !== null && pulse1 >= 30 && pulse1 <= 240 ? pulse1 : null;

  if (uuid === UUIDS.bpIntermediate) {
    if (plausibleSys === null) return null;
    return { sys: plausibleSys, dia: null, pulse: plausiblePulse, text: `${plausibleSys} mmHg` };
  }

  if (plausibleSys !== null && plausibleDia !== null) {
    const text = plausiblePulse ? `${plausibleSys}/${plausibleDia} mmHg • ${plausiblePulse} bpm` : `${plausibleSys}/${plausibleDia} mmHg`;
    return { sys: plausibleSys, dia: plausibleDia, pulse: plausiblePulse, text };
  }

  // Fallback: attempt SFLOAT decoding per spec: flags + 3xSFLOAT
  if (bytes.length >= 8) {
    const sys = decodeSFloatLE(bytes[1], bytes[2]);
    const dia = decodeSFloatLE(bytes[3], bytes[4]);
    const pulse = bytes.length >= 16 ? decodeSFloatLE(bytes[14], bytes[15]) : null;

    if (Number.isFinite(sys) && Number.isFinite(dia) && sys > 0 && dia > 0) {
      const sysR = Math.round(sys);
      const diaR = Math.round(dia);
      const pulseR = pulse && Number.isFinite(pulse) && pulse > 0 ? Math.round(pulse) : null;
      const text = pulseR ? `${sysR}/${diaR} mmHg • ${pulseR} bpm` : `${sysR}/${diaR} mmHg`;
      return { sys: sysR, dia: diaR, pulse: pulseR, text };
    }
  }

  return null;
}

function parseTemp(bytes: number[]) {
  // Try 1: standard Health Thermometer spec — flags byte at 0, IEEE-11073 FLOAT LE at offset 1
  if (bytes.length >= 5) {
    const v1 = decodeIEEE11073FloatLE(bytes, 1);
    if (v1 !== null && Number.isFinite(v1) && v1 >= 25 && v1 <= 45) {
      const c1 = Math.round(v1 * 10) / 10;
      console.log('[BLE_MON] parseTemp: IEEE-11073 offset-1 =>', c1);
      return { c: c1, text: `${c1.toFixed(1)}°C` };
    }
  }

  // Try 2: no flags byte — IEEE-11073 FLOAT LE starting at offset 0
  if (bytes.length >= 4) {
    const v0 = decodeIEEE11073FloatLE(bytes, 0);
    if (v0 !== null && Number.isFinite(v0) && v0 >= 25 && v0 <= 45) {
      const c0 = Math.round(v0 * 10) / 10;
      console.log('[BLE_MON] parseTemp: IEEE-11073 offset-0 =>', c0);
      return { c: c0, text: `${c0.toFixed(1)}°C` };
    }
  }

  // Try 3: 2-byte little-endian value / 10 (many Yuwell proprietary formats)
  if (bytes.length >= 2) {
    const rawLE = (bytes[0] & 0xff) | ((bytes[1] & 0xff) << 8);
    const vLE = rawLE / 10;
    if (vLE >= 25 && vLE <= 45) {
      console.log('[BLE_MON] parseTemp: 2-byte LE /10 =>', vLE);
      return { c: vLE, text: `${vLE.toFixed(1)}°C` };
    }
    // Try 3b: offset 1+2 (with a leading byte like flags or sequence)
    if (bytes.length >= 3) {
      const rawLE2 = (bytes[1] & 0xff) | ((bytes[2] & 0xff) << 8);
      const vLE2 = rawLE2 / 10;
      if (vLE2 >= 25 && vLE2 <= 45) {
        console.log('[BLE_MON] parseTemp: 2-byte LE /10 (offset 1) =>', vLE2);
        return { c: vLE2, text: `${vLE2.toFixed(1)}°C` };
      }
    }
  }

  // Try 4: 2-byte big-endian value / 10
  if (bytes.length >= 2) {
    const rawBE = ((bytes[0] & 0xff) << 8) | (bytes[1] & 0xff);
    const vBE = rawBE / 10;
    if (vBE >= 25 && vBE <= 45) {
      console.log('[BLE_MON] parseTemp: 2-byte BE /10 =>', vBE);
      return { c: vBE, text: `${vBE.toFixed(1)}°C` };
    }
  }

  console.log('[BLE_MON] parseTemp: no decode matched, bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(' '));
  return null;
}

function parseGlucose(bytes: number[]) {
  let found: number | null = null;

  // Try to parse per Glucose Measurement structure (flags, seq, base time, optional time offset, then SFLOAT)
  try {
    if (bytes.length >= 12) {
      let idx = 0;
      const flags = bytes[idx] & 0xff;
      idx += 1;
      // sequence number (2 bytes)
      idx += 2;
      // base time (7 bytes)
      idx += 7;
      // optional time offset (2 bytes)
      if ((flags & 0x01) !== 0) idx += 2;

      if (bytes.length >= idx + 2) {
        const low = bytes[idx] & 0xff;
        const high = bytes[idx + 1] & 0xff;
        const raw = (high << 8) | low;

        // Decode IEEE-11073 SFLOAT (12-bit mantissa, 4-bit exponent)
        let exponent = raw >> 12;
        let mantissa = raw & 0x0fff;
        if (exponent >= 0x8) exponent -= 0x10;
        if (mantissa >= 0x800) mantissa -= 0x1000;

        const invalidMantissas = [0x07ff, -0x0800, -1];
        if (!invalidMantissas.includes(mantissa)) {
          const molPerL = mantissa * Math.pow(10, exponent);
          // convert mol/L -> mg/dL using glucose molar mass (180.16 g/mol)
          const mgPerDl = molPerL * 180.16 * 100.0;
          if (Number.isFinite(mgPerDl) && mgPerDl >= 10 && mgPerDl <= 1500) {
            // Plausible mol/L-derived result — standard-compliant device.
            found = mgPerDl;
          } else if (exponent === 0 && mantissa >= 20 && mantissa <= 1500) {
            // Non-standard firmware: mg/dL value stored as a plain integer in
            // the SFLOAT field (exponent=0, no mol/L encoding applied).
            // A real mol/L value for blood glucose always needs a negative exponent
            // (range 0.002–0.04 mol/L), so exponent=0 with a mantissa in mg/dL
            // range is a reliable indicator of this encoding quirk.
            console.log('[BLE_MON] parseGlucose: non-standard mg/dL direct encoding detected, mantissa:', mantissa, '(mol/L path gave:', mgPerDl.toFixed(0), 'mg/dL)');
            found = mantissa;
          }
        }
      }
    }
  } catch {
    // ignore structured parse failure
  }

  // Fallback heuristics (matching Kotlin behavior)
  if (found === null && bytes.length >= 2) {
    // Try 16-bit little-endian scan
    for (let i = 0; i < bytes.length - 1; i++) {
      const v16 = (bytes[i] & 0xff) | ((bytes[i + 1] & 0xff) << 8);
      if (v16 >= 10 && v16 <= 1000) {
        found = v16;
        break;
      }
    }
  }

  if (found === null && bytes.length >= 1) {
    // Try single byte scan
    for (const b of bytes) {
      const vb = b & 0xff;
      if (vb >= 10 && vb <= 250) {
        found = vb;
        break;
      }
    }
  }

  if (found === null && bytes.length >= 4) {
    // Try IEEE-754 float scan (little-endian)
    try {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      for (let i = 0; i <= bytes.length - 4; i++) {
        view.setUint8(0, bytes[i] & 0xff);
        view.setUint8(1, bytes[i + 1] & 0xff);
        view.setUint8(2, bytes[i + 2] & 0xff);
        view.setUint8(3, bytes[i + 3] & 0xff);
        const f = view.getFloat32(0, true);
        if (Number.isFinite(f) && f > 0 && f < 2000) {
          found = f;
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  if (found === null) return null;

  const mgdl = Math.round(found);
  return { mgdl, text: `${mgdl} mg/dL` };
}

function classifyFromText(d: DeviceSummary): MeasurementKind {
  // Shared classifier recognizes Yuwell model codes (e.g. BO-YX310) as well as keywords.
  return classifyMeasurementKind({
    device_type: d.device_type,
    device_name: d.device_name,
    factory_name: d.factory_name,
    display_name: d.display_name,
    medical_device_type: (d as any).medical_device_type,
    platform: (d as any).platform,
  });
}

function shouldEnableBleNow(active: boolean) {
  if (!active) return false;
  if (Platform.OS === 'web') return false;
  // Prevent Jest from attempting any BLE work.
  const p = (globalThis as any)?.process;
  if (p?.env?.JEST_WORKER_ID) return false;
  return true;
}

// Module-level session token cache. Set when the BLE monitor starts, cleared when it stops.
// uploadMedicalData is a module-level function and cannot access useEffect closure vars,
// so the token must live here.
let _sessionAuthToken: string | null = null;
// Cached app language for the current BLE session — mirrors AsyncStorage 'appLanguage'.
let _sessionLang: 'en' | 'th' = 'en';

// Connection stabilization constants
const MAX_CONNECT_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const POST_CONNECT_SETTLE_MS = 150; // Brief settle before service discovery
const SERVICE_DISCOVERY_TIMEOUT_MS = 20000;
const MTU_PRIORITY_TIMEOUT_MS = 2000; // Timeout for MTU/priority requests

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fireAndForget(promise: Promise<unknown>, label: string) {
  promise.catch((err: any) => {
    console.log(`[BLE_MON] ${label} unhandled error:`, err?.message || err);
  });
}

// Retry helper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelayMs: number,
  label: string
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || '';
      console.log(`[BLE_MON] ${label} attempt ${attempt + 1}/${maxRetries} failed:`, errMsg);
      
      // Don't retry on certain fatal errors.
      // IMPORTANT: Only match our own cleanup 'cancelled' (exact), NOT Android's
      // 'Operation was cancelled' which comes from BLE connect timeouts and should
      // be retried.
      if (errMsg.includes('already_connected') || errMsg === 'cancelled') {
        throw err;
      }
      
      if (attempt < maxRetries - 1) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(`[BLE_MON] ${label} retrying in ${delayMs}ms...`);
        await delay(delayMs);
      }
    }
  }
  throw lastError;
}

// Helper to send medical data to the server (or queue if offline)
async function uploadMedicalData(
  deviceId: string,
  kind: MeasurementKind,
  values: Record<string, any>,
  ts: number,
  preferredProfileId?: number | null
) {
  try {
    // Use the module-level session-cached token if available, fall back to AsyncStorage once.
    const token = _sessionAuthToken ?? await AsyncStorage.getItem('authToken');

    // Use preferred profile ID if provided, otherwise fall back to AsyncStorage
    let profileId: number;
    if (preferredProfileId != null && Number.isFinite(preferredProfileId) && preferredProfileId > 0) {
      profileId = preferredProfileId;
    } else {
      const profileIdStr = await AsyncStorage.getItem('activeProfileId');
      if (!profileIdStr) {
        console.log('[BLE_MON] uploadMedicalData skipped - no profileId');
        return;
      }
      const parsed = Number(profileIdStr);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.log('[BLE_MON] uploadMedicalData skipped - invalid profileId');
        return;
      }
      profileId = parsed;
    }

    const consentSnapshot = getProfileConsentsSnapshot(profileId);
    if (consentSnapshot?.consent_granted === false) {
      console.log('[BLE_MON] uploadMedicalData skipped - consent_granted=false for profileId', profileId);
      return;
    }
    
    if (!token) {
      console.log('[BLE_MON] uploadMedicalData skipped - no token');
      return;
    }

    const snapshot: Record<string, any> = { type: kind, ...values };
    const loc = await getCurrentPosition();
    const dataPayload = {
      device_id: deviceId,
      profile_id: profileId,
      ts,
      snapshot,
      ...(loc && { lat: loc.lat, lng: loc.lng }),
    };

    // Use synchronous cached connectivity state — avoids a NetInfo.fetch() IPC call
    // on every measurement.
    const online = isOnlineSync();
    if (!online) {
      // Queue for offline sync
      console.log('[BLE_MON] Offline - queueing medical data for sync:', deviceId, kind);
      await enqueueMedicalData(dataPayload);
      return;
    }

    console.log('[BLE_MON] uploading medical data:', deviceId, kind);

    await sendMedicalData(token, dataPayload);

    console.log('[BLE_MON] uploadMedicalData success for', deviceId, kind);
  } catch (err: any) {
    console.log('[BLE_MON] uploadMedicalData error:', err?.message);
    // If upload failed (network issue), queue for later
    try {
        const loc = await getCurrentPosition();
      const profileIdStr = await AsyncStorage.getItem('activeProfileId');
      const profileId = Number(profileIdStr);
      if (Number.isFinite(profileId) && profileId > 0) {
        const snapshot: Record<string, any> = { type: kind, ...values };
        await enqueueMedicalData({
          device_id: deviceId,
          profile_id: profileId,
          ts,
          snapshot,
          ...(loc && { lat: loc.lat, lng: loc.lng }),
        });
        console.log('[BLE_MON] Queued medical data for later sync after error');
      }
    } catch {
      // Ignore queue errors
    }
  }
}

// SpO2 upload throttling - only upload every 3 seconds
const lastSpo2UploadTime = new Map<string, number>();
const SPO2_UPLOAD_INTERVAL_MS = 3000;

function shouldUploadSpo2(deviceId: string): boolean {
  const now = Date.now();
  const lastUpload = lastSpo2UploadTime.get(deviceId) || 0;
  if (now - lastUpload >= SPO2_UPLOAD_INTERVAL_MS) {
    lastSpo2UploadTime.set(deviceId, now);
    return true;
  }
  return false;
}

// Alert generation based on health status
async function generateAlertIfNeeded(
  deviceId: string,
  kind: 'bp' | 'spo2' | 'glucose' | 'temp',
  values: Record<string, any>,
  status: HealthStatusLevel,
  ts: number,
  preferredProfileId?: number | null,
  opts?: { allowPositive?: boolean }
) {
  try {
    const allowPositive = opts?.allowPositive === true;
    if (!allowPositive && status !== 'Critical' && status !== 'Warning') {
      return;
    }

    // Use preferred profile ID if provided, otherwise fall back to AsyncStorage
    let profileId: number;
    if (preferredProfileId != null && Number.isFinite(preferredProfileId) && preferredProfileId > 0) {
      profileId = preferredProfileId;
    } else {
      const profileIdStr = await AsyncStorage.getItem('activeProfileId');
      if (!profileIdStr) {
        console.log('[BLE_MON] generateAlert skipped - no profileId');
        return;
      }
      const parsed = Number(profileIdStr);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.log('[BLE_MON] generateAlert skipped - invalid profileId');
        return;
      }
      profileId = parsed;
    }

    // Consent gate: if consent is not granted, do not generate alerts.
    const consentSnapshot = getProfileConsentsSnapshot(profileId);
    if (consentSnapshot?.consent_granted === false) {
      console.log('[BLE_MON] generateAlert skipped - consent_granted=false for profileId', profileId);
      return;
    }

    const severity = healthStatusToSeverity(status);
    const alertValues =
      kind === 'temp'
        ? {
            ...values,
            celsius: Number(values.celsius ?? values.c),
            c: Number(values.c ?? values.celsius),
          }
        : values;
    const title = getAlertTitle(kind, status, _sessionLang);
    const message = getAlertMessage(kind, status, alertValues, _sessionLang);
    const readingText = formatReadingText(kind, alertValues);
    const deviceName = getDeviceNameForType(kind);

    // For Critical and Warning, always add alert immediately
    // For Good and Excellent, we'll only add when user finishes using device
    // But for now, we add all alerts so user sees feedback
    const alert = await addAlert({
      severity,
      title,
      message,
      deviceName,
      deviceId,
      readingType: kind,
      reading: readingText,
      values: alertValues,
      timestamp: ts,
      profileId,
    });

    if (!alert) {
      return;
    }

    console.log('[BLE_MON] Generated alert:', alert.title, severity);

    // Send local push notification for Critical/Warning
    fireAndForget(
      sendAlertNotification(severity, title, message),
      `sendAlertNotification(${deviceId}, ${severity})`
    );
    // Update navbar badge
    fireAndForget(
      refreshBadge(),
      `refreshBadge(${deviceId})`
    );

    // Upload alert immediately when online (same as medical data). Outbox is fallback.
    try {
      const loc = await getCurrentPosition();
      const eventPayload = {
        device_id: deviceId,
        profile_id: profileId,
        ts,
        event_type: 'Alert',
        payload: {
          severity,
          title,
          message,
          reading: readingText,
          values: alertValues,
          readingType: kind,
          status,
        },
        ...(loc && { lat: loc.lat, lng: loc.lng }),
      };

      const token = _sessionAuthToken ?? await AsyncStorage.getItem('authToken');
      const online = isOnlineSync();
      if (online && token) {
        try {
          await sendMedicalEvent(token, eventPayload);
          console.log('[BLE_MON] Uploaded alert event for', deviceId, kind);
        } catch (err: any) {
          console.log('[BLE_MON] Immediate alert upload failed, queueing:', err?.message);
          await enqueueMedicalEvent(eventPayload);
        }
      } else {
        await enqueueMedicalEvent(eventPayload);
        console.log('[BLE_MON] Queued alert event for sync', loc ? `(${loc.lat},${loc.lng})` : '(no GPS)');
      }
    } catch (err) {
      console.log('[BLE_MON] Failed to queue alert event:', err);
    }
  } catch (err: any) {
    console.log('[BLE_MON] generateAlert error:', err?.message);
  }
}

async function enableCccdBestEffort(device: any, serviceUuid: string, charUuid: string) {
  const cccd = '00002902-0000-1000-8000-00805f9b34fb';
  if (!device || typeof device.writeDescriptorForService !== 'function') return;
  const enableIndicate = base64.encode(String.fromCharCode(0x02, 0x00));
  const enableNotify = base64.encode(String.fromCharCode(0x01, 0x00));
  try {
    await device.writeDescriptorForService(serviceUuid, charUuid, cccd, enableIndicate);
    return;
  } catch {
    // fallback to notify
  }
  try {
    await device.writeDescriptorForService(serviceUuid, charUuid, cccd, enableNotify);
  } catch {
    // ignore
  }
}

function isYuwellDevice(device: Device): boolean {
  const name = ((device as any).name || (device as any).localName || '').toLowerCase();
  return name.includes('yuwell');
}

export function useBleLiveMonitor({
  active,
  devices,
  restartKey,
  scanForScaleHandoff,
}: {
  active: boolean;
  devices: DeviceSummary[];
  restartKey?: number;
  // The AILink/ICOMON scale monitors don't own a scan of their own — they piggyback
  // on this scan's onDeviceScanned callback (see notifyAilinkDeviceSeen /
  // notifyIcomonDeviceSeen below) to detect their target device advertising and then
  // connect via their own native SDK. Without this flag, a user whose only registered
  // BLE device is a scale (empty targetMap) would never start a scan at all, so the
  // scale would never be seen and would silently never report data.
  scanForScaleHandoff?: boolean;
}) {
  const stopRef = useRef<(() => void) | null>(null);

  // Build a map of MAC -> device info for quick lookup during scan
  const targetMap = useMemo(() => {
    const map = new Map<string, { deviceId: string; endpointUuid: string | null; preferredKind: MeasurementKind }>();
    for (const d of devices || []) {
      const mac = normalizeMac(d.device_id);
      if (!mac) continue;
      map.set(mac, {
        deviceId: mac,
        endpointUuid: normalizeUuid(d.endpoint_uuid),
        preferredKind: classifyFromText(d),
      });
    }
    return map;
  }, [devices]);

  useEffect(() => {
    if (!shouldEnableBleNow(active)) return;
    if (targetMap.size === 0 && !scanForScaleHandoff) return;

    console.log('[BLE_MON] Starting live monitor with targets:', Array.from(targetMap.keys()));

    // Capture the active profile ID and auth token at monitor start.
    // Caching these avoids repeated AsyncStorage IPC calls inside the hot-path
    // notification→upload→alert pipeline.
    let sessionProfileId: number | null = null;
    _sessionAuthToken = null; // reset from any previous session
    _sessionLang = 'en';
    Promise.all([
      AsyncStorage.getItem('activeProfileId'),
      AsyncStorage.getItem('authToken'),
      AsyncStorage.getItem('appLanguage'),
    ]).then(([profileVal, tokenVal, langVal]) => {
      const parsed = Number(profileVal);
      sessionProfileId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      _sessionAuthToken = tokenVal;
      _sessionLang = langVal === 'th' ? 'th' : 'en';
      console.log('[BLE_MON] Session started with profileId:', sessionProfileId);
    }).catch(() => {
      sessionProfileId = null;
      _sessionAuthToken = null;
      _sessionLang = 'en';
    });

    let cancelled = false;
    let isScanning = false;
    const seenDevices = new Set<string>();
    const connectedDevices = new Set<string>();
    const connectingDevices = new Set<string>();
    const monitorHandles: Array<{ remove: () => void }> = [];
    // Per-device disconnect subscription — replaces any previous one on reconnect so
    // there is always exactly ONE listener per device, preventing callback storms.
    const disconnectSubs = new Map<string, { remove: () => void }>();
    const watchdogTimers = new Map<string, any>();
    const lastPacketAt = new Map<string, number>();
    const setupStartTimes = new Map<string, number>();
    const recoveringDevices = new Set<string>();
    const recoveryAttempts = new Map<string, number>();
    let hardResetInFlight: Promise<void> | null = null;
    let lastHardResetAt = 0;
    let bleStateSub: { remove: () => void } | null = null;
    let scanRefreshTimer: any = null;
    // Debounce timer so rapid back-to-back startScan() calls collapse into one.
    let scanStartTimer: any = null;
    let scanRetryTimer: any = null;
    let scanRetryAttempt = 0;

    // Android throttles BLE scan callbacks after ~25–30 min of continuous scanning.
    // If we're idle, refresh the entire manager instead of only restarting the scan.
    const SCAN_REFRESH_INTERVAL_MS = 20 * 60 * 1000;
    scanRefreshTimer = setInterval(() => {
      if (cancelled) return;
      if (connectedDevices.size === 0 && connectingDevices.size === 0) {
        console.log('[BLE_MON] Periodic idle BLE manager refresh');
        fireAndForget(
          hardResetBleSession('periodic idle refresh'),
          'hardResetBleSession(periodic idle refresh)'
        );
        return;
      }
      console.log('[BLE_MON] Periodic scan refresh (Android throttle prevention)');
      startScan();
    }, SCAN_REFRESH_INTERVAL_MS);

    const handleEvaluatedAlert = (
      deviceId: string,
      kind: 'bp' | 'spo2' | 'glucose' | 'temp',
      values: Record<string, any>,
      status: HealthStatusLevel,
      ts: number
    ) => {
      // Always generate alert immediately for all statuses.
      // Previously Good/Excellent alerts were deferred until device disconnect,
      // but that caused a race condition: thermometers (and oximeters) can fire
      // the disconnect event before the characteristic notification is processed,
      // so the deferred alert was never created. The 60-second deduplication in
      // addAlert() naturally prevents spam without needing the deferral.
      fireAndForget(
        generateAlertIfNeeded(deviceId, kind, values, status, ts, sessionProfileId, { allowPositive: true }),
        `generateAlert(${deviceId}, ${kind})`
      );
    };

    async function resetDeviceForReconnect(deviceId: string, reason: string) {
      const normalizedId = normalizeMac(deviceId);
      if (!normalizedId) return;
      if (recoveringDevices.has(normalizedId)) return;

      recoveringDevices.add(normalizedId);
      console.log('[BLE_MON] resetting device for reconnect:', normalizedId, reason);

      try {
        const watchdog = watchdogTimers.get(normalizedId);
        if (watchdog) {
          try {
            clearInterval(watchdog);
          } catch {}
          watchdogTimers.delete(normalizedId);
        }

        try {
          disconnectSubs.get(normalizedId)?.remove();
        } catch {}
        disconnectSubs.delete(normalizedId);

        lastPacketAt.delete(normalizedId);
        setupStartTimes.delete(normalizedId);
        connectedDevices.delete(normalizedId);
        connectingDevices.delete(normalizedId);
        seenDevices.delete(normalizedId);

        clearDeviceConnectionState(normalizedId);

        try {
          await bleManager.cancelDeviceConnection(normalizedId);
        } catch (err: any) {
          console.log('[BLE_MON] cancelDeviceConnection during reset ignored for', normalizedId, err?.message || err);
        }

        clearDeviceConnectionState(normalizedId);
      } finally {
        recoveringDevices.delete(normalizedId);
      }

      if (!cancelled) {
        startScan();
      }
    }

    function clearRecoveryAttempt(deviceId: string) {
      recoveryAttempts.delete(normalizeMac(deviceId));
    }

    function nextRecoveryAttempt(deviceId: string) {
      const normalizedId = normalizeMac(deviceId);
      const next = (recoveryAttempts.get(normalizedId) || 0) + 1;
      recoveryAttempts.set(normalizedId, next);
      return next;
    }

    async function hardResetBleSession(reason: string) {
      if (cancelled) return;
      if (hardResetInFlight) {
        await hardResetInFlight;
        return;
      }

      const now = Date.now();
      if (now - lastHardResetAt < 5000) {
        return;
      }
      lastHardResetAt = now;

      hardResetInFlight = (async () => {
        console.log('[BLE_MON] hard resetting BLE session:', reason);

        try {
          Promise.resolve(bleManager.stopDeviceScan()).catch(() => {});
        } catch {
          // ignore
        }
        isScanning = false;

        if (scanStartTimer !== null) {
          clearTimeout(scanStartTimer);
          scanStartTimer = null;
        }

        for (const timer of watchdogTimers.values()) {
          try {
            clearInterval(timer);
          } catch {}
        }
        watchdogTimers.clear();

        for (const sub of disconnectSubs.values()) {
          try {
            sub.remove();
          } catch {}
        }
        disconnectSubs.clear();

        const deviceIds = new Set<string>([
          ...Array.from(targetMap.keys()),
          ...Array.from(seenDevices),
          ...Array.from(connectedDevices),
          ...Array.from(connectingDevices),
        ]);

        for (const deviceId of Array.from(deviceIds)) {
          connectedDevices.delete(deviceId);
          connectingDevices.delete(deviceId);
          seenDevices.delete(deviceId);
          lastPacketAt.delete(deviceId);
          setupStartTimes.delete(deviceId);
          clearDeviceConnectionState(deviceId);
          try {
            await bleManager.cancelDeviceConnection(deviceId);
          } catch {
            // ignore stale disconnect errors during a hard reset
          }
          clearDeviceConnectionState(deviceId);
        }

        recoveryAttempts.clear();
        await resetBleManager(reason);
      })().finally(() => {
        hardResetInFlight = null;
        if (!cancelled) {
          // The old bleStateSub was registered on the now-destroyed native manager.
          // Re-subscribe on the freshly-created manager so Bluetooth adapter state
          // changes (e.g. toggle off/on) are still detected.
          try { bleStateSub?.remove(); } catch {}
          try {
            bleStateSub = bleManager.onStateChange((nextState: string) => {
              if (cancelled) return;
              console.log('[BLE_MON] adapter state (post-reset):', nextState);
              if (nextState === 'PoweredOn') {
                startScan();
              }
            }, true);
          } catch {
            bleStateSub = null;
          }
          startScan();
        }
      });

      await hardResetInFlight;
    }

    async function scheduleRecovery(deviceId: string, reason: string, hard = false) {
      const attempt = nextRecoveryAttempt(deviceId);
      if (hard || attempt >= 2) {
        await hardResetBleSession(`${reason} (attempt ${attempt})`);
        return;
      }
      await resetDeviceForReconnect(deviceId, `${reason} (attempt ${attempt})`);
    }

    function scheduleScanRetry(reason: string) {
      if (cancelled) return;
      if (scanRetryTimer !== null) return;

      scanRetryAttempt += 1;
      const delayMs = Math.min(5000, 750 * Math.pow(2, Math.max(0, scanRetryAttempt - 1)));
      console.log('[BLE_MON] scheduling scan retry in', delayMs, 'ms because', reason);

      scanRetryTimer = setTimeout(() => {
        scanRetryTimer = null;
        startScan();
      }, delayMs);
    }

    function stopAll() {
      cancelled = true;
      isScanning = false;
      console.log('[BLE_MON] stopAll called');

      const deviceIdsToReset = new Set<string>([
        ...Array.from(targetMap.keys()),
        ...Array.from(seenDevices),
        ...Array.from(connectedDevices),
        ...Array.from(connectingDevices),
        ...Array.from(disconnectSubs.keys()),
        ...Array.from(watchdogTimers.keys()),
      ]);

      try {
        // stopDeviceScan returns a Promise in react-native-ble-plx; swallow rejections to avoid unhandled promise warnings
        Promise.resolve(bleManager.stopDeviceScan()).catch(() => {});
      } catch {
        // ignore
      }

      if (scanRefreshTimer !== null) {
        clearInterval(scanRefreshTimer);
        scanRefreshTimer = null;
      }

      try {
        bleStateSub?.remove();
      } catch {
        // ignore
      }
      bleStateSub = null;

      for (const t of watchdogTimers.values()) {
        try {
          clearInterval(t);
        } catch {}
      }
      watchdogTimers.clear();

      if (scanStartTimer !== null) {
        clearTimeout(scanStartTimer);
        scanStartTimer = null;
      }

      if (scanRetryTimer !== null) {
        clearTimeout(scanRetryTimer);
        scanRetryTimer = null;
      }

      for (const deviceId of Array.from(deviceIdsToReset)) {
        fireAndForget(
          resetDeviceForReconnect(deviceId, 'monitor stopped'),
          `resetDeviceForReconnect(${deviceId}, stopAll)`
        );
      }

      // Clear handles without calling native remove to avoid crashes
      monitorHandles.length = 0;
      seenDevices.clear();
      connectedDevices.clear();
      connectingDevices.clear();
      lastPacketAt.clear();
      setupStartTimes.clear();
      recoveryAttempts.clear();
      _sessionAuthToken = null;
      _sessionLang = 'en';
    }

    stopRef.current = stopAll;

    // Connect to a seen device and subscribe for notifications
    async function connectAndMonitor(deviceId: string, endpointUuid: string | null, preferredKind: MeasurementKind) {
      if (cancelled) return;
      if (connectedDevices.has(deviceId) || connectingDevices.has(deviceId)) {
        console.log('[BLE_MON] connectAndMonitor skipped - already connected/connecting for', deviceId);
        return;
      }

      connectingDevices.add(deviceId);
      console.log('[BLE_MON] connectAndMonitor starting for', deviceId);

      let device: Device | null = null;
      try {
        // For one-shot devices (temp, glucose) the Android BLE radio must share
        // time between scanning and connecting.  Actively scanning while connecting
        // starves the GATT handshake, causing "Operation was cancelled" on attempt 1
        // then a fast success on attempt 2 once the BLE cache is warm.
        // Pausing the scan during the connect window gives the radio undivided
        // attention and typically cuts first-connect time from ~12 s to ~3-5 s.
        // Streaming devices (spo2, bp) keep scanning so parallel connections still work.
        const pauseScanDuringConnect = preferredKind === 'temp' || preferredKind === 'glucose';
        if (pauseScanDuringConnect && isScanning) {
          try {
            Promise.resolve(bleManager.stopDeviceScan()).catch(() => {});
            isScanning = false;
            console.log('[BLE_MON] scan paused for connect to', deviceId);
          } catch {}
        }

        // Use retry logic for connection (fragile devices like glucose meters need this).
        // 15 s timeout — long enough for first cold connects (typically 8–12 s on this
        // class of device) but short enough to fail-and-retry when the device is
        // genuinely unreachable.
        try {
          device = await withRetry(
            async () => {
              if (cancelled) throw new Error('cancelled');
              return await bleManager.connectToDevice(deviceId, { timeout: 15000 });
            },
            MAX_CONNECT_RETRIES,
            BASE_RETRY_DELAY_MS,
            `connect(${deviceId})`
          );
        } catch (err: any) {
          const errMsg = err?.message || '';
          console.log('[BLE_MON] connect failed for', deviceId, errMsg);
          connectingDevices.delete(deviceId);

          // If we got "already_connected" but we don't track it locally,
          // it means the device disconnected silently. Clear stale state and allow retry.
          if (errMsg.includes('already_connected')) {
            console.log('[BLE_MON] forcing reconnect after already_connected for', deviceId);
            await scheduleRecovery(deviceId, 'stale already_connected state', true);
            return;
          }

          const lowerErrMsg = errMsg.toLowerCase();
          const staleManagerFailure =
            lowerErrMsg.includes('cancel') ||
            lowerErrMsg.includes('timeout') ||
            lowerErrMsg.includes('gatt') ||
            lowerErrMsg.includes('133');
          if (staleManagerFailure) {
            await scheduleRecovery(deviceId, `connect failure: ${errMsg}`, true);
            return;
          }

          // Resume scanning after failed connect
          startScan();
          return;
        }

        if (cancelled || !device) {
          connectingDevices.delete(deviceId);
          return;
        }

        console.log('[BLE_MON] connected to', deviceId);
        connectedDevices.add(deviceId);
        connectingDevices.delete(deviceId);
  clearRecoveryAttempt(deviceId);

        // Register disconnect handler for auto-reconnect.
        // Always replace any previous subscription for this device so there is at
        // most ONE active listener — preventing the callback storm that happens when
        // multiple connectAndMonitor runs each register their own listener.
        try {
          disconnectSubs.get(deviceId)?.remove();
          const disconnectSub = bleManager.onDeviceDisconnected(deviceId, (err: any, disconnectedDevice: any) => {
            if (cancelled) return;
            const disconnectedId = disconnectedDevice?.id || deviceId;
            const mac = normalizeMac(disconnectedId);
            console.log('[BLE_MON] device disconnected, marking for reconnect when seen:', mac);

            // Clear connected state only — do NOT touch connectingDevices here because an
            // active withRetry loop may still be running for this device. Clearing it
            // would allow a second connectAndMonitor to start in parallel with the retry.
            connectedDevices.delete(mac);
            clearDeviceConnectionState(mac);
            seenDevices.delete(mac); // Remove from seen so scan callback will trigger reconnect

            // Restart the BLE scan immediately on disconnect.
            // Android throttles scan callbacks after ~25-30 min of continuous scanning;
            // restarting here resets that timer so the device is re-discovered promptly.
            console.log('[BLE_MON] Restarting scan after disconnect of', mac);
            startScan();
          });
          disconnectSubs.set(deviceId, disconnectSub as any);
        } catch {
          // Disconnect listener is optional
        }

        // Request MTU and connection priority in parallel with timeout (Android).
        // Skip for one-shot devices (temp, glucose) — they send <20 bytes and
        // disconnect immediately, so a large MTU and high connection priority add
        // ~2 s of latency for zero benefit.
        const isOneShotDevice = preferredKind === 'temp' || preferredKind === 'glucose';
        if (Platform.OS === 'android' && !isOneShotDevice) {
          const mtuPromise = (async () => {
            try {
              if (typeof (device as any).requestMTU === 'function') {
                await Promise.race([
                  (device as any).requestMTU(512),
                  delay(MTU_PRIORITY_TIMEOUT_MS),
                ]);
                console.log('[BLE_MON] MTU requested for', deviceId);
              }
            } catch {}
          })();

          const priorityPromise = (async () => {
            try {
              if (typeof (device as any).requestConnectionPriority === 'function') {
                await Promise.race([
                  (device as any).requestConnectionPriority(1),
                  delay(MTU_PRIORITY_TIMEOUT_MS),
                ]);
                console.log('[BLE_MON] connection priority requested for', deviceId);
              }
            } catch {}
          })();

          // Run both in parallel, don't wait too long
          await Promise.race([
            Promise.all([mtuPromise, priorityPromise]),
            delay(MTU_PRIORITY_TIMEOUT_MS),
          ]);
        }

        // Brief settle before service discovery
        await delay(POST_CONNECT_SETTLE_MS);
        if (cancelled) return;

        // Service discovery with timeout and retry
        await withRetry(
          async () => {
            if (cancelled) throw new Error('cancelled');
            const discoveryPromise = device!.discoverAllServicesAndCharacteristics();
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('service discovery timeout')), SERVICE_DISCOVERY_TIMEOUT_MS)
            );
            return await Promise.race([discoveryPromise, timeoutPromise]);
          },
          2,
          500,
          `discoverServices(${deviceId})`
        );
        if (cancelled) return;

        const services: Service[] = await device.services();
        console.log('[BLE_MON] discovered services for', deviceId, services.map(s => normalizeUuid(s.uuid)).filter(Boolean));
        const desired = new Set<string>([
          UUIDS.oximeterNotify,
          UUIDS.oximeterControl,
          UUIDS.bpMeasurement,
          UUIDS.bpIntermediate,
          UUIDS.thermometerMeasurement,
          UUIDS.glucoseMeasurement,
          UUIDS.batteryLevel,
        ]);
        if (endpointUuid) desired.add(endpointUuid);

        // Track setup start time
        setupStartTimes.set(deviceId, Date.now());
        lastPacketAt.set(deviceId, 0); // 0 means setup in progress

        // Watchdog for stalled connections - only triggers after setup grace period
        if (!watchdogTimers.has(deviceId)) {
          const timer = setInterval(() => {
            if (cancelled) return;
            
            // Skip if device is no longer in connected set
            if (!connectedDevices.has(deviceId)) {
              clearInterval(timer);
              watchdogTimers.delete(deviceId);
              return;
            }
            
            const last = lastPacketAt.get(deviceId) || 0;
            const setupStart = setupStartTimes.get(deviceId) || Date.now();
            
            // If setup not complete (last == 0), give 60 seconds grace period
            if (last === 0) {
              if (Date.now() - setupStart < 60000) return; // Still in setup grace
              console.log('[BLE_MON] setup timeout for', deviceId);
            } else if (Date.now() - last < 30000) {
              return; // Got data recently, all good
            } else {
              console.log('[BLE_MON] watchdog triggered for', deviceId);
            }
            
            fireAndForget(
              scheduleRecovery(
                deviceId,
                last === 0 ? 'setup timeout' : 'notification watchdog timeout',
              ),
              `scheduleRecovery(${deviceId}, watchdog)`
            );
          }, 10000);
          watchdogTimers.set(deviceId, timer);
        }

        // Collect oximeter control info for writing AFTER all monitors are set up
        let oximeterControlInfo: { svcUuid: string; chUuid: string } | null = null;

        for (const svc of services) {
          if (cancelled) return;
          let chars: Characteristic[] = [];
          try {
            chars = await svc.characteristics();
            console.log('[BLE_MON] service', normalizeUuid(svc.uuid), 'characteristics:', chars.map(c=>normalizeUuid(c.uuid)).filter(Boolean));
          } catch {
            continue;
          }

          for (const ch of chars) {
            if (cancelled) return;
            const chUuid = normalizeUuid(ch.uuid);
            if (!chUuid || !desired.has(chUuid)) {
              if (chUuid) {
                console.log('[BLE_MON] skipping char', chUuid, 'on', deviceId, '(not in desired set)');
              }
              continue;
            }

            // Save oximeter control info for later - write AFTER monitors are set up
            if (chUuid === UUIDS.oximeterControl) {
              oximeterControlInfo = { svcUuid: svc.uuid, chUuid: ch.uuid };
              continue;
            }

            const monitor = device.monitorCharacteristicForService(svc.uuid, ch.uuid, (error, characteristic) => {
              if (cancelled) return;
              if (error) {
                const errorMessage = String(error?.message || error || 'unknown monitor error');
                console.log('[BLE_MON] monitor error on', deviceId, 'svc', normalizeUuid(svc.uuid), 'ch', normalizeUuid(ch.uuid), '-', errorMessage);

                const lower = errorMessage.toLowerCase();
                const disconnectLike =
                  lower.includes('cancel') ||
                  lower.includes('disconnect') ||
                  lower.includes('not connected');

                if (disconnectLike) {
                  return;
                }

                const recoverable =
                  lower.includes('connection') ||
                  lower.includes('gatt');

                if (recoverable) {
                  fireAndForget(
                    (async () => {
                      await delay(0);
                      if (cancelled) return;
                      await scheduleRecovery(deviceId, `monitor error: ${errorMessage}`);
                    })(),
                    `scheduleRecovery(${deviceId}, monitorError)`
                  );
                }
                return;
              }
              if (!characteristic?.value) {
                console.log('[BLE_MON] monitor callback with empty value on', deviceId, 'ch', normalizeUuid(ch.uuid));
                return;
              }

              lastPacketAt.set(deviceId, Date.now());
              clearRecoveryAttempt(deviceId);

              const bytes = base64ToBytes(characteristic.value);
              const uuid = normalizeUuid(characteristic.uuid) || '';
              const now = Date.now();
              console.log('[BLE_MON] notification', deviceId, 'uuid', uuid, 'len', bytes.length, 'rawB64=', characteristic.value?.slice(0,64));

              if (uuid === UUIDS.batteryLevel) {
                const b = parseBattery(bytes);
                if (b) setLiveReading(deviceId, { kind: 'battery', text: b.text, ts: now, values: { pct: b.pct } });
                // Battery level is not uploaded to server
                return;
              }

              if (uuid === UUIDS.oximeterNotify) {
                const o = parseOximeter(bytes);
                if (o) {
                  setLiveReading(deviceId, { kind: 'spo2', text: o.text, ts: now, values: { spo2: o.spo2 ?? -1, pulse: o.pulse ?? -1 } });
                  if (sessionProfileId && (o.spo2 ?? 0) > 0) {
                    fireAndForget(
                      savePersistedLiveReadings(sessionProfileId, { spo2: o.spo2, pulse: o.pulse ?? undefined, spo2Ts: now }),
                      `savePersistedLiveReadings(${deviceId}, spo2)`
                    );
                    fireAndForget(
                      scheduleDailySummaryNotification({ profileId: sessionProfileId, lang: _sessionLang, latestSpo2: o.spo2, latestPulse: o.pulse ?? undefined }),
                      `scheduleDailySummaryNotification(${deviceId}, spo2)`
                    );
                  }
                  // Throttle SpO2 uploads to every 3 seconds (realtime display continues)
                  if (shouldUploadSpo2(deviceId)) {
                    fireAndForget(
                      uploadMedicalData(deviceId, 'spo2', { spo2: o.spo2, pulse: o.pulse }, now, sessionProfileId),
                      `uploadMedicalData(${deviceId}, spo2)`
                    );
                    // Generate alert based on SpO2 status
                    const status = evaluateSpO2({ spo2: o.spo2 ?? 0 });
                    handleEvaluatedAlert(deviceId, 'spo2', { spo2: o.spo2, pulse: o.pulse }, status, now);
                  }
                }
                return;
              }

              if (uuid === UUIDS.bpMeasurement || uuid === UUIDS.bpIntermediate) {
                const bp = parseBP(bytes, uuid);
                if (bp) {
                  setLiveReading(deviceId, { kind: 'bp', text: bp.text, ts: now, values: { sys: bp.sys ?? -1, dia: bp.dia ?? -1, pulse: bp.pulse ?? -1 } });
                  // Only upload final BP measurement, not intermediate cuff pressure
                  if (uuid === UUIDS.bpMeasurement && bp.sys && bp.dia) {
                    fireAndForget(
                      uploadMedicalData(deviceId, 'bp', { sys: bp.sys, dia: bp.dia, pulse: bp.pulse }, now, sessionProfileId),
                      `uploadMedicalData(${deviceId}, bp)`
                    );
                    // Generate alert based on BP status
                    const status = evaluateBloodPressure({ sys: bp.sys, dia: bp.dia });
                    handleEvaluatedAlert(deviceId, 'bp', { sys: bp.sys, dia: bp.dia, pulse: bp.pulse }, status, now);
                  }
                }
                return;
              }

              if (uuid === UUIDS.thermometerMeasurement) {
                const t = parseTemp(bytes);
                if (t) {
                  setLiveReading(deviceId, { kind: 'temp', text: t.text, ts: now, values: { c: t.c, celsius: t.c } });
                  if (sessionProfileId && t.c > 0) {
                    fireAndForget(
                      savePersistedLiveReadings(sessionProfileId, { tempC: t.c, tempTs: now }),
                      `savePersistedLiveReadings(${deviceId}, temp)`
                    );
                    fireAndForget(
                      scheduleDailySummaryNotification({ profileId: sessionProfileId, lang: _sessionLang, latestTempC: t.c }),
                      `scheduleDailySummaryNotification(${deviceId}, temp)`
                    );
                  }
                  // Upload temperature data per reading
                  fireAndForget(
                    uploadMedicalData(deviceId, 'temp', { celsius: t.c }, now, sessionProfileId),
                    `uploadMedicalData(${deviceId}, temp)`
                  );
                  // Generate alert based on temperature status
                  const status = evaluateTemperature({ celsius: t.c });
                  handleEvaluatedAlert(deviceId, 'temp', { celsius: t.c }, status, now);
                }
                return;
              }

              if (uuid === UUIDS.glucoseMeasurement) {
                const g = parseGlucose(bytes);
                if (g) {
                  setLiveReading(deviceId, { kind: 'glucose', text: g.text, ts: now, values: { mgdl: g.mgdl } });
                  // Upload glucose data per reading
                  fireAndForget(
                    uploadMedicalData(deviceId, 'glucose', { mgdl: g.mgdl }, now, sessionProfileId),
                    `uploadMedicalData(${deviceId}, glucose)`
                  );
                  // Generate alert based on glucose status
                  const status = evaluateGlucose({ mgdl: g.mgdl });
                  handleEvaluatedAlert(deviceId, 'glucose', { mgdl: g.mgdl }, status, now);
                }
                return;
              }

              // Endpoint UUID fallback
              if (endpointUuid && uuid === endpointUuid) {
                if (preferredKind === 'spo2') {
                  const o = parseOximeter(bytes);
                  if (o) {
                    setLiveReading(deviceId, { kind: 'spo2', text: o.text, ts: now, values: { spo2: o.spo2 ?? -1, pulse: o.pulse ?? -1 } });
                    if (sessionProfileId && (o.spo2 ?? 0) > 0) {
                      fireAndForget(
                        savePersistedLiveReadings(sessionProfileId, { spo2: o.spo2, pulse: o.pulse ?? undefined, spo2Ts: now }),
                        `savePersistedLiveReadings(${deviceId}, spo2-fallback)`
                      );
                      fireAndForget(
                        scheduleDailySummaryNotification({ profileId: sessionProfileId, lang: _sessionLang, latestSpo2: o.spo2, latestPulse: o.pulse ?? undefined }),
                        `scheduleDailySummaryNotification(${deviceId}, spo2-fallback)`
                      );
                    }
                    if (shouldUploadSpo2(deviceId)) {
                      fireAndForget(
                        uploadMedicalData(deviceId, 'spo2', { spo2: o.spo2, pulse: o.pulse }, now, sessionProfileId),
                        `uploadMedicalData(${deviceId}, spo2-fallback)`
                      );
                      const status = evaluateSpO2({ spo2: o.spo2 ?? 0 });
                      handleEvaluatedAlert(deviceId, 'spo2', { spo2: o.spo2, pulse: o.pulse }, status, now);
                    }
                  }
                } else if (preferredKind === 'bp') {
                  const bp = parseBP(bytes, UUIDS.bpMeasurement);
                  if (bp && bp.sys && bp.dia) {
                    setLiveReading(deviceId, { kind: 'bp', text: bp.text, ts: now, values: { sys: bp.sys ?? -1, dia: bp.dia ?? -1, pulse: bp.pulse ?? -1 } });
                    fireAndForget(
                      uploadMedicalData(deviceId, 'bp', { sys: bp.sys, dia: bp.dia, pulse: bp.pulse }, now, sessionProfileId),
                      `uploadMedicalData(${deviceId}, bp-fallback)`
                    );
                    const status = evaluateBloodPressure({ sys: bp.sys, dia: bp.dia });
                    handleEvaluatedAlert(deviceId, 'bp', { sys: bp.sys, dia: bp.dia, pulse: bp.pulse }, status, now);
                  }
                } else if (preferredKind === 'temp') {
                  const t = parseTemp(bytes);
                  if (t) {
                    setLiveReading(deviceId, { kind: 'temp', text: t.text, ts: now, values: { c: t.c, celsius: t.c } });
                    if (sessionProfileId && t.c > 0) {
                      fireAndForget(
                        savePersistedLiveReadings(sessionProfileId, { tempC: t.c, tempTs: now }),
                        `savePersistedLiveReadings(${deviceId}, temp-fallback)`
                      );
                      fireAndForget(
                        scheduleDailySummaryNotification({ profileId: sessionProfileId, lang: _sessionLang, latestTempC: t.c }),
                        `scheduleDailySummaryNotification(${deviceId}, temp-fallback)`
                      );
                    }
                    fireAndForget(
                      uploadMedicalData(deviceId, 'temp', { celsius: t.c }, now, sessionProfileId),
                      `uploadMedicalData(${deviceId}, temp-fallback)`
                    );
                    const status = evaluateTemperature({ celsius: t.c });
                    handleEvaluatedAlert(deviceId, 'temp', { celsius: t.c }, status, now);
                  }
                } else if (preferredKind === 'glucose') {
                  const g = parseGlucose(bytes);
                  if (g) {
                    setLiveReading(deviceId, { kind: 'glucose', text: g.text, ts: now, values: { mgdl: g.mgdl } });
                    fireAndForget(
                      uploadMedicalData(deviceId, 'glucose', { mgdl: g.mgdl }, now, sessionProfileId),
                      `uploadMedicalData(${deviceId}, glucose-fallback)`
                    );
                    const status = evaluateGlucose({ mgdl: g.mgdl });
                    handleEvaluatedAlert(deviceId, 'glucose', { mgdl: g.mgdl }, status, now);
                  }
                }
              }
            });

            monitorHandles.push(monitor as any);
            console.log('[BLE_MON] monitor subscribed for', deviceId, 'svc', normalizeUuid(svc.uuid), 'ch', normalizeUuid(ch.uuid));

            try {
              await enableCccdBestEffort(device as any, svc.uuid, ch.uuid);
            } catch {}
          }
        }

        // Write oximeter control AFTER all monitors and CCCDs are set up
        // This ensures notifications are ready before we start streaming
        if (oximeterControlInfo && !cancelled) {
          const { svcUuid, chUuid } = oximeterControlInfo;
          
          // Small delay to let CCCD writes settle
          await delay(200);
          
          const writeOximeterControl = async () => {
            const v = base64.encode(String.fromCharCode(0x01));
            const anyDevice = device as any;
            if (typeof anyDevice.writeCharacteristicWithResponseForService === 'function') {
              await anyDevice.writeCharacteristicWithResponseForService(svcUuid, chUuid, v);
            } else if (typeof anyDevice.writeCharacteristicWithoutResponseForService === 'function') {
              await anyDevice.writeCharacteristicWithoutResponseForService(svcUuid, chUuid, v);
            }
          };
          
          // Try up to 3 times with delay between attempts
              for (let attempt = 0; attempt < 3; attempt++) {
            try {
              if (attempt > 0) await delay(500);
              console.log('[BLE_MON] writing oximeter control to', deviceId, attempt > 0 ? `(attempt ${attempt + 1})` : '');
              await writeOximeterControl();
              console.log('[BLE_MON] oximeter control write success for', deviceId);
              break; // Success
            } catch (err: any) {
              console.log('[BLE_MON] oximeter control write attempt', attempt + 1, 'failed:', err?.message, err);
              if (attempt === 2) console.log('[BLE_MON] oximeter control write failed after retries for', deviceId);
            }
          }
        }

        // Resume scanning after successful connect
        startScan();
      } catch (err: any) {
        console.log('[BLE_MON] connectAndMonitor error for', deviceId, err?.message);
        connectingDevices.delete(deviceId);
        startScan();
      }
    }

    // Scan callback - check if scanned device matches user's registered devices
    function onDeviceScanned(error: Error | null, device: Device | null) {
      if (cancelled) return;
      if (error) {
        console.log('[BLE_MON] scan callback error:', error?.message || error);
        isScanning = false;
        // While the adapter is off, the scan will keep rejecting immediately —
        // retrying on a timer just spams this every ~750ms with nothing to do.
        // bleStateSub (onStateChange) already calls startScan() the moment the
        // adapter reports PoweredOn again, so just wait for that instead.
        if (/powered off/i.test(error?.message || '')) {
          console.log('[BLE_MON] adapter is off — waiting for onStateChange instead of retrying');
          return;
        }
        scheduleScanRetry(`scan callback error: ${error?.message || error}`);
        return;
      }
      if (!device) return;

      scanRetryAttempt = 0;

      // Normalize the scanned device's MAC and check if it matches a registered target.
      // We check targetMap FIRST so that registered devices are always considered,
      // even if their BLE name doesn't contain "yuwell" (some thermometers advertise
      // with only a model code like "FT87" or "RT1000").
      const scannedMac = normalizeMac(device.id);
      if (!scannedMac) return;

      // Let the AILink / ICOMON scale adapters piggyback on this scan: the scale
      // advertises here too, and each adapter connects it via its own native SDK
      // when it's its target. This reuses the single ble-plx scan (no second
      // scan / conflict).
      try { notifyAilinkDeviceSeen(device.id); } catch { /* ignore */ }
      try { notifyIcomonDeviceSeen(device.id); } catch { /* ignore */ }

      const target = targetMap.get(scannedMac);
      // If not a registered device AND not a Yuwell-named device, skip quickly
      if (!target && !isYuwellDevice(device)) return;
      if (!target) return;

      // Device matches a user's registered device!
      if (!seenDevices.has(scannedMac)) {
        seenDevices.add(scannedMac);
        console.log('[BLE_MON] Yuwell device SEEN:', scannedMac, 'name:', (device as any).name);

        const kind = target.preferredKind;
        const existingReading = getLiveReadingsSnapshot().get(scannedMac.toUpperCase())?.[kind];
        const existingValues = existingReading?.values || {};

        // Only use the initial 0 placeholder when we truly have no valid reading yet.
        // Some devices advertise/reset with zero-like packets after a completed measurement;
        // we keep showing the last valid value instead of flicking back to 0.
        const hasValidExistingReading = (() => {
          if (!existingReading) return false;
          if (kind === 'bp') {
            const sys = Number(existingValues.sys);
            const dia = Number(existingValues.dia);
            return Number.isFinite(sys) && Number.isFinite(dia) && sys > 0 && dia > 0;
          }
          if (kind === 'spo2') {
            const spo2 = Number(existingValues.spo2);
            return Number.isFinite(spo2) && spo2 > 0;
          }
          if (kind === 'temp') {
            const c = Number(existingValues.c);
            return Number.isFinite(c) && c > 0;
          }
          if (kind === 'glucose') {
            const mgdl = Number(existingValues.mgdl);
            return Number.isFinite(mgdl) && mgdl > 0;
          }
          return false;
        })();

        // Intentionally do NOT seed a placeholder reading here. A detected-but-
        // unmeasured device should render as "--" (the standard no-reading state),
        // driven by isConnected/hasDevice — never as a fake "0/0 mmHg" value, which
        // looks like a real (wrong) measurement after a reload clears live readings.
      }

      // If not already connected, connect and monitor
      if (!connectedDevices.has(scannedMac) && !connectingDevices.has(scannedMac)) {
        // Ensure no unhandled promise rejection if anything unexpected escapes connectAndMonitor.
        // Log (but do not rethrow) so the error is visible in dev tools instead of being silently
        // dropped — silent swallows previously masked root causes of "stops working after screen change".
        connectAndMonitor(scannedMac, target.endpointUuid, target.preferredKind).catch((err: any) => {
          if (cancelled) return;
          console.log('[BLE_MON] connectAndMonitor rejected for', scannedMac, err?.reason || err?.message || err);
        });
      }
    }

    function startScan() {
      if (cancelled) return;

      // Debounce: collapse multiple rapid calls (e.g. from simultaneous disconnect
      // callbacks) into a single scan start. The 150 ms window covers the burst.
      if (scanStartTimer !== null) {
        clearTimeout(scanStartTimer);
        scanStartTimer = null;
      }

      if (scanRetryTimer !== null) {
        clearTimeout(scanRetryTimer);
        scanRetryTimer = null;
      }

      // Stop any existing scan first to avoid "Cannot start scanning operation" error
      try {
        Promise.resolve(bleManager.stopDeviceScan()).catch(() => {});
        isScanning = false;
      } catch {
        // ignore
      }

      // Small delay to let BLE stack settle after stopping
      scanStartTimer = setTimeout(() => {
        scanStartTimer = null;
        if (cancelled) return;
        console.log('[BLE_MON] Starting BLE scan for Yuwell devices');
        try {
          Promise.resolve(bleManager.startDeviceScan(null, null, onDeviceScanned)).catch((err: any) => {
            // Avoid noisy redbox: BLE stack can reject when Bluetooth is off / permissions missing
            console.log('[BLE_MON] startDeviceScan rejected:', err?.message);
            isScanning = false;
            scheduleScanRetry(`startDeviceScan rejected: ${err?.message || err}`);
          });
          isScanning = true;
          // NOTE: do not reset scanRetryAttempt here — startDeviceScan() resolving
          // just means the request was accepted, not that the scan is actually
          // producing results (e.g. BT powered off still "succeeds" here and only
          // reports the real error later via onDeviceScanned's error callback).
          // Resetting it unconditionally on every startScan() call defeated the
          // exponential backoff below, pinning every retry at the 750ms floor.
          // The legitimate reset lives in onDeviceScanned, on an actual scan result.
        } catch (err: any) {
          console.log('[BLE_MON] startDeviceScan error:', err?.message);
          isScanning = false;
          scheduleScanRetry(`startDeviceScan error: ${err?.message || err}`);
        }
      }, 150);
    }

    // Reset the native BLE manager before starting to ensure a clean stack.
    // This is critical after app resume from background/doze where the
    // previous native manager may be in a stale or broken state.
    (async () => {
      try {
        await resetBleManager('session start');
      } catch {}
      if (cancelled) return;

      try {
        bleStateSub = bleManager.onStateChange((nextState: string) => {
          if (cancelled) return;
          console.log('[BLE_MON] adapter state:', nextState);
          if (nextState === 'PoweredOn') {
            startScan();
          }
        }, true);
      } catch {
        bleStateSub = null;
      }

      startScan();
    })();

    return () => {
      stopAll();
    };
  }, [active, targetMap, restartKey, scanForScaleHandoff]);

  useEffect(() => {
    if (active) return;
    try {
      stopRef.current?.();
    } catch {}
  }, [active]);
}
