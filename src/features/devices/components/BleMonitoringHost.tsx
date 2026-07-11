import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import type { DeviceSummary } from './ScanDeviceCard';
import { API_BASE_URL } from '../../profiles/api/profileApi';
import { useBleLiveMonitor } from '../lib/bleLiveMonitor';
import { useAilinkScaleMonitor } from '../lib/useAilinkScaleMonitor';
import { subscribeDeviceUpdates } from '../lib/deviceEvents';
import { isScanModalOpen, subscribeScanModalOpen } from '../lib/deviceScanState';
import { getActiveProfileId, subscribeActiveProfileId } from '../../profiles/lib/profileEvents';
import { useProfileConsents } from '../../legal/hooks/useProfileConsents';
import { isWeightScaleText } from '../../../shared/lib/ailinkScale';

type Props = {
  enabled: boolean;
};

export default function BleMonitoringHost({ enabled }: Props) {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [scanModalOpen, setScanModalOpenState] = useState<boolean>(() => isScanModalOpen());
  const [restartKey, setRestartKey] = useState(0);
  const appStateRef = useRef(AppState.currentState);
  const prevScanModalOpenRef = useRef(scanModalOpen);
  const restartTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  // Signature of the current device list used to suppress spurious restarts when
  // subscribeDeviceUpdates fires but the relevant BLE fields haven't changed.
  const lastDeviceSignatureRef = useRef<string>('');

  const activeProfileConsents = useProfileConsents(activeProfileId);
  const canUseMedicalDevices = activeProfileConsents?.consent_granted !== false;
  const shouldRunDeviceMonitoring = enabled && canUseMedicalDevices && !scanModalOpen;

  const queueRestart = useCallback((delays: number[] = [0]) => {
    for (const timer of restartTimersRef.current) {
      clearTimeout(timer);
    }
    restartTimersRef.current = [];

    for (const delayMs of delays) {
      const timer = setTimeout(() => {
        setRestartKey((current) => current + 1);
      }, delayMs);
      restartTimersRef.current.push(timer);
    }
  }, []);

  // Returns true if the device list actually changed in BLE-relevant fields.
  // Callers can use this to decide whether a monitor restart is warranted.
  const fetchDevices = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        const changed = lastDeviceSignatureRef.current !== '';
        lastDeviceSignatureRef.current = '';
        setDevices([]);
        return changed;
      }

      const response = await fetch(`${API_BASE_URL}/users/me/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return false;
      }

      const json = await response.json();
      const list = Array.isArray(json?.devices) ? json.devices : [];
      const deduped = new Map<string, DeviceSummary>();
      for (const device of list) {
        const key = String(device?.device_id || device?.id || '').trim();
        if (!key || deduped.has(key)) continue;
        deduped.set(key, device as DeviceSummary);
      }
      const next = Array.from(deduped.values());

      // Build a stable signature over only the fields the BLE monitor cares about
      // (id, type/name identifiers, endpoint UUID). Ignore status/granted_at churn.
      const signature = next
        .map((d) => {
          const id = String(d.device_id || d.id || '').trim().toUpperCase();
          const type = String(d.device_type || '').trim();
          const name = String(d.device_name || d.factory_name || d.display_name || '').trim();
          const endpoint = String(d.endpoint_uuid || '').trim();
          return `${id}|${type}|${name}|${endpoint}`;
        })
        .sort()
        .join(';');

      if (signature === lastDeviceSignatureRef.current) {
        return false;
      }
      lastDeviceSignatureRef.current = signature;
      setDevices(next);
      return true;
    } catch {
      // Keep the last known device list to avoid flapping the BLE monitor.
      return false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setDevices([]);
      setActiveProfileId(null);
      return;
    }

    void getActiveProfileId().then(setActiveProfileId);
    void fetchDevices();

    const unsubscribeProfile = subscribeActiveProfileId((profileId) => {
      setActiveProfileId(profileId);
      queueRestart([0]);
    });
    const unsubscribeDevices = subscribeDeviceUpdates(() => {
      // Only restart the BLE monitor when the device list actually changed in
      // BLE-relevant fields. This prevents churn from periodic device refetches
      // (e.g. when the user opens a screen that polls the device list) that
      // would otherwise cause the monitor to tear down and restart repeatedly.
      void fetchDevices().then((changed) => {
        if (changed) queueRestart([0]);
      });
    });
    const unsubscribeScanModal = subscribeScanModalOpen(() => {
      const nextOpen = isScanModalOpen();
      const wasOpen = prevScanModalOpenRef.current;
      prevScanModalOpenRef.current = nextOpen;
      setScanModalOpenState(nextOpen);
      if (wasOpen && !nextOpen) {
        // A single restart after the scan modal closes is sufficient. The
        // previous cascade of [0, 900, 2200] ms caused mid-handshake cancellations
        // when a device was in the middle of connecting.
        queueRestart([400]);
      }
    });
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (online) {
        void fetchDevices();
      }
    });
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const resumed =
        (previousState === 'background' || previousState === 'inactive') &&
        nextState === 'active';

      if (resumed) {
        void fetchDevices();
        if (!isScanModalOpen()) {
          // Single restart after resume; the previous [0, 1200] cascade risked
          // cancelling an in-flight handshake triggered by the first restart.
          queueRestart([500]);
        }
      }
    });

    return () => {
      for (const timer of restartTimersRef.current) {
        clearTimeout(timer);
      }
      restartTimersRef.current = [];
      unsubscribeProfile();
      unsubscribeDevices();
      unsubscribeScanModal();
      unsubscribeNetInfo();
      appStateSub.remove();
    };
  }, [enabled, fetchDevices, queueRestart]);

  // The BLE monitor internally refreshes its scan every 20 minutes to work
  // around Android's callback throttle (see SCAN_REFRESH_INTERVAL_MS in
  // bleLiveMonitor.ts). A second full teardown/restart from here is redundant
  // and can cancel in-flight connections, so no periodic restartKey bump.

  const ailinkDevices = useMemo(
    () =>
      devices.filter((device) =>
        isWeightScaleText(
          `${device.device_type || ''} ${device.device_name || ''} ${device.factory_name || ''} ${device.display_name || ''}`,
        ),
      ),
    [devices],
  );

  const bleMonitorDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          !isWeightScaleText(
            `${device.device_type || ''} ${device.device_name || ''} ${device.factory_name || ''} ${device.display_name || ''}`,
          ),
      ),
    [devices],
  );

  useBleLiveMonitor({
    active: shouldRunDeviceMonitoring,
    devices: bleMonitorDevices,
    restartKey,
  });

  useAilinkScaleMonitor({
    active: shouldRunDeviceMonitoring,
    devices: ailinkDevices,
    activeProfileId,
  });

  return null;
}