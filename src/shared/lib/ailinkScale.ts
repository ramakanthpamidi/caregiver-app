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
  if (event.type === 'complete' || event.type === 'connected' || event.type === 'error') {
    console.log('[ailink-adapter] emit', event.type, 'weightKg=', event.weightKg, 'listeners=', listeners.size);
  }
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

// ---- discovery (ble-plx) --------------------------------------------------
let discoveryActive = false;
export function startAilinkDiscovery() {
  if (discoveryActive) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getManager, deviceNameOf } = require('../../../ble/bleClient');
    const manager = getManager();
    discoveryActive = true;
    emit({ type: 'scan_started' });
    manager.startDeviceScan(null, { allowDuplicates: false }, (err: any, device: any) => {
      if (err || !device) return;
      const name = deviceNameOf(device);
      if (AILINK_NAME_PATTERN.test(name) || isWeightScaleText(name)) {
        emit({
          type: 'scan',
          mac: device.id,
          name: device.name || device.localName,
          displayName: device.name || device.localName,
        });
      }
    });
  } catch { /* ble unavailable */ }
}

export function stopAilinkDiscovery() {
  if (!discoveryActive) return;
  discoveryActive = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getManager } = require('../../../ble/bleClient');
    getManager().stopDeviceScan();
  } catch { /* ignore */ }
}

// ---- monitoring (our native module, by registered MAC) --------------------
let monitorSub: { remove: () => void } | null = null;
let monitorMac: string | null = null;
let monitorActive = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function startAilinkMonitoring(options: {
  deviceIds: string[];
  profile?: { age?: number; sex?: number; heightCm?: number; weightKg?: number };
}) {
  const native = getScaleNative();
  if (!native) return;

  const mac = (options.deviceIds || []).find(Boolean) || null;
  if (!mac) return;

  // Restarting with the same device? Leave the existing session running.
  if (monitorActive && monitorMac === mac) return;

  stopAilinkMonitoring();
  monitorActive = true;
  monitorMac = mac;

  const p = options.profile;
  native.setUserInfo?.(p?.sex ?? 1, p?.age ?? 30, p?.heightCm ?? 170);
  native.initialize?.();

  monitorSub = native.addListener('onScaleEvent', (e: any) => {
    const translated = translate(e);
    if (translated) emit(translated);
    // Keep the monitor alive: reconnect after the scale drops (user stepped off).
    if (e?.type === 'disconnected' && monitorActive && monitorMac) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (monitorActive && monitorMac) native.start?.(monitorMac, 30000);
      }, 1500);
    }
  });

  native.start?.(mac, 30000);
}

export function stopAilinkMonitoring() {
  monitorActive = false;
  monitorMac = null;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
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
