<script lang="ts">
  import { onMount } from 'svelte';
  import { authState, checkSession } from '$lib/auth/authState.svelte';
  import { loadGames, createGame, createEntityType, createEntity, gameState } from '$lib/state/gameState.svelte';
  import { selectEntity } from '$lib/state/noteState.svelte';
  import SignIn from '$lib/components/auth/SignIn.svelte';
  import TitleBar from '$lib/components/layout/TitleBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import MainPanel from '$lib/components/layout/MainPanel.svelte';
  import NewGameModal from '$lib/components/modals/NewGameModal.svelte';
  import NewEntityTypeModal from '$lib/components/modals/NewEntityTypeModal.svelte';
  import NewEntityModal from '$lib/components/modals/NewEntityModal.svelte';
  import SearchModal from '$lib/components/modals/SearchModal.svelte';

  let showSearch = $state(false);
  let showNewGame = $state(false);
  let showNewEntityType = $state(false);
  let showNewEntity = $state(false);
  let newEntityTypeId = $state('');

  onMount(async () => {
    await checkSession();

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
{/if}
