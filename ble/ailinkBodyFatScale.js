// ble/ailinkBodyFatScale.js — AILink 8-electrode body fat scale.
// Backed by the native module in modules/ailink-scale (AILink vendor SDK);
// exposes the same { start, stop } session contract as the Yuwell modules so
// DeviceScreen can drive it unchanged. Android only; requires a development
// build that includes the native module.
import { deviceNameOf, getManager, requestBlePermissions, scanForDevice, waitForPoweredOn } from './bleClient';

// A scanned device is our scale if its name looks like an AILink scale.
function isScale(device) {
  const n = deviceNameOf(device);
  return n.includes('ailink') || n.includes('cb6d') || n.includes('scale') || n.includes('bodyfat') || n.includes('cf');
}

let native = null;
function getNative() {
  if (native) return native;
  const { requireNativeModule } = require('expo-modules-core');
  native = requireNativeModule('AilinkScale');
  return native;
}

let subscription = null;
let userInfo = { sex: 1, age: 30, heightCm: 170 };

const fmt = (v, digits = 1) => (typeof v === 'number' && v > 0 ? v.toFixed(digits) : '—');

function mapBodyFat(e) {
  return {
    weightKg: fmt(e.weightKg),
    bmi: fmt(e.bmi),
    bodyFatPct: fmt(e.bodyFatPct),
    musclePct: fmt(e.musclePct),
    waterPct: fmt(e.waterPct),
    proteinPct: fmt(e.proteinPct),
    visceralFat: fmt(e.visceralFat),
    bmr: fmt(e.bmr, 0),
    bodyAge: e.bodyAge > 0 ? String(e.bodyAge) : '—',
    heartRate: e.heartRate > 0 ? String(e.heartRate) : '—',
  };
}

const session = {
  /** Call before start(): { sex: 1|0 (male|female), age, heightCm } — feeds the body-composition algorithm. */
  setUserInfo(info) {
    userInfo = { ...userInfo, ...info };
  },

  async start(callbacks = {}) {
    const { onStatus, onLive, onFinal, onError } = callbacks;
    try {
      const granted = await requestBlePermissions();
      if (!granted) {
        onError?.('Bluetooth permission was denied. Please allow Bluetooth access and try again.');
        return;
      }

      let scale;
      try {
        scale = getNative();
      } catch {
        onError?.(
          'The body fat scale module is not included in this build. Create a new development build (eas build --profile development --platform android) and try again.'
        );
        return;
      }

      await session.stop();
      let finished = false;
      await scale.setUserInfo(userInfo.sex, userInfo.age, userInfo.heightCm);

      // Bind the native AILink service early (async) so it's ready by the time
      // we hand it a MAC to connect to.
      scale.initialize?.().catch(() => {});

      subscription = scale.addListener('onScaleEvent', (e) => {
        switch (e.type) {
          case 'scanning':
            onStatus?.('scanning');
            onLive?.(null, 'Scanning for the scale — step on it to wake it up');
            break;
          case 'scanFound':
            onLive?.(null, `Found ${e.name || 'device'} (CID ${e.cid})`);
            break;
          case 'connecting':
            onStatus?.('connecting');
            onLive?.(null, `Connecting to ${e.name || 'scale'}…`);
            break;
          case 'connected':
            onStatus?.('connected');
            onLive?.(null, 'Step on the scale barefoot and grip both handles');
            break;
          case 'weight':
            onLive?.(
              { weightKg: fmt(e.weightKg) },
              e.stable ? 'Weight locked — keep holding the handles for body composition' : 'Measuring weight…'
            );
            break;
          case 'heartRate':
            onLive?.({ heartRate: String(e.heartRate) });
            break;
          case 'note':
            onLive?.(null, e.message);
            break;
          case 'bodyfat':
            finished = true;
            onFinal?.(mapBodyFat(e));
            session.stop();
            break;
          case 'measureEnd':
            // Weight-only fallback when impedance/body composition was unavailable
            finished = true;
            onFinal?.({ ...mapBodyFat({}), weightKg: fmt(e.weightKg), heartRate: e.heartRate > 0 ? String(e.heartRate) : '—' });
            session.stop();
            break;
          case 'disconnected':
            if (!finished) callbacks.onDisconnected?.();
            break;
          case 'error':
            if (!finished) onError?.(e.message);
            break;
        }
      });

      // Discover the scale's MAC with the reliable ble-plx scanner, then hand
      // it to the native AILink SDK to connect by address. Falls back to the
      // SDK's own broadcast-UUID scan if ble-plx discovery finds nothing.
      onStatus?.('scanning');
      onLive?.(null, 'Searching for the scale — step on it to wake it up');
      let mac = null;
      try {
        const manager = getManager();
        await waitForPoweredOn(manager);
        const device = await scanForDevice(manager, isScale, 20000);
        mac = device.id;
        try { manager.stopDeviceScan(); } catch {}
      } catch {
        mac = null; // let the native AILink scan try
      }

      await scale.start(mac, 30000);
    } catch (err) {
      onError?.(err?.message ?? String(err));
    }
  },

  async stop() {
    subscription?.remove();
    subscription = null;
    try {
      await getNative().stop();
    } catch {}
  },
};

export default session;
