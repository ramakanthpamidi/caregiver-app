import { getSecureItem, multiRemoveSecureItems, setSecureItem } from '../storage/secureLocalStorage';
import type { MedicalGeneralInfoPayload, ProfileSummary, MedicalDataSnapshot, ProfileConsentsPayload } from '../../features/profiles/api/profileApi';
import type { CreateGoalPayload, CreateReminderPayload } from '../../features/profiles/api/profileApi';
import {
  createProfileWithMedical,
  upsertMedicalGeneral,
  sendMedicalData,
  API_BASE_URL,
  createProfileReminder,
  createProfileGoal,
  updateProfileReminder,
  deleteProfileReminder,
  updateProfileGoal,
  deleteProfileGoal,
} from '../../features/profiles/api/profileApi';
import { addOrUpdateCachedProfile, replaceCachedProfileId } from '../../features/profiles/storage/profileCache';
import { migrateProfileAvatarId } from '../../features/profiles/lib/profileAvatar';
import { replaceCachedReminderId, addOrUpdateCachedReminder, removeCachedReminder } from '../../features/profiles/storage/reminderCache';
import { replaceCachedGoalId, addOrUpdateCachedGoal, removeCachedGoal } from '../../features/profiles/storage/goalCache';

const KEY_OUTBOX = 'outbox.v1';
const KEY_LOCAL_ID_MAP = 'outbox.localIdMap.v1';

const outboxListeners = new Set<() => void>();

