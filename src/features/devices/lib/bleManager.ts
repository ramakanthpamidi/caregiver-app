import { BleManager } from 'react-native-ble-plx';
import { Platform } from 'react-native';

function makeNoopManager() {
  const noop = () => {};
  return {
    startDeviceScan: noop,
    stopDeviceScan: async () => {},
    cancelDeviceConnection: async (_: string) => {},
    connectToDevice: async (_: string) => {
      throw new Error('BleManager not available');
    },
    onDeviceDisconnected: (_deviceId: string, _cb: () => void) => ({ remove: noop }),
    onStateChange: (_cb: (state: string) => void, _emitCurrentState?: boolean) => ({ remove: noop }),
    state: async () => 'Unknown',
    enable: async () => {},
    destroy: async () => {},
  } as any;
}

function canUseNativeBle() {
  const isJest = (globalThis as any)?.process?.env?.JEST_WORKER_ID;
  return !isJest && Platform.OS !== 'web';
}

function createNativeManager() {
  if (!canUseNativeBle()) {
    return makeNoopManager();
  }
  try {
    return new BleManager();
  } catch {
    return makeNoopManager();
  }
}

async function destroyManagerInstance(manager: any) {
  if (!manager) return;
  try {
    await Promise.resolve(manager.stopDeviceScan?.());
  } catch {
    // ignore
  }
  try {
    await Promise.resolve(manager.destroy?.());
  } catch (err: any) {
    console.log('[BLE_MGR] destroy ignored:', err?.message || err);
  }
}

let currentManager: any = createNativeManager();

function getCurrentManager() {
  return currentManager;
}

export function base64ToBytes(b64: string): number[] {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup: number[] = new Array(256).fill(-1);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const out: number[] = [];
  let bitBuffer = 0;
  let bitLen = 0;
  for (let i = 0; i < b64.length; i++) {
    const c = b64.charCodeAt(i);
    if (c === 61) break; // '=' padding
    const v = lookup[c];
    if (v === -1) continue;
    bitBuffer = (bitBuffer << 6) | v;
    bitLen += 6;
    if (bitLen >= 8) {
      bitLen -= 8;
      out.push((bitBuffer >> bitLen) & 0xff);
    }
  }
  return out;
}

const _connecting = new Map<string, Promise<any>>();
const _connected = new Set<string>();
let resetInFlight: Promise<void> | null = null;

/** Forcefully clear connection state for a device (useful when device silently disconnects) */
export function clearDeviceConnectionState(deviceId: string) {
  console.log('[BLE_MGR] clearDeviceConnectionState called for', deviceId);
  _connected.delete(deviceId);
  _connecting.delete(deviceId);
}

/** Check if device is marked as connected in JS-side state */
export function isDeviceMarkedConnected(deviceId: string): boolean {
  return _connected.has(deviceId);
}

export async function resetBleManager(reason = 'unspecified'): Promise<void> {
  if (resetInFlight) {
    await resetInFlight;
    return;
  }

  resetInFlight = (async () => {
    console.log('[BLE_MGR] resetBleManager called:', reason);
    const previous = currentManager;
    _connected.clear();
    _connecting.clear();
    currentManager = makeNoopManager();
    await destroyManagerInstance(previous);
    currentManager = createNativeManager();
  })().finally(() => {
    resetInFlight = null;
  });

  await resetInFlight;
}

/** Stop any active scan and give the Android BLE stack a moment to release. */
export async function ensureScanStopped(settleMs = 250): Promise<void> {
  try {
    await Promise.resolve(getCurrentManager().stopDeviceScan?.());
  } catch {
    // ignore — already stopped or adapter unavailable
  }
  if (settleMs > 0) {
    await new Promise((r) => setTimeout(r, settleMs));
  }
}

export const bleManager: any = {
  startDeviceScan(...args: any[]) {
    return getCurrentManager().startDeviceScan(...args);
  },

  stopDeviceScan(...args: any[]) {
    return getCurrentManager().stopDeviceScan(...args);
  },

  async connectToDevice(deviceId: string, ...args: any[]) {
    console.log('[BLE_MGR] connectToDevice called for', deviceId);
    if (!deviceId) return Promise.reject(new Error('invalid device id'));
    if (_connecting.has(deviceId)) {
      console.log('[BLE_MGR] connectToDevice - already connecting, returning existing promise for', deviceId);
      return _connecting.get(deviceId)!;
    }
    if (_connected.has(deviceId)) {
      console.log('[BLE_MGR] connectToDevice - already connected (JS-side), rejecting for', deviceId);
      return Promise.reject(new Error('already_connected'));
    }

    const manager = getCurrentManager();
    const promise = (async () => {
      try {
        const device = await manager.connectToDevice(deviceId, ...args);
        console.log('[BLE_MGR] connectToDevice - native connect resolved for', deviceId);
        _connected.add(deviceId);

        try {
          manager.onDeviceDisconnected(deviceId, () => {
            console.log('[BLE_MGR] onDeviceDisconnected callback for', deviceId);
            _connected.delete(deviceId);
            _connecting.delete(deviceId);
          });
        } catch {
          // ignore if listener fails
        }

        return device;
      } finally {
        _connecting.delete(deviceId);
      }
    })();
    _connecting.set(deviceId, promise);
    return promise;
  },

  async cancelDeviceConnection(deviceId: string, ...args: any[]) {
    console.log('[BLE_MGR] cancelDeviceConnection called for', deviceId);
    try {
      const result = await getCurrentManager().cancelDeviceConnection(deviceId, ...args);
      console.log('[BLE_MGR] cancelDeviceConnection succeeded for', deviceId);
      _connected.delete(deviceId);
      _connecting.delete(deviceId);
      return result;
    } catch (err: any) {
      console.log('[BLE_MGR] cancelDeviceConnection failed for', deviceId, err?.message || err);
      _connected.delete(deviceId);
      _connecting.delete(deviceId);
      throw err;
    }
  },

  onDeviceDisconnected(deviceId: string, callback: (...args: any[]) => void) {
    return getCurrentManager().onDeviceDisconnected(deviceId, (...args: any[]) => {
      _connected.delete(deviceId);
      _connecting.delete(deviceId);
      return callback?.(...args);
    });
  },

  onStateChange(callback: (...args: any[]) => void, emitCurrentState?: boolean) {
    return getCurrentManager().onStateChange(callback, emitCurrentState);
  },

  state() {
    return getCurrentManager().state();
  },

  enable() {
    const manager = getCurrentManager();
    if (typeof manager.enable === 'function') {
      return manager.enable();
    }
    return Promise.resolve();
  },

  async destroy() {
    _connected.clear();
    _connecting.clear();
    await destroyManagerInstance(getCurrentManager());
  },
};
