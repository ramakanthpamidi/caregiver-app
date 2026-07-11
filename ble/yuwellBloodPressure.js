// ble/yuwellBloodPressure.js — Yuwell BP monitor (standard Blood Pressure service).
// Service 0x1810: 0x2A35 = final measurement (indication), 0x2A36 = live cuff pressure.
import { advertisesService, createDeviceSession, deviceNameOf, monitorChar, writeCurrentTime } from './bleClient';

const BP_SERVICE = '00001810-0000-1000-8000-00805f9b34fb';
const BP_MEASUREMENT = '00002a35-0000-1000-8000-00805f9b34fb';
const CUFF_PRESSURE = '00002a36-0000-1000-8000-00805f9b34fb';

const KPA_TO_MMHG = 7.50062;

function matcher(device) {
  const name = deviceNameOf(device);
  return (
    name.includes('yuwell') ||
    name.includes('ye') ||
    name.includes('bp') ||
    name.includes('blood') ||
    name.includes('pressure') ||
    advertisesService(device, '1810')
  );
}

function parseBloodPressure(bytes) {
  if (!bytes || bytes.length < 7) return null;

  const flags = bytes[0];
  const unitKpa = (flags & 0x01) !== 0;
  const hasTime = (flags & 0x02) !== 0;
  const hasPulse = (flags & 0x04) !== 0;

  const toMmHg = (v) => Math.round(unitKpa ? v * KPA_TO_MMHG : v);

  let index = 1;
  const systolic = bytes[index] | (bytes[index + 1] << 8);
  index += 2;
  const diastolic = bytes[index] | (bytes[index + 1] << 8);
  index += 2;
  const meanPressure = bytes[index] | (bytes[index + 1] << 8);
  index += 2;

  if (hasTime) index += 7;

  let pulse = null;
  if (hasPulse && bytes.length >= index + 2) {
    pulse = bytes[index] | (bytes[index + 1] << 8);
  }

  return {
    systolic: toMmHg(systolic),
    diastolic: toMmHg(diastolic),
    map: toMmHg(meanPressure),
    pulse,
  };
}

const session = createDeviceSession({
  matcher,
  onConnected: async (device, { addSub, callbacks, isActive }) => {
    await writeCurrentTime(device); // best-effort record-time sync

    let finalized = false;

    // Final measurement indication — arrives once the cuff finishes deflating
    addSub(
      monitorChar(device, BP_SERVICE, BP_MEASUREMENT, (data) => {
        if (!isActive() || finalized) return;
        const reading = parseBloodPressure(data);
        if (!reading) return;
        finalized = true;
        callbacks.onFinal?.(reading);
      })
    );

    // Live cuff pressure during inflation
    addSub(
      monitorChar(device, BP_SERVICE, CUFF_PRESSURE, (data) => {
        if (!isActive() || finalized) return;
        if (!data || data.length < 3) return;
        const cuff = data[1] | (data[2] << 8);
        callbacks.onLive?.(null, `Measuring — cuff pressure ${cuff} mmHg`);
      })
    );

    callbacks.onLive?.(null, 'Press START on the BP monitor to begin the measurement');
  },
});

export default session;
