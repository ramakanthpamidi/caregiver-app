import React, { useEffect } from 'react';
import { LogBox, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import * as SplashScreen from 'expo-splash-screen';
import AppProviders from '../src/core/providers/AppProviders';
import { AuthSessionProvider } from '../src/features/auth/state/authContext';
import { DialogPortalProvider } from '../src/shared/components/DialogPortalProvider';
import { ToastHost } from '../src/shared/ui/toast';
import { installGlobalTypography } from '../src/shared/theme/globalTypography';
// Preserve the original vitals/BLE flow (patient/* routes) alongside the ported app.
import { PatientProvider } from '../context/PatientContext';

// react-native-svg 15.x is noisy about codegen on the New Architecture; the
// native views still render, so silence the wall of dev warnings.
LogBox.ignoreLogs([/Codegen didn't run for RNSVG/]);

// On Android, react-native-screens can crash if a navigator is rendered inside a React Native `Modal`.
// Disable native screens on Android to force the JS implementation for nested overlay navigators.
try {
  enableScreens(Platform.OS !== 'android');
} catch {
  // ignore
}

try {
  installGlobalTypography();
} catch {
  // ignore typography install failures so routes still mount
}

SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore if splash already hidden
});

export default function RootLayout() {
  useEffect(() => {
    // Install secure-storage AsyncStorage patch after first paint so a storage
    // backend failure cannot prevent Expo Router from evaluating route modules.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { installAuthTokenAsyncStoragePatch } = require('../src/features/auth/storage/authTokenAsyncStoragePatch');
      installAuthTokenAsyncStoragePatch();
    } catch (e) {
      console.warn('[auth] secure storage patch skipped:', e);
    }
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppProviders>
          <AuthSessionProvider>
            <PatientProvider>
              <DialogPortalProvider>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(main)" />
                  <Stack.Screen name="patient" />
                  <Stack.Screen name="ble-scanner" />
                </Stack>
                <ToastHost />
              </DialogPortalProvider>
            </PatientProvider>
          </AuthSessionProvider>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
