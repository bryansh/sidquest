use tauri::Manager;

use crate::claude;
use crate::models::get_model_by_id;
use crate::prompts;
use crate::worker::run_worker;

#[tauri::command]
pub async fn extract_entities(
    app: tauri::AppHandle,
    text: String,
    entity_types: Vec<String>,
    provider: String,
    model_id: String,
    api_key: Option<String>,
) -> Result<String, String> {
    if provider == "cloud" {
        let key = api_key.ok_or("API key required for cloud provider")?;
        let system = prompts::extract_system_prompt(&entity_types);
        let prompt = format!("Session notes:\n{}", text);
        return claude::claude_inference(&key, &system, &prompt).await;
    }

    // Local model
    let model = get_model_by_id(&model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No app data dir: {}", e))?;
    let model_path = data_dir.join(model.filename);

    if !model_path.exists() {
        return Err("Model not downloaded. Please download it first.".into());
    }

    let model_path_str = model_path.to_string_lossy().to_string();
    let chat_template = model.chat_template.to_string();
    let context_window = model.context_window;

    tokio::task::spawn_blocking(move || {
        let request = serde_json::json!({
            "model_path": model_path_str,
            "text": text,
            "mode": "extract",
            "entity_types": entity_types,
            "chat_template": chat_template,
            "n_ctx": context_window,
        });
        run_worker("cleanup-worker", &request)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
