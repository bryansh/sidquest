<script lang="ts">
  import { gameState, type Entity } from '$lib/state/gameState.svelte';
  import { noteState } from '$lib/state/noteState.svelte';

  const activeEntity = $derived(
    gameState.entities.find(e => e.id === noteState.activeEntityId) ?? null
  );

  const entityNotes = $derived(
    noteState.notes.filter(n => n.entityId === noteState.activeEntityId)
  );

  const activeNote = $derived(
    noteState.notes.find(n => n.id === noteState.activeNoteId) ?? null
  );
</script>

<main class="flex-1 flex flex-col h-full overflow-hidden">
  {#if activeEntity}
    <header class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
      <h2 class="text-lg font-semibold">{activeEntity.name}</h2>
      <button
        class="text-sm px-3 py-1 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors"
      >
        + Note
      </button>
    </header>

    {#if entityNotes.length > 0}
      <div class="flex gap-1 px-4 pt-2 border-b border-[var(--color-border)] overflow-x-auto">
        {#each entityNotes as note}
          <button
            onclick={() => noteState.activeNoteId = note.id}
            class="px-3 py-1.5 text-sm rounded-t transition-colors {note.id === noteState.activeNoteId ? 'bg-[var(--color-surface)] text-[var(--color-text)] border border-b-0 border-[var(--color-border)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}"
          >
            {note.title}
          </button>
        {/each}
      </div>
    {/if}

    <div class="flex-1 overflow-y-auto p-4">
      {#if activeNote}
        <div class="prose prose-invert max-w-none">
          <p class="text-[var(--color-text-muted)]">Editor will go here</p>
        </div>
      {:else}
        <p class="text-[var(--color-text-muted)]">Select or create a note.</p>
      {/if}
    </div>
  {:else}
    <div class="flex-1 flex items-center justify-center">
      <p class="text-[var(--color-text-muted)]">Select an entity from the sidebar to view notes.</p>
    </div>
  {/if}
</main>
