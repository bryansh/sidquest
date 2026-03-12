use serde::{Deserialize, Serialize};
use std::io::Read;
use std::num::NonZeroU32;

const SYSTEM_PROMPT: &str = r#"You are a note organizer for a game companion app. Clean up the following note.

CRITICAL RULES:
- PRESERVE all [[wikilinks]] exactly as written including the double brackets. [[Elara]] must remain [[Elara]], NOT Elara. This is the most important rule.
- PRESERVE all factual content. Do not drop any details, names, numbers, or items.
- Do NOT invent any new information.

ORGANIZE: Group related information into clear sections with ## headers. Infer appropriate section topics from the content itself (e.g., characters, locations, items, combat, objectives, whatever fits the note).

STYLE: Concise but complete. Tighten rambling prose but keep all facts. Casual tone.

Return ONLY the cleaned-up note. No commentary, no preamble."#;

#[derive(Deserialize)]
struct Request {
    model_path: String,
    text: String,
}

#[derive(Serialize)]
struct Response {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn main() {
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).unwrap_or_default();

    let req: Request = match serde_json::from_str(&input) {
        Ok(r) => r,
        Err(e) => {
            let resp = Response { ok: false, result: None, error: Some(format!("Invalid input: {}", e)) };
            println!("{}", serde_json::to_string(&resp).unwrap());
            std::process::exit(1);
        }
    };

    // Run inference on a thread with a large stack (GGML graph traversal needs it)
    let handle = std::thread::Builder::new()
        .stack_size(64 * 1024 * 1024)
        .spawn(move || run_inference(&req.model_path, &req.text))
        .expect("Failed to spawn inference thread");

    let result = handle.join().unwrap_or_else(|_| Err("Inference thread panicked".to_string()));

    let resp = match result {
        Ok(text) => Response { ok: true, result: Some(text), error: None },
        Err(e) => Response { ok: false, result: None, error: Some(e) },
    };

    println!("{}", serde_json::to_string(&resp).unwrap());
    if !resp.ok {
        std::process::exit(1);
    }
}

fn run_inference(model_path: &str, note_text: &str) -> Result<String, String> {
    use llama_cpp_2::context::params::LlamaContextParams;
    use llama_cpp_2::llama_backend::LlamaBackend;
    use llama_cpp_2::llama_batch::LlamaBatch;
    use llama_cpp_2::model::params::LlamaModelParams;
    use llama_cpp_2::model::{AddBos, LlamaModel};
    use llama_cpp_2::sampling::LlamaSampler;

    eprintln!("[cleanup-worker] Initializing backend...");
    let backend = LlamaBackend::init().map_err(|e| format!("Backend init failed: {}", e))?;

    eprintln!("[cleanup-worker] Loading model from: {}", model_path);
    let model_params = LlamaModelParams::default().with_n_gpu_layers(99);

    let model = LlamaModel::load_from_file(&backend, model_path, &model_params)
        .map_err(|e| format!("Failed to load model: {}", e))?;
    eprintln!("[cleanup-worker] Model loaded successfully");

    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(NonZeroU32::new(2048))
        .with_n_batch(512);

    let mut ctx = model
        .new_context(&backend, ctx_params)
        .map_err(|e| format!("Failed to create context: {}", e))?;

    // Format prompt with ChatML template
    let prompt = format!(
        "<|im_start|>system\n{}<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
        SYSTEM_PROMPT, note_text
    );

    let tokens = model
        .str_to_token(&prompt, AddBos::Always)
        .map_err(|e| format!("Tokenization failed: {}", e))?;

    // Create batch and add prompt tokens
    let mut batch = LlamaBatch::new(512, 1);
    let last_idx = (tokens.len() - 1) as i32;
    for (i, &token) in tokens.iter().enumerate() {
        let is_last = i as i32 == last_idx;
        batch
            .add(token, i as i32, &[0], is_last)
            .map_err(|e| format!("Batch add failed: {}", e))?;
    }

    // Decode prompt
    ctx.decode(&mut batch)
        .map_err(|e| format!("Decode failed: {}", e))?;

    // Set up sampler: low temperature for deterministic cleanup
    let mut sampler = LlamaSampler::chain_simple([
        LlamaSampler::temp(0.3),
        LlamaSampler::top_k(40),
        LlamaSampler::top_p(0.9, 1),
        LlamaSampler::dist(42),
    ]);

    // Generation loop
    let mut output = String::new();
    let mut n_cur = tokens.len() as i32;
    let max_tokens = 2048;
    let mut decoder = encoding_rs::UTF_8.new_decoder();

    for _ in 0..max_tokens {
        let new_token = sampler.sample(&ctx, -1);

        if model.is_eog_token(new_token) {
            break;
        }

        let token_str = model
            .token_to_piece(new_token, &mut decoder, false, None)
            .map_err(|e| format!("Token to string failed: {}", e))?;

        // Stop at end-of-turn marker
        if output.ends_with("<|im_end") || token_str.contains("<|im_end|>") {
            if let Some(pos) = output.rfind("<|im_end") {
                output.truncate(pos);
            }
            break;
        }

        output.push_str(&token_str);

        batch.clear();
        batch
            .add(new_token, n_cur, &[0], true)
            .map_err(|e| format!("Batch add failed: {}", e))?;

        ctx.decode(&mut batch)
            .map_err(|e| format!("Decode failed: {}", e))?;

        n_cur += 1;
    }

    Ok(output.trim().to_string())
}
