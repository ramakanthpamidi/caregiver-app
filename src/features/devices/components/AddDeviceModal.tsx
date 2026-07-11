import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  Pressable,
  FlatList,
  Image,
  PermissionsAndroid,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Device as BleDevice, State as BleState } from 'react-native-ble-plx';
import { API_BASE_URL } from '../../profiles/api/profileApi';
import { getIconForDevice } from './ScanDeviceCard';
import { clearModalVisualProgress, pushModal, popModal, setModalVisualProgress } from '../../../shared/ui/statusBarManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToast } from '../../../shared/ui/toast';
import { emitDeviceUpdates } from '../lib/deviceEvents';
import { isOnline } from '../../../shared/sync/networkSync';
import { enqueueAddDevice } from '../../../shared/sync/syncOutbox';
import { resolveYuwellModel } from '../storage/yuwellModelCache';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { setScanModalOpen } from '../lib/deviceScanState';
import { bleManager as manager } from '../lib/bleManager';

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  onDeviceAdded?: (deviceRef: number) => void;
};

type FoundDevice = {
  id: string;
  bleName: string;
  displayName?: string;
  factoryName?: string;
  lastSeen: number;
  device: BleDevice;
};

function getIconForScanTile(bleName: string, displayName?: string, factoryName?: string) {
  // Match ScanDeviceCard behavior: it checks device_type/device_name/factory_name for keywords.
  const deviceLike = {
    device_type: displayName || '',
    device_name: bleName || '',
    factory_name: factoryName || '',
  };
  return getIconForDevice(deviceLike as any);
}

function getBleName(device: BleDevice): string {
  return (device.name || (device as any).localName || '').trim();
}

function isYuwellDevice(device: BleDevice): boolean {
  const name = getBleName(device).toLowerCase();
  return name.includes('yuwell');
}

function isAilinkDevice(device: BleDevice): boolean {
  const name = getBleName(device).toLowerCase();
  return name.includes('ailink');
}

function isSupportedDevice(device: BleDevice): boolean {
  return isYuwellDevice(device) || isAilinkDevice(device);
}

function useRadarRotation(active: boolean) {
  const rotate = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!active) {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
      rotate.setValue(0);
      return;
    }

    // Use a smoother, longer duration animation with linear easing
    animRef.current = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
      { resetBeforeIteration: false }
    );

    animRef.current.start();

    return () => {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
    };
  }, [active, rotate]);

  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return rotateDeg;
}

