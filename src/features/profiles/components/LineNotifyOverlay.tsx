import React from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { HeaderBackButton } from '@react-navigation/elements';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Layout, Spacing } from '../../../shared/theme/theme';
import LineNotifySection from './LineNotifySection';
import { simulateLineNotify, sendDailyReport } from '../services/lineNotifyApi';
import {
  evaluateBloodPressure,
  evaluateSpO2,
  evaluateGlucose,
  evaluateTemperature,
  getAlertTitle,
  getAlertMessage,
  formatReadingText,
  getDeviceNameForType,
  type HealthStatusLevel,
} from '../../../shared/lib/healthThresholds';
import { addAlert, healthStatusToSeverity } from '../../alerts/storage/alertStorage';
import { sendAlertNotification, refreshBadge } from '../../alerts/lib/alertNotifications';
import { showToast } from '../../../shared/ui/toast';
import { emitTrendsRefresh } from '../lib/profileEvents';
import { getCurrentPosition } from '../../../shared/lib/location';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

export type LineNotifyOverlayProps = {
  visible: boolean;
  profileId?: number | null;
  onClose?: () => void;
};

export default function LineNotifyOverlay({ visible, profileId, onClose }: LineNotifyOverlayProps) {
  const insets = useSafeAreaInsets();
  const { lang } = useLanguage();
  const [mounted, setMounted] = React.useState<boolean>(visible);
  const [ready, setReady] = React.useState(false); // true after slide-in completes
  const [simulating, setSimulating] = React.useState(false);
  const [sendingReport, setSendingReport] = React.useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;
  const windowH = Dimensions.get('window').height;

  React.useEffect(() => {
    if (!mounted) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose?.();
      return true;
    });

    return () => sub.remove();
  }, [mounted, onClose]);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      setReady(false);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setReady(true);
      });
    } else if (mounted) {
      setReady(false);
      Animated.timing(anim, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible]);

  const handleSimulate = React.useCallback(async () => {
    if (simulating) return;
    setSimulating(true);
    try {
      const rawProfileId = profileId ?? Number(await AsyncStorage.getItem('activeProfileId'));
      if (!rawProfileId || !Number.isFinite(rawProfileId)) {
        showToast('No active profile', 'error');
        return;
      }

      const types = ['bp', 'spo2', 'glucose', 'temp'] as const;
      const kind = types[Math.floor(Math.random() * types.length)];
      const ts = Date.now();
      const deviceId = `SIM-${kind.toUpperCase()}`;

      let values: Record<string, number>;
      let status: HealthStatusLevel;

      switch (kind) {
        case 'bp': {
          const sys = Math.floor(Math.random() * 80) + 90;   // 90-169
          const dia = Math.floor(Math.random() * 50) + 55;   // 55-104
          const pulse = Math.floor(Math.random() * 40) + 60;
          values = { sys, dia, pulse };
          status = evaluateBloodPressure({ sys, dia, pulse });
          break;
        }
        case 'spo2': {
          const spo2 = Math.floor(Math.random() * 12) + 88;  // 88-99
          const pulse = Math.floor(Math.random() * 40) + 60;
          values = { spo2, pulse };
          status = evaluateSpO2({ spo2, pulse });
          break;
        }
        case 'glucose': {
          const mgdl = Math.floor(Math.random() * 200) + 50;  // 50-249
          values = { mgdl };
          status = evaluateGlucose({ mgdl });
          break;
        }
        case 'temp': {
          const celsius = Math.round((Math.random() * 4 + 35.5) * 10) / 10; // 35.5-39.5
          values = { celsius };
          status = evaluateTemperature({ celsius });
          break;
        }
      }

      const severity = healthStatusToSeverity(status);
      const title = getAlertTitle(kind, status, lang);
      const message = getAlertMessage(kind, status, values, lang);
      const readingText = formatReadingText(kind, values);
      const deviceName = getDeviceNameForType(kind);

      const alert = await addAlert({
        severity,
        title,
        message,
        deviceName,
        deviceId,
        readingType: kind,
        reading: readingText,
        values,
        timestamp: ts,
        profileId: rawProfileId,
      });

      if (alert) {
        void sendAlertNotification(severity, title, message);
        void refreshBadge();

        // Directly call the LINE notify simulate endpoint — bypasses the outbox
        // (the backend endpoint also writes to medical_data_raw directly)
        // and device-lookup so the push fires immediately for any severity.
        try {
          const loc = await getCurrentPosition();
          await simulateLineNotify({
            profileId: rawProfileId,
            severity,
            eventType: 'Alert',
            deviceName,
            payload: { severity, title, message, reading: readingText, values, status },
            ...(loc && { lat: loc.lat, lng: loc.lng }),
          });
        } catch (lineErr: any) {
          console.warn('[simulate] LINE push failed:', lineErr?.message);
        }

        showToast(`Simulated ${kind.toUpperCase()} → ${status}`, 'success');
        emitTrendsRefresh();
      }
    } catch (e: any) {
      showToast(e?.message || 'Simulation failed', 'error');
    } finally {
      setSimulating(false);
    }
  }, [profileId, simulating]);

  const handleDailyReport = React.useCallback(async () => {
    if (sendingReport) return;
    setSendingReport(true);
    try {
      const rawProfileId = profileId ?? Number(await AsyncStorage.getItem('activeProfileId'));
      if (!rawProfileId || !Number.isFinite(rawProfileId)) {
        showToast('No active profile', 'error');
        return;
      }
      const result = await sendDailyReport(rawProfileId);
      if (result.ok) {
        showToast(`Daily report sent to ${result.sent} recipient${result.sent !== 1 ? 's' : ''}`, 'success');
      } else {
        showToast(result.error || 'No recipients found', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to send daily report', 'error');
    } finally {
      setSendingReport(false);
    }
  }, [profileId, sendingReport]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [windowH, 0] });

  return (
    <View style={styles.absContainer} pointerEvents="box-none">
      <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
        <NavigationContainer theme={DefaultTheme}>
          <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            {/* Header with LINE branding */}
            <View style={[styles.headerSafeArea, { paddingTop: insets.top }]}>
              <StatusBar translucent={false} backgroundColor="#06c755" barStyle="light-content" />
              <LinearGradient
                colors={['#06c755', '#06c755']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
              >
                <HeaderBackButton
                  onPress={onClose}
                  tintColor="#ffffff"
                  style={styles.headerBack}
                  pressColor="rgba(255,255,255,0.18)"
                />
                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>{t(lang, 'line_notifications')}</Text>
                </View>
                <View style={styles.headerPlaceholder} />
              </LinearGradient>
            </View>

            {/* Hint banner */}
            <View style={styles.hintBanner}>
              <Image
                source={require('../../../../assets/android-res/drawable/alert2.png')}
                style={styles.hintIcon}
                resizeMode="contain"
              />
              <Text style={styles.hintText}>
                {t(lang, 'line_notify_hint_banner')}
              </Text>
            </View>

            {/* Content */}
            {!ready ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#06c755" />
              </View>
            ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <LineNotifySection profileId={profileId ?? null} />

            {/* Simulate reading button — hidden for production, functionality preserved */}
            {/* <TouchableOpacity
              style={[styles.simButton, simulating && styles.simButtonDisabled]}
              onPress={handleSimulate}
              disabled={simulating}
              activeOpacity={0.7}
            >
              {simulating ? (
                <ActivityIndicator size="small" color="#06c755" />
              ) : (
                <>
                  <Image
                    source={require('../../../../assets/android-res/drawable/signal.png')}
                    style={styles.simIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.simButtonText}>{t(lang, 'simulate_reading')}</Text>
                </>
              )}
            </TouchableOpacity> */}

            {/* Daily Report button — hidden for production, functionality preserved */}
            {/* <TouchableOpacity
              style={[styles.reportButton, sendingReport && styles.simButtonDisabled]}
              onPress={handleDailyReport}
              disabled={sendingReport}
              activeOpacity={0.7}
            >
              {sendingReport ? (
                <ActivityIndicator size="small" color="#0F766E" />
              ) : (
                <>
                  <Image
                    source={require('../../../../assets/android-res/drawable/alert2.png')}
                    style={styles.reportIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.reportButtonText}>{t(lang, 'daily_report')}</Text>
                </>
              )}
            </TouchableOpacity> */}
            </ScrollView>
            )}
          </SafeAreaView>
        </NavigationContainer>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  absContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  safeArea: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSafeArea: {
    backgroundColor: '#06c755',
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  headerBack: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: {
    fontSize: 30,
    color: '#ffffff',
    fontWeight: '500',
    lineHeight: 34,
    marginTop: -2,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerLineIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
    tintColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerPlaceholder: {
    width: 44,
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
  },
  hintIcon: {
    width: 18,
    height: 18,
    tintColor: '#2e7d32',
    marginRight: 10,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: '#2e7d32',
    lineHeight: 18,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: Layout.bottomTabHeight + Spacing.lg,
  },
  simButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#06c755',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 12,
    shadowColor: '#06c755',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  simButtonDisabled: {
    opacity: 0.5,
  },
  simIcon: {
    width: 18,
    height: 18,
    tintColor: '#06c755',
    marginRight: 8,
  },
  simButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#06c755',
  },
  reportButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#0F766E',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 12,
    shadowColor: '#0F766E',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  reportIcon: {
    width: 18,
    height: 18,
    tintColor: '#0F766E',
    marginRight: 8,
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F766E',
  },
});