function emitOutboxChanged(): void {
  for (const listener of Array.from(outboxListeners)) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeOutboxChanges(listener: () => void): () => void {
  outboxListeners.add(listener);
  return () => {
    outboxListeners.delete(listener);
  };
}

export async function clearOutbox(): Promise<void> {
  await multiRemoveSecureItems([KEY_OUTBOX, KEY_LOCAL_ID_MAP]);
  emitOutboxChanged();
}

export async function purgeOutboxForProfileDataDeletion(params: {
  profileId: number;
  categories: Array<'general' | 'medical_data' | 'alerts'>;
  fromTs?: number | null;
  toTs?: number | null;
}): Promise<number> {
  const { profileId, categories, fromTs = null, toTs = null } = params;
  const removeGeneral = categories.includes('general');
  const removeMedicalData = categories.includes('medical_data');
  const removeAlerts = categories.includes('alerts');

  const ops = await getOutbox();
  const kept = ops.filter((op) => {
    if (removeGeneral && op.type === 'upsert_medical_general') {
      return Number(op.payload.profileId) !== Number(profileId);
    }

    if (removeMedicalData && op.type === 'medical_data') {
      if (Number(op.payload.profile_id) !== Number(profileId)) return true;
      const ts = Number(op.payload.ts) || 0;
      if (fromTs != null && ts < fromTs) return true;
      if (toTs != null && ts >= toTs) return true;
      return false;
    }

    if (removeAlerts && op.type === 'medical_event') {
      if (Number(op.payload.profile_id) !== Number(profileId)) return true;
      const ts = Number(op.payload.ts) || 0;
      if (fromTs != null && ts < fromTs) return true;
      if (toTs != null && ts >= toTs) return true;
      return false;
    }

    return true;
  });

  const removed = ops.length - kept.length;
  if (removed > 0) {
    await setOutbox(kept);
  }
  return removed;
}

export async function purgeOutboxForDeletedProfile(profileId: number): Promise<number> {
  const ops = await getOutbox();

  const kept = ops.filter((op) => {
    if (op.type === 'upsert_medical_general') {
      return Number(op.payload.profileId) !== Number(profileId);
    }

    if (op.type === 'medical_data' || op.type === 'medical_event') {
      return Number(op.payload.profile_id) !== Number(profileId);
    }

    if ((op as any).type === 'create_reminder') {
      return Number((op as any).payload.profileId) !== Number(profileId);
    }
    if ((op as any).type === 'update_reminder') {
      return Number((op as any).payload.profileId) !== Number(profileId);
    }
    if ((op as any).type === 'delete_reminder') {
      return Number((op as any).payload.profileId) !== Number(profileId);
    }
    if ((op as any).type === 'create_goal') {
      return Number((op as any).payload.profileId) !== Number(profileId);
    }
    if ((op as any).type === 'update_goal') {
      return Number((op as any).payload.profileId) !== Number(profileId);
    }
    if ((op as any).type === 'delete_goal') {
      return Number((op as any).payload.profileId) !== Number(profileId);
    }

    return true;
  });

  const removed = ops.length - kept.length;
  if (removed > 0) {
    await setOutbox(kept);
  }
  return removed;
}

// Device addition payload for offline queue
export type DeviceAddPayload = {
  device_id?: string;
  device_name: string;
  factory_name?: string;
  device_type?: string;
  medical_device_type?: string;
  comm_protocol?: string;
  platform?: string;
  ble_id?: string; // local BLE id for tracking
};

// Medical event payload for alerts
export type MedicalEventPayload = {
  device_id: string;
  profile_id: number;
  ts: number;
  event_type: string;
  payload: Record<string, any>;
  lat?: number | null;
  lng?: number | null;
};

export type OutboxOp =
  | {
      id: string;
      type: 'create_profile_with_medical';
      createdAt: string;
      attemptCount: number;
      payload: {
        localProfileId: number;
        profile_label: string;
        access_password?: string;
        medical_general_info?: MedicalGeneralInfoPayload;
        profile_consents?: ProfileConsentsPayload;
      };
      lastError?: string;
    }
  | {
      id: string;
      type: 'upsert_medical_general';
      createdAt: string;
      attemptCount: number;
      payload: { profileId: number; medical_general_info: MedicalGeneralInfoPayload };
      lastError?: string;
    }
  | {
      id: string;
      type: 'add_device';
      createdAt: string;
      attemptCount: number;
      payload: DeviceAddPayload;
      lastError?: string;
    }
  | {
      id: string;
      type: 'medical_data';
      createdAt: string;
      attemptCount: number;
      payload: MedicalDataSnapshot;
      lastError?: string;
    }
  | {
      id: string;
      type: 'medical_event';
      createdAt: string;
      attemptCount: number;
      payload: MedicalEventPayload;
      lastError?: string;
    };

export type ReminderCreatePayload = {
  localReminderId: number;
  profileId: number;
  reminder: CreateReminderPayload;
};

export type ReminderUpdatePayload = {
  profileId: number;
  reminderId: number;
  patch: Partial<CreateReminderPayload>;
};

export type ReminderDeletePayload = {
  profileId: number;
  reminderId: number;
};

export type GoalCreatePayload = {
  localGoalId: number;
  profileId: number;
  goal: CreateGoalPayload;
};

export type GoalUpdatePayload = {
  profileId: number;
  goalId: number;
  patch: Partial<CreateGoalPayload>;
};

export type GoalDeletePayload = {
  profileId: number;
  goalId: number;
};

export type OutboxOpV2 =
  | OutboxOp
  | {
      id: string;
      type: 'create_reminder';
      createdAt: string;
      attemptCount: number;
      payload: ReminderCreatePayload;
      lastError?: string;
    }
  | {
      id: string;
      type: 'update_reminder';
      createdAt: string;
      attemptCount: number;
      payload: ReminderUpdatePayload;
      lastError?: string;
    }
  | {
      id: string;
      type: 'delete_reminder';
      createdAt: string;
      attemptCount: number;
      payload: ReminderDeletePayload;
      lastError?: string;
    }
  | {
      id: string;
      type: 'create_goal';
      createdAt: string;
      attemptCount: number;
      payload: GoalCreatePayload;
      lastError?: string;
    }
  | {
      id: string;
      type: 'update_goal';
      createdAt: string;
      attemptCount: number;
      payload: GoalUpdatePayload;
      lastError?: string;
    }
  | {
      id: string;
      type: 'delete_goal';
      createdAt: string;
      attemptCount: number;
      payload: GoalDeletePayload;
      lastError?: string;
    };

type LocalIdMap = Record<string, number>; // localId -> serverId

function nowIso() {
  return new Date().toISOString();
}

function newOpId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getOutbox(): Promise<OutboxOpV2[]> {
  const raw = await getSecureItem(KEY_OUTBOX);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setOutbox(ops: OutboxOpV2[]) {
  await setSecureItem(KEY_OUTBOX, JSON.stringify(ops));
  emitOutboxChanged();
}

async function getLocalIdMap(): Promise<LocalIdMap> {
  const raw = await getSecureItem(KEY_LOCAL_ID_MAP);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function setLocalIdMap(map: LocalIdMap) {
  await setSecureItem(KEY_LOCAL_ID_MAP, JSON.stringify(map));
}

export async function mapLocalProfileId(localId: number, serverId: number) {
  const map = await getLocalIdMap();
  map[String(localId)] = serverId;
  await setLocalIdMap(map);
}

export async function resolveProfileId(profileId: number): Promise<number> {
  if (profileId > 0) return profileId;
  const map = await getLocalIdMap();
  const resolved = map[String(profileId)];
  return resolved ? resolved : profileId;
}

export async function enqueueCreateProfileWithMedical(op: {
  localProfileId: number;
  profile_label: string;
  access_password?: string;
  medical_general_info?: MedicalGeneralInfoPayload;
  profile_consents?: ProfileConsentsPayload;
}) {
  const ops = await getOutbox();
  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'create_profile_with_medical',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: op,
    },
  ];
  await setOutbox(next);
}

export async function enqueueUpsertMedicalGeneral(profileId: number, medical_general_info: MedicalGeneralInfoPayload) {
  const ops = await getOutbox();
  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'upsert_medical_general',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: { profileId, medical_general_info },
    },
  ];
  await setOutbox(next);
}

