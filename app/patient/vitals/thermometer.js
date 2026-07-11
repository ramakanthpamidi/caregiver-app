// app/patient/vitals/thermometer.js
import DeviceScreen from '../../../components/DeviceScreen';
import yuwellThermometer from '../../../ble/yuwellThermometer';
import { COLORS } from '../../../constants/theme';

const CONFIG = {
  id:           'thermometer',
  name:         'Thermometer',
  emoji:        '🌡️',
  color:        COLORS.deviceThermo,
  ble:          yuwellThermometer,
  instructions: 'Turn on the Yuwell thermometer and connect. Take the temperature as usual (forehead or armpit depending on the model) — the reading transfers automatically once the measurement finishes.',
  readings: [
    { key: 'temperatureC', label: 'Temperature (°C)', unit: '°C', simulate: () => (Math.random() * 2 + 36).toFixed(1) },
    { key: 'temperatureF', label: 'Temperature (°F)', unit: '°F', simulate: () => (Math.random() * 3.6 + 96.8).toFixed(1) },
    { key: 'site',         label: 'Measurement Site', unit: '',   simulate: () => ['Forehead', 'Armpit', 'Ear'][Math.floor(Math.random() * 3)] },
  ],
};

export default function ThermometerScreen() {
  return <DeviceScreen config={CONFIG} />;
}
