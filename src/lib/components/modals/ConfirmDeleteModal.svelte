<script lang="ts">
  import { Dialog } from 'bits-ui';

  let { title, message, confirmLabel = 'Delete', onClose, onConfirm }: {
    title: string;
    message: string;
    confirmLabel?: string;
    onClose: () => void;
    onConfirm: () => Promise<void>;
  } = $props();

  let deleting = $state(false);

  async function handleConfirm() {
    deleting = true;
    try {
      await onConfirm();
    } finally {
      deleting = false;
    }
  }
</script>

<Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/60 z-50" />
    <Dialog.Content class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] z-50">
      <Dialog.Title class="text-lg font-semibold mb-2">{title}</Dialog.Title>
      <p class="text-sm text-[var(--color-text-muted)] mb-4">{message}</p>
      <form onsubmit={(e) => { e.preventDefault(); handleConfirm(); }} class="flex justify-end gap-2">
        <Dialog.Close class="px-3 py-1.5 text-sm rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">Cancel</Dialog.Close>
        <button
          type="submit"
          disabled={deleting}
          autofocus
          class="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : confirmLabel}
        </button>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
