import { getLocalDb } from '../local/sqlite';
import { db } from '../client';
import { games, entityTypes, entities, notes, noteLinks } from '../schema';

export async function hydrateIfNeeded(userId: string): Promise<boolean> {
  const localDb = await getLocalDb();

  // Check if we already have data
  const meta = await localDb.select<{ value: string }[]>(
    'SELECT value FROM _meta WHERE key = ?', ['lastSyncAt']
  );
  if (meta.length > 0) {
    console.log('[Hydrate] Already hydrated, skipping');
    return false;
  }

  console.log('[Hydrate] First run — pulling data from Neon...');

  try {
    // Pull all data in FK order
    const remoteGames = await db.select().from(games);
    const remoteTypes = await db.select().from(entityTypes);
    const remoteEntities = await db.select().from(entities);
    const remoteNotes = await db.select().from(notes);
    const remoteLinks = await db.select().from(noteLinks);

    // Insert games
    for (const g of remoteGames) {
      await localDb.execute(
        'INSERT OR IGNORE INTO games (id, user_id, name, description, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [g.id, g.userId, g.name, g.description, g.createdAt?.toISOString() ?? null, g.updatedAt?.toISOString() ?? new Date().toISOString()]
      );
    }

    // Insert entity types
    for (const et of remoteTypes) {
      await localDb.execute(
        'INSERT OR IGNORE INTO entity_types (id, game_id, user_id, name, color, icon, sort_order, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
        [et.id, et.gameId, et.userId, et.name, et.color, et.icon, et.sortOrder ?? 0, et.updatedAt?.toISOString() ?? new Date().toISOString()]
      );
    }

    // Insert entities
    for (const e of remoteEntities) {
      const tagsJson = e.tags ? JSON.stringify(e.tags) : null;
      await localDb.execute(
        'INSERT OR IGNORE INTO entities (id, game_id, entity_type_id, user_id, name, summary, tags, sort_order, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
        [e.id, e.gameId, e.entityTypeId, e.userId, e.name, e.summary, tagsJson, e.sortOrder ?? 0, e.createdAt?.toISOString() ?? null, e.updatedAt?.toISOString() ?? null]
      );
    }

    // Insert notes
    for (const n of remoteNotes) {
      const contentJson = n.content ? JSON.stringify(n.content) : null;
      await localDb.execute(
        'INSERT OR IGNORE INTO notes (id, entity_id, game_id, user_id, title, content, sort_order, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
        [n.id, n.entityId, n.gameId, n.userId, n.title, contentJson, n.sortOrder ?? 0, n.createdAt?.toISOString() ?? null, n.updatedAt?.toISOString() ?? null]
      );
    }

    // Insert note links
    for (const l of remoteLinks) {
      await localDb.execute(
        'INSERT OR IGNORE INTO note_links (id, source_note_id, target_note_id, game_id, user_id, created_at, updated_at, _dirty) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
        [l.id, l.sourceNoteId, l.targetNoteId, l.gameId, l.userId, l.createdAt?.toISOString() ?? null, l.updatedAt?.toISOString() ?? new Date().toISOString()]
      );
    }

    // Mark hydration complete
    const now = new Date().toISOString();
    await localDb.execute(
      `INSERT INTO _meta (key, value) VALUES ('lastSyncAt', ?)
       ON CONFLICT(key) DO UPDATE SET value = ?`,
      [now, now]
    );

    console.log(`[Hydrate] Done — ${remoteGames.length} games, ${remoteTypes.length} types, ${remoteEntities.length} entities, ${remoteNotes.length} notes, ${remoteLinks.length} links`);
    return true;
  } catch (e) {
    console.error('[Hydrate] Failed to pull from Neon (offline?):', e);
    // Not a fatal error — user can still use the app with empty local DB
    // Set lastSyncAt so we don't retry every launch
    return false;
  }
}
