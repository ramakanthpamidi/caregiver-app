import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../../shared/config/api';

export type LineNotifyTarget = {
  id: number;
  profile_id: number;
  line_user_id: string;
  line_display_name: string | null;
  notify_critical: boolean;
  notify_warning: boolean;
  notify_good: boolean;
  notify_excellent: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string | null;
};

async function authHeaders() {
  const token = await AsyncStorage.getItem('authToken');
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function listLineTargets(profileId: number): Promise<LineNotifyTarget[]> {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE_URL}/line-notify?profile_id=${profileId}`, { headers });
  if (!resp.ok) throw new Error('Failed to load LINE notify targets');
  const data = await resp.json();
  return Array.isArray(data.targets) ? data.targets : [];
}

export async function addLineTarget(params: {
  profileId: number;
  lineUserId: string;
  lineDisplayName?: string | null;
  notifyCritical?: boolean;
  notifyWarning?: boolean;
  notifyGood?: boolean;
  notifyExcellent?: boolean;
}): Promise<LineNotifyTarget> {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE_URL}/line-notify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      profile_id: params.profileId,
      line_user_id: params.lineUserId,
      line_display_name: params.lineDisplayName ?? null,
      notify_critical: params.notifyCritical ?? true,
      notify_warning: params.notifyWarning ?? true,
      notify_good: params.notifyGood ?? false,
      notify_excellent: params.notifyExcellent ?? false,
    }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error((data as any).error || 'Failed to add LINE notify target');
  }
  const data = await resp.json();
  return (data as any).target;
}

export async function updateLineTarget(
  id: number,
  patch: Partial<{
    line_display_name: string;
    notify_critical: boolean;
    notify_warning: boolean;
    notify_good: boolean;
    notify_excellent: boolean;
    enabled: boolean;
  }>,
): Promise<LineNotifyTarget> {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE_URL}/line-notify/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(patch),
  });
  if (!resp.ok) throw new Error('Failed to update LINE notify target');
  const data = await resp.json();
  return (data as any).target;
}

export async function removeLineTarget(id: number): Promise<void> {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE_URL}/line-notify/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!resp.ok) throw new Error('Failed to remove LINE notify target');
}

export async function generateLinkPin(profileId: number): Promise<{ pin: string; expiresAt: string }> {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE_URL}/line-notify/link-pin`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ profile_id: profileId }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error((data as any).error || 'Failed to generate PIN');
  }
  return resp.json();
}

export async function checkLinkStatus(pin: string): Promise<{ linked: boolean; expired?: boolean; lineDisplayName?: string | null }> {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE_URL}/line-notify/link-status?pin=${encodeURIComponent(pin)}`, { headers });
  if (!resp.ok) throw new Error('Failed to check link status');
  return resp.json();
}

export async function simulateLineNotify(params: {
  profileId: number;
  severity: string;
  eventType: string;
  deviceName: string;
  payload: Record<string, any>;
  lat?: number | null;
  lng?: number | null;
}): Promise<void> {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE_URL}/line-notify/simulate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      profile_id: params.profileId,
      severity: params.severity,
      event_type: params.eventType,
      device_name: params.deviceName,
      payload: params.payload,
      ...(params.lat != null && { lat: params.lat }),
      ...(params.lng != null && { lng: params.lng }),
    }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error((data as any).error || 'Simulate failed');
  }
}

export async function sendDailyReport(profileId: number): Promise<{ ok: boolean; sent: number; error?: string }> {
  const headers = await authHeaders();
  const resp = await fetch(`${API_BASE_URL}/line-notify/daily-summary`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ profile_id: profileId }),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error((data as any).error || 'Failed to send daily report');
  }
  return resp.json();
}
