import { getLocalDb } from '../sqlite';

interface EmbeddingRow {
	id: string;
	source_type: string;
	source_id: string;
	game_id: string;
	title: string;
	full_text: string | null;
	embedding: number[];  // SQLite returns BLOB as array
	embedding_dim: number;
	source_updated_at: string | null;
	updated_at: string;
}

export interface NoteEmbedding {
	id: string;
	sourceType: string;
	sourceId: string;
	gameId: string;
	title: string;
	fullText: string | null;
	embedding: Float32Array;
	embeddingDim: number;
}

function mapEmbedding(row: EmbeddingRow): NoteEmbedding {
	// SQLite BLOB comes back as Uint8Array — convert to Float32Array
	const bytes = row.embedding instanceof Uint8Array
		? row.embedding
		: new Uint8Array(row.embedding as any);
	const embedding = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);

	return {
		id: row.id,
		sourceType: row.source_type,
		sourceId: row.source_id,
		gameId: row.game_id,
		title: row.title,
		fullText: row.full_text,
		embedding,
		embeddingDim: row.embedding_dim,
	};
}

export async function getEmbeddings(gameId: string): Promise<NoteEmbedding[]> {
	const db = await getLocalDb();
	const rows = await db.select<EmbeddingRow[]>(
		'SELECT * FROM note_embeddings WHERE game_id = ?',
		[gameId]
	);
	return rows.map(mapEmbedding);
}

export async function upsertEmbedding(
	sourceType: string,
	sourceId: string,
	gameId: string,
	title: string,
	fullText: string | null,
	embedding: Float32Array,
	sourceUpdatedAt: string | null
) {
	const db = await getLocalDb();
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	// Convert Float32Array to Uint8Array for BLOB storage
	const blob = new Uint8Array(embedding.buffer, embedding.byteOffset, embedding.byteLength);
	const blobArray = Array.from(blob);

	await db.execute(
		`INSERT INTO note_embeddings (id, source_type, source_id, game_id, title, full_text, embedding, embedding_dim, source_updated_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, x'${blobArray.map(b => b.toString(16).padStart(2, '0')).join('')}', ?, ?, ?)
		 ON CONFLICT(source_type, source_id) DO UPDATE SET
		   title = excluded.title,
		   full_text = excluded.full_text,
		   embedding = excluded.embedding,
		   source_updated_at = excluded.source_updated_at,
		   updated_at = excluded.updated_at`,
		[id, sourceType, sourceId, gameId, title, fullText, embedding.length, sourceUpdatedAt, now]
	);
}

export interface StaleNote {
	sourceType: string;
	sourceId: string;
	gameId: string;
	title: string;
	content: string | null;
	updatedAt: string;
}

export async function getStaleNotes(gameId: string): Promise<StaleNote[]> {
	const db = await getLocalDb();

	// Entity notes that need embedding (no embedding or note updated since last embed)
	const staleNotes = await db.select<{ source_type: string; source_id: string; game_id: string; title: string; content: string | null; updated_at: string }[]>(
		`SELECT 'note' as source_type, n.id as source_id, n.game_id, n.title, n.content, n.updated_at
		 FROM notes n
		 LEFT JOIN note_embeddings e ON e.source_type = 'note' AND e.source_id = n.id
		 WHERE n.game_id = ? AND n._deleted = 0 AND n.content IS NOT NULL
		   AND (e.id IS NULL OR e.source_updated_at < n.updated_at OR e.full_text IS NULL OR e.full_text = '')
		 UNION ALL
		 SELECT 'session_note' as source_type, sn.id as source_id, sn.game_id, sn.title, sn.content, sn.updated_at
		 FROM session_notes sn
		 LEFT JOIN note_embeddings e ON e.source_type = 'session_note' AND e.source_id = sn.id
		 WHERE sn.game_id = ? AND sn._deleted = 0 AND sn.content IS NOT NULL
		   AND (e.id IS NULL OR e.source_updated_at < sn.updated_at OR e.full_text IS NULL OR e.full_text = '')`,
		[gameId, gameId]
	);

	return staleNotes.map(r => ({
		sourceType: r.source_type,
		sourceId: r.source_id,
		gameId: r.game_id,
		title: r.title,
		content: r.content,
		updatedAt: r.updated_at,
	}));
}

export async function getEmbeddingCount(gameId: string): Promise<number> {
	const db = await getLocalDb();
	const rows = await db.select<{ count: number }[]>(
		'SELECT COUNT(*) as count FROM note_embeddings WHERE game_id = ?',
		[gameId]
	);
	return rows[0]?.count ?? 0;
}

export async function deleteEmbeddingsForGame(gameId: string) {
	const db = await getLocalDb();
	await db.execute('DELETE FROM note_embeddings WHERE game_id = ?', [gameId]);
}

/** Recreate the embeddings table with the correct schema */
export async function recreateEmbeddingsTable() {
	const db = await getLocalDb();
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
