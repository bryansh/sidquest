import { getLocalDb } from '../sqlite';
import { notifyWrite } from '$lib/state/syncState.svelte';

interface GameRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function mapGame(row: GameRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

export async function getGames(userId: string) {
  const db = await getLocalDb();
  const rows = await db.select<GameRow[]>(
    'SELECT * FROM games WHERE user_id = ? AND _deleted = 0',
    [userId]
  );
  return rows.map(mapGame);
}

export async function createGame(userId: string, name: string, description?: string) {
  const db = await getLocalDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO games (id, user_id, name, description, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, 1)',
    [id, userId, name, description ?? null, now, now]
  );
  notifyWrite();
  return { id, userId, name, description: description ?? null, createdAt: new Date(now), updatedAt: new Date(now) };
}

export async function updateGame(id: string, data: { name?: string; description?: string }) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?', '_dirty = 1'];
  const values: any[] = [now];

  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description); }

  values.push(id);
  await db.execute(`UPDATE games SET ${sets.join(', ')} WHERE id = ?`, values);

  const rows = await db.select<GameRow[]>('SELECT * FROM games WHERE id = ?', [id]);
  notifyWrite();
  return mapGame(rows[0]);
}

export async function deleteGame(id: string) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  await db.execute('UPDATE games SET _deleted = 1, _dirty = 1, updated_at = ? WHERE id = ?', [now, id]);
  // Cascade soft-delete children
  await db.execute('UPDATE entity_types SET _deleted = 1, _dirty = 1, updated_at = ? WHERE game_id = ?', [now, id]);
  await db.execute('UPDATE entities SET _deleted = 1, _dirty = 1, updated_at = ? WHERE game_id = ?', [now, id]);
  await db.execute('UPDATE notes SET _deleted = 1, _dirty = 1, updated_at = ? WHERE game_id = ?', [now, id]);
  await db.execute('UPDATE note_links SET _deleted = 1, _dirty = 1, updated_at = ? WHERE game_id = ?', [now, id]);
  notifyWrite();
}
