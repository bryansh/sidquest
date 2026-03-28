import { pushChanges, pullChanges, getPendingCount } from '$lib/db/sync/engine';

export const syncState = $state<{
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  error: string | null;
  pendingChanges: number;
}>({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncing: false,
  lastSyncAt: null,
  error: null,
  pendingChanges: 0,
});

let syncTimer: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

export function initSyncService() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('online', () => {
    syncState.online = true;
    console.log('[Sync] Back online — syncing in 3s');
    // Delay to let network stabilize
    setTimeout(() => triggerSync(), 3_000);
  });

  window.addEventListener('offline', () => {
    syncState.online = false;
    console.log('[Sync] Went offline');
  });

  // Periodic sync every 60s
  syncTimer = setInterval(() => {
    if (syncState.online && !syncState.syncing) {
      triggerSync();
    }
  }, 60_000);

  // Initial sync
  if (syncState.online) {
    triggerSync();
  }

  updatePendingCount();
}

export function stopSyncService() {
  if (syncTimer) clearInterval(syncTimer);
  if (debounceTimer) clearTimeout(debounceTimer);
  syncTimer = null;
  debounceTimer = null;
  initialized = false;
}

export function notifyWrite() {
  updatePendingCount();
  if (!syncState.online) return;

  // Debounce: sync 5s after last write
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    triggerSync();
  }, 5_000);
}

async function isNetworkReachable(): Promise<boolean> {
  try {
    const resp = await fetch('https://neon.tech', { method: 'HEAD', mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}

async function triggerSync() {
  if (syncState.syncing || !syncState.online) return;

  // Verify actual connectivity before attempting sync
  const reachable = await isNetworkReachable();
  if (!reachable) {
    syncState.online = false;
    return;
  }

  syncState.syncing = true;
  syncState.error = null;

  try {
    const pushed = await pushChanges();
    const pulled = await pullChanges();

    syncState.lastSyncAt = new Date().toISOString();
    if (pushed > 0 || pulled > 0) {
      console.log(`[Sync] Pushed ${pushed}, pulled ${pulled}`);
    }
  } catch (e: any) {
    console.error('[Sync] Error:', e);
    syncState.error = e.message ?? 'Sync failed';
  } finally {
    syncState.syncing = false;
    await updatePendingCount();
  }
}

async function updatePendingCount() {
  try {
    syncState.pendingChanges = await getPendingCount();
  } catch {
    // ignore
  }
}
