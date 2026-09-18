import { API_BASE_URL, apiUrl } from '../../../shared/config/api';

export { API_BASE_URL };

const DEFAULT_TIMEOUT_MS = 12000;

export type ProfileSummary = {
  id: number;
  profile_label: string;
  owner_user_id?: number | null;
  created_by_account_id?: number | null;
  created_at: string;
  last_used?: string | null;
  last_used_at?: string | null;
  has_access_password?: boolean;
};

function normalizeProfileSummary(row: any): ProfileSummary {
  return {
    id: Number(row?.id),
    profile_label: String(row?.profile_label || ''),
    owner_user_id: row?.owner_user_id ?? row?.created_by_account_id ?? null,
    created_by_account_id: row?.created_by_account_id ?? row?.owner_user_id ?? null,
    created_at: String(row?.created_at || new Date().toISOString()),
    last_used: row?.last_used ?? row?.last_used_at ?? null,
    last_used_at: row?.last_used_at ?? row?.last_used ?? null,
    has_access_password: row?.has_access_password === true,
  };
}

export type MedicalGeneralInfoPayload = {
  date_of_birth?: string | null; // YYYY-MM-DD
  sex?: 'Male' | 'Female' | string | null;
  organ_donor?: boolean | null;
  blood_type?: string | null;
  height_cm?: number | string | null;
  weight_kg?: number | string | null;
  allergies?: any;
  chronic_conditions?: any;
  medications?: any;
  family_history?: any;
  emergency_contact?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
};

export type ProfileConsentsPayload = {
  consent_granted: boolean;
  source?: string;
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseJsonOrThrow(resp: Response) {
  const text = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!resp.ok) {
    const msg = data?.error || data?.message || `Request failed (status ${resp.status})`;
    throw new Error(msg);
  }
  return data;
}

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(input, { ...init, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getMyProfiles(token: string): Promise<ProfileSummary[]> {
  const resp = await fetchWithTimeout(apiUrl('/profiles/me'), { headers: authHeaders(token) });
  const data = await parseJsonOrThrow(resp);
  return Array.isArray(data?.profiles) ? data.profiles.map((row: any) => normalizeProfileSummary(row)) : [];
}

export async function createProfile(
  token: string,
  payload: { profile_label: string; access_password?: string }
): Promise<ProfileSummary> {
  const resp = await fetchWithTimeout(apiUrl('/profiles'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(resp);
  if (!data?.profile) throw new Error('Profile not returned by server');
  return normalizeProfileSummary(data.profile);
}

export async function createProfileWithMedical(
  token: string,
  payload: {
    profile_label: string;
    access_password?: string;
    medical_general_info?: MedicalGeneralInfoPayload;
    profile_consents?: ProfileConsentsPayload;
  }
): Promise<{ profile: ProfileSummary; medical?: any; consents?: any }> {
  const resp = await fetchWithTimeout(apiUrl('/profiles/with-medical'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(resp);
  if (!data?.profile) throw new Error('Profile not returned by server');
  return { profile: normalizeProfileSummary(data.profile), medical: data.medical, consents: data.consents };
}

export async function upsertProfileConsents(
  token: string,
  profileId: number,
  payload: ProfileConsentsPayload
): Promise<any> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/consents`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(resp);
  return data?.consents;
}

export async function getProfileConsents(token: string, profileId: number): Promise<ProfileConsentsPayload | null> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/consents`), {
    headers: authHeaders(token),
  });
  const data = await parseJsonOrThrow(resp);
  return data?.consents || null;
}

export async function upsertMedicalGeneral(
  token: string,
  profileId: number,
  payload: MedicalGeneralInfoPayload
): Promise<any> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/medical-general`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(resp);
  return data?.medical;
}

export async function getMedicalGeneral(token: string, profileId: number): Promise<any> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/medical-general`), {
    headers: authHeaders(token),
  });
  const data = await parseJsonOrThrow(resp);
  return data?.medical;
}

export async function updateProfile(
  token: string,
  profileId: number,
  payload: { profile_label?: string; access_password?: string }
): Promise<ProfileSummary> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(resp);
  if (!data?.profile) throw new Error('Profile not returned by server');
  return normalizeProfileSummary(data.profile);
}

export type MedicalDataSnapshot = {
  device_id: string;
  profile_id: number;
  ts: number;
  snapshot: Record<string, any>;
  lat?: number | null;
  lng?: number | null;
};

