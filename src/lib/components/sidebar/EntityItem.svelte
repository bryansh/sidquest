<script lang="ts">
  import type { Entity } from '$lib/state/gameState.svelte';

  let { entity, active, onSelect, onDelete, onRename }: {
    entity: Entity;
    active: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onRename: (name: string) => void;
  } = $props();

  let editing = $state(false);
  let editName = $state('');

  function startRename() {
    editName = entity.name;
    editing = true;
  }

  function commitRename() {
    if (editName.trim() && editName.trim() !== entity.name) {
      onRename(editName.trim());
    }
    editing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      editing = false;
    }
  }

  function selectAll(node: HTMLInputElement) {
    node.focus();
    node.select();
  }
</script>

<div class="group flex items-center rounded transition-colors {active ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-[var(--color-surface-hover)]'}">
  {#if editing}
    <input
      type="text"
      bind:value={editName}
      onblur={commitRename}
      onkeydown={handleKeydown}
      use:selectAll
      class="flex-1 px-3 py-1.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded outline-none text-[var(--color-text)] min-w-0"
    />
  {:else}
    <button
      onclick={onSelect}
      ondblclick={startRename}
      class="flex-1 text-left px-3 py-1.5 text-sm min-w-0"
    >
      <span class="block truncate">{entity.name}</span>
      {#if entity.summary}
        <span class="block text-xs truncate {active ? 'text-white/70' : 'text-[var(--color-text-muted)]'}">{entity.summary}</span>
      {/if}
    </button>
    <button
      onclick={(e) => { e.stopPropagation(); onDelete(); }}
      title="Delete entity"
      class="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 mr-1 text-xs {active ? 'text-white/70 hover:text-white' : 'text-[var(--color-text-muted)] hover:text-red-400'} transition-opacity"
    >
      &times;
    </button>
  {/if}
</div>
