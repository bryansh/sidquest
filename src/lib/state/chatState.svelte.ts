import { invoke } from '@tauri-apps/api/core';
import { gameState } from './gameState.svelte';
import { settings } from './settingsState.svelte';
import { ensureEmbeddingModel, getActiveLocalModel } from './modelState.svelte';
import { getStaleNotes, upsertEmbedding, getEmbeddings, getEmbeddingCount, deleteEmbeddingsForGame, recreateEmbeddingsTable, type NoteEmbedding } from '$lib/db/local/queries/embeddings';

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export const chatState = $state({
	open: false,
	messages: {} as Record<string, ChatMessage[]>,
	embeddingStatus: 'idle' as 'idle' | 'indexing' | 'ready' | 'error',
	embeddingCount: 0,
	thinking: false,
});

function getGameMessages(): ChatMessage[] {
	const gameId = gameState.activeGameId;
	if (!gameId) return [];
	if (!chatState.messages[gameId]) chatState.messages[gameId] = [];
	return chatState.messages[gameId];
}

export function openChat() {
	chatState.open = true;
	indexNotes();
}

export function closeChat() {
	chatState.open = false;
}

export function clearChat() {
	const gameId = gameState.activeGameId;
	if (gameId) chatState.messages[gameId] = [];
}

export async function reindexNotes() {
	const gameId = gameState.activeGameId;
	if (!gameId) return;
	// Recreate table to handle schema changes
	await recreateEmbeddingsTable();
	chatState.embeddingCount = 0;
	chatState.embeddingStatus = 'idle';
	await indexNotes();
}

/** Extract plain text from TipTap JSON content */
function extractText(content: string | null): string {
	if (!content) return '';
	try {
		const doc = typeof content === 'string' ? JSON.parse(content) : content;
		return walkNodes(doc);
	} catch {
		return content?.replace(/"type":"[^"]*"|"attrs":\{[^}]*\}|[{}[\]"]/g, ' ').trim() ?? '';
	}
}

function walkNodes(node: any): string {
	if (!node) return '';
	if (node.type === 'text') return node.text || '';
	if (node.type === 'wikilink') return node.attrs?.label || '';
	if (!node.content) return node.type === 'hardBreak' ? '\n' : '';
	const inner = node.content.map(walkNodes).join('');
	if (['paragraph', 'heading', 'blockquote', 'listItem'].includes(node.type)) return inner + '\n';
	return inner;
}

/** Index notes that need embedding */
async function indexNotes() {
	const gameId = gameState.activeGameId;
	if (!gameId) return;

	chatState.embeddingStatus = 'indexing';

	try {
		// Ensure embedding model is available
		const modelReady = await ensureEmbeddingModel();
		if (!modelReady) {
			chatState.embeddingStatus = 'error';
			return;
		}

		// Get notes that need embedding (recreate table if schema is outdated)
		let stale;
		try {
			stale = await getStaleNotes(gameId);
		} catch (e) {
			console.log('[Chat] Embeddings table schema mismatch, recreating...');
			await recreateEmbeddingsTable();
			stale = await getStaleNotes(gameId);
		}
		console.log(`[Chat] Found ${stale.length} stale notes to embed`);
		for (const n of stale.slice(0, 5)) {
			const text = extractText(n.content);
			console.log(`[Chat] Note "${n.title}" (${n.sourceType}): content=${n.content?.length ?? 0} chars, extracted=${text.length} chars, preview="${text.slice(0, 80)}..."`);
		}
		chatState.embeddingCount = await getEmbeddingCount(gameId);

		if (stale.length === 0) {
			chatState.embeddingStatus = 'ready';
			return;
		}

		// Extract text and prepare for embedding
		const textsToEmbed: { sourceType: string; sourceId: string; title: string; text: string; updatedAt: string }[] = [];
		for (const note of stale) {
			const text = extractText(note.content);
			if (text.trim().length < 10) continue; // Skip very short notes
			textsToEmbed.push({
				sourceType: note.sourceType,
				sourceId: note.sourceId,
				title: note.title,
				text: `${note.title}\n${text}`,
				updatedAt: note.updatedAt,
			});
		}

		if (textsToEmbed.length === 0) {
			chatState.embeddingStatus = 'ready';
			return;
		}

		// Batch embed (in chunks of 10 to avoid overwhelming the worker)
		const BATCH_SIZE = 10;
		for (let i = 0; i < textsToEmbed.length; i += BATCH_SIZE) {
			const batch = textsToEmbed.slice(i, i + BATCH_SIZE);
			const texts = batch.map(t => t.text);

			const resultJson = await invoke<string>('embed_texts', { texts });
			const embeddings: number[][] = JSON.parse(resultJson);

			for (let j = 0; j < batch.length; j++) {
				const item = batch[j];
				const embedding = new Float32Array(embeddings[j]);
				await upsertEmbedding(
					item.sourceType,
					item.sourceId,
					gameId,
					item.title,
					item.text,
					embedding,
					item.updatedAt
				);
			}
		}

		chatState.embeddingCount = await getEmbeddingCount(gameId);
		chatState.embeddingStatus = 'ready';
	} catch (e) {
		console.error('[Chat] Indexing failed:', e);
		chatState.embeddingStatus = 'error';
	}
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0, magA = 0, magB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		magA += a[i] * a[i];
		magB += b[i] * b[i];
	}
	const mag = Math.sqrt(magA) * Math.sqrt(magB);
	return mag > 0 ? dot / mag : 0;
}

/** Retrieve top-K relevant notes for a query */
async function retrieveContext(gameId: string, queryEmbedding: Float32Array, topK: number = 5): Promise<NoteEmbedding[]> {
	const allEmbeddings = await getEmbeddings(gameId);

	const scored = allEmbeddings.map(e => ({
		...e,
		score: cosineSimilarity(queryEmbedding, e.embedding),
	}));

	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, topK);
}

export async function sendMessage(query: string) {
	const gameId = gameState.activeGameId;
	if (!gameId || !query.trim()) return;

	const messages = getGameMessages();
	messages.push({ role: 'user', content: query });
	chatState.thinking = true;

	try {
		// Embed the query (with query prefix for asymmetric search)
		const resultJson = await invoke<string>('embed_texts', { texts: [query], isQuery: true });
		const embeddings: number[][] = JSON.parse(resultJson);
		const queryEmbedding = new Float32Array(embeddings[0]);

		// Retrieve relevant notes
		const relevant = await retrieveContext(gameId, queryEmbedding, 5);

		// Debug: log retrieved notes and scores
		console.log('[Chat] Retrieved notes for query:', query);
		for (const r of relevant) {
			console.log(`[Chat]   score=${(r as any).score?.toFixed(4)} title="${r.title}" text="${(r.fullText || '').slice(0, 80)}..."`);
		}

		// Build context string from full note text
		const context = relevant
			.map(r => `---\n${r.fullText || r.title}`)
			.join('\n');
		console.log(`[Chat] Context length: ${context.length} chars`);

		// Call RAG chat
		const answer = await invoke<string>('rag_chat', {
			context,
			query,
			provider: settings.aiProvider,
			modelId: settings.localModelId,
			apiKey: settings.aiProvider === 'cloud' ? settings.claudeApiKey : null,
		});

		messages.push({ role: 'assistant', content: answer });
	} catch (e) {
		console.error('[Chat] Error:', e);
		messages.push({ role: 'assistant', content: `Error: ${e}` });
	} finally {
		chatState.thinking = false;
	}
}