export type MedicalDataRawRow = {
  id?: number;
  device_ref?: number;
  device_id?: string;
  device_name?: string;
  factory_name?: string;
  profile_id?: number;
  ts?: string;
  snapshot?: any;
};

function normalizeMedicalDataRawRow(row: any): MedicalDataRawRow {
  const deviceRefRaw = row?.device_ref;
  const deviceRef = deviceRefRaw != null && Number.isFinite(Number(deviceRefRaw))
    ? Number(deviceRefRaw)
    : undefined;
  const ts = row?.ts ?? row?.observed_at ?? row?.occurred_at ?? null;
  const snapshot = row?.snapshot ?? row?.payload ?? null;

  return {
    ...row,
    id: row?.id != null && Number.isFinite(Number(row.id)) ? Number(row.id) : undefined,
    device_ref: deviceRef,
    device_id: row?.device_id != null ? String(row.device_id) : undefined,
    device_name: row?.device_name != null ? String(row.device_name) : undefined,
    factory_name: row?.factory_name != null ? String(row.factory_name) : undefined,
    profile_id: row?.profile_id != null && Number.isFinite(Number(row.profile_id)) ? Number(row.profile_id) : undefined,
    ts: ts != null ? String(ts) : undefined,
    snapshot,
  };
}

export type MedicalEventRow = {
  id?: number;
  device_ref?: number;
  device_id?: string;
  device_name?: string;
  factory_name?: string;
  profile_id?: number;
  ts?: string | number;
  event_type?: string;
  payload?: any;
  captured_by_user_id?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
  [key: string]: any;
};

function normalizeMedicalEventRow(row: any): MedicalEventRow {
  const deviceRefRaw = row?.device_ref;
  const deviceRef = deviceRefRaw != null && Number.isFinite(Number(deviceRefRaw))
    ? Number(deviceRefRaw)
    : undefined;
  const ts = row?.ts ?? row?.occurred_at ?? row?.observed_at ?? null;

  return {
    ...row,
    id: row?.id != null && Number.isFinite(Number(row.id)) ? Number(row.id) : undefined,
    device_ref: deviceRef,
    device_id: row?.device_id != null ? String(row.device_id) : undefined,
    device_name: row?.device_name != null ? String(row.device_name) : undefined,
    factory_name: row?.factory_name != null ? String(row.factory_name) : undefined,
    profile_id: row?.profile_id != null && Number.isFinite(Number(row.profile_id)) ? Number(row.profile_id) : undefined,
    ts: ts != null ? String(ts) : undefined,
    event_type: row?.event_type != null ? String(row.event_type) : undefined,
    payload: row?.payload ?? row?.snapshot ?? null,
    captured_by_user_id: row?.captured_by_user_id != null && Number.isFinite(Number(row.captured_by_user_id))
      ? Number(row.captured_by_user_id)
      : null,
    latitude: row?.latitude != null && Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
    longitude: row?.longitude != null && Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
    created_at: row?.created_at != null ? String(row.created_at) : undefined,
  };
}

export type MedicalTrendLastPoint = MedicalDataRawRow & Record<string, any>;

export type TrendPeriod = 'Latest' | 'Daily' | 'Weekly' | 'Monthly' | 'Overall';

export type BloodPressureTrendPoint = {
  ts: string;
  ts_ms?: number;
  sys: number;
  dia: number;
};

export type BloodGlucoseTrendPoint = {
  ts: string;
  ts_ms?: number;
  mgdl: number;
};

export type TemperatureTrendPoint = {
  ts: string;
  ts_ms?: number;
  celsius: number;
};

export type SpO2TrendPoint = {
  ts: string;
  ts_ms?: number;
  spo2: number;
  pulse?: number | null;
};

export type MedicalTrendLatestPoint = {
  ts?: string;
  ts_ms?: number;
  device_ref?: number | null;
  device_id?: string | null;
  device_name?: string | null;
  factory_name?: string | null;
  [key: string]: any;
};

export type MedicalTrendLatestPoints = {
  bp: MedicalTrendLatestPoint[];
  glucose: MedicalTrendLatestPoint[];
  temp: MedicalTrendLatestPoint[];
  spo2: MedicalTrendLatestPoint[];
};

export type MedicalTrendResponse = {
  period: TrendPeriod;
  source: string;
  bp_points: BloodPressureTrendPoint[];
  glucose_points: BloodGlucoseTrendPoint[];
  temp_points: TemperatureTrendPoint[];
  spo2_points: SpO2TrendPoint[];
  latest_points?: MedicalTrendLatestPoints | null;
  last_point?: MedicalTrendLastPoint | null;
};

