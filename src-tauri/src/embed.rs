use tauri::Manager;

use crate::claude;
use crate::models::{get_embedding_model, get_model_by_id};
use crate::prompts;
use crate::worker::run_worker;

/// Embed a batch of texts using the embedding model.
/// Returns a JSON array of float arrays: [[0.1, -0.2, ...], [0.3, ...]]
#[tauri::command]
pub async fn embed_texts(
    app: tauri::AppHandle,
    texts: Vec<String>,
    is_query: Option<bool>,
) -> Result<String, String> {
    let model = get_embedding_model();
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No app data dir: {}", e))?;
    let model_path = data_dir.join(model.filename);

    if !model_path.exists() {
        return Err("Embedding model not downloaded".into());
    }

    let model_path_str = model_path.to_string_lossy().to_string();
    let ctx = model.context_window;
    let query_flag = is_query.unwrap_or(false);

    tokio::task::spawn_blocking(move || {
        let request = serde_json::json!({
            "model_path": model_path_str,
            "text": "",
            "mode": "embed",
            "texts": texts,
            "n_ctx": ctx,
            "is_query": query_flag,
        });
        run_worker("cleanup-worker", &request)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// RAG chat: takes pre-built context (from frontend retrieval) and a question,
/// routes to local model or Claude API for generation.
#[tauri::command]
pub async fn rag_chat(
    app: tauri::AppHandle,
    context: String,
    query: String,
    provider: String,
    model_id: String,
    api_key: Option<String>,
) -> Result<String, String> {
    let system = prompts::rag_chat_system_prompt();
    let user_message = format!(
        "Here are the relevant game notes:\n{}\n\n---\nQuestion: {}",
        context, query
    );

    if provider == "cloud" {
        let key = api_key.ok_or("API key required for cloud provider")?;
        return claude::claude_inference(&key, &system, &user_message).await;
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
        return Err("Model not downloaded".into());
    }

    let model_path_str = model_path.to_string_lossy().to_string();
    let chat_template = model.chat_template.to_string();
    let context_window = model.context_window;

    tokio::task::spawn_blocking(move || {
        let request = serde_json::json!({
            "model_path": model_path_str,
            "text": user_message,
            "mode": "chat",
            "chat_template": chat_template,
            "n_ctx": context_window,
            "system_prompt": system,
        });
        run_worker("cleanup-worker", &request)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
