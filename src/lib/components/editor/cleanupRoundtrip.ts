/**
 * Serialize TipTap JSON → plain text (preserving [[wikilinks]]),
 * then deserialize cleaned text back → TipTap JSON (restoring wikilink node attrs).
 */

interface WikilinkAttrs {
  id: string;
  noteId: string | null;
  entityId: string | null;
  label: string;
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  text?: string;
  marks?: any[];
}

/**
 * Walk the TipTap JSON tree and emit plain text.
 * Wikilink nodes become [[label]], and we collect a map of label → attrs
 * so we can restore them after cleanup.
 */
export function serialize(doc: TipTapNode): { text: string; wikilinkMap: Map<string, WikilinkAttrs> } {
  const wikilinkMap = new Map<string, WikilinkAttrs>();
  const text = serializeNode(doc, wikilinkMap);
  return { text, wikilinkMap };
}

function serializeNode(node: TipTapNode, wlMap: Map<string, WikilinkAttrs>): string {
  if (node.type === 'wikilink') {
    const label = node.attrs?.label || '';
    wlMap.set(label.toLowerCase(), {
      id: node.attrs?.id || '',
      noteId: node.attrs?.noteId || null,
      entityId: node.attrs?.entityId || null,
      label,
    });
    return `[[${label}]]`;
  }

  if (node.type === 'text') {
    return node.text || '';
  }

  if (!node.content) {
    // Block-level empty nodes (e.g. hardBreak, horizontalRule)
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'horizontalRule') return '\n---\n';
    return '';
  }

  const inner = node.content.map(child => serializeNode(child, wlMap)).join('');

  // Add block-level separators
  switch (node.type) {
    case 'paragraph':
      return inner + '\n\n';
    case 'heading': {
      const level = node.attrs?.level || 1;
      const prefix = '#'.repeat(level) + ' ';
      return prefix + inner + '\n\n';
    }
    case 'bulletList':
    case 'orderedList':
      return inner + '\n';
    case 'listItem':
      return '- ' + inner.trim() + '\n';
    case 'blockquote':
      return inner.split('\n').filter(Boolean).map(l => '> ' + l).join('\n') + '\n\n';
    case 'codeBlock':
      return '```\n' + inner + '```\n\n';
    case 'doc':
      return inner;
    default:
      return inner;
  }
}

/**
 * Re-wrap known wikilink labels that the LLM may have stripped brackets from.
 * Matches bare entity names (whole-word, case-insensitive) and restores [[label]].
 * Skips names already wrapped in [[ ]].
 */
export function restoreWikilinks(text: string, wikilinkMap: Map<string, WikilinkAttrs>): string {
  if (wikilinkMap.size === 0) {
    // No known wikilinks — strip any the model invented
    return text.replace(/\[\[([^\]]+)\]\]/g, '$1');
  }

  // Sort labels longest-first so "Elara the Wise" matches before "Elara"
  const labels = Array.from(wikilinkMap.values())
    .map(a => a.label)
    .sort((a, b) => b.length - a.length);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match whole-word occurrences NOT already inside [[ ]]
    const pattern = new RegExp(`(?<!\\[\\[)\\b(${escaped})\\b(?!\\]\\])`, 'gi');
    text = text.replace(pattern, `[[${label}]]`);
  }

  // Strip brackets from any wikilinks the model invented (not in our map)
  text = text.replace(/\[\[([^\]]+)\]\]/g, (match, label) => {
    return wikilinkMap.has(label.toLowerCase()) ? match : label;
  });

  return text;
}

/**
 * Parse cleaned-up text back into a TipTap JSON document.
 * Re-links [[label]] occurrences to their original wikilink attrs using the map.
 */
export function deserialize(text: string, wikilinkMap: Map<string, WikilinkAttrs>): TipTapNode {
  const lines = text.split('\n');
  const content: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      content.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: inlineToNodes(headingMatch[2], wikilinkMap),
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      content.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    // Bullet list item (supports optional leading whitespace for indented sub-bullets)
    if (line.match(/^\s*[-*+]\s/)) {
      const items: TipTapNode[] = [];
      while (i < lines.length && lines[i].match(/^\s*[-*+]\s/)) {
        const itemText = lines[i].replace(/^\s*[-*+]\s/, '');
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: inlineToNodes(itemText, wikilinkMap) }],
        });
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }

    // Ordered list item
    if (line.match(/^\d+\.\s/)) {
      const items: TipTapNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        const itemText = lines[i].replace(/^\d+\.\s/, '');
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: inlineToNodes(itemText, wikilinkMap) }],
        });
        i++;
      }
      content.push({ type: 'orderedList', attrs: { start: 1 }, content: items });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      content.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: inlineToNodes(quoteLines.join(' '), wikilinkMap) }],
      });
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      content.push({
        type: 'codeBlock',
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      continue;
    }

    // Regular paragraph
    content.push({
      type: 'paragraph',
      content: inlineToNodes(line, wikilinkMap),
    });
    i++;
  }

  // Ensure at least one paragraph
  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  return { type: 'doc', content };
}

/**
 * Parse a line of text into TipTap inline nodes,
 * splitting on [[wikilink]] patterns and restoring attrs from the map.
 */
function inlineToNodes(text: string, wikilinkMap: Map<string, WikilinkAttrs>): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before the wikilink
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    const label = match[1];
    const attrs = wikilinkMap.get(label.toLowerCase());

    nodes.push({
      type: 'wikilink',
      attrs: attrs
        ? { id: attrs.id, noteId: attrs.noteId, entityId: attrs.entityId, label: attrs.label }
        : { id: null, noteId: null, entityId: null, label },
    });

    lastIndex = regex.lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return nodes;
}
