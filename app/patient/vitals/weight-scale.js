// app/patient/vitals/weight-scale.js
import DeviceScreen from '../../../components/DeviceScreen';
import { COLORS } from '../../../constants/theme';

const CONFIG = {
  id:           'weight-scale',
  name:         'Weight Scale',
  emoji:        '⚖️',
  color:        COLORS.deviceWeight,
  instructions: 'Ask the patient to remove shoes and heavy clothing. Have them stand centred on the scale without holding on to any support. Wait for the display to stabilise.',
  readings: [
    { key: 'weightKg',  label: 'Weight (kg)',   unit: 'kg',  simulate: () => (Math.random() * 60 + 50).toFixed(1) },
    { key: 'weightLbs', label: 'Weight (lbs)',  unit: 'lbs', simulate: () => (Math.random() * 132 + 110).toFixed(1) },
    { key: 'bmi',       label: 'BMI (est.)',    unit: '',    simulate: () => (Math.random() * 15 + 18).toFixed(1) },
  ],
};

export default function WeightScaleScreen() {
  return <DeviceScreen config={CONFIG} />;
}
