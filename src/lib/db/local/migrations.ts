import type Database from '@tauri-apps/plugin-sql';

const CURRENT_VERSION = 1;

export async function runMigrations(db: Database) {
  // Meta table for tracking schema version and sync state
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  const versionRow = await db.select<{ value: string }[]>(
    'SELECT value FROM _meta WHERE key = ?', ['schemaVersion']
  );
  const currentVersion = versionRow.length > 0 ? parseInt(versionRow[0].value, 10) : 0;

  if (currentVersion < 1) {
    await migrateV1(db);
  }

  if (currentVersion < CURRENT_VERSION) {
    await db.execute(
      `INSERT INTO _meta (key, value) VALUES ('schemaVersion', ?)
       ON CONFLICT(key) DO UPDATE SET value = ?`,
      [String(CURRENT_VERSION), String(CURRENT_VERSION)]
    );
  }
}

async function migrateV1(db: Database) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      _dirty INTEGER DEFAULT 0,
      _deleted INTEGER DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS entity_types (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      _dirty INTEGER DEFAULT 0,
      _deleted INTEGER DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      entity_type_id TEXT NOT NULL REFERENCES entity_types(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      summary TEXT,
      tags TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      _dirty INTEGER DEFAULT 0,
      _deleted INTEGER DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      _dirty INTEGER DEFAULT 0,
      _deleted INTEGER DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS note_links (
      id TEXT PRIMARY KEY,
      source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      target_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      _dirty INTEGER DEFAULT 0,
      _deleted INTEGER DEFAULT 0,
      UNIQUE(source_note_id, target_note_id)
    )
  `);

  // Indexes for common queries
  await db.execute('CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_entity_types_game ON entity_types(game_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_entities_game ON entities(game_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_notes_game ON notes(game_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dirty_games ON games(_dirty) WHERE _dirty = 1');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dirty_entity_types ON entity_types(_dirty) WHERE _dirty = 1');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dirty_entities ON entities(_dirty) WHERE _dirty = 1');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dirty_notes ON notes(_dirty) WHERE _dirty = 1');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dirty_note_links ON note_links(_dirty) WHERE _dirty = 1');
}
