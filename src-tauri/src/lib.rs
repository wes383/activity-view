/// The WebView2 control ships a browser's keyboard: F5 and Ctrl+R reload the window
/// (throwing away the selected range and any unsaved edit), Ctrl+P opens a print
/// dialog, Ctrl+F a find bar with nothing to find, Ctrl+± rescales the whole layout
/// and F12 opens devtools. `AreBrowserAcceleratorKeysEnabled` is the single switch
/// for all of them. It leaves editing keys alone (Ctrl+C/V/X/A/Z), so copy and paste
/// in the settings fields keep working, and it does not touch in-page shortcuts.
#[cfg(windows)]
fn disable_browser_accelerators(window: &tauri::WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
    use windows_core::Interface;

    let _ = window.with_webview(|webview| unsafe {
        let controller = webview.controller();
        let Ok(core) = controller.CoreWebView2() else {
            return;
        };
        let Ok(settings) = core.Settings() else {
            return;
        };
        // `Settings()` hands back the base interface; the accelerator switch only
        // appeared in Settings3, so it has to be queried for explicitly.
        let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() else {
            return;
        };
        let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            #[cfg(windows)]
            {
                use tauri::Manager;

                if let Some(window) = app.get_webview_window("main") {
                    disable_browser_accelerators(&window);
                }
            }
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ActivityView");
}