// Queue a device addition for offline sync
export async function enqueueAddDevice(device: DeviceAddPayload) {
  const ops = await getOutbox();
  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'add_device',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: device,
    },
  ];
  await setOutbox(next);
}

// Queue medical data upload for offline sync
export async function enqueueMedicalData(data: MedicalDataSnapshot) {
  const ops = await getOutbox();
  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'medical_data',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: data,
    },
  ];
  await setOutbox(next);
}

// Queue medical event (alert) for offline sync
export async function enqueueMedicalEvent(event: MedicalEventPayload) {
  const ops = await getOutbox();

  const duplicateEvent = ops.some((op) => {
    if (op.type !== 'medical_event') return false;
    const existing = op.payload;
    if (existing.device_id !== event.device_id) return false;
    if (Number(existing.profile_id) !== Number(event.profile_id)) return false;
    if (existing.event_type !== event.event_type) return false;

    const existingSeverity = String(existing.payload?.severity || '');
    const incomingSeverity = String(event.payload?.severity || '');
    if (existingSeverity !== incomingSeverity) return false;

    const existingStatus = String(existing.payload?.status || '');
    const incomingStatus = String(event.payload?.status || '');
    if (existingStatus !== incomingStatus) return false;

    return Math.abs(Number(existing.ts) - Number(event.ts)) < 60000;
  });

  if (duplicateEvent) {
    console.log('[SyncOutbox] Skipping duplicate medical event enqueue');
    return;
  }

  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'medical_event',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: event,
    },
  ];
  await setOutbox(next);
}

export async function enqueueCreateReminder(profileId: number, localReminderId: number, reminder: CreateReminderPayload) {
  const ops = await getOutbox();
  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'create_reminder',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: { profileId, localReminderId, reminder },
    },
  ];
  await setOutbox(next);
}

export async function enqueueCreateGoal(profileId: number, localGoalId: number, goal: CreateGoalPayload) {
  const ops = await getOutbox();
  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'create_goal',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: { profileId, localGoalId, goal },
    },
  ];
  await setOutbox(next);
}

