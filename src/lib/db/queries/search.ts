import { db } from '../client';
import { notes, entities, entityTypes } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

export interface SearchResult {
  noteId: string;
  noteTitle: string;
  entityName: string;
  typeName: string;
  entityId: string;
  excerpt: string;
}

export async function searchNotes(query: string, gameId: string, userId: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const results = await db
    .select({
      noteId: notes.id,
      noteTitle: notes.title,
      entityName: entities.name,
      typeName: entityTypes.name,
      entityId: entities.id,
      content: notes.content,
    })
    .from(notes)
    .innerJoin(entities, eq(notes.entityId, entities.id))
    .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
    .where(
      and(
        eq(notes.gameId, gameId),
        eq(notes.userId, userId),
        sql`(
          ${notes.title} ILIKE ${'%' + query + '%'}
          OR ${entities.name} ILIKE ${'%' + query + '%'}
          OR ${notes.content}::text ILIKE ${'%' + query + '%'}
        )`,
      )
    )
    .limit(20);

  return results.map(r => ({
    noteId: r.noteId,
    noteTitle: r.noteTitle,
    entityName: r.entityName,
    typeName: r.typeName,
    entityId: r.entityId,
    excerpt: extractExcerpt(r.content, query),
  }));
}

function extractExcerpt(content: any, query: string): string {
  if (!content) return '';
  const text = JSON.stringify(content);
  // Strip JSON structure, keep text content
  const plain = text.replace(/"type":"[^"]*"|"attrs":\{[^}]*\}|[{}[\]"]/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = plain.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return plain.slice(0, 100);
  const start = Math.max(0, idx - 40);
  const end = Math.min(plain.length, idx + query.length + 60);
  return (start > 0 ? '...' : '') + plain.slice(start, end) + (end < plain.length ? '...' : '');
}
