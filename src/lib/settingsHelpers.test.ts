import { describe, it, expect } from 'vitest';

// These are pure functions extracted from settingsState.svelte.ts
// We test them directly since they don't depend on Svelte runes

function formatShortcut(e: Partial<KeyboardEvent>): string | null {
  const key = e.key!;
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return null;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (parts.length === 0) return null;

  const keyMap: Record<string, string> = {
    ' ': 'Space', 'ArrowUp': 'Up', 'ArrowDown': 'Down',
    'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'Escape': 'Escape',
    'Enter': 'Enter', 'Backspace': 'Backspace', 'Delete': 'Delete', 'Tab': 'Tab',
  };
  const mappedKey = keyMap[key] || (key.length === 1 ? key.toUpperCase() : key);
  parts.push(mappedKey);
  return parts.join('+');
}

function displayShortcut(shortcut: string): string {
  return shortcut
    .replace('CommandOrControl', '⌘')
    .replace('CmdOrCtrl', '⌘')
    .replace('Shift', '⇧')
    .replace('Alt', '⌥')
    .replace(/\+/g, '');
}

describe('formatShortcut', () => {
  it('returns null for modifier-only press', () => {
    expect(formatShortcut({ key: 'Control', ctrlKey: true })).toBeNull();
    expect(formatShortcut({ key: 'Meta', metaKey: true })).toBeNull();
    expect(formatShortcut({ key: 'Shift', shiftKey: true })).toBeNull();
  });

  it('returns null without any modifier', () => {
    expect(formatShortcut({ key: 'g' })).toBeNull();
  });

  it('formats Cmd+G', () => {
    expect(formatShortcut({ key: 'g', metaKey: true })).toBe('CommandOrControl+G');
  });

  it('formats Cmd+Shift+G', () => {
    expect(formatShortcut({ key: 'g', metaKey: true, shiftKey: true })).toBe('CommandOrControl+Shift+G');
  });

  it('formats Ctrl+Alt+S', () => {
    expect(formatShortcut({ key: 's', ctrlKey: true, altKey: true })).toBe('CommandOrControl+Alt+S');
  });

  it('maps special keys', () => {
    expect(formatShortcut({ key: ' ', metaKey: true })).toBe('CommandOrControl+Space');
    expect(formatShortcut({ key: 'ArrowUp', metaKey: true })).toBe('CommandOrControl+Up');
    expect(formatShortcut({ key: 'Enter', metaKey: true })).toBe('CommandOrControl+Enter');
  });
});

describe('displayShortcut', () => {
  it('converts CommandOrControl to ⌘', () => {
    expect(displayShortcut('CommandOrControl+G')).toBe('⌘G');
  });

  it('converts Shift to ⇧', () => {
    expect(displayShortcut('CommandOrControl+Shift+G')).toBe('⌘⇧G');
  });

  it('converts Alt to ⌥', () => {
    expect(displayShortcut('Alt+S')).toBe('⌥S');
  });

  it('handles CmdOrCtrl alias', () => {
    expect(displayShortcut('CmdOrCtrl+X')).toBe('⌘X');
  });
});
