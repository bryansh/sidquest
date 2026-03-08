<script lang="ts">
  import { Dialog } from 'bits-ui';

  let { onClose, onCreate }: {
    onClose: () => void;
    onCreate: (name: string, icon?: string) => Promise<void>;
  } = $props();

  let name = $state('');
  let icon = $state('');
  let saving = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    saving = true;
    await onCreate(name.trim(), icon.trim() || undefined);
    saving = false;
  }
</script>

<Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/60 z-50" />
    <Dialog.Content class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] z-50">
      <Dialog.Title class="text-lg font-semibold mb-4">New Entity Type</Dialog.Title>
      <form onsubmit={handleSubmit} class="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Type name (e.g. Character, Location)"
          bind:value={name}
          required
          autofocus
          class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        <input
          type="text"
          placeholder="Icon emoji (optional)"
          bind:value={icon}
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
