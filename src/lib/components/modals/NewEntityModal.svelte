<script lang="ts">
  import type { EntityType } from '$lib/state/gameState.svelte';

  let { entityTypes, defaultTypeId, onClose, onCreate }: {
    entityTypes: EntityType[];
    defaultTypeId: string;
    onClose: () => void;
    onCreate: (entityTypeId: string, name: string, summary?: string) => Promise<void>;
  } = $props();

  let entityTypeId = $state(defaultTypeId);
  let name = $state('');
  let summary = $state('');
  let saving = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim() || !entityTypeId) return;
    saving = true;
    await onCreate(entityTypeId, name.trim(), summary.trim() || undefined);
    saving = false;
  }
</script>

<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onclick={onClose} role="dialog">
  <div class="w-full max-w-md p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]" onclick={(e) => e.stopPropagation()}>
    <h2 class="text-lg font-semibold mb-4">New Entity</h2>
    <form onsubmit={handleSubmit} class="flex flex-col gap-3">
      <select
        bind:value={entityTypeId}
        class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
      >
        {#each entityTypes as et}
          <option value={et.id}>{et.icon ? et.icon + ' ' : ''}{et.name}</option>
        {/each}
      </select>
      <input
        type="text"
        placeholder="Entity name"
        bind:value={name}
        required
        autofocus
        class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />
      <input
        type="text"
        placeholder="Summary (optional)"
        bind:value={summary}
        class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />
      <div class="flex justify-end gap-2 mt-2">
        <button type="button" onclick={onClose} class="px-3 py-1.5 text-sm rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">Cancel</button>
        <button type="submit" disabled={saving || !name.trim()} class="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors disabled:opacity-50">
          {saving ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  </div>
</div>
