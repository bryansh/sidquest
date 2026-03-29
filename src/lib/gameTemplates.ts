export interface GameTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  types: { name: string; icon: string; color: string }[];
}

export const gameTemplates: GameTemplate[] = [
  {
    id: 'ttrpg',
    name: 'Tabletop RPG',
    icon: '🎲',
    description: 'D&D, Pathfinder, and other TTRPGs',
    types: [
      { name: 'NPCs', icon: '👤', color: '#7c6ff5' },
      { name: 'Locations', icon: '🗺️', color: '#3b82f6' },
      { name: 'Items', icon: '⚔️', color: '#22c55e' },
      { name: 'Factions', icon: '🏰', color: '#f97316' },
      { name: 'Quests', icon: '📜', color: '#ec4899' },
    ],
  },
  {
    id: 'mystery',
    name: 'Mystery',
    icon: '🔍',
    description: 'Detective, crime, and investigation games',
    types: [
      { name: 'Suspects', icon: '🕵️', color: '#ef4444' },
      { name: 'Evidence', icon: '🔬', color: '#22c55e' },
      { name: 'Locations', icon: '📍', color: '#3b82f6' },
      { name: 'Witnesses', icon: '👁️', color: '#f97316' },
      { name: 'Motives', icon: '💭', color: '#7c6ff5' },
    ],
  },
  {
    id: 'boardgame',
    name: 'Board Game',
    icon: '♟️',
    description: 'Strategy, euro, and party games',
    types: [
      { name: 'Players', icon: '🎮', color: '#3b82f6' },
      { name: 'Strategies', icon: '🧠', color: '#7c6ff5' },
      { name: 'Rules', icon: '📖', color: '#f97316' },
    ],
  },
  {
    id: 'videogame',
    name: 'Video Game',
    icon: '🕹️',
    description: 'RPGs, open world, and story-driven games',
    types: [
      { name: 'Characters', icon: '👤', color: '#7c6ff5' },
      { name: 'Zones', icon: '🌍', color: '#3b82f6' },
      { name: 'Equipment', icon: '🛡️', color: '#22c55e' },
      { name: 'Abilities', icon: '✨', color: '#ec4899' },
      { name: 'Storylines', icon: '📖', color: '#f97316' },
    ],
  },
  {
    id: 'wargame',
    name: 'Wargame',
    icon: '⚔️',
    description: 'Miniatures, hex-and-counter, and tactical games',
    types: [
      { name: 'Units', icon: '🪖', color: '#22c55e' },
      { name: 'Territories', icon: '🗺️', color: '#3b82f6' },
      { name: 'Battles', icon: '💥', color: '#ef4444' },
      { name: 'Commanders', icon: '⭐', color: '#f97316' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: '✏️',
    description: 'Start blank and add your own entity types',
    types: [],
  },
];
