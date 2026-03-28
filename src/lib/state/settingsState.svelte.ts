import { LazyStore } from '@tauri-apps/plugin-store';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';

const store = new LazyStore('settings.json');

export type Theme = 'dark' | 'light';
export type AccentColor = 'purple' | 'blue' | 'green' | 'orange' | 'pink' | 'red';

export const accentColors: Record<AccentColor, { accent: string; hover: string }> = {
  purple: { accent: '#7c6ff5', hover: '#6b5de6' },
  blue: { accent: '#3b82f6', hover: '#2563eb' },
  green: { accent: '#22c55e', hover: '#16a34a' },
  orange: { accent: '#f97316', hover: '#ea580c' },
  pink: { accent: '#ec4899', hover: '#db2777' },
  red: { accent: '#ef4444', hover: '#dc2626' },
};

export interface Settings {
  theme: Theme;
  accentColor: AccentColor;
  alwaysOnTop: boolean;
  editorFontSize: number;
  spellCheck: boolean;
  globalHotkey: string;
}

const defaults: Settings = {
  theme: 'dark',
  accentColor: 'purple',
  alwaysOnTop: false,
  editorFontSize: 15,
  spellCheck: true,
  globalHotkey: 'CommandOrControl+Shift+G',
};

export const settings = $state<Settings>({ ...defaults });

let loaded = false;
let currentRegisteredHotkey: string | null = null;

export async function loadSettings() {
  if (loaded) return;
  loaded = true;

  const saved = await store.get<Partial<Settings>>('settings');
  if (saved) {
    Object.assign(settings, { ...defaults, ...saved });
  }

  applyTheme();
  applyAlwaysOnTop();
  await applyHotkey();
}

export async function updateSettings(patch: Partial<Settings>) {
  const oldHotkey = settings.globalHotkey;
  Object.assign(settings, patch);
  await store.set('settings', { ...settings });

  if ('theme' in patch || 'accentColor' in patch) applyTheme();
  if ('alwaysOnTop' in patch) applyAlwaysOnTop();
  if ('globalHotkey' in patch && patch.globalHotkey !== oldHotkey) await applyHotkey();
}

function applyTheme() {
  const root = document.documentElement;
  const accent = accentColors[settings.accentColor];

  if (settings.theme === 'light') {
    root.style.setProperty('--color-bg', '#f5f5f7');
    root.style.setProperty('--color-surface', '#ffffff');
    root.style.setProperty('--color-surface-hover', '#f0f0f2');
    root.style.setProperty('--color-border', '#d4d4d8');
    root.style.setProperty('--color-text', '#1a1a2e');
    root.style.setProperty('--color-text-muted', '#71717a');
  } else {
    root.style.setProperty('--color-bg', '#0f0f14');
    root.style.setProperty('--color-surface', '#1a1a24');
    root.style.setProperty('--color-surface-hover', '#22222f');
    root.style.setProperty('--color-border', '#2a2a3a');
    root.style.setProperty('--color-text', '#e4e4ef');
    root.style.setProperty('--color-text-muted', '#8888a0');
  }

  root.style.setProperty('--color-accent', accent.accent);
  root.style.setProperty('--color-accent-hover', accent.hover);
}

async function applyAlwaysOnTop() {
  try {
    await getCurrentWindow().setAlwaysOnTop(settings.alwaysOnTop);
  } catch (e) {
    console.error('[Settings] setAlwaysOnTop failed:', e);
  }
}

async function applyHotkey() {
  try {
    // Unregister old hotkey
    if (currentRegisteredHotkey) {
      const wasRegistered = await isRegistered(currentRegisteredHotkey);
      if (wasRegistered) {
        await unregister(currentRegisteredHotkey);
      }
      currentRegisteredHotkey = null;
    }

    // Register new hotkey
    const hotkey = settings.globalHotkey;
    if (hotkey) {
      await register(hotkey, (event) => {
        if (event.state === 'Pressed') {
          const win = getCurrentWindow();
          win.isVisible().then((visible) => {
            if (visible) {
              win.hide();
            } else {
              win.show();
              win.setFocus();
            }
          });
        }
      });
      currentRegisteredHotkey = hotkey;
    }
  } catch (e) {
    console.error('[Settings] Failed to register hotkey:', e);
  }
}

/** Format a keyboard event into a Tauri shortcut string */
export function formatShortcut(e: KeyboardEvent): string | null {
  const key = e.key;

  // Ignore modifier-only presses
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return null;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  // Need at least one modifier
  if (parts.length === 0) return null;

  // Map special keys
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Escape': 'Escape',
    'Enter': 'Enter',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Tab': 'Tab',
  };

  const mappedKey = keyMap[key] || (key.length === 1 ? key.toUpperCase() : key);
  parts.push(mappedKey);

  return parts.join('+');
}

/** Format shortcut string for display (e.g. CommandOrControl+Shift+G → ⌘⇧G) */
export function displayShortcut(shortcut: string): string {
  return shortcut
    .replace('CommandOrControl', '⌘')
    .replace('CmdOrCtrl', '⌘')
    .replace('Shift', '⇧')
    .replace('Alt', '⌥')
    .replace(/\+/g, '');
}
