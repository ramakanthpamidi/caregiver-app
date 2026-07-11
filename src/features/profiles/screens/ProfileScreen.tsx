import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Pressable, Platform, StatusBar, Modal, Alert } from 'react-native';
import { InteractionManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getCachedProfiles, CachedProfile, setCachedProfiles } from '../storage/profileCache';
import {
  getMyProfiles,
  API_BASE_URL,
  getProfileGoals,
  getProfileReminders,
  getProfileConsents,
  getMedicalGeneral,
  getMedicalDataRaw,
  markProfileUsed,
  updateProfileReminder,
  deleteProfileReminder,
  updateProfileGoal,
  deleteProfileGoal,
  createProfileReminder,
  createProfileGoal,
  type MedicalDataRawRow,
  type ProfileConsentsPayload,
} from '../api/profileApi';
import { showToast } from '../../../shared/ui/toast';
import { getAllProfileAvatars, type ProfileAvatar } from '../lib/profileAvatar';
import {
  emitProfilesUpdated,
  emitTrendsRefresh,
  setActiveProfileId as setActiveProfileIdGlobal,
  subscribeProfileAvatarsUpdated,
  subscribeProfilesUpdated,
} from '../lib/profileEvents';
import SubProfileCard from '../components/SubProfileCard';
import EditProfileScreen from './EditProfileScreen';
import CroppedAvatarImage from '../../../shared/components/CroppedAvatarImage';
import CreateProfileFlowOverlay from '../components/CreateProfileFlowOverlay';
import { LinearGradient } from 'expo-linear-gradient';
import { useTabNavigationActions } from '../../../shared/navigation/tabNavigation';
import { styles, PROFILE_BOTTOM_PADDING, PROFILE_SHEET_BOTTOM_PADDING } from './ProfileScreen.styles';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { getInitialsFromName, getSavedAvatarColor, getAvatarColorForProfile, getCachedAvatarColor } from '../lib/avatarColors';
import ProfilePasswordDialog from '../components/ProfilePasswordDialog';
import ReminderSectionCard from '../components/ReminderSectionCard';
import GoalSectionCard from '../components/GoalSectionCard';
import ReminderDialog, { type ReminderDialogValues } from '../components/ReminderDialog';
import GoalDialog, { type GoalDialogValues } from '../components/GoalDialog';
import ReminderCard from '../components/ReminderCard';
import GoalCard from '../components/GoalCard';
import { DialogPortalProvider } from '../../../shared/components/DialogPortalProvider';
import { addOrUpdateCachedReminder, getCachedReminders, newLocalReminderId, setCachedReminders, removeCachedReminder, replaceCachedReminderId, type CachedReminder } from '../storage/reminderCache';
import { addOrUpdateCachedGoal, getCachedGoals, newLocalGoalId, setCachedGoals, removeCachedGoal, replaceCachedGoalId, type CachedGoal } from '../storage/goalCache';
import { enqueueCreateGoal, enqueueCreateReminder, enqueueDeleteGoal, enqueueDeleteReminder, enqueueUpdateGoal, enqueueUpdateReminder, getOutbox } from '../../../shared/sync/syncOutbox';
import { cancelReminderNotification, scheduleReminderNotification } from '../../../shared/notifications/localNotifications';

type Props = {
  setIsLoggedIn?: (v: boolean) => void;
  openCreateProfileFlow?: () => void;
};

type PropsWithSuppress = Props & { 
  suppressLoadingIndicator?: boolean; 
  sheetMode?: boolean;
  collapsedHeight?: number;
  onClosePress?: () => void;
};

