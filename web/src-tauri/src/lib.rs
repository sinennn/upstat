//! Upstat desktop shell: a native window around the static web build
//! (`npm run build:desktop` → `../out`). The web app talks to the backend
//! over gRPC-Web itself; the shell only adds native capabilities.

mod oauth;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // links that leave the app open in the system browser
    .plugin(tauri_plugin_opener::init())
    // OS notifications when a monitor goes down or recovers
    .plugin(tauri_plugin_notification::init())
    // Google sign-in: loopback redirect listener (see oauth.rs)
    .manage(oauth::OAuthListeners::default())
    .invoke_handler(tauri::generate_handler![oauth::oauth_listen, oauth::oauth_wait])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running the Upstat desktop app");
}
