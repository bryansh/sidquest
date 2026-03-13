<script lang="ts">
  import { Dialog, Select } from 'bits-ui';

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
  let formEl = $state<HTMLFormElement | null>(null);

  const selectedType = $derived(entityTypes.find(et => et.id === entityTypeId));
  const selectedLabel = $derived(selectedType ? `${selectedType.icon ? selectedType.icon + ' ' : ''}${selectedType.name}` : 'Select type');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim() || !entityTypeId) return;
    saving = true;
    await onCreate(entityTypeId, name.trim(), summary.trim() || undefined);
    saving = false;
  }
</script>

<Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/60 z-50" />
    <Dialog.Content
      onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById('entity-name')?.focus(); }}
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] z-50"
    >
      <Dialog.Title class="text-lg font-semibold mb-4">New Entity</Dialog.Title>
      <form bind:this={formEl} onsubmit={handleSubmit} class="flex flex-col gap-3">
        <span class="text-sm text-[var(--color-text-muted)]">Entity Type</span>
        <Select.Root type="single" value={entityTypeId} onValueChange={(v) => { if (v) entityTypeId = v; }}>
          <Select.Trigger type="button" class="w-full px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] text-left focus:outline-none focus:border-[var(--color-accent)] flex items-center justify-between">
            <span>{selectedLabel}</span>
            <span class="text-[var(--color-text-muted)]">&#9662;</span>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content class="rounded bg-[var(--color-bg)] border border-[var(--color-border)] shadow-lg z-[100] p-1" sideOffset={4}>
              {#each entityTypes as et}
                <Select.Item value={et.id} class="px-3 py-2 text-sm rounded cursor-pointer hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] data-[highlighted]:bg-[var(--color-surface-hover)]">
                  {et.icon ? et.icon + ' ' : ''}{et.name}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <label for="entity-name" class="text-sm text-[var(--color-text-muted)]">Name</label>
        <input
          id="entity-name"
          type="text"
          placeholder="Entity name"
          bind:value={name}
          required
          onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); formEl?.requestSubmit(); } }}
          class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        <label for="entity-summary" class="text-sm text-[var(--color-text-muted)]">Summary</label>
        <input
          id="entity-summary"
          type="text"
          placeholder="Optional"
          bind:value={summary}
          onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); formEl?.requestSubmit(); } }}
          class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        <div class="flex justify-end gap-2 mt-2">
          <Dialog.Close class="px-3 py-1.5 text-sm rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">Cancel</Dialog.Close>
          <button type="submit" disabled={saving || !name.trim()} class="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors disabled:opacity-50">
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
