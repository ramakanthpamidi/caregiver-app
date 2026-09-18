import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Easing, ScrollView, View, Text, Pressable, Image, LayoutChangeEvent, Alert, Platform, Share, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { generatePDF } from 'react-native-html-to-pdf';

import BloodPressureTrendCard from '../components/BloodPressureTrendCard';
import BloodGlucoseTrendCard from '../components/BloodGlucoseTrendCard';
import LastPointCard, { type LastPointSummary } from '../components/LastPointCard';
import AdviceCard, { type AdviceRowModel } from '../components/AdviceCard';
import TrendMetricTile from '../components/TrendMetricTile';
import {
  setTrendDetailOverlayState,
  subscribeTrendDetailRequest,
  takePendingTrendDetailRequest,
  useActiveTab,
} from '../../../shared/navigation/tabNavigation';
import OverallTrendChartCard from '../components/OverallTrendChartCard';
import WeightBmiTile from '../components/WeightBmiTile';
import WeightDetailOverlay from '../components/WeightDetailOverlay';
import { useLatestWeightBmi, evaluateBmi, buildBmiAdviceBody } from '../lib/weightBmi';
import ScalarTrendCard, { type ScalarTrendPoint } from '../components/ScalarTrendCard';
import {
  API_BASE_URL,
  getMedicalTrends,
  getHealthReportData,
  sendMedicalData,
  type BloodPressureTrendPoint,
  type BloodGlucoseTrendPoint,
  type HealthReportDataResponse,
  type MedicalTrendLastPoint,
  type TemperatureTrendPoint,
  type SpO2TrendPoint,
} from '../../profiles/api/profileApi';
import { emitTrendsRefresh, getActiveProfileId, subscribeActiveProfileId, subscribeTrendsRefresh } from '../../profiles/lib/profileEvents';
import { getCachedGoals, type CachedGoal } from '../../profiles/storage/goalCache';
import DialogFrame from '../../../shared/components/DialogFrame';
import { useLiveReadings } from '../../devices/lib/liveReadings';
import { classifyVitalDeviceKind } from '../../devices/lib/deviceKind';
import { loadPersistedLiveReadings, savePersistedLiveReadings } from '../../devices/storage/persistedLiveReadings';
import {
  evaluateBloodPressure,
  evaluateGlucose,
  evaluateTemperature,
  evaluateSpO2,
  getAlertTitle,
  getAlertMessage,
  formatReadingText,
  getDeviceNameForType,
  type HealthStatusLevel,
} from '../../../shared/lib/healthThresholds';
import { addAlert, healthStatusToSeverity } from '../../alerts/storage/alertStorage';
import { sendAlertNotification, refreshBadge } from '../../alerts/lib/alertNotifications';
import { simulateLineNotify } from '../../profiles/services/lineNotifyApi';
import { getCurrentPosition } from '../../../shared/lib/location';
import { getProfileConsentsSnapshot } from '../../legal/storage/profileConsentStore';
import { Colors, Layout, Spacing } from '../../../shared/theme/theme';

import styles from './TrendScreen.styles';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

type Period = 'Overall' | 'Daily' | 'Weekly' | 'Monthly';
type DetailMetric = 'bp' | 'glucose' | 'temp' | 'spo2';
type MainDeviceKind = 'Pressure' | 'Glucose' | 'Thermometer' | 'Oximeter';
type LatestDeviceByMetric = Record<DetailMetric, string | null>;
type ManualReadingForm = {
  systolic: string;
  diastolic: string;
  pulse: string;
  glucose: string;
  temperature: string;
  spo2: string;
  spo2Pulse: string;
};

const MAX_PENDING_LIVE_POINTS = 24;
const KEY_HOME_PREFERRED_DEVICE_BY_KIND = 'home.preferredDeviceByKind.v1';
const METRIC_TO_MAIN_KIND: Record<DetailMetric, MainDeviceKind> = {
  bp: 'Pressure',
  glucose: 'Glucose',
  temp: 'Thermometer',
  spo2: 'Oximeter',
};

const EMPTY_MANUAL_FORM: ManualReadingForm = {
  systolic: '',
  diastolic: '',
  pulse: '',
  glucose: '',
  temperature: '',
  spo2: '',
  spo2Pulse: '',
};

function parseUtcDate(input: string): Date {
  const raw = String(input || '').trim();
  if (!raw) return new Date(NaN);

  let normalized = raw.replace(' ', 'T');

  if (/^[\d]{4}-[\d]{2}-[\d]{2}$/.test(normalized)) {
    normalized = `${normalized}T00:00:00Z`;
  }

  if (/[+-]\d{2}$/.test(normalized)) {
    normalized = `${normalized}:00`;
  }
  if (/[+-]\d{4}$/.test(normalized)) {
    normalized = `${normalized.slice(0, -5)}${normalized.slice(-5, -2)}:${normalized.slice(-2)}`;
  }

  const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
  if (!hasTz) {
    normalized = `${normalized}Z`;
  }

  return new Date(normalized);
}

