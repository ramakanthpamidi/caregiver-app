// ble/bleClient.js — shared BLE plumbing for all Yuwell device modules.
// Requires a development build (npx expo run:android / eas build); the native
// BLE module is not available in Expo Go or on web.
import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';

let manager = null;

export function getManager() {
  if (manager) return manager;
  try {
    const { BleManager } = require('react-native-ble-plx');
    manager = new BleManager();
    return manager;
  } catch {
    throw new Error(
      'Bluetooth is not available in this build. Run the app as a development build (npx expo run:android) — BLE does not work in Expo Go or on web.'
    );
  }
}

export async function requestBlePermissions() {
  if (Platform.OS !== 'android') return true;

  if (Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  // Android 11 and below need location permission for BLE scans
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function waitForPoweredOn(bleManager, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    let sub = null;
    const timer = setTimeout(() => {
      sub?.remove();
      reject(new Error('Bluetooth is turned off. Please enable Bluetooth and try again.'));
    }, timeoutMs);
    sub = bleManager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        clearTimeout(timer);
        sub?.remove();
        resolve();
      }
    }, true);
  });
}

export function scanForDevice(bleManager, matcher, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { bleManager.stopDeviceScan(); } catch {}
      fn(arg);
    };
    const timer = setTimeout(
      () => finish(reject, new Error('No compatible device found nearby. Make sure the device is switched on, in pairing mode and within a few feet, then try again.')),
      timeoutMs
    );
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) return finish(reject, error);
      if (device && matcher(device)) finish(resolve, device);
    });
  });
}

export function deviceNameOf(device) {
  return (device?.name || device?.localName || '').toLowerCase();
}

export function advertisesService(device, shortUuid) {
  const target = shortUuid.toLowerCase();
  return (device?.serviceUUIDs || []).some((u) => {
    const uuid = u.toLowerCase();
    return uuid === target || uuid.startsWith(`0000${target}`);
  });
}

/** Monitor a characteristic, delivering decoded byte Buffers. Returns the subscription. */
export function monitorChar(device, serviceUUID, charUUID, onBytes, onError) {
  return device.monitorCharacteristicForService(serviceUUID, charUUID, (error, characteristic) => {
    if (error) {
      onError?.(error);
      return;
    }
    if (!characteristic?.value) return;
    try {
      onBytes(Buffer.from(characteristic.value, 'base64'));
    } catch {}
  });
}

/**
 * Creates a start/stop session for one device type.
 *  - matcher(device): true when a scanned device is the one we want
 *  - onConnected(device, { addSub, callbacks }): register monitors / do setup
 *
 * start(callbacks) callbacks:
 *  - onStatus('scanning' | 'connecting' | 'connected')
 *  - onLive(values | null, note)   — partial live readings and/or a status note
 *  - onFinal(values)               — the settled measurement
 *  - onError(message)
 */
export function createDeviceSession({ matcher, onConnected }) {
  const state = { device: null, subs: [], active: false };

  async function cleanup() {
    for (const sub of state.subs) {
      try { sub.remove(); } catch {}
    }
    state.subs = [];
    if (state.device) {
      const device = state.device;
      state.device = null;
      try { await device.cancelConnection(); } catch {}
    }
    if (manager) {
      try { manager.stopDeviceScan(); } catch {}
    }
  }

  async function stop() {
    state.active = false;
    await cleanup();
  }

  async function start(callbacks = {}) {
    const { onStatus, onError } = callbacks;
    try {
      const granted = await requestBlePermissions();
      if (!granted) {
        onError?.('Bluetooth permission was denied. Please allow Bluetooth access and try again.');
        return;
      }

      const bleManager = getManager();
      await cleanup();
      state.active = true;

      await waitForPoweredOn(bleManager);
      onStatus?.('scanning');
      const found = await scanForDevice(bleManager, matcher);
      if (!state.active) return;

      onStatus?.('connecting');
      const device = await bleManager.connectToDevice(found.id, { timeout: 15000 });
      if (!state.active) {
        device.cancelConnection().catch(() => {});
        return;
      }
      state.device = device;
      await device.discoverAllServicesAndCharacteristics();

      state.subs.push(
        bleManager.onDeviceDisconnected(device.id, () => {
          if (!state.active) return;
          state.device = null;
          callbacks.onDisconnected?.();
        })
      );

      await onConnected(device, {
        addSub: (sub) => state.subs.push(sub),
        callbacks,
        isActive: () => state.active,
      });
      if (!state.active) return;
      onStatus?.('connected');
    } catch (e) {
      if (!state.active && !(e?.message || '').includes('not available in this build')) return;
      await stop();
      onError?.(e?.message ?? String(e));
    }
  }

  return { start, stop, isActive: () => state.active };
}

/** Write the Current Time (service 0x1805 / char 0x2A2B) — Yuwell devices use this for record timestamps. */
export async function writeCurrentTime(device) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    let dayOfWeek = now.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;
    const timeData = Buffer.from([
      year & 0xff,
      (year >> 8) & 0xff,
      now.getMonth() + 1,
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      dayOfWeek,
      0, // fractions
      0, // adjust reason
    ]);
    await device.writeCharacteristicWithResponseForService(
      '00001805-0000-1000-8000-00805f9b34fb',
      '00002a2b-0000-1000-8000-00805f9b34fb',
      timeData.toString('base64')
    );
    return true;
  } catch {
    return false; // time sync is best-effort
  }
}
