import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  StatusBar,
  Animated,
  InteractionManager,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  API_BASE_URL,
  getMedicalGeneral,
  upsertMedicalGeneral,
  type MedicalGeneralInfoPayload,
} from '../../profiles/api/profileApi';
import { showToast } from '../../../shared/ui/toast';
import NetInfo from '@react-native-community/netinfo';
import { DeviceSummary } from '../../devices/components/ScanDeviceCard';
import {
  requestTrendDetail,
  type TrendDetailMetric,
  useTabNavigationActions,
} from '../../../shared/navigation/tabNavigation';
import {
  useLiveReadings,
  clearAllLiveReadings,
  type MeasurementKind,
} from '../../devices/lib/liveReadings';
import { getCachedProfiles } from '../../profiles/storage/profileCache';
import { isDeviceMarkedConnected } from '../../devices/lib/bleManager';
import {
  getProfileAvatar,
  type ProfileAvatar,
} from '../../profiles/lib/profileAvatar';
import {
  getAvatarColorForProfile,
  getCachedAvatarColor,
  getSavedAvatarColor,
  getInitialsFromName,
} from '../../profiles/lib/avatarColors';
import {
  setActiveProfileId as setActiveProfileIdGlobal,
  subscribeActiveProfileId,
  subscribeProfilesUpdated,
  subscribeProfileAvatarsUpdated,
} from '../../profiles/lib/profileEvents';
import { useProfileConsents } from '../../legal/hooks/useProfileConsents';
import { LinearGradient } from 'expo-linear-gradient';
import InfoDialog from '../../../shared/components/InfoDialog';
import DialogFrame from '../../../shared/components/DialogFrame';
import CroppedAvatarImage from '../../../shared/components/CroppedAvatarImage';
import HealthTrendWidget, {
  type HealthStatus as HomeHealthStatus,
  type MetricItem as HomeMetricItem,
} from '../components/HealthTrendWidget';
import HomeVitalsGrid, {
  type HomeVitalCardItem,
} from '../components/HomeVitalsGrid';
import {
  addAilinkScaleListener,
  isAilinkAvailable,
  isWeightScaleText,
  type AILinkScaleEvent,
} from '../../../shared/lib/ailinkScale';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  evaluateBloodPressure,
  evaluateSpO2,
  evaluateGlucose,
  evaluateTemperature,
  getStatusColor,
  getOverallStatus,
  getStatusMessage,
  toWidgetOverallStatus,
  toTrendStatus,
  type HealthStatusLevel,
  type HealthTrendStatus,
} from '../../../shared/lib/healthThresholds';

import styles from './HomeScreen.styles';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import {
  Colors,
  Layout,
  Radius,
  Shadows,
} from '../../../shared/theme/theme';
import { enqueueUpsertMedicalGeneral } from '../../../shared/sync/syncOutbox';
import {
  getSecureItem,
  setSecureItem,
} from '../../../shared/storage/secureLocalStorage';

// Shimmer skeleton bar for loading states
const SkeletonPulse = React.memo(function SkeletonPulse({
  width,
  height,
  borderRadius = 4,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: 'rgba(255,255,255,0.25)',
          opacity,
        },
        style,
      ]}
    />
  );
});

type ProfileWidgetProps = {
  profileName: string;
  subtitle?: string;
  avatarSource?: any;
  onPress?: () => void;
};

const ProfileWidget = React.memo(function ProfileWidget({
  profileName,
  subtitle = 'Active Profile',
  avatarSource,
  onPress,
}: ProfileWidgetProps) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  const defaultAvatar = require('../../../../assets/android-res/drawable/profile.png');

  return (
    <Wrapper
      style={profileWidgetStyles.container}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={profileWidgetStyles.avatarWrap}>
        <Image
          source={avatarSource || defaultAvatar}
          style={profileWidgetStyles.avatar}
          resizeMode="cover"
        />
      </View>
      <View style={profileWidgetStyles.infoSection}>
        <Text style={profileWidgetStyles.name} numberOfLines={1}>
          {profileName || 'No Profile'}
        </Text>
        <Text style={profileWidgetStyles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={profileWidgetStyles.chevron}>›</Text>
    </Wrapper>
  );
});

type VitalKind = 'Pressure' | 'Glucose' | 'Thermometer' | 'Oximeter';

const KEY_HOME_PREFERRED_DEVICE_BY_KIND = 'home.preferredDeviceByKind.v1';

function normalizeWeightKg(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').replace(',', '.').trim());
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function readFiniteNumber(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').replace(',', '.').trim());
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function extractWeightKgFromBodyFat(
  bodyFat?: Record<string, unknown>,
): number | null {
  if (!bodyFat || typeof bodyFat !== 'object') return null;

  // Prefer explicit kg fields when present.
  const directCandidates = ['weightKg', 'weight_kg', 'kg'];
  for (const key of directCandidates) {
    const direct = normalizeWeightKg((bodyFat as any)?.[key]);
    if (direct != null) return direct;
  }

  // Many AILink complete payloads send weight as an integer + decimal precision.
  const rawWeight = readFiniteNumber((bodyFat as any)?.weight);
  if (rawWeight == null || rawWeight <= 0) return null;

  const rawDecimal = readFiniteNumber(
    (bodyFat as any)?.weightDecimal ?? (bodyFat as any)?.decimal,
  );
  const decimalPlaces =
    rawDecimal != null
      ? Math.max(0, Math.min(4, Math.round(rawDecimal)))
      : 0;

  let normalizedWeight = rawWeight / Math.pow(10, decimalPlaces);

  // weightUnit observed in payloads: 0=kg, 1/3=lb-ish, 2=jin.
  const unit = Math.round(readFiniteNumber((bodyFat as any)?.weightUnit) ?? 0);
  if (unit === 1 || unit === 3) {
    normalizedWeight = normalizedWeight * 0.45359237;
  } else if (unit === 2) {
    normalizedWeight = normalizedWeight / 2;
  }

  return normalizeWeightKg(normalizedWeight);
}

function extractWeightKgFromEvent(event: AILinkScaleEvent): number | null {
  const direct = normalizeWeightKg(event.weightKg);
  if (direct != null) return direct;

  const fromBodyFat = extractWeightKgFromBodyFat(event.bodyFat);
  if (fromBodyFat != null) return fromBodyFat;

  const text = String(event.text || '').trim();
  if (!text) return null;

  const match = text.match(/(\d+(?:[.,]\d+)?)/);
  return match ? normalizeWeightKg(match[1]) : null;
}

function getMedicalGeneralCacheKey(profileId: number): string {
  return `medicalGeneralCache.v1.${profileId}`;
}

function evaluateBmiStatus(bmi: number): HealthStatusLevel {
  // WHO BMI classification mapped to 4 app severity levels.
  // Excellent: 18.5 - 24.9 (normal)
  // Good: 25.0 - 29.9 (overweight / pre-obese)
  // Warning: 16.0 - 18.4 or 30.0 - 34.9 (underweight or obese class I)
  // Critical: < 16.0 or >= 35.0 (severe thinness or obese class II/III)
  if (bmi < 16 || bmi >= 35) return 'Critical';
  if (bmi < 18.5 || bmi >= 30) return 'Warning';
  if (bmi >= 25) return 'Good';
  return 'Excellent';
}

function toMedicalGeneralPayload(
  medical: any,
  weightKg: number,
): MedicalGeneralInfoPayload {
  return {
    date_of_birth: medical?.date_of_birth ?? null,
    sex: medical?.sex ?? null,
    organ_donor: medical?.organ_donor ?? null,
    blood_type: medical?.blood_type ?? null,
    height_cm: medical?.height_cm ?? null,
    weight_kg: Number(weightKg.toFixed(1)),
    allergies: medical?.allergies ?? null,
    chronic_conditions: medical?.chronic_conditions ?? null,
    medications: medical?.medications ?? null,
    family_history: medical?.family_history ?? null,
    emergency_contact: medical?.emergency_contact ?? null,
    insurance_provider: medical?.insurance_provider ?? null,
    insurance_number: medical?.insurance_number ?? null,
  };
}

function isNetworkishError(error: unknown): boolean {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as any).message || '').toLowerCase()
      : '';

  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('aborted')
  );
}

