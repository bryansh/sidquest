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
      return noteState.notes
        .filter(n => n.gameId === gameState.activeGameId)
        .filter(n => n.title.toLowerCase().includes(q))
        .slice(0, 10)
        .map(n => {
          const entity = gameState.entities.find(e => e.id === n.entityId);
          const entityType = entity
            ? gameState.entityTypes.find(et => et.id === entity.entityTypeId)
            : null;
          return {
            id: n.id,
            noteId: n.id,
            label: n.title,
            entityName: entity?.name ?? '',
            typeName: entityType?.name ?? '',
          };
        });
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
          empty.textContent = 'No notes found';
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
          metaSpan.textContent = item.entityName + (item.typeName ? ' \u00b7 ' + item.typeName : '');

          el.appendChild(titleSpan);
          el.appendChild(metaSpan);
          el.addEventListener('mousedown', (e) => { e.preventDefault(); selectItem(index); });
          container.appendChild(el);
        });
      }

      function selectItem(index: number) {
        const item = items[index];
        if (item && commandFn) {
          commandFn({ id: item.noteId, label: item.label, noteId: item.noteId } as any);
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
              id: props.noteId || props.id,
              noteId: props.noteId || props.id,
              label: props.label,
            },
          },
          { type: 'text', text: ' ' },
        ])
        .run();
    },
  };
}
