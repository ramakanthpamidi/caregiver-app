// ble/yuwellThermometer.js — Yuwell thermometer (standard Health Thermometer service).
// Service 0x1809 / characteristic 0x2A1C (Temperature Measurement, indication).
// Temperature is an IEEE-11073 FLOAT: 24-bit little-endian mantissa + signed exponent.
import { advertisesService, createDeviceSession, deviceNameOf, monitorChar } from './bleClient';

const THERMO_SERVICE = '00001809-0000-1000-8000-00805f9b34fb';
const TEMP_MEASUREMENT = '00002a1c-0000-1000-8000-00805f9b34fb';

const SITE_LABELS = {
  0x01: 'Armpit',
  0x02: 'Body (general)',
  0x03: 'Ear',
  0x04: 'Finger',
  0x05: 'GI Tract',
  0x06: 'Mouth',
  0x07: 'Rectum',
  0x08: 'Toe',
  0x09: 'Tympanum',
  0x0a: 'Forehead',
  0x0b: 'Temporal Artery',
  0x0c: 'Wrist',
};

function matcher(device) {
  const name = deviceNameOf(device);
  return (
    name.includes('yuwell') ||
    name.includes('ye-') ||
    name.includes('therm') ||
    name.includes('temp') ||
    advertisesService(device, '1809')
  );
}

function parseTemperature(data) {
  if (!data || data.length < 5) return null;

  const flags = data[0];
  const isFahrenheit = (flags & 0x01) !== 0;
  const hasTimestamp = (flags & 0x02) !== 0;
  const hasTempType = (flags & 0x04) !== 0;

  const mantissa = data[1] | (data[2] << 8) | (data[3] << 16);
  let exponent = data[4];
  if (exponent > 127) exponent -= 256;
  const value = mantissa * Math.pow(10, exponent);
  if (!isFinite(value) || value <= 0) return null;

  const celsius = isFahrenheit ? ((value - 32) * 5) / 9 : value;
  const fahrenheit = isFahrenheit ? value : (value * 9) / 5 + 32;

  let idx = 5;
  if (hasTimestamp) idx += 7;

  let site = '—';
  if (hasTempType && data.length >= idx + 1) {
    site = SITE_LABELS[data[idx]] || '—';
  }

  return {
    temperatureC: celsius.toFixed(1),
    temperatureF: fahrenheit.toFixed(1),
    site,
  };
}

const session = createDeviceSession({
  matcher,
  onConnected: (device, { addSub, callbacks, isActive }) => {
    let finalized = false;

    addSub(
      monitorChar(device, THERMO_SERVICE, TEMP_MEASUREMENT, (data) => {
        if (!isActive() || finalized) return;
        const reading = parseTemperature(data);
        if (!reading) return;
        finalized = true;
        callbacks.onFinal?.(reading);
      })
    );

    callbacks.onLive?.(null, 'Take the temperature on the thermometer — the reading will appear here');
  },
});

export default session;
