/**
 * Network Sync Service
 * 
 * Monitors network connectivity and triggers outbox sync when device comes back online.
 * Call startNetworkSync() once at app startup (e.g., in App.tsx).
 */
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runOutbox, getOutbox, subscribeOutboxChanges } from './syncOutbox';

let subscription: NetInfoSubscription | null = null;
let outboxSubscription: (() => void) | null = null;
let wasOffline = false;

// Promise that resolves when the current sync finishes (null when idle).
let activeSyncPromise: Promise<void> | null = null;

// Minimum interval between *automatic* sync attempts (ms).
// Explicit triggerSync() always bypasses this.
const AUTO_SYNC_INTERVAL_MS = 5000;
let lastSyncTime = 0;

/**
 * Core sync. If a sync is already running, returns the in-flight promise so
 * callers can await it instead of skipping.
 */
function doSync(): Promise<void> {
  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = (async () => {
    try {
      const state = await NetInfo.fetch();
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      if (!online) {
        console.log('[NetworkSync] Offline, skip sync');
        return;
      }

      const outbox = await getOutbox();
      if (outbox.length === 0) {
        console.log('[NetworkSync] Outbox empty, nothing to sync');
        return;
      }

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('[NetworkSync] No auth token, skip sync');
        return;
      }

      lastSyncTime = Date.now();

      console.log(`[NetworkSync] Starting sync, ${outbox.length} items pending...`);
      const result = await runOutbox(token);
      console.log(
        `[NetworkSync] Sync complete: ${result.successCount} success, ${result.failCount} fail, ${result.remainingCount} remaining`
      );
      if (result.lastError) {
        console.log('[NetworkSync] Last error:', result.lastError);
      }
    } catch (err: any) {
      console.log('[NetworkSync] Sync error:', err?.message);
    }
  })();

  // Clear the sentinel when done so the next call starts a fresh sync.
  activeSyncPromise.finally(() => {
    activeSyncPromise = null;
  });

  return activeSyncPromise;
}

/** Throttled version used by automatic listeners (outbox changes, connectivity). */
function autoSync(): void {
  if (activeSyncPromise) return; // already running
  if (Date.now() - lastSyncTime < AUTO_SYNC_INTERVAL_MS) return;
  doSync();
}

function handleConnectivityChange(state: NetInfoState) {
  const isConnected = state.isConnected && state.isInternetReachable !== false;
  console.log('[NetworkSync] Connectivity changed:', isConnected ? 'ONLINE' : 'OFFLINE');

  if (isConnected && wasOffline) {
    console.log('[NetworkSync] Back online, triggering sync...');
    doSync(); // full sync on reconnect (no throttle)
  }

  wasOffline = !isConnected;
}

/**
 * Start monitoring network connectivity and auto-sync when back online.
 * Call this once at app startup.
 */
export function startNetworkSync() {
  if (subscription) {
    console.log('[NetworkSync] Already started');
    return;
  }

  console.log('[NetworkSync] Starting network monitor...');
  
  // Check initial state
  NetInfo.fetch().then((state) => {
    wasOffline = !(state.isConnected && state.isInternetReachable !== false);
    console.log('[NetworkSync] Initial state:', wasOffline ? 'OFFLINE' : 'ONLINE');
    
    // If we're online at startup, do an initial sync
    if (!wasOffline) {
      doSync();
    }
  });

  // Subscribe to changes
  subscription = NetInfo.addEventListener(handleConnectivityChange);

  // Sync newly queued operations when online (throttled).
  outboxSubscription = subscribeOutboxChanges(() => {
    if (wasOffline) return;
    autoSync();
  });
}

/**
 * Stop monitoring network connectivity.
 */
export function stopNetworkSync() {
  if (subscription) {
    subscription();
    subscription = null;
    console.log('[NetworkSync] Stopped network monitor');
  }
  if (outboxSubscription) {
    outboxSubscription();
    outboxSubscription = null;
  }
}

/**
 * Check if device is currently online.
 * Async version: fetches fresh NetInfo state (use only when cached state may be stale).
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable !== false);
}

/**
 * Synchronous online check using the cached connectivity state maintained by
 * the NetInfo event listener started in startNetworkSync().
 * Zero IPC overhead — safe to call from hot paths like BLE notification handlers.
 * Returns true if the last known state was online (defaults to true before first update).
 */
export function isOnlineSync(): boolean {
  return !wasOffline;
}

/**
 * Manually trigger a sync (e.g., on user request).
 */
export async function triggerSync() {
  const online = await isOnline();
  if (!online) {
    console.log('[NetworkSync] Cannot sync - offline');
    return { synced: false, reason: 'offline' };
  }
  await doSync();
  return { synced: true };
}
