use serde::{Deserialize, Serialize};
use std::io::Read;
use std::num::NonZeroU32;

const SYSTEM_PROMPT: &str = r#"You are a note organizer for a game companion app. Clean up the following note.

RULES (in priority order):

1. WIKILINKS ARE SACRED. Every [[name]] in the input MUST appear in your output with its [[ and ]] brackets intact. The syntax is exactly two opening brackets [[ and exactly two closing brackets ]]. Do not remove, rename, or unbracket any wikilink. Do not add new wikilinks that were not in the input. Even if a linked name only appears once or is minor, it MUST still appear as a [[wikilink]] in your output.

2. PRESERVE all factual content. Do not drop details, names, numbers, or items. Every fact from the input must appear in the output. If someone is mentioned — even briefly — they must still appear.

3. Do NOT invent new information. Only reorganize what is given. Do NOT add [[brackets]] around names that were not already bracketed in the input.

4. KEEP the original voice. If the note is written in first person ("I", "we"), keep it in first person. Do NOT replace "I" with "the narrator", "the player", or any other label.

FORMAT: Group related information into clear sections with ## headers. Use - for bullet points. Infer section topics from the content (e.g., characters, locations, items, combat, objectives). Use only single-level bullets (no nested/indented sub-bullets).

STYLE: Concise but complete. Tighten rambling prose but keep all facts. Casual tone.

Return ONLY the cleaned-up note. No commentary, no preamble, no explanation."#;

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
    use std::io::Write;

    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).unwrap_or_default();

    let req: Request = match serde_json::from_str(&input) {
        Ok(r) => r,
        Err(e) => {
            let resp = Response { ok: false, result: None, error: Some(format!("Invalid input: {}", e)) };
            let _ = writeln!(std::io::stdout(), "{}", serde_json::to_string(&resp).unwrap());
            let _ = std::io::stdout().flush();
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

    if let Some(ref e) = resp.error {
        eprintln!("[cleanup-worker] Error: {}", e);
    }
    eprintln!("[cleanup-worker] Writing response, ok={}", resp.ok);
    let _ = writeln!(std::io::stdout(), "{}", serde_json::to_string(&resp).unwrap());
    let _ = std::io::stdout().flush();
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

    // Format prompt with Gemma 3 chat template (system prompt goes in user turn)
    let prompt = format!(
        "<start_of_turn>user\n{}\n\n{}<end_of_turn>\n<start_of_turn>model\n",
        SYSTEM_PROMPT, note_text
    );

    let tokens = model
        .str_to_token(&prompt, AddBos::Always)
        .map_err(|e| format!("Tokenization failed: {}", e))?;

    // Feed prompt tokens in chunks that fit the batch size
    eprintln!("[cleanup-worker] Prompt tokens: {}", tokens.len());
    let batch_size = 512;
    let mut batch = LlamaBatch::new(batch_size, 1);
    let total = tokens.len();

    for chunk_start in (0..total).step_by(batch_size) {
        batch.clear();
        let chunk_end = (chunk_start + batch_size).min(total);
        for i in chunk_start..chunk_end {
            let is_last = i == total - 1;
            batch
                .add(tokens[i], i as i32, &[0], is_last)
                .map_err(|e| format!("Batch add failed: {}", e))?;
        }
        ctx.decode(&mut batch)
            .map_err(|e| format!("Decode failed: {}", e))?;
    }

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
        if output.ends_with("<end_of_tur") || token_str.contains("<end_of_turn>") {
            if let Some(pos) = output.rfind("<end_of_tur") {
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
