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
