<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { invoke } from '@tauri-apps/api/core';
  import { gameState, createEntity, createEntityType } from '$lib/state/gameState.svelte';
  import { createNote } from '$lib/state/noteState.svelte';
  import { sessionState } from '$lib/state/sessionState.svelte';
  import { authState } from '$lib/auth/authState.svelte';
  import { serialize } from '../editor/cleanupRoundtrip';

  let { onClose, onExtracted }: {
    onClose: () => void;
    onExtracted: (count: number) => void;
  } = $props();

  interface EntitySuggestion {
    name: string;
    summary: string;
    typeName: string;
    typeId: string;
    checked: boolean;
  }

  let status = $state<'extracting' | 'reviewing' | 'creating' | 'error'>('extracting');
  let errorMsg = $state('');
  let suggestions = $state<EntitySuggestion[]>([]);

  const entityTypes = $derived(
    [...gameState.entityTypes].sort((a, b) => a.sortOrder - b.sortOrder)
  );

  // Start extraction on mount
  extractEntities();

  async function extractEntities() {
    status = 'extracting';
    try {
      // Serialize all session notes into plain text
      const allText = sessionState.sessionNotes
        .map(n => {
          const title = n.title || '';
          if (!n.content) return title;
          const { text } = serialize(n.content);
          return `## ${title}\n${text}`;
        })
        .join('\n\n');

      if (!allText.trim()) {
        errorMsg = 'No session notes to extract from.';
        status = 'error';
        return;
      }

      const typeNames = gameState.entityTypes.map(t => t.name);
      if (typeNames.length === 0) {
        errorMsg = 'No entity types defined. Create some entity types first.';
        status = 'error';
        return;
      }

      const result = await invoke<string>('extract_entities', {
        text: allText,
        entityTypes: typeNames,
      });

      // Parse the JSON result
      const parsed = JSON.parse(result);
      const categories = parsed.categories || parsed;

      const items: EntitySuggestion[] = [];
      for (const [typeName, entities] of Object.entries(categories)) {
        const entityType = gameState.entityTypes.find(
          t => t.name.toLowerCase() === typeName.toLowerCase()
        );
        if (!entityType || !Array.isArray(entities)) continue;
        for (const e of entities as any[]) {
          // Skip if entity already exists
          const exists = gameState.entities.some(
            existing => existing.name.toLowerCase() === (e.name || '').toLowerCase() && existing.entityTypeId === entityType.id
          );
          if (exists) continue;
          items.push({
            name: e.name || '',
            summary: e.summary || '',
            typeName: entityType.name,
            typeId: entityType.id,
            checked: true,
          });
        }
      }

      suggestions = items;
      status = items.length > 0 ? 'reviewing' : 'error';
      if (items.length === 0) errorMsg = 'No new entities found in session notes.';
    } catch (e: any) {
      console.error('[Extract] Error:', e);
      errorMsg = e.message ?? 'Extraction failed';
      status = 'error';
    }
  }

  async function createEntities() {
    if (!authState.user || !gameState.activeGameId) return;
    status = 'creating';
    let created = 0;

    const selected = suggestions.filter(s => s.checked);
    for (const s of selected) {
      try {
        const entity = await createEntity(authState.user.id, s.typeId, s.name, { summary: s.summary });
        if (entity) {
          // Create a note with the summary
          await createNote(authState.user.id, gameState.activeGameId, entity.id, s.name, {
            content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s.summary }] }] },
            activate: false,
          });
          created++;
        }
      } catch (e) {
        console.error('[Extract] Failed to create entity:', s.name, e);
      }
    }

    onExtracted(created);
  }

  const checkedCount = $derived(suggestions.filter(s => s.checked).length);
</script>

<Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/60 z-50" />
    <Dialog.Content class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] z-50 max-h-[80vh] flex flex-col">
      <Dialog.Title class="text-lg font-semibold mb-1">Extract Entities</Dialog.Title>

      {#if status === 'extracting'}
        <div class="flex-1 flex items-center justify-center py-8">
          <p class="text-sm text-[var(--color-accent)] animate-pulse">Analyzing session notes...</p>
        </div>

      {:else if status === 'error'}
        <div class="flex-1 flex flex-col items-center justify-center py-8 gap-3">
          <p class="text-sm text-[var(--color-text-muted)]">{errorMsg}</p>
          <button onclick={onClose} class="px-3 py-1.5 text-sm rounded bg-[var(--color-surface-hover)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors">Close</button>
        </div>

      {:else if status === 'reviewing'}
        <p class="text-xs text-[var(--color-text-muted)] mb-3">Found {suggestions.length} new entities. Uncheck any you don't want to create.</p>

        <div class="flex-1 overflow-y-auto space-y-1 mb-3">
          {#each suggestions as suggestion, i}
            <label class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-surface-hover)] cursor-pointer">
              <input type="checkbox" bind:checked={suggestion.checked} class="mt-0.5" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-[var(--color-text)]">{suggestion.name}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">{suggestion.typeName}</span>
                </div>
                <p class="text-xs text-[var(--color-text-muted)] truncate">{suggestion.summary}</p>
              </div>
            </label>
          {/each}
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-[var(--color-border)]">
          <span class="text-xs text-[var(--color-text-muted)]">{checkedCount} selected</span>
          <div class="flex gap-2">
            <button onclick={onClose} class="px-3 py-1.5 text-sm rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">Cancel</button>
            <button
              onclick={createEntities}
              disabled={checkedCount === 0}
              class="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors disabled:opacity-50"
            >
              Create {checkedCount} Entities
            </button>
          </div>
        </div>

      {:else if status === 'creating'}
        <div class="flex-1 flex items-center justify-center py-8">
          <p class="text-sm text-[var(--color-accent)] animate-pulse">Creating entities...</p>
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
