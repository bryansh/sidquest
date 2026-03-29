<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { invoke } from '@tauri-apps/api/core';
  import { gameState, createEntity, createEntityType } from '$lib/state/gameState.svelte';
  import { createNote } from '$lib/state/noteState.svelte';
  import { sessionState, updateSessionNoteContent } from '$lib/state/sessionState.svelte';
  import { authState } from '$lib/auth/authState.svelte';
  import { serialize } from '../editor/cleanupRoundtrip';

  let { onClose, onExtracted }: {
    onClose: () => void;
    onExtracted: (count: number) => void;
  } = $props();

  interface EntitySuggestion {
    name: string;
    label: string;
    description: string;
    typeName: string;
    typeId: string;
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

      // Parse the JSON result — strip markdown code fences if present
      let jsonStr = result.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
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
            label: e.label || e.summary || '',
            description: e.description || '',
            typeName: entityType.name,
            typeId: entityType.id,
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

  function insertWikilinks(doc: any, entityMap: Map<string, string>): any {
    if (!doc || !doc.content) return doc;
    return {
      ...doc,
      content: doc.content.map((node: any) => insertWikilinksInNode(node, entityMap)),
    };
  }

  function insertWikilinksInNode(node: any, entityMap: Map<string, string>): any {
    // Don't process wikilink nodes themselves
    if (node.type === 'mention') return node;

    // Process text nodes: split on entity names and insert wikilinks
    if (node.type === 'text' && node.text) {
      const parts: any[] = [];
      let remaining = node.text;

      for (const [name, entityId] of entityMap) {
        const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const newParts: any[] = [];
        for (const part of remaining ? [remaining] : []) {
          let lastIdx = 0;
          let match;
          regex.lastIndex = 0;
          while ((match = regex.exec(part)) !== null) {
            if (match.index > lastIdx) {
              newParts.push({ type: 'text', text: part.slice(lastIdx, match.index), ...(node.marks ? { marks: node.marks } : {}) });
            }
            newParts.push({
              type: 'mention',
              attrs: { id: null, noteId: null, entityId, label: name },
            });
            lastIdx = match.index + match[0].length;
          }
          if (lastIdx < part.length) {
            newParts.push({ type: 'text', text: part.slice(lastIdx), ...(node.marks ? { marks: node.marks } : {}) });
          }
          if (newParts.length === 0) {
            newParts.push({ type: 'text', text: part, ...(node.marks ? { marks: node.marks } : {}) });
          }
        }
        // For simplicity, only process the first entity name per text node
        if (newParts.length > 1) return newParts;
        remaining = newParts.length > 0 && newParts[0].text ? newParts[0].text : remaining;
      }

      return node;
    }

    // Recurse into content nodes
    if (node.content) {
      const newContent: any[] = [];
      for (const child of node.content) {
        const result = insertWikilinksInNode(child, entityMap);
        if (Array.isArray(result)) {
          newContent.push(...result);
        } else {
          newContent.push(result);
        }
      }
      return { ...node, content: newContent };
    }

    return node;
  }

  async function createEntities() {
    if (!authState.user || !gameState.activeGameId) return;
    status = 'creating';
    let created = 0;

    // Create entities and collect name → entityId map
    const entityMap = new Map<string, string>();

    for (const s of suggestions) {
      if (!s.name.trim()) continue;
      try {
        const entity = await createEntity(authState.user.id, s.typeId, s.name, { summary: s.label });
        if (entity) {
          entityMap.set(s.name, entity.id);
          await createNote(authState.user.id, gameState.activeGameId, entity.id, s.name, {
            content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s.description }] }] },
            activate: false,
          });
          created++;
        }
      } catch (e) {
        console.error('[Extract] Failed to create entity:', s.name, e);
      }
    }

    // Tag entity names in session notes with wikilinks
    if (entityMap.size > 0) {
      for (const note of sessionState.sessionNotes) {
        if (!note.content) continue;
        const updated = insertWikilinks(note.content, entityMap);
        if (JSON.stringify(updated) !== JSON.stringify(note.content)) {
          await updateSessionNoteContent(note.id, updated);
        }
      }
    }

    onExtracted(created);
  }


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
        <p class="text-sm text-[var(--color-text-muted)] mb-3">Review extracted entities. Edit, remove, or add new ones.</p>

        <div class="flex-1 overflow-y-auto space-y-3 mb-3">
          {#each suggestions as suggestion, i}
            <div class="px-3 py-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
              <div class="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  bind:value={suggestion.name}
                  placeholder="Entity name"
                  class="flex-1 text-base font-medium bg-transparent border-b border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none text-[var(--color-text)] px-0 py-1"
                />
                <select
                  bind:value={suggestion.typeId}
                  onchange={() => {
                    const et = entityTypes.find(t => t.id === suggestion.typeId);
                    if (et) suggestion.typeName = et.name;
                  }}
                  class="text-xs px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] outline-none"
                >
                  {#each entityTypes as et}
                    <option value={et.id}>{et.icon ?? ''} {et.name}</option>
                  {/each}
                </select>
                <button
                  onclick={() => suggestions = suggestions.filter((_, idx) => idx !== i)}
                  title="Remove"
                  class="text-sm text-[var(--color-text-muted)] hover:text-red-400 px-1"
                >&times;</button>
              </div>
              <input
                type="text"
                bind:value={suggestion.label}
                placeholder="Short label (shown in sidebar)..."
                class="w-full text-sm bg-transparent border-b border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none text-[var(--color-text-muted)] px-0 py-1 italic mb-2"
              />
              <textarea
                bind:value={suggestion.description}
                placeholder="Detailed description (becomes the entity's note)..."
                rows="3"
                class="w-full text-sm bg-transparent border border-[var(--color-border)] focus:border-[var(--color-accent)] rounded outline-none text-[var(--color-text)] px-2 py-1.5 resize-y"
              ></textarea>
            </div>
          {/each}

          <button
            onclick={() => {
              const defaultType = entityTypes[0];
              if (!defaultType) return;
              suggestions = [...suggestions, { name: '', label: '', description: '', typeName: defaultType.name, typeId: defaultType.id }];
            }}
            disabled={entityTypes.length === 0}
            class="w-full text-left px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded border border-dashed border-[var(--color-border)] transition-colors"
          >
            + Add Entity
          </button>
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-[var(--color-border)]">
          <span class="text-sm text-[var(--color-text-muted)]">{suggestions.length} entities</span>
          <div class="flex gap-2">
            <button onclick={onClose} class="px-4 py-1.5 text-sm rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">Reject</button>
            <button
              onclick={createEntities}
              disabled={suggestions.length === 0}
              class="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors disabled:opacity-50"
            >
              Accept ({suggestions.length})
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
