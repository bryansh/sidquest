use tauri::{AppHandle, Emitter, Manager};

use crate::claude;
use crate::models::get_model_by_id;
use crate::prompts;
use crate::worker::run_worker;

fn model_path(app: &AppHandle, model_id: &str) -> Result<std::path::PathBuf, String> {
    let model = get_model_by_id(model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(dir.join(model.filename))
}

#[tauri::command]
pub fn check_local_model(app: AppHandle, model_id: String) -> Result<bool, String> {
    let path = model_path(&app, &model_id)?;
    Ok(path.exists())
}

#[tauri::command]
pub async fn download_custom_model(app: AppHandle, window: tauri::WebviewWindow, url: String, filename: String) -> Result<(), String> {
    use futures_util::StreamExt;

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let path = dir.join(&filename);

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    if total > 0 && total < 1000 {
        return Err(format!("File too small ({}B) — URL may be invalid", total));
    }

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
        let _ = window.emit("custom-model-progress", serde_json::json!({
            "filename": filename,
            "downloaded": downloaded,
            "total": total,
        }));
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_custom_model(app: AppHandle, filename: String) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let path = dir.join(&filename);
    if path.exists() {
        tokio::fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to delete: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn check_custom_model(app: AppHandle, filename: String) -> Result<bool, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(dir.join(&filename).exists())
}

#[tauri::command]
pub async fn delete_local_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let path = model_path(&app, &model_id)?;
    if path.exists() {
        tokio::fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to delete model: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn download_local_model(app: AppHandle, window: tauri::WebviewWindow, model_id: String) -> Result<(), String> {
    use futures_util::StreamExt;

    let model = get_model_by_id(&model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;
    let path = model_path(&app, &model_id)?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let response = reqwest::get(model.url)
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
        let _ = window.emit("local-model-progress", serde_json::json!({
            "modelId": model_id,
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
    provider: String,
    model_id: String,
    api_key: Option<String>,
) -> Result<String, String> {
    if provider == "cloud" {
        let key = api_key.ok_or("API key required for cloud provider")?;
        let system = prompts::cleanup_system_prompt();
        return claude::claude_inference(&key, &system, &text).await;
    }

    // Local model
    let model = get_model_by_id(&model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;
    let path = model_path(&app, &model_id)?;
    if !path.exists() {
        return Err("Model not downloaded".to_string());
    }

    let model_path_str = path.to_string_lossy().to_string();
    let chat_template = model.chat_template.to_string();
    let context_window = model.context_window;

    tokio::task::spawn_blocking(move || {
        let request = serde_json::json!({
            "model_path": model_path_str,
            "text": text,
            "chat_template": chat_template,
            "n_ctx": context_window,
        });
        run_worker("cleanup-worker", &request)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// Backward compat wrappers for existing check/download commands
#[tauri::command]
pub fn check_cleanup_model(app: AppHandle) -> Result<bool, String> {
    check_local_model(app, "gemma3-4b".to_string())
}

#[tauri::command]
pub async fn download_cleanup_model(app: AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    download_local_model(app, window, "gemma3-4b".to_string()).await
}
