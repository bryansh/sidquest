import * as noteQueries from '$lib/db/local/queries/notes';
import { syncNoteLinks } from '$lib/db/local/queries/links';
import { extractWikilinkIds } from '$lib/wikilinks';

export interface Note {
  id: string;
  entityId: string;
  gameId: string;
  title: string;
  content: any; // TipTap JSON
  sortOrder: number;
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
    sortOrder: r.sortOrder ?? 0,
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
    sortOrder: r.sortOrder ?? 0,
  }));
  // Auto-select first note
  noteState.activeNoteId = noteState.notes.length > 0 ? noteState.notes[0].id : null;
}

export async function createNote(userId: string, gameId: string, entityId: string, title: string, opts?: { content?: any; activate?: boolean }) {
  const row = await noteQueries.createNote(userId, gameId, entityId, title, opts?.content);
  const note: Note = {
    id: row.id,
    entityId: row.entityId,
    gameId: row.gameId,
    title: row.title,
    content: row.content,
    sortOrder: row.sortOrder ?? 0,
  };
  noteState.notes = [...noteState.notes, note];
  noteState.allGameNotes = [...noteState.allGameNotes, note];
  if (opts?.activate !== false) {
    noteState.activeNoteId = note.id;
  }
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
  window.dispatchEvent(new CustomEvent('wikilinks-refresh'));
}

export async function deleteNote(noteId: string) {
  await noteQueries.deleteNote(noteId);
  noteState.notes = noteState.notes.filter(n => n.id !== noteId);
  noteState.allGameNotes = noteState.allGameNotes.filter(n => n.id !== noteId);
  if (noteState.activeNoteId === noteId) {
    noteState.activeNoteId = noteState.notes.length > 0 ? noteState.notes[0].id : null;
  }
}

export async function reorderNotes(orderedIds: string[]) {
  const updates: Promise<any>[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const n = noteState.notes.find(note => note.id === orderedIds[i]);
    if (n && n.sortOrder !== i) {
      n.sortOrder = i;
      updates.push(noteQueries.updateNote(n.id, { sortOrder: i }));
    }
  }
  await Promise.all(updates);
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
