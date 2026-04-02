<script lang="ts">
  import { Dialog } from 'bits-ui';

  let { onClose }: { onClose: () => void } = $props();

  const shortcuts = [
    { keys: '⌘ K', description: 'Search notes and entities' },
    { keys: '⌘ F', description: 'Find in current note' },
    { keys: '⌘ ?', description: 'Show keyboard shortcuts' },
    { keys: 'Enter', description: 'Next match (in Find bar)' },
    { keys: '⇧ Enter', description: 'Previous match (in Find bar)' },
    { keys: 'Esc', description: 'Close modal / cancel action' },
  ];

  const tips = [
    'Double-click a name to rename (entities, sessions, note tabs, entity types)',
    'Drag the ⠿ handle to reorder entity types and entities',
    'Drag note tabs to reorder them',
    'Type [[ to insert a wikilink to another entity',
    'Paste or drag images directly into the editor',
  ];
</script>

<Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/50 z-50" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-xl"
    >
      <Dialog.Title class="text-lg font-semibold mb-4">Keyboard Shortcuts</Dialog.Title>

      <div class="flex flex-col gap-2 mb-5">
        {#each shortcuts as shortcut}
          <div class="flex items-center justify-between">
            <span class="text-sm text-[var(--color-text)]">{shortcut.description}</span>
            <kbd class="px-2 py-0.5 rounded text-xs bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono">{shortcut.keys}</kbd>
          </div>
        {/each}
      </div>

      <div class="border-t border-[var(--color-border)] pt-4">
        <p class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Tips</p>
        <ul class="flex flex-col gap-1.5">
          {#each tips as tip}
            <li class="text-xs text-[var(--color-text-muted)]">{tip}</li>
          {/each}
        </ul>
      </div>

      <div class="mt-5 flex justify-end">
        <button
          onclick={onClose}
          class="px-4 py-1.5 rounded text-sm bg-[var(--color-surface-hover)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
        >
          Done
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
