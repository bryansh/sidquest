import type Database from '@tauri-apps/plugin-sql';

const CURRENT_VERSION = 4;

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
  if (currentVersion < 2) {
    await migrateV2(db);
  }
  if (currentVersion < 3) {
    await migrateV3(db);
  }
  if (currentVersion < 4) {
    await migrateV4(db);
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

async function migrateV2(db: Database) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      session_date TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      _dirty INTEGER DEFAULT 0,
      _deleted INTEGER DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS session_notes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
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

  await db.execute('CREATE INDEX IF NOT EXISTS idx_sessions_game ON sessions(game_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_session_notes_session ON session_notes(session_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_session_notes_game ON session_notes(game_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dirty_sessions ON sessions(_dirty) WHERE _dirty = 1');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_dirty_session_notes ON session_notes(_dirty) WHERE _dirty = 1');
}

async function migrateV3(db: Database) {
  // Drop old embeddings table if it exists (schema changed: text_preview -> full_text)
  await db.execute('DROP TABLE IF EXISTS note_embeddings');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS note_embeddings (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      title TEXT NOT NULL,
      full_text TEXT,
      embedding BLOB NOT NULL,
      embedding_dim INTEGER NOT NULL,
      source_updated_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_source ON note_embeddings(source_type, source_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_embeddings_game ON note_embeddings(game_id)');
}

async function migrateV4(db: Database) {
  // Force re-index: drop and recreate with full_text column
  await db.execute('DROP TABLE IF EXISTS note_embeddings');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS note_embeddings (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      title TEXT NOT NULL,
      full_text TEXT,
      embedding BLOB NOT NULL,
      embedding_dim INTEGER NOT NULL,
      source_updated_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_source ON note_embeddings(source_type, source_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_embeddings_game ON note_embeddings(game_id)');
}