export type HealthReportDataResponse = {
  profile: {
    id: number;
    profile_label?: string | null;
  };
  generated_at: string;
  table_sources: Record<string, string | null>;
  tables: {
    medical_general_info: any[];
    medical_data_raw: any[];
    medical_data_daily: any[];
    medical_data_archeive: any[];
    medical_events: any[];
    medical_events_archive: any[];
    [key: string]: any[];
  };
};

export type MedicalDataSummary = {
  profile_id: number;
  profile_label: string;
  general_info_count: number;
  raw_data_count: number;
  daily_data_count: number;
  archive_data_count: number;
  events_archive_count: number;
};

export type DeleteMedicalDataPeriod = 'all' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom';

export type ProfileReminder = {
  id: number;
  profile_id: number;
  title: string;
  description?: string | null;
  enabled: boolean;
  time_of_day: string; // HH:MM[:SS]
  timezone?: string | null;
  repeat_type: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Custom' | string;
  repeat_rule?: any;
  next_fire_at?: string | null;
  created_at?: string;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
};

export type CreateReminderPayload = {
  title: string;
  description?: string | null;
  enabled?: boolean;
  time_of_day: string;
  timezone?: string | null;
  repeat_type?: ProfileReminder['repeat_type'];
  repeat_rule?: any;
};

export type ProfileGoal = {
  id: number;
  profile_id: number;
  title: string;
  description?: string | null;
  goal_type: string;
  target: any;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null;
  status: 'Active' | 'Paused' | 'Completed' | 'Archived' | string;
  created_at?: string;
  updated_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
};

export type CreateGoalPayload = {
  title: string;
  description?: string | null;
  goal_type: string;
  target: any;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null;
  status?: ProfileGoal['status'];
};

/**
 * Send medical telemetry data to the server.
 * @param token - Auth token
 * @param data - Medical data snapshot
 */
export async function sendMedicalData(token: string, data: MedicalDataSnapshot): Promise<any> {
  const resp = await fetchWithTimeout(apiUrl('/medical-data'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      device_id: data.device_id,
      profile_id: data.profile_id,
      ts: data.ts,
      snapshot: data.snapshot,
      ...(data.lat != null && { lat: data.lat }),
      ...(data.lng != null && { lng: data.lng }),
    }),
  });
  const result = await parseJsonOrThrow(resp);
  return result;
}

export type MedicalEventSnapshot = {
  device_id: string;
  profile_id: number;
  ts: number;
  event_type: string;
  payload: Record<string, any>;
  lat?: number | null;
  lng?: number | null;
};

/** Upload an alert / medical event immediately (same path as outbox sync). */
export async function sendMedicalEvent(token: string, data: MedicalEventSnapshot): Promise<any> {
  const resp = await fetchWithTimeout(apiUrl('/medical-events'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      device_id: data.device_id,
      profile_id: data.profile_id,
      ts: data.ts,
      event_type: data.event_type,
      payload: data.payload,
      ...(data.lat != null && { lat: data.lat }),
      ...(data.lng != null && { lng: data.lng }),
    }),
  });
  return parseJsonOrThrow(resp);
}

export async function getMedicalDataRaw(
  token: string,
  profileId: number,
  opts?: { limit?: number; offset?: number; mode?: 'all' }
): Promise<MedicalDataRawRow[]> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const mode = opts?.mode;
  const params = [
    `profile_id=${encodeURIComponent(String(profileId))}`,
    `limit=${encodeURIComponent(String(limit))}`,
    `offset=${encodeURIComponent(String(offset))}`,
  ];
  if (mode) params.push(`mode=${encodeURIComponent(mode)}`);
  const resp = await fetchWithTimeout(
    apiUrl(`/medical-data?${params.join('&')}`),
    { headers: authHeaders(token) }
  );
  const data = await parseJsonOrThrow(resp);
  return Array.isArray(data?.rows) ? data.rows.map((row: any) => normalizeMedicalDataRawRow(row)) : [];
}

