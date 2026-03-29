/**
 * Standalone TipTap JSON transformation utilities.
 * Works on serialized TipTap documents without needing a mounted editor.
 */

export interface WikilinkTarget {
  entityId: string;
  label: string;
}

/**
 * Replace occurrences of entity names in text nodes with wikilink (mention) nodes.
 * Handles multiple entities, preserves marks, and doesn't touch existing wikilinks.
 */
export function insertWikilinksInDoc(
  doc: any,
  entityMap: Map<string, WikilinkTarget>
): any {
  if (!doc || !doc.content || entityMap.size === 0) return doc;
  return { ...doc, content: transformContent(doc.content, entityMap) };
}

function transformContent(
  content: any[],
  entityMap: Map<string, WikilinkTarget>
): any[] {
  const result: any[] = [];

  for (const node of content) {
    // Skip existing wikilinks
    if (node.type === 'mention') {
      result.push(node);
      continue;
    }

    // Split text nodes on entity names
    if (node.type === 'text' && node.text) {
      const split = splitText(node.text, node.marks, entityMap);
      result.push(...split);
      continue;
    }

    // Recurse into nodes with content (paragraphs, headings, list items, etc.)
    if (node.content) {
      result.push({
        ...node,
        content: transformContent(node.content, entityMap),
      });
      continue;
    }

    // Pass through everything else unchanged
    result.push(node);
  }

  return result;
}

/**
 * Split a text string into an array of text nodes and wikilink nodes.
 * Uses a single combined regex for all entity names.
 * Preserves text marks (bold, italic, etc.) on the text fragments.
 */
function splitText(
  text: string,
  marks: any[] | undefined,
  entityMap: Map<string, WikilinkTarget>
): any[] {
  // Build regex matching all entity names, longest first to avoid partial matches
  const entries = [...entityMap.entries()].sort(
    (a, b) => b[0].length - a[0].length
  );
  const pattern = entries
    .map(([name]) => escapeRegex(name))
    .join('|');
  const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');

  const parts: any[] = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIdx) {
      parts.push(textNode(text.slice(lastIdx, match.index), marks));
    }

    // Find the matching entity (case-insensitive)
    const matchedText = match[0];
    const entry = entries.find(
      ([name]) => name.toLowerCase() === matchedText.toLowerCase()
    );

    if (entry) {
      parts.push(wikilinkNode(entry[1]));
    } else {
      // Shouldn't happen, but fallback to text
      parts.push(textNode(matchedText, marks));
    }

    lastIdx = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIdx < text.length) {
    parts.push(textNode(text.slice(lastIdx), marks));
  }

  // If no matches found, return original text node
  if (parts.length === 0) {
    parts.push(textNode(text, marks));
  }

  return parts;
}

function textNode(text: string, marks?: any[]): any {
  const node: any = { type: 'text', text };
  if (marks && marks.length > 0) {
    node.marks = marks;
  }
  return node;
}

function wikilinkNode(target: WikilinkTarget): any {
  return {
    type: 'mention',
    attrs: {
      id: null,
      noteId: null,
      entityId: target.entityId,
      label: target.label,
    },
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
