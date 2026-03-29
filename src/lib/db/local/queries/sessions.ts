import { getLocalDb } from '../sqlite';
import { notifyWrite } from '$lib/state/syncState.svelte';

interface SessionRow {
  id: string;
  game_id: string;
  user_id: string;
  name: string;
  session_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface SessionNoteRow {
  id: string;
  session_id: string;
  game_id: string;
  user_id: string;
  title: string;
  content: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapSession(row: SessionRow) {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    name: row.name,
    sessionDate: row.session_date,
    sortOrder: row.sort_order,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

function mapSessionNote(row: SessionNoteRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    gameId: row.game_id,
    userId: row.user_id,
    title: row.title,
    content: row.content ? JSON.parse(row.content) : null,
    sortOrder: row.sort_order,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

// Sessions

export async function getSessions(gameId: string) {
  const db = await getLocalDb();
  const rows = await db.select<SessionRow[]>(
    'SELECT * FROM sessions WHERE game_id = ? AND _deleted = 0 ORDER BY session_date DESC, created_at DESC',
    [gameId]
  );
  return rows.map(mapSession);
}

export async function getNextSessionNumber(gameId: string): Promise<number> {
  const db = await getLocalDb();
  const rows = await db.select<{ cnt: number }[]>(
    'SELECT COUNT(*) as cnt FROM sessions WHERE game_id = ? AND _deleted = 0',
    [gameId]
  );
  return (rows[0]?.cnt ?? 0) + 1;
}

export async function createSession(userId: string, gameId: string, name: string, sessionDate?: string) {
  const db = await getLocalDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO sessions (id, user_id, game_id, name, session_date, sort_order, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)',
    [id, userId, gameId, name, sessionDate ?? null, now, now]
  );
  notifyWrite();
  return { id, gameId, userId, name, sessionDate: sessionDate ?? null, sortOrder: 0, createdAt: new Date(now), updatedAt: new Date(now) };
}

export async function updateSession(id: string, data: { name?: string; sessionDate?: string; sortOrder?: number }) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?', '_dirty = 1'];
  const values: any[] = [now];

  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.sessionDate !== undefined) { sets.push('session_date = ?'); values.push(data.sessionDate); }
  if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }

  values.push(id);
  await db.execute(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`, values);

  const rows = await db.select<SessionRow[]>('SELECT * FROM sessions WHERE id = ?', [id]);
  notifyWrite();
  return mapSession(rows[0]);
}

export async function deleteSession(id: string) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  await db.execute('UPDATE session_notes SET _deleted = 1, _dirty = 1, updated_at = ? WHERE session_id = ?', [now, id]);
  await db.execute('UPDATE sessions SET _deleted = 1, _dirty = 1, updated_at = ? WHERE id = ?', [now, id]);
  notifyWrite();
}

// Session Notes

export async function getSessionNotes(sessionId: string) {
  const db = await getLocalDb();
  const rows = await db.select<SessionNoteRow[]>(
    'SELECT * FROM session_notes WHERE session_id = ? AND _deleted = 0 ORDER BY created_at ASC',
    [sessionId]
  );
  return rows.map(mapSessionNote);
}

export async function createSessionNote(userId: string, gameId: string, sessionId: string, title: string, content?: any) {
  const db = await getLocalDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const contentJson = content ? JSON.stringify(content) : null;
  await db.execute(
    'INSERT INTO session_notes (id, user_id, game_id, session_id, title, content, sort_order, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 1)',
    [id, userId, gameId, sessionId, title, contentJson, now, now]
  );
  notifyWrite();
  return { id, sessionId, gameId, userId, title, content: content ?? null, sortOrder: 0, createdAt: new Date(now), updatedAt: new Date(now) };
}

export async function updateSessionNote(id: string, data: { title?: string; content?: any; sortOrder?: number }) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?', '_dirty = 1'];
  const values: any[] = [now];

  if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
  if (data.content !== undefined) { sets.push('content = ?'); values.push(JSON.stringify(data.content)); }
  if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }

  values.push(id);
  await db.execute(`UPDATE session_notes SET ${sets.join(', ')} WHERE id = ?`, values);

  const rows = await db.select<SessionNoteRow[]>('SELECT * FROM session_notes WHERE id = ?', [id]);
  notifyWrite();
  return mapSessionNote(rows[0]);
}

export async function deleteSessionNote(id: string) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  await db.execute('UPDATE session_notes SET _deleted = 1, _dirty = 1, updated_at = ? WHERE id = ?', [now, id]);
  notifyWrite();
}

export async function getLastModifiedSessionNote(gameId: string) {
  const db = await getLocalDb();
  const rows = await db.select<SessionNoteRow[]>(
    'SELECT * FROM session_notes WHERE game_id = ? AND _deleted = 0 ORDER BY updated_at DESC LIMIT 1',
    [gameId]
  );
  return rows.length > 0 ? mapSessionNote(rows[0]) : null;
}
