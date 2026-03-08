<script lang="ts">
  import { Popover } from 'bits-ui';
  import { gameState, selectGame } from '$lib/state/gameState.svelte';

  let { onNewGame }: { onNewGame: () => void } = $props();

  const activeGame = $derived(
    gameState.games.find(g => g.id === gameState.activeGameId) ?? null
  );

  let open = $state(false);
</script>

<Popover.Root bind:open>
  <Popover.Trigger class="w-full flex items-center justify-between px-3 py-2 rounded bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)] text-sm transition-colors">
    <span>{activeGame?.name ?? 'Select Game'}</span>
    <span class="text-[var(--color-text-muted)]">&#9662;</span>
  </Popover.Trigger>
  <Popover.Content
    side="bottom"
    align="start"
    sideOffset={4}
    class="w-[var(--bits-popover-trigger-width)] rounded bg-[var(--color-bg)] border border-[var(--color-border)] shadow-lg z-50"
  >
    {#each gameState.games as game}
      <button
        onclick={() => { selectGame(game.id); open = false; }}
        class="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] transition-colors {game.id === gameState.activeGameId ? 'text-[var(--color-accent)]' : ''}"
      >
        {game.name}
      </button>
    {/each}
    <div class="border-t border-[var(--color-border)]">
      <button
        onclick={() => { open = false; onNewGame(); }}
        class="w-full text-left px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        + New Game
      </button>
    </div>
  </Popover.Content>
</Popover.Root>