function toPointTsMs(point: { ts: string; ts_ms?: number }): number {
  const tsMs = Number(point.ts_ms);
  if (Number.isFinite(tsMs) && tsMs > 0) return tsMs;
  const parsed = parseUtcDate(String(point.ts || '')).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getLatestDeviceId(points: any[] | null | undefined): string | null {
  if (!Array.isArray(points)) return null;
  for (const point of points) {
    const id = typeof point?.device_id === 'string' ? point.device_id.trim() : '';
    if (id) return id;
  }
  return null;
}

function deviceMatchesManualMetric(metric: DetailMetric, device: any): boolean {
  const kind = classifyVitalDeviceKind({
    device_type: device?.device_type,
    device_name: device?.device_name,
    factory_name: device?.factory_name,
    display_name: device?.display_name,
    medical_device_type: device?.medical_device_type,
    platform: device?.platform,
  });

  if (metric === 'bp') return kind === 'Pressure';
  if (metric === 'glucose') return kind === 'Glucose';
  if (metric === 'temp') return kind === 'Thermometer';
  if (metric === 'spo2') return kind === 'Oximeter';
  return false;
}

function parseInputNumber(raw: string): number | null {
  const normalized = String(raw || '').trim().replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function pointExistsByTsAndValues(
  points: BloodPressureTrendPoint[],
  target: BloodPressureTrendPoint,
  toleranceMs = 1500
): boolean {
  const targetTs = toPointTsMs(target);
  return points.some((p) => {
    const pTs = toPointTsMs(p);
    const nearTs = Math.abs(pTs - targetTs) <= toleranceMs;
    return nearTs && Number(p.sys) === Number(target.sys) && Number(p.dia) === Number(target.dia);
  });
}

function glucosePointExistsByTsAndValues(
  points: BloodGlucoseTrendPoint[],
  target: BloodGlucoseTrendPoint,
  toleranceMs = 1500
): boolean {
  const targetTs = toPointTsMs(target);
  return points.some((p) => {
    const pTs = toPointTsMs(p);
    const nearTs = Math.abs(pTs - targetTs) <= toleranceMs;
    return nearTs && Number(p.mgdl) === Number(target.mgdl);
  });
}

function mergeAndSortBpPoints(
  sourcePoints: BloodPressureTrendPoint[],
  pendingPoints: BloodPressureTrendPoint[]
): BloodPressureTrendPoint[] {
  const merged: BloodPressureTrendPoint[] = [];
  for (const point of [...sourcePoints, ...pendingPoints]) {
    if (!point || !Number.isFinite(Number(point.sys)) || !Number.isFinite(Number(point.dia))) continue;
    if (Number(point.sys) <= 0 || Number(point.dia) <= 0) continue;
    if (pointExistsByTsAndValues(merged, point)) continue;
    merged.push({
      ts: String(point.ts || ''),
      ts_ms: toPointTsMs(point),
      sys: Number(point.sys),
      dia: Number(point.dia),
    });
  }
  merged.sort((a, b) => toPointTsMs(a) - toPointTsMs(b));
  return merged;
}

function mergeAndSortGlucosePoints(
  sourcePoints: BloodGlucoseTrendPoint[],
  pendingPoints: BloodGlucoseTrendPoint[]
): BloodGlucoseTrendPoint[] {
  const merged: BloodGlucoseTrendPoint[] = [];
  for (const point of [...sourcePoints, ...pendingPoints]) {
    if (!point || !Number.isFinite(Number(point.mgdl)) || Number(point.mgdl) <= 0) continue;
    if (glucosePointExistsByTsAndValues(merged, point)) continue;
    merged.push({
      ts: String(point.ts || ''),
      ts_ms: toPointTsMs(point),
      mgdl: Number(point.mgdl),
    });
  }
  merged.sort((a, b) => toPointTsMs(a) - toPointTsMs(b));
  return merged;
}

function tempPointExistsByTsAndValues(
  points: TemperatureTrendPoint[],
  target: TemperatureTrendPoint,
  toleranceMs = 1500
): boolean {
  const targetTs = toPointTsMs(target);
  return points.some((point) => {
    const pointTs = toPointTsMs(point);
    const nearTs = Math.abs(pointTs - targetTs) <= toleranceMs;
    return nearTs && Number(point.celsius) === Number(target.celsius);
  });
}

function spo2PointExistsByTsAndValues(
  points: SpO2TrendPoint[],
  target: SpO2TrendPoint,
  toleranceMs = 1500
): boolean {
  const targetTs = toPointTsMs(target);
  return points.some((point) => {
    const pointTs = toPointTsMs(point);
    const nearTs = Math.abs(pointTs - targetTs) <= toleranceMs;
    return nearTs && Number(point.spo2) === Number(target.spo2) && Number(point.pulse ?? 0) === Number(target.pulse ?? 0);
  });
}

function mergeAndSortTempPoints(
  sourcePoints: TemperatureTrendPoint[],
  pendingPoints: TemperatureTrendPoint[]
): TemperatureTrendPoint[] {
  const merged: TemperatureTrendPoint[] = [];
  for (const point of [...sourcePoints, ...pendingPoints]) {
    if (!point || !Number.isFinite(Number(point.celsius)) || Number(point.celsius) <= 0) continue;
    if (tempPointExistsByTsAndValues(merged, point)) continue;
    merged.push({
      ts: String(point.ts || ''),
      ts_ms: toPointTsMs(point),
      celsius: Number(point.celsius),
    });
  }
  merged.sort((a, b) => toPointTsMs(a) - toPointTsMs(b));
  return merged;
}

function mergeAndSortSpo2Points(
  sourcePoints: SpO2TrendPoint[],
  pendingPoints: SpO2TrendPoint[]
): SpO2TrendPoint[] {
  const merged: SpO2TrendPoint[] = [];
  for (const point of [...sourcePoints, ...pendingPoints]) {
    if (!point || !Number.isFinite(Number(point.spo2)) || Number(point.spo2) <= 0) continue;
    if (spo2PointExistsByTsAndValues(merged, point)) continue;
    merged.push({
      ts: String(point.ts || ''),
      ts_ms: toPointTsMs(point),
      spo2: Number(point.spo2),
      pulse: point.pulse != null && Number.isFinite(Number(point.pulse)) ? Number(point.pulse) : null,
    });
  }
  merged.sort((a, b) => toPointTsMs(a) - toPointTsMs(b));
  return merged;
}

function formatRelativeTime(tsMs: number, lang: 'en' | 'th'): string {
  if (!tsMs) return t(lang, 'no_reading_yet');
  const diff = Date.now() - tsMs;
  if (diff < 60_000) return t(lang, 'just_now');
  if (diff < 3_600_000) return lang === 'th' ? `${Math.floor(diff / 60_000)} นาทีที่แล้ว` : `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return lang === 'th' ? `${Math.floor(diff / 3_600_000)} ชม.ที่แล้ว` : `${Math.floor(diff / 3_600_000)} h ago`;
  const days = Math.floor(diff / 86_400_000);
  return lang === 'th' ? `${days} วันที่แล้ว` : `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

function statusTheme(level: HealthStatusLevel | null, lang: 'en' | 'th') {
  switch (level) {
    case 'Critical':
      return { color: Colors.danger, bg: Colors.dangerSoft, label: t(lang, 'sev_critical_upper') };
    case 'Warning':
      return { color: Colors.warning, bg: Colors.warningSoft, label: t(lang, 'sev_warning_upper') };
    case 'Good':
      return { color: Colors.success, bg: Colors.successSoft, label: t(lang, 'sev_good_upper') };
    case 'Excellent':
      return { color: Colors.info, bg: Colors.infoSoft, label: t(lang, 'sev_excellent_upper') };
    default:
      return { color: Colors.textSubtle, bg: Colors.gray100, label: null };
  }
}

function getLastPointMetric(point: MedicalTrendLastPoint | null): DetailMetric | null {
  if (!point || typeof point !== 'object') return null;
  const payload = flattenSnapshotForTrend(parseSnapshotObject((point as any)?.snapshot) ?? (point as Record<string, any>));
  const typeRaw = payload.type ?? payload.measurementType ?? payload.kind ?? '';
  const type = String(typeRaw).trim().toLowerCase();

  const sys = pickSnapshotNumber(payload, ['systolic', 'sys', 'sbp', 'systolic_mmHg', 'systolicMmhg', 'bloodPressureSystolic', 'blood_pressure_systolic']);
  const dia = pickSnapshotNumber(payload, ['diastolic', 'dia', 'dbp', 'diastolic_mmHg', 'diastolicMmhg', 'bloodPressureDiastolic', 'blood_pressure_diastolic']);
  if ((type === 'bp' || type === 'blood_pressure' || type === 'blood pressure' || (!type && sys != null && dia != null)) && sys != null && dia != null) {
    return 'bp';
  }

  const mgdl = pickSnapshotNumber(payload, ['mgdl', 'glucose', 'blood_glucose', 'bloodGlucose', 'glucose_mgdl']);
  if ((type === 'bg' || type === 'glucose' || type === 'blood_glucose' || type === 'blood glucose' || (!type && mgdl != null)) && mgdl != null) {
    return 'glucose';
  }

  const celsius = pickSnapshotNumber(payload, ['celsius', 'tempC', 'temperature', 'temperature_c', 'temperatureC', 'c']);
  if ((type === 'temp' || type === 'temperature' || (!type && celsius != null)) && celsius != null) {
    return 'temp';
  }

  const spo2 = pickSnapshotNumber(payload, ['spo2', 'oxygen', 'oxygen_level', 'oxygenLevel']);
  if ((type === 'spo2' || type === 'oxygen' || type === 'oximeter' || (!type && spo2 != null)) && spo2 != null) {
    return 'spo2';
  }

  return null;
}

function advicePalette(level: 'critical' | 'warning' | 'good' | 'excellent' | 'neutral') {
  switch (level) {
    case 'critical':
      return { tint: Colors.danger, background: Colors.dangerSoft };
    case 'warning':
      return { tint: Colors.warning, background: Colors.warningSoft };
    case 'good':
      return { tint: Colors.success, background: Colors.successSoft };
    case 'excellent':
      return { tint: Colors.info, background: Colors.infoSoft };
    default:
      return { tint: Colors.textSubtle, background: Colors.gray100 };
  }
}

function levelFromHealthStatus(status: HealthStatusLevel | null): 'critical' | 'warning' | 'good' | 'excellent' | 'neutral' {
  if (!status) return 'neutral';
  if (status === 'Critical') return 'critical';
  if (status === 'Warning') return 'warning';
  if (status === 'Good') return 'good';
  return 'excellent';
}


function buildAdviceBody(metric: 'bp' | 'glucose' | 'temp' | 'spo2', status: HealthStatusLevel | null, hasData: boolean, lang: 'en' | 'th' = 'en'): string {
  if (lang === 'th') {
    if (!hasData) {
      if (metric === 'bp') return 'ไม่พบข้อมูลความดันโลหิตล่าสุด กรุณาวัดความดันใหม่เพื่อรับคำแนะนำ';
      if (metric === 'glucose') return 'ไม่พบข้อมูลน้ำตาลในเลือดล่าสุด กรุณาวัดน้ำตาลเพื่อรับคำแนะนำ';
      if (metric === 'temp') return 'ไม่พบข้อมูลอุณหภูมิล่าสุด เชื่อมต่อเทอร์มอมิเตอร์เพื่อรับคำแนะนำ';
      return 'ไม่พบข้อมูลออกซิเจนล่าสุด เชื่อมต่อเครื่องวัดออกซิเจนเพื่อรับคำแนะนำ';
    }
    if (status === 'Critical') {
      if (metric === 'bp') return 'ความดันโลหิตอยู่ในระดับวิกฤต กรุณาวัดซ้ำหลังพักผ่อนและติดต่อแพทย์ทันทีหากยังสูงหรือมีอาการ';
      if (metric === 'glucose') return 'น้ำตาลในเลือดอยู่ในระดับวิกฤต ปฏิบัติตามแผนฉุกเฉินและพบแพทย์หากมีอาการ';
      if (metric === 'temp') return 'อุณหภูมิร่างกายอยู่ในระดับวิกฤต ดื่มน้ำ ติดตามอย่างใกล้ชิด และพบแพทย์หากมีอาการรุนแรง';
      return 'ระดับออกซิเจนอยู่ในระดับวิกฤต วัดซ้ำทันทีและพบแพทย์หากค่ายังต่ำหรือหายใจลำบาก';
    }
    if (status === 'Warning') {
      if (metric === 'bp') return 'ความดันโลหิตอยู่นอกช่วงปกติ พักผ่อน 5 นาทีแล้ววัดซ้ำ ติดตามหากยังสูงต่อเนื่อง';
      if (metric === 'glucose') return 'น้ำตาลในเลือดอยู่นอกช่วงเป้าหมาย ทบทวนมื้ออาหารและเวลายา แล้ววัดซ้ำตามแผนดูแล';
      if (metric === 'temp') return 'อุณหภูมิร่างกายผิดปกติเล็กน้อย พักผ่อน ดื่มน้ำ และติดตามการเปลี่ยนแปลงตลอดวัน';
      return 'ระดับออกซิเจนต่ำกว่าปกติเล็กน้อย นั่งตัวตรง พักผ่อน และวัดซ้ำหลังจากผ่านไปสักครู่';
    }
    if (status === 'Excellent') {
      if (metric === 'bp') return 'ความดันโลหิตดีเยี่ยม รักษากิจวัตรปัจจุบันและติดตามต่อเนื่อง';
      if (metric === 'glucose') return 'น้ำตาลในเลือดดีเยี่ยม รักษาอาหาร ยา และกิจกรรมที่ดีต่อไป';
      if (metric === 'temp') return 'อุณหภูมิร่างกายดีเยี่ยม ไม่จำเป็นต้องดำเนินการใดๆ นอกจากติดตามตามปกติ';
      return 'ระดับออกซิเจนดีเยี่ยม ทำกิจกรรมตามปกติและตรวจสอบเป็นประจำ';
    }
    if (metric === 'bp') return 'ความดันโลหิตอยู่ในช่วงดี ควรติดตามในเวลาที่สม่ำเสมอ';
    if (metric === 'glucose') return 'น้ำตาลในเลือดอยู่ในช่วงดี รักษากิจวัตรสุขภาพที่ดีต่อไป';
    if (metric === 'temp') return 'อุณหภูมิร่างกายอยู่ในช่วงดี ติดตามตามปกติต่อไป';
    return 'ระดับออกซิเจนอยู่ในช่วงดี ติดตามตามปกติต่อไป';
  }

  if (!hasData) {
    if (metric === 'bp') return 'No recent blood pressure reading found. Take a new reading to get tailored advice.';
    if (metric === 'glucose') return 'No recent glucose reading found. Measure blood sugar to get tailored advice.';
    if (metric === 'temp') return 'No recent temperature reading found. Connect or sync a thermometer reading for advice.';
    return 'No recent oxygen reading found. Connect or sync an oximeter reading for advice.';
  }

  if (status === 'Critical') {
    if (metric === 'bp') return 'Blood pressure appears critical. Recheck after resting and contact a clinician urgently if it remains high or symptoms occur.';
    if (metric === 'glucose') return 'Glucose appears critical. Follow your emergency plan and seek urgent medical advice if symptoms are present.';
    if (metric === 'temp') return 'Temperature appears critical. Hydrate, monitor closely, and seek urgent care if severe symptoms are present.';
    return 'Oxygen level appears critical. Recheck immediately and seek urgent care if the reading remains low or breathing is difficult.';
  }

  if (status === 'Warning') {
    if (metric === 'bp') return 'Blood pressure is outside your usual range. Rest for 5 minutes and recheck; monitor for persistent elevation.';
    if (metric === 'glucose') return 'Glucose is outside the target range. Review meals/medication timing and recheck according to your care plan.';
    if (metric === 'temp') return 'Temperature is mildly abnormal. Rest, hydrate, and monitor for trend changes over the day.';
    return 'Oxygen level is slightly low. Sit upright, rest, and repeat the reading after a few minutes.';
  }

  if (status === 'Excellent') {
    if (metric === 'bp') return 'Blood pressure is excellent. Keep your current routine and continue regular monitoring.';
    if (metric === 'glucose') return 'Glucose is excellent. Continue your current diet, medication, and activity routine.';
    if (metric === 'temp') return 'Temperature is excellent. No action needed beyond routine monitoring.';
    return 'Oxygen level is excellent. Continue normal activities and routine checks.';
  }

  if (metric === 'bp') return 'Blood pressure is in a good range. Keep monitoring at consistent times.';
  if (metric === 'glucose') return 'Glucose is in a good range. Maintain your usual healthy routine.';
  if (metric === 'temp') return 'Temperature is in a good range. Continue routine monitoring.';
  return 'Oxygen level is in a good range. Continue routine monitoring.';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseSnapshotObject(input: any): Record<string, any> | null {
  if (!input) return null;
  if (typeof input === 'object' && !Array.isArray(input)) return input as Record<string, any>;
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function pickSnapshotContainer(snapshot: Record<string, any>, keys: string[]): Record<string, any> | null {
  for (const key of keys) {
    const value = snapshot[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, any>;
    }
  }
  return null;
}

function pickSnapshotNumber(snapshot: Record<string, any>, keys: string[]): number | null {
  for (const key of keys) {
    const value = snapshot[key];
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function flattenSnapshotForTrend(snapshot: Record<string, any>): Record<string, any> {
  const nested = [
    pickSnapshotContainer(snapshot, ['bp', 'blood_pressure', 'bloodPressure']),
    pickSnapshotContainer(snapshot, ['glucose', 'blood_glucose', 'bloodGlucose']),
    pickSnapshotContainer(snapshot, ['temp', 'temperature']),
    pickSnapshotContainer(snapshot, ['spo2', 'oxygen', 'oximeter']),
  ].filter(Boolean) as Record<string, any>[];

  if (!nested.length) return snapshot;
  return Object.assign({}, snapshot, ...nested);
}

function normalizeUnknownTs(input: { ts?: unknown; ts_ms?: unknown } | null | undefined): number {
  const tsMs = Number(input?.ts_ms);
  if (Number.isFinite(tsMs) && tsMs > 0) return tsMs;
  const rawTs = input?.ts;
  if (typeof rawTs === 'number' && Number.isFinite(rawTs) && rawTs > 0) return rawTs;
  const parsed = parseUtcDate(String(rawTs || '')).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatMeasurementNumber(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(fractionDigits);
}

function getLastPointSummary(point: MedicalTrendLastPoint | null, lang: 'en' | 'th'): LastPointSummary | null {
  if (!point || typeof point !== 'object') return null;

  const payload = flattenSnapshotForTrend(parseSnapshotObject((point as any)?.snapshot) ?? (point as Record<string, any>));
  const tsMs = normalizeUnknownTs({
    ts_ms: (point as any)?.ts_ms ?? payload.ts_ms,
    ts: (point as any)?.ts ?? payload.ts,
  });
  const deviceLabel = String((point as any)?.device_name || (point as any)?.factory_name || (point as any)?.device_id || '').trim() || undefined;
  const timestampLabel = tsMs > 0
    ? new Date(tsMs).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : undefined;

  const typeRaw = payload.type ?? payload.measurementType ?? payload.kind ?? '';
  const type = String(typeRaw).trim().toLowerCase();

  const sys = pickSnapshotNumber(payload, [
    'systolic', 'sys', 'sbp', 'systolic_mmHg', 'systolicMmhg', 'bloodPressureSystolic', 'blood_pressure_systolic',
  ]);
  const dia = pickSnapshotNumber(payload, [
    'diastolic', 'dia', 'dbp', 'diastolic_mmHg', 'diastolicMmhg', 'bloodPressureDiastolic', 'blood_pressure_diastolic',
  ]);
  if ((type === 'bp' || type === 'blood_pressure' || type === 'blood pressure' || (!type && sys != null && dia != null)) && sys != null && dia != null) {
    const status = evaluateBloodPressure({ sys, dia });
    return {
      label: t(lang, 'blood_pressure'),
      value: `${Math.round(sys)}/${Math.round(dia)}`,
      unit: 'mmHg',
      status,
      timestampLabel,
      deviceLabel,
      icon: require('../../../../assets/android-res/drawable/pressure.png'),
    };
  }

  const mgdl = pickSnapshotNumber(payload, [
    'mgdl', 'glucose', 'blood_glucose', 'bloodGlucose', 'glucose_mgdl',
  ]);
  if ((type === 'bg' || type === 'glucose' || type === 'blood_glucose' || type === 'blood glucose' || (!type && mgdl != null)) && mgdl != null) {
    const status = evaluateGlucose({ mgdl });
    return {
      label: t(lang, 'blood_glucose'),
      value: formatMeasurementNumber(mgdl, 1),
      unit: 'mg/dL',
      status,
      timestampLabel,
      deviceLabel,
      icon: require('../../../../assets/android-res/drawable/glucose.png'),
    };
  }

  const celsius = pickSnapshotNumber(payload, [
    'celsius', 'tempC', 'temperature', 'temperature_c', 'temperatureC', 'c',
  ]);
  if ((type === 'temp' || type === 'temperature' || (!type && celsius != null)) && celsius != null) {
    const status = evaluateTemperature({ celsius });
    return {
      label: t(lang, 'temperature'),
      value: formatMeasurementNumber(celsius, 1),
      unit: '°C',
      status,
      timestampLabel,
      deviceLabel,
      icon: require('../../../../assets/android-res/drawable/temperature.png'),
    };
  }

  const spo2 = pickSnapshotNumber(payload, [
    'spo2', 'oxygen', 'oxygen_level', 'oxygenLevel',
  ]);
  const pulse = pickSnapshotNumber(payload, [
    'pulse', 'heartRate', 'heart_rate', 'bpm',
  ]);
  if ((type === 'spo2' || type === 'oxygen' || type === 'oximeter' || (!type && spo2 != null)) && spo2 != null) {
    const status = evaluateSpO2({ spo2 });
    return {
      label: t(lang, 'oxygen_spo2'),
      value: formatMeasurementNumber(spo2, 0),
      unit: '%',
      secondary: pulse != null ? `${formatMeasurementNumber(pulse, 0)} bpm` : undefined,
      status,
      timestampLabel,
      deviceLabel,
      icon: require('../../../../assets/android-res/drawable/spo2.png'),
    };
  }

  return null;
}

/* ---------- helpers for medical report ---------- */

function pickNum(obj: any, keys: string[]): number | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function pickStr(obj: any, keys: string[]): string {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of keys) {
    const v = obj[k];
    if (v !== null && v !== undefined && String(v).trim()) return String(v).trim();
  }
  return '';
}

function fmtList(value: any): string[] {
  if (!value) return [];
  if (typeof value === 'string') return value.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.map(v => typeof v === 'object' ? (v?.name || v?.label || JSON.stringify(v)) : String(v)).filter(Boolean);
  return [];
}

function formatDateStr(iso: string, lang?: 'en' | 'th'): string {
  if (!iso) return '-';
  try {
    const d = parseUtcDate(iso);
    if (isNaN(d.getTime())) return iso;
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsTh = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const months = lang === 'th' ? monthsTh : monthsEn;
    const year = lang === 'th' ? d.getUTCFullYear() + 543 : d.getUTCFullYear();
    return `${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]} ${year}`;
  } catch { return iso; }
}

function formatTimeStr(iso: string): string {
  if (!iso) return '';
  try {
    const d = parseUtcDate(iso);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  } catch { return ''; }
}

function formatDateTimeStr(iso: string, lang?: 'en' | 'th'): string {
  const date = formatDateStr(iso, lang);
  const time = formatTimeStr(iso);
  return time ? `${time}, ${date}` : date;
}

type VitalRow = { ts: string; spo2: number | null; temp: number | null; sys: number | null; dia: number | null; glucose: number | null };

function extractVitals(rawRows: any[], dailyRows?: any[]): VitalRow[] {
  const rows: VitalRow[] = [];

  // Process raw rows (individual readings with timestamps)
  if (Array.isArray(rawRows)) {
    for (const r of rawRows) {
      if (!r) continue;
      const snap = (r.snapshot && typeof r.snapshot === 'object') ? r.snapshot : r;
      const ts = r.ts || r.timestamp || '';
      const spo2 = pickNum(snap, ['spo2', 'SpO2', 'oxygen']) ?? pickNum(snap.spo2, ['spo2', 'SpO2', 'oxygen']);
      const temp = pickNum(snap, ['celsius', 'c', 'temp_c', 'temperature']) ?? pickNum(snap.temp, ['celsius', 'c']);
      const sys = pickNum(snap, ['sys', 'systolic']) ?? pickNum(snap.bp, ['sys', 'systolic']);
      const dia = pickNum(snap, ['dia', 'diastolic']) ?? pickNum(snap.bp, ['dia', 'diastolic']);
      const glucose = pickNum(snap, ['mgdl', 'glucose', 'bg', 'value']) ?? pickNum(snap.glucose, ['mgdl', 'value']);
      if (spo2 !== null || temp !== null || sys !== null || glucose !== null) {
        rows.push({ ts, spo2, temp, sys, dia, glucose });
      }
    }
  }

  // Process daily aggregate rows — each row has metrics.samples[] with individual snapshots
  if (Array.isArray(dailyRows)) {
    // Collect dates already covered by raw data to avoid duplicates
    const rawDates = new Set(rows.map(r => {
      try { return parseUtcDate(r.ts).toISOString().slice(0, 10); } catch { return ''; }
    }).filter(Boolean));

    for (const dailyRow of dailyRows) {
      if (!dailyRow) continue;
      // Skip days already covered by today's raw data
      const day = dailyRow.day || dailyRow.date || '';
      const dayKey = (() => { try { return parseUtcDate(day).toISOString().slice(0, 10); } catch { return ''; } })();
      if (dayKey && rawDates.has(dayKey)) continue;

      // Unpack samples array from metrics — same snapshot format as raw rows
      const metrics = dailyRow.metrics;
      const samples: any[] = (metrics && Array.isArray(metrics.samples)) ? metrics.samples : [];
      for (const s of samples) {
        if (!s) continue;
        const snap = (s.snapshot && typeof s.snapshot === 'object') ? s.snapshot : s;
        const ts = s.ts || s.timestamp || day || '';
        const spo2 = pickNum(snap, ['spo2', 'SpO2', 'oxygen']) ?? pickNum(snap.spo2, ['spo2', 'SpO2', 'oxygen']);
        const temp = pickNum(snap, ['celsius', 'c', 'temp_c', 'temperature']) ?? pickNum(snap.temp, ['celsius', 'c']);
        const sys = pickNum(snap, ['sys', 'systolic']) ?? pickNum(snap.bp, ['sys', 'systolic']);
        const dia = pickNum(snap, ['dia', 'diastolic']) ?? pickNum(snap.bp, ['dia', 'diastolic']);
        const glucose = pickNum(snap, ['mgdl', 'glucose', 'bg', 'value']) ?? pickNum(snap.glucose, ['mgdl', 'value']);
        if (spo2 !== null || temp !== null || sys !== null || glucose !== null) {
          rows.push({ ts, spo2, temp, sys, dia, glucose });
        }
      }
    }
  }

  rows.sort((a, b) => parseUtcDate(a.ts).getTime() - parseUtcDate(b.ts).getTime());
  return rows;
}

function calcStats(values: number[]): { avg: number; min: number; max: number } | null {
  const clean = values.filter(v => Number.isFinite(v));
  if (clean.length === 0) return null;
  const sum = clean.reduce((a, b) => a + b, 0);
  return { avg: Math.round((sum / clean.length) * 10) / 10, min: Math.min(...clean), max: Math.max(...clean) };
}

function renderNumberedList(items: string[]): string {
  if (items.length === 0) return '<p class="muted">—</p>';
  return '<ol>' + items.map(i => `<li>${escapeHtml(i)}</li>`).join('') + '</ol>';
}

type ChartPoint = { ts: string; value: number };
type ChartSeries = { points: ChartPoint[]; color: string; label: string };

function buildSvgLineChart(title: string, series: ChartSeries[], unit: string, height = 180): string {
  const allPts = series.flatMap(s => s.points);
  if (allPts.length === 0) return '';

  const W = 680, H = height, PAD_L = 48, PAD_R = 16, PAD_T = 10, PAD_B = 36;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const allVals = allPts.map(p => p.value);
  let minV = Math.min(...allVals);
  let maxV = Math.max(...allVals);
  if (minV === maxV) { minV -= 5; maxV += 5; }
  const rangeV = maxV - minV || 1;

  // Use UTC day grouping so Trends matches server timestamps at +0.
  const toUtcDayKey = (ts: string): string | null => {
    const timeMs = parseUtcDate(ts).getTime();
    if (isNaN(timeMs)) return null;
    return new Date(timeMs).toISOString().slice(0, 10);
  };

  // Count unique days across all data
  const uniqueDays = new Set(allPts.map(p => toUtcDayKey(p.ts)).filter(Boolean));
  const singleDayMode = uniqueDays.size <= 1;

  // --- Scaling helpers ---
  // When data spans multiple days: aggregate by day, space evenly by day
  // When data is within one day: use individual timestamps, space by time
  type PlotPt = { key: string; value: number };

  const aggregateByDay = (pts: ChartPoint[]): PlotPt[] => {
    const byDay = new Map<string, { sumVal: number; count: number }>();
    for (const p of pts) {
      const dayKey = toUtcDayKey(p.ts);
      if (!dayKey) continue;
      const entry = byDay.get(dayKey);
      if (entry) { entry.sumVal += p.value; entry.count++; }
      else byDay.set(dayKey, { sumVal: p.value, count: 1 });
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, v]) => ({ key: dayKey, value: Math.round((v.sumVal / v.count) * 10) / 10 }));
  };

  const toTimePlotPts = (pts: ChartPoint[]): PlotPt[] => {
    return pts
      .filter(p => !isNaN(parseUtcDate(p.ts).getTime()))
      .sort((a, b) => parseUtcDate(a.ts).getTime() - parseUtcDate(b.ts).getTime())
      .map(p => ({ key: p.ts, value: p.value }));
  };

  const allPlotPts = singleDayMode ? toTimePlotPts(allPts) : aggregateByDay(allPts);
  const ptCount = allPlotPts.length;

  // Build index/time-based X scaling
  let scaleX: (key: string) => number;
  if (singleDayMode) {
    // spread by actual timestamp
    const times = allPlotPts.map(p => parseUtcDate(p.key).getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const rangeT = maxT - minT || 1;
    scaleX = (key: string) => {
      const timeMs = parseUtcDate(key).getTime();
      return PAD_L + ((timeMs - minT) / rangeT) * plotW;
    };
  } else {
    const keyIndexMap = new Map<string, number>();
    allPlotPts.forEach((p, i) => keyIndexMap.set(p.key, i));
    scaleX = (key: string) => {
      const idx = keyIndexMap.get(key) ?? 0;
      return PAD_L + (ptCount > 1 ? (idx / (ptCount - 1)) * plotW : plotW / 2);
    };
  }
  const scaleY = (v: number) => PAD_T + plotH - ((v - minV) / rangeV) * plotH;

  // Y-axis grid lines
  const yTicks = 5;
  let gridLines = '';
  for (let i = 0; i <= yTicks; i++) {
    const v = minV + (rangeV * i) / yTicks;
    const y = scaleY(v);
    gridLines += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>`;
    gridLines += `<text x="${PAD_L - 6}" y="${y + 3}" text-anchor="end" fill="#6b7280" font-size="7">${Math.round(v * 10) / 10}</text>`;
  }

  // X-axis labels — enforce minimum pixel gap to avoid overlap
  const MIN_LABEL_GAP = 55;
  let xLabels = '';
  let lastLabelX = -Infinity;
  const fmtLabel = (p: PlotPt) => singleDayMode ? formatTimeStr(p.key) : formatDateStr(p.key);
  // Always emit first label
  if (ptCount > 0) {
    const x0 = scaleX(allPlotPts[0].key);
    xLabels += `<text x="${x0}" y="${H - 4}" text-anchor="middle" fill="#6b7280" font-size="7">${escapeHtml(fmtLabel(allPlotPts[0]))}</text>`;
    lastLabelX = x0;
  }
  // Middle labels
  for (let i = 1; i < ptCount - 1; i++) {
    const x = scaleX(allPlotPts[i].key);
    if (x - lastLabelX >= MIN_LABEL_GAP) {
      xLabels += `<text x="${x}" y="${H - 4}" text-anchor="middle" fill="#6b7280" font-size="7">${escapeHtml(fmtLabel(allPlotPts[i]))}</text>`;
      lastLabelX = x;
    }
  }
  // Always emit last label if it doesn't overlap
  if (ptCount > 1) {
    const xLast = scaleX(allPlotPts[ptCount - 1].key);
    if (xLast - lastLabelX >= MIN_LABEL_GAP) {
      xLabels += `<text x="${xLast}" y="${H - 4}" text-anchor="middle" fill="#6b7280" font-size="7">${escapeHtml(fmtLabel(allPlotPts[ptCount - 1]))}</text>`;
    }
  }

  // Catmull-Rom → cubic Bézier curve with clamped control points to prevent loops
  const catmullRomPath = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    const n = pts.length;
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = i === 0 ? pts[0] : pts[i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i + 2 < n ? pts[i + 2] : pts[n - 1];
      // Clamp control points within segment x-range to prevent backward loops
      const cp1x = Math.max(p1.x, Math.min(p1.x + (p2.x - p0.x) / 6, p2.x));
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = Math.max(p1.x, Math.min(p2.x - (p3.x - p1.x) / 6, p2.x));
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  };

  // Draw smooth lines + dots
  let paths = '';
  let dots = '';
  for (const s of series) {
    if (s.points.length === 0) continue;
    const plotPts = singleDayMode ? toTimePlotPts(s.points) : aggregateByDay(s.points);
    const curvePts = plotPts.map(p => ({ x: scaleX(p.key), y: scaleY(p.value) }));
    if (curvePts.length >= 2) {
      paths += `<path d="${catmullRomPath(curvePts)}" fill="none" stroke="${s.color}" stroke-width="1.5" stroke-linecap="round"/>`;
    }
    for (const cp of curvePts) {
      dots += `<circle cx="${cp.x.toFixed(1)}" cy="${cp.y.toFixed(1)}" r="2.5" fill="${s.color}"/>`;
    }
  }

  // Legend
  let legend = '';
  if (series.length > 1) {
    let lx = PAD_L;
    for (const s of series) {
      legend += `<rect x="${lx}" y="${PAD_T - 8}" width="10" height="3" rx="1" fill="${s.color}"/>`;
      legend += `<text x="${lx + 13}" y="${PAD_T - 5}" fill="#374151" font-size="7">${escapeHtml(s.label)}</text>`;
      lx += 13 + s.label.length * 4.5 + 12;
    }
  }

  return `
  <div class="chart-block">
    <h4 class="chart-title">${escapeHtml(title)} (${escapeHtml(unit)})</h4>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="max-width:100%;">
      <rect x="${PAD_L}" y="${PAD_T}" width="${plotW}" height="${plotH}" fill="#fafbfc" rx="2"/>
      ${gridLines}
      ${xLabels}
      ${paths}
      ${dots}
      ${legend}
    </svg>
  </div>`;
}

function buildHealthReportHtml(report: HealthReportDataResponse, lang: 'en' | 'th'): string {
  const L = (key: string) => t(lang, key);
  const profileLabel = report?.profile?.profile_label || '-';
  const generatedAt = report?.generated_at || new Date().toISOString();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

  // — Patient info from medical_general_info —
  const gen = (Array.isArray(report.tables.medical_general_info) && report.tables.medical_general_info[0]) || {} as any;
  const name = pickStr(gen, ['user_label', 'name', 'profile_label']) || profileLabel;
  const dob = pickStr(gen, ['date_of_birth', 'dob']);
  const sex = pickStr(gen, ['sex', 'gender']);
  const bloodType = pickStr(gen, ['blood_type', 'bloodType']);
  const organDonor = gen.organ_donor === true ? L('report_yes') : gen.organ_donor === false ? L('report_no') : '-';
  const heightCm = pickNum(gen, ['height_cm', 'height']);
  const weightKg = pickNum(gen, ['weight_kg', 'weight']);
  const bmi = (heightCm && weightKg && heightCm > 0) ? (weightKg / ((heightCm / 100) ** 2)).toFixed(1) : '-';

  const allergies = fmtList(gen.allergies);
  const conditions = fmtList(gen.chronic_conditions);
  const medications = fmtList(gen.medications);
  const familyHistory = fmtList(gen.family_history);
  const emergencyContact = pickStr(gen, ['emergency_contact']);
  const insuranceProvider = pickStr(gen, ['insurance_provider']);
  const insuranceNumber = pickStr(gen, ['insurance_number']);

  // — Vital signs from raw + daily data —
  const vitals = extractVitals(report.tables.medical_data_raw, report.tables.medical_data_daily);
  const startDate = vitals.length > 0 ? formatDateStr(vitals[0].ts, lang) : '-';
  const endDate = vitals.length > 0 ? formatDateStr(vitals[vitals.length - 1].ts, lang) : '-';

  const spo2Stats = calcStats(vitals.filter(v => v.spo2 !== null).map(v => v.spo2!));
  const tempStats = calcStats(vitals.filter(v => v.temp !== null).map(v => v.temp!));
  const sysStats = calcStats(vitals.filter(v => v.sys !== null).map(v => v.sys!));
  const diaStats = calcStats(vitals.filter(v => v.dia !== null).map(v => v.dia!));
  const glucoseStats = calcStats(vitals.filter(v => v.glucose !== null).map(v => v.glucose!));

  const bpAvg = (sysStats && diaStats) ? `${sysStats.avg}/${diaStats.avg}` : '-';
  const bpMin = (sysStats && diaStats) ? `${sysStats.min}/${diaStats.min}` : '-';
  const bpMax = (sysStats && diaStats) ? `${sysStats.max}/${diaStats.max}` : '-';

  // — Vital measurements table —
  const measurementRows = vitals.slice(-100).map(v => {
    const date = formatDateStr(v.ts, lang);
    const time = formatTimeStr(v.ts);
    const spo2 = v.spo2 !== null ? String(v.spo2) : '-';
    const temp = v.temp !== null ? v.temp.toFixed(1) : '-';
    const bp = (v.sys !== null && v.dia !== null) ? `${v.sys}/${v.dia}` : '-';
    const gl = v.glucose !== null ? String(v.glucose) : '-';
    return `<tr><td>${escapeHtml(date)}</td><td>${escapeHtml(time)}</td><td>${escapeHtml(spo2)}</td><td>${escapeHtml(temp)}</td><td>${escapeHtml(bp)}</td><td>${escapeHtml(gl)}</td></tr>`;
  }).join('');

  const statRow = (label: string, stats: { avg: number; min: number; max: number } | null, unit: string) => {
    if (!stats) return `<div class="stat-block"><h4>${escapeHtml(label)}</h4><p class="muted">${escapeHtml(L('report_no_data'))}</p></div>`;
    return `
      <div class="stat-block">
        <h4>${escapeHtml(label)}</h4>
        <table class="stat-table">
          <tr><td class="stat-label">${escapeHtml(L('report_average'))}</td><td class="stat-value">${stats.avg} ${escapeHtml(unit)}</td></tr>
          <tr><td class="stat-label">${escapeHtml(L('report_minimum'))}</td><td class="stat-value">${stats.min} ${escapeHtml(unit)}</td></tr>
          <tr><td class="stat-label">${escapeHtml(L('report_maximum'))}</td><td class="stat-value">${stats.max} ${escapeHtml(unit)}</td></tr>
        </table>
      </div>`;
  };

  const bpStatBlock = (sysStats && diaStats) ? `
    <div class="stat-block">
      <h4>${escapeHtml(L('report_blood_pressure'))}</h4>
      <table class="stat-table">
        <tr><td class="stat-label">${escapeHtml(L('report_average'))}</td><td class="stat-value">${bpAvg} mmHg</td></tr>
        <tr><td class="stat-label">${escapeHtml(L('report_minimum'))}</td><td class="stat-value">${bpMin} mmHg</td></tr>
        <tr><td class="stat-label">${escapeHtml(L('report_maximum'))}</td><td class="stat-value">${bpMax} mmHg</td></tr>
      </table>
    </div>` : `<div class="stat-block"><h4>${escapeHtml(L('report_blood_pressure'))}</h4><p class="muted">${escapeHtml(L('report_no_data'))}</p></div>`;

  const fontFamily = lang === 'th'
    ? "'Sarabun', 'Noto Sans Thai', 'Tahoma', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    : "'Helvetica Neue', Helvetica, Arial, sans-serif";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 20mm 15mm 20mm 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: ${fontFamily};
    font-size: 9.5pt;
    color: #1a1a1a;
    line-height: 1.45;
    margin: 0;
    padding: 0;
  }
  .page-header {
    text-align: center;
    border-bottom: 2.5px solid #1e40af;
    padding-bottom: 10px;
    margin-bottom: 18px;
  }
  .page-header h1 {
    font-size: 20pt;
    font-weight: 700;
    color: #1e3a5f;
    letter-spacing: 2px;
    margin: 0 0 2px 0;
    text-transform: uppercase;
  }
  .meta-row {
    font-size: 8.5pt;
    color: #555;
    margin: 2px 0;
  }
  .section {
    margin-top: 16px;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 10.5pt;
    font-weight: 700;
    color: #1e3a5f;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1.5px solid #cbd5e1;
    padding-bottom: 3px;
    margin: 0 0 8px 0;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 24px;
  }
  .info-row {
    display: flex;
    padding: 2px 0;
  }
  .info-label {
    font-weight: 600;
    color: #374151;
    min-width: 120px;
    flex-shrink: 0;
  }
  .info-value {
    color: #1a1a1a;
  }
  ol {
    margin: 4px 0 4px 18px;
    padding: 0;
  }
  ol li {
    padding: 1px 0;
  }
  .muted { color: #9ca3af; font-style: italic; margin: 2px 0; }
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .stat-block {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 8px 10px;
  }
  .stat-block h4 {
    font-size: 9.5pt;
    font-weight: 700;
    color: #1e3a5f;
    margin: 0 0 4px 0;
  }
  .stat-table {
    width: 100%;
    border: none;
  }
  .stat-table td {
    border: none;
    padding: 1px 0;
    font-size: 9pt;
  }
  .stat-label { color: #6b7280; width: 70px; }
  .stat-value { color: #1a1a1a; font-weight: 500; }
  table.vitals {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-top: 6px;
  }
  table.vitals th {
    background: #1e3a5f;
    color: #fff;
    font-weight: 600;
    padding: 5px 6px;
    text-align: left;
    font-size: 8pt;
    letter-spacing: 0.3px;
  }
  table.vitals td {
    border-bottom: 1px solid #e5e7eb;
    padding: 4px 6px;
  }
  table.vitals tr:nth-child(even) { background: #f9fafb; }
  .footer {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1.5px solid #cbd5e1;
    text-align: center;
    font-size: 8pt;
    color: #6b7280;
  }
  .footer .app-name { font-weight: 600; color: #1e3a5f; }
  .footer .disclaimer { margin-top: 4px; font-style: italic; }
  .chart-block { margin: 12px 0; page-break-inside: avoid; }
  .chart-title { font-size: 9.5pt; font-weight: 700; color: #1e3a5f; margin: 0 0 4px 0; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="page-header">
  <h1>${escapeHtml(L('report_title'))}</h1>
  <div class="meta-row">${escapeHtml(L('report_profile'))}: ${escapeHtml(String(profileLabel))}</div>
  <div class="meta-row">${escapeHtml(L('report_generated'))}: ${escapeHtml(formatDateTimeStr(generatedAt, lang))}${tz ? ` (${escapeHtml(tz)})` : ''}</div>
  ${vitals.length > 0 ? `<div class="meta-row">${escapeHtml(L('report_period'))}: ${escapeHtml(startDate)} — ${escapeHtml(endDate)}</div>` : ''}
</div>

<!-- PATIENT INFORMATION -->
<div class="section">
  <div class="section-title">${escapeHtml(L('report_patient_info'))}</div>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">${escapeHtml(L('report_name'))}</span><span class="info-value">${escapeHtml(name)}</span></div>
    <div class="info-row"><span class="info-label">${escapeHtml(L('report_dob'))}</span><span class="info-value">${dob ? escapeHtml(formatDateStr(dob, lang)) : '-'}</span></div>
    <div class="info-row"><span class="info-label">${escapeHtml(L('report_sex'))}</span><span class="info-value">${escapeHtml(sex || '-')}</span></div>
    <div class="info-row"><span class="info-label">${escapeHtml(L('report_blood_type'))}</span><span class="info-value">${escapeHtml(bloodType || '-')}</span></div>
    <div class="info-row"><span class="info-label">${escapeHtml(L('report_organ_donor'))}</span><span class="info-value">${escapeHtml(organDonor)}</span></div>
    <div class="info-row"><span class="info-label">${escapeHtml(L('report_height'))}</span><span class="info-value">${heightCm !== null ? `${heightCm} cm` : '-'}</span></div>
    <div class="info-row"><span class="info-label">${escapeHtml(L('report_weight'))}</span><span class="info-value">${weightKg !== null ? `${weightKg} kg` : '-'}</span></div>
    <div class="info-row"><span class="info-label">${escapeHtml(L('report_bmi'))}</span><span class="info-value">${escapeHtml(String(bmi))}</span></div>
  </div>
</div>

<!-- ALLERGIES -->
<div class="section">
  <div class="section-title">${escapeHtml(L('report_allergies'))}</div>
  ${renderNumberedList(allergies)}
</div>

<!-- CHRONIC CONDITIONS -->
<div class="section">
  <div class="section-title">${escapeHtml(L('report_chronic_conditions'))}</div>
  ${renderNumberedList(conditions)}
</div>

<!-- CURRENT MEDICATIONS -->
<div class="section">
  <div class="section-title">${escapeHtml(L('report_medications'))}</div>
  ${renderNumberedList(medications)}
</div>

<!-- FAMILY MEDICAL HISTORY -->
<div class="section">
  <div class="section-title">${escapeHtml(L('report_family_history'))}</div>
  ${renderNumberedList(familyHistory)}
</div>

<!-- EMERGENCY CONTACT -->
<div class="section">
  <div class="section-title">${escapeHtml(L('report_emergency_contact'))}</div>
  <p>${emergencyContact ? escapeHtml(emergencyContact) : '<span class="muted">—</span>'}</p>
</div>

<!-- INSURANCE INFORMATION -->
<div class="section">
  <div class="section-title">${escapeHtml(L('report_insurance'))}</div>
  <div class="info-row"><span class="info-label">${escapeHtml(L('report_provider'))}</span><span class="info-value">${escapeHtml(insuranceProvider || '-')}</span></div>
  <div class="info-row"><span class="info-label">${escapeHtml(L('report_policy_number'))}</span><span class="info-value">${escapeHtml(insuranceNumber || '-')}</span></div>
</div>

<!-- VITAL SIGNS SUMMARY -->
<div class="section">
  <div class="section-title">${escapeHtml(L('report_vital_summary'))}</div>
  ${vitals.length > 0 ? `<p style="font-size:8.5pt;color:#555;margin:0 0 8px 0;">${escapeHtml(L('report_period_label'))} ${escapeHtml(startDate)} — ${escapeHtml(endDate)}</p>` : ''}
  <div class="stats-grid">
    ${statRow(L('report_spo2'), spo2Stats, '%')}
    ${statRow(L('report_temperature'), tempStats, '\u00B0C')}
    ${bpStatBlock}
    ${statRow(L('report_blood_glucose'), glucoseStats, 'mg/dL')}
  </div>
</div>

<!-- VITAL MEASUREMENTS -->
<div class="section">
  <div class="section-title">${escapeHtml(L('report_vital_measurements'))}</div>
  ${vitals.length > 0 ? `
  <table class="vitals">
    <thead>
      <tr>
        <th>${escapeHtml(L('report_date'))}</th>
        <th>${escapeHtml(L('report_time'))}</th>
        <th>SpO\u2082 (%)</th>
        <th>${escapeHtml(L('report_temp_label'))} (\u00B0C)</th>
        <th>${escapeHtml(L('report_blood_pressure'))} (mmHg)</th>
        <th>${escapeHtml(L('report_glucose_label'))} (mg/dL)</th>
      </tr>
    </thead>
    <tbody>${measurementRows}</tbody>
  </table>` : `<p class="muted">${escapeHtml(L('report_no_vitals'))}</p>`}
</div>

<!-- VITAL SIGN TRENDS -->
${(() => {
  const charts: string[] = [];
  const sysPts = vitals.filter(v => v.sys !== null).map(v => ({ ts: v.ts, value: v.sys! }));
  const diaPts = vitals.filter(v => v.dia !== null).map(v => ({ ts: v.ts, value: v.dia! }));
  if (sysPts.length >= 2) charts.push(buildSvgLineChart(L('report_bp_trend'), [{ points: sysPts, color: '#dc2626', label: L('report_systolic') }, { points: diaPts, color: '#2563eb', label: L('report_diastolic') }], 'mmHg'));
  const glPts = vitals.filter(v => v.glucose !== null).map(v => ({ ts: v.ts, value: v.glucose! }));
  if (glPts.length >= 2) charts.push(buildSvgLineChart(L('report_glucose_trend'), [{ points: glPts, color: '#7c3aed', label: L('report_glucose_label') }], 'mg/dL'));
  if (charts.length === 0) return '';
  return `<div class="section"><div class="section-title">${escapeHtml(L('report_vital_trends'))}</div>${charts.join('')}</div>`;
})()}

<!-- FOOTER -->
<div class="footer">
  <div class="app-name">${escapeHtml(L('report_generated_by'))}</div>
  <div class="disclaimer">${escapeHtml(L('report_disclaimer'))}</div>
</div>

</body>
</html>`;
}

function PeriodSwitch({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const { lang } = useLanguage();
  const items: Period[] = useMemo(() => ['Overall', 'Daily', 'Weekly', 'Monthly'], []);
  const [wrapW, setWrapW] = useState(0);
  const anim = useRef(new Animated.Value(items.indexOf(value))).current;
  const hasMultipleItems = items.length > 1;

  useEffect(() => {
    if (!hasMultipleItems) return;
    const idx = items.indexOf(value);
    if (idx >= 0) {
      Animated.timing(anim, {
        toValue: idx,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [anim, hasMultipleItems, items, value]);

  const onLayout = (e: LayoutChangeEvent) => {
    setWrapW(e.nativeEvent.layout.width);
  };

  const pillW = wrapW > 0 ? (wrapW - 8) / items.length : 0;

  return (
    <View style={styles.periodSwitchWrap} onLayout={onLayout}>
      {wrapW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.periodActiveBg,
            {
              width: pillW,
              transform: hasMultipleItems
                ? [
                    {
                      translateX: anim.interpolate({
                        inputRange: items.map((_, index) => index),
                        outputRange: items.map((_, index) => 4 + pillW * index),
                      }),
                    },
                  ]
                : [{ translateX: 4 }],
            },
          ]}
        />
      ) : null}
      {items.map((label) => {
        const active = value === label;
        return (
          <Pressable
            key={label}
            onPress={() => onChange(label)}
            style={({ pressed }) => [styles.periodPill, pressed && { opacity: 0.95 }]}
          >
            <Text style={[styles.periodText, active && styles.periodTextActive]}>{t(lang, label.toLowerCase())}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TrendScreen = React.memo(function TrendScreen() {
  const { lang } = useLanguage();
  const activeTab = useActiveTab();
  const [detailPeriod, setDetailPeriod] = useState<Period>('Overall');
  const [selectedMetric, setSelectedMetric] = useState<DetailMetric | null>(null);
  const [weightDetailOpen, setWeightDetailOpen] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [goals, setGoals] = useState<CachedGoal[]>([]);
  const [latestDeviceByMetric, setLatestDeviceByMetric] = useState<LatestDeviceByMetric>({
    bp: null,
    glucose: null,
    temp: null,
    spo2: null,
  });
  const [manualMetric, setManualMetric] = useState<DetailMetric | null>(null);
  const [manualForm, setManualForm] = useState<ManualReadingForm>(EMPTY_MANUAL_FORM);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [bpPoints, setBpPoints] = useState<BloodPressureTrendPoint[]>([]);
  const [glucosePoints, setGlucosePoints] = useState<BloodGlucoseTrendPoint[]>([]);
  const [tempPoints, setTempPoints] = useState<TemperatureTrendPoint[]>([]);
  const [spo2Points, setSpo2Points] = useState<SpO2TrendPoint[]>([]);
  const [lastPoint, setLastPoint] = useState<MedicalTrendLastPoint | null>(null);
  const [pendingLiveBpPoints, setPendingLiveBpPoints] = useState<BloodPressureTrendPoint[]>([]);
  const [pendingLiveGlucosePoints, setPendingLiveGlucosePoints] = useState<BloodGlucoseTrendPoint[]>([]);
  const [pendingLiveTempPoints, setPendingLiveTempPoints] = useState<TemperatureTrendPoint[]>([]);
  const [pendingLiveSpo2Points, setPendingLiveSpo2Points] = useState<SpO2TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailBpPoints, setDetailBpPoints] = useState<BloodPressureTrendPoint[]>([]);
  const [detailGlucosePoints, setDetailGlucosePoints] = useState<BloodGlucoseTrendPoint[]>([]);
  const [detailTempPoints, setDetailTempPoints] = useState<TemperatureTrendPoint[]>([]);
  const [detailSpo2Points, setDetailSpo2Points] = useState<SpO2TrendPoint[]>([]);
  const [exportingReport, setExportingReport] = useState(false);
  const liveReadings = useLiveReadings();
  const detailSlideAnim = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;

  const closeMetricDetail = useCallback(() => {
    if (!selectedMetric) return;
    try {
      detailSlideAnim.stopAnimation();
    } catch {}
    Animated.timing(detailSlideAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setSelectedMetric(null);
    });
  }, [detailSlideAnim, selectedMetric]);

  // Close detail overlay when user navigates away from Trends tab
  useEffect(() => {
    if (activeTab !== 'Trends' && selectedMetric) {
      closeMetricDetail();
    }
    if (activeTab !== 'Trends' && weightDetailOpen) {
      setWeightDetailOpen(false);
    }
  }, [activeTab, closeMetricDetail, selectedMetric, weightDetailOpen]);

  // Persisted fallbacks — shown when in-memory live readings are empty (e.g. after restart)
  const [persistedTempC, setPersistedTempC] = useState<number | null>(null);
  const [persistedTempTs, setPersistedTempTs] = useState<number>(0);
  const [persistedSpo2, setPersistedSpo2] = useState<number | null>(null);
  const [persistedPulse, setPersistedPulse] = useState<number | null>(null);
  const [persistedSpo2Ts, setPersistedSpo2Ts] = useState<number>(0);
  const bottomSpacerHeight = Layout.bottomTabHeight + Spacing.lg;
  const detailBottomSpacerHeight = Layout.bottomTabHeight + Spacing.sm;

  // History fallbacks fetched from DB — latest temp/SpO2 recorded, shown when no live reading
  const [historyTempC, setHistoryTempC] = useState<number | null>(null);
  const [historyTempTs, setHistoryTempTs] = useState<number>(0);
  const [historySpo2, setHistorySpo2] = useState<number | null>(null);
  const [historyPulse, setHistoryPulse] = useState<number | null>(null);
  const [historySpo2Ts, setHistorySpo2Ts] = useState<number>(0);

  const lastSeenBpLiveTsRef = useRef(0);
  const lastSeenGlucoseLiveTsRef = useRef(0);
  const lastSeenTempLiveTsRef = useRef(0);
  const lastSeenSpo2LiveTsRef = useRef(0);

  useEffect(() => {
    getActiveProfileId().then(setActiveProfileId);
    const unsubscribe = subscribeActiveProfileId((id) => {
      setActiveProfileId(id);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeProfileId) {
      setGoals([]);
      return;
    }
    getCachedGoals(activeProfileId).then(setGoals).catch(() => {});
  }, [activeProfileId]);

  useEffect(() => {
    if (!selectedMetric) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeMetricDetail();
      return true;
    });
    return () => sub.remove();
  }, [selectedMetric, closeMetricDetail]);

  useEffect(() => {
    if (selectedMetric) {
      setTrendDetailOverlayState(true, closeMetricDetail);
    } else {
      setTrendDetailOverlayState(false);
    }

    return () => {
      setTrendDetailOverlayState(false);
    };
  }, [closeMetricDetail, selectedMetric]);

  useEffect(() => {
    setBpPoints([]);
    setGlucosePoints([]);
    setTempPoints([]);
    setSpo2Points([]);
    setLatestDeviceByMetric({ bp: null, glucose: null, temp: null, spo2: null });
    setLastPoint(null);
    setHistoryTempC(null);
    setHistoryTempTs(0);
    setHistorySpo2(null);
    setHistoryPulse(null);
    setHistorySpo2Ts(0);
    setManualMetric(null);
    setManualForm(EMPTY_MANUAL_FORM);
    setManualError(null);
    setManualSubmitting(false);
    setPendingLiveBpPoints([]);
    setPendingLiveGlucosePoints([]);
    setPendingLiveTempPoints([]);
    setPendingLiveSpo2Points([]);
    setSelectedMetric(null);
    setDetailPeriod('Overall');
    lastSeenBpLiveTsRef.current = 0;
    lastSeenGlucoseLiveTsRef.current = 0;
    lastSeenTempLiveTsRef.current = 0;
    lastSeenSpo2LiveTsRef.current = 0;
  }, [activeProfileId]);

  // Load persisted temp / SpO2 whenever the active profile changes
  useEffect(() => {
    if (!activeProfileId) {
      setPersistedTempC(null);
      setPersistedTempTs(0);
      setPersistedSpo2(null);
      setPersistedPulse(null);
      setPersistedSpo2Ts(0);
      return;
    }
    loadPersistedLiveReadings(activeProfileId).then((saved) => {
      setPersistedTempC(saved.tempC ?? null);
      setPersistedTempTs(saved.tempTs ?? 0);
      setPersistedSpo2(saved.spo2 ?? null);
      setPersistedPulse(saved.pulse ?? null);
      setPersistedSpo2Ts(saved.spo2Ts ?? 0);
    });
  }, [activeProfileId]);

  useEffect(() => {
    let latestBp: BloodPressureTrendPoint | null = null;
    let latestGlucose: BloodGlucoseTrendPoint | null = null;
    let latestTemp: TemperatureTrendPoint | null = null;
    let latestSpo2Point: SpO2TrendPoint | null = null;
    let latestBpTs = 0;
    let latestGlucoseTs = 0;
    let latestTempTs = 0;
    let latestSpo2Ts = 0;

    for (const readingSet of liveReadings.values()) {
      const bp = readingSet?.bp;
      if (
        bp?.values &&
        typeof bp.values.sys === 'number' &&
        typeof bp.values.dia === 'number' &&
        bp.values.sys > 0 &&
        bp.values.dia > 0 &&
        Number(bp.ts) > 0
      ) {
        const tsMs = Number(bp.ts);
        if (tsMs >= latestBpTs) {
          latestBpTs = tsMs;
          latestBp = {
            ts: new Date(tsMs).toISOString(),
            ts_ms: tsMs,
            sys: Number(bp.values.sys),
            dia: Number(bp.values.dia),
          };
        }
      }

      const glucose = readingSet?.glucose;
      if (
        glucose?.values &&
        typeof glucose.values.mgdl === 'number' &&
        glucose.values.mgdl > 0 &&
        Number(glucose.ts) > 0
      ) {
        const tsMs = Number(glucose.ts);
        if (tsMs >= latestGlucoseTs) {
          latestGlucoseTs = tsMs;
          latestGlucose = {
            ts: new Date(tsMs).toISOString(),
            ts_ms: tsMs,
            mgdl: Number(glucose.values.mgdl),
          };
        }
      }

      const temp = readingSet?.temp;
      if (
        temp?.values &&
        (typeof temp.values.c === 'number' || typeof temp.values.celsius === 'number') &&
        Number(temp.values.c ?? temp.values.celsius) > 0 &&
        Number(temp.ts) > 0
      ) {
        const tsMs = Number(temp.ts);
        if (tsMs >= latestTempTs) {
          latestTempTs = tsMs;
          latestTemp = {
            ts: new Date(tsMs).toISOString(),
            ts_ms: tsMs,
            celsius: Number(temp.values.c ?? temp.values.celsius),
          };
        }
      }

      const spo2 = readingSet?.spo2;
      if (
        spo2?.values &&
        typeof spo2.values.spo2 === 'number' &&
        spo2.values.spo2 > 0 &&
        Number(spo2.ts) > 0
      ) {
        const tsMs = Number(spo2.ts);
        if (tsMs >= latestSpo2Ts) {
          latestSpo2Ts = tsMs;
          latestSpo2Point = {
            ts: new Date(tsMs).toISOString(),
            ts_ms: tsMs,
            spo2: Number(spo2.values.spo2),
            pulse: typeof spo2.values.pulse === 'number' && spo2.values.pulse > 0 ? Number(spo2.values.pulse) : null,
          };
        }
      }
    }

    if (latestBp && latestBpTs > lastSeenBpLiveTsRef.current) {
      lastSeenBpLiveTsRef.current = latestBpTs;
      setPendingLiveBpPoints((prev) => {
        const next = mergeAndSortBpPoints(prev, [latestBp as BloodPressureTrendPoint]);
        return next.slice(-MAX_PENDING_LIVE_POINTS);
      });
    }

    if (latestGlucose && latestGlucoseTs > lastSeenGlucoseLiveTsRef.current) {
      lastSeenGlucoseLiveTsRef.current = latestGlucoseTs;
      setPendingLiveGlucosePoints((prev) => {
        const next = mergeAndSortGlucosePoints(prev, [latestGlucose as BloodGlucoseTrendPoint]);
        return next.slice(-MAX_PENDING_LIVE_POINTS);
      });
    }

    if (latestTemp && latestTempTs > lastSeenTempLiveTsRef.current) {
      lastSeenTempLiveTsRef.current = latestTempTs;
      setPendingLiveTempPoints((prev) => {
        const next = mergeAndSortTempPoints(prev, [latestTemp as TemperatureTrendPoint]);
        return next.slice(-MAX_PENDING_LIVE_POINTS);
      });
    }

    if (latestSpo2Point && latestSpo2Ts > lastSeenSpo2LiveTsRef.current) {
      lastSeenSpo2LiveTsRef.current = latestSpo2Ts;
      setPendingLiveSpo2Points((prev) => {
        const next = mergeAndSortSpo2Points(prev, [latestSpo2Point as SpO2TrendPoint]);
        return next.slice(-MAX_PENDING_LIVE_POINTS);
      });
    }
  }, [liveReadings]);

  const fetchTrends = useCallback(async (profileId: number) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      setBpPoints([]);
      setGlucosePoints([]);
      setTempPoints([]);
      setSpo2Points([]);
      setLatestDeviceByMetric({ bp: null, glucose: null, temp: null, spo2: null });
      setLastPoint(null);
      setHistoryTempC(null);
      setHistoryTempTs(0);
      setHistorySpo2(null);
      setHistoryPulse(null);
      setHistorySpo2Ts(0);
      return;
    }

    const [trend, dailyTrend] = await Promise.all([
      getMedicalTrends(token, profileId, 'Overall'),
      getMedicalTrends(token, profileId, 'Daily').catch(() => null),
    ]);

    setLatestDeviceByMetric({
      bp: getLatestDeviceId(trend.latest_points?.bp) || getLatestDeviceId(dailyTrend?.latest_points?.bp),
      glucose: getLatestDeviceId(trend.latest_points?.glucose) || getLatestDeviceId(dailyTrend?.latest_points?.glucose),
      temp: getLatestDeviceId(trend.latest_points?.temp) || getLatestDeviceId(dailyTrend?.latest_points?.temp),
      spo2: getLatestDeviceId(trend.latest_points?.spo2) || getLatestDeviceId(dailyTrend?.latest_points?.spo2),
    });

    setBpPoints(Array.isArray(trend.bp_points) ? trend.bp_points : []);
    setGlucosePoints(Array.isArray(trend.glucose_points) ? trend.glucose_points : []);
    const tPoints: TemperatureTrendPoint[] = Array.isArray(trend.temp_points) ? trend.temp_points : [];
    const sPoints: SpO2TrendPoint[] = Array.isArray(trend.spo2_points) ? trend.spo2_points : [];
    setTempPoints(tPoints);
    setSpo2Points(sPoints);
    setLastPoint(
      (trend.last_point && typeof trend.last_point === 'object'
        ? trend.last_point
        : dailyTrend?.last_point && typeof dailyTrend.last_point === 'object'
          ? dailyTrend.last_point
          : null)
    );

    // Use the latest temp / spo2 from history as fallback when no live reading
    if (tPoints.length > 0) {
      const latest = tPoints[tPoints.length - 1];
      const latestMs = latest.ts_ms ?? parseUtcDate(latest.ts).getTime();
      if (Number.isFinite(latestMs) && latestMs > 0) {
        setHistoryTempC(Number(latest.celsius));
        setHistoryTempTs(latestMs);
      }
    } else {
      setHistoryTempC(null);
      setHistoryTempTs(0);
    }
    if (sPoints.length > 0) {
      const latest = sPoints[sPoints.length - 1];
      const latestMs = latest.ts_ms ?? parseUtcDate(latest.ts).getTime();
      if (Number.isFinite(latestMs) && latestMs > 0) {
        setHistorySpo2(Number(latest.spo2));
        setHistoryPulse(latest.pulse ?? null);
        setHistorySpo2Ts(latestMs);
      }
    } else {
      setHistorySpo2(null);
      setHistoryPulse(null);
      setHistorySpo2Ts(0);
    }
  }, []);

  // Fetch detail-specific trend data for the selected period from the backend
  const fetchDetailTrends = useCallback(async (profileId: number, period: Period) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;
    setDetailLoading(true);
    try {
      const trend = await getMedicalTrends(token, profileId, period);
      setDetailBpPoints(Array.isArray(trend.bp_points) ? trend.bp_points : []);
      setDetailGlucosePoints(Array.isArray(trend.glucose_points) ? trend.glucose_points : []);
      setDetailTempPoints(Array.isArray(trend.temp_points) ? trend.temp_points : []);
      setDetailSpo2Points(Array.isArray(trend.spo2_points) ? trend.spo2_points : []);
    } catch {
      setDetailBpPoints([]);
      setDetailGlucosePoints([]);
      setDetailTempPoints([]);
      setDetailSpo2Points([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Re-fetch when detail period changes
  useEffect(() => {
    if (!selectedMetric || !activeProfileId) return;
    let alive = true;
    fetchDetailTrends(activeProfileId, detailPeriod).then(() => {
      if (!alive) return;
    });
    return () => { alive = false; };
  }, [detailPeriod, selectedMetric, activeProfileId, fetchDetailTrends]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!activeProfileId) {
        setBpPoints([]);
        setGlucosePoints([]);
        setTempPoints([]);
        setSpo2Points([]);
        setLastPoint(null);
        return;
      }
      setLoading(true);
      try {
        if (alive) await fetchTrends(activeProfileId);
      } catch {
        if (!alive) return;
        setBpPoints([]);
        setGlucosePoints([]);
        setTempPoints([]);
        setSpo2Points([]);
        setLastPoint(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => { alive = false; };
  }, [activeProfileId, fetchTrends]);

  // Auto-refresh trends every 60 s while the screen is mounted
  useEffect(() => {
    if (!activeProfileId) return;
    const id = setInterval(() => {
      fetchTrends(activeProfileId).catch(() => undefined);
    }, 60_000);
    return () => clearInterval(id);
  }, [activeProfileId, fetchTrends]);

  // Refresh trends when a simulated reading is added
  useEffect(() => {
    if (!activeProfileId) return;
    return subscribeTrendsRefresh(() => {
      fetchTrends(activeProfileId).catch(() => undefined);
      getCachedGoals(activeProfileId).then(setGoals).catch(() => {});
    });
  }, [activeProfileId, fetchTrends]);

  useEffect(() => {
    if (!bpPoints.length) return;
    setPendingLiveBpPoints((prev) => prev.filter((p) => !pointExistsByTsAndValues(bpPoints, p, 2000)));
  }, [bpPoints]);

  useEffect(() => {
    if (!glucosePoints.length) return;
    setPendingLiveGlucosePoints((prev) => prev.filter((p) => !glucosePointExistsByTsAndValues(glucosePoints, p, 2000)));
  }, [glucosePoints]);

  useEffect(() => {
    if (!tempPoints.length) return;
    setPendingLiveTempPoints((prev) => prev.filter((point) => !tempPointExistsByTsAndValues(tempPoints, point, 2000)));
  }, [tempPoints]);

  useEffect(() => {
    if (!spo2Points.length) return;
    setPendingLiveSpo2Points((prev) => prev.filter((point) => !spo2PointExistsByTsAndValues(spo2Points, point, 2000)));
  }, [spo2Points]);

  const displayBpPoints = useMemo(
    () => mergeAndSortBpPoints(bpPoints, pendingLiveBpPoints),
    [bpPoints, pendingLiveBpPoints]
  );

  const displayGlucosePoints = useMemo(
    () => mergeAndSortGlucosePoints(glucosePoints, pendingLiveGlucosePoints),
    [glucosePoints, pendingLiveGlucosePoints]
  );

  const displayTempPoints = useMemo(
    () => mergeAndSortTempPoints(tempPoints, pendingLiveTempPoints),
    [tempPoints, pendingLiveTempPoints]
  );

  const displaySpo2Points = useMemo(
    () => mergeAndSortSpo2Points(spo2Points, pendingLiveSpo2Points),
    [spo2Points, pendingLiveSpo2Points]
  );

  // When live readings arrive, persist them so they survive restarts
  useEffect(() => {
    if (!activeProfileId) return;
    for (const readingSet of liveReadings.values()) {
      const temp = readingSet?.temp;
      const spo2 = readingSet?.spo2;
      if (temp?.values && Number(temp.values.c ?? temp.values.celsius) > 0) {
        const ts = Number(temp.ts || 0);
        if (ts > persistedTempTs) {
          const newTempC = Number(temp.values.c ?? temp.values.celsius);
          setPersistedTempC(newTempC);
          setPersistedTempTs(ts);
          savePersistedLiveReadings(activeProfileId, { tempC: newTempC, tempTs: ts }).catch(() => undefined);
        }
      }
      if (spo2?.values && typeof spo2.values.spo2 === 'number' && spo2.values.spo2 > 0) {
        const ts = Number(spo2.ts || 0);
        if (ts > persistedSpo2Ts) {
          const newSpo2 = Number(spo2.values.spo2);
          const newPulse = typeof spo2.values.pulse === 'number' && spo2.values.pulse > 0 ? spo2.values.pulse : null;
          setPersistedSpo2(newSpo2);
          setPersistedPulse(newPulse);
          setPersistedSpo2Ts(ts);
          savePersistedLiveReadings(activeProfileId, { spo2: newSpo2, pulse: newPulse ?? undefined, spo2Ts: ts }).catch(() => undefined);
        }
      }
    }
  }, [liveReadings, activeProfileId, persistedTempTs, persistedSpo2Ts]);

  // Extract latest temperature and SpO2 from live readings
  const { latestTempC, latestTempTs, latestSpo2, latestPulse, latestSpo2Ts } = useMemo(() => {
    let tempC: number | null = null;
    let tempTs = 0;
    let spo2: number | null = null;
    let pulse: number | null = null;
    let spo2Ts = 0;

    for (const readingSet of liveReadings.values()) {
      const tempReading = readingSet?.temp;
      if (tempReading?.values && Number(tempReading.values.c ?? tempReading.values.celsius) > 0) {
        const ts = Number(tempReading.ts || 0);
        if (ts >= tempTs) {
          tempTs = ts;
          tempC = Number(tempReading.values.c ?? tempReading.values.celsius);
        }
      }
      const spo2Reading = readingSet?.spo2;
      if (spo2Reading?.values && typeof spo2Reading.values.spo2 === 'number' && spo2Reading.values.spo2 > 0) {
        const ts = Number(spo2Reading.ts || 0);
        if (ts >= spo2Ts) {
          spo2Ts = ts;
          spo2 = spo2Reading.values.spo2;
          pulse = typeof spo2Reading.values.pulse === 'number' && spo2Reading.values.pulse > 0 ? spo2Reading.values.pulse : null;
        }
      }
    }
    return { latestTempC: tempC, latestTempTs: tempTs, latestSpo2: spo2, latestPulse: pulse, latestSpo2Ts: spo2Ts };
  }, [liveReadings]);

  const latestAvailableTempTs = latestTempTs || persistedTempTs || historyTempTs;
  const latestAvailableSpo2Ts = latestSpo2Ts || persistedSpo2Ts || historySpo2Ts;
  const latestAvailableTempC = latestTempC ?? persistedTempC ?? historyTempC;
  const latestAvailableSpo2 = latestSpo2 ?? persistedSpo2 ?? historySpo2;
  const latestAvailablePulse = latestAvailableSpo2 != null ? (latestPulse ?? persistedPulse ?? historyPulse) : null;

  const latestBpPoint = displayBpPoints.length > 0 ? displayBpPoints[displayBpPoints.length - 1] : null;
  const latestGlucosePoint = displayGlucosePoints.length > 0 ? displayGlucosePoints[displayGlucosePoints.length - 1] : null;
  const bpStatus = latestBpPoint ? evaluateBloodPressure({ sys: Number(latestBpPoint.sys), dia: Number(latestBpPoint.dia) }) : null;
  const glucoseStatus = latestGlucosePoint ? evaluateGlucose({ mgdl: Number(latestGlucosePoint.mgdl) }) : null;
  const tempStatus = latestAvailableTempC != null ? evaluateTemperature({ celsius: latestAvailableTempC }) : null;
  const spo2Status = latestAvailableSpo2 != null ? evaluateSpO2({ spo2: latestAvailableSpo2 }) : null;

  const bpTheme = statusTheme(bpStatus, lang);
  const glucoseTheme = statusTheme(glucoseStatus, lang);
  const tempTheme = statusTheme(tempStatus, lang);
  const spo2Theme = statusTheme(spo2Status, lang);

  // Detail-view scalar points (from backend period-specific fetch)
  const detailTempScalarPoints = useMemo<ScalarTrendPoint[]>(
    () => detailTempPoints.map((point) => ({
      ts: point.ts,
      ts_ms: point.ts_ms,
      value: Number(point.celsius),
    })),
    [detailTempPoints]
  );

  const detailSpo2ScalarPoints = useMemo<ScalarTrendPoint[]>(
    () => detailSpo2Points.map((point) => ({
      ts: point.ts,
      ts_ms: point.ts_ms,
      value: Number(point.spo2),
    })),
    [detailSpo2Points]
  );

  // Latest weight/BMI (fetched once) — feeds both the Weight & BMI tile and its
  // Health Advice row.
  const latestWeightBmi = useLatestWeightBmi(activeProfileId);

  const adviceRows = useMemo<AdviceRowModel[]>(() => {
    const bpPalette = advicePalette(levelFromHealthStatus(bpStatus));
    const glucosePalette = advicePalette(levelFromHealthStatus(glucoseStatus));
    const tempPalette = advicePalette(levelFromHealthStatus(tempStatus));
    const spo2Palette = advicePalette(levelFromHealthStatus(spo2Status));

    const bmi = latestWeightBmi?.bmi ?? null;
    const bmiStatus = bmi != null ? evaluateBmi(bmi) : null;
    const bmiPalette = advicePalette(levelFromHealthStatus(bmiStatus));

    // One advice row per overview metric, always shown (with a "no reading"
    // prompt when data is missing) so the section mirrors the metric grid.
    return [
      {
        key: 'bp-advice',
        icon: require('../../../../assets/android-res/drawable/pressure.png'),
        tint: bpPalette.tint,
        background: bpPalette.background,
        title: t(lang, 'blood_pressure'),
        body: buildAdviceBody('bp', bpStatus, latestBpPoint != null, lang),
      },
      {
        key: 'glucose-advice',
        icon: require('../../../../assets/android-res/drawable/glucose.png'),
        tint: glucosePalette.tint,
        background: glucosePalette.background,
        title: t(lang, 'blood_glucose'),
        body: buildAdviceBody('glucose', glucoseStatus, latestGlucosePoint != null, lang),
      },
      {
        key: 'temp-advice',
        icon: require('../../../../assets/android-res/drawable/temperature.png'),
        tint: tempPalette.tint,
        background: tempPalette.background,
        title: t(lang, 'temperature'),
        body: buildAdviceBody('temp', tempStatus, latestAvailableTempC != null, lang),
      },
      {
        key: 'spo2-advice',
        icon: require('../../../../assets/android-res/drawable/spo2.png'),
        tint: spo2Palette.tint,
        background: spo2Palette.background,
        title: t(lang, 'oxygen_level'),
        body: buildAdviceBody('spo2', spo2Status, latestAvailableSpo2 != null, lang),
      },
      {
        key: 'weight-advice',
        icon: require('../../../../assets/android-res/drawable/weight.png'),
        tint: bmiPalette.tint,
        background: bmiPalette.background,
        title: t(lang, 'weight_bmi_trend_title'),
        body: buildBmiAdviceBody(bmi, lang),
      },
    ];
  }, [
    bpStatus,
    glucoseStatus,
    tempStatus,
    spo2Status,
    latestBpPoint,
    latestGlucosePoint,
    latestAvailableTempC,
    latestAvailableSpo2,
    latestWeightBmi,
    lang,
  ]);

  const metricCards = useMemo(() => {
    const bpMeta = latestBpPoint
      ? `${t(lang, 'last_reading')}: ${formatRelativeTime(toPointTsMs(latestBpPoint), lang)}`
      : t(lang, 'no_reading_yet');
    const glucoseMeta = latestGlucosePoint
      ? `${t(lang, 'last_reading')}: ${formatRelativeTime(toPointTsMs(latestGlucosePoint), lang)}`
      : t(lang, 'no_reading_yet');
    const tempMeta = latestAvailableTempC != null && latestAvailableTempTs
      ? `${t(lang, 'last_reading')}: ${formatRelativeTime(latestAvailableTempTs, lang)}`
      : t(lang, 'no_reading_yet');
    const spo2Meta = latestAvailableSpo2 != null && latestAvailableSpo2Ts
      ? latestAvailablePulse != null
        ? `${Math.round(latestAvailablePulse)} bpm • ${formatRelativeTime(latestAvailableSpo2Ts, lang)}`
        : `${t(lang, 'last_reading')}: ${formatRelativeTime(latestAvailableSpo2Ts, lang)}`
      : t(lang, 'no_reading_yet');

    return {
      bp: {
        key: 'bp' as const,
        title: t(lang, 'blood_pressure'),
        value: latestBpPoint ? `${Math.round(latestBpPoint.sys)}/${Math.round(latestBpPoint.dia)}` : '--',
        unit: latestBpPoint ? 'mmHg' : undefined,
        icon: require('../../../../assets/android-res/drawable/pressure.png'),
        accentColor: bpTheme.color,
        badgeLabel: bpTheme.label,
        badgeTextColor: bpTheme.color,
        badgeBackgroundColor: bpTheme.bg,
        meta: bpMeta,
      },
      glucose: {
        key: 'glucose' as const,
        title: t(lang, 'blood_glucose'),
        value: latestGlucosePoint ? formatMeasurementNumber(Number(latestGlucosePoint.mgdl), 0) : '--',
        unit: latestGlucosePoint ? 'mg/dL' : undefined,
        icon: require('../../../../assets/android-res/drawable/glucose.png'),
        accentColor: glucoseTheme.color,
        badgeLabel: glucoseTheme.label,
        badgeTextColor: glucoseTheme.color,
        badgeBackgroundColor: glucoseTheme.bg,
        meta: glucoseMeta,
      },
      temp: {
        key: 'temp' as const,
        title: t(lang, 'temperature'),
        value: latestAvailableTempC != null ? formatMeasurementNumber(latestAvailableTempC, 1) : '--',
        unit: latestAvailableTempC != null ? '°C' : undefined,
        icon: require('../../../../assets/android-res/drawable/temperature.png'),
        accentColor: tempTheme.color,
        badgeLabel: tempTheme.label,
        badgeTextColor: tempTheme.color,
        badgeBackgroundColor: tempTheme.bg,
        meta: tempMeta,
      },
      spo2: {
        key: 'spo2' as const,
        title: 'SpO₂',
        value: latestAvailableSpo2 != null ? formatMeasurementNumber(latestAvailableSpo2, 0) : '--',
        unit: latestAvailableSpo2 != null ? '%' : undefined,
        icon: require('../../../../assets/android-res/drawable/spo2.png'),
        accentColor: spo2Theme.color,
        badgeLabel: spo2Theme.label,
        badgeTextColor: spo2Theme.color,
        badgeBackgroundColor: spo2Theme.bg,
        meta: spo2Meta,
      },
    };
  }, [
    bpTheme.bg,
    bpTheme.color,
    bpTheme.label,
    glucoseTheme.bg,
    glucoseTheme.color,
    glucoseTheme.label,
    tempTheme.bg,
    tempTheme.color,
    tempTheme.label,
    spo2Theme.bg,
    spo2Theme.color,
    spo2Theme.label,
    latestBpPoint,
    latestGlucosePoint,
    latestAvailableTempC,
    latestAvailableTempTs,
    latestAvailableSpo2,
    latestAvailableSpo2Ts,
    latestAvailablePulse,
    lang,
  ]);

  const selectedMetricHasData = useMemo(() => {
    if (!selectedMetric || detailLoading) return true; // assume data while loading
    if (selectedMetric === 'bp') return detailBpPoints.length > 0;
    if (selectedMetric === 'glucose') return detailGlucosePoints.length > 0;
    if (selectedMetric === 'temp') return detailTempPoints.length > 0;
    return detailSpo2Points.length > 0;
  }, [selectedMetric, detailBpPoints, detailGlucosePoints, detailTempPoints, detailSpo2Points, detailLoading]);

  const lastPointSummary = useMemo(() => getLastPointSummary(lastPoint, lang), [lastPoint, lang]);
  const shouldShowDetailLastPointCard = detailPeriod === 'Daily'
    && selectedMetric != null
    && !loading
    && !selectedMetricHasData
    && lastPointSummary != null
    && getLastPointMetric(lastPoint) === selectedMetric;

  const handleExportHealthReport = async () => {
    if (!activeProfileId || exportingReport) return;

    setExportingReport(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert(t(lang, 'report_export_failed'), t(lang, 'report_not_signed_in'));
        return;
      }

      const reportData = await getHealthReportData(token, activeProfileId);
      const html = buildHealthReportHtml(reportData, lang);

      const fileName = `health_report_profile_${activeProfileId}_${Date.now()}`;
      const pdf = await generatePDF({ html, fileName });
      if (!pdf?.filePath) {
        throw new Error('Failed to generate PDF file');
      }

      let savedPath = pdf.filePath;
      if (Platform.OS === 'android' && RNFS.DownloadDirectoryPath) {
        const targetPath = `${RNFS.DownloadDirectoryPath}/${fileName}.pdf`;
        try {
          await RNFS.copyFile(pdf.filePath, targetPath);
          savedPath = targetPath;
        } catch {
          savedPath = pdf.filePath;
        }
      }

      try {
        await Share.share(
          Platform.OS === 'android'
            ? { title: t(lang, 'report_title'), message: `file://${savedPath}` }
            : { title: t(lang, 'report_title'), url: `file://${savedPath}` }
        );
      } catch {
        // Keep save successful even if share sheet is not available
      }

      Alert.alert(t(lang, 'report_saved'), savedPath);
    } catch (error: any) {
      Alert.alert(t(lang, 'report_export_failed'), error?.message || 'Unable to export health report.');
    } finally {
      setExportingReport(false);
    }
  };

  const openManualEntry = useCallback((metric: DetailMetric) => {
    setManualMetric(metric);
    setManualForm(EMPTY_MANUAL_FORM);
    setManualError(null);
    setManualSubmitting(false);
  }, []);

  const closeManualEntry = useCallback(() => {
    if (manualSubmitting) return;
    setManualMetric(null);
    setManualError(null);
  }, [manualSubmitting]);

  const submitManualEntry = useCallback(async () => {
    if (!manualMetric || !activeProfileId || manualSubmitting) return;

    let preferredDeviceId: string | null = null;
    try {
      const raw = await AsyncStorage.getItem(KEY_HOME_PREFERRED_DEVICE_BY_KIND);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const kind = METRIC_TO_MAIN_KIND[manualMetric];
          const candidate = parsed[kind];
          if (typeof candidate === 'string' && candidate.trim()) {
            preferredDeviceId = candidate.trim();
          }
        }
      }
    } catch {
      // ignore invalid preference payloads and continue with fallback
    }

    let deviceId = preferredDeviceId || latestDeviceByMetric[manualMetric];

    if (!deviceId) {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          const response = await fetch(`${API_BASE_URL}/users/me/devices`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const json = await response.json();
            const devices = Array.isArray(json?.devices) ? json.devices : [];
            const matched = devices.find((device: any) => {
              if (!deviceMatchesManualMetric(manualMetric, device)) return false;
              const id =
                typeof device?.device_id === 'string' ? device.device_id.trim() : '';
              return id.length > 0;
            });
            if (matched?.device_id) {
              deviceId = String(matched.device_id).trim();
            }
          }
        }
      } catch {
        // Keep current UX; fallback failed so existing no-device validation applies.
      }
    }

    if (!deviceId) {
      setManualError(t(lang, 'manual_entry_no_device'));
      return;
    }

    let snapshot: Record<string, any>;
    let alertValues: Record<string, number> = {};
    let alertStatus: HealthStatusLevel | null = null;
    if (manualMetric === 'bp') {
      const sys = parseInputNumber(manualForm.systolic);
      const dia = parseInputNumber(manualForm.diastolic);
      const pulse = parseInputNumber(manualForm.pulse);
      if (sys == null || dia == null || sys <= 0 || dia <= 0) {
        setManualError(t(lang, 'manual_entry_invalid_bp'));
        return;
      }
      snapshot = {
        type: 'bp',
        sys: Math.round(sys),
        dia: Math.round(dia),
      };
      if (pulse != null && pulse > 0) snapshot.pulse = Math.round(pulse);
      alertValues = {
        sys: Math.round(sys),
        dia: Math.round(dia),
        ...(pulse != null && pulse > 0 ? { pulse: Math.round(pulse) } : {}),
      };
      alertStatus = evaluateBloodPressure({
        sys: alertValues.sys,
        dia: alertValues.dia,
        ...(alertValues.pulse != null ? { pulse: alertValues.pulse } : {}),
      });
    } else if (manualMetric === 'glucose') {
      const glucose = parseInputNumber(manualForm.glucose);
      if (glucose == null || glucose <= 0) {
        setManualError(t(lang, 'manual_entry_invalid_glucose'));
        return;
      }
      const mgdl = Math.round(glucose);
      snapshot = { type: 'glucose', mgdl };
      alertValues = { mgdl };
      alertStatus = evaluateGlucose({ mgdl });
    } else if (manualMetric === 'temp') {
      const temperature = parseInputNumber(manualForm.temperature);
      if (temperature == null || temperature <= 0 || temperature > 60) {
        setManualError(t(lang, 'manual_entry_invalid_temp'));
        return;
      }
      const celsius = Number(temperature.toFixed(1));
      snapshot = { type: 'temp', celsius };
      alertValues = { celsius };
      alertStatus = evaluateTemperature({ celsius });
    } else {
      const spo2 = parseInputNumber(manualForm.spo2);
      const pulse = parseInputNumber(manualForm.spo2Pulse);
      if (spo2 == null || spo2 <= 0 || spo2 > 100) {
        setManualError(t(lang, 'manual_entry_invalid_spo2'));
        return;
      }
      snapshot = { type: 'spo2', spo2: Math.round(spo2) };
      if (pulse != null && pulse > 0) snapshot.pulse = Math.round(pulse);
      alertValues = {
        spo2: Math.round(spo2),
        ...(pulse != null && pulse > 0 ? { pulse: Math.round(pulse) } : {}),
      };
      alertStatus = evaluateSpO2({
        spo2: alertValues.spo2,
        ...(alertValues.pulse != null ? { pulse: alertValues.pulse } : {}),
      });
    }

    setManualError(null);
    setManualSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setManualError(t(lang, 'report_not_signed_in'));
        return;
      }

      await sendMedicalData(token, {
        device_id: deviceId,
        profile_id: activeProfileId,
        ts: Date.now(),
        snapshot,
      });

      const consentSnapshot = getProfileConsentsSnapshot(activeProfileId);
      if (consentSnapshot?.consent_granted !== false && alertStatus) {
        const severity = healthStatusToSeverity(alertStatus);
        const title = getAlertTitle(manualMetric, alertStatus, lang);
        const message = getAlertMessage(manualMetric, alertStatus, alertValues, lang);
        const reading = formatReadingText(manualMetric, alertValues);
        const deviceName = getDeviceNameForType(manualMetric);

        const alert = await addAlert({
          severity,
          title,
          message,
          deviceName,
          deviceId,
          readingType: manualMetric,
          reading,
          values: alertValues,
          timestamp: Date.now(),
          profileId: activeProfileId,
        });

        if (alert) {
          sendAlertNotification(severity, title, message).catch(() => undefined);
          refreshBadge().catch(() => undefined);

          (async () => {
            try {
              const loc = await getCurrentPosition();
              await simulateLineNotify({
                profileId: activeProfileId,
                severity,
                eventType: 'Alert',
                deviceName,
                payload: {
                  severity,
                  title,
                  message,
                  reading,
                  values: alertValues,
                  status: alertStatus,
                },
                ...(loc ? { lat: loc.lat, lng: loc.lng } : {}),
              });
            } catch (lineError: any) {
              console.log('[TrendScreen] LINE notify failed for manual entry:', lineError?.message || lineError);
            }
          })().catch(() => undefined);
        }
      }

      closeManualEntry();
      emitTrendsRefresh();
      await fetchTrends(activeProfileId);
      if (selectedMetric) {
        await fetchDetailTrends(activeProfileId, detailPeriod);
      }
    } catch (error: any) {
      setManualError(error?.message || t(lang, 'report_export_failed'));
    } finally {
      setManualSubmitting(false);
    }
  }, [
    manualMetric,
    activeProfileId,
    manualSubmitting,
    latestDeviceByMetric,
    lang,
    manualForm,
    closeManualEntry,
    fetchTrends,
    selectedMetric,
    fetchDetailTrends,
    detailPeriod,
  ]);

  const openMetricDetail = useCallback((metric: DetailMetric) => {
    setSelectedMetric(metric);
    setDetailPeriod('Overall');
    try {
      detailSlideAnim.stopAnimation();
    } catch {}
    detailSlideAnim.setValue(1);
    requestAnimationFrame(() => {
      Animated.timing(detailSlideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [detailSlideAnim]);

  useEffect(() => {
    if (activeTab !== 'Trends') return;
    const pending = takePendingTrendDetailRequest();
    if (pending) openMetricDetail(pending);
  }, [activeTab, openMetricDetail]);

  useEffect(() => {
    const unsub = subscribeTrendDetailRequest((metric) => {
      if (activeTab !== 'Trends') return;
      openMetricDetail(metric);
      takePendingTrendDetailRequest();
    });
    return unsub;
  }, [activeTab, openMetricDetail]);

  const selectedMetricCard = selectedMetric ? metricCards[selectedMetric] : null;
  const overviewCards = [metricCards.bp, metricCards.glucose, metricCards.temp, metricCards.spo2];
  const overviewRows = [
    overviewCards.slice(0, 2),
    overviewCards.slice(2, 4),
  ];

  const renderDetailChart = () => {
    if (!selectedMetric) return null;
    const isDetailLoading = detailLoading || loading;

    const bpGoal = goals.find(
      (g) => String(g.status).toLowerCase() === 'active' &&
        String(g.goal_type).toLowerCase().includes('blood pressure') &&
        typeof g.target?.systolic === 'number' &&
        typeof g.target?.diastolic === 'number',
    );
    const glucoseGoal = goals.find(
      (g) => String(g.status).toLowerCase() === 'active' &&
        String(g.goal_type).toLowerCase().includes('glucose') &&
        typeof g.target?.value === 'number',
    );

    if (selectedMetric === 'bp') {
      return (
        <BloodPressureTrendCard
          points={detailBpPoints}
          period={detailPeriod}
          loading={isDetailLoading}
          goal={bpGoal ? { systolic: bpGoal.target.systolic, diastolic: bpGoal.target.diastolic } : undefined}
        />
      );
    }

    if (selectedMetric === 'glucose') {
      return (
        <BloodGlucoseTrendCard
          points={detailGlucosePoints}
          period={detailPeriod}
          loading={isDetailLoading}
          goal={glucoseGoal ? { value: glucoseGoal.target.value } : undefined}
        />
      );
    }

    if (selectedMetric === 'temp') {
      return (
        <ScalarTrendCard
          title={t(lang, 'temperature')}
          points={detailTempScalarPoints}
          period={detailPeriod}
          loading={isDetailLoading}
          unit="°C"
          icon={require('../../../../assets/android-res/drawable/temperature.png')}
          iconTint={tempTheme.color}
          iconColors={[`${tempTheme.color}1A`, Colors.surface]}
          lineColor={tempTheme.color}
          statusLabel={tempTheme.label}
          statusColor={tempTheme.color}
          noDataText={t(lang, 'no_trend_data_period')}
          latestMeta={metricCards.temp.meta}
          thresholds={[
            { key: 'temp-low', value: 35.5, label: `${t(lang, 'chart_line_low')} 35.5`, color: Colors.warning },
            { key: 'temp-normal', value: 36.1, label: `${t(lang, 'chart_line_normal')} 36.1`, color: Colors.success },
            { key: 'temp-high', value: 37.7, label: `${t(lang, 'chart_line_high')} 37.7`, color: Colors.danger },
          ]}
        />
      );
    }

    return (
      <ScalarTrendCard
        title="SpO₂"
        points={detailSpo2ScalarPoints}
        period={detailPeriod}
        loading={isDetailLoading}
        unit="%"
        icon={require('../../../../assets/android-res/drawable/spo2.png')}
        iconTint={spo2Theme.color}
        iconColors={[`${spo2Theme.color}1A`, Colors.surface]}
        lineColor={spo2Theme.color}
        statusLabel={spo2Theme.label}
        statusColor={spo2Theme.color}
        noDataText={t(lang, 'no_trend_data_period')}
        latestMeta={metricCards.spo2.meta}
        valueFormatter={(value) => formatMeasurementNumber(value, 0)}
        thresholds={[
          { key: 'spo2-low', value: 90, label: `${t(lang, 'chart_line_low')} 90`, color: Colors.danger },
          { key: 'spo2-normal', value: 95, label: `${t(lang, 'chart_line_normal')} 95`, color: Colors.warning },
          { key: 'spo2-good', value: 98, label: `${t(lang, 'chart_line_good')} 98`, color: Colors.success },
        ]}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!activeProfileId ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>{t(lang, 'no_active_selected')}</Text>
            <Text style={styles.emptyStateBody}>{t(lang, 'go_select_profile')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.introBlock}>
              <Text style={styles.introTitle}>{t(lang, 'trend_overview')}</Text>
              <Text style={styles.introSubtitle}>{t(lang, 'trend_overview_hint')}</Text>
            </View>

            <View style={styles.metricGrid}>
              {overviewRows.map((row, rowIndex) => (
                <View
                  key={`overview-row-${rowIndex}`}
                  style={[
                    styles.metricRow,
                    rowIndex === overviewRows.length - 1 && styles.metricRowLast,
                  ]}
                >
                  {row.map((card, cardIndex) => (
                    <View
                      key={card.key}
                      style={[
                        styles.metricTileWrap,
                        cardIndex === 0 && row.length > 1 && styles.metricTileWrapLeading,
                      ]}
                    >
                      <TrendMetricTile
                        title={card.title}
                        value={card.value}
                        unit={card.unit}
                        icon={card.icon}
                        accentColor={card.accentColor}
                        badgeLabel={card.badgeLabel}
                        badgeTextColor={card.badgeTextColor}
                        badgeBackgroundColor={card.badgeBackgroundColor}
                        meta={card.meta}
                        onPress={() => openMetricDetail(card.key)}
                      />
                    </View>
                  ))}
                </View>
              ))}

              {/* Full-width Weight & Body Composition card below the four device
                  metrics. */}
              <View style={[styles.metricRow, styles.metricRowLast, { marginTop: Spacing.md }]}>
                <View style={styles.metricTileWrap}>
                  <WeightBmiTile latest={latestWeightBmi} onPress={() => setWeightDetailOpen(true)} />
                </View>
              </View>
            </View>

            <View style={styles.summarySection}>
              <OverallTrendChartCard
                bpPoints={displayBpPoints}
                glucosePoints={displayGlucosePoints}
                tempPoints={displayTempPoints}
                spo2Points={displaySpo2Points}
                loading={loading}
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t(lang, 'health_advice')}</Text>
            </View>
            <View style={styles.adviceSection}>
              <AdviceCard rows={adviceRows} onExport={handleExportHealthReport} />
            </View>
          </>
        )}
        <View style={[styles.bottomSpacer, { height: bottomSpacerHeight }]} />
      </ScrollView>
      {selectedMetric && selectedMetricCard ? (
        <Animated.View
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
          needsOffscreenAlphaCompositing
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.background },
            { transform: [{ translateY: detailSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, screenHeight] }) }] },
          ]}
        >
          <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, styles.content]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailHeader}>
                <View style={styles.detailHeaderCopy}>
                  <Text style={styles.detailOverline}>{t(lang, 'health_trends')}</Text>
                  <Text style={styles.detailTitle}>{selectedMetricCard.title}</Text>
                  <Text style={styles.detailSubtitle}>{t(lang, 'time_period')}</Text>
                </View>
                <Pressable style={styles.backButton} onPress={closeMetricDetail}>
                  <Text style={styles.backButtonText}>{t(lang, 'back')}</Text>
                </Pressable>
              </View>

              <View style={styles.detailHero}>
                <TrendMetricTile
                  title={selectedMetricCard.title}
                  value={selectedMetricCard.value}
                  unit={selectedMetricCard.unit}
                  icon={selectedMetricCard.icon}
                  accentColor={selectedMetricCard.accentColor}
                  badgeLabel={selectedMetricCard.badgeLabel}
                  badgeTextColor={selectedMetricCard.badgeTextColor}
                  badgeBackgroundColor={selectedMetricCard.badgeBackgroundColor}
                  meta={selectedMetricCard.meta}
                  actionText={t(lang, 'tap_manual_entry')}
                  onActionPress={() => openManualEntry(selectedMetric)}
                />
              </View>

              <View style={styles.timePeriodCard}>
                <View style={styles.timeHeaderRow}>
                  <Text style={styles.timeTitle}>{t(lang, 'time_period')}</Text>
                  <Image
                    source={require('../../../../assets/android-res/drawable/calendar.png')}
                    style={styles.calendarIcon}
                    resizeMode="contain"
                  />
                </View>
                <PeriodSwitch value={detailPeriod} onChange={setDetailPeriod} />
              </View>

              <View style={[
                styles.detailChart,
                !shouldShowDetailLastPointCard && styles.detailSectionLast,
              ]}>{renderDetailChart()}</View>
              {shouldShowDetailLastPointCard ? (
                <View style={[styles.detailFallback, styles.detailSectionLast]}>
                  <LastPointCard summary={lastPointSummary} />
                </View>
              ) : null}
              <View style={[styles.bottomSpacer, { height: detailBottomSpacerHeight }]} />
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      ) : null}
      <WeightDetailOverlay
        visible={weightDetailOpen}
        onClose={() => setWeightDetailOpen(false)}
        profileId={activeProfileId}
        latest={latestWeightBmi}
      />
      <DialogFrame
        visible={manualMetric != null}
        onRequestClose={closeManualEntry}
        disableBackdropClose={manualSubmitting}
      >
        <Text style={styles.manualDialogTitle}>{t(lang, 'manual_entry_title')}</Text>
        <Text style={styles.manualDialogSubtitle}>
          {manualMetric ? t(lang, `manual_entry_hint_${manualMetric}`) : ''}
        </Text>

        {manualMetric === 'bp' ? (
          <>
            <View style={styles.manualInputRow}>
              <View style={[styles.manualInputWrap, styles.manualInputLeading]}>
                <Text>{t(lang, 'manual_entry_systolic')}</Text>
                <TextInput
                  value={manualForm.systolic}
                  onChangeText={(s) => setManualForm((prev) => ({ ...prev, systolic: s }))}
                  style={styles.manualInput}
                  placeholder={t(lang, 'manual_entry_systolic_placeholder')}
                  keyboardType="numeric"
                  editable={!manualSubmitting}
                />
              </View>
              <View style={styles.manualInputWrap}>
                <Text>{t(lang, 'manual_entry_diastolic')}</Text>
                <TextInput
                  value={manualForm.diastolic}
                  onChangeText={(s) => setManualForm((prev) => ({ ...prev, diastolic: s }))}
                  style={styles.manualInput}
                  placeholder={t(lang, 'manual_entry_diastolic_placeholder')}
                  keyboardType="numeric"
                  editable={!manualSubmitting}
                />
              </View>
            </View>
            <View style={styles.manualInputWrap}>
              <Text>{t(lang, 'manual_entry_pulse_optional')}</Text>
              <TextInput
                value={manualForm.pulse}
                onChangeText={(s) => setManualForm((prev) => ({ ...prev, pulse: s }))}
                style={styles.manualInput}
                placeholder={t(lang, 'manual_entry_pulse_placeholder')}
                keyboardType="numeric"
                editable={!manualSubmitting}
              />
            </View>
          </>
        ) : null}

        {manualMetric === 'glucose' ? (
          <View style={styles.manualInputWrap}>
            <Text>{t(lang, 'manual_entry_glucose')}</Text>
            <TextInput
              value={manualForm.glucose}
              onChangeText={(s) => setManualForm((prev) => ({ ...prev, glucose: s }))}
              style={styles.manualInput}
              placeholder={t(lang, 'manual_entry_glucose_placeholder')}
              keyboardType="numeric"
              editable={!manualSubmitting}
            />
          </View>
        ) : null}

        {manualMetric === 'temp' ? (
          <View style={styles.manualInputWrap}>
            <Text>{t(lang, 'manual_entry_temperature')}</Text>
            <TextInput
              value={manualForm.temperature}
              onChangeText={(s) => setManualForm((prev) => ({ ...prev, temperature: s }))}
              style={styles.manualInput}
              placeholder={t(lang, 'manual_entry_temperature_placeholder')}
              keyboardType="decimal-pad"
              editable={!manualSubmitting}
            />
          </View>
        ) : null}

        {manualMetric === 'spo2' ? (
          <>
            <View style={styles.manualInputWrap}>
              <Text>{t(lang, 'manual_entry_spo2')}</Text>
              <TextInput
                value={manualForm.spo2}
                onChangeText={(s) => setManualForm((prev) => ({ ...prev, spo2: s }))}
                style={styles.manualInput}
                placeholder={t(lang, 'manual_entry_spo2_placeholder')}
                keyboardType="numeric"
                editable={!manualSubmitting}
              />
            </View>
            <View style={styles.manualInputWrap}>
              <Text>{t(lang, 'manual_entry_pulse_optional')}</Text>
              <TextInput
                value={manualForm.spo2Pulse}
                onChangeText={(s) => setManualForm((prev) => ({ ...prev, spo2Pulse: s }))}
                style={styles.manualInput}
                placeholder={t(lang, 'manual_entry_pulse_placeholder')}
                keyboardType="numeric"
                editable={!manualSubmitting}
              />
            </View>
          </>
        ) : null}

        {manualError ? <Text style={styles.manualError}>{manualError}</Text> : null}

        <View style={styles.manualDialogActions}>
          <Pressable
            style={styles.manualDialogSecondaryButton}
            onPress={closeManualEntry}
            disabled={manualSubmitting}
          >
            <Text style={styles.manualDialogSecondaryText}>{t(lang, 'cancel')}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.manualDialogPrimaryButton,
              manualSubmitting ? styles.manualDialogButtonDisabled : null,
            ]}
            onPress={submitManualEntry}
            disabled={manualSubmitting}
          >
            <Text style={styles.manualDialogPrimaryText}>
              {manualSubmitting ? t(lang, 'saving') : t(lang, 'save')}
            </Text>
          </Pressable>
        </View>
      </DialogFrame>
    </SafeAreaView>
  );
});

export default TrendScreen;