export async function getMedicalEvents(
  token: string,
  profileId: number,
  opts?: { limit?: number; offset?: number }
): Promise<MedicalEventRow[]> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const params = [
    `profile_id=${encodeURIComponent(String(profileId))}`,
    `limit=${encodeURIComponent(String(limit))}`,
    `offset=${encodeURIComponent(String(offset))}`,
  ];

  const resp = await fetchWithTimeout(
    apiUrl(`/medical-events?${params.join('&')}`),
    { headers: authHeaders(token) }
  );
  const data = await parseJsonOrThrow(resp);
  return Array.isArray(data?.events) ? data.events.map((row: any) => normalizeMedicalEventRow(row)) : [];
}

export async function getMedicalTrends(
  token: string,
  profileId: number,
  period: TrendPeriod
): Promise<MedicalTrendResponse> {
  const resp = await fetchWithTimeout(
    apiUrl(`/medical-data/trends?profile_id=${encodeURIComponent(String(profileId))}&period=${encodeURIComponent(period)}`),
    { headers: authHeaders(token) }
  );
  const data = await parseJsonOrThrow(resp);
  const latest = data?.latest_points && typeof data.latest_points === 'object'
    ? {
        bp: Array.isArray(data.latest_points.bp) ? data.latest_points.bp : [],
        glucose: Array.isArray(data.latest_points.glucose) ? data.latest_points.glucose : [],
        temp: Array.isArray(data.latest_points.temp) ? data.latest_points.temp : [],
        spo2: Array.isArray(data.latest_points.spo2) ? data.latest_points.spo2 : [],
      }
    : null;
  return {
    period,
    source: String(data?.source || ''),
    bp_points: Array.isArray(data?.bp_points) ? data.bp_points : [],
    glucose_points: Array.isArray(data?.glucose_points) ? data.glucose_points : [],
    temp_points: Array.isArray(data?.temp_points) ? data.temp_points : [],
    spo2_points: Array.isArray(data?.spo2_points) ? data.spo2_points : [],
    latest_points: latest,
    last_point: data?.last_point && typeof data.last_point === 'object' ? (data.last_point as MedicalTrendLastPoint) : null,
  };
}

export async function getMedicalDataOverview(
  token: string,
  profileId: number
): Promise<MedicalTrendResponse> {
  const resp = await fetchWithTimeout(
    apiUrl(`/medical-data?profile_id=${encodeURIComponent(String(profileId))}&mode=all`),
    { headers: authHeaders(token) }
  );
  const data = await parseJsonOrThrow(resp);
  return {
    period: data?.period === 'Daily' || data?.period === 'Weekly' || data?.period === 'Monthly' || data?.period === 'Latest'
      ? data.period
      : 'Overall',
    source: String(data?.source || ''),
    bp_points: Array.isArray(data?.bp_points) ? data.bp_points : [],
    glucose_points: Array.isArray(data?.glucose_points) ? data.glucose_points : [],
    temp_points: Array.isArray(data?.temp_points) ? data.temp_points : [],
    spo2_points: Array.isArray(data?.spo2_points) ? data.spo2_points : [],
    last_point: data?.last_point && typeof data.last_point === 'object' ? (data.last_point as MedicalTrendLastPoint) : null,
  };
}

export async function getHealthReportData(token: string, profileId: number): Promise<HealthReportDataResponse> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/health-report-data`), {
    headers: authHeaders(token),
  });
  const data = await parseJsonOrThrow(resp);
  return {
    profile: {
      id: Number(data?.profile?.id || profileId),
      profile_label: data?.profile?.profile_label ?? null,
    },
    generated_at: String(data?.generated_at || new Date().toISOString()),
    table_sources: data?.table_sources && typeof data.table_sources === 'object' ? data.table_sources : {},
    tables: {
      medical_general_info: Array.isArray(data?.tables?.medical_general_info) ? data.tables.medical_general_info : [],
      medical_data_raw: Array.isArray(data?.tables?.medical_data_raw) ? data.tables.medical_data_raw : [],
      medical_data_daily: Array.isArray(data?.tables?.medical_data_daily) ? data.tables.medical_data_daily : [],
      medical_data_archeive: Array.isArray(data?.tables?.medical_data_archeive) ? data.tables.medical_data_archeive : [],
      medical_events: Array.isArray(data?.tables?.medical_events) ? data.tables.medical_events : [],
      medical_events_archive: Array.isArray(data?.tables?.medical_events_archive) ? data.tables.medical_events_archive : [],
    },
  };
}

/**
 * Get a summary of medical data stored for a profile.
 * @param token - Auth token
 * @param profileId - Profile ID
 */
export async function getMedicalDataSummary(token: string, profileId: number): Promise<MedicalDataSummary> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/medical-data-summary`), {
    headers: authHeaders(token),
  });
  const data = await parseJsonOrThrow(resp);
  return data?.summary || {
    profile_id: profileId,
    profile_label: '',
    general_info_count: 0,
    raw_data_count: 0,
    daily_data_count: 0,
    archive_data_count: 0,
    events_archive_count: 0,
  };
}

