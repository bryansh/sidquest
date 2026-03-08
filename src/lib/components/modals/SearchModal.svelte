<script lang="ts">
  import { searchNotes, type SearchResult } from '$lib/db/queries/search';
  import { gameState } from '$lib/state/gameState.svelte';
  import { authState } from '$lib/auth/authState.svelte';
  import { noteState, selectEntity } from '$lib/state/noteState.svelte';

  let { onClose }: { onClose: () => void } = $props();

  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let selectedIndex = $state(0);
  let searching = $state(false);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput() {
    if (searchTimer) clearTimeout(searchTimer);
    if (!query.trim()) { results = []; return; }
    searchTimer = setTimeout(async () => {
      if (!gameState.activeGameId || !authState.user) return;
      searching = true;
      results = await searchNotes(query, gameState.activeGameId, authState.user.id);
      selectedIndex = 0;
      searching = false;
    }, 200);
  }

  function selectResult(r: SearchResult) {
    selectEntity(r.entityId).then(() => {
      noteState.activeNoteId = r.noteId;
    });
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % results.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + results.length) % results.length;
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      selectResult(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<div
  class="fixed inset-0 bg-black/60 flex items-start justify-center pt-[15vh] z-50"
  onclick={onClose}
  onkeydown={handleKeydown}
  role="dialog"
  tabindex="-1"
>
  <div
    class="w-full max-w-lg rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl overflow-hidden"
    onclick={(e) => e.stopPropagation()}
    role="presentation"
  >
    <div class="flex items-center px-4 py-3 border-b border-[var(--color-border)]">
      <input
        type="text"
        placeholder="Search notes..."
        bind:value={query}
        oninput={handleInput}
        autofocus
        class="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
      />
      {#if searching}
        <span class="text-xs text-[var(--color-text-muted)] ml-2">Searching...</span>
      {/if}
    </div>

    {#if results.length > 0}
      <div class="max-h-80 overflow-y-auto py-1">
        {#each results as result, i}
          <button
            onclick={() => selectResult(result)}
            class="w-full text-left px-4 py-2 flex flex-col gap-0.5 transition-colors {i === selectedIndex ? 'bg-[var(--color-surface-hover)]' : 'hover:bg-[var(--color-surface-hover)]'}"
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-[var(--color-text)]">{result.noteTitle}</span>
              <span class="text-xs text-[var(--color-text-muted)]">{result.entityName} &middot; {result.typeName}</span>
            </div>
            {#if result.excerpt}
              <span class="text-xs text-[var(--color-text-muted)] truncate">{result.excerpt}</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else if query.trim() && !searching}
      <div class="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">No results found.</div>
    {:else if !query.trim()}
      <div class="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">Type to search across all notes.</div>
    {/if}
  </div>
</div>
