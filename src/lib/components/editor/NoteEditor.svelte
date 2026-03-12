<script lang="ts">
  import { Tipex, defaultExtensions } from '@friendofsvelte/tipex';
  import StarterKit from '@tiptap/starter-kit';
  import Placeholder from '@tiptap/extension-placeholder';
  import { WikilinkExtension } from './WikilinkExtension';
  import type { EditorEvents, Editor } from '@tiptap/core';
  import { generateHTML } from '@tiptap/core';
  import { invoke } from '@tauri-apps/api/core';
  import { appDataDir, join } from '@tauri-apps/api/path';

  let { content, onSave }: {
    content: any;
    onSave: (content: any) => Promise<void> | void;
  } = $props();

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let saveStatus = $state<'idle' | 'saving' | 'saved'>('idle');
  let editorInstance = $state<Editor | null>(null);
  let listening = $state(false);
  let transcribing = $state(false);

  async function getModelPath(): Promise<string> {
    const dataDir = await appDataDir();
    return await join(dataDir, 'ggml-base.en.bin');
  }

  async function toggleDictation() {
    if (transcribing) return;

    if (listening) {
      // Stop recording and transcribe
      listening = false;
      transcribing = true;
      try {
        await invoke('stop_recording');
        const modelPath = await getModelPath();
        const text = await invoke<string>('transcribe', { modelPath });
        if (text && editorInstance) {
          editorInstance.chain().focus().insertContent(text).run();
        }
      } catch (e) {
        console.error('[Dictation] Error:', e);
      } finally {
        transcribing = false;
      }
      return;
    }

    // Start recording
    try {
      await invoke('start_recording');
      listening = true;
    } catch (e) {
      console.error('[Dictation] Failed to start recording:', e);
    }
  }

  const extensions: any[] = [
    ...defaultExtensions,
    Placeholder.configure({ placeholder: 'Start writing...' }),
    WikilinkExtension,
  ];

  // StarterKit provides a complete schema (doc, text, paragraph, etc.) for generateHTML
  const htmlExtensions = [StarterKit, WikilinkExtension];

  function getInitialBody(): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    try {
      return generateHTML(content, htmlExtensions);
    } catch (e) {
      console.error('[NoteEditor] generateHTML failed:', e);
      return '';
    }
  }

  function handleUpdate({ editor }: EditorEvents['update']) {
    if (saveTimer) clearTimeout(saveTimer);
    saveStatus = 'idle';
    saveTimer = setTimeout(async () => {
      const json = editor.getJSON();
      saveStatus = 'saving';
      try {
        await onSave(json);
        saveStatus = 'saved';
      } catch (e) {
        console.error('Failed to save note:', e);
        saveStatus = 'idle';
      }
    }, 1500);
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-end gap-2 px-2 py-1 text-xs text-[var(--color-text-muted)]">
    {#if saveStatus === 'saving'}
      <span>Saving...</span>
    {:else if saveStatus === 'saved'}
      <span>Saved</span>
    {/if}
    <button
      onclick={toggleDictation}
      disabled={transcribing}
      title={listening ? 'Stop & transcribe' : transcribing ? 'Transcribing...' : 'Start dictation'}
      class="px-2 py-1 rounded transition-colors cursor-pointer disabled:cursor-wait {listening ? 'bg-red-500/20 text-red-400 animate-pulse' : transcribing ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}"
      type="button"
    >
      {#if listening}
        ⏹ Recording...
      {:else if transcribing}
        Transcribing...
      {:else}
        🎙
      {/if}
    </button>
  </div>
  <div class="flex-1 overflow-y-auto tipex-wrapper">
    <Tipex
      body={getInitialBody()}
      {extensions}
      onupdate={handleUpdate as any}
      oncreate={({ editor }: any) => editor.commands.focus('end')}
      bind:tipex={editorInstance as any}
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
