/**
 * dailySummaryNotification.ts
 *
 * Schedules a "day summary" notification to fire at 08:00 Bangkok time
 * (UTC+7 = 01:00 UTC). The content is baked-in at schedule time and
 * reflects the readings captured so far that day. When it fires the
 * next morning, it effectively shows the previous day's summary.
 *
 * Call scheduleDailySummaryNotification() whenever a new reading arrives
 * so the text stays up-to-date.  The previous scheduled notification is
 * cancelled first so there is never more than one pending.
 */
import notifee, { AndroidImportance, AndroidCategory, TriggerType } from '@notifee/react-native';
import type { TimestampTrigger } from '@notifee/react-native';

const CHANNEL_ID = 'daily_summary';
let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Daily Health Summary',
    importance: AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

/** Returns the UTC epoch ms of the next 08:00 in Asia/Bangkok (UTC+7). */
function next8amBangkokUtcMs(): number {
  const BKK_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
  const EIGHT_AM_MS = 8 * 60 * 60 * 1000;
  const nowUtcMs = Date.now();
  const nowBkkMs = nowUtcMs + BKK_OFFSET_MS;
  // Start of today in BKK ms
  const todayStartBkkMs = Math.floor(nowBkkMs / 86_400_000) * 86_400_000;
  let next8amBkkMs = todayStartBkkMs + EIGHT_AM_MS;
  // If we've already passed 08:00 today, target tomorrow's 08:00
  if (next8amBkkMs <= nowBkkMs) {
    next8amBkkMs += 86_400_000;
  }
  return next8amBkkMs - BKK_OFFSET_MS; // convert back to UTC
}

/** Bangkok-local date string for "today", e.g. "March 7, 2026" (en) or "7 มีนาคม 2569" (th) */
function todayBangkokLabel(lang: 'en' | 'th' = 'en'): string {
  const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
  const bkkNow = new Date(Date.now() + BKK_OFFSET_MS);
  if (lang === 'th') {
    const thMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const buddhistYear = bkkNow.getUTCFullYear() + 543;
    return `${bkkNow.getUTCDate()} ${thMonths[bkkNow.getUTCMonth()]} ${buddhistYear}`;
  }
  return bkkNow.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC', // already shifted, treat as UTC
  });
}

export interface DailySummarySnapshot {
  profileId: number;
  /** App language — controls notification text language */
  lang?: 'en' | 'th';
  /** Latest BP reading for today */
  latestBp?: { sys: number; dia: number };
  /** Number of BP readings taken today */
  bpCount?: number;
  /** Latest glucose reading for today (mg/dL) */
  latestGlucose?: number;
  /** Number of glucose readings taken today */
  glucoseCount?: number;
  /** Latest body temperature (°C) */
  latestTempC?: number;
  /** Latest SpO2 (%) */
  latestSpo2?: number;
  /** Latest pulse from oximeter (bpm) */
  latestPulse?: number;
}

function buildNotificationBody(snap: DailySummarySnapshot): string {
  const lang = snap.lang ?? 'en';
  const parts: string[] = [];

  if (lang === 'th') {
    if (snap.latestBp) {
      const bpStr = `${snap.latestBp.sys}/${snap.latestBp.dia} mmHg`;
      const countStr = snap.bpCount ? ` (${snap.bpCount} ครั้ง)` : '';
      parts.push(`ความดันโลหิต: ${bpStr}${countStr}`);
    }
    if (snap.latestGlucose != null) {
      const countStr = snap.glucoseCount ? ` (${snap.glucoseCount} ครั้ง)` : '';
      parts.push(`น้ำตาลในเลือด: ${snap.latestGlucose} mg/dL${countStr}`);
    }
    if (snap.latestTempC != null) {
      parts.push(`อุณหภูมิ: ${snap.latestTempC.toFixed(1)}°C`);
    }
    if (snap.latestSpo2 != null) {
      const pulseStr = snap.latestPulse ? ` / ${Math.round(snap.latestPulse)} bpm` : '';
      parts.push(`SpO₂: ${Math.round(snap.latestSpo2)}%${pulseStr}`);
    }
    if (parts.length === 0) {
      return 'เปิดแอปเพื่อดูสรุปสุขภาพประจำวัน';
    }
    return parts.join(' • ');
  }

  if (snap.latestBp) {
    const bpStr = `${snap.latestBp.sys}/${snap.latestBp.dia} mmHg`;
    const countStr = snap.bpCount ? ` (${snap.bpCount} ${snap.bpCount === 1 ? 'reading' : 'readings'})` : '';
    parts.push(`Blood Pressure: ${bpStr}${countStr}`);
  }
  if (snap.latestGlucose != null) {
    const countStr = snap.glucoseCount ? ` (${snap.glucoseCount} ${snap.glucoseCount === 1 ? 'reading' : 'readings'})` : '';
    parts.push(`Glucose: ${snap.latestGlucose} mg/dL${countStr}`);
  }
  if (snap.latestTempC != null) {
    parts.push(`Temperature: ${snap.latestTempC.toFixed(1)}°C`);
  }
  if (snap.latestSpo2 != null) {
    const pulseStr = snap.latestPulse ? ` / ${Math.round(snap.latestPulse)} bpm` : '';
    parts.push(`SpO₂: ${Math.round(snap.latestSpo2)}%${pulseStr}`);
  }

  if (parts.length === 0) {
    return 'Open the app to review your health trend for the day.';
  }
  return parts.join(' • ');
}

/**
 * Schedule (or reschedule) the midnight daily summary notification.
 * Safe to call on every new reading — cancels and replaces the previous one.
 */
export async function scheduleDailySummaryNotification(
  snap: DailySummarySnapshot,
): Promise<void> {
  try {
    await ensureChannel();

    const notifId = `daily_summary_${snap.profileId}`;
    const triggerUtcMs = next8amBangkokUtcMs();

    // Must be at least 30 seconds in the future
    if (triggerUtcMs - Date.now() < 30_000) return;

    await notifee.cancelTriggerNotification(notifId);

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: triggerUtcMs,
    };

    const lang = snap.lang ?? 'en';
    const dateLabel = todayBangkokLabel(lang);
    const notifTitle = lang === 'th'
      ? `📋 สรุปสุขภาพประจำวัน – ${dateLabel}`
      : `📋 Daily Health Summary – ${dateLabel}`;

    await notifee.createTriggerNotification(
      {
        id: notifId,
        title: notifTitle,
        body: buildNotificationBody(snap),
        android: {
          channelId: CHANNEL_ID,
          category: AndroidCategory.REMINDER,
          pressAction: { id: 'default' },
          smallIcon: 'wellscreen512bg',
          showTimestamp: true,
        },
        ios: {
          foregroundPresentationOptions: {
            alert: true,
            sound: false,
            badge: false,
          },
        },
      },
      trigger,
    );
  } catch (err) {
    console.log('[DailySummary] Failed to schedule notification:', err);
  }
}

/** Cancel any pending daily summary notification for this profile. */
export async function cancelDailySummaryNotification(profileId: number): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(`daily_summary_${profileId}`);
  } catch {}
}
