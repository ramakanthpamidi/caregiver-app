import { useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DeviceSummary } from '../components/ScanDeviceCard';
import {
  getMedicalGeneral,
} from '../../profiles/api/profileApi';
import {
  isAilinkAvailable,
  isWeightScaleText,
  startAilinkMonitoring,
  stopAilinkMonitoring,
} from '../../../shared/lib/ailinkScale';

type Props = {
  active: boolean;
  devices: DeviceSummary[];
  activeProfileId: number | null;
};

function normalizeDeviceId(deviceId?: string | null) {
  return String(deviceId || '').trim().toUpperCase();
}

function compactHexMac(value?: string | null) {
  return String(value || '')
    .replace(/[^0-9A-Fa-f]/g, '')
    .toUpperCase();
}

function toColonMac(compact: string) {
  if (compact.length !== 12) return '';
  const parts: string[] = [];
  for (let index = 0; index < 12; index += 2) {
    parts.push(compact.slice(index, index + 2));
  }
  return parts.join(':');
}

function getScaleMonitorIdCandidates(device: DeviceSummary) {
  const rawCandidates = [
    device.device_id,
    (device as any).ble_id,
    device.device_uuid,
  ];

  const expanded = new Set<string>();
  for (const raw of rawCandidates) {
    const normalized = normalizeDeviceId(raw as string | null | undefined);
    if (normalized) expanded.add(normalized);

    const compact = compactHexMac(raw as string | null | undefined);
    if (compact) {
      expanded.add(compact);
      const colon = toColonMac(compact);
      if (colon) expanded.add(colon);
    }
  }

  return Array.from(expanded);
}

function computeAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age > 0 ? age : undefined;
}

function toScaleProfile(medical: any) {
  if (!medical || typeof medical !== 'object') return undefined;
  const age = computeAge(medical.date_of_birth);
  const sex =
    medical.sex === 'Male' ? 1 : medical.sex === 'Female' ? 0 : undefined;
  const heightCm =
    medical.height_cm != null ? Number(medical.height_cm) : undefined;
  const weightKg =
    medical.weight_kg != null ? Number(medical.weight_kg) : undefined;

  return {
    ...(age != null ? { age } : {}),
    ...(sex != null ? { sex } : {}),
    ...(heightCm != null && Number.isFinite(heightCm) && heightCm > 0
      ? { heightCm }
      : {}),
    ...(weightKg != null && Number.isFinite(weightKg) && weightKg > 0
      ? { weightKg }
      : {}),
  };
}

function getBodyFatPercent(bodyFat?: Record<string, unknown>) {
  if (!bodyFat) return null;
  const keys = ['bodyFat', 'bodyFatRate', 'fat', 'bf'];
  for (const key of keys) {
    const value = bodyFat[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function isScaleDevice(device: DeviceSummary) {
  return isWeightScaleText(
    `${device.device_type || ''} ${device.device_name || ''} ${
      device.factory_name || ''
    } ${device.display_name || ''}`,
  );
}

export function useAilinkScaleMonitor({
  active,
  devices,
  activeProfileId,
}: Props) {
  const scaleDeviceIds = useMemo(() => {
    return devices
      .filter(isScaleDevice)
      .flatMap(device => getScaleMonitorIdCandidates(device))
      .filter(Boolean);
  }, [devices]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (
        !isAilinkAvailable() ||
        !active ||
        scaleDeviceIds.length === 0
      ) {
        stopAilinkMonitoring();
        return;
      }

      let profile: ReturnType<typeof toScaleProfile>;

      const token = await AsyncStorage.getItem('authToken');
      if (!cancelled && token && activeProfileId) {
        try {
          const medical = await getMedicalGeneral(token, activeProfileId);
          profile = toScaleProfile(medical);
        } catch {
          profile = undefined;
        }
      }

      if (cancelled) return;

      if (profile) {
        startAilinkMonitoring({
          deviceIds: scaleDeviceIds,
          profile,
        });
        return;
      }

      startAilinkMonitoring({
        deviceIds: scaleDeviceIds,
      });
    };

    void run();

    return () => {
      cancelled = true;
      stopAilinkMonitoring();
    };
  }, [active, activeProfileId, scaleDeviceIds]);
}
