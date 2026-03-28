<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { authState, signOut } from '$lib/auth/authState.svelte';
  import { settings, updateSettings } from '$lib/state/settingsState.svelte';
  import { syncState } from '$lib/state/syncState.svelte';

  let { onOpenSettings }: { onOpenSettings: () => void } = $props();

  function formatLastSync(iso: string | null): string {
    if (!iso) return 'Never synced';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Synced just now';
    if (mins < 60) return `Synced ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `Synced ${hrs}h ago`;
  }

  function toggleAlwaysOnTop() {
    updateSettings({ alwaysOnTop: !settings.alwaysOnTop });
  }
</script>

<div
  data-tauri-drag-region
  class="flex items-center justify-between h-10 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] select-none cursor-default shrink-0"
>
  <span class="text-sm font-semibold tracking-wide text-[var(--color-text-muted)]" data-tauri-drag-region>
    Sidquest
  </span>

  <!-- No data-tauri-drag-region here so buttons receive clicks -->
  <div class="flex items-center gap-2" onmousedown={(e) => e.stopPropagation()}>
    {#if authState.user}
      <!-- Sync status indicator -->
      <div
        class="flex items-center gap-1.5 mr-2"
        title={syncState.error
          ? `Sync error: ${syncState.error}`
          : !syncState.online
            ? `Offline${syncState.pendingChanges > 0 ? ` — ${syncState.pendingChanges} pending` : ''}`
            : syncState.syncing
              ? 'Syncing...'
              : formatLastSync(syncState.lastSyncAt)}
      >
        <span
          class="w-2 h-2 rounded-full {syncState.error
            ? 'bg-red-400'
            : !syncState.online
              ? 'bg-gray-400'
              : syncState.syncing
                ? 'bg-yellow-400 animate-pulse'
                : 'bg-green-400'}"
        ></span>
        {#if !syncState.online}
          <span class="text-xs text-[var(--color-text-muted)]">Offline</span>
        {/if}
        {#if syncState.pendingChanges > 0 && !syncState.online}
          <span class="text-xs text-[var(--color-text-muted)]">({syncState.pendingChanges})</span>
        {/if}
      </div>

      <span class="text-xs text-[var(--color-text-muted)] mr-1">{authState.user.email}</span>
      <button
        onclick={signOut}
        class="text-xs px-2 py-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        Sign out
      </button>
    {/if}
    <button
      onclick={onOpenSettings}
      title="Settings"
      class="text-xs px-2 py-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
    >
      &#9881;
    </button>
    <button
      onclick={toggleAlwaysOnTop}
      title={settings.alwaysOnTop ? 'Unpin from top' : 'Pin on top'}
      class="text-xs px-2 py-1 rounded transition-colors {settings.alwaysOnTop ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}"
    >
      &#128204;
    </button>
    <button
      onclick={() => getCurrentWindow().minimize()}
      title="Minimize"
      class="text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded px-2 py-1 text-xs transition-colors"
    >
      &#8722;
    </button>
    <button
      onclick={() => getCurrentWindow().hide()}
      title="Close"
      class="text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded px-2 py-1 text-xs transition-colors"
    >
      &#10005;
    </button>
  </div>
</div>
