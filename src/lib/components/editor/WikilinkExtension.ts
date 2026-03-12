import { Mention } from '@tiptap/extension-mention';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { createWikilinkSuggestion } from './wikilinkSuggestion';
import { noteState, selectEntity } from '$lib/state/noteState.svelte';

export interface WikilinkItem {
  id: string;
  noteId: string | null;
  entityId: string | null;
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
      entityId: { default: null },
      label: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-type="${this.name}"]` }];
  },

  renderText({ node }) {
    return `[[${node.attrs.label || ''}]]`;
  },

  renderHTML({ node, HTMLAttributes }) {
    const isResolved = !!(node.attrs.noteId || node.attrs.entityId);
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-type': this.name,
        'data-note-id': node.attrs.noteId || '',
        'data-entity-id': node.attrs.entityId || '',
        style: isResolved ? resolvedStyle : ghostStyle,
      },
      `[[${node.attrs.label || ''}]]`,
    ];
  },
  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        key: new PluginKey('wikilinkClick'),
        props: {
          handleClick(view, pos) {
            const node = view.state.doc.nodeAt(pos);
            if (node?.type.name !== 'wikilink') return false;
            const { noteId, entityId } = node.attrs;
            if (noteId) {
              const note = noteState.allGameNotes.find(n => n.id === noteId);
              if (note) {
                selectEntity(note.entityId).then(() => {
                  noteState.activeNoteId = noteId;
                });
              }
              return true;
            }
            if (entityId) {
              selectEntity(entityId);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
}).configure({
  suggestion: createWikilinkSuggestion(),
});
