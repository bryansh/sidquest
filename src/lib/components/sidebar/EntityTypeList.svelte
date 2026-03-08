<script lang="ts">
  import { Collapsible } from 'bits-ui';
  import type { EntityType, Entity } from '$lib/state/gameState.svelte';
  import EntityItem from './EntityItem.svelte';

  let { entityTypes, entities, activeEntityId, onSelectEntity, onNewEntity }: {
    entityTypes: EntityType[];
    entities: Entity[];
    activeEntityId: string | null;
    onSelectEntity: (id: string) => void;
    onNewEntity: (entityTypeId: string) => void;
  } = $props();

  const sortedTypes = $derived(
    [...entityTypes].sort((a, b) => a.sortOrder - b.sortOrder)
  );
</script>

{#each sortedTypes as entityType}
  {@const typeEntities = entities.filter(e => e.entityTypeId === entityType.id)}
  <div class="mb-1">
    <Collapsible.Root>
      <Collapsible.Trigger class="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded transition-colors group">
        <span class="flex items-center gap-1.5">
          {#if entityType.icon}<span>{entityType.icon}</span>{/if}
          {entityType.name}
          <span class="font-normal text-[var(--color-text-muted)]">({typeEntities.length})</span>
        </span>
        <span class="text-[10px] transition-transform group-data-[state=open]:rotate-90">&#9656;</span>
      </Collapsible.Trigger>
      <Collapsible.Content class="ml-2">
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
      </Collapsible.Content>
    </Collapsible.Root>
  </div>
{/each}
