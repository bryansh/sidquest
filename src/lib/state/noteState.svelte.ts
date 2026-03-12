import * as noteQueries from '$lib/db/queries/notes';
import { syncNoteLinks } from '$lib/db/queries/links';
import { extractWikilinkIds } from '$lib/wikilinks';

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
  allGameNotes: Note[];
}>({
  activeEntityId: null,
  activeNoteId: null,
  notes: [],
  allGameNotes: [],
});

export async function loadAllGameNotes(gameId: string) {
  const rows = await noteQueries.getNotesByGame(gameId);
  noteState.allGameNotes = rows.map(r => ({
    id: r.id,
    entityId: r.entityId,
    gameId: r.gameId,
    title: r.title,
    content: r.content,
  }));
}

export async function restoreLastNote(gameId: string) {
  const note = await noteQueries.getLastModifiedNote(gameId);
  if (note) {
    await selectEntity(note.entityId);
    noteState.activeNoteId = note.id;
  }
}

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
  noteState.allGameNotes = [...noteState.allGameNotes, note];
  noteState.activeNoteId = note.id;
  return note;
}

export async function renameNote(noteId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await noteQueries.updateNote(noteId, { title: trimmed });
  const note = noteState.notes.find(n => n.id === noteId);
  if (note) note.title = trimmed;
  const gameNote = noteState.allGameNotes.find(n => n.id === noteId);
  if (gameNote) gameNote.title = trimmed;
}

export async function updateNoteContent(noteId: string, content: any, userId?: string, gameId?: string) {
  await noteQueries.updateNote(noteId, { content });
  const note = noteState.notes.find(n => n.id === noteId);
  if (note) note.content = content;

  // Sync wikilinks
  const targetIds = extractWikilinkIds(content);
  const nGameId = gameId || note?.gameId;
  if (nGameId && userId) {
    await syncNoteLinks(noteId, targetIds, nGameId, userId);
  }
}
