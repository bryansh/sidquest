<script lang="ts">
  import { gameState, renameEntity } from '$lib/state/gameState.svelte';
  import { noteState, createNote, updateNoteContent, renameNote, deleteNote } from '$lib/state/noteState.svelte';
  import { authState } from '$lib/auth/authState.svelte';
  import NoteEditor from '../editor/NoteEditor.svelte';
  import BacklinksPanel from '../editor/BacklinksPanel.svelte';
  import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.svelte';

  let confirmDeleteNoteId = $state<string | null>(null);
  let editingEntityName = $state(false);
  let entityNameValue = $state('');

  function startEntityRename() {
    if (!activeEntity) return;
    entityNameValue = activeEntity.name;
    editingEntityName = true;
  }

  async function commitEntityRename() {
    if (activeEntity && entityNameValue.trim() && entityNameValue.trim() !== activeEntity.name) {
      await renameEntity(activeEntity.id, entityNameValue.trim());
    }
    editingEntityName = false;
  }

  function handleEntityNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEntityRename();
    } else if (e.key === 'Escape') {
      editingEntityName = false;
    }
  }

  const activeEntity = $derived(
    gameState.entities.find(e => e.id === noteState.activeEntityId) ?? null
  );

  const entityNotes = $derived(
    noteState.notes.filter(n => n.entityId === noteState.activeEntityId)
  );

  const activeNote = $derived(
    noteState.notes.find(n => n.id === noteState.activeNoteId) ?? null
  );

  let editingTabId = $state<string | null>(null);
  let editingTitle = $state('');

  async function handleNewNote() {
    if (!authState.user || !gameState.activeGameId || !noteState.activeEntityId) return;
    await createNote(authState.user.id, gameState.activeGameId, noteState.activeEntityId, 'Untitled');
  }

  function startRename(note: { id: string; title: string }) {
    editingTabId = note.id;
    editingTitle = note.title;
  }

  async function commitRename() {
    if (editingTabId) {
      await renameNote(editingTabId, editingTitle);
      editingTabId = null;
    }
  }

  function selectAll(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      editingTabId = null;
    }
  }
</script>

<main class="flex-1 flex flex-col h-full overflow-hidden">
  {#if activeEntity}
    <header class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
      {#if editingEntityName}
        <input
          type="text"
          bind:value={entityNameValue}
          onblur={commitEntityRename}
          onkeydown={handleEntityNameKeydown}
          use:selectAll
          class="text-lg font-semibold bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-0.5 outline-none text-[var(--color-text)]"
        />
      {:else}
        <h2 class="text-lg font-semibold cursor-pointer" ondblclick={startEntityRename}>{activeEntity.name}</h2>
      {/if}
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
          {#if editingTabId === note.id}
            <input
              type="text"
              bind:value={editingTitle}
              onblur={commitRename}
              onkeydown={handleRenameKeydown}
              use:selectAll
              class="px-3 py-1.5 text-sm rounded-t bg-[var(--color-surface)] text-[var(--color-text)] border border-b-0 border-[var(--color-border)] outline-none w-32"
            />
          {:else}
            <div class="group flex items-center gap-0.5 rounded-t transition-colors {note.id === noteState.activeNoteId ? 'bg-[var(--color-surface)] border border-b-0 border-[var(--color-border)]' : ''}">
              <button
                onclick={() => noteState.activeNoteId = note.id}
                ondblclick={() => startRename(note)}
                class="px-3 py-1.5 text-sm transition-colors {note.id === noteState.activeNoteId ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}"
              >
                {note.title}
              </button>
              {#if entityNotes.length > 1}
                <button
                  onclick={(e) => { e.stopPropagation(); confirmDeleteNoteId = note.id; }}
                  title="Delete note"
                  class="opacity-0 group-hover:opacity-100 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-opacity"
                >
                  &times;
                </button>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="flex-1 overflow-hidden">
      {#if activeNote}
        {#key activeNote.id}
          <NoteEditor
            content={activeNote.content}
            gameId={activeNote.gameId}
            onSave={(content) => updateNoteContent(activeNote.id, content, authState.user?.id, activeNote.gameId)}
            onBeforeCleanup={async (content) => {
              if (!authState.user || !activeNote) return;
              const title = `Pre-cleanup: ${activeNote.title}`;
              await createNote(authState.user.id, activeNote.gameId, activeNote.entityId, title, { content, activate: false });
            }}
          />
          <BacklinksPanel noteId={activeNote.id} />
        {/key}
      {:else}
        <div class="flex-1 flex items-center justify-center p-4">
          <p class="text-[var(--color-text-muted)]">Create a note to get started.</p>
        </div>
      {/if}
    </div>
  {:else}
    <div class="flex-1 flex items-center justify-center">
      <p class="text-[var(--color-text-muted)]">Select an entity from the sidebar to view notes.</p>
    </div>
  {/if}
</main>

{#if confirmDeleteNoteId}
  {@const noteToDelete = entityNotes.find(n => n.id === confirmDeleteNoteId)}
  <ConfirmDeleteModal
    title="Delete Note"
    message="Are you sure you want to delete &quot;{noteToDelete?.title ?? 'this note'}&quot;? This cannot be undone."
    onClose={() => confirmDeleteNoteId = null}
    onConfirm={async () => { await deleteNote(confirmDeleteNoteId!); confirmDeleteNoteId = null; }}
  />
{/if}
