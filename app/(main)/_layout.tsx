import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuthSession } from '../../src/features/auth/state/authContext';
import AppLoadingScreen from '../../src/shared/components/AppLoadingScreen';

export default function MainLayout() {
  const { isLoggedIn } = useAuthSession();

  if (isLoggedIn === null) {
    return <AppLoadingScreen subtitle="Loading..." />;
  }

  if (!isLoggedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
