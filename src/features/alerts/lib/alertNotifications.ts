/**
 * alertNotifications.ts
 *
 * Wraps @notifee/react-native to display local push notifications for
 * Critical and Warning health alerts, and exposes a lightweight pub/sub
 * so BottomNav can show a badge count without polling.
 */

import notifee, { AndroidImportance, AndroidColor, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import type { AlertSeverity } from '../storage/alertStorage';

const CHANNEL_ID_CRITICAL = 'health_alerts_critical';
const CHANNEL_ID_WARNING = 'health_alerts_warning';
let channelsCreated = false;

async function ensureChannels(): Promise<void> {
  if (channelsCreated) return;
  // Request permission (no-op on Android <13; shows dialog on Android 13+)
  await notifee.requestPermission();
  await notifee.createChannel({
    id: CHANNEL_ID_CRITICAL,
    name: 'Critical Health Alerts',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [100, 400, 200, 400],
    lightColor: AndroidColor.RED,
    sound: 'default',
  });
  await notifee.createChannel({
    id: CHANNEL_ID_WARNING,
    name: 'Warning Health Alerts',
    importance: AndroidImportance.HIGH,
    vibration: true,
    lights: true,
    lightColor: AndroidColor.YELLOW,
    sound: 'default',
  });
  channelsCreated = true;
}

export async function sendAlertNotification(
  severity: AlertSeverity,
  title: string,
  message: string,
): Promise<void> {
  if (severity !== 'critical' && severity !== 'warning') return;
  try {
    await ensureChannels();
    const isCritical = severity === 'critical';
    const channelId = isCritical ? CHANNEL_ID_CRITICAL : CHANNEL_ID_WARNING;
    const color = isCritical ? '#ef4444' : '#f59e0b';
    const emoji = isCritical ? '🚨' : '⚠️';
    const notifTitle = `${emoji} ${title}`;
    const ticker = `${title}: ${message.length > 80 ? message.slice(0, 77) + '…' : message}`;

    await notifee.displayNotification({
      title: `<b>${notifTitle}</b>`,
      body: message,
      android: {
        channelId,
        color,
        importance: AndroidImportance.HIGH,
        category: isCritical ? AndroidCategory.ALARM : AndroidCategory.REMINDER,
        visibility: AndroidVisibility.PUBLIC,
        pressAction: { id: 'default' },
        smallIcon: 'wellscreen512bg',
        ticker,
        showTimestamp: true,
        ...(isCritical && { vibrationPattern: [100, 400, 200, 400] }),
      },
      ios: {
        foregroundPresentationOptions: {
          alert: true,
          sound: true,
          badge: false,
        },
        interruptionLevel: isCritical ? 'timeSensitive' : 'active',
      },
    });
  } catch (err) {
    console.log('[AlertNotifications] Failed to display notification:', err);
  }
}

// ---------------------------------------------------------------------------
// Badge pub/sub
// Tracks the worst unread severity among critical/warning alerts and notifies
// subscribers (BottomNav badge) synchronously whenever it changes.
// ---------------------------------------------------------------------------

export type BadgeSeverity = 'critical' | 'warning' | null;

let currentBadge: BadgeSeverity = null;
const badgeListeners = new Set<(severity: BadgeSeverity) => void>();

export function getBadgeSeverity(): BadgeSeverity {
  return currentBadge;
}

export function updateBadge(severity: BadgeSeverity): void {
  if (severity === currentBadge) return;
  currentBadge = severity;
  for (const listener of Array.from(badgeListeners)) {
    try {
      listener(currentBadge);
    } catch {}
  }
}

export function subscribeBadge(listener: (severity: BadgeSeverity) => void): () => void {
  badgeListeners.add(listener);
  return () => badgeListeners.delete(listener);
}

/**
 * Recalculates the badge from the current stored alerts, filtered to the active profile.
 * Call this after every add / read / dismiss.
 */
export async function refreshBadge(): Promise<void> {
  try {
    const { getAlerts } = await import('../storage/alertStorage');
    const { getActiveProfileId } = await import('../../profiles/lib/profileEvents');
    const [alerts, activeProfileId] = await Promise.all([getAlerts(), getActiveProfileId()]);
    const relevant = activeProfileId
      ? alerts.filter((a) => a.profileId === activeProfileId)
      : alerts;
    const hasCritical = relevant.some((a) => a.severity === 'critical' && a.isUnread);
    const hasWarning = relevant.some((a) => a.severity === 'warning' && a.isUnread);
    const next: BadgeSeverity = hasCritical ? 'critical' : hasWarning ? 'warning' : null;
    updateBadge(next);
  } catch {
    // fail silently
  }
}
