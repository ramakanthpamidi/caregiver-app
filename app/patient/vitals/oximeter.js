// app/patient/vitals/oximeter.js
import DeviceScreen from '../../../components/DeviceScreen';
import yuwellOximeter from '../../../ble/yuwellOximeter';
import { COLORS } from '../../../constants/theme';

const CONFIG = {
  id:           'oximeter',
  name:         'Pulse Oximeter',
  emoji:        '🫁',
  color:        COLORS.deviceOximeter,
  ble:          yuwellOximeter,
  instructions: 'Turn on the Yuwell oximeter and clip it onto the patient\'s index finger. Ensure the nail is clean and the finger is warm. Hold still — the reading completes automatically once the values stabilise.',
  readings: [
    { key: 'spo2',           label: 'SpO₂ (Oxygen Saturation)', unit: '%',   simulate: () => Math.floor(Math.random() * 4 + 96) },
    { key: 'heartRate',      label: 'Heart Rate',                unit: 'bpm', simulate: () => Math.floor(Math.random() * 40 + 60) },
    { key: 'perfusionIndex', label: 'Perfusion Index',           unit: '%',   simulate: () => (Math.random() * 4 + 1).toFixed(1) },
  ],
};

export default function OximeterScreen() {
  return <DeviceScreen config={CONFIG} />;
}