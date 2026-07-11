// app/patient/vitals/glucometer.js
import DeviceScreen from '../../../components/DeviceScreen';
import yuwellGlucometer from '../../../ble/yuwellGlucometer';
import { COLORS } from '../../../constants/theme';

const CONFIG = {
  id:           'glucometer',
  name:         'Glucometer',
  emoji:        '🩸',
  color:        COLORS.deviceGluco,
  ble:          yuwellGlucometer,
  instructions: 'Turn on the Yuwell glucometer and connect. Clean the fingertip with an alcohol swab and let it dry. Insert a test strip, apply the lancet to draw a small blood drop, and touch the strip edge to the drop — the result transfers automatically.',
  readings: [
    { key: 'glucoseMgDl', label: 'Blood Glucose (mg/dL)',  unit: 'mg/dL',  simulate: () => Math.floor(Math.random() * 120 + 80) },
    { key: 'glucoseMmol', label: 'Blood Glucose (mmol/L)', unit: 'mmol/L', simulate: () => (Math.random() * 6.7 + 4.4).toFixed(1) },
    { key: 'mealContext', label: 'Meal Context',           unit: '',       simulate: () => ['Random', 'Before Meal', 'After Meal'][Math.floor(Math.random() * 3)] },
  ],
};

export default function GlucometerScreen() {
  return <DeviceScreen config={CONFIG} />;
}
