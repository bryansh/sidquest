use std::io::Write;
use tauri::{AppHandle, Emitter, Manager};

const MODEL_FILENAME: &str = "qwen2.5-3b-instruct-q4_k_m.gguf";
const MODEL_URL: &str = "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf";

fn model_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(dir.join(MODEL_FILENAME))
}

fn worker_binary_path() -> Result<std::path::PathBuf, String> {
    // Check env var override (useful for dev)
    if let Ok(path) = std::env::var("CLEANUP_WORKER_PATH") {
        return Ok(path.into());
    }

    // Same directory as current executable (works for both workspace dev builds and bundled releases)
    let exe = std::env::current_exe()
        .map_err(|e| format!("Cannot find current exe: {}", e))?;
    let dir = exe.parent().ok_or("No parent dir for executable")?;
    let worker = dir.join("cleanup-worker");
    if worker.exists() {
        return Ok(worker);
    }

    Err(format!("cleanup-worker binary not found in {}", dir.display()))
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
    let worker_path = worker_binary_path()?;

    // Spawn the cleanup worker as a separate process to avoid GGML symbol conflicts with whisper-rs
    let result = tokio::task::spawn_blocking(move || {
        let request = serde_json::json!({
            "model_path": model_path_str,
            "text": text,
        });

        let mut child = std::process::Command::new(&worker_path)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn cleanup worker: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            serde_json::to_writer(&mut stdin, &request)
                .map_err(|e| format!("Failed to write to worker: {}", e))?;
            stdin.flush().map_err(|e| format!("Failed to flush stdin: {}", e))?;
        }

        let output = child
            .wait_with_output()
            .map_err(|e| format!("Worker failed: {}", e))?;

        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.is_empty() {
            eprintln!("[cleanup] Worker stderr: {}", stderr);
        }

        if output.stdout.is_empty() {
            return Err(format!("Worker produced no output. stderr: {}", stderr));
        }

        let response: serde_json::Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("Failed to parse worker output: {}. stdout: {}", e, String::from_utf8_lossy(&output.stdout)))?;

        if response["ok"].as_bool() == Some(true) {
            response["result"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or("Worker returned ok but no result".to_string())
        } else {
            Err(response["error"]
                .as_str()
                .unwrap_or("Unknown worker error")
                .to_string())
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(result)
}
