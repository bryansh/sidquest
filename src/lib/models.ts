export interface LocalModelDef {
	id: string;
	name: string;
	filename: string;
	url: string;
	size_bytes: number;
	context_window: number;
	chat_template: string;
	model_type: string;
	embedding_dim: number | null;
	custom?: boolean;
}

export type AIProvider = 'local' | 'cloud';

export const CHAT_TEMPLATES = [
	{ id: 'gemma3', name: 'Gemma 3' },
	{ id: 'llama3', name: 'Llama 3 / Qwen' },
	{ id: 'chatml', name: 'ChatML (Mistral, Phi)' },
];

export function formatBytes(bytes: number): string {
	if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
	if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
	return `${bytes} B`;
}

/** Get extra params needed for custom model invoke calls */
export function getModelInvokeParams(model: LocalModelDef | undefined): Record<string, string | number | null> {
	if (!model || !model.custom) return {};
	return {
		filename: model.filename,
		chatTemplate: model.chat_template,
		contextWindow: model.context_window,
	};
}

export function filenameFromUrl(url: string): string {
	try {
		const path = new URL(url).pathname;
		return path.split('/').pop() ?? 'model.gguf';
	} catch {
		return url.split('/').pop() ?? 'model.gguf';
	}
}
