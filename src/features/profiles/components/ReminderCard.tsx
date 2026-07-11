import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

import type { CachedReminder } from '../storage/reminderCache';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t as translate } from '../../../shared/i18n';

type Props = {
  reminder: CachedReminder;
  onPress?: () => void;
  showSyncing?: boolean;
};

function formatTime12h(timeOfDay: string) {
  const m = String(timeOfDay || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return timeOfDay || '';
  const hh = Number(m[1]);
  const mm = m[2];
  if (!Number.isFinite(hh)) return timeOfDay || '';
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm} ${ampm}`;
}

function normalizeRepeatType(repeatType: any): 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Custom' {
  const s = String(repeatType || '').trim().toLowerCase();
  if (s === 'none') return 'None';
  if (s === 'daily') return 'Daily';
  if (s === 'weekly') return 'Weekly';
  if (s === 'monthly') return 'Monthly';
  if (s === 'custom') return 'Custom';
  return 'Weekly';
}

function normalizeByWeekdayToMon1Sun7(input: any): number[] {
  let rawArr: any[] = [];
  if (Array.isArray(input)) {
    rawArr = input;
  } else if (typeof input === 'string') {
    const raw = input.trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) rawArr = parsed;
      } catch {
        // ignore
      }
    }
    if (rawArr.length === 0 && raw.length > 0) {
      rawArr = raw.split(',').map((s) => s.trim());
    }
  }

  const arr: number[] = rawArr.map((v: any) => Number(v)).filter((n: any) => Number.isFinite(n));
  // Accept either 0-6 (Sun=0) or 1-7 (Mon=1..Sun=7)
  const toMon1Sun7 = (v: number) => {
    if (v >= 1 && v <= 7) return v;
    if (v >= 0 && v <= 6) return v === 0 ? 7 : v;
    return null;
  };
  const mapped = arr.map(toMon1Sun7).filter((v: any) => v !== null) as number[];
  const unique = [...new Set(mapped)];
  unique.sort((a, b) => a - b);
  return unique;
}

function weekdayLabelMon1Sun7(day: number, lang: 'en' | 'th'): string {
  const enNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const thNames = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const names = lang === 'th' ? thNames : enNames;
  if (day >= 1 && day <= 7) return names[day - 1];
  return String(day);
}

function repeatDisplay(reminder: CachedReminder, lang: 'en' | 'th'): { main: string; detail?: string } {
  const rtype = normalizeRepeatType(reminder.repeat_type);
  if (rtype === 'None') return { main: translate(lang, 'repeat_once') };
  if (rtype === 'Daily') return { main: translate(lang, 'repeat_every_day') };
  if (rtype === 'Monthly') return { main: translate(lang, 'repeat_every_month') };

  if (rtype === 'Weekly') {
    let rule: any = reminder.repeat_rule as any;
    if (typeof rule === 'string') {
      const raw = rule.trim();
      if (raw) {
        try {
          rule = JSON.parse(raw);
        } catch {
          // keep as string
        }
      }
    }

    const by = rule && typeof rule === 'object' ? (rule as any).byWeekday ?? (rule as any).byweekday ?? (rule as any).by_weekday : rule;
    const days = normalizeByWeekdayToMon1Sun7(by);
    if (days.length === 7) return { main: translate(lang, 'repeat_every_day') };
    if (days.length === 0) return { main: translate(lang, 'repeat_every_week') };
    const labels = days.map((d) => weekdayLabelMon1Sun7(d, lang));
    const detail = labels.join(' · ');
    return { main: translate(lang, 'repeat_every_week'), detail };
  }

  return { main: String(reminder.repeat_type || 'Weekly') };
}

const ReminderCard: React.FC<Props> = ({ reminder, onPress, showSyncing = true }) => {
  const { lang } = useLanguage();
  const Wrapper: any = onPress ? TouchableOpacity : View;
  const timeText = formatTime12h(reminder.time_of_day);
  const when = repeatDisplay(reminder, lang);
  const isPendingSync = reminder.local_only || Number(reminder.id) < 0;

  return (
    <Wrapper style={styles.container} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Image
          source={require('../../../../assets/android-res/drawable/reminder.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>

      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>
          {reminder.title || 'Reminder'}
        </Text>

        <View style={[styles.metaRow, when.detail ? styles.metaRowMulti : null]}>
          {timeText ? (
            <View style={styles.timePill}>
              <Text style={styles.timePillText} numberOfLines={1}>
                {timeText}
              </Text>
            </View>
          ) : null}

          <View style={styles.whenWrap}>
            <Text style={styles.whenText} numberOfLines={1}>
              {when.main}
            </Text>
            {when.detail ? (
              <Text style={styles.whenDetail}>
                {when.detail}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.statusRow}>
          {reminder.enabled === false ? (
            <View style={styles.offPill}>
              <Text style={styles.offPillText}>Off</Text>
            </View>
          ) : null}
          {showSyncing && isPendingSync ? (
            <View style={styles.syncPill}>
              <Text style={styles.syncPillText}>Syncing…</Text>
            </View>
          ) : null}
        </View>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  metaRowMulti: { alignItems: 'center' },
  timePill: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  timePillText: { fontSize: 12, fontWeight: '900', color: '#111827' },
  whenWrap: { flex: 1, minWidth: 0, paddingRight: 4 },
  whenText: { fontSize: 14, color: '#4b5563', fontWeight: '700' },
  whenDetail: { marginTop: 2, fontSize: 12, lineHeight: 16, color: '#6b7280', fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  offPill: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  offPillText: { fontSize: 12, fontWeight: '900', color: '#6b7280' },
  syncPill: {
    backgroundColor: '#fffbeb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  syncPillText: { fontSize: 12, fontWeight: '900', color: '#f59e0b' },
  chevronWrap: { paddingLeft: 10, justifyContent: 'center' },
  chevron: { fontSize: 20, color: '#9ca3af', fontWeight: '300' },
});

export default ReminderCard;
