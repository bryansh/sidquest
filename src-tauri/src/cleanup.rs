use tauri::{AppHandle, Emitter, Manager};

use crate::worker::run_worker;

const MODEL_FILENAME: &str = "google_gemma-3-4b-it-Q4_K_M.gguf";
const MODEL_URL: &str = "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf";

fn model_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(dir.join(MODEL_FILENAME))
}

#[tauri::command]
pub fn check_cleanup_model(app: AppHandle) -> Result<bool, String> {
    let path = model_path(&app)?;
    Ok(path.exists())
}

#[tauri::command]
pub async fn download_cleanup_model(app: AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    use futures_util::StreamExt;

    let path = model_path(&app)?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let response = reqwest::get(MODEL_URL)
        .await
        .map_err(|e| format!("Failed to download model: {}", e))?;

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file = tokio::fs::File::create(&path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;

        downloaded += chunk.len() as u64;
        let _ = window.emit("cleanup-model-progress", serde_json::json!({
            "downloaded": downloaded,
            "total": total,
        }));
    }

    Ok(())
}

#[tauri::command]
pub async fn cleanup_note(
    app: AppHandle,
    text: String,
) -> Result<String, String> {
    let path = model_path(&app)?;
    if !path.exists() {
        return Err("Cleanup model not downloaded".to_string());
    }

    let model_path_str = path.to_string_lossy().to_string();

    tokio::task::spawn_blocking(move || {
        let request = serde_json::json!({
            "model_path": model_path_str,
            "text": text,
        });
        run_worker("cleanup-worker", &request)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
