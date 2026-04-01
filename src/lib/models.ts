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
}

export type AIProvider = 'local' | 'cloud';

export function formatBytes(bytes: number): string {
	if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
	if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
	return `${bytes} B`;
}
