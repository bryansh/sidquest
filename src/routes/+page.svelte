<script lang="ts">
  import { onMount } from 'svelte';
  import { authState, checkSession } from '$lib/auth/authState.svelte';
  import { loadGames, createGame, createEntityType, createEntity, deleteEntity, deleteGameById, renameEntity, renameEntityType, deleteEntityTypeById, reorderEntityTypes, reorderEntities, gameState } from '$lib/state/gameState.svelte';
  import { selectEntity } from '$lib/state/noteState.svelte';
  import { loadSettings, settings, updateSettings } from '$lib/state/settingsState.svelte';
  import { uiState } from '$lib/state/uiState.svelte';
  import { getLocalDb } from '$lib/db/local/sqlite';
  import { hydrateIfNeeded } from '$lib/db/sync/hydrate';
  import { initSyncService } from '$lib/state/syncState.svelte';
  import SignIn from '$lib/components/auth/SignIn.svelte';
  import TitleBar from '$lib/components/layout/TitleBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import MainPanel from '$lib/components/layout/MainPanel.svelte';
  import NewGameModal from '$lib/components/modals/NewGameModal.svelte';
  import NewEntityTypeModal from '$lib/components/modals/NewEntityTypeModal.svelte';
  import NewEntityModal from '$lib/components/modals/NewEntityModal.svelte';
  import SearchModal from '$lib/components/modals/SearchModal.svelte';
  import ConfirmDeleteModal from '$lib/components/modals/ConfirmDeleteModal.svelte';
  import SettingsModal from '$lib/components/modals/SettingsModal.svelte';

  let showSearch = $state(false);
  let showNewGame = $state(false);
  let showNewEntityType = $state(false);
  let showNewEntity = $state(false);
  let newEntityTypeId = $state('');
  let confirmDeleteEntityId = $state<string | null>(null);
  let confirmDeleteGameId = $state<string | null>(null);
  let confirmDeleteEntityTypeId = $state<string | null>(null);
  let showSettings = $state(false);
  let resizing = $state(false);

  function handleResizeStart(e: PointerEvent) {
    e.preventDefault();
    resizing = true;
    const startX = e.clientX;
    const startWidth = settings.sidebarWidth;

    function onMove(e: PointerEvent) {
      const newWidth = Math.max(180, Math.min(480, startWidth + e.clientX - startX));
      settings.sidebarWidth = newWidth;
    }

    function onUp() {
      resizing = false;
      updateSettings({ sidebarWidth: settings.sidebarWidth });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  async function onAuthenticated(userId: string) {
    await getLocalDb();
    await hydrateIfNeeded(userId);
    await loadGames(userId);
    initSyncService();
  }

  onMount(() => {
    checkSession().then(() => {
      if (authState.user) onAuthenticated(authState.user.id);
    });
    loadSettings();

    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        showSearch = !showSearch;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        uiState.findOpen = !uiState.findOpen;
      }
    };
    const handleAuthSuccess = (e: Event) => {
      const userId = (e as CustomEvent).detail?.userId;
      if (userId) onAuthenticated(userId);
    };
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('auth-success', handleAuthSuccess);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('auth-success', handleAuthSuccess);
    };
  });
</script>

{#if authState.loading}
  <div class="flex items-center justify-center h-screen w-screen bg-[var(--color-bg)]">
    <p class="text-[var(--color-text-muted)]">Loading...</p>
  </div>
{:else if !authState.user}
  <SignIn />
{:else}
  <div class="flex flex-col h-screen w-screen bg-[var(--color-bg)] overflow-hidden">
    <TitleBar onOpenSettings={() => showSettings = true} />
    <div class="flex flex-1 overflow-hidden" style="--sidebar-width: {settings.sidebarWidth}px">
      <Sidebar
        onNewGame={() => showNewGame = true}
        onNewEntityType={() => showNewEntityType = true}
        onNewEntity={(typeId) => { newEntityTypeId = typeId; showNewEntity = true; }}
        onSelectEntity={(id) => selectEntity(id)}
        onDeleteEntity={(id) => confirmDeleteEntityId = id}
        onDeleteGame={(id) => confirmDeleteGameId = id}
        onRenameEntity={(id, name) => renameEntity(id, name)}
        onDeleteEntityType={(id) => confirmDeleteEntityTypeId = id}
        onRenameEntityType={(id, name, icon) => renameEntityType(id, name, icon)}
        onReorderEntityTypes={(ids) => reorderEntityTypes(ids)}
        onReorderEntities={(ids) => reorderEntities(ids)}
      />
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="w-1 shrink-0 cursor-col-resize hover:bg-[var(--color-accent)]/50 transition-colors {resizing ? 'bg-[var(--color-accent)]' : ''}"
        onpointerdown={handleResizeStart}
      ></div>
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

  {#if confirmDeleteEntityTypeId}
    {@const typeToDelete = gameState.entityTypes.find(t => t.id === confirmDeleteEntityTypeId)}
    <ConfirmDeleteModal
      title="Delete Entity Type"
      message="Are you sure you want to delete &quot;{typeToDelete?.name ?? 'this type'}&quot; and all its entities and notes? This cannot be undone."
      onClose={() => confirmDeleteEntityTypeId = null}
      onConfirm={async () => { await deleteEntityTypeById(confirmDeleteEntityTypeId!); confirmDeleteEntityTypeId = null; }}
    />
  {/if}

  {#if showSettings}
    <SettingsModal onClose={() => showSettings = false} />
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
