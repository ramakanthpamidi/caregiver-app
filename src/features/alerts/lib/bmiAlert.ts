import { addAlert, healthStatusToSeverity } from '../storage/alertStorage';
import {
  getAlertTitle,
  getAlertMessage,
  formatReadingText,
  getDeviceNameForType,
  type HealthStatusLevel,
} from '../../../shared/lib/healthThresholds';
import { sendAlertNotification, refreshBadge } from './alertNotifications';

/**
 * Records a Weight/BMI alert (Alerts page) after a completed scale measurement,
 * mirroring how device readings generate alerts. Push notification fires only
 * for Warning/Critical to avoid noise on healthy weigh-ins; the alert itself is
 * added for every status so it appears in the list like the other metrics.
 */
export async function recordBmiAlert(params: {
  profileId: number;
  deviceId: string;
  kg: number;
  bmi: number;
  status: HealthStatusLevel;
  ts: number;
  lang?: 'en' | 'th';
}): Promise<void> {
  const { profileId, deviceId, kg, bmi, status, ts, lang = 'en' } = params;
  if (!profileId || !Number.isFinite(bmi) || bmi <= 0) return;

  const severity = healthStatusToSeverity(status);
  const values = { bmi: Number(bmi.toFixed(1)), kg: Number(kg.toFixed(1)) };
  const title = getAlertTitle('bmi', status, lang);
  const message = getAlertMessage('bmi', status, values, lang);
  const reading = formatReadingText('bmi', values);

  const alert = await addAlert({
    severity,
    title,
    message,
    deviceName: getDeviceNameForType('bmi'),
    deviceId,
    readingType: 'bmi',
    reading,
    values,
    timestamp: ts,
    profileId,
  });
  if (!alert) return; // deduped

  if (severity === 'critical' || severity === 'warning') {
    try { await sendAlertNotification(severity, title, message); } catch { /* ignore */ }
  }
  try { await refreshBadge(); } catch { /* ignore */ }
}
