import notifee, { AndroidImportance, TriggerType, RepeatFrequency, type TimestampTrigger } from '@notifee/react-native';

import type { CachedReminder } from '../../features/profiles/storage/reminderCache';

const REMINDER_CHANNEL_ID = 'reminders';

async function ensureAndroidChannel() {
  try {
    await notifee.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'Reminders',
      importance: AndroidImportance.DEFAULT,
    });
  } catch {
    // ignore
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();
    // settings.authorizationStatus: 0/1/2 on iOS; on Android it's granted by default on older versions.
    return settings.authorizationStatus !== 0;
  } catch {
    return false;
  }
}

function parseTimeOfDay(time: string): { hh: number; mm: number; ss: number } | null {
  const m = String(time || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] !== undefined ? Number(m[3]) : 0;
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
  return { hh, mm, ss };
}

function normalizeRepeatType(repeatType: string | undefined | null): 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Custom' {
  const s = String(repeatType || '').trim().toLowerCase();
  if (s === 'none') return 'None';
  if (s === 'daily') return 'Daily';
  if (s === 'weekly') return 'Weekly';
  if (s === 'monthly') return 'Monthly';
  if (s === 'custom') return 'Custom';
  return 'Weekly';
}

function nextTimestampForTime(timeOfDay: string): number {
  const t = parseTimeOfDay(timeOfDay);
  const now = new Date();
  if (!t) return now.getTime() + 60_000;

  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setHours(t.hh, t.mm, 0, 0);

  if (candidate.getTime() <= now.getTime() + 5_000) {
    // already passed (or too close), schedule tomorrow
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

function nextTimestampForWeekly(timeOfDay: string, repeatRule: any): number {
  const t = parseTimeOfDay(timeOfDay);
  const now = new Date();
  if (!t) return now.getTime() + 60_000;

  const byWeekdayRaw = repeatRule && typeof repeatRule === 'object' ? repeatRule.byWeekday : null;
  const byWeekday: number[] = Array.isArray(byWeekdayRaw)
    ? byWeekdayRaw.map((v: any) => Number(v)).filter((v: any) => Number.isFinite(v))
    : [];

  // Accept either 0-6 (Sun=0) or 1-7 (Mon=1..Sun=7)
  const normalizeDow = (v: number) => {
    if (v >= 0 && v <= 6) return v;
    if (v >= 1 && v <= 7) return v % 7; // 7 -> 0
    return null;
  };

  const wanted = byWeekday
    .map(normalizeDow)
    .filter((v: any) => v !== null) as number[];

  const todayDow = now.getDay(); // 0..6

  const base = new Date(now);
  base.setHours(t.hh, t.mm, 0, 0);

  if (wanted.length === 0) {
    // Weekly with no rule: same day each week.
    if (base.getTime() <= now.getTime() + 5_000) base.setDate(base.getDate() + 7);
    return base.getTime();
  }

  // Find next occurrence among wanted days
  for (let delta = 0; delta <= 7; delta++) {
    const dow = (todayDow + delta) % 7;
    if (!wanted.includes(dow)) continue;

    const d = new Date(now);
    d.setDate(d.getDate() + delta);
    d.setHours(t.hh, t.mm, 0, 0);

    if (d.getTime() > now.getTime() + 5_000) return d.getTime();
  }

  // Fallback: one week later
  base.setDate(base.getDate() + 7);
  return base.getTime();
}

export async function scheduleReminderNotification(reminder: CachedReminder, opts?: { profileLabel?: string }) {
  await ensureAndroidChannel();
  await ensureNotificationPermission();

  const repeatType = normalizeRepeatType(reminder.repeat_type);

  let triggerTimestamp = nextTimestampForTime(reminder.time_of_day);
  if (repeatType === 'Weekly') {
    triggerTimestamp = nextTimestampForWeekly(reminder.time_of_day, reminder.repeat_rule);
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerTimestamp,
    ...(repeatType === 'Daily' ? { repeatFrequency: RepeatFrequency.DAILY } : null),
    ...(repeatType === 'Weekly' ? { repeatFrequency: RepeatFrequency.WEEKLY } : null),
  };

  const profilePart = opts?.profileLabel ? ` (${opts.profileLabel})` : '';
  const notificationId = `reminder:${reminder.profile_id}:${reminder.id}`;

  if (reminder.enabled === false) {
    try {
      await notifee.cancelTriggerNotification(notificationId);
    } catch {}
    return;
  }

  await notifee.createTriggerNotification(
    {
      id: notificationId,
      title: reminder.title || 'Reminder',
      body: `${(reminder.description || 'Health reminder').trim()}${profilePart}`,
      android: {
        channelId: REMINDER_CHANNEL_ID,
        pressAction: { id: 'default' },
        smallIcon: 'wellscreen512bg',
      },
    },
    trigger
  );
}

export async function cancelReminderNotification(profileId: number, reminderId: number) {
  const notificationId = `reminder:${profileId}:${reminderId}`;
  try {
    await notifee.cancelTriggerNotification(notificationId);
  } catch {}
}

export async function showGoalCongratsNotification(title: string) {
  await ensureAndroidChannel();
  await ensureNotificationPermission();

  await notifee.displayNotification({
    title: 'Goal completed',
    body: title ? `Nice work! You completed: ${title}` : 'Nice work! You completed your goal.',
    android: {
      channelId: REMINDER_CHANNEL_ID,
      pressAction: { id: 'default' },
      smallIcon: 'wellscreen512bg',
    },
  });
}
