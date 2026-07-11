// app/patient/vitals/bp-monitor.js
import DeviceScreen from '../../../components/DeviceScreen';
import yuwellBloodPressure from '../../../ble/yuwellBloodPressure';
import { COLORS } from '../../../constants/theme';

const CONFIG = {
  id:           'bp-monitor',
  name:         'Blood Pressure Monitor',
  emoji:        '💓',
  color:        COLORS.deviceBP,
  ble:          yuwellBloodPressure,
  instructions: 'Place the cuff on the patient\'s upper arm, 1–2 cm above the elbow. Patient should be seated with arm at heart level. Connect, then press START on the monitor — the result transfers automatically when the cuff deflates.',
  readings: [
    { key: 'systolic',  label: 'Systolic',       unit: 'mmHg', simulate: () => Math.floor(Math.random() * 40 + 110) },
    { key: 'diastolic', label: 'Diastolic',       unit: 'mmHg', simulate: () => Math.floor(Math.random() * 20 + 70)  },
    { key: 'pulse',     label: 'Pulse Rate',      unit: 'bpm',  simulate: () => Math.floor(Math.random() * 40 + 60)  },
    { key: 'map',       label: 'Mean Arterial',   unit: 'mmHg', simulate: () => Math.floor(Math.random() * 20 + 80)  },
  ],
};

export default function BpMonitorScreen() {
  return <DeviceScreen config={CONFIG} />;
}
