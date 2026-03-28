import type Database from '@tauri-apps/plugin-sql';
import { getLocalDb } from '../local/sqlite';
import { db } from '../client';
import { games, entityTypes, entities, notes, noteLinks } from '../schema';
import { eq, gt } from 'drizzle-orm';

interface DirtyRow {
  id: string;
  _deleted: number;
  [key: string]: any;
}

export async function pushChanges(): Promise<number> {
  const localDb = await getLocalDb();
  let pushed = 0;

  // Push in FK order: games → entityTypes → entities → notes → noteLinks
  pushed += await pushGames(localDb);
  pushed += await pushEntityTypes(localDb);
  pushed += await pushEntities(localDb);
  pushed += await pushNotes(localDb);
  pushed += await pushNoteLinks(localDb);

  return pushed;
}

async function pushGames(localDb: Database): Promise<number> {
  const rows = await localDb.select<DirtyRow[]>(
    'SELECT * FROM games WHERE _dirty = 1'
  );
  for (const row of rows) {
    try {
      if (row._deleted) {
        await db.delete(games).where(eq(games.id, row.id));
        await localDb.execute('DELETE FROM games WHERE id = ?', [row.id]);
      } else {
        await db.insert(games).values({
          id: row.id,
          userId: row.user_id,
          name: row.name,
          description: row.description,
          createdAt: row.created_at ? new Date(row.created_at) : new Date(),
          updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        }).onConflictDoUpdate({
          target: games.id,
          set: {
            name: row.name,
            description: row.description,
            updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
          },
        });
        await localDb.execute('UPDATE games SET _dirty = 0 WHERE id = ?', [row.id]);
      }
    } catch (e) {
      console.error('[Sync] Failed to push game', row.id, e);
    }
  }
  return rows.length;
}

async function pushEntityTypes(localDb: Database): Promise<number> {
  const rows = await localDb.select<DirtyRow[]>(
    'SELECT * FROM entity_types WHERE _dirty = 1'
  );
  for (const row of rows) {
    try {
      if (row._deleted) {
        await db.delete(entityTypes).where(eq(entityTypes.id, row.id));
        await localDb.execute('DELETE FROM entity_types WHERE id = ?', [row.id]);
      } else {
        await db.insert(entityTypes).values({
          id: row.id,
          gameId: row.game_id,
          userId: row.user_id,
          name: row.name,
          color: row.color,
          icon: row.icon,
          sortOrder: row.sort_order,
          updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        }).onConflictDoUpdate({
          target: entityTypes.id,
          set: {
            name: row.name,
            color: row.color,
            icon: row.icon,
            sortOrder: row.sort_order,
            updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
          },
        });
        await localDb.execute('UPDATE entity_types SET _dirty = 0 WHERE id = ?', [row.id]);
      }
    } catch (e) {
      console.error('[Sync] Failed to push entity type', row.id, e);
    }
  }
  return rows.length;
}

async function pushEntities(localDb: Database): Promise<number> {
  const rows = await localDb.select<DirtyRow[]>(
    'SELECT * FROM entities WHERE _dirty = 1'
  );
  for (const row of rows) {
    try {
      if (row._deleted) {
        await db.delete(entities).where(eq(entities.id, row.id));
        await localDb.execute('DELETE FROM entities WHERE id = ?', [row.id]);
      } else {
        const tags = row.tags ? JSON.parse(row.tags) : null;
        await db.insert(entities).values({
          id: row.id,
          gameId: row.game_id,
          entityTypeId: row.entity_type_id,
          userId: row.user_id,
          name: row.name,
          summary: row.summary,
          tags,
          sortOrder: row.sort_order,
          createdAt: row.created_at ? new Date(row.created_at) : new Date(),
          updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        }).onConflictDoUpdate({
          target: entities.id,
          set: {
            name: row.name,
            summary: row.summary,
            tags,
            sortOrder: row.sort_order,
            updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
          },
        });
        await localDb.execute('UPDATE entities SET _dirty = 0 WHERE id = ?', [row.id]);
      }
    } catch (e) {
      console.error('[Sync] Failed to push entity', row.id, e);
    }
  }
  return rows.length;
}

async function pushNotes(localDb: Database): Promise<number> {
  const rows = await localDb.select<DirtyRow[]>(
    'SELECT * FROM notes WHERE _dirty = 1'
  );
  for (const row of rows) {
    try {
      if (row._deleted) {
        await db.delete(notes).where(eq(notes.id, row.id));
        await localDb.execute('DELETE FROM notes WHERE id = ?', [row.id]);
      } else {
        const content = row.content ? JSON.parse(row.content) : null;
        await db.insert(notes).values({
          id: row.id,
          entityId: row.entity_id,
          gameId: row.game_id,
          userId: row.user_id,
          title: row.title,
          content,
          sortOrder: row.sort_order,
          createdAt: row.created_at ? new Date(row.created_at) : new Date(),
          updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        }).onConflictDoUpdate({
          target: notes.id,
          set: {
            title: row.title,
            content,
            sortOrder: row.sort_order,
            updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
          },
        });
        await localDb.execute('UPDATE notes SET _dirty = 0 WHERE id = ?', [row.id]);
      }
    } catch (e) {
      console.error('[Sync] Failed to push note', row.id, e);
    }
  }
  return rows.length;
}

