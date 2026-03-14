import { pgTable, uuid, text, jsonb, timestamp, integer, unique } from 'drizzle-orm/pg-core';

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const entityTypes = pgTable('entity_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  icon: text('icon'),
  sortOrder: integer('sort_order').default(0),
});

export const entities = pgTable('entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  entityTypeId: uuid('entity_type_id').references(() => entityTypes.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  summary: text('summary'),
  tags: text('tags').array(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }).notNull(),
  gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  content: jsonb('content'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const noteLinks = pgTable('note_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceNoteId: uuid('source_note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  targetNoteId: uuid('target_note_id').references(() => notes.id, { onDelete: 'cascade' }).notNull(),
  gameId: uuid('game_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique().on(table.sourceNoteId, table.targetNoteId),
]);
