use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn save_image(
    app: AppHandle,
    game_id: String,
    data: Vec<u8>,
    extension: String,
) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let images_dir = dir.join("images").join(&game_id);
    tokio::fs::create_dir_all(&images_dir)
        .await
        .map_err(|e| format!("Failed to create images directory: {}", e))?;

    let filename = format!("{}.{}", uuid::Uuid::new_v4(), extension);
    let path = images_dir.join(&filename);

    tokio::fs::write(&path, &data)
        .await
        .map_err(|e| format!("Failed to write image: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}
