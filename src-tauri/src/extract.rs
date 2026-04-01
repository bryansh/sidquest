use tauri::Manager;

use crate::claude;
use crate::cleanup::resolve_model_info;
use crate::prompts;
use crate::worker::run_worker;

#[tauri::command]
pub async fn extract_entities(
    app: tauri::AppHandle,
    text: String,
    entity_types: Vec<String>,
    provider: String,
    model_id: String,
    filename: Option<String>,
    chat_template: Option<String>,
    context_window: Option<u32>,
    api_key: Option<String>,
) -> Result<String, String> {
    if provider == "cloud" {
        let key = api_key.ok_or("API key required for cloud provider")?;
        let system = prompts::extract_system_prompt(&entity_types);
        let prompt = format!("Session notes:\n{}", text);
        return claude::claude_inference(&key, &system, &prompt).await;
    }

    let (resolved_filename, resolved_template, resolved_ctx) = resolve_model_info(&model_id, filename.as_deref(), chat_template.as_deref(), context_window)?;

    let dir = app.path().app_data_dir().map_err(|e| format!("No app data dir: {}", e))?;
    let model_path = dir.join(&resolved_filename);

    if !model_path.exists() {
        return Err("Model not downloaded. Please download it first.".into());
    }

    let model_path_str = model_path.to_string_lossy().to_string();

    tokio::task::spawn_blocking(move || {
        let request = serde_json::json!({
            "model_path": model_path_str,
            "text": text,
            "mode": "extract",
            "entity_types": entity_types,
            "chat_template": resolved_template,
            "n_ctx": resolved_ctx,
        });
        run_worker("cleanup-worker", &request)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
