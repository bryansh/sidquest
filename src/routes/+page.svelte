<script lang="ts">
  import { onMount } from 'svelte';
  import { authState, checkSession } from '$lib/auth/authState.svelte';
  import { loadGames, createGame, createEntityType, createEntity, deleteEntity, deleteGameById, gameState } from '$lib/state/gameState.svelte';
  import { selectEntity } from '$lib/state/noteState.svelte';
  import SignIn from '$lib/components/auth/SignIn.svelte';
  import TitleBar from '$lib/components/layout/TitleBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import MainPanel from '$lib/components/layout/MainPanel.svelte';
  import NewGameModal from '$lib/components/modals/NewGameModal.svelte';
  import NewEntityTypeModal from '$lib/components/modals/NewEntityTypeModal.svelte';
  import NewEntityModal from '$lib/components/modals/NewEntityModal.svelte';
  import SearchModal from '$lib/components/modals/SearchModal.svelte';
  import ConfirmDeleteModal from '$lib/components/modals/ConfirmDeleteModal.svelte';

  let showSearch = $state(false);
  let showNewGame = $state(false);
  let showNewEntityType = $state(false);
  let showNewEntity = $state(false);
  let newEntityTypeId = $state('');
  let confirmDeleteEntityId = $state<string | null>(null);
  let confirmDeleteGameId = $state<string | null>(null);

  onMount(() => {
    checkSession();

    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        showSearch = !showSearch;
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  // Load games when user is authenticated
  $effect(() => {
    if (authState.user) {
      loadGames(authState.user.id);
    }
  });
</script>

{#if authState.loading}
  <div class="flex items-center justify-center h-screen w-screen bg-[var(--color-bg)]">
    <p class="text-[var(--color-text-muted)]">Loading...</p>
  </div>
{:else if !authState.user}
  <SignIn />
{:else}
  <div class="flex flex-col h-screen w-screen bg-[var(--color-bg)] rounded-lg overflow-hidden border border-[var(--color-border)]">
    <TitleBar />
    <div class="flex flex-1 overflow-hidden">
      <Sidebar
        onNewGame={() => showNewGame = true}
        onNewEntityType={() => showNewEntityType = true}
        onNewEntity={(typeId) => { newEntityTypeId = typeId; showNewEntity = true; }}
        onSelectEntity={(id) => selectEntity(id)}
        onDeleteEntity={(id) => confirmDeleteEntityId = id}
        onDeleteGame={(id) => confirmDeleteGameId = id}
      />
      <MainPanel />
    </div>
  </div>

  {#if showNewGame}
    <NewGameModal
      onClose={() => showNewGame = false}
      onCreate={async (name, description) => {
        await createGame(authState.user!.id, name, description);
        showNewGame = false;
      }}
    />
  {/if}

  {#if showNewEntityType}
    <NewEntityTypeModal
      onClose={() => showNewEntityType = false}
      onCreate={async (name, icon) => {
        await createEntityType(authState.user!.id, name, { icon });
        showNewEntityType = false;
      }}
    />
  {/if}

  {#if showNewEntity}
    <NewEntityModal
      entityTypes={gameState.entityTypes}
      defaultTypeId={newEntityTypeId}
      onClose={() => showNewEntity = false}
      onCreate={async (entityTypeId, name, summary) => {
        await createEntity(authState.user!.id, entityTypeId, name, { summary });
        showNewEntity = false;
      }}
    />
  {/if}

  {#if showSearch}
    <SearchModal onClose={() => showSearch = false} />
  {/if}

  {#if confirmDeleteEntityId}
    {@const entityToDelete = gameState.entities.find(e => e.id === confirmDeleteEntityId)}
    <ConfirmDeleteModal
      title="Delete Entity"
      message="Are you sure you want to delete &quot;{entityToDelete?.name ?? 'this entity'}&quot; and all its notes? This cannot be undone."
      onClose={() => confirmDeleteEntityId = null}
      onConfirm={async () => { await deleteEntity(confirmDeleteEntityId!); confirmDeleteEntityId = null; }}
    />
  {/if}

  {#if confirmDeleteGameId}
    {@const gameToDelete = gameState.games.find(g => g.id === confirmDeleteGameId)}
    <ConfirmDeleteModal
      title="Delete Game"
      message="Are you sure you want to delete &quot;{gameToDelete?.name ?? 'this game'}&quot; and all its entities and notes? This cannot be undone."
      onClose={() => confirmDeleteGameId = null}
      onConfirm={async () => { await deleteGameById(confirmDeleteGameId!); confirmDeleteGameId = null; }}
    />
  {/if}
{/if}
