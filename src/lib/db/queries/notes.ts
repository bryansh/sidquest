import { eq, and, asc, desc } from 'drizzle-orm';
import { db } from '../client';
import { notes } from '../schema';

export async function getNotes(entityId: string) {
  return db.select().from(notes).where(eq(notes.entityId, entityId)).orderBy(asc(notes.createdAt));
}

export async function getNotesByGame(gameId: string) {
  return db.select().from(notes).where(eq(notes.gameId, gameId));
}

export async function createNote(userId: string, gameId: string, entityId: string, title: string, content?: any) {
  const [note] = await db.insert(notes).values({ userId, gameId, entityId, title, content }).returning();
  return note;
}

export async function updateNote(id: string, data: { title?: string; content?: any; sortOrder?: number }) {
  const [note] = await db.update(notes).set({ ...data, updatedAt: new Date() }).where(eq(notes.id, id)).returning();
  return note;
}

export async function getLastModifiedNote(gameId: string) {
  const [note] = await db.select().from(notes).where(eq(notes.gameId, gameId)).orderBy(desc(notes.updatedAt)).limit(1);
  return note ?? null;
}

export async function deleteNote(id: string) {
  await db.delete(notes).where(eq(notes.id, id));
}
