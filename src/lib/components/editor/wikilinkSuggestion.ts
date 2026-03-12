import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import type { WikilinkItem } from './WikilinkExtension';
import { noteState } from '$lib/state/noteState.svelte';
import { gameState } from '$lib/state/gameState.svelte';

const styles = {
  list: 'background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;padding:4px;min-width:200px;max-width:320px;max-height:240px;overflow-y:auto',
  item: 'display:flex;flex-direction:column;width:100%;text-align:left;padding:6px 8px;border-radius:4px;border:none;background:none;color:var(--color-text);cursor:pointer;font-size:0.8125rem',
  itemSelected: 'background:var(--color-surface-hover)',
  title: 'font-weight:500',
  meta: 'font-size:0.75rem;color:var(--color-text-muted)',
  empty: 'padding:8px;text-align:center;color:var(--color-text-muted);font-size:0.8125rem',
};

export function createWikilinkSuggestion(): Omit<SuggestionOptions<WikilinkItem>, 'editor'> {
  return {
    char: '[[',
    allowSpaces: true,

    items({ query }): WikilinkItem[] {
      const q = query.toLowerCase();
      const qTerms = q.split(/\s+/).filter(Boolean);
      const matchesQuery = (text: string) =>
        qTerms.length === 0 || qTerms.every(t => text.includes(t));

      // Entity matches
      const entityResults: WikilinkItem[] = gameState.entities
        .filter(e => matchesQuery(e.name.toLowerCase()))
        .map(e => {
          const entityType = gameState.entityTypes.find(et => et.id === e.entityTypeId);
          return {
            id: e.id,
            noteId: null,
            entityId: e.id,
            label: e.name,
            entityName: e.name,
            typeName: entityType?.name ?? '',
          };
        });

      // Note matches — qualify with entity name for disambiguation
      const noteResults: WikilinkItem[] = noteState.allGameNotes
        .map(n => {
          const entity = gameState.entities.find(e => e.id === n.entityId);
          const entityType = entity
            ? gameState.entityTypes.find(et => et.id === entity.entityTypeId)
            : null;
          const entityName = entity?.name ?? '';
          // If note title matches entity name, the entity result already covers it
          const isDefaultNote = entityName.toLowerCase() === n.title.toLowerCase();
          // Qualified label: "Entity / Note" for non-default notes
          const label = isDefaultNote ? n.title : `${entityName} / ${n.title}`;
          // Search against combined terms so "gandalf background" matches
          const searchText = `${entityName} ${n.title}`.toLowerCase();
          return {
            item: {
              id: n.id,
              noteId: n.id,
              entityId: entity?.id ?? null,
              label,
              entityName,
              typeName: entityType?.name ?? '',
            } as WikilinkItem,
            isDefaultNote,
            searchText,
          };
        })
        .filter(r => !r.isDefaultNote && matchesQuery(r.searchText))
        .map(r => r.item);

      return [...entityResults, ...noteResults].slice(0, 10);
    },

    render() {
      let popup: TippyInstance | undefined;
      let container: HTMLElement;
      let selectedIndex = 0;
      let items: WikilinkItem[] = [];
      let commandFn: SuggestionProps<WikilinkItem>['command'];

      function updateList() {
        container.innerHTML = '';
        if (items.length === 0) {
          const empty = document.createElement('div');
          empty.setAttribute('style', styles.empty);
          empty.textContent = 'No matches found';
          container.appendChild(empty);
          return;
        }
        items.forEach((item, index) => {
          const el = document.createElement('button');
          el.setAttribute('style', styles.item + (index === selectedIndex ? ';' + styles.itemSelected : ''));

          const titleSpan = document.createElement('span');
          titleSpan.setAttribute('style', styles.title);
          titleSpan.textContent = item.label;

          const metaSpan = document.createElement('span');
          metaSpan.setAttribute('style', styles.meta);
          metaSpan.textContent = item.typeName || '';

          el.appendChild(titleSpan);
          el.appendChild(metaSpan);
          el.addEventListener('mousedown', (e) => { e.preventDefault(); selectItem(index); });
          container.appendChild(el);
        });
      }

      function selectItem(index: number) {
        const item = items[index];
        if (item && commandFn) {
          commandFn({ id: item.noteId || item.entityId, label: item.label, noteId: item.noteId, entityId: item.entityId } as any);
        }
      }

      return {
        onStart(props) {
          commandFn = props.command;
          container = document.createElement('div');
          container.setAttribute('style', styles.list);

          popup = tippy(document.body, {
            getReferenceClientRect: () => props.clientRect?.() as DOMRect,
            appendTo: () => document.body,
            content: container,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            arrow: false,
          });

          items = props.items as WikilinkItem[];
          selectedIndex = 0;
          updateList();
        },

        onUpdate(props) {
          commandFn = props.command;
          items = props.items as WikilinkItem[];
          selectedIndex = 0;
          updateList();
          popup?.setProps({
            getReferenceClientRect: () => props.clientRect?.() as DOMRect,
          });
        },

        onKeyDown(props) {
          if (props.event.key === 'ArrowDown') {
            selectedIndex = (selectedIndex + 1) % items.length;
            updateList();
            return true;
          }
          if (props.event.key === 'ArrowUp') {
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateList();
            return true;
          }
          if (props.event.key === 'Enter') {
            selectItem(selectedIndex);
            return true;
          }
          if (props.event.key === 'Escape') {
            popup?.hide();
            return true;
          }
          return false;
        },

        onExit() {
          popup?.destroy();
        },
      };
    },

    command({ editor, range, props }) {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'wikilink',
            attrs: {
              id: props.noteId || props.entityId || props.id,
              noteId: props.noteId || null,
              entityId: props.entityId || null,
              label: props.label,
            },
          },
          { type: 'text', text: ' ' },
        ])
        .run();
    },
  };
}
