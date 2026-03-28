import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import Typo from 'typo-js';
import affData from '$lib/dict/en.aff?raw';
import dicData from '$lib/dict/en.dic?raw';

const spellcheckKey = new PluginKey('spellcheck');

let dictionary: any = null;
function getDictionary() {
  if (!dictionary) {
    dictionary = new Typo('en_US', affData, dicData);
  }
  return dictionary;
}

const WORD_RE = /[a-zA-Z'\u2019]+/g;

// Words the dictionary knows but only with unusual casing (e.g., WiFi)
const caseExceptions = new Set(['wifi', 'macos', 'iphone', 'ipad', 'imac', 'ios']);

function shouldSkip(word: string): boolean {
  if (word.length < 2) return true;
  if (/^[A-Z]{2,}$/.test(word)) return true;
  if (/^\d+$/.test(word)) return true;
  if (caseExceptions.has(word.toLowerCase())) return true;
  return false;
}

function buildDecorations(doc: any): DecorationSet {
  const dict = getDictionary();
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'wikilink') return false;
    if (!node.isText) return;

    const text = node.text || '';
    let match;
    WORD_RE.lastIndex = 0;

    while ((match = WORD_RE.exec(text)) !== null) {
      const word = match[0];
      if (shouldSkip(word)) continue;
      // Normalize curly apostrophes to straight for dictionary lookup
      const normalized = word.replace(/\u2019/g, "'");
      if (dict.check(normalized)) continue;
      if (dict.check(word)) continue;
      // Try case variations: lowercase, title case
      const lower = normalized.toLowerCase();
      if (dict.check(lower)) continue;
      if (dict.check(lower[0].toUpperCase() + lower.slice(1))) continue;
      if (dict.check(word.toUpperCase())) continue;

      const from = pos + match.index;
      const to = from + word.length;
      decorations.push(
        Decoration.inline(from, to, { class: 'spellcheck-error' })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const SpellcheckExtension = Extension.create({
  name: 'spellcheck',

  addProseMirrorPlugins() {
    let enabled = true;

    return [
      new Plugin({
        key: spellcheckKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldDecorations, _, newState) {
            const meta = tr.getMeta(spellcheckKey);
            if (meta !== undefined) {
              if ('enabled' in meta) {
                enabled = meta.enabled;
                return enabled ? buildDecorations(newState.doc) : DecorationSet.empty;
              }
            }
            if (!enabled) return DecorationSet.empty;
            if (!tr.docChanged) return oldDecorations;
            // Rebuild on every doc change — simple and correct
            return buildDecorations(newState.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export { spellcheckKey };
