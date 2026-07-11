// app/patient/vitals/smart-watch.js
import DeviceScreen from '../../../components/DeviceScreen';
import { COLORS } from '../../../constants/theme';

const CONFIG = {
  id:           'smart-watch',
  name:         'Smart Watch Sync',
  emoji:        '⌚',
  color:        COLORS.deviceWatch,
  instructions: 'Ensure the smart watch is worn snugly on the patient\'s wrist and Bluetooth is enabled. Keep the watch within 1 metre during sync. Data from the last 24 hours will be imported.',
  readings: [
    { key: 'heartRate',   label: 'Avg Heart Rate (24h)',   unit: 'bpm',   simulate: () => Math.floor(Math.random() * 30 + 65) },
    { key: 'hrv',         label: 'HRV',                    unit: 'ms',    simulate: () => Math.floor(Math.random() * 60 + 20) },
    { key: 'steps',       label: 'Steps Today',            unit: '',      simulate: () => Math.floor(Math.random() * 8000 + 2000).toLocaleString() },
    { key: 'sleepHrs',    label: 'Sleep Duration',         unit: 'hrs',   simulate: () => (Math.random() * 4 + 5).toFixed(1) },
    { key: 'spo2',        label: 'Sleep SpO₂ Avg',         unit: '%',     simulate: () => Math.floor(Math.random() * 4 + 95) },
    { key: 'stressScore', label: 'Stress Score',           unit: '/100',  simulate: () => Math.floor(Math.random() * 60 + 20) },
    { key: 'calories',    label: 'Active Calories',        unit: 'kcal',  simulate: () => Math.floor(Math.random() * 400 + 200) },
  ],
};

export default function SmartWatchScreen() {
  return <DeviceScreen config={CONFIG} />;
}
