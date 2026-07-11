// app/patient/vitals/height-weight.js
import DeviceScreen from '../../../components/DeviceScreen';
import { COLORS } from '../../../constants/theme';

const CONFIG = {
  id:           'height-weight',
  name:         'Height & Weight',
  emoji:        '📏',
  color:        COLORS.deviceHW,
  instructions: 'Have the patient stand upright against the height rod without shoes. Align the headboard level with the top of the head. Then weigh the patient on the integrated scale.',
  readings: [
    { key: 'heightCm',  label: 'Height',          unit: 'cm',  simulate: () => Math.floor(Math.random() * 50 + 150) },
    { key: 'weightKg',  label: 'Weight',           unit: 'kg',  simulate: () => (Math.random() * 60 + 50).toFixed(1) },
    { key: 'bmi',       label: 'BMI',              unit: '',    simulate: () => (Math.random() * 15 + 18).toFixed(1) },
    { key: 'bmiCategory', label: 'BMI Category',  unit: '',    simulate: () => ['Normal', 'Overweight', 'Underweight'][Math.floor(Math.random() * 3)] },
    { key: 'waistCm',   label: 'Waist Circumference', unit: 'cm', simulate: () => Math.floor(Math.random() * 40 + 70) },
  ],
};

export default function HeightWeightScreen() {
  return <DeviceScreen config={CONFIG} />;
}
