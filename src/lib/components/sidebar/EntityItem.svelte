<script lang="ts">
  import type { Entity } from '$lib/state/gameState.svelte';

  let { entity, active, onSelect, onDelete }: {
    entity: Entity;
    active: boolean;
    onSelect: () => void;
    onDelete: () => void;
  } = $props();
</script>

<div class="group flex items-center rounded transition-colors {active ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-[var(--color-surface-hover)]'}">
  <button
    onclick={onSelect}
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
</div>
