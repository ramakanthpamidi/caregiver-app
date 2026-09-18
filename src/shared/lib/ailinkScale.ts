import { Platform } from 'react-native';

// Adapter: bridges the ported app's AILink scale API to OUR working Expo module
// (`AilinkScale`, event `onScaleEvent`) plus ble-plx for discovery. This replaces
// the original bridge that expected a `NativeModules.AILinkScale` module which
// isn't present in this build. All exported signatures are preserved so the
// ported Home/Devices UI works unchanged.

export type AILinkScaleEvent = {
  type: 'scan' | 'scan_started' | 'connecting' | 'connected' | 'weight' | 'complete' | 'disconnected' | 'error';
  id?: string;
  mac?: string;
  name?: string;
  cid?: number;
  vid?: number;
  pid?: number;
  source?: string;
  displayName?: string;
  factoryName?: string;
  ts?: number;
  stable?: boolean;
  text?: string;
  weightKg?: number;
  bodyFat?: Record<string, unknown>;
  message?: string;
  code?: number;
};

const AILINK_NAME_PATTERN = /(?:^|[\s_-])ailink(?:[\s_-]|$)/i;

// ---- our native Expo module (modules/ailink-scale) ------------------------
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
    scaleNative = requireNativeModule('AilinkScale') as ScaleNative;
  } catch {
    scaleNative = null;
  }
  return scaleNative;
}

// ---- listeners ------------------------------------------------------------
const listeners = new Set<(event: AILinkScaleEvent) => void>();
function emit(event: AILinkScaleEvent) {
  for (const listener of listeners) {
    try { listener({ ts: Date.now(), ...event }); } catch { /* ignore */ }
  }
}

function num(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Translate our module's `onScaleEvent` payloads into AILinkScaleEvent.
function translate(e: any): AILinkScaleEvent | null {
  switch (e?.type) {
    case 'scanning':
      return { type: 'scan_started' };
    case 'scanFound':
      return { type: 'scan', mac: e.mac, name: e.name, displayName: e.name, cid: e.cid };
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
          boneMass: num(e.boneMassKg),
          bodyAge: e.bodyAge,
          heartRate: e.heartRate,
        },
      };
    case 'measureEnd':
      return { type: 'complete', weightKg: num(e.weightKg) };
    case 'disconnected':
      return { type: 'disconnected' };
    case 'error':
      return { type: 'error', message: e.message };
    default:
      return null; // 'note', 'heartRate' — not surfaced to the scale UI
  }
}

export function isAilinkAvailable() {
  return Platform.OS === 'android' && !!getScaleNative();
}

export function addAilinkScaleListener(listener: (event: AILinkScaleEvent) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}


// ---- monitoring: piggyback the device monitor's scan, native connect --------
// The native AILink SDK scan does not reliably match this scale's advertisement
// (it broadcasts on the F0A0 UUID). And this adapter must NEVER run its own
// ble-plx scan: the device monitor (bleLiveMonitor) owns the single ble-plx
// scan, and ble-plx allows one scan per manager — a second scan kills the Yuwell
// device discovery.
//
// bleLiveMonitor already scans ALL advertising devices, so it sees the scale
// too. It calls notifyAilinkDeviceSeen() for every scanned device; when our
// target scale is spotted advertising (i.e. the user just stepped on), we fire a
// single direct native connect, which lands immediately because the scale is up
// right now. No extra scan, no ble-plx conflict.
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
export function notifyAilinkDeviceSeen(mac: string) {
  if (!monitorActive || connectInFlight) return;
  const id = normalizeMac(mac);
  if (!id || !monitorMacSet.has(id)) return;

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

export function startAilinkMonitoring(options: {
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

  stopAilinkMonitoring();
  monitorActive = true;
  monitorMac = mac;
  monitorMacSet = new Set(ids.map(normalizeMac).filter(Boolean));

  const p = options.profile;
  native.setUserInfo?.(p?.sex ?? 1, p?.age ?? 30, p?.heightCm ?? 160);
  native.initialize?.();

  monitorSub = native.addListener('onScaleEvent', (e: any) => {
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

export function stopAilinkMonitoring() {
  monitorActive = false;
  monitorMac = null;
  monitorMacSet = new Set();
  connectInFlight = false;
  if (connectWatchdog) { clearTimeout(connectWatchdog); connectWatchdog = null; }
  try { monitorSub?.remove(); } catch { /* ignore */ }
  monitorSub = null;
  try { getScaleNative()?.stop?.(); } catch { /* ignore */ }
}

// ---- text helpers (unchanged) --------------------------------------------
export function isAilinkBrandText(text: string) {
  return AILINK_NAME_PATTERN.test(String(text || '').trim());
}

export function isWeightScaleText(text: string) {
  const normalized = String(text || '').toLowerCase();
  return (
    normalized.includes('weight') ||
    normalized.includes('scale') ||
    normalized.includes('body fat') ||
    isAilinkBrandText(normalized)
  );
}
