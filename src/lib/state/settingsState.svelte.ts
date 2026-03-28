import { LazyStore } from '@tauri-apps/plugin-store';
import { getCurrentWindow } from '@tauri-apps/api/window';

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
}

const defaults: Settings = {
  theme: 'dark',
  accentColor: 'purple',
  alwaysOnTop: false,
  editorFontSize: 15,
  spellCheck: true,
};

export const settings = $state<Settings>({ ...defaults });

let loaded = false;

export async function loadSettings() {
  if (loaded) return;
  loaded = true;

  const saved = await store.get<Partial<Settings>>('settings');
  if (saved) {
    Object.assign(settings, { ...defaults, ...saved });
  }

  // Apply settings on load
  applyTheme();
  applyAlwaysOnTop();
}

export async function updateSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  await store.set('settings', { ...settings });

  if ('theme' in patch || 'accentColor' in patch) applyTheme();
  if ('alwaysOnTop' in patch) applyAlwaysOnTop();
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
