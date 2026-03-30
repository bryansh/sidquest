import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { settings } from './settingsState.svelte';

export type ModelStatus = 'unknown' | 'checking' | 'missing' | 'downloading' | 'ready';

interface ModelEntry {
  status: ModelStatus;
  progress: number | null;
}

export const modelState = $state({
  whisper: { status: 'unknown' as ModelStatus, progress: null as number | null },
  localModels: {} as Record<string, ModelEntry>,
});

/** Get status of the currently selected local model */
export function getActiveLocalModel(): ModelEntry {
  const id = settings.localModelId;
  return modelState.localModels[id] ?? { status: 'unknown', progress: null };
}

let whisperChecked = false;

export async function checkModels() {
  // Check whisper once
  if (!whisperChecked) {
    whisperChecked = true;
    modelState.whisper.status = 'checking';
    const whisperReady = await invoke<boolean>('check_whisper_model').catch(() => false);
    modelState.whisper.status = whisperReady ? 'ready' : 'missing';
  }

  // Check the currently selected local model
  await checkLocalModel(settings.localModelId);
}

export async function checkLocalModel(modelId: string) {
  if (!modelState.localModels[modelId]) {
    modelState.localModels[modelId] = { status: 'unknown', progress: null };
  }
  modelState.localModels[modelId].status = 'checking';

  const ready = await invoke<boolean>('check_local_model', { modelId }).catch(() => false);
  modelState.localModels[modelId].status = ready ? 'ready' : 'missing';
}

export async function downloadLocalModel(modelId: string) {
  if (!modelState.localModels[modelId]) {
    modelState.localModels[modelId] = { status: 'unknown', progress: null };
  }
  if (modelState.localModels[modelId].status === 'downloading') return;

  modelState.localModels[modelId].status = 'downloading';
  modelState.localModels[modelId].progress = 0;

  const unlisten = await listen<{ modelId: string; downloaded: number; total: number }>('local-model-progress', (event) => {
    const { modelId: id, downloaded, total } = event.payload;
    if (modelState.localModels[id]) {
      modelState.localModels[id].progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
    }
  });

  try {
    await invoke('download_local_model', { modelId });
    modelState.localModels[modelId].status = 'ready';
  } catch (e) {
    console.error(`[ModelManager] Download failed for ${modelId}:`, e);
    modelState.localModels[modelId].status = 'missing';
  } finally {
    unlisten();
    modelState.localModels[modelId].progress = null;
  }
}

export async function downloadWhisperModel() {
  if (modelState.whisper.status === 'downloading') return;
  modelState.whisper.status = 'downloading';
  modelState.whisper.progress = 0;

  const unlisten = await listen<{ downloaded: number; total: number }>('whisper-model-progress', (event) => {
    const { downloaded, total } = event.payload;
    modelState.whisper.progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
  });

  try {
    await invoke('download_whisper_model');
    modelState.whisper.status = 'ready';
  } catch (e) {
    console.error('[ModelManager] Whisper download failed:', e);
    modelState.whisper.status = 'missing';
  } finally {
    unlisten();
    modelState.whisper.progress = null;
  }
}

const EMBEDDING_MODEL_ID = 'snowflake-arctic-embed-110m';

export function getEmbeddingModel(): ModelEntry {
  return modelState.localModels[EMBEDDING_MODEL_ID] ?? { status: 'unknown', progress: null };
}

export async function checkEmbeddingModel() {
  return checkLocalModel(EMBEDDING_MODEL_ID);
}

export async function downloadEmbeddingModel() {
  return downloadLocalModel(EMBEDDING_MODEL_ID);
}

export async function ensureEmbeddingModel(): Promise<boolean> {
  const entry = getEmbeddingModel();
  if (entry.status === 'ready') return true;
  if (entry.status === 'unknown') await checkEmbeddingModel();
  const updated = getEmbeddingModel();
  if (updated.status === 'ready') return true;
  if (updated.status === 'missing') {
    await downloadEmbeddingModel();
    return getEmbeddingModel().status === 'ready';
  }
  return false;
}

// Backward compat
export async function downloadCleanupModel() {
  return downloadLocalModel(settings.localModelId);
}
