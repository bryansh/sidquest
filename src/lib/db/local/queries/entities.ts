import { getLocalDb } from '../sqlite';
import { notifyWrite } from '$lib/state/syncState.svelte';

interface EntityTypeRow {
  id: string;
  game_id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  updated_at: string;
}

interface EntityRow {
  id: string;
  game_id: string;
  entity_type_id: string;
  user_id: string;
  name: string;
  summary: string | null;
  tags: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapEntityType(row: EntityTypeRow) {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

function mapEntity(row: EntityRow) {
  return {
    id: row.id,
    gameId: row.game_id,
    entityTypeId: row.entity_type_id,
    userId: row.user_id,
    name: row.name,
    summary: row.summary,
    tags: row.tags ? JSON.parse(row.tags) : null,
    sortOrder: row.sort_order,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

// Entity Types

export async function getEntityTypes(gameId: string) {
  const db = await getLocalDb();
  const rows = await db.select<EntityTypeRow[]>(
    'SELECT * FROM entity_types WHERE game_id = ? AND _deleted = 0',
    [gameId]
  );
  return rows.map(mapEntityType);
}

export async function createEntityType(userId: string, gameId: string, name: string, opts?: { color?: string; icon?: string; sortOrder?: number }) {
  const db = await getLocalDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO entity_types (id, user_id, game_id, name, color, icon, sort_order, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
    [id, userId, gameId, name, opts?.color ?? null, opts?.icon ?? null, opts?.sortOrder ?? 0, now]
  );
  notifyWrite();
  return { id, gameId, userId, name, color: opts?.color ?? null, icon: opts?.icon ?? null, sortOrder: opts?.sortOrder ?? 0, updatedAt: new Date(now) };
}

export async function updateEntityType(id: string, data: { name?: string; color?: string; icon?: string; sortOrder?: number }) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?', '_dirty = 1'];
  const values: any[] = [now];

  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.color !== undefined) { sets.push('color = ?'); values.push(data.color); }
  if (data.icon !== undefined) { sets.push('icon = ?'); values.push(data.icon); }
  if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }

  values.push(id);
  await db.execute(`UPDATE entity_types SET ${sets.join(', ')} WHERE id = ?`, values);

  const rows = await db.select<EntityTypeRow[]>('SELECT * FROM entity_types WHERE id = ?', [id]);
  notifyWrite();
  return mapEntityType(rows[0]);
}

export async function deleteEntityType(id: string) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  // Get entities for this type to cascade their notes/links
  const entities = await db.select<{ id: string }[]>(
    'SELECT id FROM entities WHERE entity_type_id = ? AND _deleted = 0', [id]
  );
  for (const e of entities) {
    await db.execute('UPDATE notes SET _deleted = 1, _dirty = 1, updated_at = ? WHERE entity_id = ?', [now, e.id]);
    await db.execute(
      `UPDATE note_links SET _deleted = 1, _dirty = 1, updated_at = ?
       WHERE source_note_id IN (SELECT id FROM notes WHERE entity_id = ?)
          OR target_note_id IN (SELECT id FROM notes WHERE entity_id = ?)`,
      [now, e.id, e.id]
    );
  }
  await db.execute('UPDATE entities SET _deleted = 1, _dirty = 1, updated_at = ? WHERE entity_type_id = ?', [now, id]);
  await db.execute('UPDATE entity_types SET _deleted = 1, _dirty = 1, updated_at = ? WHERE id = ?', [now, id]);
  notifyWrite();
}

// Entities

export async function getEntities(gameId: string) {
  const db = await getLocalDb();
  const rows = await db.select<EntityRow[]>(
    'SELECT * FROM entities WHERE game_id = ? AND _deleted = 0',
    [gameId]
  );
  return rows.map(mapEntity);
}

export async function createEntity(userId: string, gameId: string, entityTypeId: string, name: string, opts?: { summary?: string; tags?: string[] }) {
  const db = await getLocalDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tagsJson = opts?.tags ? JSON.stringify(opts.tags) : null;
  await db.execute(
    'INSERT INTO entities (id, user_id, game_id, entity_type_id, name, summary, tags, sort_order, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)',
    [id, userId, gameId, entityTypeId, name, opts?.summary ?? null, tagsJson, now, now]
  );
  notifyWrite();
  return { id, gameId, entityTypeId, userId, name, summary: opts?.summary ?? null, tags: opts?.tags ?? null, sortOrder: 0, createdAt: new Date(now), updatedAt: new Date(now) };
}

export async function updateEntity(id: string, data: { name?: string; summary?: string; tags?: string[]; sortOrder?: number }) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?', '_dirty = 1'];
  const values: any[] = [now];

  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.summary !== undefined) { sets.push('summary = ?'); values.push(data.summary); }
  if (data.tags !== undefined) { sets.push('tags = ?'); values.push(JSON.stringify(data.tags)); }
  if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }

  values.push(id);
  await db.execute(`UPDATE entities SET ${sets.join(', ')} WHERE id = ?`, values);

  const rows = await db.select<EntityRow[]>('SELECT * FROM entities WHERE id = ?', [id]);
  notifyWrite();
  return mapEntity(rows[0]);
}

export async function deleteEntity(id: string) {
  const db = await getLocalDb();
  const now = new Date().toISOString();
  await db.execute('UPDATE notes SET _deleted = 1, _dirty = 1, updated_at = ? WHERE entity_id = ?', [now, id]);
  await db.execute(
    `UPDATE note_links SET _deleted = 1, _dirty = 1, updated_at = ?
     WHERE source_note_id IN (SELECT id FROM notes WHERE entity_id = ?)
        OR target_note_id IN (SELECT id FROM notes WHERE entity_id = ?)`,
    [now, id, id]
  );
  await db.execute('UPDATE entities SET _deleted = 1, _dirty = 1, updated_at = ? WHERE id = ?', [now, id]);
  notifyWrite();
}
