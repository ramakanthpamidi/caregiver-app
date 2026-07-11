import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuthSession } from '../../src/features/auth/state/authContext';
import { useLanguage } from '../../src/shared/i18n/LanguageContext';
import { t } from '../../src/shared/i18n';
import AppLoadingScreen from '../../src/shared/components/AppLoadingScreen';

export default function AuthLayout() {
  const { isLoggedIn } = useAuthSession();
  const { lang } = useLanguage();

  if (isLoggedIn === null) {
    return <AppLoadingScreen subtitle="Loading..." />;
  }

  if (isLoggedIn) {
    return <Redirect href="/(main)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen
        name="terms"
        options={{
          headerShown: true,
          title: t(lang, 'nav_terms_of_service'),
          headerTitleAlign: 'center',
          headerTintColor: '#064b75',
          headerTitleStyle: { color: '#064b75' },
        }}
      />
      <Stack.Screen
        name="policy"
        options={{
          headerShown: true,
          title: t(lang, 'nav_privacy_policy'),
          headerTitleAlign: 'center',
          headerTintColor: '#064b75',
          headerTitleStyle: { color: '#064b75' },
        }}
      />
      <Stack.Screen
        name="consent"
        options={{
          headerShown: true,
          title: t(lang, 'nav_consent'),
          headerTitleAlign: 'center',
          headerTintColor: '#064b75',
          headerTitleStyle: { color: '#064b75' },
        }}
      />
    </Stack>
  );
}
