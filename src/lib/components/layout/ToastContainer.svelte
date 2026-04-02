<script lang="ts">
  import { toastState, dismissToast } from '$lib/state/toastState.svelte';
</script>

{#if toastState.toasts.length > 0}
  <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
    {#each toastState.toasts as toast (toast.id)}
      <div
        class="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm max-w-xs animate-[slideIn_0.2s_ease-out] {toast.type === 'error'
          ? 'bg-red-500/90 text-white'
          : toast.type === 'success'
            ? 'bg-green-500/90 text-white'
            : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]'}"
      >
        <span class="flex-1">{toast.message}</span>
        <button
          onclick={() => dismissToast(toast.id)}
          class="text-xs opacity-70 hover:opacity-100 transition-opacity shrink-0"
        >&times;</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
