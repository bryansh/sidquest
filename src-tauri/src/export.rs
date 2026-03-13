/// Save a text file to a given path
#[tauri::command]
pub async fn save_export_file(
    path: String,
    contents: String,
) -> Result<(), String> {
    tokio::fs::write(&path, contents.as_bytes())
        .await
        .map_err(|e| format!("Failed to write file: {}", e))
}

/// Save a binary file (base64-encoded) to a given path
#[tauri::command]
pub async fn save_export_file_binary(
    path: String,
    base64_data: String,
) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Invalid base64: {}", e))?;
    tokio::fs::write(&path, &bytes)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))
}
