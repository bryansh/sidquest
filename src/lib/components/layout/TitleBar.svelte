<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { authState, signOut } from '$lib/auth/authState.svelte';
  import { settings, updateSettings } from '$lib/state/settingsState.svelte';

  let { onOpenSettings }: { onOpenSettings: () => void } = $props();

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
