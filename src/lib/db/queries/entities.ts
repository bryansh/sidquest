import { eq, and } from 'drizzle-orm';
import { db } from '../client';
import { entityTypes, entities } from '../schema';

export async function getEntityTypes(gameId: string) {
  return db.select().from(entityTypes).where(eq(entityTypes.gameId, gameId));
}

export async function createEntityType(userId: string, gameId: string, name: string, opts?: { color?: string; icon?: string; sortOrder?: number }) {
  const [et] = await db.insert(entityTypes).values({ userId, gameId, name, ...opts }).returning();
  return et;
}

export async function updateEntityType(id: string, data: { name?: string; color?: string; icon?: string; sortOrder?: number }) {
  const [et] = await db.update(entityTypes).set(data).where(eq(entityTypes.id, id)).returning();
  return et;
}

export async function deleteEntityType(id: string) {
  await db.delete(entityTypes).where(eq(entityTypes.id, id));
}

export async function getEntities(gameId: string) {
  return db.select().from(entities).where(eq(entities.gameId, gameId));
}

export async function createEntity(userId: string, gameId: string, entityTypeId: string, name: string, opts?: { summary?: string; tags?: string[] }) {
  const [entity] = await db.insert(entities).values({ userId, gameId, entityTypeId, name, ...opts }).returning();
  return entity;
}

export async function updateEntity(id: string, data: { name?: string; summary?: string; tags?: string[]; sortOrder?: number }) {
  const [entity] = await db.update(entities).set({ ...data, updatedAt: new Date() }).where(eq(entities.id, id)).returning();
  return entity;
}

export async function deleteEntity(id: string) {
  await db.delete(entities).where(eq(entities.id, id));
}
