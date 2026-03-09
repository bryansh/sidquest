<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { uiState } from '$lib/state/uiState.svelte';
  import { authState, signOut } from '$lib/auth/authState.svelte';

  async function toggleAlwaysOnTop() {
    const next = !uiState.alwaysOnTop;
    console.log('[TitleBar] toggleAlwaysOnTop:', next);
    try {
      await getCurrentWindow().setAlwaysOnTop(next);
      uiState.alwaysOnTop = next;
    } catch (e) {
      console.error('[TitleBar] setAlwaysOnTop failed:', e);
    }
  }
</script>

<div
  data-tauri-drag-region
  class="flex items-center justify-between h-10 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] select-none cursor-default shrink-0"
>
  <span class="text-sm font-semibold tracking-wide text-[var(--color-text-muted)]" data-tauri-drag-region>
    Lorekeeper
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
      onclick={toggleAlwaysOnTop}
      title={uiState.alwaysOnTop ? 'Unpin from top' : 'Pin on top'}
      class="text-xs px-2 py-1 rounded transition-colors {uiState.alwaysOnTop ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}"
    >
      📌
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
