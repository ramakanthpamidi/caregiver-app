import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

import type { CachedGoal } from '../storage/goalCache';

type Props = {
  goal: CachedGoal;
  onPress?: () => void;
  showSyncing?: boolean;
  progressOverride?: number | null;
};

function normalizeGoalTypeLabel(value: any): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const s = raw.toLowerCase();
  if (s === 'pressure' || s === 'blood pressure' || s === 'blood_pressure' || s === 'bloodpressure') return 'Blood pressure';
  if (s === 'glucose' || s === 'blood glucose' || s === 'blood glucose level' || s === 'blood_glucose' || s === 'bloodglucose') {
    return 'Blood glucose level';
  }
  if (s === 'weight') return 'Weight';
  if (s === 'height') return 'Height';
  if (s === 'bmi') return 'BMI';
  return raw;
}

function formatTarget(target: any): string {
  if (!target) return '';
  if (typeof target === 'string') return target;
  if (typeof target === 'object') {
    if (target.value !== undefined) {
      const unit = target.unit ? ` ${target.unit}` : '';
      return `${target.value}${unit}`;
    }
    if (target.systolic !== undefined || target.diastolic !== undefined) {
      const s = target.systolic !== undefined ? String(target.systolic) : '?';
      const d = target.diastolic !== undefined ? String(target.diastolic) : '?';
      return `${s}/${d}`;
    }
    if (target.min !== undefined || target.max !== undefined) {
      const min = target.min !== undefined ? String(target.min) : '?';
      const max = target.max !== undefined ? String(target.max) : '?';
      const unit = target.unit ? ` ${target.unit}` : '';
      return `${min}–${max}${unit}`;
    }
  }
  return '';
}

function computeProgressPercent(goal: CachedGoal): number {
  const status = String(goal.status || '').trim().toLowerCase();
  if (status === 'completed') return 100;
  if (status === 'archived') return 0;

  const start = goal.start_date ? new Date(`${goal.start_date}T00:00:00Z`).getTime() : NaN;
  const end = goal.end_date ? new Date(`${goal.end_date}T00:00:00Z`).getTime() : NaN;
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    const now = Date.now();
    const clamped = Math.min(end, Math.max(start, now));
    const pct = ((clamped - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  return 0;
}

const GoalCard: React.FC<Props> = ({ goal, onPress, showSyncing = true, progressOverride = null }) => {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  const isPendingSync = goal.local_only || Number(goal.id) < 0;
  const progress = typeof progressOverride === 'number' && Number.isFinite(progressOverride)
    ? Math.max(0, Math.min(100, Math.round(progressOverride)))
    : computeProgressPercent(goal);

  const subtitle = (() => {
    const desc = (goal.description || '').toString().trim();
    if (desc) return desc;
    const goalType = normalizeGoalTypeLabel(goal.goal_type);
    const targetText = formatTarget(goal.target);
    if (goalType && targetText) return `${goalType} • Target ${targetText}`;
    if (goalType) return goalType;
    if (targetText) return `Target ${targetText}`;
    return 'Health goal';
  })();

  return (
    <Wrapper style={styles.container} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Image
          source={require('../../../../assets/android-res/drawable/goal.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>

      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>
          {goal.title || 'Goal'}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>

        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>

        {showSyncing && isPendingSync ? (
          <View style={styles.syncPill}>
            <Text style={styles.syncPillText}>Syncing…</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.chevronWrap}>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  icon: {
    width: 36,
    height: 36,
  },
  left: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 10, fontWeight: '500' },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressTrack: {
    flex: 1,
    height: 7,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 999,
  },
  progressText: { fontSize: 14, fontWeight: '900', color: '#6b7280', minWidth: 40, textAlign: 'right' },
  syncPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#fffbeb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  syncPillText: { fontSize: 12, fontWeight: '900', color: '#f59e0b' },
  chevronWrap: { paddingLeft: 10, justifyContent: 'center' },
  chevron: { fontSize: 20, color: '#9ca3af', fontWeight: '300' },
});

export default GoalCard;
