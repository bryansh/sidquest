<script lang="ts">
  import { gameState } from '$lib/state/gameState.svelte';
  import { noteState } from '$lib/state/noteState.svelte';
  import GameSelector from '../sidebar/GameSelector.svelte';
  import EntityTypeList from '../sidebar/EntityTypeList.svelte';

  let { onNewEntityType, onNewEntity }: {
    onNewEntityType: () => void;
    onNewEntity: (entityTypeId: string) => void;
  } = $props();
</script>

<aside class="flex flex-col w-64 min-w-64 h-full border-r border-[var(--color-border)] bg-[var(--color-surface)]">
  <div class="p-3 border-b border-[var(--color-border)]">
    <GameSelector />
  </div>

  <div class="flex-1 overflow-y-auto p-2">
    {#if gameState.activeGameId}
      <EntityTypeList
        entityTypes={gameState.entityTypes}
        entities={gameState.entities}
        activeEntityId={noteState.activeEntityId}
        onSelectEntity={(id) => noteState.activeEntityId = id}
        onNewEntity={onNewEntity}
      />
      <button
        onclick={onNewEntityType}
        class="mt-2 w-full text-left px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded transition-colors"
      >
        + New Type
      </button>
    {:else}
      <p class="p-3 text-sm text-[var(--color-text-muted)]">Select or create a game to get started.</p>
    {/if}
  </div>
</aside>