export async function enqueueUpdateReminder(profileId: number, reminderId: number, patch: Partial<CreateReminderPayload>) {
  const ops = await getOutbox();

  // If this reminder is still local-only (negative id), update the pending create op instead of adding a new op.
  if (reminderId < 0) {
    const next = ops.map((op) => {
      if ((op as any).type !== 'create_reminder') return op;
      const payload = (op as any).payload as ReminderCreatePayload;
      if (Number(payload.profileId) !== Number(profileId)) return op;
      if (Number(payload.localReminderId) !== Number(reminderId)) return op;
      return {
        ...(op as any),
        payload: { ...payload, reminder: { ...(payload.reminder || {}), ...(patch || {}) } },
      };
    });
    await setOutbox(next);
    return;
  }

  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'update_reminder',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: { profileId, reminderId, patch },
    },
  ];
  await setOutbox(next);
}

export async function enqueueDeleteReminder(profileId: number, reminderId: number) {
  const ops = await getOutbox();

  // If it's not synced yet, drop the pending create op.
  if (reminderId < 0) {
    const next = ops.filter((op) => {
      if ((op as any).type !== 'create_reminder') return true;
      const payload = (op as any).payload as ReminderCreatePayload;
      return !(Number(payload.profileId) === Number(profileId) && Number(payload.localReminderId) === Number(reminderId));
    });
    await setOutbox(next);
    return;
  }

  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'delete_reminder',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: { profileId, reminderId },
    },
  ];
  await setOutbox(next);
}

export async function enqueueUpdateGoal(profileId: number, goalId: number, patch: Partial<CreateGoalPayload>) {
  const ops = await getOutbox();

  if (goalId < 0) {
    const next = ops.map((op) => {
      if ((op as any).type !== 'create_goal') return op;
      const payload = (op as any).payload as GoalCreatePayload;
      if (Number(payload.profileId) !== Number(profileId)) return op;
      if (Number(payload.localGoalId) !== Number(goalId)) return op;
      return {
        ...(op as any),
        payload: { ...payload, goal: { ...(payload.goal || {}), ...(patch || {}) } },
      };
    });
    await setOutbox(next);
    return;
  }

  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'update_goal',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: { profileId, goalId, patch },
    },
  ];
  await setOutbox(next);
}

export async function enqueueDeleteGoal(profileId: number, goalId: number) {
  const ops = await getOutbox();

  if (goalId < 0) {
    const next = ops.filter((op) => {
      if ((op as any).type !== 'create_goal') return true;
      const payload = (op as any).payload as GoalCreatePayload;
      return !(Number(payload.profileId) === Number(profileId) && Number(payload.localGoalId) === Number(goalId));
    });
    await setOutbox(next);
    return;
  }

  const next: OutboxOpV2[] = [
    ...ops,
    {
      id: newOpId(),
      type: 'delete_goal',
      createdAt: nowIso(),
      attemptCount: 0,
      payload: { profileId, goalId },
    },
  ];
  await setOutbox(next);
}

export type RunOutboxResult = {
  successCount: number;
  failCount: number;
  remainingCount: number;
  lastError?: string;
};

function isPermanentConflictError(err: any): boolean {
  const msg = err?.message ? String(err.message) : '';
  // Server uses message text via parseJsonOrThrow.
  return msg.toLowerCase().includes('already exists') || msg.includes('409');
}

