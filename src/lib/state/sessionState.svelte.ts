import * as sessionQueries from '$lib/db/local/queries/sessions';
import { noteState } from '$lib/state/noteState.svelte';

export interface Session {
  id: string;
  gameId: string;
  name: string;
  sessionDate: string | null;
  sortOrder: number;
}

export interface SessionNote {
  id: string;
  sessionId: string;
  gameId: string;
  title: string;
  content: any;
  sortOrder: number;
}

export const sessionState = $state<{
  sessions: Session[];
  activeSessionId: string | null;
  activeSessionNoteId: string | null;
  sessionNotes: SessionNote[];
}>({
  sessions: [],
  activeSessionId: null,
  activeSessionNoteId: null,
  sessionNotes: [],
});

export function clearActiveSession() {
  sessionState.activeSessionId = null;
  sessionState.activeSessionNoteId = null;
  sessionState.sessionNotes = [];
}

export async function loadSessions(gameId: string) {
  const rows = await sessionQueries.getSessions(gameId);
  sessionState.sessions = rows.map(r => ({
    id: r.id,
    gameId: r.gameId,
    name: r.name,
    sessionDate: r.sessionDate,
    sortOrder: r.sortOrder ?? 0,
  }));
}

export async function selectSession(sessionId: string) {
  // Clear entity selection (mutual exclusivity)
  noteState.activeEntityId = null;
  noteState.activeNoteId = null;
  noteState.notes = [];

  sessionState.activeSessionId = sessionId;
  const rows = await sessionQueries.getSessionNotes(sessionId);
  sessionState.sessionNotes = rows.map(r => ({
    id: r.id,
    sessionId: r.sessionId,
    gameId: r.gameId,
    title: r.title,
    content: r.content,
    sortOrder: r.sortOrder ?? 0,
  }));
  sessionState.activeSessionNoteId = sessionState.sessionNotes.length > 0 ? sessionState.sessionNotes[0].id : null;
}

export async function createSession(userId: string, gameId: string) {
  const num = await sessionQueries.getNextSessionNumber(gameId);
  const today = new Date().toISOString().split('T')[0];
  const name = `Session ${num}`;
  const row = await sessionQueries.createSession(userId, gameId, name, today);
  const session: Session = {
    id: row.id,
    gameId: row.gameId,
    name: row.name,
    sessionDate: row.sessionDate,
    sortOrder: row.sortOrder ?? 0,
  };
  sessionState.sessions = [session, ...sessionState.sessions];
  await selectSession(session.id);
  return session;
}

export async function renameSession(sessionId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await sessionQueries.updateSession(sessionId, { name: trimmed });
  const session = sessionState.sessions.find(s => s.id === sessionId);
  if (session) session.name = trimmed;
}

export async function deleteSession(sessionId: string) {
  await sessionQueries.deleteSession(sessionId);
  sessionState.sessions = sessionState.sessions.filter(s => s.id !== sessionId);
  if (sessionState.activeSessionId === sessionId) {
    sessionState.activeSessionId = null;
    sessionState.activeSessionNoteId = null;
    sessionState.sessionNotes = [];
  }
}

export async function createSessionNote(userId: string, gameId: string, sessionId: string, title: string, opts?: { content?: any; activate?: boolean }) {
  const row = await sessionQueries.createSessionNote(userId, gameId, sessionId, title, opts?.content);
  const note: SessionNote = {
    id: row.id,
    sessionId: row.sessionId,
    gameId: row.gameId,
    title: row.title,
    content: row.content,
    sortOrder: row.sortOrder ?? 0,
  };
  sessionState.sessionNotes = [...sessionState.sessionNotes, note];
  if (opts?.activate !== false) {
    sessionState.activeSessionNoteId = note.id;
  }
  return note;
}

export async function renameSessionNote(noteId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await sessionQueries.updateSessionNote(noteId, { title: trimmed });
  const note = sessionState.sessionNotes.find(n => n.id === noteId);
  if (note) note.title = trimmed;
}

export async function updateSessionNoteContent(noteId: string, content: any) {
  await sessionQueries.updateSessionNote(noteId, { content });
  const note = sessionState.sessionNotes.find(n => n.id === noteId);
  if (note) note.content = content;
}

export async function deleteSessionNote(noteId: string) {
  await sessionQueries.deleteSessionNote(noteId);
  sessionState.sessionNotes = sessionState.sessionNotes.filter(n => n.id !== noteId);
  if (sessionState.activeSessionNoteId === noteId) {
    sessionState.activeSessionNoteId = sessionState.sessionNotes.length > 0 ? sessionState.sessionNotes[0].id : null;
  }
}

export async function reorderSessionNotes(orderedIds: string[]) {
  const updates: Promise<any>[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const n = sessionState.sessionNotes.find(note => note.id === orderedIds[i]);
    if (n && n.sortOrder !== i) {
      n.sortOrder = i;
      updates.push(sessionQueries.updateSessionNote(n.id, { sortOrder: i }));
    }
  }
  await Promise.all(updates);
}
