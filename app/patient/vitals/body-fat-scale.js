// app/patient/vitals/body-fat-scale.js — AILink 8-electrode body fat scale
import { useEffect } from 'react';
import DeviceScreen from '../../../components/DeviceScreen';
import ailinkBodyFatScale from '../../../ble/ailinkBodyFatScale';
import { COLORS } from '../../../constants/theme';
import { usePatient } from '../../../context/PatientContext';

const CONFIG = {
  id:           'body-fat-scale',
  name:         'Body Fat Scale',
  emoji:        '🧍',
  color:        COLORS.deviceWeight,
  ble:          ailinkBodyFatScale,
  instructions: 'Place the scale on a hard, flat floor. Connect, then have the patient step on barefoot and grip both hand electrodes. Stand still until weight, impedance and heart rate are captured — body composition is computed automatically.',
  readings: [
    { key: 'weightKg',    label: 'Weight',             unit: 'kg',   simulate: () => (Math.random() * 60 + 50).toFixed(1) },
    { key: 'bmi',         label: 'BMI',                unit: '',     simulate: () => (Math.random() * 15 + 18).toFixed(1) },
    { key: 'bodyFatPct',  label: 'Body Fat',           unit: '%',    simulate: () => (Math.random() * 25 + 10).toFixed(1) },
    { key: 'musclePct',   label: 'Muscle',             unit: '%',    simulate: () => (Math.random() * 20 + 30).toFixed(1) },
    { key: 'waterPct',    label: 'Body Water',         unit: '%',    simulate: () => (Math.random() * 20 + 45).toFixed(1) },
    { key: 'proteinPct',  label: 'Protein',            unit: '%',    simulate: () => (Math.random() * 10 + 14).toFixed(1) },
    { key: 'visceralFat', label: 'Visceral Fat Index', unit: '',     simulate: () => (Math.random() * 10 + 3).toFixed(1) },
    { key: 'bmr',         label: 'BMR',                unit: 'kcal', simulate: () => Math.floor(Math.random() * 800 + 1200) },
    { key: 'bodyAge',     label: 'Body Age',           unit: 'yrs',  simulate: () => Math.floor(Math.random() * 30 + 20) },
    { key: 'heartRate',   label: 'Heart Rate',         unit: 'bpm',  simulate: () => Math.floor(Math.random() * 40 + 60) },
  ],
};

function ageFromDob(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 30;
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
  return age > 0 && age < 120 ? age : 30;
}

export default function BodyFatScaleScreen() {
  const { patientInfo, vitalsData } = usePatient();

  // The 8-electrode algorithm needs the patient profile. Height falls back to
  // 170 cm when the height-weight step hasn't been measured yet.
  useEffect(() => {
    const sex = (patientInfo.gender || '').toLowerCase().startsWith('m') ? 1 : 0;
    const age = ageFromDob(patientInfo.dateOfBirth);
    const heightCm = Math.round(parseFloat(vitalsData['height-weight']?.heightCm)) || 170;
    ailinkBodyFatScale.setUserInfo({ sex, age, heightCm });
  }, [patientInfo, vitalsData]);

  return <DeviceScreen config={CONFIG} />;
}
