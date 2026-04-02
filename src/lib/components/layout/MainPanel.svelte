<script lang="ts">
  import { gameState, renameEntity } from '$lib/state/gameState.svelte';
  import { noteState, createNote, updateNoteContent, renameNote, deleteNote, reorderNotes } from '$lib/state/noteState.svelte';
  import { sessionState, createSessionNote, updateSessionNoteContent, renameSessionNote, deleteSessionNote, reorderSessionNotes, renameSession } from '$lib/state/sessionState.svelte';
  import { authState } from '$lib/auth/authState.svelte';
  import NoteEditor from '../editor/NoteEditor.svelte';
  import BacklinksPanel from '../editor/BacklinksPanel.svelte';
  import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.svelte';
  import ExtractEntitiesModal from '../modals/ExtractEntitiesModal.svelte';
  import { chatState, openChat } from '$lib/state/chatState.svelte';
  import { showToast } from '$lib/state/toastState.svelte';

  let { onNewGame }: { onNewGame?: () => void } = $props();

  let confirmDeleteNoteId = $state<string | null>(null);
  let confirmDeleteSessionNoteId = $state<string | null>(null);
  let showExtractEntities = $state(false);

  // === Entity editing ===
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
    if (e.key === 'Enter') { e.preventDefault(); commitEntityRename(); }
    else if (e.key === 'Escape') { editingEntityName = false; }
  }

  // === Session editing ===
  let editingSessionName = $state(false);
  let sessionNameValue = $state('');

  function startSessionRename() {
    if (!activeSession) return;
    sessionNameValue = activeSession.name;
    editingSessionName = true;
  }

  async function commitSessionRename() {
    if (activeSession && sessionNameValue.trim() && sessionNameValue.trim() !== activeSession.name) {
      await renameSession(activeSession.id, sessionNameValue.trim());
    }
    editingSessionName = false;
  }

  function handleSessionNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitSessionRename(); }
    else if (e.key === 'Escape') { editingSessionName = false; }
  }

  // === Derived state ===
  const activeEntity = $derived(
    gameState.entities.find(e => e.id === noteState.activeEntityId) ?? null
  );
  const entityNotes = $derived(
    noteState.notes.filter(n => n.entityId === noteState.activeEntityId).sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const activeNote = $derived(
    noteState.notes.find(n => n.id === noteState.activeNoteId) ?? null
  );

  const activeSession = $derived(
    sessionState.sessions.find(s => s.id === sessionState.activeSessionId) ?? null
  );
  const sortedSessionNotes = $derived(
    [...sessionState.sessionNotes].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const activeSessionNote = $derived(
    sessionState.sessionNotes.find(n => n.id === sessionState.activeSessionNoteId) ?? null
  );

  function selectAll(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  // === Tab inline editing (shared) ===
  let editingTabId = $state<string | null>(null);

  function startTabEdit(noteId: string, el: HTMLElement) {
    editingTabId = noteId;
    el.contentEditable = 'true';
    el.focus();
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function commitTabEdit(noteId: string, el: HTMLElement, isSession: boolean) {
    if (editingTabId !== noteId) return;
    el.contentEditable = 'false';
    const newTitle = el.textContent?.trim() || '';
    editingTabId = null;
    if (!newTitle) return;
    if (isSession) {
      renameSessionNote(noteId, newTitle);
    } else {
      renameNote(noteId, newTitle);
    }
  }

  function handleTabEditKeydown(e: KeyboardEvent, noteId: string, isSession: boolean) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTabEdit(noteId, e.target as HTMLElement, isSession);
    } else if (e.key === 'Escape') {
      editingTabId = null;
      (e.target as HTMLElement).contentEditable = 'false';
      // Restore original text — the DOM still has the source of truth from Svelte reactivity
    }
  }

  // === New note handlers ===
  async function handleNewNote() {
    if (!authState.user || !gameState.activeGameId || !noteState.activeEntityId) return;
    await createNote(authState.user.id, gameState.activeGameId, noteState.activeEntityId, 'Untitled');
  }

  async function handleNewSessionNote() {
    if (!authState.user || !gameState.activeGameId || !sessionState.activeSessionId) return;
    const now = new Date();
    const title = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    await createSessionNote(authState.user.id, gameState.activeGameId, sessionState.activeSessionId, title);
  }

  // === Tab drag reordering ===
  let tabDragId = $state<string | null>(null);
  let tabDropTargetId = $state<string | null>(null);
  let tabDropPosition = $state<'left' | 'right'>('left');
  let tabDragging = $state(false);
  let tabDragStartX = 0;
  let tabContainerEl = $state<HTMLElement | null>(null);

  function handleTabPointerDown(e: PointerEvent, noteId: string, isSession: boolean) {
    if (e.button !== 0 || editingTabId) return;
    tabDragId = noteId;
    tabDragStartX = e.clientX;
    let started = false;

    const onMove = (ev: PointerEvent) => {
      if (!started && Math.abs(ev.clientX - tabDragStartX) > 5) {
        started = true;
        tabDragging = true;
      }
      if (started) updateTabDropTarget(ev.clientX);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (tabDragging && tabDropTargetId && tabDragId && tabDropTargetId !== tabDragId) {
        const notes = isSession ? sortedSessionNotes : entityNotes;
        const ids = notes.map(n => n.id);
        const fromIdx = ids.indexOf(tabDragId);
        let toIdx = ids.indexOf(tabDropTargetId);
        if (fromIdx >= 0 && toIdx >= 0) {
          ids.splice(fromIdx, 1);
          toIdx = ids.indexOf(tabDropTargetId);
          const insertIdx = tabDropPosition === 'right' ? toIdx + 1 : toIdx;
          ids.splice(insertIdx, 0, tabDragId);
          if (isSession) reorderSessionNotes(ids);
          else reorderNotes(ids);
        }
      }
      tabDragId = null;
      tabDropTargetId = null;
      tabDragging = false;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function updateTabDropTarget(x: number) {
    if (!tabContainerEl) return;
    const tabs = tabContainerEl.querySelectorAll('[data-tab-id]');
    let closest: string | null = null;
    let closestDist = Infinity;
    let pos: 'left' | 'right' = 'left';
    for (const el of tabs) {
      const rect = el.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      const dist = Math.abs(x - mid);
      if (dist < closestDist) { closestDist = dist; closest = (el as HTMLElement).dataset.tabId!; pos = x < mid ? 'left' : 'right'; }
    }
    if (closest === tabDragId) tabDropTargetId = null;
    else { tabDropTargetId = closest; tabDropPosition = pos; }
  }

  function formatSessionDate(dateStr: string | null): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  }
</script>

<main class="flex-1 flex flex-col h-full overflow-hidden relative">
  {#if activeSession}
    <!-- SESSION VIEW -->
    <header class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
      <div>
        {#if editingSessionName}
          <input
            type="text"
            bind:value={sessionNameValue}
            onblur={commitSessionRename}
            onkeydown={handleSessionNameKeydown}
            use:selectAll
            class="text-lg font-semibold bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-0.5 outline-none text-[var(--color-text)]"
          />
        {:else}
          <h2 class="group/title text-lg font-semibold cursor-pointer flex items-center gap-1.5" ondblclick={startSessionRename} title="Double-click to rename">
            📅 {activeSession.name}
            <span class="opacity-0 group-hover/title:opacity-40 text-xs transition-opacity">&#9998;</span>
          </h2>
        {/if}
        {#if activeSession.sessionDate}
          <p class="text-xs text-[var(--color-text-muted)]">{formatSessionDate(activeSession.sessionDate)}</p>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        {#if sortedSessionNotes.length > 0}
          <button
            onclick={() => showExtractEntities = true}
            title="AI: Extract entities from session notes"
            class="text-sm px-3 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-muted)] transition-colors"
          >
            Extract Entities
          </button>
        {/if}
        <button
          onclick={handleNewSessionNote}
          class="text-sm px-3 py-1 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors"
        >
          + Note
        </button>
      </div>
    </header>

    {#if sortedSessionNotes.length > 0}
      <div class="flex gap-1 px-4 pt-2 border-b border-[var(--color-border)] overflow-x-auto" bind:this={tabContainerEl}>
        {#each sortedSessionNotes as note}
          <div
            class="group relative flex items-center gap-0.5 rounded-t transition-colors shrink-0 {tabDragging && tabDragId === note.id ? 'opacity-40' : ''} {note.id === sessionState.activeSessionNoteId ? 'bg-[var(--color-surface)] border border-b-0 border-[var(--color-border)]' : ''}"
            data-tab-id={note.id}
          >
            {#if tabDropTargetId === note.id}
              <div class="absolute top-0 bottom-0 w-0.5 bg-[var(--color-accent)] pointer-events-none z-10" style={tabDropPosition === 'left' ? 'left: -2px' : 'right: -2px'}></div>
            {/if}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
              role="tab"
              tabindex="0"
              onclick={() => { if (editingTabId !== note.id) sessionState.activeSessionNoteId = note.id; }}
              ondblclick={(e) => startTabEdit(note.id, e.currentTarget)}
              onblur={(e) => commitTabEdit(note.id, e.currentTarget, true)}
              onkeydown={(e) => { if (editingTabId === note.id) handleTabEditKeydown(e, note.id, true); }}
              onpointerdown={(e) => { if (editingTabId !== note.id) handleTabPointerDown(e, note.id, true); }}
              title="Double-click to rename"
              class="px-3 py-1.5 text-sm transition-colors whitespace-nowrap outline-none {editingTabId !== note.id ? 'cursor-grab active:cursor-grabbing' : 'cursor-text'} {note.id === sessionState.activeSessionNoteId ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}"
            >{note.title}</span>
            {#if sortedSessionNotes.length > 1 && editingTabId !== note.id}
              <button
                onclick={(e) => { e.stopPropagation(); confirmDeleteSessionNoteId = note.id; }}
                title="Delete note"
                class="opacity-0 group-hover:opacity-100 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-opacity"
              >&times;</button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <div class="flex-1 overflow-hidden">
      {#if activeSessionNote}
        {#key activeSessionNote.id}
          <NoteEditor
            content={activeSessionNote.content}
            gameId={activeSessionNote.gameId}
            onSave={(content) => updateSessionNoteContent(activeSessionNote.id, content)}
          />
        {/key}
      {:else}
        <div class="flex-1 flex flex-col items-center justify-center p-4 gap-3">
          <p class="text-[var(--color-text-muted)]">No notes in this session yet.</p>
          <button
            onclick={handleNewSessionNote}
            class="text-sm px-4 py-2 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors"
          >
            + Create Note
          </button>
        </div>
      {/if}
    </div>

  {:else if activeEntity}
    <!-- ENTITY VIEW (unchanged) -->
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
        <h2 class="group/title text-lg font-semibold cursor-pointer flex items-center gap-1.5" ondblclick={startEntityRename} title="Double-click to rename">
          {activeEntity.name}
          <span class="opacity-0 group-hover/title:opacity-40 text-xs transition-opacity">&#9998;</span>
        </h2>
      {/if}
      <button
        onclick={handleNewNote}
        class="text-sm px-3 py-1 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors"
      >
        + Note
      </button>
    </header>

    {#if entityNotes.length > 0}
      <div class="flex gap-1 px-4 pt-2 border-b border-[var(--color-border)] overflow-x-auto" bind:this={tabContainerEl}>
        {#each entityNotes as note}
          <div
            class="group relative flex items-center gap-0.5 rounded-t transition-colors shrink-0 {tabDragging && tabDragId === note.id ? 'opacity-40' : ''} {note.id === noteState.activeNoteId ? 'bg-[var(--color-surface)] border border-b-0 border-[var(--color-border)]' : ''}"
            data-tab-id={note.id}
          >
            {#if tabDropTargetId === note.id}
              <div class="absolute top-0 bottom-0 w-0.5 bg-[var(--color-accent)] pointer-events-none z-10" style={tabDropPosition === 'left' ? 'left: -2px' : 'right: -2px'}></div>
            {/if}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
              role="tab"
              tabindex="0"
              onclick={() => { if (editingTabId !== note.id) noteState.activeNoteId = note.id; }}
              ondblclick={(e) => startTabEdit(note.id, e.currentTarget)}
              onblur={(e) => commitTabEdit(note.id, e.currentTarget, false)}
              onkeydown={(e) => { if (editingTabId === note.id) handleTabEditKeydown(e, note.id, false); }}
              onpointerdown={(e) => { if (editingTabId !== note.id) handleTabPointerDown(e, note.id, false); }}
              title="Double-click to rename"
              class="px-3 py-1.5 text-sm transition-colors whitespace-nowrap outline-none {editingTabId !== note.id ? 'cursor-grab active:cursor-grabbing' : 'cursor-text'} {note.id === noteState.activeNoteId ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}"
            >{note.title}</span>
            {#if entityNotes.length > 1 && editingTabId !== note.id}
              <button
                onclick={(e) => { e.stopPropagation(); confirmDeleteNoteId = note.id; }}
                title="Delete note"
                class="opacity-0 group-hover:opacity-100 px-1 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-opacity"
              >&times;</button>
            {/if}
          </div>
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
          />
          <BacklinksPanel noteId={activeNote.id} />
        {/key}
      {:else}
        <div class="flex-1 flex flex-col items-center justify-center p-4 gap-3">
          <p class="text-[var(--color-text-muted)]">No notes for this entity yet.</p>
          <button
            onclick={handleNewNote}
            class="text-sm px-4 py-2 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors"
          >
            + Create Note
          </button>
        </div>
      {/if}
    </div>

  {:else}
    <div class="flex-1 flex flex-col items-center justify-center gap-4">
      {#if gameState.games.length === 0}
        <p class="text-lg text-[var(--color-text-muted)]">Welcome to Sidquest</p>
        <p class="text-sm text-[var(--color-text-muted)]">Create a game to start tracking your campaign.</p>
        {#if onNewGame}
          <button
            onclick={onNewGame}
            class="px-5 py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm transition-colors"
          >
            + Create Your First Game
          </button>
        {/if}
      {:else if !gameState.activeGameId}
        <p class="text-[var(--color-text-muted)]">Select a game from the sidebar to get started.</p>
      {:else}
        <p class="text-[var(--color-text-muted)]">Select a session or entity from the sidebar.</p>
      {/if}
    </div>
  {/if}

  <!-- Chat toggle button -->
  {#if gameState.activeGameId && !chatState.open}
    <button
      onclick={openChat}
      title="Ask questions about your game"
      class="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-lg flex items-center justify-center transition-colors text-lg"
    >
      💬
    </button>
  {/if}
</main>

{#if confirmDeleteNoteId}
  {@const noteToDelete = entityNotes.find(n => n.id === confirmDeleteNoteId)}
  <ConfirmDeleteModal
    title="Delete Note"
    message="Are you sure you want to delete &quot;{noteToDelete?.title ?? 'this note'}&quot;? This cannot be undone."
    onClose={() => confirmDeleteNoteId = null}
    onConfirm={async () => { await deleteNote(confirmDeleteNoteId!); confirmDeleteNoteId = null; showToast('Note deleted', 'info'); }}
  />
{/if}

{#if showExtractEntities}
  <ExtractEntitiesModal
    onClose={() => showExtractEntities = false}
    onExtracted={(count) => {
      showExtractEntities = false;
      showToast(`Created ${count} ${count === 1 ? 'entity' : 'entities'}`, 'success');
    }}
  />
{/if}

{#if confirmDeleteSessionNoteId}
  {@const noteToDelete = sortedSessionNotes.find(n => n.id === confirmDeleteSessionNoteId)}
  <ConfirmDeleteModal
    title="Delete Session Note"
    message="Are you sure you want to delete &quot;{noteToDelete?.title ?? 'this note'}&quot;? This cannot be undone."
    onClose={() => confirmDeleteSessionNoteId = null}
    onConfirm={async () => { await deleteSessionNote(confirmDeleteSessionNoteId!); confirmDeleteSessionNoteId = null; showToast('Note deleted', 'info'); }}
  />
{/if}
