use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{Manager, RunEvent};

struct DashboardProcess(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let child = Command::new("codex-spec-dashboard")
                .args(["--host", "127.0.0.1", "--port", "8247"])
                .spawn()
                .map_err(|error| format!("failed to start codex-spec-dashboard: {error}"))?;
            app.manage(DashboardProcess(Mutex::new(Some(child))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Codex Spec Workflow desktop app");

    app.run(|handle, event| {
        if matches!(event, RunEvent::Exit) {
            if let Ok(mut process) = handle.state::<DashboardProcess>().0.lock() {
                if let Some(mut child) = process.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
    });
}
