<script lang="ts">
  import { chatState, sendMessage, closeChat, clearChat, reindexNotes, type ChatMessage } from '$lib/state/chatState.svelte';
  import { gameState } from '$lib/state/gameState.svelte';

  let inputValue = $state('');
  let messagesEl: HTMLDivElement | undefined = $state();

  function getMessages(): ChatMessage[] {
    const gameId = gameState.activeGameId;
    if (!gameId) return [];
    return chatState.messages[gameId] ?? [];
  }

  async function handleSend() {
    const query = inputValue.trim();
    if (!query || chatState.thinking) return;
    inputValue = '';
    await sendMessage(query);
    // Scroll to bottom after response
    if (messagesEl) {
      requestAnimationFrame(() => {
        messagesEl!.scrollTop = messagesEl!.scrollHeight;
      });
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
</script>

<div class="flex flex-col h-full w-[400px] border-l border-[var(--color-border)] bg-[var(--color-bg)]">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-[var(--color-text)]">Game Chat</span>
      {#if chatState.embeddingStatus === 'ready'}
        <span class="text-xs text-[var(--color-text-muted)]">{chatState.embeddingCount} notes indexed</span>
      {:else if chatState.embeddingStatus === 'indexing'}
        <span class="text-xs text-[var(--color-accent)] animate-pulse">
          {#if chatState.embeddingProgress}
            Indexing {chatState.embeddingProgress.done}/{chatState.embeddingProgress.total}...
          {:else}
            Indexing notes...
          {/if}
        </span>
      {:else if chatState.embeddingStatus === 'error'}
        <span class="text-xs text-red-400" title={chatState.embeddingError}>Index error</span>
      {/if}
    </div>
    <div class="flex items-center gap-1">
      <button
        onclick={reindexNotes}
        title="Re-index all notes"
        disabled={chatState.embeddingStatus === 'indexing'}
        class="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors text-xs disabled:opacity-50"
      >
        Reindex
      </button>
      {#if getMessages().length > 0}
        <button
          onclick={clearChat}
          title="Clear chat"
          class="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors text-xs"
        >
          Clear
        </button>
      {/if}
      <button
        onclick={closeChat}
        title="Close chat"
        class="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        &#10005;
      </button>
    </div>
  </div>

  <!-- Messages -->
  <div bind:this={messagesEl} class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
    {#if getMessages().length === 0 && !chatState.thinking}
      <div class="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        {#if chatState.embeddingStatus === 'error'}
          <p class="text-sm text-red-400 text-center">Failed to index notes</p>
          <p class="text-xs text-[var(--color-text-muted)] text-center max-w-[300px]">{chatState.embeddingError || 'Unknown error'}</p>
          <button
            onclick={reindexNotes}
            class="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors"
          >
            Retry
          </button>
        {:else}
          <p class="text-sm text-[var(--color-text-muted)] text-center">
            Ask questions about your game notes.
          </p>
          <p class="text-xs text-[var(--color-text-muted)] opacity-70 text-center">
            e.g., "What happened at the Iron Keep?" or "What quests are still open?"
          </p>
        {/if}
      </div>
    {:else}
      {#each getMessages() as message}
        <div class="flex flex-col gap-1 {message.role === 'user' ? 'items-end' : 'items-start'}">
          <div
            class="max-w-[85%] rounded-lg px-3 py-2 text-sm {message.role === 'user'
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]'}"
          >
            <div class="whitespace-pre-wrap">{message.content}</div>
          </div>
        </div>
      {/each}
      {#if chatState.thinking}
        <div class="flex flex-col gap-1 items-start">
          <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)] animate-pulse">
            Thinking...
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Input -->
  <div class="px-4 py-3 border-t border-[var(--color-border)]">
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={inputValue}
        onkeydown={handleKeydown}
        placeholder={chatState.embeddingStatus === 'ready' ? 'Ask about your game...' : 'Indexing notes...'}
        disabled={chatState.embeddingStatus !== 'ready' || chatState.thinking}
        class="flex-1 px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
      />
      <button
        onclick={handleSend}
        disabled={!inputValue.trim() || chatState.embeddingStatus !== 'ready' || chatState.thinking}
        class="px-3 py-2 rounded-lg text-sm bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </div>
  </div>
</div>
