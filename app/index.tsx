import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthSession } from '../src/features/auth/state/authContext';
import AppLoadingScreen from '../src/shared/components/AppLoadingScreen';

export default function Index() {
  const { isLoggedIn } = useAuthSession();

  if (isLoggedIn === null) {
    return <AppLoadingScreen subtitle="Loading..." />;
  }

  if (isLoggedIn) {
    return <Redirect href="/(main)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
