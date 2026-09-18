import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getMedicalDataRaw } from '../../profiles/api/profileApi';
import { t } from '../../../shared/i18n';
import type { HealthStatusLevel } from '../../../shared/lib/healthThresholds';

// Fallback height (cm) used for BMI when a profile has no height recorded.
export const DEFAULT_HEIGHT_CM = 160;

// Full body-composition readout from the AILink scale (all optional beyond kg).
export type LatestWeightBmi = {
  kg: number;
  bmi: number | null;
  ts: number;
  fatPct?: number | null;
  musclePct?: number | null;
  waterPct?: number | null;
  proteinPct?: number | null;
  visceralFat?: number | null;
  bmr?: number | null;
  boneMassKg?: number | null;
  bodyAge?: number | null;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toMs(ts: unknown): number {
  const n = Number(ts);
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n; // seconds → ms
  const parsed = Date.parse(String(ts ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSnapshot(input: any): Record<string, any> | null {
  if (!input) return null;
  if (typeof input === 'object') return input as Record<string, any>;
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch { return null; }
  }
  return null;
}

/**
 * Fetches the latest {type:'weight'} time-series medical event for a profile.
 * Shared by the Trends Weight & BMI tile and its Health Advice row so the data
 * is fetched once per screen.
 */
export function useLatestWeightBmi(
  profileId: number | null,
  refreshKey?: number,
): LatestWeightBmi | null {
  const [latest, setLatest] = React.useState<LatestWeightBmi | null>(null);

  React.useEffect(() => {
    if (profileId == null) {
      setLatest(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;
        const rows = await getMedicalDataRaw(token, profileId, { limit: 100 });
        let best: LatestWeightBmi | null = null;
        for (const row of rows) {
          const snap = parseSnapshot((row as any)?.snapshot);
          if (!snap || String(snap.type).toLowerCase() !== 'weight') continue;
          const kg = num(snap.kg ?? snap.weight ?? snap.weight_kg);
          if (kg == null) continue;
          const ts = toMs((row as any).ts);
          if (!best || ts > best.ts) {
            best = {
              kg,
              bmi: num(snap.bmi),
              ts,
              fatPct: num(snap.fat),
              musclePct: num(snap.muscle),
              waterPct: num(snap.water),
              proteinPct: num(snap.protein),
              visceralFat: num(snap.visceral),
              bmr: num(snap.bmr),
              boneMassKg: num(snap.bone),
              bodyAge: num(snap.bodyAge),
            };
          }
        }
        if (alive) setLatest(best);
      } catch {
        if (alive) setLatest(null);
      }
    })();
    return () => { alive = false; };
  }, [profileId, refreshKey]);

  return latest;
}

export type WeightPoint = { ts: number; kg: number; bmi: number | null };

/** Full weight/BMI history (sorted oldest→newest) for the detail/history view. */
export function useWeightBmiHistory(
  profileId: number | null,
  refreshKey?: number,
): WeightPoint[] {
  const [points, setPoints] = React.useState<WeightPoint[]>([]);

  React.useEffect(() => {
    if (profileId == null) {
      setPoints([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;
        const rows = await getMedicalDataRaw(token, profileId, { limit: 200 });
        const parsed: WeightPoint[] = [];
        for (const row of rows) {
          const snap = parseSnapshot((row as any)?.snapshot);
          if (!snap || String(snap.type).toLowerCase() !== 'weight') continue;
          const kg = num(snap.kg ?? snap.weight ?? snap.weight_kg);
          if (kg == null) continue;
          parsed.push({ ts: toMs((row as any).ts), kg, bmi: num(snap.bmi) });
        }
        parsed.sort((a, b) => a.ts - b.ts);
        if (alive) setPoints(parsed);
      } catch {
        if (alive) setPoints([]);
      }
    })();
    return () => { alive = false; };
  }, [profileId, refreshKey]);

  return points;
}

// WHO BMI classification mapped to the app's 4 severity levels (matches Home).
export function evaluateBmi(bmi: number): HealthStatusLevel {
  if (bmi < 16 || bmi >= 35) return 'Critical';
  if (bmi < 18.5 || bmi >= 30) return 'Warning';
  if (bmi >= 25) return 'Good';
  return 'Excellent';
}

export function bmiCategoryKey(bmi: number): string {
  if (bmi < 18.5) return 'bmi_underweight';
  if (bmi < 25) return 'bmi_normal';
  if (bmi < 30) return 'bmi_overweight';
  return 'bmi_obese';
}

export function buildBmiAdviceBody(bmi: number | null, lang: 'en' | 'th'): string {
  if (bmi == null) return t(lang, 'bmi_advice_none');
  if (bmi < 18.5) return t(lang, 'bmi_advice_under');
  if (bmi < 25) return t(lang, 'bmi_advice_normal');
  if (bmi < 30) return t(lang, 'bmi_advice_over');
  return t(lang, 'bmi_advice_obese');
}