const HomeScreen = React.memo(function HomeScreen({
  setIsLoggedIn,
}: {
  setIsLoggedIn: (value: boolean) => void;
}) {
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { navigateTo, openProfileSheet, profileSheetOpen, profileSheetAnim } =
    useTabNavigationActions();
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [activeProfileName, setActiveProfileName] = useState<string | null>(
    null,
  ); // null = loading
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [activeAvatar, setActiveAvatar] = useState<ProfileAvatar | null>(null);
  const [preferredDeviceByKind, setPreferredDeviceByKind] = useState<
    Partial<Record<VitalKind, string>>
  >({});
  const [deviceConsentDialogVisible, setDeviceConsentDialogVisible] =
    useState(false);
  const [healthAlertConsentDialogVisible, setHealthAlertConsentDialogVisible] =
    useState(false);
  const [devicePickerKind, setDevicePickerKind] = useState<VitalKind | null>(
    null,
  );
  const homeCardActionsReadyRef = useRef(false);

  // --- Weight scale (AILink) state ---
  const [lastWeightKg, setLastWeightKg] = useState<number | null>(null);
  const [weightScaleName, setWeightScaleName] = useState<string | null>(null);
  const [weightScaleConnected, setWeightScaleConnected] =
    useState<boolean>(false);
  const [medicalGeneral, setMedicalGeneral] = useState<any | null>(null);
  const [medicalHeightCm, setMedicalHeightCm] = useState<number | null>(null);
  const lastWeightSyncKeyRef = useRef<string>('');

  // Listen for AILink scale events (weight + complete)
  useEffect(() => {
    if (!isAilinkAvailable()) return;
    const unsubscribe = addAilinkScaleListener((event: AILinkScaleEvent) => {
      if (event.type === 'connected') {
        setWeightScaleConnected(true);
      }

      if (event.type === 'disconnected') {
        setWeightScaleConnected(false);
      }

      if (event.type === 'weight' || event.type === 'complete') {
        setWeightScaleConnected(true);
        const kg = extractWeightKgFromEvent(event);
        console.log('[home] scale event', event.type, 'extracted kg=', kg);
        if (kg != null && kg > 0) {
          setLastWeightKg(kg);
          const name = event.displayName || event.name || null;
          if (name) setWeightScaleName(name);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Restore the last weight reading per profile so the Home card survives tab
  // switches and app restarts (live scale events are otherwise transient).
  useEffect(() => {
    const profileId = activeProfileId;
    if (!profileId) return;
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`homeLastWeight.v1.${profileId}`);
        if (alive && raw) {
          const kg = Number(JSON.parse(raw)?.kg);
          if (Number.isFinite(kg) && kg > 0) setLastWeightKg(kg);
        }
      } catch {
        // ignore restore failures
      }
    })();
    return () => { alive = false; };
  }, [activeProfileId]);

  // Persist the last weight whenever it changes.
  useEffect(() => {
    const profileId = activeProfileId;
    if (!profileId || lastWeightKg == null || lastWeightKg <= 0) return;
    AsyncStorage.setItem(
      `homeLastWeight.v1.${profileId}`,
      JSON.stringify({ kg: lastWeightKg, ts: Date.now() }),
    ).catch(() => {});
  }, [activeProfileId, lastWeightKg]);

  // Fetch profile height from medical_general_info for BMI display on the weight card.
  useEffect(() => {
    let alive = true;

    if (activeProfileId == null) {
      setMedicalGeneral(null);
      setMedicalHeightCm(null);
      return () => {
        alive = false;
      };
    }

    (async () => {
      const cacheKey = getMedicalGeneralCacheKey(activeProfileId);
      let hadCachedMedical = false;

      try {
        const cachedRaw = await getSecureItem(cacheKey);
        if (alive && cachedRaw) {
          try {
            const cachedMedical = JSON.parse(cachedRaw);
            setMedicalGeneral(cachedMedical);
            hadCachedMedical = true;
            const cachedHeight = Number(cachedMedical?.height_cm);
            setMedicalHeightCm(
              Number.isFinite(cachedHeight) && cachedHeight > 0
                ? cachedHeight
                : null,
            );
          } catch {
            // ignore broken cache JSON and continue to network fetch
          }
        }

        const token = await AsyncStorage.getItem('authToken');
        if (!alive || !token) {
          if (alive && !cachedRaw) {
            setMedicalGeneral(null);
            setMedicalHeightCm(null);
          }
          return;
        }

        const medical = await getMedicalGeneral(token, activeProfileId);
        if (!alive) return;

        setMedicalGeneral(medical || null);
        try {
          await setSecureItem(cacheKey, JSON.stringify(medical || null));
        } catch {
          // ignore cache write failures
        }

        const heightCm = Number(medical?.height_cm);
        setMedicalHeightCm(
          Number.isFinite(heightCm) && heightCm > 0 ? heightCm : null,
        );
      } catch {
        if (alive && !hadCachedMedical) {
          setMedicalGeneral(null);
          setMedicalHeightCm(null);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [activeProfileId]);

  useEffect(() => {
    const profileId = activeProfileId;
    if (!profileId || lastWeightKg == null || lastWeightKg <= 0) return;

    const roundedWeight = Number(lastWeightKg.toFixed(1));
    const syncKey = `${profileId}:${roundedWeight}`;
    if (lastWeightSyncKeyRef.current === syncKey) return;
    lastWeightSyncKeyRef.current = syncKey;

    let cancelled = false;

    const syncWeight = async () => {
      const cacheKey = getMedicalGeneralCacheKey(profileId);

      let baseMedical = medicalGeneral;
      if (!baseMedical || typeof baseMedical !== 'object') {
        try {
          const cachedRaw = await getSecureItem(cacheKey);
          if (cachedRaw) {
            const cachedMedical = JSON.parse(cachedRaw);
            if (cachedMedical && typeof cachedMedical === 'object') {
              baseMedical = cachedMedical;
            }
          }
        } catch {
          // ignore cache read failures
        }
      }

      const token = await AsyncStorage.getItem('authToken');
      if ((!baseMedical || typeof baseMedical !== 'object') && token) {
        try {
          baseMedical = await getMedicalGeneral(token, profileId);
        } catch {
          // ignore and use remaining fallbacks
        }
      }

      if (!baseMedical || typeof baseMedical !== 'object') {
        // Avoid sending a partial payload that could overwrite other fields.
        return;
      }

      const payload = toMedicalGeneralPayload(baseMedical, roundedWeight);
      const localMedical = { ...baseMedical, weight_kg: roundedWeight };

      if (!cancelled) {
        setMedicalGeneral(localMedical);
        try {
          await setSecureItem(cacheKey, JSON.stringify(localMedical));
        } catch {
          // ignore cache write failures
        }
      }

      if (!token) return;

      try {
        await upsertMedicalGeneral(token, profileId, payload);
      } catch (error) {
        if (isNetworkishError(error)) {
          await enqueueUpsertMedicalGeneral(profileId, payload);
        }
      }
    };

    void syncWeight();

    return () => {
      cancelled = true;
    };
  }, [activeProfileId, lastWeightKg, medicalGeneral]);

  const activeProfileConsents = useProfileConsents(activeProfileId);
  const canUseMedicalDevices = activeProfileConsents?.consent_granted !== false;
  const canUseHealthAlerts = activeProfileConsents?.consent_granted !== false;

  const BOTTOM_NAV_HEIGHT = Layout.bottomTabHeight;
  const homeBottomContentPadding = BOTTOM_NAV_HEIGHT;
  const isCompactWidth = width < 360;
  const isTabletWidth = width >= 768;
  const heroAvatarSize = isCompactWidth ? 72 : isTabletWidth ? 88 : 80;
  const heroAvatarRadius = heroAvatarSize / 2;

  // Ensure stable top spacing on Android while safe-area insets resolve (prevents initial layout jump).
  const stableTopInset = Math.max(
    insets.top || 0,
    StatusBar.currentHeight || 0,
  );

  // If device consent is revoked, immediately clear any live data shown on Home.
  useEffect(() => {
    if (canUseMedicalDevices) return;
    clearAllLiveReadings();
  }, [canUseMedicalDevices]);

  // cause rerender when readings update and get live readings snapshot
  const liveReadings = useLiveReadings();

  const refreshActiveProfileFromCache = useCallback(
    async (preferredId?: number | null) => {
      try {
        const profiles = await getCachedProfiles();
        const stored = await AsyncStorage.getItem('activeProfileId');

        const preferred = preferredId != null ? String(preferredId) : null;
        const activeIdStr = preferred || stored;

        let nextId: number | null = null;
        let nextName = '';

        if (activeIdStr && profiles.length > 0) {
          const p = profiles.find(x => String(x.id) === activeIdStr);
          if (p) {
            nextId = Number(p.id);
            nextName = p.profile_label || '';
          }
        }

        if (nextId == null && profiles.length > 0) {
          nextId = Number(profiles[0].id);
          nextName = profiles[0].profile_label || '';
          // If no active profile is stored, persist+broadcast the default.
          if (!stored) {
            try {
              await setActiveProfileIdGlobal(nextId);
            } catch {
              // ignore
            }
          }
        }

        setActiveProfileId(nextId);
        setActiveProfileName(nextName);
      } catch {
        // ignore
      }
    },
    [],
  );

  // Keep Home profile header in sync with ProfileScreen changes.
  useEffect(() => {
    refreshActiveProfileFromCache();

    const unsub1 = subscribeActiveProfileId(id => {
      // Clear live readings when profile changes
      clearAllLiveReadings();
      void refreshActiveProfileFromCache(id);
    });
    const unsub2 = subscribeProfilesUpdated(() => {
      void refreshActiveProfileFromCache();
    });

    return () => {
      try {
        unsub1();
      } catch {}
      try {
        unsub2();
      } catch {}
    };
  }, [refreshActiveProfileFromCache]);

  // Prevent occasional startup/transition ghost taps from opening Trends unexpectedly.
  useEffect(() => {
    homeCardActionsReadyRef.current = false;

    const fallbackTimer = setTimeout(() => {
      homeCardActionsReadyRef.current = true;
    }, 650);

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      homeCardActionsReadyRef.current = true;
      clearTimeout(fallbackTimer);
    });

    return () => {
      clearTimeout(fallbackTimer);
      try {
        interactionTask.cancel();
      } catch {
        // ignore cancellation edge cases
      }
    };
  }, [activeProfileId]);

  const loadActiveAvatar = useCallback(async () => {
    if (activeProfileId == null) {
      setActiveAvatar(null);
      return;
    }

    try {
      const av = await getProfileAvatar(activeProfileId);
      setActiveAvatar(av);
    } catch {
      setActiveAvatar(null);
    }
  }, [activeProfileId]);

  // Load avatar for active profile and refresh when avatar changes elsewhere.
  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      if (!alive) return;
      await loadActiveAvatar();
    };

    refresh();
    const unsub = subscribeProfileAvatarsUpdated(() => {
      void refresh();
    });

    return () => {
      alive = false;
      try {
        unsub();
      } catch {}
    };
  }, [loadActiveAvatar]);

  // Load persisted preferred devices per vital kind.
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(
          KEY_HOME_PREFERRED_DEVICE_BY_KIND,
        );
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!alive || !parsed || typeof parsed !== 'object') return;
        setPreferredDeviceByKind(parsed as Partial<Record<VitalKind, string>>);
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const persistPreferredDeviceByKind = useCallback(
    async (next: Partial<Record<VitalKind, string>>) => {
      try {
        await AsyncStorage.setItem(
          KEY_HOME_PREFERRED_DEVICE_BY_KIND,
          JSON.stringify(next),
        );
      } catch {
        // ignore
      }
    },
    [],
  );

  const fetchDevices = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setDevices([]);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/users/me/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
        const msg =
          data?.error ||
          data?.message ||
          `Failed fetching devices (status ${res.status})`;
        showToast(msg, 'error');
        setDevices([]);
        return;
      }
      const json = await res.json();
      const list = Array.isArray(json.devices) ? json.devices : [];
      const seen = new Map<string, any>();
      for (const d of list) {
        const key = d.device_id || String(d.id || '');
        if (!seen.has(key)) seen.set(key, d);
      }
      setDevices(Array.from(seen.values()));
    } catch (e: any) {
      const msg = e?.message
        ? String(e.message)
        : 'Network error fetching devices';
      showToast(msg, 'info');
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    // subscribe to global device updates (emitted by AddDeviceModal/DeviceDialog)
    let unsub: (() => void) | null = null;
    try {
      const mod = require('../../devices/lib/deviceEvents');
      if (mod && typeof mod.subscribeDeviceUpdates === 'function') {
        unsub = mod.subscribeDeviceUpdates(fetchDevices);
      }
    } catch {
      unsub = null;
    }
    return () => {
      try {
        if (unsub) unsub();
      } catch {}
    };
  }, [fetchDevices]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (online) fetchDevices();
    });
    return () => {
      unsub && unsub();
    };
  }, [fetchDevices]);

  const topCards = useMemo(() => {
    const normalize = (d: DeviceSummary) =>
      `${d.device_type || ''} ${d.device_name || ''} ${
        d.factory_name || ''
      }`.toLowerCase();

    type Category = 'Blood Pressure' | 'Blood Glucose' | 'Temperature' | 'SpO2';
    const categoryOrder: Category[] = [
      'Blood Pressure',
      'Blood Glucose',
      'Temperature',
      'SpO2',
    ];
    const icons: Record<Category, any> = {
      'Blood Pressure': require('../../../../assets/android-res/drawable/pressure.png'),
      'Blood Glucose': require('../../../../assets/android-res/drawable/glucose.png'),
      Temperature: require('../../../../assets/android-res/drawable/temperature.png'),
      SpO2: require('../../../../assets/android-res/drawable/spo2.png'),
    };

    const toTime = (v?: string) => {
      if (!v) return 0;
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : 0;
    };

    const classify = (d: DeviceSummary): Category | null => {
      const text = normalize(d);
      if (
        text.includes('pressure') ||
        text.includes('blood pressure') ||
        text.includes('bp')
      )
        return 'Blood Pressure';
      if (text.includes('glucose') || text.includes('blood glucose'))
        return 'Blood Glucose';
      if (
        text.includes('thermometer') ||
        text.includes('temperature') ||
        text.includes('temp')
      )
        return 'Temperature';
      if (
        text.includes('oximeter') ||
        text.includes('spo2') ||
        text.includes('o2')
      )
        return 'SpO2';
      return null;
    };

    // Group devices by category and sort newest first (by granted_at)
    const grouped = new Map<Category, DeviceSummary[]>();
    for (const d of devices) {
      const cat = classify(d);
      if (!cat) continue;
      const arr = grouped.get(cat) || [];
      arr.push(d);
      grouped.set(cat, arr);
    }
    for (const [cat, arr] of grouped.entries()) {
      arr.sort((a, b) => toTime(b.granted_at) - toTime(a.granted_at));
      grouped.set(cat, arr);
    }

    // Flatten in category order; allows multiple cards of the same type.
    const out: Array<{ title: Category; icon: any; device: DeviceSummary }> =
      [];
    for (const cat of categoryOrder) {
      const arr = grouped.get(cat);
      if (!arr || arr.length === 0) continue;
      for (const d of arr) {
        out.push({ title: cat, icon: icons[cat], device: d });
      }
    }
    return out;
  }, [devices]);

  // Helper to format last update time
  const formatLastUpdate = useCallback((timestamp?: number | string) => {
    if (!timestamp) return '';
    const date =
      typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24)
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }, []);

  // Helper to get device connection status
  const getDeviceConnectionStatus = useCallback(
    (device: DeviceSummary): boolean => {
      const deviceId = String(device.device_id || '').trim();
      const normalizedDeviceId = deviceId.toUpperCase();
      // Check if device is marked as connected in BLE manager
      return (
        isDeviceMarkedConnected(deviceId) ||
        liveReadings.has(normalizedDeviceId)
      );
    },
    [liveReadings],
  );

  // Helper to get last reading time for a device
  const getLastReadingTime = useCallback(
    (device: DeviceSummary): string => {
      const deviceId = String(device.device_id || '').trim().toUpperCase();
      const deviceReadings = liveReadings.get(deviceId);
      let latestTs = 0;
      for (const reading of Object.values(deviceReadings || {})) {
        if (reading && reading.ts > latestTs) {
          latestTs = reading.ts;
        }
      }
      if (latestTs) {
        return formatLastUpdate(latestTs);
      }
      // Fall back to granted_at if no live readings
      return formatLastUpdate(device.granted_at);
    },
    [formatLastUpdate, liveReadings],
  );

  // Sort devices: connected first, then disconnected
  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      const aConnected = getDeviceConnectionStatus(a);
      const bConnected = getDeviceConnectionStatus(b);
      if (aConnected && !bConnected) return -1;
      if (!aConnected && bConnected) return 1;
      return 0;
    });
  }, [devices, getDeviceConnectionStatus]);

  const weightScaleDevices = useMemo(() => {
    return sortedDevices.filter(device => {
      const text = `${device.device_type || ''} ${device.display_name || ''} ${
        device.device_name || ''
      } ${device.factory_name || ''} ${(device as any).medical_device_type || ''}`;
      const platform = String((device as any).platform || '').toLowerCase();
      return isWeightScaleText(text) || platform === 'ailink';
    });
  }, [sortedDevices]);

  const getDeviceKind = useCallback(
    (device: DeviceSummary): VitalKind | null => {
      const text = `${device.device_type || ''} ${device.display_name || ''} ${
        device.device_name || ''
      } ${device.factory_name || ''}`.toLowerCase();
      if (text.includes('pressure') || text.includes('bp')) return 'Pressure';
      if (text.includes('glucose')) return 'Glucose';
      if (
        text.includes('thermometer') ||
        text.includes('temperature') ||
        text.includes('temp')
      )
        return 'Thermometer';
      if (
        text.includes('oximeter') ||
        text.includes('spo2') ||
        text.includes('o2')
      )
        return 'Oximeter';
      return null;
    },
    [],
  );

  const candidatesByKind = useMemo(() => {
    const grouped: Record<VitalKind, DeviceSummary[]> = {
      Pressure: [],
      Glucose: [],
      Thermometer: [],
      Oximeter: [],
    };

    for (const device of sortedDevices) {
      const kind = getDeviceKind(device);
      if (!kind) continue;
      grouped[kind].push(device);
    }

    return grouped;
  }, [sortedDevices, getDeviceKind]);

  // Remove stale preferred picks when devices are removed.
  useEffect(() => {
    setPreferredDeviceByKind(prev => {
      let changed = false;
      const next: Partial<Record<VitalKind, string>> = { ...prev };

      (Object.keys(next) as VitalKind[]).forEach(kind => {
        const selectedId = next[kind];
        if (!selectedId) return;
        const stillExists = (candidatesByKind[kind] || []).some(
          d => String(d.device_id || '') === selectedId,
        );
        if (!stillExists) {
          delete next[kind];
          changed = true;
        }
      });

      if (changed) {
        void persistPreferredDeviceByKind(next);
      }
      return changed ? next : prev;
    });
  }, [candidatesByKind, persistPreferredDeviceByKind]);

  const pickDeviceForKind = useCallback(
    (kind: VitalKind): DeviceSummary | null => {
      const candidates = candidatesByKind[kind] || [];
      if (!candidates.length) return null;

      const selectedId = preferredDeviceByKind[kind];
      if (selectedId) {
        const selected = candidates.find(
          d => String(d.device_id || '') === selectedId,
        );
        if (selected) return selected;
      }

      return candidates[0];
    },
    [candidatesByKind, preferredDeviceByKind],
  );

  const openCardAction = useCallback(
    (kind: VitalKind) => {
      if (!homeCardActionsReadyRef.current) {
        return;
      }

      if (!canUseMedicalDevices) {
        setDeviceConsentDialogVisible(true);
        return;
      }
      const metricByKind: Record<VitalKind, TrendDetailMetric> = {
        Pressure: 'bp',
        Glucose: 'glucose',
        Thermometer: 'temp',
        Oximeter: 'spo2',
      };
      const metric = metricByKind[kind];
      navigateTo('Trends');
      requestTrendDetail(metric);
    },
    [canUseMedicalDevices, navigateTo],
  );

  const selectPreferredDevice = useCallback(
    (kind: VitalKind, deviceId: string, displayName: string) => {
      if (!deviceId) return;
      setPreferredDeviceByKind(prev => {
        const updated = { ...prev, [kind]: deviceId };
        void persistPreferredDeviceByKind(updated);
        return updated;
      });
      setDevicePickerKind(null);
      showToast(`${t(lang, 'picker_switching')} ${displayName}`, 'info');
    },
    [persistPreferredDeviceByKind, lang],
  );

  const getLiveReadingForDevice = useCallback(
    (device: DeviceSummary | null, kind: MeasurementKind) => {
      if (!device) return null;
      const deviceId = String(device.device_id || '').trim().toUpperCase();
      if (!deviceId) return null;
      return liveReadings.get(deviceId)?.[kind] || null;
    },
    [liveReadings],
  );

  const getVitalValue = useCallback(
    (kind: VitalKind, device: DeviceSummary | null): string | null => {
      if (kind === 'Pressure') return getLiveReadingForDevice(device, 'bp')?.text ?? null;
      if (kind === 'Glucose') return getLiveReadingForDevice(device, 'glucose')?.text ?? null;
      if (kind === 'Thermometer') return getLiveReadingForDevice(device, 'temp')?.text ?? null;
      if (kind === 'Oximeter') return getLiveReadingForDevice(device, 'spo2')?.text ?? null;
      return null;
    },
    [getLiveReadingForDevice],
  );

  const splitVitalValue = useCallback((raw: string | null, separator: string) => {
    if (!raw) {
      return { valueText: null, valueLine2: null };
    }

    const splitIndex = raw.indexOf(separator);
    if (splitIndex < 0) {
      return { valueText: raw, valueLine2: null };
    }

    return {
      valueText: raw.slice(0, splitIndex),
      valueLine2: raw.slice(splitIndex + separator.length),
    };
  }, []);

  // Compute dynamic health trends based on live readings
  const healthTrendData = useMemo(() => {
    const pressure = pickDeviceForKind('Pressure');
    const glucose = pickDeviceForKind('Glucose');
    const temp = pickDeviceForKind('Thermometer');
    const spo2 = pickDeviceForKind('Oximeter');

    const readings = liveReadings;

    const getHealthStatus = (
      kind: MeasurementKind,
      device: DeviceSummary | null,
    ): { status: HealthStatusLevel | null; hasDevice: boolean } => {
      if (!device) return { status: null, hasDevice: false };
      const deviceId = String(device.device_id || '');
      const deviceReadings = readings.get(deviceId);
      const reading = deviceReadings?.[kind];
      if (!reading?.values) return { status: null, hasDevice: true };

      switch (kind) {
        case 'bp': {
          const { sys, dia } = reading.values;
          // Check for valid BP values (not -1 sentinel and greater than 0)
          if (
            sys != null &&
            dia != null &&
            sys > 0 &&
            dia > 0 &&
            sys !== -1 &&
            dia !== -1
          ) {
            return {
              status: evaluateBloodPressure({ sys, dia }),
              hasDevice: true,
            };
          }
          return { status: null, hasDevice: true };
        }
        case 'spo2': {
          const { spo2: spo2Val } = reading.values;
          // Check for valid SpO2 values (not -1 sentinel and greater than 0)
          if (spo2Val != null && spo2Val > 0 && spo2Val !== -1) {
            return { status: evaluateSpO2({ spo2: spo2Val }), hasDevice: true };
          }
          return { status: null, hasDevice: true };
        }
        case 'glucose': {
          const { mgdl } = reading.values;
          // Check for valid glucose values (greater than 0)
          if (mgdl != null && mgdl > 0) {
            return { status: evaluateGlucose({ mgdl }), hasDevice: true };
          }
          return { status: null, hasDevice: true };
        }
        case 'temp': {
          const { c } = reading.values;
          // Check for valid temperature values (celsius should be reasonable range)
          if (c != null && c > 0) {
            return {
              status: evaluateTemperature({ celsius: c }),
              hasDevice: true,
            };
          }
          return { status: null, hasDevice: true };
        }
        default:
          return { status: null, hasDevice: true };
      }
    };

    const bpResult = getHealthStatus('bp', pressure);
    const glucoseResult = getHealthStatus('glucose', glucose);
    const tempResult = getHealthStatus('temp', temp);
    const spo2Result = getHealthStatus('spo2', spo2);

    const statusToMetric = (result: {
      status: HealthStatusLevel | null;
      hasDevice: boolean;
    }): HomeHealthStatus => {
      if (!result.hasDevice) return 'No Device';
      if (!result.status) return 'Waiting'; // Device connected but waiting for valid reading
      switch (result.status) {
        case 'Critical':
          return 'Alert';
        case 'Warning':
          return 'Warning';
        case 'Good':
          return 'Normal';
        case 'Excellent':
          return 'Excellent';
      }
    };

    const metrics: HomeMetricItem[] = [
      { label: 'Blood Pressure', status: statusToMetric(bpResult) },
      { label: 'Blood Sugar', status: statusToMetric(glucoseResult) },
      { label: 'Temperature', status: statusToMetric(tempResult) },
      { label: 'Oxygen Level', status: statusToMetric(spo2Result) },
    ];

    // Calculate overall status from valid readings only
    const validStatuses: HealthStatusLevel[] = [
      bpResult.status,
      glucoseResult.status,
      tempResult.status,
      spo2Result.status,
    ].filter((s): s is HealthStatusLevel => s !== null);

    const hasAnyDevice =
      bpResult.hasDevice ||
      glucoseResult.hasDevice ||
      tempResult.hasDevice ||
      spo2Result.hasDevice;
    const hasAnyReading = validStatuses.length > 0;

    let overallStatus: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'ALERT' = 'GOOD';
    let message = t(lang, 'connect_devices_msg');

    if (hasAnyReading) {
      const overall = getOverallStatus(validStatuses);
      overallStatus = toWidgetOverallStatus(overall);
      message = getStatusMessage(overall, hasAnyDevice);
    } else if (hasAnyDevice) {
      // Has device but no readings yet - keep status neutral
      message = t(lang, 'waiting_readings_msg');
    } else {
      // No devices connected - explicitly set message to match visual expectation
      message = t(lang, 'connect_devices_msg');
    }

    return { overallStatus, message, metrics };
  }, [pickDeviceForKind, liveReadings, lang]);

  const activeAvatarSource = activeAvatar?.uri
    ? { uri: activeAvatar.uri }
    : undefined;

  const bmiValue = useMemo(() => {
    if (lastWeightKg == null || medicalHeightCm == null || medicalHeightCm <= 0) {
      return null;
    }

    const heightM = medicalHeightCm / 100;
    if (!Number.isFinite(heightM) || heightM <= 0) return null;

    const bmi = lastWeightKg / (heightM * heightM);
    if (!Number.isFinite(bmi) || bmi <= 0) return null;
    return bmi;
  }, [lastWeightKg, medicalHeightCm]);

  const bmiStatus = useMemo<HealthStatusLevel | null>(() => {
    if (bmiValue == null) return null;
    return evaluateBmiStatus(bmiValue);
  }, [bmiValue]);

  const weightCardColor = useMemo(() => {
    if (!bmiStatus) return null;
    return getStatusColor(bmiStatus);
  }, [bmiStatus]);

  useEffect(() => {
    console.log('[home] weight card inputs → lastWeightKg=', lastWeightKg,
      'heightCm=', medicalHeightCm, 'bmi=', bmiValue,
      'connected=', weightScaleConnected, 'devices=', weightScaleDevices.length);
  }, [lastWeightKg, medicalHeightCm, bmiValue, weightScaleConnected, weightScaleDevices]);

  const vitalCards = useMemo<HomeVitalCardItem[]>(() => {
    const pressure = pickDeviceForKind('Pressure');
    const glucose = pickDeviceForKind('Glucose');
    const temp = pickDeviceForKind('Thermometer');
    const spo2 = pickDeviceForKind('Oximeter');
    const weightScaleDevice = weightScaleDevices[0] || null;
    const pressureConnected = pressure
      ? getDeviceConnectionStatus(pressure)
      : false;
    const glucoseConnected = glucose
      ? getDeviceConnectionStatus(glucose)
      : false;
    const tempConnected = temp ? getDeviceConnectionStatus(temp) : false;
    const spo2Connected = spo2 ? getDeviceConnectionStatus(spo2) : false;

    const pressureValue = splitVitalValue(
      getVitalValue('Pressure', pressure),
      ' • ',
    );
    const oxygenValue = splitVitalValue(
      getVitalValue('Oximeter', spo2),
      ' / ',
    );

    return [
      {
        id: 'pressure',
        title: t(lang, 'blood_pressure'),
        icon: require('../../../../assets/android-res/drawable/pressure.png'),
        deviceName:
          pressure?.display_name ||
          pressure?.device_name ||
          pressure?.factory_name ||
          null,
        valueText: pressureValue.valueText,
        valueLine2: pressureValue.valueLine2,
        hasDevice: !!pressure,
        isConnected: pressureConnected,
        hasMultipleDevices: (candidatesByKind.Pressure || []).length > 1,
        locked: !canUseMedicalDevices,
        onPress: () => openCardAction('Pressure'),
      },
      {
        id: 'glucose',
        title: t(lang, 'blood_glucose'),
        icon: require('../../../../assets/android-res/drawable/glucose.png'),
        deviceName:
          glucose?.display_name ||
          glucose?.device_name ||
          glucose?.factory_name ||
          null,
        valueText: getVitalValue('Glucose', glucose),
        valueLine2: null,
        hasDevice: !!glucose,
        isConnected: glucoseConnected,
        hasMultipleDevices: (candidatesByKind.Glucose || []).length > 1,
        locked: !canUseMedicalDevices,
        onPress: () => openCardAction('Glucose'),
      },
      {
        id: 'temperature',
        title: t(lang, 'temperature'),
        icon: require('../../../../assets/android-res/drawable/temperature.png'),
        deviceName:
          temp?.display_name || temp?.device_name || temp?.factory_name || null,
        valueText: getVitalValue('Thermometer', temp),
        valueLine2: null,
        hasDevice: !!temp,
        isConnected: tempConnected,
        hasMultipleDevices: (candidatesByKind.Thermometer || []).length > 1,
        locked: !canUseMedicalDevices,
        onPress: () => openCardAction('Thermometer'),
      },
      {
        id: 'oxygen',
        title: t(lang, 'oxygen_level'),
        icon: require('../../../../assets/android-res/drawable/spo2.png'),
        deviceName:
          spo2?.display_name || spo2?.device_name || spo2?.factory_name || null,
        valueText: oxygenValue.valueText,
        valueLine2: oxygenValue.valueLine2,
        hasDevice: !!spo2,
        isConnected: spo2Connected,
        hasMultipleDevices: (candidatesByKind.Oximeter || []).length > 1,
        locked: !canUseMedicalDevices,
        onPress: () => openCardAction('Oximeter'),
      },
      // Weight scale (AILink SDK — standalone, not BLE device system)
      {
        id: 'weight',
        title: t(lang, 'weight_scale'),
        icon: require('../../../../assets/android-res/drawable/weight.png'),
        deviceName:
          weightScaleName ||
          weightScaleDevice?.display_name ||
          weightScaleDevice?.device_name ||
          weightScaleDevice?.factory_name ||
          null,
        valueText: bmiValue != null ? `${bmiValue.toFixed(1)}` : null,
        valueLine2:
          lastWeightKg != null
            ? `${lastWeightKg.toFixed(1)} ${t(lang, 'weight_kg_suffix')}`
            : null,
        accentColor: weightCardColor,
        bmiHintText:
          lastWeightKg != null && (medicalHeightCm == null || medicalHeightCm <= 0)
            ? t(lang, 'weight_bmi_requires_height')
            : null,
        hasDevice:
          !!weightScaleDevice || lastWeightKg != null || weightScaleConnected,
        isConnected: weightScaleConnected,
        hasMultipleDevices: false,
        locked: !canUseMedicalDevices,
        onPress: () => {
          if (!canUseMedicalDevices) {
            setDeviceConsentDialogVisible(true);
            return;
          }
          navigateTo('Devices');
        },
      },
      // Yuwell CGM (continuous glucose) — placeholder for future API integration.
      {
        id: 'cgm',
        title: t(lang, 'cgm_title'),
        icon: require('../../../../assets/android-res/drawable/glucose_monitor.png'),
        deviceName: t(lang, 'coming_soon'),
        valueText: null,
        valueLine2: null,
        hasDevice: false,
        isConnected: false,
        hasMultipleDevices: false,
        locked: !canUseMedicalDevices,
        onPress: () => showToast(t(lang, 'cgm_coming_soon'), 'info'),
      },
    ];
  }, [
    candidatesByKind.Glucose,
    candidatesByKind.Oximeter,
    candidatesByKind.Pressure,
    candidatesByKind.Thermometer,
    canUseMedicalDevices,
    getDeviceConnectionStatus,
    getVitalValue,
    lang,
    bmiValue,
    medicalHeightCm,
    weightCardColor,
    lastWeightKg,
    weightScaleName,
    weightScaleConnected,
    weightScaleDevices,
    navigateTo,
    openCardAction,
    pickDeviceForKind,
    splitVitalValue,
  ]);

  const [savedAvatarColor, setSavedAvatarColor] = useState<string | null>(null);

  const initials = useMemo(
    () => getInitialsFromName(activeProfileName || ''),
    [activeProfileName],
  );

  // Load saved avatar color for active profile
  useEffect(() => {
    if (activeProfileId && activeProfileName) {
      setSavedAvatarColor(getCachedAvatarColor(activeProfileId));
      getSavedAvatarColor(activeProfileId, activeProfileName).then(c =>
        setSavedAvatarColor(c),
      );
    }
  }, [activeProfileId, activeProfileName]);

  const avatarColor = useMemo(() => {
    if (savedAvatarColor) return savedAvatarColor;
    if (activeProfileId) {
      const cached = getCachedAvatarColor(activeProfileId);
      if (cached) return cached;
    }
    const name = (activeProfileName || '').trim();
    return name ? getAvatarColorForProfile(name) : Colors.primary;
  }, [savedAvatarColor, activeProfileId, activeProfileName]);

  const greetingText = useMemo(() => {
    const h = new Date().getHours();

    const lateNightEn = [
      "It's late, consider getting some rest",
      'Still awake? Sleep is calling',
      "Late night mode on, don't forget to rest",
      'Burning the midnight oil, huh?',
      'Up late? tomorrow you will thank you for sleeping',
      "It's late, time to rest",
      'Still awake? Sweet dreams soon',
      'Night owl mode activated',
      'The day is done, get some sleep',
      'Late night scrolling detected',
    ];
    const morningEn = [
      'Good morning',
      'Rise and shine!',
      'Morning! Hope today treats you well',
      'A fresh day begins',
      "Good morning, let's get started",
    ];
    const afternoonEn = [
      'Good afternoon!',
      'Hope your day is going smoothly',
      "Keep going, you're doing great",
      'Good afternoon, stay focused',
      'Halfway through the day!',
    ];
    const eveningEn = [
      'Good evening',
      'Evening vibes incoming',
      'Hope you had a great day',
      'Good evening, time to unwind',
      "Relax, you've earned it",
    ];

    const lateNightTh = [
      'ดึกแล้ว ควรพักผ่อนได้แล้วนะ',
      'ยังตื่นอยู่อีกหรือ? ควรนอนได้แล้ว',
      'กลางดึกแล้ว อย่าลืมพักผ่อนด้วย',
      'เผาเทียนดึกอยู่หรือเปล่า?',
      'นอนดึกอีกแล้ว พรุ่งนี้จะขอบคุณตัวเองที่นอนหลับพักผ่อน',
    ];
    const morningTh = [
      'สวัสดีตอนเช้า',
      'อรุณสวัสดิ์!',
      'ตื่นแล้ว ขอให้วันนี้เป็นวันที่ดี',
      'วันใหม่เริ่มต้นแล้ว',
      'สวัสดีตอนเช้า ไปลุยกันเลย!',
    ];
    const afternoonTh = [
      'สวัสดีตอนบ่าย!',
      'วันนี้เป็นอย่างไรบ้าง?',
      'สู้ต่อไป ทำได้ดีมาก',
      'สวัสดีตอนบ่าย ตั้งใจต่อไปนะ',
      'ผ่านมาครึ่งวันแล้ว!',
    ];
    const eveningTh = [
      'สวัสดีตอนเย็น',
      'บรรยากาศยามเย็น',
      'หวังว่าวันนี้จะเป็นวันที่ดี',
      'สวัสดีตอนเย็น ได้เวลาพักผ่อนแล้ว',
      'พักผ่อนได้แล้ว คุณทำได้ดีมาก',
    ];

    const isEn = lang !== 'th';
    const lateNight = isEn ? lateNightEn : lateNightTh;
    const morning = isEn ? morningEn : morningTh;
    const afternoon = isEn ? afternoonEn : afternoonTh;
    const evening = isEn ? eveningEn : eveningTh;

    let pool = morning;
    if (h < 5) pool = lateNight;
    else if (h < 12) pool = morning;
    else if (h < 17) pool = afternoon;
    else if (h < 22) pool = evening;
    else pool = lateNight;

    return pool[Math.floor(Math.random() * pool.length)];
  }, [lang]);

  const todayLabel = useMemo(() => {
    const now = new Date();
    if (lang === 'th') {
      const thMonths = [
        'มกราคม',
        'กุมภาพันธ์',
        'มีนาคม',
        'เมษายน',
        'พฤษภาคม',
        'มิถุนายน',
        'กรกฎาคม',
        'สิงหาคม',
        'กันยายน',
        'ตุลาคม',
        'พฤศจิกายน',
        'ธันวาคม',
      ];
      const day = now.getDate();
      const mon = thMonths[now.getMonth()];
      const year = now.getFullYear() + 543;
      return `${day} ${mon} ${year}`;
    }
    const day = now.getDate();
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const mon = months[now.getMonth()];
    const year = now.getFullYear();
    return `${day} ${mon} ${year}`;
  }, [lang]);

  const handleOpenProfileSheet = useCallback(() => {
    openProfileSheet({
      startHeight: headerHeight || undefined,
      header: {
        greeting: greetingText,
        name: activeProfileName || undefined,
        dateLabel: todayLabel,
        avatarSource: activeAvatarSource,
        initials,
      },
    });
  }, [
    openProfileSheet,
    headerHeight,
    greetingText,
    activeProfileName,
    todayLabel,
    activeAvatarSource,
    initials,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.primary} />

      <InfoDialog
        visible={deviceConsentDialogVisible}
        title="Consent required"
        message="You didn’t consent to use this function. Please enable Consent 2 (Medical Device Data) to access device readings on Home."
        onClose={() => setDeviceConsentDialogVisible(false)}
      />

      <InfoDialog
        visible={healthAlertConsentDialogVisible}
        title="Consent required"
        message="You didn’t consent to use this function. Please enable Consent 3 (Health Alert Data) to view Health Trends on Home."
        onClose={() => setHealthAlertConsentDialogVisible(false)}
      />

      <DialogFrame
        visible={devicePickerKind !== null}
        onRequestClose={() => setDevicePickerKind(null)}
      >
        {devicePickerKind &&
          (() => {
            const pickerAccent = Colors.primary;
            const kindMeta: Record<VitalKind, { icon: any; labelKey: string }> =
              {
                Pressure: {
                  icon: require('../../../../assets/android-res/drawable/pressure.png'),
                  labelKey: 'blood_pressure',
                },
                Glucose: {
                  icon: require('../../../../assets/android-res/drawable/glucose.png'),
                  labelKey: 'blood_glucose',
                },
                Thermometer: {
                  icon: require('../../../../assets/android-res/drawable/temperature.png'),
                  labelKey: 'temperature',
                },
                Oximeter: {
                  icon: require('../../../../assets/android-res/drawable/spo2.png'),
                  labelKey: 'oxygen_level',
                },
              };
            const meta = kindMeta[devicePickerKind];
            const devices = candidatesByKind[devicePickerKind] || [];
            return (
              <View>
                {/* Full-width hero header — escapes DialogFrame's 16px padding via negative margins */}
                <View
                  style={[
                    devicePickerStyles.dpHero,
                    { backgroundColor: pickerAccent },
                  ]}
                >
                  <TouchableOpacity
                    style={devicePickerStyles.dpHeroClose}
                    onPress={() => setDevicePickerKind(null)}
                    hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  >
                    <Text style={devicePickerStyles.dpHeroCloseText}>
                      ✕
                    </Text>
                  </TouchableOpacity>
                  <View style={devicePickerStyles.dpHeroIconRing}>
                    <Image
                      source={meta.icon}
                      style={{
                        width: 34,
                        height: 34,
                        tintColor: Colors.textOnPrimary,
                      }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={devicePickerStyles.dpHeroKind}>
                    {t(lang, meta.labelKey)}
                  </Text>
                  <Text style={devicePickerStyles.dpHeroTitle}>
                    {t(lang, 'select_device')}
                  </Text>
                </View>

                {/* Device cards */}
                <View style={devicePickerStyles.dpList}>
                  {devices.map((device, index) => {
                    const id = String(device.device_id || '');
                    const explicitPreferred =
                      preferredDeviceByKind[devicePickerKind!];
                    const isActive = explicitPreferred
                      ? explicitPreferred === id
                      : index === 0;
                    const displayName = (
                      device.display_name ||
                      device.device_name ||
                      device.factory_name ||
                      'Unknown device'
                    ).trim();
                    const factoryName = device.factory_name
                      ? device.factory_name.trim()
                      : null;
                    const showFactory =
                      factoryName && factoryName !== displayName;
                    const isConnected = id
                      ? isDeviceMarkedConnected(id)
                      : false;
                    return (
                      <TouchableOpacity
                        key={id || `${devicePickerKind}-${index}`}
                        activeOpacity={0.75}
                        style={[
                          devicePickerStyles.dpCard,
                          isActive
                            ? devicePickerStyles.dpCardActive
                            : null,
                        ]}
                        onPress={() => {
                          if (!isActive)
                            selectPreferredDevice(
                              devicePickerKind!,
                              id,
                              displayName,
                            );
                        }}
                      >
                        <View style={devicePickerStyles.dpCardContent}>
                          {/* Name block + check circle */}
                          <View style={devicePickerStyles.dpCardNameRow}>
                            <View
                              style={devicePickerStyles.dpCardNameBlock}
                            >
                              <Text
                                numberOfLines={1}
                                style={[
                                  devicePickerStyles.dpCardName,
                                  isActive &&
                                    devicePickerStyles.dpCardNameActive,
                                ]}
                              >
                                {displayName}
                              </Text>
                              {showFactory && (
                                <Text
                                  numberOfLines={1}
                                  style={devicePickerStyles.dpCardFactory}
                                >
                                  {factoryName}
                                </Text>
                              )}
                            </View>
                            {isActive ? (
                              <View
                                style={[
                                  devicePickerStyles.dpCheckCircle,
                                  { backgroundColor: pickerAccent },
                                ]}
                              >
                                <Text style={devicePickerStyles.dpCheckMark}>
                                  ✓
                                </Text>
                              </View>
                            ) : (
                              <View style={devicePickerStyles.dpCheckCircleEmpty} />
                            )}
                          </View>

                          {/* Footer: status chip + active badge / tap-to-switch */}
                          <View style={devicePickerStyles.dpCardFooter}>
                            <View
                              style={[
                                devicePickerStyles.dpStatusChip,
                                isConnected
                                  ? devicePickerStyles.dpStatusChipOn
                                  : devicePickerStyles.dpStatusChipReady,
                              ]}
                            >
                              <View
                                style={[
                                  devicePickerStyles.dpStatusDot,
                                  {
                                    backgroundColor: isConnected
                                      ? Colors.success
                                      : pickerAccent,
                                  },
                                ]}
                              />
                              <Text
                                style={[
                                  devicePickerStyles.dpStatusText,
                                  isConnected
                                    ? devicePickerStyles.dpStatusTextOn
                                    : devicePickerStyles.dpStatusTextReady,
                                ]}
                              >
                                {isConnected
                                  ? t(lang, 'picker_status_connected')
                                  : t(lang, 'picker_status_ready')}
                              </Text>
                            </View>
                            {isActive ? (
                              <View
                                style={[
                                  devicePickerStyles.dpActivePill,
                                  {
                                    backgroundColor: pickerAccent + '18',
                                    borderColor: pickerAccent + '55',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    devicePickerStyles.dpActivePillText,
                                    { color: pickerAccent },
                                  ]}
                                >
                                  {t(lang, 'picker_currently_active')}
                                </Text>
                              </View>
                            ) : (
                              <Text
                                style={[
                                  devicePickerStyles.dpTapSwitch,
                                  { color: pickerAccent },
                                ]}
                              >
                                {t(lang, 'picker_tap_to_switch')} ›
                              </Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })()}
      </DialogFrame>

      {/* Animated header that slides down with profile sheet */}
      <Animated.View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        needsOffscreenAlphaCompositing
        style={[
          styles.animatedHeaderWrap,
          {
            transform: [
              {
                translateY: profileSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, height - BOTTOM_NAV_HEIGHT],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.heroWrap}>
          <View style={styles.heroClip}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleOpenProfileSheet}
            >
              <View
                onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
              >
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.heroBg,
                    {
                      paddingTop: 12 + stableTopInset,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.heroContent,
                      isCompactWidth && styles.heroContentCompact,
                      isTabletWidth && styles.heroContentTablet,
                    ]}
                  >
                    <View style={styles.headerRow}>
                      {/* 
                      Image Profile Section
                      */}
                      <View
                        style={[
                          styles.headerRight,
                          {
                            width: heroAvatarSize,
                            height: heroAvatarSize,
                          },
                        ]}
                        pointerEvents="box-none"
                      >
                        {activeProfileName === null ? (
                          <SkeletonPulse
                            width={heroAvatarSize}
                            height={heroAvatarSize}
                            borderRadius={heroAvatarRadius}
                          />
                        ) : activeAvatar?.uri ? (
                          <CroppedAvatarImage
                            avatar={activeAvatar}
                            size={heroAvatarSize}
                          />
                        ) : initials ? (
                          <View
                            style={[
                              styles.initialsWrap,
                              {
                                width: heroAvatarSize,
                                height: heroAvatarSize,
                                borderRadius: heroAvatarRadius,
                              },
                              { backgroundColor: avatarColor },
                            ]}
                          >
                            <Text
                              style={[
                                styles.initialsText,
                                isCompactWidth && styles.initialsTextCompact,
                              ]}
                            >
                              {initials}
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.initialsWrap,
                              {
                                width: heroAvatarSize,
                                height: heroAvatarSize,
                                borderRadius: heroAvatarRadius,
                              },
                              { backgroundColor: avatarColor },
                            ]}
                          >
                            <Text
                              style={[
                                styles.initialsText,
                                isCompactWidth && styles.initialsTextCompact,
                              ]}
                            >
                              ?
                            </Text>
                          </View>
                        )}

                        {activeProfileName === null ? null : (
                          <View
                            style={styles.heroEditBadge}
                            pointerEvents="none"
                          >
                            <Ionicons
                              name="pencil"
                              size={14}
                              color={Colors.text}
                            />
                          </View>
                        )}
                      </View>

                      {/* 
                      Text Header Right Section
                      */}
                      <View
                        style={[
                          styles.headerRightA,
                          isCompactWidth && styles.headerTextColumnCompact,
                        ]}
                      >
                        {activeProfileName === null ? (
                          <>
                            <SkeletonPulse
                              width={styles.heroGreetingSkeleton.width}
                              height={styles.heroGreetingSkeleton.height}
                              style={styles.heroGreetingSkeleton}
                            />
                            <SkeletonPulse
                              width={styles.heroNameSkeleton.width}
                              height={styles.heroNameSkeleton.height}
                              borderRadius={styles.heroNameSkeleton.borderRadius}
                              style={styles.heroNameSkeleton}
                            />
                            <SkeletonPulse
                              width={styles.heroDateSkeleton.width}
                              height={styles.heroDateSkeleton.height}
                              style={styles.heroDateSkeleton}
                            />
                          </>
                        ) : (
                          <>
                            <Text
                              style={[
                                styles.greeting,
                                isCompactWidth && styles.greetingCompact,
                              ]}
                            >
                              {greetingText}
                            </Text>
                            <Text
                              style={[
                                styles.largeName,
                                isCompactWidth && styles.largeNameCompact,
                                isTabletWidth && styles.largeNameTablet,
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.85}
                            >
                              {activeProfileName || t(lang, 'select_profile')}
                            </Text>
                            <Text
                              style={[
                                styles.dateText,
                                isCompactWidth && styles.dateTextCompact,
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.9}
                            >
                              {todayLabel}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: homeBottomContentPadding },
        ]}
        removeClippedSubviews={true}
        scrollEventThrottle={16}
        bounces={false}
      >
        {/* Spacer to account for header height */}
        <View style={{ height: headerHeight || 160 }} />

        <View
          style={[
            styles.body,
            isCompactWidth && styles.bodyCompact,
            isTabletWidth && styles.bodyTablet,
          ]}
        >
          {/* Vitals cards */}
          <HomeVitalsGrid
            cards={vitalCards.filter(card => card.id !== 'weight')}
          />

          {/* Health Trend Widget */}
          <HealthTrendWidget
            overallStatus={healthTrendData.overallStatus}
            message={healthTrendData.message}
            metrics={healthTrendData.metrics}
            locked={!canUseHealthAlerts}
            onPress={() => setHealthAlertConsentDialogVisible(true)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

const profileWidgetStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 0,
    ...Shadows.soft,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.gray100,
    overflow: 'hidden',
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
  },
  infoSection: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSubtle,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 20,
    color: Colors.textDisabled,
    marginLeft: 8,
  },
});

const devicePickerStyles = StyleSheet.create({
  dpHero: {
    marginTop: -16,
    marginLeft: -16,
    marginRight: -16,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    paddingTop: 36,
    paddingBottom: 28,
    alignItems: 'center',
  },
  dpHeroClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpHeroCloseText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  dpHeroIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dpHeroKind: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dpHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textOnPrimary,
    letterSpacing: 0.2,
  },
  dpList: {
    marginTop: 16,
    paddingBottom: 4,
  },
  dpCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginTop: 10,
    ...Shadows.soft,
  },
  dpCardActive: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dpCardContent: {
    padding: 16,
  },
  dpCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dpCardNameBlock: {
    flex: 1,
    marginRight: 10,
  },
  dpCardName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.gray700,
  },
  dpCardNameActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  dpCardFactory: {
    fontSize: 12,
    color: Colors.textDisabled,
    marginTop: 2,
  },
  dpCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpCheckCircleEmpty: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dpCheckMark: {
    color: Colors.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
  },
  dpActivePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  dpActivePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dpCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  dpStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dpStatusChipOn: {
    backgroundColor: Colors.successSoft,
    borderColor: '#BBF7D0',
  },
  dpStatusChipReady: {
    backgroundColor: Colors.infoSoft,
    borderColor: '#BFDBFE',
  },
  dpStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  dpStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textDisabled,
  },
  dpStatusTextOn: {
    color: Colors.success,
  },
  dpStatusTextReady: {
    color: Colors.primary,
  },
  dpTapSwitch: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default HomeScreen;
