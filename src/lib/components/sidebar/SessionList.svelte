<script lang="ts">
  import { Collapsible } from 'bits-ui';
  import type { Session } from '$lib/state/sessionState.svelte';

  let { sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession, onRenameSession }: {
    sessions: Session[];
    activeSessionId: string | null;
    onSelectSession: (id: string) => void;
    onNewSession: () => void;
    onDeleteSession: (id: string) => void;
    onRenameSession: (id: string, name: string) => void;
  } = $props();

  let editingId = $state<string | null>(null);
  let editName = $state('');

  function startEdit(session: Session) {
    editingId = session.id;
    editName = session.name;
  }

  function commitEdit() {
    if (editingId && editName.trim()) {
      onRenameSession(editingId, editName.trim());
    }
    editingId = null;
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    else if (e.key === 'Escape') { editingId = null; }
  }

  function focusInput(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }
</script>

<div class="mb-2">
  <Collapsible.Root open>
    <Collapsible.Trigger
      class="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded transition-colors group"
    >
      <span class="flex items-center gap-1.5">
        📅 Sessions
        <span class="font-normal">({sessions.length})</span>
      </span>
      <span class="text-[10px] transition-transform group-data-[state=open]:rotate-90">&#9656;</span>
    </Collapsible.Trigger>
    <Collapsible.Content class="ml-2">
      {#each sessions as session}
        {#if editingId === session.id}
          <div class="px-2 py-1">
            <input
              type="text"
              bind:value={editName}
              onkeydown={handleEditKeydown}
              onblur={commitEdit}
              use:focusInput
              class="w-full text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 outline-none text-[var(--color-text)]"
            />
          </div>
        {:else}
          <div class="group flex items-center">
            <button
              onclick={() => onSelectSession(session.id)}
              ondblclick={(e) => { e.preventDefault(); startEdit(session); }}
              title="Double-click to rename"
              class="flex-1 flex items-center justify-between px-3 py-1.5 text-sm rounded transition-colors text-left min-w-0 {session.id === activeSessionId
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-text)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'}"
            >
              <span class="truncate">{session.name}</span>
              {#if session.sessionDate}
                <span class="text-[10px] text-[var(--color-text-muted)] ml-2 shrink-0">{formatDate(session.sessionDate)}</span>
              {/if}
            </button>
            <button
              onclick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
              title="Delete session"
              class="opacity-0 group-hover:opacity-100 transition-opacity px-1 py-0.5 mr-1 text-xs text-[var(--color-text-muted)] hover:text-red-400"
            >&times;</button>
          </div>
        {/if}
      {/each}
      <button
        onclick={onNewSession}
        class="w-full text-left px-3 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded transition-colors"
      >
        + New Session
      </button>
    </Collapsible.Content>
  </Collapsible.Root>
</div>
