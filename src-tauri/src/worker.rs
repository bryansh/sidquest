use std::io::Write;
use std::process::{Command, Stdio};

/// Find a worker binary by name, checking env var override first, then next to current exe.
fn worker_binary_path(name: &str) -> Result<std::path::PathBuf, String> {
    // Check env var override (useful for dev)
    let env_key = format!("{}_PATH", name.to_uppercase().replace('-', "_"));
    if let Ok(path) = std::env::var(&env_key) {
        return Ok(path.into());
    }

    // Same directory as current executable
    let exe = std::env::current_exe()
        .map_err(|e| format!("Cannot find current exe: {}", e))?;
    let dir = exe.parent().ok_or("No parent dir for executable")?;
    let worker = dir.join(name);
    if worker.exists() {
        return Ok(worker);
    }

    Err(format!("{} binary not found in {}", name, dir.display()))
}

/// Spawn a worker binary, send JSON on stdin, read JSON response from stdout.
pub fn run_worker(binary_name: &str, request: &serde_json::Value) -> Result<String, String> {
    let worker_path = worker_binary_path(binary_name)?;

    let mut child = Command::new(&worker_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", binary_name, e))?;

    // Write request and close stdin
    {
        let mut stdin = child.stdin.take()
            .ok_or(format!("Failed to open {} stdin", binary_name))?;
        serde_json::to_writer(&mut stdin, request)
            .map_err(|e| format!("Failed to write to {}: {}", binary_name, e))?;
        stdin.flush().map_err(|e| format!("Failed to flush stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("{} failed: {}", binary_name, e))?;

    if output.stdout.is_empty() {
        return Err(format!("{} produced no output", binary_name));
    }

    let response: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse {} output: {}. stdout: {}", binary_name, e, String::from_utf8_lossy(&output.stdout)))?;

    if response["ok"].as_bool() == Some(true) {
        response["result"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or(format!("{} returned ok but no result", binary_name))
    } else {
        Err(response["error"]
            .as_str()
            .unwrap_or("Unknown worker error")
            .to_string())
    }
}
