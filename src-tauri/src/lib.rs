mod claude;
mod cleanup;
mod dictation;
mod embed;
mod export;
mod extract;
mod images;
mod models;
mod prompts;
mod worker;

use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(dictation::RecordingState::new())
        .invoke_handler(tauri::generate_handler![
            dictation::start_recording,
            dictation::stop_recording,
            dictation::get_recording_status,
            dictation::transcribe,
            dictation::check_whisper_model,
            dictation::download_whisper_model,
            cleanup::check_cleanup_model,
            cleanup::download_cleanup_model,
            cleanup::check_local_model,
            cleanup::download_local_model,
            cleanup::delete_local_model,
            cleanup::download_custom_model,
            cleanup::delete_custom_model,
            cleanup::check_custom_model,
            cleanup::cleanup_note,
            images::save_image,
            export::save_export_file,
            export::save_export_file_binary,
            extract::extract_entities,
            models::get_available_models,
            models::get_all_models,
            models::get_embedding_model_info,
            claude::test_claude_api,
            embed::embed_texts,
            embed::rag_chat,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Build tray menu
            let show = MenuItemBuilder::with_id("show", "Show Sidquest")
                .build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit")
                .build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show)
                .separator()
                .item(&quit)
                .build()?;

            // Create tray icon
            let icon = app.default_window_icon().cloned().expect("no default icon");

            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("Sidquest")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => toggle_window(app),
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Show the window on first launch
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide instead of close
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
