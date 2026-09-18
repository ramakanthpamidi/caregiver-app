import { Platform } from 'react-native';
import type { AILinkScaleEvent } from './ailinkScale';

// Adapter: bridges the ICOMON / Welland ICDeviceManager BLE scale (native module
// in modules/icomon-scale) into the SAME AILinkScaleEvent shape the AILink
// adapter (./ailinkScale.ts) already produces. Every downstream consumer
// (Home's weight card extraction, Trends, Alerts) reads that shared shape, so
// reusing it here means zero changes are needed anywhere else for ICOMON
// events to flow through the exact same pipeline as AILink's.

export type IcomonScaleEvent = AILinkScaleEvent;

// ICOMON scales are frequently factory-renamed to a generic name like
// "MY_SCALE" (with underscore/space/hyphen or none between the words), so
// match that alongside the actual brand names.
const ICOMON_NAME_PATTERN = /icomon|welland|my[\s_-]?scale/i;

// ---- our native Expo module (modules/icomon-scale) ------------------------
type ScaleNative = {
  initialize?: () => Promise<unknown>;
  setUserInfo?: (sex: number, age: number, heightCm: number) => Promise<unknown>;
  start?: (mac: string | null, scanTimeoutMs: number) => Promise<unknown>;
  stop?: () => Promise<unknown>;
  addListener: (event: string, cb: (e: any) => void) => { remove: () => void };
};

let scaleNative: ScaleNative | null | undefined;
function getScaleNative(): ScaleNative | null {
  if (scaleNative !== undefined) return scaleNative;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require('expo-modules-core');
    scaleNative = requireNativeModule('IcomonScale') as ScaleNative;
  } catch {
    scaleNative = null;
  }
  return scaleNative;
}

// ---- listeners ------------------------------------------------------------
const listeners = new Set<(event: IcomonScaleEvent) => void>();
function emit(event: IcomonScaleEvent) {
  for (const listener of listeners) {
    try { listener({ ts: Date.now(), ...event }); } catch { /* ignore */ }
  }
}

function num(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Translate our module's `onScaleEvent` payloads into IcomonScaleEvent.
function translate(e: any): IcomonScaleEvent | null {
  switch (e?.type) {
    case 'scanning':
      return { type: 'scan_started' };
    case 'scanFound':
      return { type: 'scan', mac: e.mac, name: e.name, displayName: e.name };
    case 'connecting':
      return { type: 'connecting', mac: e.mac };
    case 'connected':
      return { type: 'connected', mac: e.mac };
    case 'weight':
      return { type: 'weight', weightKg: num(e.weightKg), stable: !!e.stable };
    case 'bodyfat':
      return {
        type: 'complete',
        weightKg: num(e.weightKg),
        bodyFat: {
          bodyFat: num(e.bodyFatPct),
          muscle: num(e.musclePct),
          water: num(e.waterPct),
          protein: num(e.proteinPct),
          visceralFat: num(e.visceralFat),
          bmi: num(e.bmi),
          bmr: num(e.bmr),
          bodyAge: e.bodyAge,
          heartRate: e.heartRate,
        },
      };
    case 'final':
      // Plain weight/BMI measurement — no impedance/body-composition data.
      return { type: 'complete', weightKg: num(e.weightKg), bodyFat: { bmi: num(e.bmi) } };
    case 'disconnected':
      return { type: 'disconnected' };
    case 'error':
      return { type: 'error', message: e.message };
    default:
      return null; // 'heartRate' — not surfaced to the scale UI
  }
}

export function isIcomonAvailable() {
  return Platform.OS === 'android' && !!getScaleNative();
}

export function addIcomonScaleListener(listener: (event: IcomonScaleEvent) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// ---- monitoring: piggyback the device monitor's scan, native connect --------
// Same design as ailinkScale.ts: the device monitor (bleLiveMonitor) owns the
// single ble-plx scan. It calls notifyIcomonDeviceSeen() for every scanned
// device; when our target scale is spotted advertising (i.e. the user just
// stepped on), we fire a single direct native connect. No extra scan.
let monitorSub: { remove: () => void } | null = null;
let monitorMac: string | null = null;
let monitorMacSet = new Set<string>();
let monitorActive = false;
let connectInFlight = false;
let connectWatchdog: ReturnType<typeof setTimeout> | null = null;

function normalizeMac(value: string) {
  return String(value || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

/**
 * Called by the device monitor's ble-plx scan for every advertising device.
 * When the target scale is seen, connect once via the native SDK.
 */
export function notifyIcomonDeviceSeen(mac: string) {
  if (!monitorActive || connectInFlight) return;
  const id = normalizeMac(mac);
  if (!id || !monitorMacSet.has(id)) return;

  console.log('[ICOMON] target scale seen, connecting:', mac);
  const native = getScaleNative();
  if (!native) return;
  connectInFlight = true;
  emit({ type: 'connecting', mac });
  native.start?.(mac, 30000);

  // Watchdog: if the connect doesn't land (no 'connected' event), abort the
  // stalled attempt and release the guard so the next advertisement can retry.
  // Just clearing the flag without stopping the native session would let the
  // next retry's native.start() race the still in-flight first attempt.
  if (connectWatchdog) clearTimeout(connectWatchdog);
  connectWatchdog = setTimeout(() => {
    connectInFlight = false;
    try { getScaleNative()?.stop?.(); } catch { /* ignore */ }
  }, 15000);
}

export function startIcomonMonitoring(options: {
  deviceIds: string[];
  profile?: { age?: number; sex?: number; heightCm?: number; weightKg?: number };
}) {
  const native = getScaleNative();
  if (!native) return;

  const ids = (options.deviceIds || []).filter(Boolean);
  const mac = ids.find(Boolean) || null;
  if (!mac) return;

  // Restarting with the same device? Leave the existing session running.
  if (monitorActive && monitorMac === mac) return;

  stopIcomonMonitoring();
  monitorActive = true;
  monitorMac = mac;
  monitorMacSet = new Set(ids.map(normalizeMac).filter(Boolean));
  console.log('[ICOMON] startIcomonMonitoring, watching for:', Array.from(monitorMacSet));

  const p = options.profile;
  native.setUserInfo?.(p?.sex ?? 1, p?.age ?? 30, p?.heightCm ?? 160);
  native.initialize?.();

  monitorSub = native.addListener('onScaleEvent', (e: any) => {
    console.log('[ICOMON] native event:', e?.type, e);
    const translated = translate(e);
    if (translated) emit(translated);

    if (e?.type === 'connected') {
      connectInFlight = true; // hold the guard for the whole session
      if (connectWatchdog) { clearTimeout(connectWatchdog); connectWatchdog = null; }
    }
    // Scale dropped (stepped off / measurement done) or a connect failed:
    // release the guard so the next advertisement (next step-on) reconnects.
    if ((e?.type === 'disconnected' || e?.type === 'error') && monitorActive) {
      connectInFlight = false;
      if (connectWatchdog) { clearTimeout(connectWatchdog); connectWatchdog = null; }
    }
  });
}

export function stopIcomonMonitoring() {
  monitorActive = false;
  monitorMac = null;
  monitorMacSet = new Set();
  connectInFlight = false;
  if (connectWatchdog) { clearTimeout(connectWatchdog); connectWatchdog = null; }
  try { monitorSub?.remove(); } catch { /* ignore */ }
  monitorSub = null;
  try { getScaleNative()?.stop?.(); } catch { /* ignore */ }
}

// ---- text helpers -----------------------------------------------------------
export function isIcomonBrandText(text: string) {
  return ICOMON_NAME_PATTERN.test(String(text || '').trim());
}