function ProfileScreen({ 
  setIsLoggedIn, 
  suppressLoadingIndicator, 
  sheetMode,
  collapsedHeight,
  openCreateProfileFlow,
  onClosePress,
}: PropsWithSuppress) {
  const { lang } = useLanguage();
  const [profiles, setProfiles] = useState<CachedProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(!suppressLoadingIndicator);
  const [avatarMap, setAvatarMap] = useState<Record<string, ProfileAvatar>>({});
  const [editing, setEditing] = useState(false);
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<CachedProfile | null>(null);

  const [reminders, setReminders] = useState<CachedReminder[]>([]);
  const [goals, setGoals] = useState<CachedGoal[]>([]);

  const [activeConsents, setActiveConsents] = useState<ProfileConsentsPayload | null>(null);
  const [activeMedicalGeneral, setActiveMedicalGeneral] = useState<any | null>(null);
  const [activeMedicalRaw, setActiveMedicalRaw] = useState<MedicalDataRawRow[]>([]);

  const [addReminderOpen, setAddReminderOpen] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);

  const [editingReminder, setEditingReminder] = useState<CachedReminder | null>(null);
  const [editingGoal, setEditingGoal] = useState<CachedGoal | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const openAddProfileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addReminderInFlightRef = useRef(false);
  const addGoalInFlightRef = useRef(false);
  const editReminderInFlightRef = useRef(false);
  const editGoalInFlightRef = useRef(false);
  
  // Keep hook order stable: always call useTabNavigation.
  const tabNav = useTabNavigationActions();
  const profileSheetHeader = sheetMode ? tabNav.profileSheetHeader : undefined;

  const loadProfiles = useCallback(async (opts?: { emit?: boolean }) => {
    try {
      // 1) Load cached first (fast)
      const cached = await getCachedProfiles();
      setProfiles(cached);

      try {
        const avatars = await getAllProfileAvatars();
        setAvatarMap(avatars);
      } catch {
        // ignore
      }

      // Get active profile ID
      const activeId = await AsyncStorage.getItem('activeProfileId');
      if (activeId) {
        setActiveProfileId(Number(activeId));
      } else if (cached.length > 0) {
        setActiveProfileId(Number(cached[0].id));
      }

      // 2) Refresh from backend (best-effort)
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          const remote = await getMyProfiles(token);
          const mapped: CachedProfile[] = remote.map((p) => ({
            id: p.id,
            profile_label: p.profile_label,
            owner_user_id: p.owner_user_id,
            created_at: p.created_at,
            last_used: p.last_used,
            has_access_password: !!p.has_access_password,
          }));
          setProfiles(mapped);
          try {
            await setCachedProfiles(mapped);
          } catch {}
          if (opts?.emit !== false) emitProfilesUpdated();
          if (!activeId && mapped.length > 0) {
            setActiveProfileId(Number(mapped[0].id));
          }
        }
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : 'Failed to refresh profiles';
        showToast(msg, 'info');
      }
    } catch (e) {
      console.warn('Failed to load profiles:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer heavy work until after initial interactions to reduce startup jank.
    const handle = InteractionManager.runAfterInteractions(() => {
      loadProfiles();
    });
    return () => {
      try {
        (handle as any)?.cancel?.();
      } catch {
        // ignore
      }
    };
  }, [loadProfiles]);

  // Refresh this screen whenever another screen updates profiles (e.g., CreateProfileScreen)
  useEffect(() => {
    const unsub = subscribeProfilesUpdated(() => {
      loadProfiles({ emit: false });
    });
    return unsub;
  }, [loadProfiles]);

  // Refresh avatars immediately when a custom avatar is saved/removed.
  useEffect(() => {
    const unsub = subscribeProfileAvatarsUpdated(() => {
      getAllProfileAvatars()
        .then(setAvatarMap)
        .catch(() => {
          // ignore
        });
    });
    return unsub;
  }, []);

  // Get active profile and other profiles
  const activeProfile = profiles.find((p) => Number(p.id) === activeProfileId);
  const allProfiles = profiles;

  const activeAvatarUri = useMemo(() => {
    if (activeProfileId == null) return null;
    return avatarMap[String(activeProfileId)] || null;
  }, [activeProfileId, avatarMap]);

  const initials = useMemo(() => {
    return getInitialsFromName(activeProfile?.profile_label || '');
  }, [activeProfile?.profile_label]);

  const [savedAvatarColor, setSavedAvatarColor] = useState<string | null>(null);

  useEffect(() => {
    if (activeProfile) {
      const name = (activeProfile.profile_label || 'Profile').trim() || 'Profile';
      setSavedAvatarColor(getCachedAvatarColor(activeProfile.id));
      getSavedAvatarColor(activeProfile.id, name).then((c) => setSavedAvatarColor(c));
    }
  }, [activeProfile]);

  const avatarColor = useMemo(() => {
    if (savedAvatarColor) return savedAvatarColor;
    if (activeProfile) {
      const cached = getCachedAvatarColor(activeProfile.id);
      if (cached) return cached;
      const name = (activeProfile.profile_label || 'Profile').trim() || 'Profile';
      return getAvatarColorForProfile(name);
    }
    return '#3B82F6';
  }, [savedAvatarColor, activeProfile]);

  // Horizontal paging for profiles list (kept late to preserve hook order across Fast Refresh)
  const [profilesPagerWidth, setProfilesPagerWidth] = useState<number>(0);
  const [profilesPageIndex, setProfilesPageIndex] = useState<number>(0);

  const profilePages: CachedProfile[][] = useMemo(() => {
    const pages: CachedProfile[][] = [];
    const pageSize = 4;
    for (let i = 0; i < allProfiles.length; i += pageSize) {
      pages.push(allProfiles.slice(i, i + pageSize));
    }
    return pages;
  }, [allProfiles]);

  useEffect(() => {
    const maxIndex = Math.max(0, profilePages.length - 1);
    if (profilesPageIndex > maxIndex) setProfilesPageIndex(maxIndex);
  }, [profilePages.length, profilesPageIndex]);

  const handleProfilePress = async (profileId: number) => {
    if (activeProfileId != null && Number(activeProfileId) === Number(profileId)) {
      // Already active; don't re-prompt for password.
      return;
    }

    const profile = profiles.find((p) => Number(p.id) === profileId);
    if (!profile) return;

    // Check if profile has a password
    if (profile.has_access_password) {
      // Show password dialog
      setSelectedProfile(profile);
      setPasswordDialogVisible(true);
    } else {
      // No password, proceed directly
      await switchToProfile(profileId);
    }
  };

  const switchToProfile = async (profileId: number) => {
    try {
      const prevActive = activeProfileId;
      await setActiveProfileIdGlobal(profileId);
      // Best-effort: tell server this profile was used. Do not block UI on failure.
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          await markProfileUsed(token, profileId, prevActive ?? undefined);
        }
      } catch (e) {
        // ignore network errors; last_used will be refreshed on next profile list sync
      }
    } catch {
      // fallback: still update local UI
      await AsyncStorage.setItem('activeProfileId', String(profileId));
    }
    setActiveProfileId(profileId);
  };

  const loadRemindersAndGoals = useCallback(async (pid: number | null) => {
    if (!pid) {
      setReminders([]);
      setGoals([]);
      setActiveConsents(null);
      setActiveMedicalGeneral(null);
      setActiveMedicalRaw([]);
      return;
    }

    try {
      const [localReminders, localGoals] = await Promise.all([getCachedReminders(pid), getCachedGoals(pid)]);
      setReminders(localReminders);
      setGoals(localGoals);

      // Best-effort refresh from backend when online.
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;
        if (pid <= 0) return;

        // Gather pending outbox ops so we don't overwrite un-synced items with stale remote data.
        let pendingDeleteReminderIds = new Set<number>();
        let pendingDeleteGoalIds = new Set<number>();
        let pendingCreateReminderLocalIds = new Set<number>();
        let pendingCreateGoalLocalIds = new Set<number>();
        let pendingUpdateReminderIds = new Set<number>();
        let pendingUpdateGoalIds = new Set<number>();
        try {
          const outbox = await getOutbox();
          for (const op of outbox as any[]) {
            if (Number(op?.payload?.profileId) !== Number(pid)) continue;
            if (op?.type === 'delete_reminder') pendingDeleteReminderIds.add(Number(op?.payload?.reminderId));
            if (op?.type === 'delete_goal') pendingDeleteGoalIds.add(Number(op?.payload?.goalId));
            if (op?.type === 'create_reminder') pendingCreateReminderLocalIds.add(Number(op?.payload?.localReminderId));
            if (op?.type === 'create_goal') pendingCreateGoalLocalIds.add(Number(op?.payload?.localGoalId));
            if (op?.type === 'update_reminder') pendingUpdateReminderIds.add(Number(op?.payload?.reminderId));
            if (op?.type === 'update_goal') pendingUpdateGoalIds.add(Number(op?.payload?.goalId));
          }
        } catch {
          // ignore
        }

        const [remoteReminders, remoteGoals] = await Promise.all([
          getProfileReminders(token, pid).catch(() => []),
          getProfileGoals(token, pid).catch(() => []),
        ]);

        // Fetch medical context for progress computation (best-effort).
        try {
          const consents = await getProfileConsents(token, pid).catch(() => null);
          setActiveConsents(consents);

          if (consents?.consent_granted) {
            const mg = await getMedicalGeneral(token, pid).catch(() => null);
            setActiveMedicalGeneral(mg);
          } else {
            setActiveMedicalGeneral(null);
          }

          const rawRows = await getMedicalDataRaw(token, pid, { limit: 50, offset: 0 }).catch(() => []);
          setActiveMedicalRaw(rawRows);
        } catch {
          // ignore
        }

        if (Array.isArray(remoteReminders)) {
          // Remote items that aren't pending deletion.
          const filteredRemote = (remoteReminders as any[]).filter((r) => !pendingDeleteReminderIds.has(Number((r as any)?.id)));
          // Keep local items only when they have a REAL pending outbox op.
          const localPending = (localReminders as any[]).filter((r) => {
            const id = Number((r as any)?.id);
            if (id < 0) return pendingCreateReminderLocalIds.has(id); // stale negative IDs dropped
            return pendingUpdateReminderIds.has(id); // keep local version if update pending
          });
          const protectedIds = new Set(localPending.map((r) => Number((r as any)?.id)));
          const deduped = filteredRemote.filter((r) => !protectedIds.has(Number((r as any)?.id)));
          const seen = new Set<number>();
          const merged = [...localPending, ...deduped].filter((item) => {
            const id = Number((item as any)?.id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          await setCachedReminders(pid, merged as any);
          setReminders(merged as any);
        }
        if (Array.isArray(remoteGoals)) {
          const filteredRemote = (remoteGoals as any[]).filter((g) => !pendingDeleteGoalIds.has(Number((g as any)?.id)));
          const localPending = (localGoals as any[]).filter((g) => {
            const id = Number((g as any)?.id);
            if (id < 0) return pendingCreateGoalLocalIds.has(id);
            return pendingUpdateGoalIds.has(id);
          });
          const protectedIds = new Set(localPending.map((g) => Number((g as any)?.id)));
          const deduped = filteredRemote.filter((g) => !protectedIds.has(Number((g as any)?.id)));
          const seen = new Set<number>();
          const merged = [...localPending, ...deduped].filter((item) => {
            const id = Number((item as any)?.id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          await setCachedGoals(pid, merged as any);
          setGoals(merged as any);
        }
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }, []);

  const normalizeGoalTypeLabel = useCallback((value: any): string => {
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
  }, []);

  const parseSnapshotObject = useCallback((input: any): any | null => {
    if (!input) return null;
    if (typeof input === 'object') return input;
    if (typeof input === 'string') {
      const raw = input.trim();
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const pickLatestMeasurement = useCallback(
    (kind: 'bp' | 'bg') => {
      const rows = Array.isArray(activeMedicalRaw) ? activeMedicalRaw : [];
      for (const r of rows) {
        const snap = parseSnapshotObject((r as any)?.snapshot);
        if (!snap) continue;

        const declaredTypeRaw = (snap as any)?.type ?? (snap as any)?.measurementType ?? (snap as any)?.kind ?? null;
        const declaredType = declaredTypeRaw ? String(declaredTypeRaw).trim().toLowerCase() : '';
        if (kind === 'bp' && declaredType && declaredType !== 'bp' && declaredType !== 'blood_pressure' && declaredType !== 'blood pressure') {
          continue;
        }
        if (
          kind === 'bg' &&
          declaredType &&
          declaredType !== 'bg' &&
          declaredType !== 'blood_glucose' &&
          declaredType !== 'blood glucose' &&
          declaredType !== 'glucose'
        ) {
          continue;
        }

        const findNumber = (keys: string[]) => {
          for (const k of keys) {
            const v = (snap as any)[k];
            const n = typeof v === 'number' ? v : Number(v);
            if (Number.isFinite(n)) return n;
          }
          return null;
        };

        if (kind === 'bp') {
          const sys =
            findNumber(['systolic', 'sys', 'sbp', 'systolic_mmHg', 'systolicMmhg']) ??
            findNumber(['bloodPressureSystolic', 'blood_pressure_systolic']);
          const dia =
            findNumber(['diastolic', 'dia', 'dbp', 'diastolic_mmHg', 'diastolicMmhg']) ??
            findNumber(['bloodPressureDiastolic', 'blood_pressure_diastolic']);

          const nested = (snap as any).bloodPressure || (snap as any).blood_pressure || null;
          const sys2 = sys ?? (nested ? Number(nested.systolic ?? nested.sys ?? nested.sbp) : NaN);
          const dia2 = dia ?? (nested ? Number(nested.diastolic ?? nested.dia ?? nested.dbp) : NaN);

          if (Number.isFinite(sys2) && Number.isFinite(dia2)) {
            return { systolic: sys2, diastolic: dia2 };
          }
        }

        if (kind === 'bg') {
          const v =
            findNumber(['glucose', 'blood_glucose', 'bloodGlucose', 'bg', 'glucose_mg_dl', 'glucoseMgDl', 'mgdl']) ??
            (snap?.glucose?.value !== undefined ? Number(snap.glucose.value) : NaN);

          if (Number.isFinite(v)) {
            return { value: v };
          }
        }
      }
      return null;
    },
    [activeMedicalRaw, parseSnapshotObject]
  );

  const computeGoalProgressFromMedical = useCallback(
    (g: CachedGoal): number | null => {
      const gt = normalizeGoalTypeLabel(g.goal_type);
      const target = (g as any)?.target;

      const clampPct = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
      const closenessPct = (current: number, targetValue: number) => {
        if (!Number.isFinite(current) || !Number.isFinite(targetValue) || current <= 0 || targetValue <= 0) return null;
        const ratio = Math.min(current / targetValue, targetValue / current);
        return clampPct(ratio * 100);
      };
      const lowerIsBetterPct = (current: number, targetValue: number) => {
        if (!Number.isFinite(current) || !Number.isFinite(targetValue) || current <= 0 || targetValue <= 0) return null;
        if (current <= targetValue) return 100;
        return clampPct((targetValue / current) * 100);
      };

      if (gt === 'Weight' || gt === 'Height' || gt === 'BMI') {
        if (!activeConsents?.consent_granted) return null;
        const mg = activeMedicalGeneral;
        if (!mg || typeof mg !== 'object') return null;

        const weightKg = mg.weight_kg !== undefined && mg.weight_kg !== null ? Number(mg.weight_kg) : NaN;
        const heightCm = mg.height_cm !== undefined && mg.height_cm !== null ? Number(mg.height_cm) : NaN;
        const heightM = Number.isFinite(heightCm) && heightCm > 0 ? heightCm / 100 : NaN;
        const bmi = Number.isFinite(weightKg) && Number.isFinite(heightM) && heightM > 0 ? weightKg / (heightM * heightM) : NaN;

        const current = gt === 'Weight' ? weightKg : gt === 'Height' ? heightCm : bmi;
        const tv = target && typeof target === 'object' ? Number(target.value) : NaN;
        if (!Number.isFinite(tv)) return null;
        return closenessPct(current, tv);
      }

      if (gt === 'Blood pressure') {
        const m = pickLatestMeasurement('bp');
        if (!m) return null;
        const curSys = Number((m as any).systolic);
        const curDia = Number((m as any).diastolic);
        const tarSys = target && typeof target === 'object' ? Number(target.systolic) : NaN;
        const tarDia = target && typeof target === 'object' ? Number(target.diastolic) : NaN;
        const p1 = lowerIsBetterPct(curSys, tarSys);
        const p2 = lowerIsBetterPct(curDia, tarDia);
        if (p1 == null || p2 == null) return null;
        return Math.min(p1, p2);
      }

      if (gt === 'Blood glucose level') {
        const m = pickLatestMeasurement('bg');
        if (!m) return null;
        const cur = Number((m as any).value);
        const tv = target && typeof target === 'object' ? Number(target.value) : NaN;
        if (!Number.isFinite(cur) || !Number.isFinite(tv)) return null;
        return closenessPct(cur, tv);
      }

      return null;
    },
    [activeConsents?.consent_granted, activeMedicalGeneral, normalizeGoalTypeLabel, pickLatestMeasurement]
  );

  useEffect(() => {
    loadRemindersAndGoals(activeProfileId);
  }, [activeProfileId, loadRemindersAndGoals]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, []);

  const openAddReminder = useCallback(() => {
    if (!activeProfileId) {
      showToast(t(lang, 'select_profile_first'), 'info');
      return;
    }
    setEditingReminder(null);
    setAddReminderOpen(true);
  }, [activeProfileId]);

  const submitAddReminder = useCallback(
    async (values: ReminderDialogValues) => {
      const pid = activeProfileId;
      if (!pid) {
        showToast(t(lang, 'select_profile_first'), 'info');
        return;
      }

      if (addReminderInFlightRef.current) return;
      addReminderInFlightRef.current = true;

      try {

        const title = values.title.trim();
        const description = values.description.trim() || null;
        const enabled = values.enabled !== false;

        const hh = String(values.time.getHours()).padStart(2, '0');
        const mm = String(values.time.getMinutes()).padStart(2, '0');
        const time_of_day = `${hh}:${mm}`;

        const repeat_type = values.repeatType ?? 'Daily';
        const repeat_rule = repeat_type === 'Weekly' ? values.repeatRule ?? null : null;

        const localId = newLocalReminderId();
        const localReminder: CachedReminder = {
          id: localId,
          profile_id: pid,
          title,
          description,
          enabled,
          time_of_day,
          timezone: null,
          repeat_type,
          repeat_rule,
          next_fire_at: null,
          created_at: new Date().toISOString(),
          updated_at: null,
          local_only: true,
        };

        try {
          const next = await addOrUpdateCachedReminder(pid, localReminder);
          setReminders(next);
        } catch {}

        // Track the final reminder record (server ID if online, local ID if offline/failed).
        // This ensures the notification is always scheduled with the same ID that would
        // be used to cancel it on deletion, preventing ghost notifications after delete.
        let finalReminder: CachedReminder = localReminder;

        if (isOnline) {
          // Online path: call API directly, then replace local placeholder with server record.
          try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              const created = await createProfileReminder(token, pid, { title, description, time_of_day, enabled, repeat_type, repeat_rule });
              // Cancel the local-id notification BEFORE the ID is replaced so the
              // pending trigger (if any was already enqueued) is cleaned up first.
              await cancelReminderNotification(pid, localId).catch(() => {});
              await replaceCachedReminderId(pid, localId, { ...created, local_only: false } as any);
              finalReminder = { ...created, profile_id: pid, local_only: false } as CachedReminder;
            } else {
              await enqueueCreateReminder(pid, localId, { title, description, time_of_day, enabled, repeat_type, repeat_rule });
            }
          } catch {
            // Fall back to outbox on API failure.
            await enqueueCreateReminder(pid, localId, { title, description, time_of_day, enabled, repeat_type, repeat_rule }).catch(() => {});
          }
        } else {
          try { await enqueueCreateReminder(pid, localId, { title, description, time_of_day, enabled, repeat_type, repeat_rule }); } catch {}
        }

        // Refresh UI from cache.
        try {
          setReminders(await getCachedReminders(pid) as any);
        } catch {}

        if (enabled) {
          try {
            // Use finalReminder (server ID when online) so the scheduled notification ID
            // matches what cancelReminderNotification will target on deletion.
            await scheduleReminderNotification(finalReminder, { profileLabel: activeProfile?.profile_label || '' });
          } catch {}
        }

        setAddReminderOpen(false);
        showToast(isOnline ? t(lang, 'reminder_created') : t(lang, 'saved_offline'), isOnline ? 'success' : 'info');
      } finally {
        addReminderInFlightRef.current = false;
      }
    },
    [activeProfileId, activeProfile?.profile_label, isOnline, lang]
  );

  const openAddGoal = useCallback(() => {
    if (!activeProfileId) {
      showToast(t(lang, 'select_profile_first'), 'info');
      return;
    }
    setEditingGoal(null);
    setAddGoalOpen(true);
  }, [activeProfileId]);

  const submitAddGoal = useCallback(
    async (values: GoalDialogValues) => {
      const pid = activeProfileId;
      if (!pid) {
        showToast(t(lang, 'select_profile_first'), 'info');
        return;
      }

      if (addGoalInFlightRef.current) return;
      addGoalInFlightRef.current = true;

      try {

        const title = values.title.trim();
        const description = values.description.trim() || null;
        const goal_type = values.goalType.trim();
        const target = (values as any).target ?? { value: (values as any).targetValue, unit: String((values as any).targetUnit || '').trim() };

        const now = new Date();
        const yyyy = now.getUTCFullYear();
        const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(now.getUTCDate()).padStart(2, '0');
        const start_date = `${yyyy}-${mm}-${dd}`;

        const localId = newLocalGoalId();
        const localGoal: CachedGoal = {
          id: localId,
          profile_id: pid,
          title,
          description,
          goal_type,
          target,
          start_date,
          end_date: null,
          status: 'Active',
          created_at: new Date().toISOString(),
          updated_at: null,
          local_only: true,
        };

        try {
          const next = await addOrUpdateCachedGoal(pid, localGoal);
          setGoals(next);
        } catch {}

        if (isOnline) {
          try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              const created = await createProfileGoal(token, pid, { title, description, goal_type, target, start_date, status: 'Active' });
              await replaceCachedGoalId(pid, localId, { ...created, local_only: false } as any);
            } else {
              await enqueueCreateGoal(pid, localId, { title, description, goal_type, target, start_date, status: 'Active' });
            }
          } catch {
            await enqueueCreateGoal(pid, localId, { title, description, goal_type, target, start_date, status: 'Active' }).catch(() => {});
          }
        } else {
          try { await enqueueCreateGoal(pid, localId, { title, description, goal_type, target, start_date, status: 'Active' }); } catch {}
        }

        // Refresh UI from cache.
        try {
          setGoals(await getCachedGoals(pid) as any);
        } catch {}

        emitTrendsRefresh();

        setAddGoalOpen(false);
        showToast(isOnline ? t(lang, 'goal_created') : t(lang, 'saved_offline'), isOnline ? 'success' : 'info');
      } finally {
        addGoalInFlightRef.current = false;
      }
    },
    [activeProfileId, isOnline, lang]
  );

  const openEditReminder = useCallback((r: CachedReminder) => {
    setEditingReminder(r);
    setAddReminderOpen(true);
  }, []);

  const openEditGoal = useCallback((g: CachedGoal) => {
    setEditingGoal(g);
    setAddGoalOpen(true);
  }, []);

  const submitEditReminder = useCallback(
    async (values: ReminderDialogValues) => {
      const pid = activeProfileId;
      const r0 = editingReminder;
      if (!pid || !r0) return;

      if (editReminderInFlightRef.current) return;
      editReminderInFlightRef.current = true;

      const title = values.title.trim();
      const description = values.description.trim() || null;
      const enabled = values.enabled !== false;
      const hh = String(values.time.getHours()).padStart(2, '0');
      const mm = String(values.time.getMinutes()).padStart(2, '0');
      const time_of_day = `${hh}:${mm}`;

      const repeat_type = values.repeatType ?? (r0.repeat_type as any) ?? 'Daily';
      const repeat_rule = repeat_type === 'Weekly' ? values.repeatRule ?? null : null;

      const nextLocal: CachedReminder = {
        ...r0,
        title,
        description,
        enabled,
        time_of_day,
        repeat_type,
        repeat_rule,
        updated_at: new Date().toISOString(),
        local_only: true,
      };

      try {
        const next = await addOrUpdateCachedReminder(pid, nextLocal);
        setReminders(next);

        if (isOnline && Number(r0.id) > 0) {
          // Online path: call API directly so DB is updated immediately.
          try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              const patch = { title, description, enabled, time_of_day, repeat_type, repeat_rule };
              const updated = await updateProfileReminder(token, pid, Number(r0.id), patch);
              await addOrUpdateCachedReminder(pid, { ...updated, local_only: false } as any);
            }
          } catch {
            // Fall back to outbox so the op isn't lost.
            try { await enqueueUpdateReminder(pid, Number(r0.id), { title, description, enabled, time_of_day, repeat_type, repeat_rule }); } catch {}
          }
        } else {
          // Offline or still a local item — queue for later sync.
          try { await enqueueUpdateReminder(pid, Number(r0.id), { title, description, enabled, time_of_day, repeat_type, repeat_rule }); } catch {}
        }

        // Refresh UI from cache.
        try { setReminders(await getCachedReminders(pid) as any); } catch {}

        try {
          if (enabled) {
            await scheduleReminderNotification({ ...nextLocal, profile_id: pid }, { profileLabel: activeProfile?.profile_label || '' });
          } else {
            await cancelReminderNotification(pid, Number(r0.id));
          }
        } catch {}

        showToast(isOnline ? t(lang, 'reminder_updated') : t(lang, 'saved_offline'), isOnline ? 'success' : 'info');
      } finally {
        editReminderInFlightRef.current = false;
        setEditingReminder(null);
        setAddReminderOpen(false);
      }
    },
    [activeProfileId, activeProfile?.profile_label, editingReminder, isOnline, lang]
  );

  const deleteEditingReminder = useCallback(async () => {
    const pid = activeProfileId;
    const r0 = editingReminder;
    if (!pid || !r0) return;

    // Optimistically remove from cache and UI.
    try {
      const next = await removeCachedReminder(pid, Number(r0.id));
      setReminders(next);
    } catch {}

    try {
      await cancelReminderNotification(pid, Number(r0.id));
    } catch {}

    if (isOnline && Number(r0.id) > 0) {
      // Online path: delete from DB directly.
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          await deleteProfileReminder(token, pid, Number(r0.id));
        }
      } catch {
        // Fall back to outbox.
        try { await enqueueDeleteReminder(pid, Number(r0.id)); } catch {}
      }
    } else {
      try { await enqueueDeleteReminder(pid, Number(r0.id)); } catch {}
    }

    setEditingReminder(null);
    setAddReminderOpen(false);
    showToast(isOnline ? t(lang, 'reminder_deleted') : t(lang, 'deleted_offline'), isOnline ? 'error' : 'info');
  }, [activeProfileId, editingReminder, isOnline, lang]);

  const submitEditGoal = useCallback(
    async (values: GoalDialogValues) => {
      const pid = activeProfileId;
      const g0 = editingGoal;
      if (!pid || !g0) return;

      if (editGoalInFlightRef.current) return;
      editGoalInFlightRef.current = true;

      const title = values.title.trim();
      const description = values.description.trim() || null;
      const goal_type = values.goalType.trim();
      const target = (values as any).target ?? { value: (values as any).targetValue, unit: String((values as any).targetUnit || '').trim() };

      const nextLocal: CachedGoal = {
        ...g0,
        title,
        description,
        goal_type,
        target,
        updated_at: new Date().toISOString(),
        local_only: true,
      };

      try {
        const next = await addOrUpdateCachedGoal(pid, nextLocal);
        setGoals(next);

        if (isOnline && Number(g0.id) > 0) {
          // Online path: call API directly so DB is updated immediately.
          try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              const patch = { title, description, goal_type, target };
              const updated = await updateProfileGoal(token, pid, Number(g0.id), patch);
              await addOrUpdateCachedGoal(pid, { ...updated, local_only: false } as any);
            }
          } catch {
            // Fall back to outbox.
            try { await enqueueUpdateGoal(pid, Number(g0.id), { title, description, goal_type, target }); } catch {}
          }
        } else {
          try { await enqueueUpdateGoal(pid, Number(g0.id), { title, description, goal_type, target }); } catch {}
        }

        // Refresh UI from cache.
        try { setGoals(await getCachedGoals(pid) as any); } catch {}

        emitTrendsRefresh();

        showToast(isOnline ? t(lang, 'goal_updated') : t(lang, 'saved_offline'), isOnline ? 'success' : 'info');
      } finally {
        editGoalInFlightRef.current = false;
        setEditingGoal(null);
        setAddGoalOpen(false);
      }
    },
    [activeProfileId, editingGoal, isOnline, lang]
  );

  const deleteEditingGoal = useCallback(async () => {
    const pid = activeProfileId;
    const g0 = editingGoal;
    if (!pid || !g0) return;

    // Optimistically remove from cache and UI.
    try {
      const next = await removeCachedGoal(pid, Number(g0.id));
      setGoals(next);
    } catch {}

    if (isOnline && Number(g0.id) > 0) {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          await deleteProfileGoal(token, pid, Number(g0.id));
        }
      } catch {
        try { await enqueueDeleteGoal(pid, Number(g0.id)); } catch {}
      }
    } else {
      try { await enqueueDeleteGoal(pid, Number(g0.id)); } catch {}
    }

    setEditingGoal(null);
    setAddGoalOpen(false);
    emitTrendsRefresh();
    showToast(isOnline ? t(lang, 'goal_deleted') : t(lang, 'deleted_offline'), isOnline ? 'error' : 'info');
  }, [activeProfileId, editingGoal, isOnline, lang]);

  const verifyPassword = async (password: string): Promise<boolean> => {
    if (!selectedProfile) return false;

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found');
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/profiles/${selectedProfile.id}/verify-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to verify password');
        return false;
      }

      if (data.valid) {
        // Password correct, switch to profile
        await switchToProfile(Number(selectedProfile.id));
        setPasswordDialogVisible(false);
        setSelectedProfile(null);
        return true;
      } else {
        // Password incorrect
        return false;
      }
    } catch (error) {
      console.error('Password verification error:', error);
      Alert.alert('Error', 'Failed to verify password. Please try again.');
      return false;
    }
  };

  const handlePasswordCancel = () => {
    setPasswordDialogVisible(false);
    setSelectedProfile(null);
  };

  const openEdit = () => {
    setEditing(true);
  };

  const closeEdit = () => {
    setEditing(false);
  };

  const openAddProfile = () => {
    if (openAddProfileTimerRef.current) {
      clearTimeout(openAddProfileTimerRef.current);
      openAddProfileTimerRef.current = null;
    }

    if (sheetMode && onClosePress) {
      openCreateProfileFlow?.();
      onClosePress();
      return;
    }

    if (openCreateProfileFlow) {
      openCreateProfileFlow();
      return;
    }
    // fallback: do nothing if not provided (overlay should be hosted above BottomNav)
    showToast(t(lang, 'unable_open_create'));
  };

  const Container: any = sheetMode ? View : SafeAreaView;
  const { bottom: safeBottom } = useSafeAreaInsets();
  const profileBottomSpacerHeight = sheetMode
    ? PROFILE_SHEET_BOTTOM_PADDING + safeBottom
    : PROFILE_BOTTOM_PADDING;

  useEffect(() => {
    return () => {
      if (openAddProfileTimerRef.current) {
        clearTimeout(openAddProfileTimerRef.current);
        openAddProfileTimerRef.current = null;
      }
    };
  }, []);

  if (loading && !suppressLoadingIndicator) {
    return (
      <Container style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t(lang, 'loading_profiles')}</Text>
          </View>
        </ScrollView>

        <ProfilePasswordDialog
          visible={passwordDialogVisible}
          profileName={selectedProfile?.profile_label || 'Profile'}
          onSubmit={verifyPassword}
          onCancel={handlePasswordCancel}
        />
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      {sheetMode && activeProfile && (
        <LinearGradient
          colors={['#064b75', '#0b6aa0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.profileSheetHeader,
            {
              paddingTop: 12 + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 12),
            },
          ]}
        >
          <View style={styles.activeCardInline}>
            <View style={[styles.activeMainRow, { marginTop: 18 }]}>
              <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
                {activeAvatarUri ? (
                  <CroppedAvatarImage avatar={activeAvatarUri} size={64} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
              <View style={styles.activeInfo}>
                <Text style={[styles.activeName, { color: '#ffffff', paddingRight: onClosePress ? 56 : 0 }]} numberOfLines={1}>
                  {activeProfile.profile_label || 'Profile'}
                </Text>
                <View style={styles.activeSheetActionRow}>
                  <View style={[styles.activePillWrap, { backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginTop: 0 }]}> 
                    <View style={[styles.activePillDot, { backgroundColor: '#10B981' }]} />
                    <Text style={[styles.activePillText, { color: '#ffffff' }]}>{t(lang, 'active_profile_label')}</Text>
                  </View>
                  <View style={styles.activeSheetActionSpacer} />
                  <TouchableOpacity activeOpacity={0.85} onPress={openEdit} style={[styles.headerEditBtn, styles.headerEditBtnSheet]}>
                    <Image source={require('../../../../assets/android-res/drawable/edit.png')} style={styles.headerEditIcon} />
                    <Text style={styles.headerEditText}>{t(lang, 'edit')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Close button (top-right) */}
          {onClosePress && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onClosePress}
              style={[
                styles.closeButton,
                { top: 12 + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 12) },
              ]}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      )}

      {/* Edit modal */}
      <Modal visible={editing} animationType="slide" onRequestClose={closeEdit} statusBarTranslucent navigationBarTranslucent>
        <DialogPortalProvider>
          {activeProfile ? (
            <EditProfileScreen
              profile={activeProfile as any}
              onComplete={() => {
                closeEdit();
                loadProfiles();
              }}
              onBack={closeEdit}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#6b7280' }}>{t(lang, 'no_profile_selected')}</Text>
            </View>
          )}
        </DialogPortalProvider>
      </Modal>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hide active profile card in sheet mode since it's in the blue header */}
        {!sheetMode && activeProfile ? (
          <View style={styles.activeCard}>
            <View style={styles.activeTopRow}>
              <Text style={styles.activeTopLabel}>{t(lang, 'active_profile_label')}</Text>
              <Pressable style={styles.editBtn} onPress={openEdit}>
                <Image source={require('../../../../assets/android-res/drawable/edit.png')} style={styles.editIcon} resizeMode="contain" />
                <Text style={styles.editText}>{t(lang, 'edit')}</Text>
              </Pressable>
            </View>

            <View style={styles.activeMainRow}>
              <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
                {activeAvatarUri ? (
                  <CroppedAvatarImage avatar={activeAvatarUri} size={64} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
              <View style={styles.activeInfo}>
                <Text style={styles.activeName} numberOfLines={1}>
                  {activeProfile.profile_label || 'Profile'}
                </Text>
                <View style={styles.activePillWrap}>
                  <View style={styles.activePillDot} />
                  <Text style={styles.activePillText}>{t(lang, 'active_profile_label')}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null }

        {/* All Profiles */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>{t(lang, 'all_profiles')}</Text>
          </View>

          <Pressable style={styles.addBtn} onPress={openAddProfile}>
            <Image source={require('../../../../assets/android-res/drawable/add.png')} style={styles.addBtnIcon} resizeMode="contain" />
            <Text style={styles.addBtnText}>{t(lang, 'add_profile')}</Text>
          </Pressable>
        </View>

        {allProfiles.length === 0 ? null : (
          <View
            style={styles.profilesPagerWrap}
            onLayout={(e) => {
              const w = e?.nativeEvent?.layout?.width;
              if (typeof w === 'number' && w > 0) setProfilesPagerWidth(w);
            }}
          >
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => {
                const x = e?.nativeEvent?.contentOffset?.x ?? 0;
                const w = profilesPagerWidth || 1;
                const idx = Math.round(x / w);
                setProfilesPageIndex(Math.max(0, Math.min(idx, profilePages.length - 1)));
              }}
            >
              {profilePages.map((page, idx) => (
                <View
                  key={`page-${idx}`}
                  style={[styles.profilesPage, profilesPagerWidth ? { width: profilesPagerWidth } : null]}
                >
                  {page.map((profile) => (
                    <SubProfileCard
                      key={profile.id}
                      profileId={profile.id}
                      profileName={profile.profile_label || 'Profile'}
                      lastUsed={profile.last_used}
                      isActive={Number(profile.id) === activeProfileId}
                      onPress={() => handleProfilePress(Number(profile.id))}
                      avatar={avatarMap[String(profile.id)] || null}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>

            {profilePages.length > 1 ? (
              <View style={styles.profilesPagerIndicatorRow}>
                {profilePages.map((_p, idx) => {
                  const active = idx === profilesPageIndex;
                  return (
                    <View
                      key={`ind-${idx}`}
                      style={[styles.profilesPagerIndicatorDot, active ? styles.profilesPagerIndicatorDotActive : null]}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        )}

        {/* Goals (placeholder) */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>{t(lang, 'health_goals')}</Text>
          </View>
          <Pressable style={styles.smallOutlineBtn} onPress={openAddGoal}>
            <Image source={require('../../../../assets/android-res/drawable/add.png')} style={styles.smallOutlineIcon} resizeMode="contain" />
            <Text style={styles.smallOutlineText}>{t(lang, 'new_goal')}</Text>
          </Pressable>
        </View>

        {goals.length === 0 ? (
          <GoalSectionCard
            title={t(lang, 'goal_placeholder_title')}
            description={t(lang, 'goal_placeholder_desc')}
            hideProgress
            onPress={openAddGoal}
          />
        ) : (
          goals.map((g) => (
            <GoalCard
              key={String(g.id)}
              goal={g}
              onPress={() => openEditGoal(g)}
              showSyncing={!isOnline}
              progressOverride={computeGoalProgressFromMedical(g)}
            />
          ))
        )}

        {/* Reminders (placeholder) */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>{t(lang, 'reminders_label')}</Text>
          </View>
          <Pressable style={styles.smallOutlineBtn} onPress={openAddReminder}>
            <Image source={require('../../../../assets/android-res/drawable/add.png')} style={styles.smallOutlineIcon} resizeMode="contain" />
            <Text style={styles.smallOutlineText}>{t(lang, 'add_reminder')}</Text>
          </Pressable>
        </View>

        {reminders.length === 0 ? (
          <ReminderSectionCard
            title={t(lang, 'reminders_label')}
            description={t(lang, 'reminder_placeholder_desc')}
            count={0}
            onPress={openAddReminder}
          />
        ) : (
          reminders.map((r) => (
            <ReminderCard
              key={String(r.id)}
              reminder={r}
              onPress={() => openEditReminder(r)}
              showSyncing={!isOnline}
            />
          ))
        )}

        <View style={{ height: profileBottomSpacerHeight }} />
      </ScrollView>

      <ProfilePasswordDialog
        visible={passwordDialogVisible}
        profileName={selectedProfile?.profile_label || 'Profile'}
        onSubmit={verifyPassword}
        onCancel={handlePasswordCancel}
      />

      <GoalDialog
        visible={addGoalOpen}
        profileLabel={activeProfile?.profile_label || ''}
        onCancel={() => {
          setEditingGoal(null);
          setAddGoalOpen(false);
        }}
        mode={editingGoal ? 'edit' : 'create'}
        initialValues={
          editingGoal
            ? {
                title: editingGoal.title || '',
                description: (editingGoal.description || '') as any,
                goalType: editingGoal.goal_type || 'Weight',
                target: (editingGoal.target as any) ?? null,
                targetValue: Number((editingGoal.target as any)?.value ?? ''),
                targetUnit: String((editingGoal.target as any)?.unit ?? 'kg'),
              }
            : undefined
        }
        onSubmit={editingGoal ? submitEditGoal : submitAddGoal}
        onDelete={editingGoal ? deleteEditingGoal : undefined}
      />

      <ReminderDialog
        visible={addReminderOpen}
        profileLabel={activeProfile?.profile_label || ''}
        onCancel={() => {
          setEditingReminder(null);
          setAddReminderOpen(false);
        }}
        mode={editingReminder ? 'edit' : 'create'}
        initialValues={
          editingReminder
            ? {
                title: editingReminder.title || '',
                description: (editingReminder.description || '') as any,
                enabled: editingReminder.enabled !== false,
                time: (() => {
                  const d = new Date();
                  const m = String(editingReminder.time_of_day || '').match(/^(\d{1,2}):(\d{2})/);
                  if (m) {
                    d.setHours(Number(m[1]) || 0);
                    d.setMinutes(Number(m[2]) || 0);
                    d.setSeconds(0, 0);
                    return d;
                  }
                  return d;
                })(),
                repeatType: (editingReminder.repeat_type as any) || 'Daily',
                repeatRule: (editingReminder.repeat_rule as any) || null,
              }
            : undefined
        }
        onSubmit={editingReminder ? submitEditReminder : submitAddReminder}
        onDelete={editingReminder ? deleteEditingReminder : undefined}
      />
    </Container>
  );
}
export default React.memo(ProfileScreen);