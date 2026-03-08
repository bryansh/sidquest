<script lang="ts">
  import { Tipex, defaultExtensions } from '@friendofsvelte/tipex';
  import Placeholder from '@tiptap/extension-placeholder';
  import { WikilinkExtension } from './WikilinkExtension';
  import type { EditorEvents } from '@tiptap/core';
  import { generateHTML } from '@tiptap/core';

  let { content, onSave }: {
    content: any;
    onSave: (content: any) => void;
  } = $props();

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let saveStatus = $state<'idle' | 'saving' | 'saved'>('idle');

  const extensions = [
    ...defaultExtensions,
    Placeholder.configure({ placeholder: 'Start writing...' }),
    WikilinkExtension,
  ];

  function getInitialBody(): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    try {
      return generateHTML(content, extensions);
    } catch {
      return '';
    }
  }

  function handleUpdate({ editor }: EditorEvents['update']) {
    if (saveTimer) clearTimeout(saveTimer);
    saveStatus = 'idle';
    saveTimer = setTimeout(() => {
      const json = editor.getJSON();
      saveStatus = 'saving';
      onSave(json);
      setTimeout(() => { saveStatus = 'saved'; }, 300);
    }, 1500);
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex justify-end px-2 py-1 text-xs text-[var(--color-text-muted)]">
    {#if saveStatus === 'saving'}
      Saving...
    {:else if saveStatus === 'saved'}
      Saved
    {/if}
  </div>
  <div class="flex-1 overflow-y-auto tipex-wrapper">
    <Tipex
      body={getInitialBody()}
      {extensions}
      onupdate={handleUpdate}
      class="h-full"
      !focal
      !floating
      controlComponent={null}
    />
  </div>
</div>

<style>
  .tipex-wrapper :global(.tiptap) {
    min-height: 100%;
    padding: 1rem;
    outline: none;
    color: var(--color-text);
    font-size: 0.9375rem;
    line-height: 1.6;
  }
  .tipex-wrapper :global(.tiptap > * + *) {
    margin-top: 0.5em;
  }
  .tipex-wrapper :global(.tiptap h1) { font-size: 1.5rem; font-weight: 700; }
  .tipex-wrapper :global(.tiptap h2) { font-size: 1.25rem; font-weight: 600; }
  .tipex-wrapper :global(.tiptap h3) { font-size: 1.1rem; font-weight: 600; }
  .tipex-wrapper :global(.tiptap code) {
    background: var(--color-surface-hover);
    padding: 0.15em 0.3em;
    border-radius: 3px;
    font-size: 0.875em;
  }
  .tipex-wrapper :global(.tiptap pre) {
    background: var(--color-bg);
    padding: 0.75rem 1rem;
    border-radius: 6px;
    overflow-x: auto;
  }
  .tipex-wrapper :global(.tiptap blockquote) {
    border-left: 3px solid var(--color-accent);
    padding-left: 1rem;
    color: var(--color-text-muted);
  }
  .tipex-wrapper :global(.tiptap ul),
  .tipex-wrapper :global(.tiptap ol) {
    padding-left: 1.5rem;
  }
  .tipex-wrapper :global(.tiptap ul) { list-style: disc; }
  .tipex-wrapper :global(.tiptap ol) { list-style: decimal; }
  .tipex-wrapper :global(.tiptap hr) {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 1rem 0;
  }
  .tipex-wrapper :global(.tiptap p.is-editor-empty:first-child::before) {
    color: var(--color-text-muted);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
</style>
