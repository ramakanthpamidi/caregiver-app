// app/patient/vitals/cgm.js
import DeviceScreen from '../../../components/DeviceScreen';
import { COLORS } from '../../../constants/theme';

const CONFIG = {
  id:           'cgm',
  name:         'CGM / CT3 Monitor',
  emoji:        '📡',
  color:        COLORS.deviceCGM,
  instructions: 'Ensure the CGM sensor is applied to the back of the upper arm or abdomen and has been active for at least 2 hours. Bring the reader within 4 cm of the sensor to scan.',
  readings: [
    { key: 'currentGlucose', label: 'Current Glucose',     unit: 'mg/dL', simulate: () => Math.floor(Math.random() * 120 + 80) },
    { key: 'trend',          label: 'Glucose Trend',        unit: '',      simulate: () => ['Stable →', 'Rising ↑', 'Falling ↓', 'Rapid Rise ⬆'][Math.floor(Math.random() * 4)] },
    { key: 'timeInRange',    label: 'Time in Range (24h)',  unit: '%',     simulate: () => Math.floor(Math.random() * 40 + 60) },
    { key: 'sensorAge',      label: 'Sensor Age',           unit: 'days',  simulate: () => Math.floor(Math.random() * 13 + 1) },
    { key: 'avgGlucose',     label: 'Average Glucose',      unit: 'mg/dL', simulate: () => Math.floor(Math.random() * 80 + 100) },
  ],
};

export default function CgmScreen() {
  return <DeviceScreen config={CONFIG} />;
}
