import { getLocalDb } from '../sqlite';
import { notifyWrite } from '$lib/state/syncState.svelte';

interface NoteRow {
  id: string;
  entity_id: string;
  game_id: string;
  user_id: string;
  title: string;
  content: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapNote(row: NoteRow) {
  return {
    id: row.id,
    entityId: row.entity_id,
    gameId: row.game_id,
    userId: row.user_id,
    title: row.title,
    content: row.content ? JSON.parse(row.content) : null,
    sortOrder: row.sort_order,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

export async function getNotes(entityId: string) {
  const db = await getLocalDb();
  const rows = await db.select<NoteRow[]>(
    'SELECT * FROM notes WHERE entity_id = ? AND _deleted = 0 ORDER BY created_at ASC',
    [entityId]
  );
  return rows.map(mapNote);
}

export async function getNotesByGame(gameId: string) {
  const db = await getLocalDb();
  const rows = await db.select<NoteRow[]>(
    'SELECT * FROM notes WHERE game_id = ? AND _deleted = 0',
    [gameId]
  );
  return rows.map(mapNote);
}

export async function createNote(userId: string, gameId: string, entityId: string, title: string, content?: any) {
  const db = await getLocalDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const contentJson = content ? JSON.stringify(content) : null;
  await db.execute(
    'INSERT INTO notes (id, user_id, game_id, entity_id, title, content, sort_order, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 1)',
    [id, userId, gameId, entityId, title, contentJson, now, now]
  );
  notifyWrite();
  return { id, entityId, gameId, userId, title, content: content ?? null, sortOrder: 0, createdAt: new Date(now), updatedAt: new Date(now) };
}

export async function updateNote(id: string, data: { title?: string; content?: any; sortOrder?: number }) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?', '_dirty = 1'];
  const values: any[] = [now];

  if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
  if (data.content !== undefined) { sets.push('content = ?'); values.push(JSON.stringify(data.content)); }
  if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }

  values.push(id);
  await db.execute(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, values);

  const rows = await db.select<NoteRow[]>('SELECT * FROM notes WHERE id = ?', [id]);
  notifyWrite();
  return mapNote(rows[0]);
}

export async function getLastModifiedNote(gameId: string) {
  const db = await getLocalDb();
  const rows = await db.select<NoteRow[]>(
    'SELECT * FROM notes WHERE game_id = ? AND _deleted = 0 ORDER BY updated_at DESC LIMIT 1',
    [gameId]
  );
  return rows.length > 0 ? mapNote(rows[0]) : null;
}

export async function deleteNote(id: string) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE note_links SET _deleted = 1, _dirty = 1, updated_at = ?
     WHERE source_note_id = ? OR target_note_id = ?`,
    [now, id, id]
  );
  await db.execute('UPDATE notes SET _deleted = 1, _dirty = 1, updated_at = ? WHERE id = ?', [now, id]);
  notifyWrite();
}
