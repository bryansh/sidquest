import { getLocalDb } from '../sqlite';
import { notifyWrite } from '$lib/state/syncState.svelte';

interface BacklinkRow {
  id: string;
  source_note_id: string;
  source_note_title: string;
  source_entity_name: string;
  source_entity_type_name: string;
}

export async function getBacklinks(noteId: string) {
  const db = await getLocalDb();
  const rows = await db.select<BacklinkRow[]>(
    `SELECT nl.id, nl.source_note_id, n.title AS source_note_title,
            e.name AS source_entity_name, et.name AS source_entity_type_name
     FROM note_links nl
     INNER JOIN notes n ON nl.source_note_id = n.id
     INNER JOIN entities e ON n.entity_id = e.id
     INNER JOIN entity_types et ON e.entity_type_id = et.id
     WHERE nl.target_note_id = ? AND nl._deleted = 0 AND n._deleted = 0`,
    [noteId]
  );
  return rows.map(r => ({
    id: r.id,
    sourceNoteId: r.source_note_id,
    sourceNoteTitle: r.source_note_title,
    sourceEntityName: r.source_entity_name,
    sourceEntityTypeName: r.source_entity_type_name,
  }));
}

export async function syncNoteLinks(sourceNoteId: string, targetNoteIds: string[], gameId: string, userId: string) {
  const db = await getLocalDb();
  const now = new Date().toISOString();

  // Soft-delete existing links from this source
  await db.execute(
    'UPDATE note_links SET _deleted = 1, _dirty = 1, updated_at = ? WHERE source_note_id = ? AND _deleted = 0',
    [now, sourceNoteId]
  );

  // Insert new links
  for (const targetNoteId of targetNoteIds) {
    const id = crypto.randomUUID();
    await db.execute(
      `INSERT INTO note_links (id, source_note_id, target_note_id, game_id, user_id, created_at, updated_at, _dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(source_note_id, target_note_id) DO UPDATE SET _deleted = 0, _dirty = 1, updated_at = ?`,
      [id, sourceNoteId, targetNoteId, gameId, userId, now, now, now]
    );
  }
  notifyWrite();
}
