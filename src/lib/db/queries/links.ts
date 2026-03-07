import { eq, and } from 'drizzle-orm';
import { db } from '../client';
import { noteLinks, notes, entities, entityTypes } from '../schema';

export async function getBacklinks(noteId: string) {
  return db
    .select({
      id: noteLinks.id,
      sourceNoteId: noteLinks.sourceNoteId,
      sourceNoteTitle: notes.title,
      sourceEntityName: entities.name,
      sourceEntityTypeName: entityTypes.name,
    })
    .from(noteLinks)
    .innerJoin(notes, eq(noteLinks.sourceNoteId, notes.id))
    .innerJoin(entities, eq(notes.entityId, entities.id))
    .innerJoin(entityTypes, eq(entities.entityTypeId, entityTypes.id))
    .where(eq(noteLinks.targetNoteId, noteId));
}

export async function syncNoteLinks(sourceNoteId: string, targetNoteIds: string[], gameId: string, userId: string) {
  // Delete existing links from this source
  await db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, sourceNoteId));

  // Insert new links
  if (targetNoteIds.length > 0) {
    await db.insert(noteLinks).values(
      targetNoteIds.map(targetNoteId => ({
        sourceNoteId,
        targetNoteId,
        gameId,
        userId,
      }))
    );
  }
}
