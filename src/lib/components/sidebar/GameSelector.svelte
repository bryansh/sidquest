<script lang="ts">
  import { gameState } from '$lib/state/gameState.svelte';

  const activeGame = $derived(
    gameState.games.find(g => g.id === gameState.activeGameId) ?? null
  );

  let dropdownOpen = $state(false);
</script>

<div class="relative">
  <button
    onclick={() => dropdownOpen = !dropdownOpen}
    class="w-full flex items-center justify-between px-3 py-2 rounded bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)] text-sm transition-colors"
  >
    <span>{activeGame?.name ?? 'Select Game'}</span>
    <span class="text-[var(--color-text-muted)]">&#9662;</span>
  </button>

  {#if dropdownOpen}
    <div class="absolute top-full left-0 right-0 mt-1 rounded bg-[var(--color-bg)] border border-[var(--color-border)] shadow-lg z-50">
      {#each gameState.games as game}
        <button
          onclick={() => { gameState.activeGameId = game.id; dropdownOpen = false; }}
          class="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] transition-colors {game.id === gameState.activeGameId ? 'text-[var(--color-accent)]' : ''}"
        >
          {game.name}
        </button>
      {/each}
      <div class="border-t border-[var(--color-border)]">
        <button
          onclick={() => { dropdownOpen = false; /* TODO: open new game modal */ }}
          class="w-full text-left px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          + New Game
        </button>
      </div>
    </div>
  {/if}
</div>
