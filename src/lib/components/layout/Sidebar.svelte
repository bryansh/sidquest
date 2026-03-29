<script lang="ts">
  import { gameState } from '$lib/state/gameState.svelte';
  import { noteState } from '$lib/state/noteState.svelte';
  import { sessionState } from '$lib/state/sessionState.svelte';
  import GameSelector from '../sidebar/GameSelector.svelte';
  import EntityTypeList from '../sidebar/EntityTypeList.svelte';
  import SessionList from '../sidebar/SessionList.svelte';

  let { onNewGame, onNewEntityType, onNewEntity, onSelectEntity, onDeleteEntity, onDeleteGame, onRenameEntity, onDeleteEntityType, onRenameEntityType, onReorderEntityTypes, onReorderEntities, onSelectSession, onNewSession, onDeleteSession, onRenameSession }: {
    onNewGame: () => void;
    onNewEntityType: () => void;
    onNewEntity: (entityTypeId: string) => void;
    onSelectEntity: (id: string) => void;
    onDeleteEntity: (entityId: string) => void;
    onDeleteGame: (gameId: string) => void;
    onRenameEntity: (entityId: string, name: string) => void;
    onDeleteEntityType: (entityTypeId: string) => void;
    onRenameEntityType: (entityTypeId: string, name: string, icon?: string) => void;
    onReorderEntityTypes: (orderedIds: string[]) => void;
    onReorderEntities: (orderedIds: string[]) => void;
    onSelectSession: (id: string) => void;
    onNewSession: () => void;
    onDeleteSession: (id: string) => void;
    onRenameSession: (id: string, name: string) => void;
  } = $props();
</script>

<aside class="flex flex-col h-full border-r border-[var(--color-border)] bg-[var(--color-surface)]" style="width: var(--sidebar-width, 256px); min-width: 180px; max-width: 480px;">
  <div class="p-3 border-b border-[var(--color-border)]">
    <GameSelector onNewGame={onNewGame} onDeleteGame={onDeleteGame} />
  </div>

  <div class="flex-1 overflow-y-auto p-2">
    {#if gameState.activeGameId}
      <SessionList
        sessions={sessionState.sessions}
        activeSessionId={sessionState.activeSessionId}
        {onSelectSession}
        {onNewSession}
        {onDeleteSession}
        {onRenameSession}
      />

      {#if gameState.entityTypes.length > 0}
        <EntityTypeList
          entityTypes={gameState.entityTypes}
          entities={gameState.entities}
          activeEntityId={noteState.activeEntityId}
          onSelectEntity={onSelectEntity}
          onNewEntity={onNewEntity}
          onDeleteEntity={onDeleteEntity}
          onRenameEntity={onRenameEntity}
          onDeleteEntityType={onDeleteEntityType}
          onRenameEntityType={onRenameEntityType}
          onReorderEntityTypes={onReorderEntityTypes}
          onReorderEntities={onReorderEntities}
        />
      {:else}
        <p class="p-3 text-sm text-[var(--color-text-muted)]">No entity types yet. Create one to start organizing.</p>
      {/if}
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
