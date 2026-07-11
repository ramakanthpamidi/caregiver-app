import AsyncStorage from '@react-native-async-storage/async-storage';

import { cancelAlertSyncs, clearAlerts, clearAlertSyncState } from '../../alerts/storage/alertStorage';
import { setActiveProfileId } from '../../profiles/lib/profileEvents';
import { setCachedProfiles } from '../../profiles/storage/profileCache';
import { clearOutbox } from '../../../shared/sync/syncOutbox';

// Clears user-scoped local state so it can't leak across accounts.
// Does NOT clear app preferences like language/units.
export async function clearUserSession(): Promise<void> {
  // Ensure any listeners (Home/Profile UI) update immediately.
  await setActiveProfileId(null);

  // Keep cache semantics simple: remove content on logout.
  await setCachedProfiles([]);

  // Prevent any in-flight remote fetch from writing stale alerts back after logout.
  cancelAlertSyncs();

  // Clear alert history and sync markers so alerts cannot leak across accounts.
  await clearAlerts();
  await clearAlertSyncState();

  // Prevent offline ops from being replayed under a different account.
  await clearOutbox();

  // Finally, clear auth token.
  await AsyncStorage.removeItem('authToken');
}
