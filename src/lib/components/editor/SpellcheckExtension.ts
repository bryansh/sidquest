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

function shouldSkip(word: string): boolean {
  return word.length < 2 || /^[A-Z]{2,}$/.test(word) || /^\d+$/.test(word);
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
      if (dict.check(word)) continue;
      if (word[0] === word[0].toUpperCase() && dict.check(word.toLowerCase())) continue;

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
