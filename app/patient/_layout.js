// app/patient/_layout.js
import { Stack } from 'expo-router';

export default function PatientLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="registration" />
      <Stack.Screen name="vitals-selection" />
      <Stack.Screen name="vitals" />
      <Stack.Screen name="review" />
    </Stack>
  );
}