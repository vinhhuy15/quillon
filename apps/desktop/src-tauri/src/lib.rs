//! SciForge desktop shell. The application itself is the web frontend in `../src`;
//! this crate only provides the native window, file dialogs and file-system access.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running SciForge");
}
