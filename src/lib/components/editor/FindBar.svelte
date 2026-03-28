<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import { Decoration, DecorationSet } from '@tiptap/pm/view';
  import { Plugin, PluginKey } from '@tiptap/pm/state';

  let { editor, onClose }: {
    editor: Editor;
    onClose: () => void;
  } = $props();

  let query = $state('');
  let matchCount = $state(0);
  let currentMatch = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let pluginRegistered = false;

  const findKey = new PluginKey('find-highlight');

  function focusInput(node: HTMLElement) {
    requestAnimationFrame(() => node.focus());
  }

  function getMatches(searchQuery: string): { from: number; to: number }[] {
    if (!searchQuery || !editor?.state) return [];
    const matches: { from: number; to: number }[] = [];
    const lower = searchQuery.toLowerCase();
    editor.state.doc.descendants((node: any, pos: number) => {
      if (!node.isText) return;
      const text = node.text?.toLowerCase() ?? '';
      let idx = 0;
      while ((idx = text.indexOf(lower, idx)) !== -1) {
        matches.push({ from: pos + idx, to: pos + idx + searchQuery.length });
        idx += 1;
      }
    });
    return matches;
  }

  function ensurePlugin() {
    if (pluginRegistered || !editor?.view) return;
    const plugin = new Plugin({
      key: findKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, old) {
          const meta = tr.getMeta(findKey);
          if (meta?.decorations !== undefined) return meta.decorations;
          if (meta?.clear) return DecorationSet.empty;
          return old;
        },
      },
      props: {
        decorations(state) {
          return this.getState(state);
        },
      },
    });
    const newState = editor.state.reconfigure({
      plugins: [...editor.state.plugins, plugin],
    });
    editor.view.updateState(newState);
    pluginRegistered = true;
  }

  function doSearch() {
    if (!editor?.view) return;
    ensurePlugin();

    const matches = getMatches(query);
    matchCount = matches.length;
    if (currentMatch > matchCount) currentMatch = matchCount > 0 ? 1 : 0;
    if (matchCount > 0 && currentMatch === 0) currentMatch = 1;

    const decorations = matches.map((m, i) =>
      Decoration.inline(m.from, m.to, {
        class: i === currentMatch - 1 ? 'find-current' : 'find-match',
      })
    );

    const decoSet = DecorationSet.create(editor.state.doc, decorations);
    editor.view.dispatch(
      editor.state.tr.setMeta(findKey, { decorations: decoSet })
    );

    // Scroll to current match
    if (matches.length > 0 && currentMatch > 0) {
      const match = matches[currentMatch - 1];
      editor.commands.setTextSelection(match.from);
    }
  }

  function handleInput() {
    currentMatch = 0;
    doSearch();
  }

  function nextMatch() {
    if (matchCount === 0) return;
    currentMatch = currentMatch >= matchCount ? 1 : currentMatch + 1;
    doSearch();
  }

  function prevMatch() {
    if (matchCount === 0) return;
    currentMatch = currentMatch <= 1 ? matchCount : currentMatch - 1;
    doSearch();
  }

  function close() {
    if (editor?.view && pluginRegistered) {
      try {
        editor.view.dispatch(
          editor.state.tr.setMeta(findKey, { clear: true })
        );
      } catch {}
    }
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    }
  }
</script>

<div class="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
  <input
    bind:value={query}
    oninput={handleInput}
    onkeydown={handleKeydown}
    use:focusInput
    type="text"
    placeholder="Find in note..."
    class="flex-1 bg-[var(--color-bg)] text-[var(--color-text)] text-sm px-2 py-1 rounded border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
  />
  <span class="text-xs text-[var(--color-text-muted)] min-w-[50px] text-center">
    {#if query && matchCount > 0}
      {currentMatch}/{matchCount}
    {:else if query}
      0 results
    {/if}
  </span>
  <button
    onclick={prevMatch}
    disabled={matchCount === 0}
    class="text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 text-sm px-1"
    title="Previous (Shift+Enter)"
  >&#9650;</button>
  <button
    onclick={nextMatch}
    disabled={matchCount === 0}
    class="text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 text-sm px-1"
    title="Next (Enter)"
  >&#9660;</button>
  <button
    onclick={close}
    class="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-sm px-1"
    title="Close (Esc)"
  >&#10005;</button>
</div>

<style>
  :global(.find-match) {
    background-color: rgba(255, 200, 0, 0.3);
    border-radius: 2px;
  }
  :global(.find-current) {
    background-color: rgba(255, 200, 0, 0.7);
    border-radius: 2px;
  }
</style>
