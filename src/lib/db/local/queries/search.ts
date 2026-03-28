import { getLocalDb } from '../sqlite';

export interface SearchResult {
  noteId: string;
  noteTitle: string;
  entityName: string;
  typeName: string;
  entityId: string;
  excerpt: string;
}

interface SearchRow {
  note_id: string;
  note_title: string;
  entity_name: string;
  type_name: string;
  entity_id: string;
  content: string | null;
}

export async function searchNotes(query: string, gameId: string, userId: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const db = await getLocalDb();
  const pattern = `%${query}%`;

  const rows = await db.select<SearchRow[]>(
    `SELECT n.id AS note_id, n.title AS note_title, e.name AS entity_name,
            et.name AS type_name, e.id AS entity_id, n.content
     FROM notes n
     INNER JOIN entities e ON n.entity_id = e.id
     INNER JOIN entity_types et ON e.entity_type_id = et.id
     WHERE n.game_id = ? AND n.user_id = ? AND n._deleted = 0 AND e._deleted = 0
       AND (n.title LIKE ? COLLATE NOCASE
            OR e.name LIKE ? COLLATE NOCASE
            OR n.content LIKE ? COLLATE NOCASE)
     LIMIT 20`,
    [gameId, userId, pattern, pattern, pattern]
  );

  return rows.map(r => ({
    noteId: r.note_id,
    noteTitle: r.note_title,
    entityName: r.entity_name,
    typeName: r.type_name,
    entityId: r.entity_id,
    excerpt: extractExcerpt(r.content, query),
  }));
}

function extractExcerpt(content: string | null, query: string): string {
  if (!content) return '';
  const text = content;
  const plain = text.replace(/"type":"[^"]*"|"attrs":\{[^}]*\}|[{}[\]"]/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = plain.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return plain.slice(0, 100);
  const start = Math.max(0, idx - 40);
  const end = Math.min(plain.length, idx + query.length + 60);
  return (start > 0 ? '...' : '') + plain.slice(start, end) + (end < plain.length ? '...' : '');
}
