// ble/yuwellOximeter.js — Yuwell pulse oximeter (proprietary protocol).
// Service FFE0 / characteristic FFE4. Packets start with 0xFE; id 0x55 is the
// 1 Hz measurement (PR, SpO2, PI), id 0x56 the 50 Hz waveform + alarm flags.
import { advertisesService, createDeviceSession, deviceNameOf, monitorChar } from './bleClient';

const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe4-0000-1000-8000-00805f9b34fb';

const PACKET_MEASUREMENT = 0x55;
const PACKET_WAVEFORM = 0x56;

// How many consecutive stable measurement packets settle the reading
const STABLE_PACKETS = 6;
// Fallback: finalise with the latest valid values if stability is never reached
const FALLBACK_FINALIZE_MS = 20000;

// A notification may batch several 0xFE-framed packets — scan every offset.
// Returns { measurements: [{spo2, heartRate, perfusionIndex}], fingerOff }.
function extractFrames(data) {
  const measurements = [];
  let fingerOff = false;

  let o = 0;
  while (o + 3 <= data.length) {
    if (data[o] !== 0xfe) {
      o++;
      continue;
    }
    const id = data[o + 2];
    if (id === PACKET_MEASUREMENT && o + 8 <= data.length) {
      measurements.push({
        heartRate: (data[o + 3] << 8) | data[o + 4],
        spo2: data[o + 5],
        perfusionIndex: ((data[o + 6] << 8) | data[o + 7]) / 1000,
      });
      o += 8;
    } else if (id === PACKET_WAVEFORM && o + 5 <= data.length) {
      if ((data[o + 4] & 0x02) !== 0) fingerOff = true;
      o += 5;
    } else {
      o++;
    }
  }

  return { measurements, fingerOff };
}

function matcher(device) {
  const name = deviceNameOf(device);
  return (
    name.includes('yuwell') ||
    name.includes('oxim') ||
    name.includes('spo2') ||
    advertisesService(device, 'ffe0')
  );
}

const session = createDeviceSession({
  matcher,
  onConnected: (device, { addSub, callbacks, isActive }) => {
    const recent = [];
    let lastValid = null;
    let finalized = false;
    let fingerOffNoted = false;
    let fallbackTimer = null;

    const finalize = (values) => {
      if (finalized) return;
      finalized = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      callbacks.onFinal?.(values);
    };

    addSub({
      remove: () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        fallbackTimer = null;
      },
    });

    addSub(
      monitorChar(device, SERVICE_UUID, CHARACTERISTIC_UUID, (data) => {
        if (!isActive() || finalized) return;

        const { measurements, fingerOff } = extractFrames(data);

        if (fingerOff && !fingerOffNoted && measurements.length === 0) {
          fingerOffNoted = true;
          recent.length = 0;
          callbacks.onLive?.(null, 'Finger not detected — place the finger fully on the sensor');
        }

        for (const m of measurements) {
          const valid = m.spo2 >= 70 && m.spo2 <= 100 && m.heartRate >= 25 && m.heartRate <= 250;
          if (!valid) {
            recent.length = 0;
            continue;
          }

          fingerOffNoted = false;
          lastValid = m;
          callbacks.onLive?.({
            spo2: m.spo2,
            heartRate: m.heartRate,
            perfusionIndex: m.perfusionIndex.toFixed(1),
          });

          // Once real data flows, guarantee completion even if SpO2 keeps wavering
          if (!fallbackTimer) {
            fallbackTimer = setTimeout(() => {
              if (isActive() && lastValid) {
                finalize({
                  spo2: lastValid.spo2,
                  heartRate: lastValid.heartRate,
                  perfusionIndex: lastValid.perfusionIndex.toFixed(1),
                });
              }
            }, FALLBACK_FINALIZE_MS);
          }

          recent.push(m);
          if (recent.length > STABLE_PACKETS) recent.shift();
          if (recent.length === STABLE_PACKETS) {
            const spo2s = recent.map((p) => p.spo2);
            if (Math.max(...spo2s) - Math.min(...spo2s) <= 1) {
              const avg = (sel) => recent.reduce((sum, p) => sum + sel(p), 0) / recent.length;
              finalize({
                spo2: Math.round(avg((p) => p.spo2)),
                heartRate: Math.round(avg((p) => p.heartRate)),
                perfusionIndex: avg((p) => p.perfusionIndex).toFixed(1),
              });
              return;
            }
          }
        }
      })
    );
  },
});

export default session;
