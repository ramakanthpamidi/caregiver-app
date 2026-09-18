import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  AppState,
  BackHandler,
  View,
  Text,
  PermissionsAndroid,
  Platform,
  Linking,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const DURATION = 280;
import { Device, Characteristic, Service } from 'react-native-ble-plx';
import { bleManager as manager } from '../../features/devices/lib/bleManager';
import HomeScreen from '../../features/home/screens/HomeScreen';
import AlertScreen from '../../features/alerts/screens/AlertScreen';
import TrendsScreen from '../../features/trends/screens/TrendScreen';
import SettingsScreen from '../../features/settings/screens/SettingScreen';
import DeviceScreen from '../../features/devices/screens/DeviceScreen';
import BleMonitoringHost from '../../features/devices/components/BleMonitoringHost';
import ProfileScreen from '../../features/profiles/screens/ProfileScreen';
import SelectProfileScreen from '../../features/profiles/screens/SelectProfileScreen';
import CreateProfileScreen from '../../features/profiles/screens/CreateProfileScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from './components/BottomNav';
import base64 from 'react-native-base64';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribe as subscribeStatusBar, isModalOpen as isModalOpenGlobal } from '../../shared/ui/statusBarManager';
import { getMyProfiles, markProfileUsed } from '../../features/profiles/api/profileApi';
import { showToast } from '../../shared/ui/toast';
import { getCachedProfiles, setCachedProfiles } from '../../features/profiles/storage/profileCache';
import { resolveProfileId, runOutbox } from '../../shared/sync/syncOutbox';
import { getAllProfileAvatars, type ProfileAvatar } from '../../features/profiles/lib/profileAvatar';
import NetInfo from '@react-native-community/netinfo';
import { closeTrendDetailOverlay, TabKey, TabNavigationProvider, ProfileHeaderProps } from '../../shared/navigation/tabNavigation';
import { startNetworkSync, stopNetworkSync } from '../../shared/sync/networkSync';
import { clearUserSession } from '../../features/auth/services/session';
import { useAuthSession } from '../../features/auth/state/authContext';
import { primeAvatarColorCache } from '../../features/profiles/lib/avatarColors';
import { refreshYuwellModelCache } from '../../features/devices/storage/yuwellModelCache';
import { getBadgeSeverity, subscribeBadge, refreshBadge, type BadgeSeverity } from '../../features/alerts/lib/alertNotifications';
import { syncRemoteAlertsForProfile } from '../../features/alerts/storage/alertStorage';
import CreateProfileFlowOverlay from '../../features/profiles/components/CreateProfileFlowOverlay';
import {
  getActiveProfileId,
  setActiveProfileId as setActiveProfileIdGlobal,
  subscribeActiveProfileId,
} from '../../features/profiles/lib/profileEvents';
import { useLanguage } from '../../shared/i18n/LanguageContext';
import { t } from '../../shared/i18n';
import PolicyConsentFlowOverlay from '../../features/legal/components/PolicyConsentFlowOverlay';
import DataManagementOverlay from '../../features/profiles/components/DataManagementOverlay';
import LineNotifyOverlay from '../../features/profiles/components/LineNotifyOverlay';
import AppLoadingScreen from '../../shared/components/AppLoadingScreen';
import DialogFrame from '../../shared/components/DialogFrame';
import { apiUrl } from '../../shared/config/api';

const APP_UPDATE_ENDPOINT = apiUrl('/app-config');
const APP_UPDATE_IGNORE_KEY = 'appUpdateIgnoredVersion.v1';
const APP_VERSION = (() => {
  try {
    const pkg = require('../../../package.json') as { version?: string };
    return String(pkg?.version || '0.0.0');
  } catch {
    return '0.0.0';
  }
})();

type AppUpdatePrompt = {
  currentVersion: string;
  latestVersion: string;
  storeUrl: string;
  releaseNotes?: string;
  forceUpdate: boolean;
};

function compareVersionStrings(left: string, right: string): number {
  const leftParts = String(left || '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const a = leftParts[index] ?? 0;
    const b = rightParts[index] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }

  return 0;
}

async function fetchAppUpdatePrompt(
  platform: 'android' | 'ios',
  currentVersion: string,
): Promise<AppUpdatePrompt | null> {
  const query = `platform=${encodeURIComponent(platform)}&current_version=${encodeURIComponent(currentVersion)}`;
  const response = await fetch(`${APP_UPDATE_ENDPOINT}?${query}`);
  if (!response.ok) {
    throw new Error(`App update check failed (${response.status})`);
  }

  const data = await response.json();
  const latestVersion = String(data?.latest_version || '').trim();
  const minSupportedVersion = String(data?.min_supported_version || '').trim();
  const storeUrl = String(
    data?.store_url
      || (platform === 'android' ? data?.android_store_url : data?.ios_store_url)
      || '',
  ).trim();

  if (!latestVersion || !storeUrl) {
    return null;
  }

  const updateAvailable =
    data?.update_available === true
    || compareVersionStrings(latestVersion, currentVersion) > 0;
  if (!updateAvailable) {
    return null;
  }

  const forceUpdate =
    data?.force_update === true
    || (!!minSupportedVersion && compareVersionStrings(currentVersion, minSupportedVersion) < 0);

  return {
    currentVersion,
    latestVersion,
    storeUrl,
    releaseNotes: typeof data?.release_notes === 'string' ? data.release_notes.trim() : undefined,
    forceUpdate,
  };
}

function base64ToBytes(b64: string): number[] {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup: number[] = new Array(256).fill(-1);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const out: number[] = [];
  let bitBuffer = 0;
  let bitLen = 0;
  for (let i = 0; i < b64.length; i++) {
    const c = b64.charCodeAt(i);
    if (c === 61) break; // '=' padding
    const v = lookup[c];
    if (v === -1) continue;
    bitBuffer = (bitBuffer << 6) | v;
    bitLen += 6;
    if (bitLen >= 8) {
      bitLen -= 8;
      out.push((bitBuffer >> bitLen) & 0xff);
    }
  }
  return out;
}

