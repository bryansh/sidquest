<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { uiState } from '$lib/state/uiState.svelte';
  import { authState, signOut } from '$lib/auth/authState.svelte';

  let testStatus = $state('');

  async function toggleAlwaysOnTop() {
    const next = !uiState.alwaysOnTop;
    try {
      await getCurrentWindow().setAlwaysOnTop(next);
      uiState.alwaysOnTop = next;
    } catch (e) {
      console.error('[TitleBar] setAlwaysOnTop failed:', e);
    }
  }

  async function testCleanup() {
    try {
      // Step 1: Check if model exists
      testStatus = 'Checking model...';
      const hasModel = await invoke('check_cleanup_model');
      console.log('[Cleanup Test] Model exists:', hasModel);

      // Step 2: Download if needed
      if (!hasModel) {
        testStatus = 'Downloading model (2GB)...';
        const unlisten = await listen('cleanup-model-progress', (e: any) => {
          const pct = ((e.payload.downloaded / e.payload.total) * 100).toFixed(1);
          testStatus = `Downloading: ${pct}%`;
          console.log(`[Cleanup Test] ${pct}% (${(e.payload.downloaded/1e6).toFixed(0)}MB / ${(e.payload.total/1e6).toFixed(0)}MB)`);
        });
        await invoke('download_cleanup_model');
        unlisten();
        console.log('[Cleanup Test] Download complete');
      }

      // Step 3: Run cleanup
      testStatus = 'Running inference...';
      const result = await invoke('cleanup_note', {
        text: `so we met this guy Thornwick at the tavern, he's some kind of wizard I think? [[Elara]] mentioned the mill has undead. We fought 3 goblins, [[Brak]] almost died. Found 12 gold and a weird amulet.`
      });
      console.log('[Cleanup Test] Result:\n', result);
      testStatus = 'Done! Check console.';
    } catch (e: any) {
      console.error('[Cleanup Test] Error:', e);
      testStatus = `Error: ${e}`;
    }
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
    <button
      onclick={testCleanup}
      title="Test AI cleanup"
      class="text-xs px-2 py-1 rounded text-yellow-400 hover:bg-[var(--color-surface-hover)] transition-colors"
    >
      {testStatus || '🧪 Test Cleanup'}
    </button>
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
