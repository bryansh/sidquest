import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type ModelStatus = 'unknown' | 'checking' | 'missing' | 'downloading' | 'ready';

export const modelState = $state({
  whisper: { status: 'unknown' as ModelStatus, progress: null as number | null },
  cleanup: { status: 'unknown' as ModelStatus, progress: null as number | null },
});

let checked = false;

export async function checkModels() {
  if (checked) return;
  checked = true;

  modelState.whisper.status = 'checking';
  modelState.cleanup.status = 'checking';

  const [whisperReady, cleanupReady] = await Promise.all([
    invoke<boolean>('check_whisper_model').catch(() => false),
    invoke<boolean>('check_cleanup_model').catch(() => false),
  ]);

  modelState.whisper.status = whisperReady ? 'ready' : 'missing';
  modelState.cleanup.status = cleanupReady ? 'ready' : 'missing';
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

export async function downloadCleanupModel() {
  if (modelState.cleanup.status === 'downloading') return;
  modelState.cleanup.status = 'downloading';
  modelState.cleanup.progress = 0;

  const unlisten = await listen<{ downloaded: number; total: number }>('cleanup-model-progress', (event) => {
    const { downloaded, total } = event.payload;
    modelState.cleanup.progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
  });

  try {
    await invoke('download_cleanup_model');
    modelState.cleanup.status = 'ready';
  } catch (e) {
    console.error('[ModelManager] Cleanup download failed:', e);
    modelState.cleanup.status = 'missing';
  } finally {
    unlisten();
    modelState.cleanup.progress = null;
  }
}
