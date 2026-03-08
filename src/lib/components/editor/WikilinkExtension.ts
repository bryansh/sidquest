import { Mention } from '@tiptap/extension-mention';
import { createWikilinkSuggestion } from './wikilinkSuggestion';

export interface WikilinkItem {
  id: string;
  noteId: string;
  label: string;
  entityName: string;
  typeName: string;
}

const resolvedStyle = 'background:color-mix(in srgb,var(--color-accent) 20%,transparent);color:var(--color-accent);padding:1px 4px;border-radius:3px;font-size:0.9em;cursor:pointer';
const ghostStyle = 'background:color-mix(in srgb,var(--color-text-muted) 15%,transparent);color:var(--color-text-muted);padding:1px 4px;border-radius:3px;font-size:0.9em;cursor:pointer;font-style:italic';

export const WikilinkExtension = Mention.extend({
  name: 'wikilink',

  addAttributes() {
    return {
      id: { default: null },
      noteId: { default: null },
      label: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const isResolved = !!node.attrs.noteId;
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-type': this.name,
        'data-note-id': node.attrs.noteId || '',
        style: isResolved ? resolvedStyle : ghostStyle,
      },
      `[[${node.attrs.label || ''}]]`,
    ];
  },
}).configure({
  suggestion: createWikilinkSuggestion(),
});
