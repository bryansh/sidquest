<script lang="ts">
  import type { EntityType, Entity } from '$lib/state/gameState.svelte';
  import EntityItem from './EntityItem.svelte';

  let { entityTypes, entities, activeEntityId, onSelectEntity, onNewEntity }: {
    entityTypes: EntityType[];
    entities: Entity[];
    activeEntityId: string | null;
    onSelectEntity: (id: string) => void;
    onNewEntity: (entityTypeId: string) => void;
  } = $props();

  let expandedTypes = $state<Set<string>>(new Set());

  function toggleType(id: string) {
    const next = new Set(expandedTypes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedTypes = next;
  }

  const sortedTypes = $derived(
    [...entityTypes].sort((a, b) => a.sortOrder - b.sortOrder)
  );
</script>

{#each sortedTypes as entityType}
  {@const typeEntities = entities.filter(e => e.entityTypeId === entityType.id)}
  <div class="mb-1">
    <button
      onclick={() => toggleType(entityType.id)}
      class="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded transition-colors"
    >
      <span class="flex items-center gap-1.5">
        {#if entityType.icon}<span>{entityType.icon}</span>{/if}
        {entityType.name}
        <span class="font-normal text-[var(--color-text-muted)]">({typeEntities.length})</span>
      </span>
      <span class="text-[10px]">{expandedTypes.has(entityType.id) ? '&#9662;' : '&#9656;'}</span>
    </button>

    {#if expandedTypes.has(entityType.id)}
      <div class="ml-2">
        {#each typeEntities as entity}
          <EntityItem
            {entity}
            active={entity.id === activeEntityId}
            onSelect={() => onSelectEntity(entity.id)}
          />
        {/each}
        <button
          onclick={() => onNewEntity(entityType.id)}
          class="w-full text-left px-3 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded transition-colors"
        >
          + Add {entityType.name}
        </button>
      </div>
    {/if}
  </div>
{/each}
