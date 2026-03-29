<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { gameTemplates, type GameTemplate } from '$lib/gameTemplates';

  let { onClose, onCreate }: {
    onClose: () => void;
    onCreate: (name: string, description: string | undefined, template: GameTemplate) => Promise<void>;
  } = $props();

  let selectedTemplate = $state<GameTemplate | null>(null);
  let name = $state('');
  let description = $state('');
  let saving = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim() || !selectedTemplate) return;
    saving = true;
    await onCreate(name.trim(), description.trim() || undefined, selectedTemplate);
    saving = false;
  }
</script>

<Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/60 z-50" />
    <Dialog.Content class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] z-50">
      {#if !selectedTemplate}
        <Dialog.Title class="text-lg font-semibold mb-4">Choose a Game Type</Dialog.Title>
        <div class="grid grid-cols-2 gap-2">
          {#each gameTemplates as template}
            <button
              onclick={() => selectedTemplate = template}
              class="flex flex-col items-start gap-1 p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)] transition-colors text-left"
            >
              <span class="text-xl">{template.icon}</span>
              <span class="text-sm font-medium text-[var(--color-text)]">{template.name}</span>
              <span class="text-xs text-[var(--color-text-muted)]">{template.description}</span>
            </button>
          {/each}
        </div>
        <div class="flex justify-end mt-4">
          <Dialog.Close class="px-3 py-1.5 text-sm rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">Cancel</Dialog.Close>
        </div>
      {:else}
        <Dialog.Title class="text-lg font-semibold mb-1">New {selectedTemplate.name} Game</Dialog.Title>
        <button
          onclick={() => selectedTemplate = null}
          class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-4 transition-colors"
        >&larr; Change game type</button>

        <form onsubmit={handleSubmit} class="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Game name"
            bind:value={name}
            required
            autofocus
            class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            bind:value={description}
            class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          {#if selectedTemplate.types.length > 0}
            <div class="text-xs text-[var(--color-text-muted)]">
              Entity types: {selectedTemplate.types.map(t => `${t.icon} ${t.name}`).join(', ')}
            </div>
          {/if}
          <div class="flex justify-end gap-2 mt-2">
            <Dialog.Close class="px-3 py-1.5 text-sm rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">Cancel</Dialog.Close>
            <button type="submit" disabled={saving || !name.trim()} class="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors disabled:opacity-50">
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
