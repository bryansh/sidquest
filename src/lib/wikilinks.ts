// Extract wikilink target note IDs from TipTap JSON
export function extractWikilinkIds(doc: any): string[] {
  const ids: Set<string> = new Set();

  function walk(node: any) {
    if (node.type === 'wikilink' && node.attrs?.noteId) {
      ids.add(node.attrs.noteId);
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  if (doc) walk(doc);
  return [...ids];
}