async function pushNoteLinks(localDb: Database): Promise<number> {
  const rows = await localDb.select<DirtyRow[]>(
    'SELECT * FROM note_links WHERE _dirty = 1'
  );
  for (const row of rows) {
    try {
      if (row._deleted) {
        await db.delete(noteLinks).where(eq(noteLinks.id, row.id));
        await localDb.execute('DELETE FROM note_links WHERE id = ?', [row.id]);
      } else {
        await db.insert(noteLinks).values({
          id: row.id,
          sourceNoteId: row.source_note_id,
          targetNoteId: row.target_note_id,
          gameId: row.game_id,
          userId: row.user_id,
          createdAt: row.created_at ? new Date(row.created_at) : new Date(),
          updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        }).onConflictDoUpdate({
          target: noteLinks.id,
          set: {
            sourceNoteId: row.source_note_id,
            targetNoteId: row.target_note_id,
            updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
          },
        });
        await localDb.execute('UPDATE note_links SET _dirty = 0 WHERE id = ?', [row.id]);
      }
    } catch (e) {
      console.error('[Sync] Failed to push note link', row.id, e);
    }
  }
  return rows.length;
}

export async function pullChanges(): Promise<number> {
  const localDb = await getLocalDb();
  let pulled = 0;

  const meta = await localDb.select<{ value: string }[]>(
    'SELECT value FROM _meta WHERE key = ?', ['lastSyncAt']
  );
  const lastSync = meta.length > 0 ? new Date(meta[0].value) : new Date(0);

  // Pull in FK order
  pulled += await pullTable(localDb, 'games', games, lastSync, (r) => [
    r.id, r.userId, r.name, r.description,
    r.createdAt?.toISOString() ?? null,
    r.updatedAt?.toISOString() ?? new Date().toISOString(),
  ], 'INSERT OR REPLACE INTO games (id, user_id, name, description, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, 0)');

  pulled += await pullTable(localDb, 'entity_types', entityTypes, lastSync, (r) => [
    r.id, r.gameId, r.userId, r.name, r.color, r.icon, r.sortOrder ?? 0,
    r.updatedAt?.toISOString() ?? new Date().toISOString(),
  ], 'INSERT OR REPLACE INTO entity_types (id, game_id, user_id, name, color, icon, sort_order, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)');

  pulled += await pullTable(localDb, 'entities', entities, lastSync, (r) => [
    r.id, r.gameId, r.entityTypeId, r.userId, r.name, r.summary,
    r.tags ? JSON.stringify(r.tags) : null, r.sortOrder ?? 0,
    r.createdAt?.toISOString() ?? null,
    r.updatedAt?.toISOString() ?? null,
  ], 'INSERT OR REPLACE INTO entities (id, game_id, entity_type_id, user_id, name, summary, tags, sort_order, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)');

  pulled += await pullTable(localDb, 'notes', notes, lastSync, (r) => [
    r.id, r.entityId, r.gameId, r.userId, r.title,
    r.content ? JSON.stringify(r.content) : null, r.sortOrder ?? 0,
    r.createdAt?.toISOString() ?? null,
    r.updatedAt?.toISOString() ?? null,
  ], 'INSERT OR REPLACE INTO notes (id, entity_id, game_id, user_id, title, content, sort_order, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)');

  pulled += await pullTable(localDb, 'note_links', noteLinks, lastSync, (r) => [
    r.id, r.sourceNoteId, r.targetNoteId, r.gameId, r.userId,
    r.createdAt?.toISOString() ?? null,
    r.updatedAt?.toISOString() ?? new Date().toISOString(),
  ], 'INSERT OR REPLACE INTO note_links (id, source_note_id, target_note_id, game_id, user_id, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, ?, 0)');

  // Update lastSyncAt
  const now = new Date().toISOString();
  await localDb.execute(
    `INSERT INTO _meta (key, value) VALUES ('lastSyncAt', ?)
     ON CONFLICT(key) DO UPDATE SET value = ?`,
    [now, now]
  );

  return pulled;
}

async function pullTable(localDb: Database, tableName: string, table: any, lastSync: Date, mapValues: (r: any) => any[], insertSql: string): Promise<number> {
  try {
    const rows = await db.select().from(table).where(gt(table.updatedAt, lastSync));
    for (const r of rows) {
      // Skip if local version is dirty (local wins)
      const local = await localDb.select<{ _dirty: number }[]>(
        `SELECT _dirty FROM ${tableName} WHERE id = ?`, [r.id]
      );
      if (local.length > 0 && local[0]._dirty === 1) continue;

      await localDb.execute(insertSql, mapValues(r));
    }
    return rows.length;
  } catch (e) {
    console.error(`[Sync] Failed to pull ${tableName}:`, e);
    return 0;
  }
}

export async function getPendingCount(): Promise<number> {
  const localDb = await getLocalDb();
  const tables = ['games', 'entity_types', 'entities', 'notes', 'note_links'];
  let total = 0;
  for (const t of tables) {
    const rows = await localDb.select<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM ${t} WHERE _dirty = 1`
    );
    total += rows[0]?.cnt ?? 0;
  }
  return total;
}
