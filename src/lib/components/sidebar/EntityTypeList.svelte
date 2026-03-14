<script lang="ts">
  import { Collapsible } from 'bits-ui';
  import type { EntityType, Entity } from '$lib/state/gameState.svelte';
  import EntityItem from './EntityItem.svelte';

  let { entityTypes, entities, activeEntityId, onSelectEntity, onNewEntity, onDeleteEntity, onRenameEntity, onDeleteEntityType, onRenameEntityType, onReorderEntityTypes }: {
    entityTypes: EntityType[];
    entities: Entity[];
    activeEntityId: string | null;
    onSelectEntity: (id: string) => void;
    onNewEntity: (entityTypeId: string) => void;
    onDeleteEntity: (entityId: string) => void;
    onRenameEntity: (entityId: string, name: string) => void;
    onDeleteEntityType: (entityTypeId: string) => void;
    onRenameEntityType: (entityTypeId: string, name: string, icon?: string) => void;
    onReorderEntityTypes: (orderedIds: string[]) => void;
  } = $props();

  const sortedTypes = $derived(
    [...entityTypes].sort((a, b) => a.sortOrder - b.sortOrder)
  );

  let editingTypeId = $state<string | null>(null);
  let editName = $state('');
  let editIcon = $state('');
  let dragId = $state<string | null>(null);
  let dropTargetId = $state<string | null>(null);
  let dropPosition = $state<'above' | 'below'>('above');
  let containerEl = $state<HTMLElement | null>(null);

  function startEdit(et: EntityType) {
    editingTypeId = et.id;
    editName = et.name;
    editIcon = et.icon ?? '';
  }

  function commitEdit() {
    if (editingTypeId && editName.trim()) {
      onRenameEntityType(editingTypeId, editName.trim(), editIcon.trim());
    }
    editingTypeId = null;
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      editingTypeId = null;
    }
  }

  function focusInput(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  // Pointer-based drag reordering (avoids HTML5 DnD issues with buttons/webview)
  let dragStartY = 0;
  let dragCurrentY = 0;
  let dragging = $state(false);

  function handlePointerDown(e: PointerEvent, id: string) {
    if (e.button !== 0 || editingTypeId) return;
    e.preventDefault();
    dragId = id;
    dragStartY = e.clientY;
    dragCurrentY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      dragCurrentY = ev.clientY;
      if (!dragging && Math.abs(dragCurrentY - dragStartY) > 5) {
        dragging = true;
      }
      if (dragging) {
        updateDropTarget(ev.clientY);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (dragging && dropTargetId && dragId && dropTargetId !== dragId) {
        const ids = sortedTypes.map(t => t.id);
        const fromIdx = ids.indexOf(dragId);
        let toIdx = ids.indexOf(dropTargetId);
        if (fromIdx >= 0 && toIdx >= 0) {
          ids.splice(fromIdx, 1);
          // Recalculate toIdx after removal
          toIdx = ids.indexOf(dropTargetId);
          const insertIdx = dropPosition === 'below' ? toIdx + 1 : toIdx;
          ids.splice(insertIdx, 0, dragId);
          onReorderEntityTypes(ids);
        }
      }
      dragId = null;
      dropTargetId = null;
      dragging = false;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function updateDropTarget(y: number) {
    if (!containerEl) return;
    const headers = containerEl.querySelectorAll('[data-type-id]');
    let closest: string | null = null;
    let closestDist = Infinity;
    let pos: 'above' | 'below' = 'above';
    for (const el of headers) {
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(y - mid);
      if (dist < closestDist) {
        closestDist = dist;
        closest = (el as HTMLElement).dataset.typeId!;
        pos = y < mid ? 'above' : 'below';
      }
    }
    if (closest === dragId) {
      dropTargetId = null;
    } else {
      dropTargetId = closest;
      dropPosition = pos;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={containerEl}>
  {#each sortedTypes as entityType}
    {@const typeEntities = entities.filter(e => e.entityTypeId === entityType.id)}
    <div class="mb-1 {dragging && dragId === entityType.id ? 'opacity-40' : ''}">
      <Collapsible.Root>
        {#if editingTypeId === entityType.id}
          <div class="flex items-center gap-1 px-2 py-1">
            <input
              type="text"
              bind:value={editIcon}
              placeholder="🏷"
              onkeydown={handleEditKeydown}
              onblur={commitEdit}
              class="w-8 text-center text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1 py-1 outline-none text-[var(--color-text)]"
            />
            <input
              type="text"
              bind:value={editName}
              onkeydown={handleEditKeydown}
              onblur={commitEdit}
              use:focusInput
              class="flex-1 text-xs font-semibold uppercase tracking-wider bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 outline-none text-[var(--color-text)]"
            />
          </div>
        {:else}
          <div
            class="group flex items-center relative"
            data-type-id={entityType.id}
          >
            {#if dropTargetId === entityType.id}
              <div
                class="absolute left-0 right-0 h-0.5 bg-[var(--color-accent)] pointer-events-none z-10"
                style={dropPosition === 'above' ? 'top: -1px' : 'bottom: -1px'}
              ></div>
            {/if}
            <span
              class="flex items-center px-2 py-1.5 cursor-grab active:cursor-grabbing text-[var(--color-text-muted)] text-sm select-none opacity-0 group-hover:opacity-50"
              onpointerdown={(e) => handlePointerDown(e, entityType.id)}
            >⠿</span>
            <Collapsible.Trigger
              ondblclick={(e) => { e.preventDefault(); startEdit(entityType); }}
              class="flex-1 flex items-center justify-between pr-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded transition-colors"
            >
              <span class="flex items-center gap-1.5">
                {#if entityType.icon}<span>{entityType.icon}</span>{/if}
                {entityType.name}
                <span class="font-normal text-[var(--color-text-muted)]">({typeEntities.length})</span>
              </span>
              <span class="text-[10px] transition-transform group-data-[state=open]:rotate-90">&#9656;</span>
            </Collapsible.Trigger>
            <button
              onclick={(e) => { e.stopPropagation(); onDeleteEntityType(entityType.id); }}
              title="Delete type"
              class="opacity-0 group-hover:opacity-100 transition-opacity px-1 py-0.5 mr-1 text-xs text-[var(--color-text-muted)] hover:text-red-400"
            >&times;</button>
          </div>
        {/if}
        <Collapsible.Content class="ml-2">
          {#each typeEntities as entity}
            <EntityItem
              {entity}
              active={entity.id === activeEntityId}
              onSelect={() => onSelectEntity(entity.id)}
              onDelete={() => onDeleteEntity(entity.id)}
              onRename={(name) => onRenameEntity(entity.id, name)}
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
</div>
