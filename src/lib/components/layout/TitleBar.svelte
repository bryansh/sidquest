<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { uiState } from '$lib/state/uiState.svelte';

  async function toggleAlwaysOnTop() {
    uiState.alwaysOnTop = !uiState.alwaysOnTop;
    await getCurrentWindow().setAlwaysOnTop(uiState.alwaysOnTop);
  }
</script>

<div
  data-tauri-drag-region
  class="flex items-center justify-between h-10 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] select-none cursor-default shrink-0"
>
  <span class="text-sm font-semibold tracking-wide text-[var(--color-text-muted)]" data-tauri-drag-region>
    Lorekeeper
  </span>

  <div class="flex items-center gap-2">
    <button
      onclick={toggleAlwaysOnTop}
      title={uiState.alwaysOnTop ? 'Unpin from top' : 'Pin on top'}
      class="text-xs px-2 py-1 rounded transition-colors {uiState.alwaysOnTop ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'} hover:bg-[var(--color-surface-hover)]"
    >
      {uiState.alwaysOnTop ? '&#128204;' : '&#128204;'}
    </button>
    <button
      onclick={() => getCurrentWindow().hide()}
      class="text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded px-2 py-1 text-xs transition-colors"
    >
      &#10005;
    </button>
  </div>
</div>
