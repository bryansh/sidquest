import * as gameQueries from '$lib/db/queries/games';
import * as entityQueries from '$lib/db/queries/entities';
import { restoreLastNote, loadAllGameNotes, noteState } from '$lib/state/noteState.svelte';

export interface Game {
  id: string;
  name: string;
  description: string | null;
}

export interface EntityType {
  id: string;
  gameId: string;
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
}

export interface Entity {
  id: string;
  gameId: string;
  entityTypeId: string;
  name: string;
  summary: string | null;
  tags: string[];
}

export const gameState = $state<{
  games: Game[];
  activeGameId: string | null;
  entityTypes: EntityType[];
  entities: Entity[];
}>({
  games: [],
  activeGameId: null,
  entityTypes: [],
  entities: [],
});

export async function loadGames(userId: string) {
  const rows = await gameQueries.getGames(userId);
  gameState.games = rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
  }));
  // Auto-select first game if none selected
  if (!gameState.activeGameId && gameState.games.length > 0) {
    await selectGame(gameState.games[0].id, true);
  }
}

export async function selectGame(gameId: string, restore = false) {
  gameState.activeGameId = gameId;
  await loadGameData(gameId);
  if (restore) {
    await restoreLastNote(gameId);
  }
}

async function loadGameData(gameId: string) {
  const [types, ents] = await Promise.all([
    entityQueries.getEntityTypes(gameId),
    entityQueries.getEntities(gameId),
    loadAllGameNotes(gameId),
  ]);
  gameState.entityTypes = types.map(r => ({
    id: r.id,
    gameId: r.gameId,
    name: r.name,
    color: r.color,
    icon: r.icon,
    sortOrder: r.sortOrder ?? 0,
  }));
  gameState.entities = ents.map(r => ({
    id: r.id,
    gameId: r.gameId,
    entityTypeId: r.entityTypeId,
    name: r.name,
    summary: r.summary,
    tags: r.tags ?? [],
  }));
}

export async function createGame(userId: string, name: string, description?: string) {
  const row = await gameQueries.createGame(userId, name, description);
  gameState.games = [...gameState.games, { id: row.id, name: row.name, description: row.description }];
  await selectGame(row.id);
  return row;
}

export async function createEntityType(userId: string, name: string, opts?: { color?: string; icon?: string }) {
  if (!gameState.activeGameId) return;
  const row = await entityQueries.createEntityType(userId, gameState.activeGameId, name, opts);
  gameState.entityTypes = [...gameState.entityTypes, {
    id: row.id,
    gameId: row.gameId,
    name: row.name,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sortOrder ?? 0,
  }];
  return row;
}

export async function deleteEntity(entityId: string) {
  await entityQueries.deleteEntity(entityId);
  gameState.entities = gameState.entities.filter(e => e.id !== entityId);
  // Prune notes belonging to deleted entity
  noteState.allGameNotes = noteState.allGameNotes.filter(n => n.entityId !== entityId);
  if (noteState.activeEntityId === entityId) {
    noteState.activeEntityId = null;
    noteState.activeNoteId = null;
    noteState.notes = [];
  }
}

export async function deleteGameById(gameId: string) {
  await gameQueries.deleteGame(gameId);
  gameState.games = gameState.games.filter(g => g.id !== gameId);
  if (gameState.activeGameId === gameId) {
    gameState.activeGameId = null;
    gameState.entityTypes = [];
    gameState.entities = [];
    noteState.activeEntityId = null;
    noteState.activeNoteId = null;
    noteState.notes = [];
    noteState.allGameNotes = [];
    // Auto-select next game if available
    if (gameState.games.length > 0) {
      await selectGame(gameState.games[0].id);
    }
  }
}

export async function createEntity(userId: string, entityTypeId: string, name: string, opts?: { summary?: string }) {
  if (!gameState.activeGameId) return;
  const row = await entityQueries.createEntity(userId, gameState.activeGameId, entityTypeId, name, opts);
  gameState.entities = [...gameState.entities, {
    id: row.id,
    gameId: row.gameId,
    entityTypeId: row.entityTypeId,
    name: row.name,
    summary: row.summary,
    tags: row.tags ?? [],
  }];
  return row;
}
