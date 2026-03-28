<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { settings, updateSettings, accentColors, type Theme, type AccentColor } from '$lib/state/settingsState.svelte';

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

</script>

<Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/50 z-50" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-xl"
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
