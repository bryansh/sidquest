import { eq } from 'drizzle-orm';
import { db } from '../client';
import { games } from '../schema';

export async function getGames(userId: string) {
  return db.select().from(games).where(eq(games.userId, userId));
}

export async function createGame(userId: string, name: string, description?: string) {
  const [game] = await db.insert(games).values({ userId, name, description }).returning();
  return game;
}

export async function updateGame(id: string, data: { name?: string; description?: string }) {
  const [game] = await db.update(games).set(data).where(eq(games.id, id)).returning();
  return game;
}

export async function deleteGame(id: string) {
  await db.delete(games).where(eq(games.id, id));
}