const RadarScanner = React.memo(function RadarScanner({ active }: { active: boolean }) {
  const rotateDeg = useRadarRotation(active);

  return (
    <View style={styles.radarWrap}>
      <View style={styles.radarCircleOuter}>
        <View style={styles.radarCircle2} />
        <View style={styles.radarCircle3} />
        <View style={styles.radarCircle4} />
        <View style={styles.radarCenterDot} />

        <Animated.View style={[styles.sweepWrap, { transform: [{ rotate: rotateDeg }] }]}>
          <View style={styles.sweepLine} />
          <LinearGradient
            colors={['rgba(43,156,211,0)', 'rgba(43,156,211,0.12)', 'rgba(43,156,211,0.35)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sweepGradient}
          />
        </Animated.View>
      </View>
    </View>
  );
});

export default function AddDeviceModal({ visible, onRequestClose, onDeviceAdded }: Props) {
  const { lang } = useLanguage();
  const { height: screenH, width: screenW } = useWindowDimensions();
  // Match SettingScreen sheet max height (70% of screen)
  const sheetHeight = useMemo(() => Math.round(screenH * 0.7), [screenH]);

  // responsive grid sizing
  const gridHorizontalPadding = 16;
  const gridGap = 12;
  const availableGridWidth = Math.max(0, screenW - gridHorizontalPadding * 2);
  // Keep the current tile size as the default, and only increase the column count on larger screens.
  // We keep a minimum of 2 columns, shrinking tiles only when needed to fit.
  const targetTileWidth = 158;
  const maxColumnsCap = 8;
  const columns = useMemo(() => {
    if (!availableGridWidth) return 2;
    const computed = Math.floor((availableGridWidth + gridGap) / (targetTileWidth + gridGap));
    return Math.min(maxColumnsCap, Math.max(2, computed));
  }, [availableGridWidth, gridGap]);
  const tileWidth = useMemo(() => {
    if (!availableGridWidth) return targetTileWidth;
    const fit = Math.floor((availableGridWidth - gridGap * (columns - 1)) / columns);
    return Math.min(targetTileWidth, fit);
  }, [availableGridWidth, columns, gridGap]);
  const centeredGridPadding = useMemo(() => {
    const used = columns * tileWidth + gridGap * (columns - 1);
    const extra = Math.max(0, availableGridWidth - used);
    return gridHorizontalPadding + Math.floor(extra / 2);
  }, [availableGridWidth, columns, gridGap, gridHorizontalPadding, tileWidth]);

  // Match SettingScreen behavior: fade in/out
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const navProgress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const openAnimRef = useRef<(() => void) | null>(null);
  const navVisualIdRef = useRef(`add-device-modal-nav-${Math.random().toString(36).slice(2)}`);

  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<Record<string, FoundDevice>>({});
  const [addingDeviceId, setAddingDeviceId] = useState<string | null>(null);
  const [existingDeviceIds, setExistingDeviceIds] = useState<Set<string>>(new Set());
  const [addedDeviceIds, setAddedDeviceIds] = useState<Set<string>>(new Set());
  const foundRef = useRef<Record<string, FoundDevice>>({});
  // buffer discovered devices on JS side to avoid frequent state updates
  const foundBufferRef = useRef<Record<string, FoundDevice>>({});
  const flushIntervalRef = useRef<number | null>(null);
  const pruneIntervalRef = useRef<number | null>(null);
  const resolveInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const listenerId = navProgress.addListener(({ value }) => {
      setModalVisualProgress(navVisualIdRef.current, value);
    });
    setModalVisualProgress(navVisualIdRef.current, 0);

    return () => {
      navProgress.removeListener(listenerId);
      clearModalVisualProgress(navVisualIdRef.current);
    };
  }, [navProgress]);

  useEffect(() => {
    foundRef.current = found;
  }, [found]);

  const stopScan = useCallback(() => {
    try {
      // stopDeviceScan returns a Promise in react-native-ble-plx; swallow rejections to avoid unhandled promise warnings
      Promise.resolve(manager.stopDeviceScan()).catch(() => {});
    } catch {
      // ignore
    }
    setScanning(false);
    // flush buffered devices once and clear interval
    if (flushIntervalRef.current) {
      try {
        clearInterval(flushIntervalRef.current as any);
      } catch {}
      flushIntervalRef.current = null;
    }
    if (pruneIntervalRef.current) {
      try {
        clearInterval(pruneIntervalRef.current as any);
      } catch {}
      pruneIntervalRef.current = null;
    }
    // final flush: merge remaining buffered entries into state and clear buffer
    if (Object.keys(foundBufferRef.current).length) {
      setFound((prev) => ({ ...prev, ...foundBufferRef.current }));
      foundBufferRef.current = {};
    }
  }, []);

  const loadExistingDevices = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/users/me/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const json = await res.json();
      const list = Array.isArray(json?.devices) ? json.devices : [];
      const ids = new Set<string>();
      for (const d of list) {
        const id = String(d?.device_id || '').trim();
        if (id) ids.add(id);
      }
      setExistingDeviceIds(ids);
    } catch {
      // ignore fetch errors here
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      const ok = Object.values(result).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
      return ok;
    } catch {
      return false;
    }
  }, []);

  const startScan = useCallback(async () => {
    const ok = await requestPermissions();
    if (!ok) {
      setScanning(false);
      return;
    }

    // Check if Bluetooth is powered on before scanning
    try {
      const bleState = await manager.state();
      if (bleState !== BleState.PoweredOn) {
        // Wait for user to enable Bluetooth
        await new Promise<void>((resolve, reject) => {
          const sub = manager.onStateChange((newState: string) => {
            if (newState === BleState.PoweredOn) {
              sub.remove();
              resolve();
            }
          }, false);
          Alert.alert(
            t(lang, 'bluetooth_off_title'),
            t(lang, 'bluetooth_off_message'),
            [
              {
                text: 'OK',
                onPress: () => {
                  // On Android, try to enable Bluetooth via system prompt
                  if (Platform.OS === 'android') {
                    try {
                        Promise.resolve(manager.enable()).catch(() => {});
                    } catch {}
                  }
                },
              },
            ],
          );
          // Timeout after 30 seconds so we don't hang forever
          setTimeout(() => { sub.remove(); reject(new Error('timeout')); }, 30000);
        });
      }
    } catch {
      // If state check fails or times out, still attempt the scan
    }
    // clear buffers and start scanning; buffer discoveries then flush at intervals
    foundBufferRef.current = {};
    setFound({});
    setScanning(true);

    // prune devices that haven't been seen recently
    const staleAfterMs = 7000;
    if (!pruneIntervalRef.current) {
      pruneIntervalRef.current = (setInterval(() => {
        const now = Date.now();
        setFound((prev) => {
          let changed = false;
          const next: Record<string, FoundDevice> = {};
          for (const [id, d] of Object.entries(prev)) {
            if (now - (d.lastSeen || 0) <= staleAfterMs) {
              next[id] = d;
            } else {
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }, 1000) as unknown) as number;
    }

    // flush buffered discoveries into state every 500ms to reduce churn
    if (!flushIntervalRef.current) {
      flushIntervalRef.current = (setInterval(() => {
        const buffer = foundBufferRef.current;
        const keys = Object.keys(buffer);
        if (keys.length) {
          // merge buffer into state, overwriting entries so server-resolved names update icons
          setFound((prev) => ({ ...prev, ...buffer }));
          // clear buffer (we've moved buffered entries into React state)
          foundBufferRef.current = {};
        }
      }, 500) as unknown) as number;
    }

    try {
      // startDeviceScan returns a Promise in react-native-ble-plx; swallow rejections to avoid unhandled promise warnings
      Promise.resolve(
        manager.startDeviceScan(null, null, (error: Error | null, device: BleDevice | null) => {
          if (error) {
            setScanning(false);
            return;
          }

          if (!device) return;
          if (!isSupportedDevice(device)) return;

          const bleName = getBleName(device);
          if (!bleName) return;

          const now = Date.now();
          const existing = foundRef.current[device.id] || foundBufferRef.current[device.id];
          const nextEntry: FoundDevice = {
            id: device.id,
            device,
            bleName,
            displayName: existing?.displayName,
            factoryName: existing?.factoryName,
            lastSeen: now,
          };
          foundBufferRef.current[device.id] = nextEntry;

          // If we already resolved model info for this device id, don't re-resolve.
          if (nextEntry.displayName) return;

          // AILink devices don't need server-side model resolution.
          if (isAilinkDevice(device)) {
            foundBufferRef.current[device.id] = {
              ...nextEntry,
              displayName: 'Weight Scale',
              factoryName: 'AILink Weight Scale',
            };
            return;
          }

          // Avoid spamming resolves; use BLE name as the key.
          if (resolveInFlightRef.current.has(bleName)) return;
          resolveInFlightRef.current.add(bleName);

          // Resolve model info from cache first, then server fallback.
          (async () => {
            try {
              const model = await resolveYuwellModel(bleName);
              const displayName = model?.display_name || null;
              const factoryName = model?.factory_name || null;

              if (displayName || factoryName) {
                const current = foundRef.current[device.id] || foundBufferRef.current[device.id];
                if (!current) return;
                foundBufferRef.current[device.id] = {
                  ...current,
                  displayName: displayName || current.displayName,
                  factoryName: factoryName || current.factoryName,
                };
              }
            } catch {
              // ignore network errors
            } finally {
              resolveInFlightRef.current.delete(bleName);
            }
          })();
        })
      ).catch(() => {
        setScanning(false);
      });
    } catch {
      setScanning(false);
    }
  }, [lang, requestPermissions]);

  const doClose = useCallback(
    (callOnRequest = true) => {
      stopScan();
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(navProgress, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start(() => {
        try {
          popModal();
        } catch {
          // ignore
        }
        setScanModalOpen(false);
        setMounted(false);
        if (callOnRequest) onRequestClose();
      });
    },
    [backdrop, fadeAnim, navProgress, onRequestClose, stopScan]
  );

  // Handle open/close transitions.
  // Fade-in starts after two rAFs (~33ms) so layout settles before animating,
  // without the 300-700ms Android onShow delay.
  useEffect(() => {
    if (visible && !mounted) {
      setScanModalOpen(true);
      // Reset animation values BEFORE mounting to prevent flash
      fadeAnim.setValue(0);
      backdrop.setValue(0);
      navProgress.setValue(0);
      try { pushModal(); } catch {}
      setMounted(true);
      setAddedDeviceIds(new Set());
      loadExistingDevices();
      let cancelled = false;
      const id1 = requestAnimationFrame(() => {
        const id2 = requestAnimationFrame(() => {
          if (cancelled) return;
          Animated.parallel([
            Animated.timing(backdrop, {
              toValue: 1,
              duration: 150,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 150,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(navProgress, {
              toValue: 1,
              duration: 150,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }),
          ]).start(() => {
            if (!cancelled) startScan();
          });
        });
        if (cancelled) cancelAnimationFrame(id2);
      });
      openAnimRef.current = () => { cancelled = true; cancelAnimationFrame(id1); };
    } else if (!visible && mounted) {
      openAnimRef.current?.();
      openAnimRef.current = null;
      doClose(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted, navProgress]);

  useEffect(() => {
    return () => {
      openAnimRef.current?.();
      openAnimRef.current = null;
      setScanModalOpen(false);
      stopScan();
    };
  }, [stopScan]);

  const foundList = useMemo(() => Object.values(found), [found]);

  const addDevice = useCallback(
    async (item: FoundDevice) => {
      if (addingDeviceId) return;
      if (existingDeviceIds.has(item.id) || addedDeviceIds.has(item.id)) return;
      setAddingDeviceId(item.id);

      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          showToast('Please log in again', 'error');
          return;
        }

        const body = {
          device_id: item.device?.id,
          device_name: item.bleName,
          factory_name: item.factoryName || item.bleName,
          device_type: 'Medical',
          medical_device_type: item.displayName || undefined,
          comm_protocol: 'BLE',
          platform: isAilinkDevice(item.device) ? 'AILink' : 'Yuwell',
          ble_id: item.id, // Track local BLE ID for matching
        };

        // Check if online
        const online = await isOnline();
        if (!online) {
          // Queue for offline sync
          await enqueueAddDevice(body);
          showToast('Device saved (will sync when online)', 'info');
          setAddedDeviceIds((prev) => {
            const next = new Set(prev);
            next.add(item.id);
            return next;
          });
          try {
            onDeviceAdded?.(-1); // -1 indicates pending sync
          } catch {}
          try {
            emitDeviceUpdates();
          } catch {}
          return;
        }

        const resp = await fetch(`${API_BASE_URL}/devices`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const text = await resp.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }

        if (!resp.ok) {
          const msg = data?.error || data?.message || `Failed to add device (status ${resp.status})`;
          const lowerMsg = String(msg || '').toLowerCase();
          if (resp.status === 409 || lowerMsg.includes('already')) {
            showToast('Device already added', 'info');
            setAddedDeviceIds((prev) => {
              const next = new Set(prev);
              next.add(item.id);
              return next;
            });
            return;
          }
          // If request failed (possibly network issue), queue for later
          if (!resp.ok && (resp.status === 0 || resp.status >= 500)) {
            await enqueueAddDevice(body);
            showToast('Device saved (will sync when online)', 'info');
            setAddedDeviceIds((prev) => {
              const next = new Set(prev);
              next.add(item.id);
              return next;
            });
            try {
              onDeviceAdded?.(-1);
            } catch {}
            try {
              emitDeviceUpdates();
            } catch {}
            return;
          }
          showToast(msg, 'error');
          return;
        }

        const deviceRef = Number(data?.device_ref);
        if (Number.isFinite(deviceRef)) {
          showToast('Device added', 'success');
          setAddedDeviceIds((prev) => {
            const next = new Set(prev);
            next.add(item.id);
            return next;
          });
          try {
            onDeviceAdded?.(deviceRef);
          } catch {
            // ignore callback errors
          }
          // Notify global subscribers that devices updated so other screens can refresh
          try {
            emitDeviceUpdates();
          } catch {}
          return;
        }

        showToast('Device added (missing device_ref)', 'info');
      } catch (e: any) {
        // Network error - queue for offline sync
        const body = {
          device_id: item.device?.id,
          device_name: item.bleName,
          factory_name: item.factoryName || item.bleName,
          device_type: 'Medical',
          medical_device_type: item.displayName || undefined,
          comm_protocol: 'BLE',
          platform: isAilinkDevice(item.device) ? 'AILink' : 'Yuwell',
          ble_id: item.id,
        };
        try {
          await enqueueAddDevice(body);
          showToast('Device saved (will sync when online)', 'info');
          setAddedDeviceIds((prev) => {
            const next = new Set(prev);
            next.add(item.id);
            return next;
          });
          try {
            onDeviceAdded?.(-1);
          } catch {}
          try {
            emitDeviceUpdates();
          } catch {}
        } catch {
          const msg = e?.message ? String(e.message) : 'Failed to add device';
          showToast(msg, 'error');
        }
      } finally {
        setAddingDeviceId(null);
      }
    },
    [addingDeviceId, onDeviceAdded, existingDeviceIds, addedDeviceIds]
  );

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={() => doClose(true)}
    >
      <View style={{ flex: 1 }} pointerEvents="box-none">
        <TouchableWithoutFeedback onPress={() => doClose(true)}>
          <Animated.View style={[styles.backdrop, { opacity: backdrop }]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.sheet, { height: sheetHeight, opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [screenH, 0] }) }] }]}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t(lang, 'modal_scanning')}</Text>
            <Pressable onPress={() => doClose(true)} hitSlop={10}>
              <Text style={styles.closeText}>{t(lang, 'close')}</Text>
            </Pressable>
          </View>

          <View style={styles.radarSection}>
            <RadarScanner active={scanning} />
          </View>

          <View style={styles.divider} />

          <View style={styles.devicesSection}>
            <View style={styles.devicesHeader}>
              <Text style={styles.devicesTitle}>{t(lang, 'modal_found')}</Text>
            </View>

            <FlatList
              data={foundList}
              keyExtractor={(it) => it.id}
              numColumns={columns}
              key={columns}
              contentContainerStyle={[
                styles.foundGrid,
                { paddingLeft: centeredGridPadding, paddingRight: centeredGridPadding },
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <Text style={styles.emptyText}>{t(lang, 'modal_no_devices')}</Text>
              )}
              renderItem={({ item, index }) => (
                (() => {
                  const isAdded = existingDeviceIds.has(item.id) || addedDeviceIds.has(item.id);
                  const isAdding = addingDeviceId === item.id;
                  return (
                <Pressable
                  onPress={() => addDevice(item)}
                  disabled={!!addingDeviceId || isAdded}
                  style={[
                    styles.deviceTile,
                    isAdded ? styles.deviceTileAdded : null,
                    {
                      width: tileWidth,
                      marginBottom: gridGap,
                      marginRight: columns > 1 && (index + 1) % columns !== 0 ? gridGap : 0,
                    },
                  ]}
                >
                  <View style={styles.deviceIconBox}>
                    <Image
                      source={getIconForScanTile(item.bleName, item.displayName, item.factoryName)}
                      style={styles.deviceIcon}
                    />
                  </View>
                  <Text numberOfLines={1} style={styles.deviceLabel}>
                    {item.bleName}
                  </Text>
                  {isAdding ? (
                    <Text numberOfLines={1} style={styles.deviceSubLabel}>
                      ({t(lang, 'modal_adding')})
                    </Text>
                  ) : isAdded ? (
                    <View style={styles.addedBadge}>
                      <Text style={styles.addedBadgeText}>{t(lang, 'modal_added')}</Text>
                    </View>
                  ) : item.displayName ? (
                    <Text numberOfLines={1} style={styles.deviceSubLabel}>
                      ({item.displayName})
                    </Text>
                  ) : null}
                </Pressable>
                  );
                })()
              )}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 1000,
  },
  sheet: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  closeText: { color: '#2b9cd3', fontWeight: '700' },

  radarSection: { alignItems: 'center', justifyContent: 'center', paddingTop: 10, paddingBottom: 8 },
  scanHint: { marginTop: 10, color: '#6b7280', fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },

  devicesSection: { flex: 1 },
  devicesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  devicesTitle: { fontSize: 16, fontWeight: '700' },

  foundGrid: { paddingTop: 6, paddingBottom: 8 },
  deviceTile: { alignItems: 'center' },
  deviceTileAdded: { opacity: 0.65 },
  deviceIconBox: {
    width: 84,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#e6f3fb',
    borderWidth: 1,
    borderColor: '#2b9cd3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIcon: { width: 40, height: 40, resizeMode: 'contain' },
  deviceLabel: { marginTop: 8, fontSize: 12, fontWeight: '800', color: '#111', textAlign: 'center' },
  deviceSubLabel: { marginTop: 2, fontSize: 11, fontWeight: '700', color: '#6b7280', textAlign: 'center' },
  addedBadge: {
    marginTop: 6,
    backgroundColor: '#ecfdf3',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  addedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
  },
  emptyText: { color: '#7a7f86', paddingVertical: 10 },

  radarWrap: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },
  radarCircleOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  radarCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#dbeafe',
  },
  radarCircle3: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#dbeafe',
  },
  radarCircle4: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#dbeafe',
  },
  radarCenterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2b9cd3',
  },
  sweepWrap: {
    position: 'absolute',
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweepLine: {
    position: 'absolute',
    width: 90,
    height: 2,
    backgroundColor: '#2b9cd3',
    left: 90,
    top: 89,
  },
  sweepGradient: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderTopRightRadius: 90,
    left: 90,
    top: 0,
  },
});
