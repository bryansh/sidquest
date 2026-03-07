<script lang="ts">
  import { gameState } from '$lib/state/gameState.svelte';
  import { noteState, createNote } from '$lib/state/noteState.svelte';
  import { authState } from '$lib/auth/authState.svelte';

  const activeEntity = $derived(
    gameState.entities.find(e => e.id === noteState.activeEntityId) ?? null
  );

  const entityNotes = $derived(
    noteState.notes.filter(n => n.entityId === noteState.activeEntityId)
  );

  const activeNote = $derived(
    noteState.notes.find(n => n.id === noteState.activeNoteId) ?? null
  );

  async function handleNewNote() {
    if (!authState.user || !gameState.activeGameId || !noteState.activeEntityId) return;
    await createNote(authState.user.id, gameState.activeGameId, noteState.activeEntityId, 'Untitled');
  }
</script>

<main class="flex-1 flex flex-col h-full overflow-hidden">
  {#if activeEntity}
    <header class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
      <h2 class="text-lg font-semibold">{activeEntity.name}</h2>
      <button
        onclick={handleNewNote}
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
          <p class="text-[var(--color-text-muted)] italic">Editor will be integrated next...</p>
        </div>
      {:else}
        <p class="text-[var(--color-text-muted)]">Create a note to get started.</p>
      {/if}
    </div>
  {:else}
    <div class="flex-1 flex items-center justify-center">
      <p class="text-[var(--color-text-muted)]">Select an entity from the sidebar to view notes.</p>
    </div>
  {/if}
</main>