export async function runOutbox(token: string): Promise<RunOutboxResult> {
  const ops = await getOutbox();
  if (ops.length === 0) return { successCount: 0, failCount: 0, remainingCount: 0 };

  let successCount = 0;
  let failCount = 0;
  let lastError: string | undefined;

  const remaining: OutboxOpV2[] = [];

  for (const op of ops) {
    const attemptCount = (op.attemptCount || 0) + 1;
    try {
      if ((op as any).type === 'create_reminder') {
        const payload = (op as any).payload as ReminderCreatePayload;
        const resolvedProfileId = await resolveProfileId(payload.profileId);
        if (resolvedProfileId <= 0) {
          remaining.push({ ...(op as any), attemptCount, lastError: 'waiting for profile sync' });
          continue;
        }

        const created = await createProfileReminder(token, resolvedProfileId, payload.reminder);
        await replaceCachedReminderId(payload.profileId, payload.localReminderId, { ...(created as any), local_only: false });
        successCount += 1;
        continue;
      }

      if ((op as any).type === 'create_goal') {
        const payload = (op as any).payload as GoalCreatePayload;
        const resolvedProfileId = await resolveProfileId(payload.profileId);
        if (resolvedProfileId <= 0) {
          remaining.push({ ...(op as any), attemptCount, lastError: 'waiting for profile sync' });
          continue;
        }

        const created = await createProfileGoal(token, resolvedProfileId, payload.goal);
        await replaceCachedGoalId(payload.profileId, payload.localGoalId, { ...(created as any), local_only: false });
        successCount += 1;
        continue;
      }

      if ((op as any).type === 'update_reminder') {
        const payload = (op as any).payload as ReminderUpdatePayload;
        const resolvedProfileId = await resolveProfileId(payload.profileId);
        if (resolvedProfileId <= 0) {
          remaining.push({ ...(op as any), attemptCount, lastError: 'waiting for profile sync' });
          continue;
        }
        const updated = await updateProfileReminder(token, resolvedProfileId, payload.reminderId, payload.patch);
        await addOrUpdateCachedReminder(payload.profileId, { ...(updated as any), local_only: false });
        successCount += 1;
        continue;
      }

      if ((op as any).type === 'delete_reminder') {
        const payload = (op as any).payload as ReminderDeletePayload;
        const resolvedProfileId = await resolveProfileId(payload.profileId);
        if (resolvedProfileId <= 0) {
          remaining.push({ ...(op as any), attemptCount, lastError: 'waiting for profile sync' });
          continue;
        }
        await deleteProfileReminder(token, resolvedProfileId, payload.reminderId);
        await removeCachedReminder(payload.profileId, payload.reminderId);
        successCount += 1;
        continue;
      }

      if ((op as any).type === 'update_goal') {
        const payload = (op as any).payload as GoalUpdatePayload;
        const resolvedProfileId = await resolveProfileId(payload.profileId);
        if (resolvedProfileId <= 0) {
          remaining.push({ ...(op as any), attemptCount, lastError: 'waiting for profile sync' });
          continue;
        }
        const updated = await updateProfileGoal(token, resolvedProfileId, payload.goalId, payload.patch);
        await addOrUpdateCachedGoal(payload.profileId, { ...(updated as any), local_only: false });
        successCount += 1;
        continue;
      }

      if ((op as any).type === 'delete_goal') {
        const payload = (op as any).payload as GoalDeletePayload;
        const resolvedProfileId = await resolveProfileId(payload.profileId);
        if (resolvedProfileId <= 0) {
          remaining.push({ ...(op as any), attemptCount, lastError: 'waiting for profile sync' });
          continue;
        }
        await deleteProfileGoal(token, resolvedProfileId, payload.goalId);
        await removeCachedGoal(payload.profileId, payload.goalId);
        successCount += 1;
        continue;
      }

      if (op.type === 'create_profile_with_medical') {
        const payload = op.payload;
        const result = await createProfileWithMedical(token, {
          profile_label: payload.profile_label,
          access_password: payload.access_password,
          medical_general_info: payload.medical_general_info,
          profile_consents: payload.profile_consents,
        });

        const serverProfile = result.profile as ProfileSummary;
        await mapLocalProfileId(payload.localProfileId, serverProfile.id);
        await replaceCachedProfileId(payload.localProfileId, { ...serverProfile, local_only: false });
        await migrateProfileAvatarId(payload.localProfileId, serverProfile.id);
        successCount += 1;
        continue;
      }

      if (op.type === 'upsert_medical_general') {
        const resolvedId = await resolveProfileId(op.payload.profileId);
        if (resolvedId <= 0) {
          // Profile not synced yet; keep op.
          remaining.push({ ...op, attemptCount, lastError: 'waiting for profile sync' });
          continue;
        }
        await upsertMedicalGeneral(token, resolvedId, op.payload.medical_general_info);
        successCount += 1;
        continue;
      }

      // Handle device addition
      if (op.type === 'add_device') {
        const payload = op.payload;
        const resp = await fetch(`${API_BASE_URL}/devices`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_id: payload.device_id,
            device_name: payload.device_name,
            factory_name: payload.factory_name || payload.device_name,
            device_type: payload.device_type || 'Medical',
            medical_device_type: payload.medical_device_type,
            comm_protocol: payload.comm_protocol || 'BLE',
            platform: payload.platform || 'Yuwell',
          }),
        });

        if (!resp.ok) {
          const text = await resp.text();
          let data: any = null;
          try { data = JSON.parse(text); } catch {}
          const msg = data?.error || data?.message || `Device sync failed (status ${resp.status})`;
          // If device already exists, treat as success
          if (resp.status === 409 || (msg && msg.toLowerCase().includes('already'))) {
            console.log('[SyncOutbox] Device already exists, treating as success');
            successCount += 1;
            continue;
          }
          throw new Error(msg);
        }
        console.log('[SyncOutbox] Device synced successfully:', payload.device_name);
        successCount += 1;
        continue;
      }

      // Handle medical data upload
      if (op.type === 'medical_data') {
        const payload = op.payload;
        // Resolve profile ID in case it was a local stub
        const resolvedProfileId = await resolveProfileId(payload.profile_id);
        if (resolvedProfileId <= 0) {
          // Profile not synced yet; keep op.
          remaining.push({ ...op, attemptCount, lastError: 'waiting for profile sync' });
          continue;
        }
        await sendMedicalData(token, {
          device_id: payload.device_id,
          profile_id: resolvedProfileId,
          ts: payload.ts,
          snapshot: payload.snapshot,
          lat: payload.lat ?? null,
          lng: payload.lng ?? null,
        });
        console.log('[SyncOutbox] Medical data synced:', payload.device_id, payload.snapshot?.type);
        successCount += 1;
        continue;
      }

      // Handle medical event (alert) upload
      if (op.type === 'medical_event') {
        const payload = op.payload;
        // Resolve profile ID in case it was a local stub
        const resolvedProfileId = await resolveProfileId(payload.profile_id);
        if (resolvedProfileId <= 0) {
          // Profile not synced yet; keep op.
          remaining.push({ ...op, attemptCount, lastError: 'waiting for profile sync' });
          continue;
        }
        
        const resp = await fetch(`${API_BASE_URL}/medical-events`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_id: payload.device_id,
            profile_id: resolvedProfileId,
            ts: payload.ts,
            event_type: payload.event_type,
            payload: payload.payload,
            ...(payload.lat != null && { lat: payload.lat }),
            ...(payload.lng != null && { lng: payload.lng }),
          }),
        });

        if (!resp.ok) {
          const text = await resp.text();
          let data: any = null;
          try { data = JSON.parse(text); } catch {}
          const msg = data?.error || data?.message || `Medical event sync failed (status ${resp.status})`;
          throw new Error(msg);
        }
        console.log('[SyncOutbox] Medical event synced:', payload.device_id, payload.event_type);
        successCount += 1;
        continue;
      }

      // Unknown op: drop it.
      successCount += 1;
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : 'sync failed';
      lastError = msg;
      failCount += 1;

      // If it's a permanent conflict (e.g., duplicate name), keep it but mark error and stop retrying aggressively.
      if (isPermanentConflictError(err)) {
        remaining.push({ ...(op as any), attemptCount, lastError: msg });
        continue;
      }

      // Retry a few times; otherwise keep it for future.
      remaining.push({ ...(op as any), attemptCount, lastError: msg });
    }
  }

  await setOutbox(remaining);
  return { successCount, failCount, remainingCount: remaining.length, lastError };
}

export async function cacheLocalProfileStub(stub: { id: number; profile_label: string; created_at?: string }) {
  await addOrUpdateCachedProfile({
    id: stub.id,
    profile_label: stub.profile_label,
    owner_user_id: -1,
    created_at: stub.created_at || nowIso(),
    local_only: true,
  });
}