/**
 * Delete medical data for a profile by category.
 * @param token - Auth token
 * @param profileId - Profile ID
 * @param category - Data category (general, raw, daily, archive, events_archive)
 */
export async function deleteMedicalData(
  token: string,
  profileId: number,
  category: string,
  opts?: { period?: DeleteMedicalDataPeriod; fromTs?: number | string; toTs?: number | string }
): Promise<void> {
  const period = opts?.period || 'all';
  const params = [`period=${encodeURIComponent(period)}`];
  if (period === 'custom') {
    if (opts?.fromTs != null) params.push(`from_ts=${encodeURIComponent(String(opts.fromTs))}`);
    if (opts?.toTs != null) params.push(`to_ts=${encodeURIComponent(String(opts.toTs))}`);
  }

  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/medical-data/${category}?${params.join('&')}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonOrThrow(resp);
}

export async function getProfileReminders(token: string, profileId: number): Promise<ProfileReminder[]> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/reminders`), {
    headers: authHeaders(token),
  });
  const data = await parseJsonOrThrow(resp);
  return Array.isArray(data?.reminders) ? data.reminders : [];
}

export async function createProfileReminder(
  token: string,
  profileId: number,
  payload: CreateReminderPayload
): Promise<ProfileReminder> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/reminders`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(resp);
  if (!data?.reminder) throw new Error('Reminder not returned by server');
  return data.reminder as ProfileReminder;
}

export async function updateProfileReminder(
  token: string,
  profileId: number,
  reminderId: number,
  payload: Partial<CreateReminderPayload>
): Promise<ProfileReminder> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/reminders/${reminderId}`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(resp);
  if (!data?.reminder) throw new Error('Reminder not returned by server');
  return data.reminder as ProfileReminder;
}

export async function deleteProfileReminder(token: string, profileId: number, reminderId: number): Promise<void> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/reminders/${reminderId}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonOrThrow(resp);
}

export async function getProfileGoals(token: string, profileId: number): Promise<ProfileGoal[]> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/goals`), {
    headers: authHeaders(token),
  });
  const data = await parseJsonOrThrow(resp);
  return Array.isArray(data?.goals) ? data.goals : [];
}

/**
 * Mark a profile as used on the server (updates `last_used`).
 * This is best-effort: throws on network/auth errors.
 */
export async function markProfileUsed(token: string, profileId: number, fromProfileId?: number | null): Promise<any> {
  const body: any = {};
  if (fromProfileId != null) body.from_profile_id = fromProfileId;
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/use`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await parseJsonOrThrow(resp);
  return data;
}

export async function createProfileGoal(token: string, profileId: number, payload: CreateGoalPayload): Promise<ProfileGoal> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/goals`), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(resp);
  if (!data?.goal) throw new Error('Goal not returned by server');
  return data.goal as ProfileGoal;
}

export async function updateProfileGoal(
  token: string,
  profileId: number,
  goalId: number,
  payload: Partial<CreateGoalPayload>
): Promise<ProfileGoal> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/goals/${goalId}`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(resp);
  if (!data?.goal) throw new Error('Goal not returned by server');
  return data.goal as ProfileGoal;
}

export async function updateProfileGoalStatus(
  token: string,
  profileId: number,
  goalId: number,
  status: ProfileGoal['status']
): Promise<ProfileGoal> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/goals/${goalId}/status`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });
  const data = await parseJsonOrThrow(resp);
  if (!data?.goal) throw new Error('Goal not returned by server');
  return data.goal as ProfileGoal;
}

export async function deleteProfileGoal(token: string, profileId: number, goalId: number): Promise<void> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}/goals/${goalId}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseJsonOrThrow(resp);
}

export async function deleteProfile(token: string, profileId: number): Promise<any> {
  const resp = await fetchWithTimeout(apiUrl(`/profiles/${profileId}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return await parseJsonOrThrow(resp);
}

export async function deleteMyAccount(token: string): Promise<any> {
  const resp = await fetchWithTimeout(apiUrl('/users/me'), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return await parseJsonOrThrow(resp);
}
