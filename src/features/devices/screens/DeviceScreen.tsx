import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DeviceSummary } from '../components/ScanDeviceCard';
import AddDeviceModal from '../components/AddDeviceModal';
import RenameDeviceDialog from '../components/RenameDeviceDialog';
import RemoveDeviceDialog from '../components/RemoveDeviceDialog';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../../profiles/api/profileApi';
import { showToast } from '../../../shared/ui/toast';
import { isDeviceMarkedConnected } from '../lib/bleManager';
import { getLatestReadingTimestamp, useLiveReadings } from '../lib/liveReadings';
import { isWeightScaleText } from '../../../shared/lib/ailinkScale';
import DeviceCard from '../components/DeviceCard';
import styles from './DeviceScreen.styles';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { Layout, Spacing } from '../../../shared/theme/theme';

type MainDeviceKind = 'Pressure' | 'Glucose' | 'Thermometer' | 'Oximeter' | 'Scale';
const KEY_MAIN_DEVICE_BY_KIND = 'home.preferredDeviceByKind.v1';

const DeviceScreen = React.memo(function DeviceScreen({ setIsLoggedIn: _setIsLoggedIn }: { setIsLoggedIn?: (v: boolean) => void } = {}) {
  const { lang } = useLanguage();
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [renameDialogVisible, setRenameDialogVisible] = useState(false);
  const [removeDialogVisible, setRemoveDialogVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSummary | null>(null);
  const [preferredDeviceByKind, setPreferredDeviceByKind] = useState<Partial<Record<MainDeviceKind, string>>>({});
  // Subscribe so device cards update when live readings arrive.
  const liveReadings = useLiveReadings();
  const liveConnectedDeviceIds = useMemo(() => {
    return new Set(Array.from(liveReadings.keys()).map((deviceId) => String(deviceId || '').toUpperCase()));
  }, [liveReadings]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY_MAIN_DEVICE_BY_KIND);
        if (!raw || !alive) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        setPreferredDeviceByKind(parsed as Partial<Record<MainDeviceKind, string>>);
      } catch {
        // ignore persisted selection parse failures
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const persistPreferredDeviceByKind = useCallback(
    async (next: Partial<Record<MainDeviceKind, string>>) => {
      try {
        await AsyncStorage.setItem(KEY_MAIN_DEVICE_BY_KIND, JSON.stringify(next));
      } catch {
        // ignore persistence failures
      }
    },
    []
  );

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        showToast(t(lang, 'please_log_in'), 'error');
        setDevices([]);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/users/me/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.devices) ? json.devices : [];
        // Deduplicate devices by device_id (preferred) or id to avoid duplicate entries
        const seen = new Map();
        for (const d of list) {
          const key = d.device_id || String(d.id || '');
          if (!seen.has(key)) seen.set(key, d);
        }
        setDevices(Array.from(seen.values()));
      } else {
        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
        const msg = data?.error || data?.message || `Failed fetching devices (status ${res.status})`;
        console.warn('Failed fetching devices', res.status, msg);
        showToast(msg, 'error');
        setDevices([]);
      }
    } catch (e: any) {
      console.error('Error fetching devices', e);
      const msg = e?.message ? String(e.message) : 'Network error fetching devices';
      showToast(msg, 'info');
      // keep last known devices instead of clearing to reduce flicker
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (online) fetchDevices();
    });
    return () => {
      unsub && unsub();
    };
  }, [fetchDevices]);

  const formatLastUpdate = useCallback((timestamp?: number | string) => {
    if (!timestamp) return '';
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t(lang, 'just_now');
    if (diffMins < 60) return `${diffMins} ${t(lang, 'time_min_ago')}`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ${diffHours !== 1 ? t(lang, 'time_hours_ago') : t(lang, 'time_hour_ago')}`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ${diffDays !== 1 ? t(lang, 'time_days_ago') : t(lang, 'time_day_ago')}`;
  }, [lang]);

  const getDeviceKind = useCallback((device: DeviceSummary): MainDeviceKind | null => {
    const text = `${device.device_type || ''} ${device.display_name || ''} ${device.device_name || ''} ${device.factory_name || ''}`.toLowerCase();
    if (text.includes('pressure') || text.includes('bp')) return 'Pressure';
    if (text.includes('glucose')) return 'Glucose';
    if (text.includes('thermometer') || text.includes('temperature') || text.includes('temp')) return 'Thermometer';
    if (text.includes('oximeter') || text.includes('spo2') || text.includes('o2')) return 'Oximeter';
    if (isWeightScaleText(text)) return 'Scale';
    return null;
  }, []);

  const getDeviceIcon = useCallback((device: DeviceSummary) => {
    const kind = getDeviceKind(device);
    if (kind === 'Pressure') return require('../../../../assets/android-res/drawable/pressure_monitor.png');
    if (kind === 'Glucose') return require('../../../../assets/android-res/drawable/glucose_monitor.png');
    if (kind === 'Thermometer') return require('../../../../assets/android-res/drawable/thermometer.png');
    if (kind === 'Oximeter') return require('../../../../assets/android-res/drawable/oximeter.png');
    if (kind === 'Scale') return require('../../../../assets/android-res/drawable/weight_scale.png');
    return require('../../../../assets/android-res/drawable/device.png');
  }, [getDeviceKind]);

  const getDeviceLabel = useCallback((device: DeviceSummary) => {
    const kind = getDeviceKind(device);
    if (kind === 'Pressure') return t(lang, 'device_type_pressure');
    if (kind === 'Glucose') return t(lang, 'device_type_glucose');
    if (kind === 'Thermometer') return t(lang, 'device_type_thermometer');
    if (kind === 'Oximeter') return t(lang, 'device_type_oximeter');
    if (kind === 'Scale') return t(lang, 'device_type_scale');
    return lang === 'th' ? 'อุปกรณ์' : 'Device';
  }, [getDeviceKind, lang]);



  const isConnected = useCallback((device: DeviceSummary) => {
    const deviceId = String(device.device_id || '');
    const normalizedDeviceId = deviceId.toUpperCase();
    return isDeviceMarkedConnected(deviceId) || liveConnectedDeviceIds.has(normalizedDeviceId);
  }, [liveConnectedDeviceIds]);

  const getLastSyncText = useCallback(
    (device: DeviceSummary) => {
      const deviceId = String(device.device_id || '');
      const latestTs = getLatestReadingTimestamp(deviceId);
      const ts = latestTs || device.granted_at;
      const text = formatLastUpdate(ts);
      return text ? `${t(lang, 'last_sync')}: ${text}` : null;
    },
    [formatLastUpdate, lang]
  );

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      const aC = isConnected(a);
      const bC = isConnected(b);
      if (aC && !bC) return -1;
      if (!aC && bC) return 1;
      return 0;
    });
  }, [devices, isConnected]);

  const resolvedMainDeviceByKind = useMemo(() => {
    const grouped: Record<MainDeviceKind, DeviceSummary[]> = {
      Pressure: [],
      Glucose: [],
      Thermometer: [],
      Oximeter: [],
      Scale: [],
    };

    for (const device of sortedDevices) {
      const kind = getDeviceKind(device);
      if (!kind) continue;
      grouped[kind].push(device);
    }

    const resolved: Partial<Record<MainDeviceKind, string>> = {};
    for (const kind of Object.keys(grouped) as MainDeviceKind[]) {
      const list = grouped[kind];
      if (!list.length) continue;

      const preferredId = preferredDeviceByKind[kind];
      const preferred = preferredId
        ? list.find((device) => String(device.device_id || '') === preferredId)
        : null;
      const fallback = list[0];
      const selectedId = String((preferred || fallback)?.device_id || '');
      if (selectedId) resolved[kind] = selectedId;
    }

    return resolved;
  }, [getDeviceKind, preferredDeviceByKind, sortedDevices]);

  const bottomSpacerHeight = Layout.bottomTabHeight + Spacing.xl;

  const openRenameDialog = useCallback((device: DeviceSummary) => {
    setSelectedDevice(device);
    setRenameDialogVisible(true);
  }, []);

  const openRemoveDialog = useCallback((device: DeviceSummary) => {
    setSelectedDevice(device);
    setRemoveDialogVisible(true);
  }, []);

  const selectMainDevice = useCallback(
    (device: DeviceSummary) => {
      const kind = getDeviceKind(device);
      const deviceId = String(device.device_id || '');
      if (!kind || !deviceId) return;

      if (resolvedMainDeviceByKind[kind] === deviceId) return;

      setPreferredDeviceByKind((prev) => {
        const next = { ...prev, [kind]: deviceId };
        persistPreferredDeviceByKind(next).catch(() => undefined);
        return next;
      });

      const name = device.device_name || device.factory_name || device.device_id || (lang === 'th' ? 'อุปกรณ์' : 'Device');
      showToast(`${t(lang, 'picker_switching')} ${name}`, 'info');
    },
    [getDeviceKind, lang, persistPreferredDeviceByKind, resolvedMainDeviceByKind]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Scan Card (matches Home "Health Trends" card) */}
        <View style={styles.scanCard}>
          <View style={styles.scanHeader}>
            <View style={styles.scanHeaderText}>
              <Text style={styles.scanTitle}>{t(lang, 'scan_for_devices')}</Text>
              <Text style={styles.scanSubtitle}>{t(lang, 'bluetooth_on_hint')}</Text>
            </View>
            <Image source={require('../../../../assets/android-res/drawable/signal.png')} style={styles.scanIcon} resizeMode="contain" />
          </View>

          <Pressable style={styles.scanButton} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.scanButtonText}>{t(lang, 'start_scan')}</Text>
          </Pressable>
        </View>

        {/* Connected Devices */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(lang, 'connected_devices')}</Text>
          <Text style={styles.deviceCount}>{devices.length} {lang === 'th' ? 'อุปกรณ์' : devices.length !== 1 ? 'devices' : 'device'}</Text>
        </View>

        {devices.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={require('../../../../assets/android-res/drawable/device2.png')}
              style={styles.emptyIcon}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>{loading ? t(lang, 'loading_devices') : t(lang, 'no_devices_yet')}</Text>
            {!loading ? <Text style={styles.emptySubtitle}>{t(lang, 'scan_to_pair')}</Text> : null}
            {!loading ? (
              <Pressable style={styles.emptyActionButton} onPress={() => setAddModalVisible(true)}>
                <Text style={styles.emptyActionButtonText}>{t(lang, 'start_scan')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          sortedDevices.map((device) => {
            const kind = getDeviceKind(device);
            const deviceId = String(device.device_id || '');
            const isMain = !!kind && !!deviceId && resolvedMainDeviceByKind[kind] === deviceId;

            return (
              <DeviceCard
                key={device.device_id || String(device.id)}
                icon={getDeviceIcon(device)}
                deviceName={device.device_name || device.factory_name || device.device_id || 'Device'}
                deviceTypeLabel={getDeviceLabel(device)}
                lastSyncText={getLastSyncText(device)}
                isMain={isMain}
                onPress={() => selectMainDevice(device)}
                onRename={() => openRenameDialog(device)}
                onDelete={() => openRemoveDialog(device)}
              />
            );
          })
        )}

        <AddDeviceModal visible={addModalVisible} onRequestClose={() => setAddModalVisible(false)} onDeviceAdded={() => fetchDevices()} />

        <RenameDeviceDialog
          visible={renameDialogVisible}
          device={selectedDevice}
          onRequestClose={() => {
            setRenameDialogVisible(false);
            setSelectedDevice(null);
          }}
          onChanged={() => fetchDevices()}
        />

        <RemoveDeviceDialog
          visible={removeDialogVisible}
          device={selectedDevice}
          onRequestClose={() => {
            setRemoveDialogVisible(false);
            setSelectedDevice(null);
          }}
          onRemoved={() => fetchDevices()}
        />

        <View style={[styles.bottomSpacer, { height: bottomSpacerHeight }]} />
      </ScrollView>
    </SafeAreaView>
  );
});

export default DeviceScreen;
