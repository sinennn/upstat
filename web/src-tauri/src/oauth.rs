//! Google sign-in for the desktop app — the loopback flow native apps use
//! (RFC 8252). Google can't redirect to the app's `tauri://` origin, so
//! the app listens on `http://localhost:<port>/callback`, opens the system
//! browser at Google, and receives the redirect here.
//!
//! Google puts the ID token in the URL *fragment*, which browsers never send
//! to a server. So `/callback` serves a tiny page whose script posts the
//! fragment back to `/complete`; that body is what `oauth_wait` returns.
//!
//! The listener accepts loopback connections only, lives for one sign-in,
//! and the web side verifies the `state` it gets back.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, State};

/// Listeners bound by `oauth_listen`, consumed by `oauth_wait`.
#[derive(Default)]
pub struct OAuthListeners(Mutex<Vec<TcpListener>>);

/// Binds the callback port on both loopback stacks (`localhost` may resolve
/// to either). Succeeds if at least one binds.
#[tauri::command]
pub fn oauth_listen(port: u16, listeners: State<'_, OAuthListeners>) -> Result<(), String> {
    let mut bound = Vec::new();
    for addr in [format!("127.0.0.1:{port}"), format!("[::1]:{port}")] {
        if let Ok(listener) = TcpListener::bind(&addr) {
            listener
                .set_nonblocking(true)
                .map_err(|e| e.to_string())?;
            bound.push(listener);
        }
    }
    if bound.is_empty() {
        return Err(format!(
            "Port {port} is in use, so Google sign-in can't receive its reply. Close whatever is using it and try again."
        ));
    }
    *listeners.0.lock().map_err(|e| e.to_string())? = bound;
    Ok(())
}

/// Waits for the browser to deliver Google's redirect, then brings the app
/// back to the front. Returns the URL fragment (`id_token=…&state=…` or
/// `error=…&state=…`).
#[tauri::command]
pub async fn oauth_wait(
    timeout_secs: u64,
    app: tauri::AppHandle,
    listeners: State<'_, OAuthListeners>,
) -> Result<String, String> {
    let bound: Vec<TcpListener> = std::mem::take(&mut *listeners.0.lock().map_err(|e| e.to_string())?);
    if bound.is_empty() {
        return Err("sign-in listener is not running".into());
    }
    let fragment = tauri::async_runtime::spawn_blocking(move || serve(bound, timeout_secs))
        .await
        .map_err(|e| e.to_string())??;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(fragment)
}

fn serve(listeners: Vec<TcpListener>, timeout_secs: u64) -> Result<String, String> {
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    while Instant::now() < deadline {
        for listener in &listeners {
            match listener.accept() {
                Ok((stream, _)) => {
                    if let Some(fragment) = handle(stream) {
                        return Ok(fragment);
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                Err(e) => return Err(e.to_string()),
            }
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    Err("sign_in_timeout".into())
}

/// Handles one HTTP request; returns the fragment once `/complete` arrives.
fn handle(mut stream: TcpStream) -> Option<String> {
    let _ = stream.set_nonblocking(false);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut reader = BufReader::new(stream.try_clone().ok()?);

    let mut request_line = String::new();
    reader.read_line(&mut request_line).ok()?;
    let mut parts = request_line.split_whitespace();
    let (method, path) = (parts.next()?, parts.next()?);

    let mut content_length = 0usize;
    loop {
        let mut header = String::new();
        if reader.read_line(&mut header).ok()? == 0 || header == "\r\n" {
            break;
        }
        if let Some((name, value)) = header.split_once(':') {
            if name.eq_ignore_ascii_case("content-length") {
                content_length = value.trim().parse().unwrap_or(0);
            }
        }
    }

    match (method, path.split('?').next().unwrap_or("")) {
        ("GET", "/callback") => {
            respond(&mut stream, "200 OK", "text/html; charset=utf-8", CALLBACK_PAGE);
            None
        }
        ("POST", "/complete") => {
            let mut body = vec![0u8; content_length.min(16 * 1024)];
            reader.read_exact(&mut body).ok()?;
            respond(&mut stream, "204 No Content", "text/plain", "");
            String::from_utf8(body).ok()
        }
        _ => {
            respond(&mut stream, "404 Not Found", "text/plain", "not found");
            None
        }
    }
}

fn respond(stream: &mut TcpStream, status: &str, content_type: &str, body: &str) {
    let _ = write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.flush();
}

/// What the browser tab shows after Google redirects back.
const CALLBACK_PAGE: &str = r#"<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Upstat — signed in</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0e1113; color:#e6edf3;
         font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; }
  .card { text-align:center; padding:40px 36px; border:1px solid #232a30; border-radius:14px; background:#141a1e; max-width:360px; }
  .bolt { width:44px; height:44px; color:#00e09e; }
  h1 { font-size:20px; margin:16px 0 6px; font-weight:600; }
  p { margin:0; color:#8b98a5; }
  .err h1 { color:#ff5c5c; }
</style></head>
<body><div class="card" id="card">
  <svg class="bolt" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
  <h1 id="title">Finishing sign-in…</h1><p id="body">Returning you to Upstat.</p>
</div>
<script>
  var fragment = location.hash.slice(1);
  var failed = /(^|&)error=/.test(fragment) || !/(^|&)id_token=/.test(fragment);
  fetch("/complete", { method: "POST", body: fragment }).finally(function () {
    if (failed) {
      document.getElementById("card").className = "card err";
      document.getElementById("title").textContent = "Sign-in was not completed";
      document.getElementById("body").textContent = "Close this tab and try again from the Upstat app.";
    } else {
      document.getElementById("title").textContent = "You're signed in";
      document.getElementById("body").textContent = "You can close this tab and return to the Upstat app.";
    }
    history.replaceState(null, "", "/callback");
  });
</script></body></html>"#;

#[cfg(test)]
mod tests {
    use super::*;

    fn request(port: u16, raw: &str) -> String {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        stream.write_all(raw.as_bytes()).unwrap();
        let mut out = String::new();
        let _ = stream.read_to_string(&mut out);
        out
    }

    #[test]
    fn serves_the_page_then_returns_the_posted_fragment() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        listener.set_nonblocking(true).unwrap();
        let server = std::thread::spawn(move || serve(vec![listener], 10));

        let page = request(port, "GET /callback HTTP/1.1\r\nHost: localhost\r\n\r\n");
        assert!(page.starts_with("HTTP/1.1 200 OK"));
        assert!(page.contains("fetch(\"/complete\""));

        let body = "id_token=abc.def.ghi&state=s1";
        let done = request(
            port,
            &format!("POST /complete HTTP/1.1\r\nContent-Length: {}\r\n\r\n{body}", body.len()),
        );
        assert!(done.starts_with("HTTP/1.1 204"));
        assert_eq!(server.join().unwrap().unwrap(), body);
    }

    #[test]
    fn unknown_paths_are_404_and_do_not_finish_the_flow() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        listener.set_nonblocking(true).unwrap();
        let server = std::thread::spawn(move || serve(vec![listener], 2));
        assert!(request(port, "GET /favicon.ico HTTP/1.1\r\n\r\n").starts_with("HTTP/1.1 404"));
        assert_eq!(server.join().unwrap().unwrap_err(), "sign_in_timeout");
    }
}
