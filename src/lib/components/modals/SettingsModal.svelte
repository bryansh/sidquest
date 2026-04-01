<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { invoke } from '@tauri-apps/api/core';
  import { settings, updateSettings, accentColors, formatShortcut, displayShortcut, type Theme, type AccentColor, type AIProvider } from '$lib/state/settingsState.svelte';
  import { modelState, checkLocalModel, downloadLocalModel, deleteLocalModel, loadCustomModels, saveCustomModel, removeCustomModel, downloadCustomModel, checkCustomModel } from '$lib/state/modelState.svelte';
  import { type LocalModelDef, formatBytes, filenameFromUrl, CHAT_TEMPLATES } from '$lib/models';
  import { onMount } from 'svelte';

  let { onClose }: { onClose: () => void } = $props();

  function setTheme(theme: Theme) {
    updateSettings({ theme });
  }

  function setAccent(color: AccentColor) {
    updateSettings({ accentColor: color });
  }

  function setAlwaysOnTop(value: boolean) {
    updateSettings({ alwaysOnTop: value });
  }

  function setFontSize(size: number) {
    updateSettings({ editorFontSize: Math.max(12, Math.min(20, size)) });
  }

  function focusEl(node: HTMLElement) {
    requestAnimationFrame(() => node.focus());
  }

  let recordingHotkey = $state(false);
  let hotkeyError = $state('');
  let availableModels = $state<LocalModelDef[]>([]);
  let testingConnection = $state(false);
  let connectionResult = $state<{ ok: boolean; message: string } | null>(null);
  let showApiKey = $state(false);

  let allModels = $state<LocalModelDef[]>([]);
  let customModels = $state<LocalModelDef[]>([]);
  let showAddModel = $state(false);
  let newModelUrl = $state('');
  let newModelName = $state('');
  let newModelTemplate = $state('gemma3');
  let addingModel = $state(false);

  onMount(async () => {
    try {
      availableModels = await invoke<LocalModelDef[]>('get_available_models');
      allModels = await invoke<LocalModelDef[]>('get_all_models');
      customModels = await loadCustomModels();
      // Add custom generation models to the picker
      const customGenModels = customModels.filter(m => m.model_type === 'generation');
      availableModels = [...availableModels, ...customGenModels];
      for (const m of allModels) {
        await checkLocalModel(m.id);
      }
      for (const m of customModels) {
        await checkCustomModel(m);
      }
    } catch (e) {
      console.error('[Settings] Failed to load models:', e);
    }
  });

  async function handleAddModel() {
    if (!newModelUrl.trim() || !newModelName.trim()) return;
    addingModel = true;
    const filename = filenameFromUrl(newModelUrl);
    const id = `custom-${filename.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const model: LocalModelDef = {
      id,
      name: newModelName.trim(),
      filename,
      url: newModelUrl.trim(),
      size_bytes: 0,
      context_window: 4096,
      chat_template: newModelTemplate,
      model_type: 'generation',
      embedding_dim: null,
      custom: true,
    };
    await saveCustomModel(model);
    customModels = await loadCustomModels();
    await downloadCustomModel(model);
    // Add to generation model picker
    availableModels = [...availableModels, model];
    newModelUrl = '';
    newModelName = '';
    newModelTemplate = 'gemma3';
    showAddModel = false;
    addingModel = false;
  }

  async function handleRemoveCustomModel(modelId: string) {
    await removeCustomModel(modelId);
    customModels = await loadCustomModels();
    availableModels = availableModels.filter(m => m.id !== modelId);
    if (settings.localModelId === modelId) {
      updateSettings({ localModelId: 'gemma3-12b' });
    }
  }

  async function testClaudeKey() {
    if (!settings.claudeApiKey) return;
    testingConnection = true;
    connectionResult = null;
    try {
      await invoke<boolean>('test_claude_api', { apiKey: settings.claudeApiKey });
      connectionResult = { ok: true, message: 'Connected!' };
    } catch (e) {
      connectionResult = { ok: false, message: String(e) };
    } finally {
      testingConnection = false;
    }
  }

  function handleHotkeyCapture(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      recordingHotkey = false;
      return;
    }

    const shortcut = formatShortcut(e);
    if (!shortcut) return;

    recordingHotkey = false;
    hotkeyError = '';
    updateSettings({ globalHotkey: shortcut }).catch((err) => {
      hotkeyError = 'Failed to register shortcut';
      console.error('[Settings] Hotkey error:', err);
    });
  }

</script>

<Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/50 z-50" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[85vh] rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-xl overflow-y-auto"
    >
      <Dialog.Title class="text-lg font-semibold mb-6">Settings</Dialog.Title>

      <div class="flex flex-col gap-5">
        <!-- Theme -->
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2 block">Theme</label>
          <div class="flex gap-2">
            <button
              onclick={() => setTheme('dark')}
              class="flex-1 px-3 py-2 rounded text-sm border transition-colors {settings.theme === 'dark' ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}"
            >
              Dark
            </button>
            <button
              onclick={() => setTheme('light')}
              class="flex-1 px-3 py-2 rounded text-sm border transition-colors {settings.theme === 'light' ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}"
            >
              Light
            </button>
          </div>
        </div>

        <!-- Accent Color -->
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2 block">Accent Color</label>
          <div class="flex gap-2">
            {#each Object.entries(accentColors) as [name, colors]}
              <button
                onclick={() => setAccent(name as AccentColor)}
                title={name}
                class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 {settings.accentColor === name ? 'border-[var(--color-text)] scale-110' : 'border-transparent'}"
                style="background-color: {colors.accent}"
              ></button>
            {/each}
          </div>
        </div>

        <!-- Always on Top -->
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm text-[var(--color-text)]">Always on Top</label>
            <p class="text-xs text-[var(--color-text-muted)]">Keep window above other apps</p>
          </div>
          <button
            onclick={() => setAlwaysOnTop(!settings.alwaysOnTop)}
            aria-label="Toggle always on top"
            class="relative w-10 h-6 rounded-full transition-colors {settings.alwaysOnTop ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}"
          >
            <span
              class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform {settings.alwaysOnTop ? 'translate-x-4' : ''}"
            ></span>
          </button>
        </div>

        <!-- Editor Font Size -->
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm text-[var(--color-text)]">Editor Font Size</label>
            <p class="text-xs text-[var(--color-text-muted)]">{settings.editorFontSize}px</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              onclick={() => setFontSize(settings.editorFontSize - 1)}
              class="w-7 h-7 rounded border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >-</button>
            <span class="text-sm w-6 text-center">{settings.editorFontSize}</span>
            <button
              onclick={() => setFontSize(settings.editorFontSize + 1)}
              class="w-7 h-7 rounded border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >+</button>
          </div>
        </div>

        <!-- Global Hotkey -->
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm text-[var(--color-text)]">Global Hotkey</label>
            <p class="text-xs text-[var(--color-text-muted)]">Show/hide Sidquest from anywhere</p>
            {#if hotkeyError}
              <p class="text-xs text-red-400 mt-1">{hotkeyError}</p>
            {/if}
          </div>
          {#if recordingHotkey}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="px-3 py-1.5 rounded text-sm border border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)] animate-pulse min-w-[80px] text-center"
              tabindex="-1"
              onkeydown={handleHotkeyCapture}
              onblur={() => recordingHotkey = false}
              use:focusEl
            >
              Press keys...
            </div>
          {:else}
            <button
              onclick={() => { recordingHotkey = true; hotkeyError = ''; }}
              class="px-3 py-1.5 rounded text-sm border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-text-muted)] transition-colors min-w-[80px] text-center"
            >
              {displayShortcut(settings.globalHotkey)}
            </button>
          {/if}
        </div>

        <!-- Spell Check -->
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm text-[var(--color-text)]">Spell Check</label>
            <p class="text-xs text-[var(--color-text-muted)]">Highlight misspelled words in editor</p>
          </div>
          <button
            onclick={() => updateSettings({ spellCheck: !settings.spellCheck })}
            aria-label="Toggle spell check"
            class="relative w-10 h-6 rounded-full transition-colors {settings.spellCheck ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}"
          >
            <span
              class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform {settings.spellCheck ? 'translate-x-4' : ''}"
            ></span>
          </button>
        </div>
        <!-- AI Provider -->
        <div class="pt-3 border-t border-[var(--color-border)]">
          <label class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2 block">AI Provider</label>
          <div class="flex gap-2 mb-3">
            <button
              onclick={() => updateSettings({ aiProvider: 'local' })}
              class="flex-1 px-3 py-2 rounded text-sm border transition-colors {settings.aiProvider === 'local' ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}"
            >
              Local Model
            </button>
            <button
              onclick={() => updateSettings({ aiProvider: 'cloud' })}
              class="flex-1 px-3 py-2 rounded text-sm border transition-colors {settings.aiProvider === 'cloud' ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}"
            >
              Cloud (Claude)
            </button>
          </div>

          {#if settings.aiProvider === 'local'}
            <div class="flex flex-col gap-2 mb-3">
              {#each availableModels as model}
                {@const entry = modelState.localModels[model.id]}
                {@const isSelected = settings.localModelId === model.id}
                {@const status = entry?.status ?? 'unknown'}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  onclick={() => updateSettings({ localModelId: model.id })}
                  onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') updateSettings({ localModelId: model.id }); }}
                  role="radio"
                  aria-checked={isSelected}
                  tabindex="0"
                  class="flex items-center justify-between p-2.5 rounded border transition-colors text-left cursor-pointer {isSelected ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'}"
                >
                  <div>
                    <span class="text-sm text-[var(--color-text)]">{model.name}</span>
                    <span class="text-xs text-[var(--color-text-muted)] ml-2">{formatBytes(model.size_bytes)}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    {#if status === 'ready'}
                      <span class="text-xs text-green-400">Ready</span>
                    {:else if status === 'downloading'}
                      <span class="text-xs text-[var(--color-accent)] animate-pulse">{entry?.progress ?? 0}%</span>
                    {:else if status === 'missing' || status === 'unknown'}
                      {#if isSelected}
                        <button
                          onclick={(e: MouseEvent) => { e.stopPropagation(); downloadLocalModel(model.id); }}
                          class="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                        >Download</button>
                      {:else}
                        <span class="text-xs text-[var(--color-text-muted)]">Not downloaded</span>
                      {/if}
                    {:else}
                      <span class="text-xs text-[var(--color-text-muted)]">Checking...</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="flex flex-col gap-2 mb-3">
              <div class="flex gap-2">
                <div class="flex-1 relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.claudeApiKey}
                    oninput={(e) => { updateSettings({ claudeApiKey: (e.target as HTMLInputElement).value }); connectionResult = null; }}
                    placeholder="sk-ant-..."
                    class="w-full px-3 py-2 rounded text-sm border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                  <button
                    onclick={() => showApiKey = !showApiKey}
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >{showApiKey ? 'Hide' : 'Show'}</button>
                </div>
                <button
                  onclick={testClaudeKey}
                  disabled={!settings.claudeApiKey || testingConnection}
                  class="px-3 py-2 rounded text-sm border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] transition-colors disabled:opacity-50"
                >{testingConnection ? 'Testing...' : 'Test'}</button>
              </div>
              {#if connectionResult}
                <p class="text-xs {connectionResult.ok ? 'text-green-400' : 'text-red-400'}">{connectionResult.message}</p>
              {/if}
              <p class="text-xs text-[var(--color-text-muted)]">Uses Claude Sonnet for cleanup, extraction, and chat</p>
            </div>
          {/if}
        </div>

        <!-- Model Manager -->
        <div class="pt-3 border-t border-[var(--color-border)]">
          <label class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2 block">Model Manager</label>
          <div class="flex flex-col gap-1.5">
            {#each [...allModels, ...customModels] as model}
              {@const entry = modelState.localModels[model.id]}
              {@const status = entry?.status ?? 'unknown'}
              <div class="flex items-center justify-between px-2.5 py-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-[var(--color-text)]">{model.name}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">{model.model_type}</span>
                    {#if model.custom}
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">Custom</span>
                    {/if}
                  </div>
                  <span class="text-xs text-[var(--color-text-muted)]">
                    {model.size_bytes > 0 ? formatBytes(model.size_bytes) : model.filename}
                  </span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  {#if status === 'ready'}
                    <span class="text-xs text-green-400">Ready</span>
                    {#if model.custom}
                      <button
                        onclick={() => handleRemoveCustomModel(model.id)}
                        class="text-xs px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-400 transition-colors"
                      >Remove</button>
                    {:else}
                      <button
                        onclick={() => deleteLocalModel(model.id)}
                        class="text-xs px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-400 transition-colors"
                      >Remove</button>
                    {/if}
                  {:else if status === 'downloading'}
                    <span class="text-xs text-[var(--color-accent)] animate-pulse">{entry?.progress ?? 0}%</span>
                  {:else}
                    {#if model.custom}
                      <button
                        onclick={() => downloadCustomModel(model)}
                        class="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                      >Download</button>
                      <button
                        onclick={() => handleRemoveCustomModel(model.id)}
                        class="text-xs px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-400 transition-colors"
                      >&times;</button>
                    {:else}
                      <button
                        onclick={() => downloadLocalModel(model.id)}
                        class="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                      >Download</button>
                    {/if}
                  {/if}
                </div>
              </div>
            {/each}

            <!-- Add custom model -->
            {#if showAddModel}
              <div class="px-2.5 py-3 rounded border border-[var(--color-accent)] bg-[var(--color-bg)] flex flex-col gap-2">
                <input
                  type="text"
                  bind:value={newModelName}
                  placeholder="Model name (e.g., Qwen 2.5 7B)"
                  class="px-2 py-1.5 rounded text-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
                />
                <input
                  type="text"
                  bind:value={newModelUrl}
                  placeholder="HuggingFace GGUF URL"
                  class="px-2 py-1.5 rounded text-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
                />
                <div class="flex items-center gap-2">
                  <label class="text-xs text-[var(--color-text-muted)]">Template:</label>
                  <select
                    bind:value={newModelTemplate}
                    class="flex-1 px-2 py-1 rounded text-xs border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none"
                  >
                    {#each CHAT_TEMPLATES as tmpl}
                      <option value={tmpl.id}>{tmpl.name}</option>
                    {/each}
                  </select>
                </div>
                <div class="flex justify-end gap-2">
                  <button
                    onclick={() => showAddModel = false}
                    class="text-xs px-3 py-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
                  >Cancel</button>
                  <button
                    onclick={handleAddModel}
                    disabled={!newModelUrl.trim() || !newModelName.trim() || addingModel}
                    class="text-xs px-3 py-1 rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
                  >{addingModel ? 'Adding...' : 'Add & Download'}</button>
                </div>
              </div>
            {:else}
              <button
                onclick={() => showAddModel = true}
                class="w-full text-left px-2.5 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded border border-dashed border-[var(--color-border)] transition-colors"
              >
                + Add Model from HuggingFace
              </button>
            {/if}
          </div>
        </div>
      </div>

      <div class="mt-6 pt-4 border-t border-[var(--color-border)] flex justify-between items-center">
        <span class="text-xs text-[var(--color-text-muted)]">Sidquest v0.1.0</span>
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
