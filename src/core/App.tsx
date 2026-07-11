import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppProviders from './providers/AppProviders';
import { AuthSessionProvider } from '../features/auth/state/authContext';
import { DialogPortalProvider } from '../shared/components/DialogPortalProvider';
import MainAppShell from './navigation/MainAppShell';
import { installGlobalTypography } from '../shared/theme/globalTypography';
import { ToastHost } from '../shared/ui/toast';

installGlobalTypography();

/**
 * Legacy App root used by unit tests.
 * Production bootstraps via Expo Router (`app/_layout.tsx`).
 */
export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppProviders>
          <AuthSessionProvider>
            <DialogPortalProvider>
              <MainAppShell />
              <ToastHost />
            </DialogPortalProvider>
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
