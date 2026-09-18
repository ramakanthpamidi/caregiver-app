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
import { inferDisplayName, inferMedicalDeviceTypeLabel } from '../lib/deviceKind';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { setScanModalOpen } from '../lib/deviceScanState';
import { bleManager as manager, ensureScanStopped } from '../lib/bleManager';

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

// ICOMON scales are typically factory-renamed (e.g. "MY_SCALE") so the BLE
// name alone isn't reliable — match by their advertised proprietary service
// UUID first, falling back to a name check for future/differently-named units.
const ICOMON_SERVICE_UUID = '0000ffb0-0000-1000-8000-00805f9b34fb';

function isIcomonDevice(device: BleDevice): boolean {
  const uuids = (device.serviceUUIDs || []).map((u) => String(u).toLowerCase());
  if (uuids.includes(ICOMON_SERVICE_UUID)) return true;
  const name = getBleName(device).toLowerCase();
  // "MY_SCALE" (with underscore/space/hyphen or none) is this vendor's generic
  // factory-renamed advertising name — recognize it even when the scan result
  // doesn't carry the service UUID (advertisement vs. scan-response packet).
  return name.includes('icomon') || name.includes('welland') || /my[\s_-]?scale/.test(name);
}

function isSupportedDevice(device: BleDevice): boolean {
  return isYuwellDevice(device) || isAilinkDevice(device) || isIcomonDevice(device);
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
  const [scanError, setScanError] = useState<string | null>(null);
  const [found, setFound] = useState<Record<string, FoundDevice>>({});
  const [addingDeviceId, setAddingDeviceId] = useState<string | null>(null);
  const [existingDeviceIds, setExistingDeviceIds] = useState<Set<string>>(new Set());
  const [addedDeviceIds, setAddedDeviceIds] = useState<Set<string>>(new Set());
  const foundRef = useRef<Record<string, FoundDevice>>({});
  // buffer discovered devices on JS side to avoid frequent state updates
  const foundBufferRef = useRef<Record<string, FoundDevice>>({});
  const flushIntervalRef = useRef<number | null>(null);
  const pruneIntervalRef = useRef<number | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveInFlightRef = useRef<Set<string>>(new Set());
  // Bumps on every start/stop so stale scan callbacks cannot revive a finished session.
  const scanGenerationRef = useRef(0);
  const SCAN_DURATION_MS = 25_000;

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

  const clearScanTimers = useCallback(() => {
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
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  const stopScan = useCallback(() => {
    // Invalidate in-flight startScan / discovery callbacks.
    scanGenerationRef.current += 1;
    try {
      // stopDeviceScan returns a Promise in react-native-ble-plx; swallow rejections
      Promise.resolve(manager.stopDeviceScan()).catch(() => {});
    } catch {
      // ignore
    }
    setScanning(false);
    clearScanTimers();
    // final flush: merge remaining buffered entries into state and clear buffer
    if (Object.keys(foundBufferRef.current).length) {
      setFound((prev) => ({ ...prev, ...foundBufferRef.current }));
      foundBufferRef.current = {};
    }
  }, [clearScanTimers]);

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
        // Normalize MAC / BLE id casing so "already added" matches scan results.
        const id = String(d?.device_id || '').trim().toUpperCase();
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
      const apiLevel =
        typeof Platform.Version === 'number'
          ? Platform.Version
          : parseInt(String(Platform.Version), 10) || 0;

      // Android 12+ (API 31): BLUETOOTH_SCAN / CONNECT. Older: location only.
      const permissions =
        apiLevel >= 31
          ? [
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]
          : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

      const result = await PermissionsAndroid.requestMultiple(permissions as any);
      // Only require permissions that were actually requested and are defined.
      return Object.entries(result).every(([, v]) => v === PermissionsAndroid.RESULTS.GRANTED);
    } catch {
      return false;
    }
  }, []);

  const startScan = useCallback(async () => {
    // New generation cancels any previous async start still waiting on permissions/BT.
    const generation = ++scanGenerationRef.current;
    setScanError(null);

    const stillActive = () => generation === scanGenerationRef.current;

    const ok = await requestPermissions();
    if (!stillActive()) return;
    if (!ok) {
      setScanning(false);
      setScanError(t(lang, 'scan_permission_denied'));
      showToast(t(lang, 'scan_permission_denied'), 'error');
      return;
    }

    // Check if Bluetooth is powered on before scanning
    try {
      const bleState = await manager.state();
      if (!stillActive()) return;
      if (bleState !== BleState.PoweredOn) {
        try {
          await new Promise<void>((resolve, reject) => {
            let settled = false;
            let sub: { remove?: () => void } | null = null;
            let timer: ReturnType<typeof setTimeout> | null = null;
            const finish = (fn: () => void) => {
              if (settled) return;
              settled = true;
              try {
                sub?.remove?.();
              } catch {}
              if (timer) clearTimeout(timer);
              fn();
            };
            sub = manager.onStateChange((newState: string) => {
              if (newState === BleState.PoweredOn) {
                finish(() => resolve());
              }
            }, true);
            Alert.alert(t(lang, 'bluetooth_off_title'), t(lang, 'bluetooth_off_message'), [
              {
                text: 'OK',
                onPress: () => {
                  if (Platform.OS === 'android') {
                    try {
                      Promise.resolve(manager.enable()).catch(() => {});
                    } catch {}
                  }
                },
              },
            ]);
            // Don't hang the modal forever waiting for BT.
            timer = setTimeout(() => {
              finish(() => reject(new Error('timeout')));
            }, 12_000);
          });
        } catch {
          if (!stillActive()) return;
          setScanning(false);
          setScanError(t(lang, 'bluetooth_off_message'));
          showToast(t(lang, 'bluetooth_off_message'), 'error');
          return;
        }
      }
    } catch {
      // If state check fails, still attempt the scan below.
    }

    if (!stillActive()) return;

    // Live monitor may still own the adapter for a beat after the modal opens —
    // force-stop any existing scan and settle before starting ours.
    await ensureScanStopped(350);
    if (!stillActive()) return;

    // clear buffers and start scanning; buffer discoveries then flush at intervals
    foundBufferRef.current = {};
    setFound({});
    setScanning(true);
    clearScanTimers();

    // Keep recently seen devices longer so the list doesn't flicker empty mid-scan.
    const staleAfterMs = 20_000;
    pruneIntervalRef.current = setInterval(() => {
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
    }, 1000) as unknown as number;

    // flush buffered discoveries into state every 400ms to reduce churn
    flushIntervalRef.current = setInterval(() => {
      const buffer = foundBufferRef.current;
      if (Object.keys(buffer).length) {
        setFound((prev) => ({ ...prev, ...buffer }));
        foundBufferRef.current = {};
      }
    }, 400) as unknown as number;

    // Auto-stop so the UI cannot spin forever ("scan stuck").
    scanTimeoutRef.current = setTimeout(() => {
      if (!stillActive()) return;
      console.log('[ADD_DEVICE] scan auto-stop after', SCAN_DURATION_MS, 'ms');
      try {
        Promise.resolve(manager.stopDeviceScan()).catch(() => {});
      } catch {}
      setScanning(false);
      clearScanTimers();
      if (Object.keys(foundBufferRef.current).length) {
        setFound((prev) => ({ ...prev, ...foundBufferRef.current }));
        foundBufferRef.current = {};
      }
    }, SCAN_DURATION_MS);

    const onDeviceFound = (error: Error | null, device: BleDevice | null) => {
      if (!stillActive()) return;

      if (error) {
        const msg = String((error as any)?.message || error || '');
        console.log('[ADD_DEVICE] scan error:', msg);
        // Recoverable "already scanning" — stop and retry once.
        if (/already|cannot start scanning/i.test(msg)) {
          void (async () => {
            await ensureScanStopped(400);
            if (!stillActive()) return;
            try {
              manager.startDeviceScan(null, { allowDuplicates: true }, onDeviceFound);
            } catch (e: any) {
              setScanning(false);
              setScanError(e?.message || t(lang, 'scan_failed'));
            }
          })();
          return;
        }
        setScanning(false);
        clearScanTimers();
        setScanError(msg || t(lang, 'scan_failed'));
        return;
      }

      if (!device) return;
      if (!isSupportedDevice(device)) return;

      const bleName = getBleName(device);
      if (!bleName) return;

      const now = Date.now();
      const existing = foundRef.current[device.id] || foundBufferRef.current[device.id];

      // Immediate local type label so tiles are useful even when the model API is slow/offline.
      const heuristicPlatform = isAilinkDevice(device)
        ? 'AILink'
        : isIcomonDevice(device)
          ? 'ICOMON'
          : 'Yuwell';
      const heuristicType = inferMedicalDeviceTypeLabel({
        device_name: bleName,
        factory_name: bleName,
        platform: heuristicPlatform,
      });
      const heuristicDisplay =
        inferDisplayName({
          device_name: bleName,
          factory_name: bleName,
          medical_device_type: heuristicType,
          platform: heuristicPlatform,
        }) || undefined;

      const nextEntry: FoundDevice = {
        id: device.id,
        device,
        bleName,
        displayName: existing?.displayName || heuristicDisplay,
        factoryName: existing?.factoryName || bleName,
        lastSeen: now,
      };
      foundBufferRef.current[device.id] = nextEntry;

      // AILink devices don't need server-side model resolution.
      if (isAilinkDevice(device)) {
        foundBufferRef.current[device.id] = {
          ...nextEntry,
          displayName: 'Weight Scale',
          factoryName: 'AILink Weight Scale',
        };
        return;
      }

      // Same for ICOMON scales — their (often factory-renamed) BLE name isn't
      // a useful catalog lookup key, and the native module handles the
      // proprietary protocol regardless of what the device is called.
      if (isIcomonDevice(device)) {
        foundBufferRef.current[device.id] = {
          ...nextEntry,
          displayName: 'Weight Scale',
          factoryName: 'ICOMON Weight Scale',
        };
        return;
      }

      // Already have a catalog/heuristic name — optional upgrade via cache only.
      if (existing?.displayName && existing.displayName !== heuristicDisplay) return;

      if (resolveInFlightRef.current.has(bleName)) return;
      resolveInFlightRef.current.add(bleName);

      (async () => {
        try {
          const model = await resolveYuwellModel(bleName);
          if (!stillActive()) return;
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
          // ignore network errors — heuristic name already applied
        } finally {
          resolveInFlightRef.current.delete(bleName);
        }
      })();
    };

    try {
      manager.startDeviceScan(null, { allowDuplicates: true }, onDeviceFound);
    } catch (e: any) {
      if (!stillActive()) return;
      console.log('[ADD_DEVICE] startDeviceScan threw:', e?.message || e);
      // One recovery path: stop whatever owns the adapter, then retry.
      try {
        await ensureScanStopped(500);
        if (!stillActive()) return;
        manager.startDeviceScan(null, { allowDuplicates: true }, onDeviceFound);
      } catch (e2: any) {
        if (!stillActive()) return;
        setScanning(false);
        clearScanTimers();
        setScanError(e2?.message || e?.message || t(lang, 'scan_failed'));
        showToast(t(lang, 'scan_failed'), 'error');
      }
    }
  }, [SCAN_DURATION_MS, clearScanTimers, lang, requestPermissions]);

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
      // Signal live monitor to release the BLE adapter BEFORE we start scanning.
      setScanModalOpen(true);
      setScanError(null);
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
            // Give BleMonitoringHost time to tear down its scan before we claim the adapter.
            if (cancelled) return;
            const delay = setTimeout(() => {
              if (!cancelled) void startScan();
            }, 450);
            openAnimRef.current = () => {
              cancelled = true;
              clearTimeout(delay);
            };
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
      const idKey = String(item.id || '').trim().toUpperCase();
      if (
        existingDeviceIds.has(idKey) ||
        existingDeviceIds.has(item.id) ||
        addedDeviceIds.has(item.id) ||
        addedDeviceIds.has(idKey)
      ) {
        return;
      }
      setAddingDeviceId(item.id);

      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          showToast('Please log in again', 'error');
          return;
        }

        const inferredType =
          item.displayName ||
          inferMedicalDeviceTypeLabel({
            device_name: item.bleName,
            factory_name: item.factoryName || item.bleName,
            display_name: item.displayName,
            platform: isAilinkDevice(item.device) ? 'AILink' : isIcomonDevice(item.device) ? 'ICOMON' : 'Yuwell',
          });
        const inferredDisplay =
          item.displayName ||
          inferDisplayName({
            device_name: item.bleName,
            factory_name: item.factoryName || item.bleName,
            display_name: item.displayName,
            medical_device_type: inferredType,
            platform: isAilinkDevice(item.device) ? 'AILink' : isIcomonDevice(item.device) ? 'ICOMON' : 'Yuwell',
          });
        const body = {
          device_id: item.device?.id,
          device_name: item.bleName,
          factory_name: item.factoryName || item.bleName,
          device_type: 'Medical',
          // Prefer catalog display name; fall back to model-code heuristics (BO-YX* → Oximeter)
          medical_device_type: inferredType || undefined,
          display_name: inferredDisplay || undefined,
          comm_protocol: 'BLE',
          platform: isAilinkDevice(item.device) ? 'AILink' : isIcomonDevice(item.device) ? 'ICOMON' : 'Yuwell',
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
            // Already registered — still refresh list so the UI shows it.
            showToast('Device already added', 'info');
            setAddedDeviceIds((prev) => {
              const next = new Set(prev);
              next.add(item.id);
              return next;
            });
            const existingRef = Number(data?.device_ref ?? data?.device?.id);
            try {
              onDeviceAdded?.(Number.isFinite(existingRef) ? existingRef : -1);
            } catch {}
            try {
              emitDeviceUpdates();
            } catch {}
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

        // Backend returns { device: { id, ... } }; older clients expected top-level device_ref.
        const deviceRef = Number(data?.device_ref ?? data?.device?.id ?? data?.device?.device_ref);
        showToast('Device added', 'success');
        setAddedDeviceIds((prev) => {
          const next = new Set(prev);
          next.add(item.id);
          return next;
        });
        try {
          onDeviceAdded?.(Number.isFinite(deviceRef) ? deviceRef : -1);
        } catch {
          // ignore callback errors
        }
        // Notify global subscribers that devices updated so other screens can refresh
        try {
          emitDeviceUpdates();
        } catch {}
      } catch (e: any) {
        // Network error - queue for offline sync
        const inferredType =
          item.displayName ||
          inferMedicalDeviceTypeLabel({
            device_name: item.bleName,
            factory_name: item.factoryName || item.bleName,
            display_name: item.displayName,
            platform: isAilinkDevice(item.device) ? 'AILink' : isIcomonDevice(item.device) ? 'ICOMON' : 'Yuwell',
          });
        const body = {
          device_id: item.device?.id,
          device_name: item.bleName,
          factory_name: item.factoryName || item.bleName,
          device_type: 'Medical',
          medical_device_type: inferredType || undefined,
          display_name:
            item.displayName ||
            inferDisplayName({
              device_name: item.bleName,
              factory_name: item.factoryName || item.bleName,
              medical_device_type: inferredType,
            }) ||
            undefined,
          comm_protocol: 'BLE',
          platform: isAilinkDevice(item.device) ? 'AILink' : isIcomonDevice(item.device) ? 'ICOMON' : 'Yuwell',
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
            <Text style={styles.title}>
              {scanning ? t(lang, 'modal_scanning') : t(lang, 'modal_scan_idle')}
            </Text>
            <View style={styles.headerActions}>
              {!scanning ? (
                <Pressable
                  onPress={() => {
                    void startScan();
                  }}
                  hitSlop={10}
                  style={styles.rescanBtn}
                >
                  <Text style={styles.rescanText}>{t(lang, 'start_scan')}</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => stopScan()}
                  hitSlop={10}
                  style={styles.rescanBtn}
                >
                  <Text style={styles.rescanText}>{t(lang, 'modal_stop_scan')}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => doClose(true)} hitSlop={10}>
                <Text style={styles.closeText}>{t(lang, 'close')}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.radarSection}>
            <RadarScanner active={scanning} />
            {scanError ? <Text style={styles.scanErrorText}>{scanError}</Text> : null}
          </View>

          <View style={styles.divider} />

          <View style={styles.devicesSection}>
            <View style={styles.devicesHeader}>
              <Text style={styles.devicesTitle}>
                {t(lang, 'modal_found')}
                {foundList.length > 0 ? ` (${foundList.length})` : ''}
              </Text>
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
                <Text style={styles.emptyText}>
                  {scanning ? t(lang, 'modal_searching') : t(lang, 'modal_no_devices')}
                </Text>
              )}
              renderItem={({ item, index }) => (
                (() => {
                  const idKey = String(item.id || '').trim().toUpperCase();
                  const isAdded =
                    existingDeviceIds.has(idKey) ||
                    existingDeviceIds.has(item.id) ||
                    addedDeviceIds.has(item.id) ||
                    addedDeviceIds.has(idKey);
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 18, fontWeight: '700', flexShrink: 1, paddingRight: 8 },
  closeText: { color: '#2b9cd3', fontWeight: '700' },
  rescanBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  rescanText: { color: '#2b9cd3', fontWeight: '700' },
  scanErrorText: {
    marginTop: 8,
    color: '#c0392b',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

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
