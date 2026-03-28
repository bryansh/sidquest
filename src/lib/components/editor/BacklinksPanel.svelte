<script lang="ts">
  import { getBacklinks } from '$lib/db/local/queries/links';
  import { noteState, selectEntity } from '$lib/state/noteState.svelte';

  let { noteId }: { noteId: string } = $props();

  let backlinks = $state<{ id: string; sourceNoteId: string; sourceNoteTitle: string; sourceEntityName: string; sourceEntityTypeName: string }[]>([]);
  let expanded = $state(false);
  let loading = $state(true);

  $effect(() => {
    loading = true;
    getBacklinks(noteId).then(rows => {
      backlinks = rows;
      loading = false;
    });
  });
</script>

{#if !loading && backlinks.length > 0}
  <div class="border-t border-[var(--color-border)] px-4 py-2">
    <button
      onclick={() => expanded = !expanded}
      class="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
    >
      <span class="text-[10px]">{expanded ? '\u25BE' : '\u25B8'}</span>
      Backlinks ({backlinks.length})
    </button>

    {#if expanded}
      <div class="mt-1.5 flex flex-col gap-1">
        {#each backlinks as link}
          <button
            onclick={() => {
              noteState.activeNoteId = link.sourceNoteId;
            }}
            class="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-[var(--color-surface-hover)] text-left transition-colors"
          >
            <span class="text-[var(--color-accent)]">&larr;</span>
            <span>
              <span class="text-[var(--color-text)]">{link.sourceNoteTitle}</span>
              <span class="text-[var(--color-text-muted)]"> &middot; {link.sourceEntityName}</span>
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