export default function MainAppShell() {
  const { lang } = useLanguage();
  const { isLoggedIn, setIsLoggedIn, signOut } = useAuthSession();
  const insets = useSafeAreaInsets();
  const [modalOpenGlobal, setModalOpenGlobal] = useState<boolean>(isModalOpenGlobal());
  useEffect(() => subscribeStatusBar((v) => setModalOpenGlobal(v)), []);
  const modalOpenGlobalRef = useRef<boolean>(modalOpenGlobal);
  useEffect(() => {
    modalOpenGlobalRef.current = modalOpenGlobal;
  }, [modalOpenGlobal]);
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [profileGate, setProfileGate] = useState<'unknown' | 'checking' | 'needs' | 'ready' | 'error'>('unknown');
  const [profileGateError, setProfileGateError] = useState<string | null>(null);
  const [avatarColorsReady, setAvatarColorsReady] = useState<boolean>(false);
  const [appUpdatePrompt, setAppUpdatePrompt] = useState<AppUpdatePrompt | null>(null);
  const [appUpdateVisible, setAppUpdateVisible] = useState(false);
  const appUpdateCheckInFlightRef = useRef(false);
  const lastAppUpdateCheckAtRef = useRef(0);

  // Startup profile selection (Netflix-style). Only used when profileGate is ready.
  const [startupProfiles, setStartupProfiles] = useState<any[]>([]);
  const [startupAvatarMap, setStartupAvatarMap] = useState<Record<string, ProfileAvatar>>({});
  const [startupActiveProfileId, setStartupActiveProfileId] = useState<number | null>(null);
  const [selectProfileVisible, setSelectProfileVisible] = useState(false);
  const [startupResolved, setStartupResolved] = useState(false);
  const [createProfileOverlayVisible, setCreateProfileOverlayVisible] = useState(false);
  const [policyConsentOverlayVisible, setPolicyConsentOverlayVisible] = useState(false);
  const [policyConsentProfileId, setPolicyConsentProfileId] = useState<number | null>(null);
  const [policyConsentInitialRoute, setPolicyConsentInitialRoute] = useState<'PolicyScreen' | 'ConsentScreen' | 'TermScreen'>('PolicyScreen');
  const [dataManagementOverlayVisible, setDataManagementOverlayVisible] = useState(false);
  const [dataManagementProfileId, setDataManagementProfileId] = useState<number | null>(null);
  const [lineNotifyOverlayVisible, setLineNotifyOverlayVisible] = useState(false);
  const [lineNotifyProfileId, setLineNotifyProfileId] = useState<number | null>(null);
  const screens = ['Home', 'Alerts', 'Trends', 'Devices', 'Settings'] as const;
  const [screenIndex, setScreenIndex] = useState(0);
  const screenIndexRef = useRef(0);

  // Alert badge: tracks worst unread critical/warning severity for the Alerts tab icon
  const [alertBadge, setAlertBadge] = useState<BadgeSeverity>(() => getBadgeSeverity());
  useEffect(() => {
    // Hydrate on mount, then subscribe to future changes
    void refreshBadge();
    return subscribeBadge(setAlertBadge);
  }, []);
  // Zyta-style horizontal pager: single animated value slides all screens in a row.
  const pagerX = useRef(new Animated.Value(0)).current;
  // Separate animated value for the BottomNav sliding indicator (fractional index 0..N).
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const [profileSheetOpen, setProfileSheetOpen] = useState<boolean>(false);
  const [profileSheetMounted, setProfileSheetMounted] = useState<boolean>(false);
  const profileSheetAnim = useRef(new Animated.Value(0)).current; // 0..1 for sheet translateY
  const { height } = Dimensions.get('window');

  const DEFAULT_PROFILE_SHEET_COLLAPSED_HEIGHT =
    Platform.OS === 'android' ? 170 + (StatusBar.currentHeight ?? 0) : 200;
  const BOTTOM_NAV_HEIGHT = 70;
  const [profileSheetCollapsedHeight, setProfileSheetCollapsedHeight] = useState<number>(DEFAULT_PROFILE_SHEET_COLLAPSED_HEIGHT);
  const [profileSheetHeader, setProfileSheetHeader] = useState<ProfileHeaderProps | undefined>(undefined);
  const overlayOpenTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const pendingTrendTabSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      for (const timer of overlayOpenTimersRef.current) {
        clearTimeout(timer);
      }
      overlayOpenTimersRef.current = [];
      if (pendingTrendTabSwitchTimerRef.current) {
        clearTimeout(pendingTrendTabSwitchTimerRef.current);
        pendingTrendTabSwitchTimerRef.current = null;
      }
    };
  }, []);
  // Ensure status bar icons/text are dark (black) across the app
  useEffect(() => {
    try {
      StatusBar.setBarStyle('dark-content', true);
    } catch (e) {
      // ignore if platform does not support
    }
  }, []);
  const monitorsRef = useRef<Array<{ remove: () => void }>>([]);

  const checkForAppUpdate = useCallback(async () => {
    // Disabled for this integrated dev build — the store-version check nags to
    // "update" against the production release. Re-enable for production.
    return;
    // eslint-disable-next-line no-unreachable
    const now = Date.now();
    if (appUpdateCheckInFlightRef.current) return;
    if (now - lastAppUpdateCheckAtRef.current < 15000) return;

    appUpdateCheckInFlightRef.current = true;
    try {
      const prompt = await fetchAppUpdatePrompt(Platform.OS === 'ios' ? 'ios' : 'android', APP_VERSION);
      lastAppUpdateCheckAtRef.current = Date.now();

      if (!prompt) {
        setAppUpdatePrompt(null);
        setAppUpdateVisible(false);
        return;
      }

      const ignoredVersion = await AsyncStorage.getItem(APP_UPDATE_IGNORE_KEY);
      if (!prompt.forceUpdate && ignoredVersion === prompt.latestVersion) {
        setAppUpdatePrompt(null);
        setAppUpdateVisible(false);
        return;
      }

      setAppUpdatePrompt(prompt);
      setAppUpdateVisible(true);
    } catch {
      lastAppUpdateCheckAtRef.current = Date.now();
    } finally {
      appUpdateCheckInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn === null) return;
    const timer = setTimeout(() => {
      void checkForAppUpdate();
    }, 600);
    return () => clearTimeout(timer);
  }, [isLoggedIn, checkForAppUpdate]);

  useEffect(() => {
    if (isLoggedIn === null) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkForAppUpdate();
      }
    });
    return () => sub.remove();
  }, [isLoggedIn, checkForAppUpdate]);

  const handleIgnoreAppUpdate = useCallback(async () => {
    if (!appUpdatePrompt || appUpdatePrompt.forceUpdate) return;
    try {
      await AsyncStorage.setItem(APP_UPDATE_IGNORE_KEY, appUpdatePrompt.latestVersion);
    } catch {
      // ignore cache failures; just close the dialog for this session.
    }
    setAppUpdateVisible(false);
  }, [appUpdatePrompt]);

  const handleUpdateNow = useCallback(async () => {
    if (!appUpdatePrompt?.storeUrl) return;
    try {
      const supported = await Linking.canOpenURL(appUpdatePrompt.storeUrl);
      if (!supported) throw new Error('Unsupported URL');
      await Linking.openURL(appUpdatePrompt.storeUrl);
      setAppUpdateVisible(false);
    } catch {
      showToast(t(lang, 'update_link_open_failed'), 'error');
    }
  }, [appUpdatePrompt, lang]);

  // Pre-mount the Profile sheet contents so opening the sheet doesn't have to mount a heavy screen
  // during the slide-down animation (which can stutter on Android).
  useEffect(() => {
    if (!isLoggedIn) return;
    if (profileGate !== 'ready') return;
    if (!startupResolved) return;
    if (selectProfileVisible) return;
    if (profileSheetMounted) return;

    // Mount ASAP (next tick) so the first manual open is smooth.
    const t = setTimeout(() => {
      setProfileSheetMounted(true);
    }, 0);

    return () => clearTimeout(t);
  }, [isLoggedIn, profileGate, startupResolved, selectProfileVisible, profileSheetMounted]);

  const [trendsScreenResetVersion, setTrendsScreenResetVersion] = useState(0);

  const openCreateProfileFlowCallback = useCallback(() => {
    setCreateProfileOverlayVisible(true);
  }, []);

  const openPolicyConsentFlowCallback = useCallback((profileId?: number | null) => {
    setPolicyConsentProfileId(profileId != null && Number.isFinite(profileId as any) ? Number(profileId) : null);
    setPolicyConsentInitialRoute('PolicyScreen');
    setPolicyConsentOverlayVisible(true);
  }, []);

  const closePolicyConsentFlowCallback = useCallback(() => {
    setPolicyConsentOverlayVisible(false);
  }, []);

  const openTermScreenCallback = useCallback((profileId?: number | null) => {
    setPolicyConsentProfileId(profileId != null && Number.isFinite(profileId as any) ? Number(profileId) : null);
    setPolicyConsentInitialRoute('TermScreen');
    setPolicyConsentOverlayVisible(true);
  }, []);

  const openDataManagementScreenCallback = useCallback((profileId?: number | null) => {
    setDataManagementProfileId(profileId != null && Number.isFinite(profileId as any) ? Number(profileId) : null);
    setDataManagementOverlayVisible(true);
  }, []);

  const closeDataManagementScreenCallback = useCallback(() => {
    setDataManagementOverlayVisible(false);
  }, []);

  const openLineNotifyScreenCallback = useCallback((profileId?: number | null) => {
    setLineNotifyProfileId(profileId != null && Number.isFinite(profileId as any) ? Number(profileId) : null);
    setLineNotifyOverlayVisible(true);
  }, []);

  const closeLineNotifyScreenCallback = useCallback(() => {
    setLineNotifyOverlayVisible(false);
  }, []);

  // All tab screen components (stable references)
  const sharedScreenProps = useMemo(() => ({
    setIsLoggedIn,
    openCreateProfileFlow: openCreateProfileFlowCallback,
    openPolicyConsentFlow: openPolicyConsentFlowCallback,
    openTermScreen: openTermScreenCallback,
    openDataManagementScreen: openDataManagementScreenCallback,
    openLineNotifyScreen: openLineNotifyScreenCallback,
  }), [setIsLoggedIn, openCreateProfileFlowCallback, openPolicyConsentFlowCallback, openTermScreenCallback, openDataManagementScreenCallback, openLineNotifyScreenCallback]);

  const tabPages = useMemo(() => {
    const comps = [HomeScreen, AlertScreen, TrendsScreen, DeviceScreen, SettingsScreen];
    return comps.map((Comp, index) => {
      const screenKey = index === 2 ? `screen-${index}-${trendsScreenResetVersion}` : `screen-${index}`;
      return (
        <View key={screenKey} style={{ width: SCREEN_W, backgroundColor: '#f9fafb' }}>
          <Comp {...sharedScreenProps} />
        </View>
      );
    });
  }, [sharedScreenProps, trendsScreenResetVersion]);

  // Zyta-style tab switch: animate pager and indicator in parallel
  const switchTab = useCallback((newIdx: number) => {
    if (newIdx === screenIndexRef.current) return;
    screenIndexRef.current = newIdx;
    setScreenIndex(newIdx);
    Animated.parallel([
      Animated.timing(pagerX, {
        toValue: -newIdx * SCREEN_W,
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(indicatorAnim, {
        toValue: newIdx,
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pagerX, indicatorAnim]);

  // Legacy BLE debug scanning is intentionally disabled here.
  // Production BLE behavior is handled by the Home live monitor and the Devices add-device flow.
  // Running a second hidden scanner from the root navigator competes for the shared BLE manager
  // and can surface spurious native BleError promise rejections.

  // Load profiles + active profile for the startup picker when the gate is ready.
  useEffect(() => {
    if (!isLoggedIn || profileGate !== 'ready') {
      setStartupProfiles([]);
      setStartupAvatarMap({});
      setStartupActiveProfileId(null);
      setSelectProfileVisible(false);
      setStartupResolved(false);
      setCreateProfileOverlayVisible(false);
      return;
    }

    const inFlight = { canceled: false };
    setStartupResolved(false);
    (async () => {
      try {
        const cached = await getCachedProfiles();
        const avatars = await getAllProfileAvatars().catch(() => ({} as Record<string, ProfileAvatar>));
        const rawActive = await AsyncStorage.getItem('activeProfileId');
        const activeNum = rawActive ? Number(rawActive) : null;

        if (inFlight.canceled) return;
        setStartupProfiles(cached as any);
        setStartupAvatarMap(avatars || {});

        // If there is exactly one profile, auto-select it.
        if (cached.length === 1) {
          const onlyId = Number((cached as any)[0].id);
          if (!Number.isFinite(onlyId) || onlyId <= 0) {
            setStartupActiveProfileId(null);
            setSelectProfileVisible(false);
            return;
          }

          if (activeNum !== onlyId) {
            try {
              await setActiveProfileIdGlobal(onlyId);
            } catch {
              await AsyncStorage.setItem('activeProfileId', String(onlyId));
            }
          }
          if (inFlight.canceled) return;
          setStartupActiveProfileId(onlyId);
          setSelectProfileVisible(false);
          return;
        }

        // More than one profile: show picker on app launch.
        if (cached.length > 1) {
          setStartupActiveProfileId(Number.isFinite(activeNum as any) ? (activeNum as any) : null);
          setSelectProfileVisible(true);
          return;
        }

        // No profiles shouldn't happen in 'ready' gate, but be safe.
        setStartupActiveProfileId(null);
        setSelectProfileVisible(false);
      } catch {
        // Fail open: don't block the app.
        setSelectProfileVisible(false);
      }
      finally {
        if (!inFlight.canceled) setStartupResolved(true);
      }
    })();

    return () => {
      inFlight.canceled = true;
    };
  }, [isLoggedIn, profileGate]);

  // Cleanup BLE manager on unmount only
  useEffect(() => {
    return () => {
      stopScan();
      monitorsRef.current.forEach((m) => m.remove && m.remove());
      Promise.resolve(manager.destroy()).catch((error: any) => {
        console.log(
          '[BLE_ROOT] destroy ignored:',
          error?.reason || error?.message || error,
        );
      });
    };
  }, []);

  // Start network sync service to auto-sync outbox when coming back online
  useEffect(() => {
    startNetworkSync();
    return () => {
      stopNetworkSync();
    };
  }, []);

  async function requestPermissions() {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
      } catch (e) {
        console.warn('Permission request error', e);
      }
    }
    // Request notification permission (Android 13+, iOS always)
    try {
      const { ensureNotificationPermission } = await import('../../shared/notifications/localNotifications');
      await ensureNotificationPermission();
    } catch (e) {
      console.warn('Notification permission request error', e);
    }
  }

  // Request BLE + notification permissions once per app launch, after the user
  // has reached the home screen (post-login, profile resolved, no picker showing).
  // Previously these were only requested when the Add-Device scan modal opened,
  // which meant users never got prompted on first launch.
  const startupPermissionsRequestedRef = useRef(false);
  useEffect(() => {
    if (!isLoggedIn) {
      // Reset so a future login also triggers the prompt.
      startupPermissionsRequestedRef.current = false;
      return;
    }
    if (profileGate !== 'ready') return;
    if (!startupResolved) return;
    if (selectProfileVisible) return;
    if (startupPermissionsRequestedRef.current) return;
    startupPermissionsRequestedRef.current = true;
    void requestPermissions();
  }, [isLoggedIn, profileGate, startupResolved, selectProfileVisible]);

  function startScan() {
    console.log('Scanning for BLE devices...');
    try {
      Promise.resolve(
        manager.startDeviceScan(
          null,
          null,
          (error: Error | null, device: Device | null) => {
            if (error) {
              console.log('Scan error:', error);
              return;
            }

            if (!device) return;

            // Keep devices keyed by id to avoid duplicates
            setDevices((prev) => {
              if (prev[device.id]) return prev;
              const next = { ...prev };
              next[device.id] = device;
              return next;
            });
          },
        ),
      ).catch((error: any) => {
        console.log('Scan start rejected:', error?.message || error);
      });
    } catch (error: any) {
      console.log('Scan start failed:', error?.message || error);
    }
  }

  function stopScan() {
    try {
      Promise.resolve(manager.stopDeviceScan()).catch(() => {});
    } catch (e) {
      // ignore
    }
  }

  async function connectToDevice(deviceId: string) {
    stopScan();
    setMessages((m) => [`Connecting to ${deviceId}...`, ...m]);
    try {
      const device = await manager.connectToDevice(deviceId);
      setConnectedId(device.id);
      await device.discoverAllServicesAndCharacteristics();

      // Discover services and characteristics and subscribe to notifiable ones
      const services: Service[] = await device.services();
      for (const svc of services) {
        try {
          const characteristics: Characteristic[] = await svc.characteristics();
          for (const ch of characteristics) {
            // subscribe if characteristic supports Notify/Indicate OR if it's the known BP UUIDs
            const chUuid = (ch.uuid || '').toLowerCase();
            const forceSubscribe = chUuid.includes('2a35') || chUuid.includes('2a36');
            if ((ch.isNotifiable || ch.isNotifying || (ch as any).isIndicatable || forceSubscribe) && svc.uuid && ch.uuid) {
              const monitor = device.monitorCharacteristicForService(
                svc.uuid,
                ch.uuid,
                  (error: Error | null, characteristic: Characteristic | null) => {
                    if (error) {
                      console.log('Monitor error', error);
                      setMessages((m) => [`Monitor error: ${error.message}`, ...m]);
                      return;
                    }

                    if (characteristic?.value) {
                    const bytes = base64ToBytes(characteristic.value);

                    const charUuid = (characteristic.uuid || '').toLowerCase();
                    const timestamp = new Date().toLocaleTimeString();

                    // Parse BP Measurement (0x2A35) using same indexes as Python parser
                    if (charUuid.includes('2a35')) {
                      const sys = bytes.length > 1 ? bytes[1] : null;
                      const dia = bytes.length > 3 ? bytes[3] : null;
                      const pulse = bytes.length > 14 ? bytes[14] : null;
                      setMessages((m) => [
                        `[${timestamp}] Pressure-extra | SYS=${sys} mmHg | DIA=${dia} mmHg | Pulse=${pulse} bpm`,
                        ...m,
                      ]);
                    } else if (charUuid.includes('2a36')) {
                      // Intermediate cuff pressure (follow on_pressure_main)
                      const sys = bytes.length > 1 ? bytes[1] : null;
                      setMessages((m) => [`[${timestamp}] Pressure-main | SYS=${sys} mmHg`, ...m]);
                    } else {
                      // Default: try to show printable ASCII, otherwise show base64
                      let printable = '';
                      for (let i = 0; i < bytes.length; i++) {
                        const b = bytes[i];
                        if (b >= 32 && b <= 126) printable += String.fromCharCode(b);
                        else printable += '.';
                      }
                      const display = printable.trim() ? printable : characteristic.value;
                      setMessages((m) => [`[${timestamp}] ${display}`, ...m]);
                    }
                  }
                }
              );
              monitorsRef.current.push(monitor as any);
              if (forceSubscribe) {
                // Try to enable CCCD for indicate (0x02) first, then notify (0x01).
                const cccd = '00002902-0000-1000-8000-00805f9b34fb';
                try {
                  const enableIndicate = base64.encode(String.fromCharCode(0x02, 0x00));
                  // write descriptor if available (some platforms expose writeDescriptorForService)
                  if ((device as any).writeDescriptorForService) {
                    Promise.resolve((device as any).writeDescriptorForService(svc.uuid, ch.uuid, cccd, enableIndicate)).catch((err: any) => {
                      console.log('CCCD write failed for', ch.uuid, err?.message || err);
                    });
                    console.log('Wrote CCCD indicate for', ch.uuid);
                  }
                } catch (e) {
                  // ignore if not supported
                }
              }
            }
          }
        } catch (e) {
          console.warn('Characteristic discovery failed for service', svc.uuid, e);
        }
      }
      setMessages((m) => [`Connected to ${deviceId}`, ...m]);
    } catch (e: any) {
      console.warn('Connect failed', e);
      setMessages((m) => [`Connect failed: ${e?.message ?? e}`, ...m]);
    }
  }

  function disconnect() {
    if (!connectedId) return;
    manager
      .cancelDeviceConnection(connectedId)
      .then(() => {
        setMessages((m) => [`Disconnected ${connectedId}`, ...m]);
        setConnectedId(null);
        monitorsRef.current.forEach((m) => m.remove && m.remove());
        monitorsRef.current = [];
        startScan();
      })
      .catch((e: any) => {
        console.warn('Disconnect error', e);
      });
  }

  const deviceListAll = Object.values(devices);
  // Filter by any advertised name field (name or localName) containing 'Yuwell' (case-insensitive)
  const deviceList = deviceListAll.filter((d) => {
    const rawName = (d.name ?? (d as any).localName ?? '').toString();
    return /yuwell/i.test(rawName);
  });

  const profileSheetOpenRef = useRef(profileSheetOpen);
  useEffect(() => {
    profileSheetOpenRef.current = profileSheetOpen;
  }, [profileSheetOpen]);

  const openProfileSheet = React.useCallback((opts?: { startHeight?: number; header?: ProfileHeaderProps }) => {
    if (profileSheetOpenRef.current) return;

    // Ensure the heavy screen is mounted before we start animating.
    setProfileSheetMounted(true);

    const nextCollapsed =
      opts && typeof opts.startHeight === 'number' && Number.isFinite(opts.startHeight)
        ? Math.max(120, Math.min(320, opts.startHeight))
        : DEFAULT_PROFILE_SHEET_COLLAPSED_HEIGHT;
    setProfileSheetCollapsedHeight(nextCollapsed);
    setProfileSheetHeader(opts?.header);

    setProfileSheetOpen(true);
    try { profileSheetAnim.stopAnimation(); } catch (e) {}
    profileSheetAnim.setValue(0);

    // Start the spring on the next frame so layout/mount work completes first.
    requestAnimationFrame(() => {
      Animated.spring(profileSheetAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
        mass: 0.8,
      }).start();
    });
  }, []);

  const closeProfileSheet = React.useCallback(() => {
    if (!profileSheetOpenRef.current) return;
    try { profileSheetAnim.stopAnimation(); } catch (e) {}
    Animated.spring(profileSheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 100,
      mass: 0.8,
    }).start(({ finished }) => {
      if (finished) {
        setProfileSheetOpen(false);
        setProfileSheetHeader(undefined);
      }
    });
  }, []);

  // Android back button closes the profile sheet first
  useEffect(() => {
    if (!profileSheetOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeProfileSheet();
      return true;
    });
    return () => sub.remove();
  }, [profileSheetOpen]);

  const isNetworkishError = React.useCallback((message: string) => {
    const lower = message.toLowerCase();
    return (
      lower.includes('network request failed') ||
      lower.includes('failed to fetch') ||
      lower.includes('aborted') ||
      lower.includes('timeout')
    );
  }, []);

  const isAuthError = React.useCallback((message: string) => {
    const lower = message.toLowerCase();
    return (
      lower.includes('401') ||
      lower.includes('403') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden') ||
      lower.includes('invalid token') ||
      lower.includes('token expired') ||
      lower.includes('jwt') ||
      lower.includes('auth token') ||
      lower.includes('not authenticated') ||
      lower.includes('session expired')
    );
  }, []);

  const checkProfilesGate = React.useCallback(async () => {
    setProfileGate('checking');
    setProfileGateError(null);
    try {
      // Fast path: use cached profiles to avoid gating the UI on network.
      // We'll still refresh from backend below.
      try {
        const cached = await getCachedProfiles();
        if (cached.length > 0) {
          setProfileGate('ready');
        }
      } catch {
        // ignore cache read failures
      }

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        await clearUserSession();
        setIsLoggedIn(false);
        return;
      }

      const profiles = await getMyProfiles(token);
      await setCachedProfiles(profiles as any);
      setProfileGate(profiles.length > 0 ? 'ready' : 'needs');
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Failed to check profiles';
      const isNetworkish = isNetworkishError(msg);

      if (isNetworkish) {
        const cached = await getCachedProfiles();
        if (cached.length > 0) {
          setProfileGate('ready');
          showToast('Offline: using saved profiles', 'info');
        } else {
          // Offline and no cache: let user create a local profile and sync later.
          setProfileGate('needs');
          showToast('Offline: you can create a profile now and sync later', 'info');
        }
        return;
      }

      if (isAuthError(msg)) {
        await clearUserSession();
        setIsLoggedIn(false);
        showToast('Session expired. Please log in again.', 'info');
        return;
      }

      setProfileGate('error');
      setProfileGateError(msg);
    }
  }, [isAuthError, isNetworkishError]);

  // After login, ensure the user has at least one profile before entering the main app.
  useEffect(() => {
    if (!isLoggedIn) {
      setProfileGate('unknown');
      setProfileGateError(null);
      setAvatarColorsReady(false);
      return;
    }

    // Prime avatar color cache early so UI can render the correct colors on first paint.
    let cancelled = false;
    primeAvatarColorCache()
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (!cancelled) setAvatarColorsReady(true);
      });

    checkProfilesGate();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    let disposed = false;

    const syncAlerts = async (profileId: number | null) => {
      if (disposed) return;

      if (!profileId || !Number.isFinite(profileId) || profileId <= 0) {
        void refreshBadge();
        return;
      }

      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token || disposed) return;
        await syncRemoteAlertsForProfile(token, profileId);
      } catch (err) {
        console.log('[AlertSync] Failed to sync remote alerts:', err);
      } finally {
        if (!disposed) {
          void refreshBadge();
        }
      }
    };

    void getActiveProfileId().then((profileId) => {
      void syncAlerts(profileId);
    });

    const unsubscribe = subscribeActiveProfileId((profileId) => {
      void syncAlerts(profileId);
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [isLoggedIn]);

  // When we come online, attempt to sync any offline changes.
  useEffect(() => {
    if (!isLoggedIn) return;

    const inFlight = { current: false };
    const doSync = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        const result = await runOutbox(token);

        // If user is still pointing at a local profile id, resolve it.
        const active = await AsyncStorage.getItem('activeProfileId');
        if (active) {
          const n = Number(active);
          if (Number.isFinite(n) && n < 0) {
            const resolved = await resolveProfileId(n);
            if (resolved > 0) await AsyncStorage.setItem('activeProfileId', String(resolved));
          }
        }

        if (result.successCount > 0 && result.failCount === 0) {
          showToast(`Synced ${result.successCount} change(s)`, 'success');
        } else if (result.successCount > 0 && result.failCount > 0) {
          showToast(`Synced ${result.successCount}, failed ${result.failCount}`, 'info');
        } else if (result.failCount > 0) {
          showToast(`Sync failed (${result.failCount})`, 'error');
        }

        // Refresh profiles cache after syncing.
        try {
          const profiles = await getMyProfiles(token);
          await setCachedProfiles(profiles as any);
        } catch {
          // ignore refresh failures
        }

        try {
          const activeProfileId = await getActiveProfileId();
          if (activeProfileId) {
            await syncRemoteAlertsForProfile(token, activeProfileId);
          }
        } catch (err) {
          console.log('[AlertSync] Failed to refresh remote alerts after sync:', err);
        } finally {
          void refreshBadge();
        }
      } finally {
        inFlight.current = false;
      }
    };

    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (online) doSync();
    });

    // Kick once on mount
    NetInfo.fetch().then((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (online) doSync();
    });

    return () => {
      unsub && unsub();
    };
  }, [isLoggedIn]);

  // Ensure when a user logs in we show the Home screen as the start point
  useEffect(() => {
    if (isLoggedIn) {
      pagerX.setValue(0);
      indicatorAnim.setValue(0);
      screenIndexRef.current = 0;
      setScreenIndex(0);
    }
  }, [isLoggedIn, pagerX, indicatorAnim]);

  // Keep local Yuwell model cache fresh so Add Device can resolve known types offline.
  useEffect(() => {
    if (!isLoggedIn) return;

    let cancelled = false;

    const refreshIfOnline = async () => {
      try {
        const state = await NetInfo.fetch();
        const online = !!state.isConnected && state.isInternetReachable !== false;
        if (!online || cancelled) return;
        await refreshYuwellModelCache();
      } catch {
        // ignore refresh failures; scanner still has server fallback when online
      }
    };

    refreshIfOnline();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  if (isLoggedIn !== true) {
    return <AppLoadingScreen subtitle="Loading..." />;
  }

  const appUpdateDialog = appUpdatePrompt ? (
    <DialogFrame
      visible={appUpdateVisible}
      onRequestClose={appUpdatePrompt.forceUpdate ? undefined : handleIgnoreAppUpdate}
      disableBackdropClose={appUpdatePrompt.forceUpdate}
    >
      <Text style={styles.appUpdateTitle}>
        {t(lang, appUpdatePrompt.forceUpdate ? 'app_update_required_title' : 'app_update_available_title')}
      </Text>
      <Text style={styles.appUpdateBody}>
        {t(lang, appUpdatePrompt.forceUpdate ? 'app_update_required_message' : 'app_update_available_message')}
      </Text>

      <View style={styles.appUpdateVersionCard}>
        <View style={styles.appUpdateVersionRow}>
          <Text style={styles.appUpdateVersionLabel}>{t(lang, 'app_update_current_version')}</Text>
          <Text style={styles.appUpdateVersionValue}>{appUpdatePrompt.currentVersion}</Text>
        </View>
        <View style={styles.appUpdateVersionRow}>
          <Text style={styles.appUpdateVersionLabel}>{t(lang, 'app_update_latest_version')}</Text>
          <Text style={styles.appUpdateVersionValue}>{appUpdatePrompt.latestVersion}</Text>
        </View>
      </View>

      {appUpdatePrompt.releaseNotes ? (
        <View style={styles.appUpdateNotesBlock}>
          <Text style={styles.appUpdateNotesTitle}>{t(lang, 'app_update_whats_new')}</Text>
          <Text style={styles.appUpdateNotesBody}>{appUpdatePrompt.releaseNotes}</Text>
        </View>
      ) : null}

      <View style={styles.appUpdateButtonsRow}>
        {!appUpdatePrompt.forceUpdate ? (
          <TouchableOpacity style={styles.appUpdateSecondaryButton} onPress={handleIgnoreAppUpdate}>
            <Text style={styles.appUpdateSecondaryText}>{t(lang, 'ignore')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.appUpdatePrimaryButton} onPress={handleUpdateNow}>
          <Text style={styles.appUpdatePrimaryText}>{t(lang, 'app_update_now')}</Text>
        </TouchableOpacity>
      </View>
    </DialogFrame>
  ) : null;

  if (!avatarColorsReady) {
    return (
      <>
        <AppLoadingScreen
          title={t(lang, 'loading_profile')}
          subtitle={t(lang, 'preparing_profiles')}
          imageSource={require('../../../assets/android-res/drawable/profile.png')}
          imageSize={84}
        />
        {appUpdateDialog}
      </>
    );
  }

  if (profileGate === 'unknown' || profileGate === 'checking') {
    return (
      <>
        <AppLoadingScreen
          title={t(lang, 'loading_profile')}
          subtitle={t(lang, 'please_wait')}
          imageSource={require('../../../assets/android-res/drawable/profile.png')}
          imageSize={84}
        />
        {appUpdateDialog}
      </>
    );
  }

  // Avoid rendering the main tabs until startup profiles have been resolved
  if (profileGate === 'ready' && !startupResolved) {
    return (
      <>
        <AppLoadingScreen
          title={t(lang, 'loading_profile')}
          subtitle={t(lang, 'preparing_profiles')}
          imageSource={require('../../../assets/android-res/drawable/profile.png')}
          imageSize={84}
        />
        {appUpdateDialog}
      </>
    );
  }

  if (profileGate === 'error') {
    return (
      <>
        <StatusBar barStyle={'dark-content'} backgroundColor={'#f9fafb'} translucent={false} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f9fafb' }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#fee2e2',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <Text style={{ fontSize: 32 }}>⚠️</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Unable to load profile</Text>
          <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>{profileGateError || 'Please try again.'}</Text>
          <TouchableOpacity
            style={{
              width: '100%',
              backgroundColor: '#111827',
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 12,
              marginBottom: 12,
            }}
            onPress={() => {
              checkProfilesGate();
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              width: '100%',
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              backgroundColor: '#fff',
            }}
            onPress={async () => {
              await signOut();
            }}
          >
            <Text style={{ color: '#111827', fontWeight: '700', textAlign: 'center', fontSize: 16 }}>Log Out</Text>
          </TouchableOpacity>
        </View>
        {appUpdateDialog}
      </>
    );
  }

  if (profileGate === 'needs') {
    return (
      <>
        <StatusBar barStyle={'dark-content'} backgroundColor={'#f9fafb'} translucent={false} />
        <CreateProfileScreen
          onComplete={() => {
            setProfileGate('ready');
          }}
          onLogout={async () => {
            await signOut();
          }}
        />
        {appUpdateDialog}
      </>
    );
  }

  // Profile picker on startup (only when the account has multiple profiles).
  if (profileGate === 'ready' && selectProfileVisible) {
    return (
      <>
        <SelectProfileScreen
          profiles={startupProfiles as any}
          avatarMap={startupAvatarMap}
          activeProfileId={startupActiveProfileId}
          onSelectProfile={async (profileId) => {
            try {
              await setActiveProfileIdGlobal(profileId);
            } catch {
              await AsyncStorage.setItem('activeProfileId', String(profileId));
            }

            // Refresh badge after profile switch so it reflects the new profile's alerts.
            void refreshBadge();

            // Best-effort: notify server this profile was used so `last_used` updates.
            (async () => {
              try {
                const token = await AsyncStorage.getItem('authToken');
                if (token) await markProfileUsed(token, Number(profileId), startupActiveProfileId ?? undefined);
              } catch {
                // ignore network/auth failures here; sync will handle retries
              }
            })();

            setStartupActiveProfileId(profileId);
            setSelectProfileVisible(false);
            setCreateProfileOverlayVisible(false);
          }}
          onAddProfile={() => setCreateProfileOverlayVisible(true)}
          onLogout={async () => {
            await signOut();
          }}
        />

        <CreateProfileFlowOverlay
          visible={createProfileOverlayVisible}
          preload
          onClose={() => setCreateProfileOverlayVisible(false)}
          onComplete={async (profileId?: number) => {
            // Refresh cache from server so the picker list stays accurate.
            try {
              const token = await AsyncStorage.getItem('authToken');
              if (token) {
                const remote = await getMyProfiles(token);
                await setCachedProfiles(remote as any);
              }
            } catch {
              // ignore
            }

            if (profileId && Number(profileId) > 0) {
              setStartupActiveProfileId(Number(profileId));
              setSelectProfileVisible(false);
            }
          }}
        />

        {appUpdateDialog}
      </>
    );
  }

  const activeTabKey = screens[screenIndex];

  const navigateToTab = (key: TabKey) => {
    if (modalOpenGlobalRef.current) return;
    if (dataManagementOverlayVisible) closeDataManagementScreenCallback();
    if (lineNotifyOverlayVisible) closeLineNotifyScreenCallback();
    if (profileSheetOpenRef.current) closeProfileSheet();
    const idx = screens.indexOf(key as any);

    if (closeTrendDetailOverlay()) {
      if (pendingTrendTabSwitchTimerRef.current) {
        clearTimeout(pendingTrendTabSwitchTimerRef.current);
        pendingTrendTabSwitchTimerRef.current = null;
      }

      if (idx !== -1 && idx !== screenIndexRef.current) {
        pendingTrendTabSwitchTimerRef.current = setTimeout(() => {
          pendingTrendTabSwitchTimerRef.current = null;
          switchTab(idx);
        }, 260);
      }
      return;
    }

    if (pendingTrendTabSwitchTimerRef.current) {
      clearTimeout(pendingTrendTabSwitchTimerRef.current);
      pendingTrendTabSwitchTimerRef.current = null;
    }

    if (idx === 2 && idx === screenIndexRef.current) {
      setTrendsScreenResetVersion((prev) => prev + 1);
      return;
    }
    if (idx !== -1) {
      switchTab(idx);
    }
  };

  return (
    <>
      <StatusBar barStyle={'dark-content'} backgroundColor={'#f9fafb'} translucent={false} />
      <TabNavigationProvider
        active={activeTabKey}
        navigateTo={navigateToTab}
        openProfileSheet={openProfileSheet}
        profileSheetOpen={profileSheetOpen}
        profileSheetHeader={profileSheetHeader}
        profileSheetAnim={profileSheetAnim}
      >
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <BleMonitoringHost enabled={true} />
          {/* Zyta-style horizontal pager */}
          <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#f9fafb' }}>
            <Animated.View
              style={{
                flex: 1,
                flexDirection: 'row',
                width: SCREEN_W * screens.length,
                transform: [{ translateX: pagerX }],
              }}>
              {tabPages}
            </Animated.View>

            {/* Profile sheet: true slide-down from top (under BottomNav) */}
            {profileSheetOpen || profileSheetMounted ? (
              <Animated.View
                pointerEvents={profileSheetOpen ? 'auto' : 'none'}
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
                needsOffscreenAlphaCompositing
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1500,
                  elevation: 12,
                  backgroundColor: '#f9fafb',
                  opacity: profileSheetOpen ? 1 : 0,
                  transform: [
                    {
                      translateY: profileSheetAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-height, 0],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                }}
              >
                <ProfileScreen
                  setIsLoggedIn={setIsLoggedIn}
                  suppressLoadingIndicator
                  sheetMode
                  collapsedHeight={profileSheetCollapsedHeight}
                  openCreateProfileFlow={() => setCreateProfileOverlayVisible(true)}
                  onClosePress={closeProfileSheet}
                />
              </Animated.View>
            ) : null}
          </View>

          <CreateProfileFlowOverlay
            visible={createProfileOverlayVisible}
            preload
            onClose={() => setCreateProfileOverlayVisible(false)}
          />

          <BottomNav active={activeTabKey} onPress={(key) => navigateToTab(key as TabKey)} alertBadge={alertBadge} tabPosition={indicatorAnim} />

          <PolicyConsentFlowOverlay
            visible={policyConsentOverlayVisible}
            profileId={policyConsentProfileId}
            initialRoute={policyConsentInitialRoute}
            onClose={closePolicyConsentFlowCallback}
          />

          <DataManagementOverlay
            visible={dataManagementOverlayVisible}
            profileId={dataManagementProfileId}
            onClose={closeDataManagementScreenCallback}
          />

          <LineNotifyOverlay
            visible={lineNotifyOverlayVisible}
            profileId={lineNotifyProfileId}
            onClose={closeLineNotifyScreenCallback}
          />
        </View>
      </TabNavigationProvider>
      {appUpdateDialog}
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  list: { maxHeight: 200, marginBottom: 12 },
  device: { padding: 8, borderBottomWidth: 1, borderColor: '#eee' },
  deviceName: { fontSize: 16 },
  deviceId: { fontSize: 12, color: '#666' },
  messages: { flex: 1, marginTop: 8 },
  messageText: { fontSize: 13, paddingVertical: 2 },
  button: {
    backgroundColor: '#007aff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  appUpdateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  appUpdateBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4b5563',
  },
  appUpdateVersionCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  appUpdateVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  appUpdateVersionLabel: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  appUpdateVersionValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '800',
  },
  appUpdateNotesBlock: {
    marginTop: 16,
  },
  appUpdateNotesTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '800',
    marginBottom: 6,
  },
  appUpdateNotesBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  appUpdateButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    gap: 10,
  },
  appUpdateSecondaryButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  appUpdateSecondaryText: {
    color: '#111827',
    fontWeight: '800',
  },
  appUpdatePrimaryButton: {
    backgroundColor: '#064b75',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  appUpdatePrimaryText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
