<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { Tipex, defaultExtensions } from '@friendofsvelte/tipex';
  import StarterKit from '@tiptap/starter-kit';
  import { WikilinkExtension } from '../editor/WikilinkExtension';
  import { generateHTML } from '@tiptap/core';
  import type { Editor } from '@tiptap/core';
  import { settings } from '$lib/state/settingsState.svelte';

  let { title, description, content, onAccept, onReject }: {
    title: string;
    description?: string;
    content: any;
    onAccept: (content: any) => void;
    onReject: () => void;
  } = $props();

  let reviewEditor = $state<Editor | null>(null);

  const extensions: any[] = [
    ...defaultExtensions,
    WikilinkExtension,
  ];

  const htmlExtensions = [StarterKit, WikilinkExtension];

  function getBody(): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    try {
      return generateHTML(content, htmlExtensions);
    } catch {
      return '';
    }
  }

  function handleAccept() {
    if (reviewEditor) {
      onAccept(reviewEditor.getJSON());
    } else {
      onAccept(content);
    }
  }
</script>

<Dialog.Root open onOpenChange={(open) => { if (!open) onReject(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/60 z-50" />
    <Dialog.Content class="fixed top-[5vh] left-1/2 -translate-x-1/2 w-full max-w-2xl rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] z-50 max-h-[90vh] flex flex-col shadow-2xl">
      <div class="px-5 pt-5 pb-2">
        <Dialog.Title class="text-lg font-semibold">{title}</Dialog.Title>
        {#if description}
          <p class="text-xs text-[var(--color-text-muted)] mt-1">{description}</p>
        {/if}
      </div>

      <div class="flex-1 overflow-y-auto border-y border-[var(--color-border)] proposed-editor" style="--editor-font-size: {settings.editorFontSize}px">
        <Tipex
          body={getBody()}
          {extensions}
          bind:tipex={reviewEditor as any}
          class="h-full"
          !focal
          !floating
          controlComponent={null}
        />
      </div>

      <div class="flex justify-end gap-2 px-5 py-3">
        <button
          onclick={onReject}
          class="px-4 py-1.5 text-sm rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          Reject
        </button>
        <button
          onclick={handleAccept}
          class="px-4 py-1.5 text-sm rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors"
        >
          Accept
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .proposed-editor :global(.tiptap) {
    min-height: 200px;
    padding: 1rem;
    outline: none;
    color: var(--color-text);
    font-size: var(--editor-font-size, 0.9375rem);
    line-height: 1.6;
  }
  .proposed-editor :global(.tiptap > * + *) { margin-top: 0.5em; }
  .proposed-editor :global(.tiptap h1) { font-size: 1.5rem; font-weight: 700; }
  .proposed-editor :global(.tiptap h2) { font-size: 1.25rem; font-weight: 600; }
  .proposed-editor :global(.tiptap h3) { font-size: 1.1rem; font-weight: 600; }
  .proposed-editor :global(.tiptap code) { background: var(--color-surface-hover); padding: 0.15em 0.3em; border-radius: 3px; font-size: 0.875em; }
  .proposed-editor :global(.tiptap pre) { background: var(--color-bg); padding: 0.75rem 1rem; border-radius: 6px; overflow-x: auto; }
  .proposed-editor :global(.tiptap blockquote) { border-left: 3px solid var(--color-accent); padding-left: 1rem; color: var(--color-text-muted); }
  .proposed-editor :global(.tiptap ul), .proposed-editor :global(.tiptap ol) { padding-left: 1.5rem; }
  .proposed-editor :global(.tiptap ul) { list-style: disc; }
  .proposed-editor :global(.tiptap ol) { list-style: decimal; }
</style>
