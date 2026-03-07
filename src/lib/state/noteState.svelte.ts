import * as noteQueries from '$lib/db/queries/notes';

export interface Note {
  id: string;
  entityId: string;
  gameId: string;
  title: string;
  content: any; // TipTap JSON
}

export const noteState = $state<{
  activeEntityId: string | null;
  activeNoteId: string | null;
  notes: Note[];
}>({
  activeEntityId: null,
  activeNoteId: null,
  notes: [],
});

export async function selectEntity(entityId: string) {
  noteState.activeEntityId = entityId;
  const rows = await noteQueries.getNotes(entityId);
  noteState.notes = rows.map(r => ({
    id: r.id,
    entityId: r.entityId,
    gameId: r.gameId,
    title: r.title,
    content: r.content,
  }));
  // Auto-select first note
  noteState.activeNoteId = noteState.notes.length > 0 ? noteState.notes[0].id : null;
}

export async function createNote(userId: string, gameId: string, entityId: string, title: string) {
  const row = await noteQueries.createNote(userId, gameId, entityId, title);
  const note: Note = {
    id: row.id,
    entityId: row.entityId,
    gameId: row.gameId,
    title: row.title,
    content: row.content,
  };
  noteState.notes = [...noteState.notes, note];
  noteState.activeNoteId = note.id;
  return note;
}

export async function updateNoteContent(noteId: string, content: any) {
  await noteQueries.updateNote(noteId, { content });
  const note = noteState.notes.find(n => n.id === noteId);
  if (note) note.content = content;
}
