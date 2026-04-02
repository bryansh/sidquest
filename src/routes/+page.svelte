<script lang="ts">
  import { onMount } from 'svelte';
  import { authState, checkSession } from '$lib/auth/authState.svelte';
  import { loadGames, createGame, createEntityType, createEntity, deleteEntity, deleteGameById, renameEntity, renameEntityType, deleteEntityTypeById, reorderEntityTypes, reorderEntities, gameState, resetGameState } from '$lib/state/gameState.svelte';
  import { selectEntity, resetNoteState } from '$lib/state/noteState.svelte';
  import { selectSession, createSession, deleteSession, renameSession, sessionState, resetSessionState } from '$lib/state/sessionState.svelte';
  import { loadSettings, settings, updateSettings } from '$lib/state/settingsState.svelte';
  import { showToast } from '$lib/state/toastState.svelte';
  import { uiState } from '$lib/state/uiState.svelte';
  import { getLocalDb } from '$lib/db/local/sqlite';
  import { hydrateIfNeeded } from '$lib/db/sync/hydrate';
  import { initSyncService, stopSyncService } from '$lib/state/syncState.svelte';
  import { resetChatState } from '$lib/state/chatState.svelte';
  import { loadCustomModels, setCachedCustomModels } from '$lib/state/modelState.svelte';
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
  import ChatPanel from '$lib/components/layout/ChatPanel.svelte';
  import ToastContainer from '$lib/components/layout/ToastContainer.svelte';
  import KeyboardShortcutsModal from '$lib/components/modals/KeyboardShortcutsModal.svelte';
  import { chatState } from '$lib/state/chatState.svelte';

  let showSearch = $state(false);
  let showNewGame = $state(false);
  let showNewEntityType = $state(false);
  let showNewEntity = $state(false);
  let newEntityTypeId = $state('');
  let confirmDeleteEntityId = $state<string | null>(null);
  let confirmDeleteGameId = $state<string | null>(null);
  let confirmDeleteEntityTypeId = $state<string | null>(null);
  let confirmDeleteSessionId = $state<string | null>(null);
  let showSettings = $state(false);
  let showShortcuts = $state(false);
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

  async function handleSignOut() {
    stopSyncService();
    resetGameState();
    resetNoteState();
    resetSessionState();
    resetChatState();
    const { signOut } = await import('$lib/auth/authState.svelte');
    await signOut();
  }

  onMount(() => {
    checkSession().then(() => {
      if (authState.user) onAuthenticated(authState.user.id);
    });
    loadSettings();
    loadCustomModels().then(setCachedCustomModels);

    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        showSearch = !showSearch;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        uiState.findOpen = !uiState.findOpen;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '/') {
        e.preventDefault();
        showShortcuts = !showShortcuts;
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
  <div class="flex flex-col items-center justify-center gap-3 h-screen w-screen bg-[var(--color-bg)]" data-tauri-drag-region>
    <p class="text-sm font-semibold tracking-wide text-[var(--color-text-muted)]">Sidquest</p>
    <p class="text-xs text-[var(--color-text-muted)] animate-pulse">Checking session...</p>
  </div>
{:else if !authState.user}
  <div class="h-screen w-screen bg-[var(--color-bg)]" data-tauri-drag-region>
    <SignIn />
  </div>
{:else}
  <div class="flex flex-col h-screen w-screen bg-[var(--color-bg)] overflow-hidden">
    <TitleBar onOpenSettings={() => showSettings = true} onSignOut={handleSignOut} />
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
        onSelectSession={(id) => selectSession(id)}
        onNewSession={async () => { if (authState.user && gameState.activeGameId) await createSession(authState.user.id, gameState.activeGameId); }}
        onDeleteSession={(id) => confirmDeleteSessionId = id}
        onRenameSession={(id, name) => renameSession(id, name)}
      />
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="w-1 shrink-0 cursor-col-resize hover:bg-[var(--color-accent)]/50 transition-colors {resizing ? 'bg-[var(--color-accent)]' : ''}"
        onpointerdown={handleResizeStart}
      ></div>
      <MainPanel onNewGame={() => showNewGame = true} />
      {#if chatState.open}
        <ChatPanel />
      {/if}
    </div>
  </div>

  {#if showNewGame}
    <NewGameModal
      onClose={() => showNewGame = false}
      onCreate={async (name, description, template) => {
        await createGame(authState.user!.id, name, description, template);
        showNewGame = false;
        showToast(`Created "${name}"`, 'success');
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
      onConfirm={async () => { const name = entityToDelete?.name; await deleteEntity(confirmDeleteEntityId!); confirmDeleteEntityId = null; showToast(`Deleted "${name ?? 'entity'}"`, 'info'); }}
    />
  {/if}

  {#if confirmDeleteEntityTypeId}
    {@const typeToDelete = gameState.entityTypes.find(t => t.id === confirmDeleteEntityTypeId)}
    <ConfirmDeleteModal
      title="Delete Entity Type"
      message="Are you sure you want to delete &quot;{typeToDelete?.name ?? 'this type'}&quot; and all its entities and notes? This cannot be undone."
      onClose={() => confirmDeleteEntityTypeId = null}
      onConfirm={async () => { const name = typeToDelete?.name; await deleteEntityTypeById(confirmDeleteEntityTypeId!); confirmDeleteEntityTypeId = null; showToast(`Deleted "${name ?? 'type'}"`, 'info'); }}
    />
  {/if}

  {#if showSettings}
    <SettingsModal onClose={() => showSettings = false} />
  {/if}

  {#if showShortcuts}
    <KeyboardShortcutsModal onClose={() => showShortcuts = false} />
  {/if}

  {#if confirmDeleteSessionId}
    {@const sessionToDelete = sessionState.sessions.find(s => s.id === confirmDeleteSessionId)}
    <ConfirmDeleteModal
      title="Delete Session"
      message="Are you sure you want to delete &quot;{sessionToDelete?.name ?? 'this session'}&quot; and all its notes? This cannot be undone."
      onClose={() => confirmDeleteSessionId = null}
      onConfirm={async () => { const name = sessionToDelete?.name; await deleteSession(confirmDeleteSessionId!); confirmDeleteSessionId = null; showToast(`Deleted "${name ?? 'session'}"`, 'info'); }}
    />
  {/if}

  {#if confirmDeleteGameId}
    {@const gameToDelete = gameState.games.find(g => g.id === confirmDeleteGameId)}
    <ConfirmDeleteModal
      title="Delete Game"
      message="Are you sure you want to delete &quot;{gameToDelete?.name ?? 'this game'}&quot; and all its entities and notes? This cannot be undone."
      onClose={() => confirmDeleteGameId = null}
      onConfirm={async () => { const name = gameToDelete?.name; await deleteGameById(confirmDeleteGameId!); confirmDeleteGameId = null; showToast(`Deleted "${name ?? 'game'}"`, 'info'); }}
    />
  {/if}

  <ToastContainer />
{/if}
