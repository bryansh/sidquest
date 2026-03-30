use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    temperature: f32,
    system: String,
    messages: Vec<Message>,
}

#[derive(Deserialize)]
struct ContentBlock {
    text: Option<String>,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Option<Vec<ContentBlock>>,
    error: Option<ClaudeError>,
}

#[derive(Deserialize)]
struct ClaudeError {
    message: String,
}

const CLAUDE_MODEL: &str = "claude-sonnet-4-20250514";
const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";

pub async fn claude_inference(api_key: &str, system_prompt: &str, user_text: &str) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request = ClaudeRequest {
        model: CLAUDE_MODEL.to_string(),
        max_tokens: 4096,
        temperature: 0.3,
        system: system_prompt.to_string(),
        messages: vec![Message {
            role: "user".to_string(),
            content: user_text.to_string(),
        }],
    };

    let response = client
        .post(CLAUDE_API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Claude API request failed: {}", e))?;

    let status = response.status();
    let body: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

    if let Some(err) = body.error {
        return Err(format!("Claude API error ({}): {}", status, err.message));
    }

    body.content
        .and_then(|blocks| blocks.into_iter().find_map(|b| b.text))
        .ok_or_else(|| "Claude returned empty response".to_string())
}

pub async fn test_claude_connection(api_key: &str) -> Result<bool, String> {
    let client = reqwest::Client::new();

    let request = ClaudeRequest {
        model: CLAUDE_MODEL.to_string(),
        max_tokens: 10,
        temperature: 0.0,
        system: "Respond with OK".to_string(),
        messages: vec![Message {
            role: "user".to_string(),
            content: "test".to_string(),
        }],
    };

    let response = client
        .post(CLAUDE_API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Connection test failed: {}", e))?;

    if response.status().is_success() {
        Ok(true)
    } else {
        let body: ClaudeResponse = response.json().await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        Err(body.error.map(|e| e.message).unwrap_or_else(|| "Unknown error".to_string()))
    }
}

#[tauri::command]
pub async fn test_claude_api(api_key: String) -> Result<bool, String> {
    test_claude_connection(&api_key).await
}
