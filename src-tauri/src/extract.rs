use tauri::Manager;

use crate::worker::run_worker;

const MODEL_FILENAME: &str = "google_gemma-3-4b-it-Q4_K_M.gguf";

#[tauri::command]
pub async fn extract_entities(
    app: tauri::AppHandle,
    text: String,
    entity_types: Vec<String>,
) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No app data dir: {}", e))?;
    let model_path = data_dir.join(MODEL_FILENAME);

    if !model_path.exists() {
        return Err("Cleanup model not found. Please download it first.".into());
    }

    let model_path_str = model_path.to_string_lossy().to_string();

    tokio::task::spawn_blocking(move || {
        let request = serde_json::json!({
            "model_path": model_path_str,
            "text": text,
            "mode": "extract",
            "entity_types": entity_types,
        });
        run_worker("cleanup-worker", &request)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
