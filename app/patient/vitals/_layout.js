// app/patient/vitals/_layout.js
import { Stack } from 'expo-router';

export default function VitalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}