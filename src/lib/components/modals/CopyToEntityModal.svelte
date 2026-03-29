<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { gameState } from '$lib/state/gameState.svelte';
  import { createNote } from '$lib/state/noteState.svelte';
  import { authState } from '$lib/auth/authState.svelte';
  import type { SessionNote } from '$lib/state/sessionState.svelte';

  let { sessionNote, onClose, onCopied }: {
    sessionNote: SessionNote;
    onClose: () => void;
    onCopied: (entityName: string) => void;
  } = $props();

  let copying = $state(false);

  const sortedTypes = $derived(
    [...gameState.entityTypes].sort((a, b) => a.sortOrder - b.sortOrder)
  );

  async function copyToEntity(entityId: string) {
    if (!authState.user || !gameState.activeGameId || copying) return;
    copying = true;
    const entity = gameState.entities.find(e => e.id === entityId);
    await createNote(
      authState.user.id,
      gameState.activeGameId,
      entityId,
      sessionNote.title,
      { content: sessionNote.content, activate: false }
    );
    copying = false;
    onCopied(entity?.name ?? 'entity');
  }
</script>

<Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/60 z-50" />
    <Dialog.Content class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] z-50 max-h-[70vh] flex flex-col">
      <Dialog.Title class="text-lg font-semibold mb-1">Copy to Entity</Dialog.Title>
      <p class="text-xs text-[var(--color-text-muted)] mb-3">Copy "{sessionNote.title}" to an entity's notes</p>

      <div class="flex-1 overflow-y-auto space-y-3">
        {#each sortedTypes as entityType}
          {@const typeEntities = gameState.entities.filter(e => e.entityTypeId === entityType.id).sort((a, b) => a.sortOrder - b.sortOrder)}
          {#if typeEntities.length > 0}
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                {#if entityType.icon}{entityType.icon} {/if}{entityType.name}
              </p>
              <div class="space-y-0.5">
                {#each typeEntities as entity}
                  <button
                    onclick={() => copyToEntity(entity.id)}
                    disabled={copying}
                    class="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] transition-colors disabled:opacity-50"
                  >
                    {entity.name}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/each}

        {#if gameState.entities.length === 0}
          <p class="text-sm text-[var(--color-text-muted)] text-center py-4">No entities yet. Create some entity types and entities first.</p>
        {/if}
      </div>

      <div class="flex justify-end mt-4 pt-3 border-t border-[var(--color-border)]">
        <Dialog.Close class="px-3 py-1.5 text-sm rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">Cancel</Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
