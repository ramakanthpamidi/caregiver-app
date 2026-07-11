// ble/yuwellGlucometer.js — Yuwell glucose meter (protocol V2.1).
// Service 0x1808: 0x2A18 = measurement, 0x2A34 = measurement context (meal mode).
// Concentration field: bits 15-13 scale selector, bit 12 encryption (XOR 0xAAA),
// bits 11-0 raw value. Measurement type comes from flags bits 7-5.
import { advertisesService, createDeviceSession, deviceNameOf, monitorChar, writeCurrentTime } from './bleClient';

const GLUCOSE_SERVICE = '00001808-0000-1000-8000-00805f9b34fb';
const GLUCOSE_MEASUREMENT = '00002a18-0000-1000-8000-00805f9b34fb';
const GLUCOSE_CONTEXT = '00002a34-0000-1000-8000-00805f9b34fb';

const MMOL_TO_MGDL = 18.0182;

const MEAL_CONTEXT_LABELS = {
  0x00: 'Random',
  0x01: 'Before Meal',
  0x02: 'After Meal',
  0x06: 'QC Solution',
};

function matcher(device) {
  const name = deviceNameOf(device);
  return (
    name.includes('yuwell') ||
    name.includes('glu') ||
    name.includes('poct') ||
    name.includes('blood sugar') ||
    advertisesService(device, '1808')
  );
}

// Scale rules from protocol Table 4
function applyScale(y, scaleSelector, typeCode, unitBit) {
  switch (scaleSelector) {
    case 0: return y;
    case 1: return y / 10;
    case 2: return y / 100;
    case 3: return y / 1000;
    case 6:
      if (typeCode === 1) return y;             // uric acid µmol/L
      if (typeCode === 0 && !unitBit) return y; // glucose mg/dL
      return y / 10;                            // glucose mmol/L, Hb, cholesterol
    default:
      return y / 10;
  }
}

function parseGlucosePacket(bytes) {
  if (!bytes || bytes.length < 10) return null;

  const flags = bytes[0];
  const hasTimeOffset = (flags & 0x01) !== 0;
  const hasConcentration = (flags & 0x02) !== 0;
  const unitBit = (flags & 0x04) !== 0; // 0 = mg/dL family, 1 = mmol/L family
  const hasSensorStatus = (flags & 0x08) !== 0;
  const contextFollows = (flags & 0x10) !== 0;
  const typeCode = (flags >> 5) & 0x07; // 0 glucose, 1 uric acid, 2 Hb, 3 cholesterol

  const sequenceNumber = (bytes[2] << 8) | bytes[1];

  let offset = 10; // flags(1) + seq(2) + base time(7)
  if (hasTimeOffset) offset += 2;
  if (!hasConcentration || bytes.length < offset + 3) return null;

  const raw16 = (bytes[offset + 1] << 8) | bytes[offset];
  offset += 2;
  const scaleSelector = (raw16 >> 13) & 0x07;
  const encrypted = (raw16 & 0x1000) !== 0;
  let y = raw16 & 0x0fff;
  if (encrypted) y = y ^ 0xaaa;

  offset += 1; // type & sample location byte
  if (hasSensorStatus) offset += 2;

  const value = applyScale(y, scaleSelector, typeCode, unitBit);
  if (typeCode !== 0) return null; // only surface glucose readings here

  const mmol = unitBit ? value : value / MMOL_TO_MGDL;
  const mgdl = unitBit ? value * MMOL_TO_MGDL : value;

  return {
    sequenceNumber,
    contextFollows,
    reading: {
      glucoseMgDl: Math.round(mgdl),
      glucoseMmol: mmol.toFixed(1),
      mealContext: '—',
    },
  };
}

const session = createDeviceSession({
  matcher,
  onConnected: async (device, { addSub, callbacks, isActive }) => {
    await writeCurrentTime(device); // best-effort record-time sync

    // A measurement whose flags announce a context packet is held briefly so
    // the meal mode can be merged in before the reading is finalised.
    let pending = null;
    let pendingTimer = null;

    const finalize = (reading) => {
      if (!isActive()) return;
      callbacks.onFinal?.(reading);
    };

    addSub(
      monitorChar(device, GLUCOSE_SERVICE, GLUCOSE_MEASUREMENT, (data) => {
        if (!isActive()) return;
        const parsed = parseGlucosePacket(data);
        if (!parsed) return;

        callbacks.onLive?.(parsed.reading);

        if (parsed.contextFollows) {
          if (pendingTimer) clearTimeout(pendingTimer);
          pending = parsed;
          pendingTimer = setTimeout(() => {
            if (pending) {
              finalize(pending.reading);
              pending = null;
            }
          }, 800);
        } else {
          finalize(parsed.reading);
        }
      })
    );

    // Measurement context: Flags(1) SeqNo(2 LE) MeasurementPattern(1)
    addSub(
      monitorChar(device, GLUCOSE_SERVICE, GLUCOSE_CONTEXT, (data) => {
        if (!isActive() || !pending || data.length < 4) return;
        const seqNo = (data[2] << 8) | data[1];
        if (seqNo !== pending.sequenceNumber) return;
        if (pendingTimer) clearTimeout(pendingTimer);
        const mealContext = MEAL_CONTEXT_LABELS[data[3]] || 'Random';
        finalize({ ...pending.reading, mealContext });
        pending = null;
      })
    );

    callbacks.onLive?.(null, 'Insert a test strip and apply the blood sample — the result will appear here');
  },
});

export default session;
