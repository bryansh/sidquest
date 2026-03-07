<script lang="ts">
  import type { Entity } from '$lib/state/gameState.svelte';

  let { entity, active, onSelect }: {
    entity: Entity;
    active: boolean;
    onSelect: () => void;
  } = $props();
</script>

<button
  onclick={onSelect}
  class="w-full text-left px-3 py-1.5 text-sm rounded transition-colors {active ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-[var(--color-surface-hover)]'}"
>
  <span class="block truncate">{entity.name}</span>
  {#if entity.summary}
    <span class="block text-xs truncate {active ? 'text-white/70' : 'text-[var(--color-text-muted)]'}">{entity.summary}</span>
  {/if}
</button>
