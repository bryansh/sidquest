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
    #[serde(default)]
    text: String,
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    entity_types: Option<Vec<String>>,
    #[serde(default)]
    chat_template: Option<String>,
    #[serde(default)]
    n_ctx: Option<u32>,
    #[serde(default)]
    texts: Option<Vec<String>>,
    #[serde(default)]
    system_prompt: Option<String>,
    #[serde(default)]
    is_query: Option<bool>,
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

    // Run on a thread with a large stack (GGML graph traversal needs it)
    let chat_template = req.chat_template.unwrap_or_else(|| "gemma3".to_string());
    let n_ctx = req.n_ctx.unwrap_or(2048);
    let is_embed = req.mode.as_deref() == Some("embed");

    let handle = std::thread::Builder::new()
        .stack_size(64 * 1024 * 1024)
        .spawn(move || {
            if is_embed {
                let texts = req.texts.unwrap_or_else(|| vec![req.text.clone()]);
                let is_query = req.is_query.unwrap_or(false);
                run_embedding(&req.model_path, &texts, n_ctx, is_query)
            } else {
                run_inference(&req.model_path, &req.text, req.mode.as_deref(), req.entity_types.as_deref(), &chat_template, n_ctx, req.system_prompt.as_deref())
            }
        })
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

fn build_extract_prompt(entity_types: &[String]) -> String {
    let types_list = entity_types.join(", ");
    format!(
        r#"You are a game session note analyzer. Extract ALL named entities from the session notes.

Classify each entity into one of these categories: {types_list}

RULES:
- Include unnamed characters by their role (e.g., "Barkeep", "Guard Captain")
- Include currency and treasure as items
- Be thorough — extract every person, place, thing, and organization mentioned
- For each entity, provide TWO fields:
  - "label": a short 2-5 word label (e.g., "Evil wizard", "Abandoned fortress", "Enchanted dagger")
  - "description": a DETAILED 2-4 sentence description capturing everything the notes say — relationships, goals, actions, and context
- Return ONLY valid JSON with this exact structure, no other text:

{{"categories": {{{categories_template}}}}}

Where each category contains an array of objects with "name", "label", and "description" fields."#,
        types_list = types_list,
        categories_template = entity_types.iter()
            .map(|t| format!("\"{}\": [{{\"name\": \"...\", \"label\": \"short label\", \"description\": \"2-4 sentence description\"}}]", t))
            .collect::<Vec<_>>()
            .join(", ")
    )
}

fn format_prompt(template: &str, system: &str, user: &str) -> String {
    match template {
        "llama3" => format!(
            "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
            system, user
        ),
        "chatml" => format!(
            "<|im_start|>system\n{}<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
            system, user
        ),
        // Default: gemma3
        _ => format!(
            "<start_of_turn>user\n{}\n\n{}<end_of_turn>\n<start_of_turn>model\n",
            system, user
        ),
    }
}

fn stop_token(template: &str) -> &str {
    match template {
        "llama3" => "<|eot_id|>",
        "chatml" => "<|im_end|>",
        _ => "<end_of_turn>",
    }
}

fn run_embedding(model_path: &str, texts: &[String], n_ctx: u32, is_query: bool) -> Result<String, String> {
    use llama_cpp_2::context::params::{LlamaContextParams, LlamaPoolingType};
    use llama_cpp_2::llama_backend::LlamaBackend;
    use llama_cpp_2::llama_batch::LlamaBatch;
    use llama_cpp_2::model::params::LlamaModelParams;
    use llama_cpp_2::model::{AddBos, LlamaModel};

    eprintln!("[cleanup-worker] Embedding mode: {} texts, is_query={}", texts.len(), is_query);
    let backend = LlamaBackend::init().map_err(|e| format!("Backend init failed: {}", e))?;

    let model_params = LlamaModelParams::default().with_n_gpu_layers(99);
    let model = LlamaModel::load_from_file(&backend, model_path, &model_params)
        .map_err(|e| format!("Failed to load model: {}", e))?;
    eprintln!("[cleanup-worker] Embedding model loaded");

    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(NonZeroU32::new(n_ctx))
        .with_n_batch(512)
        .with_embeddings(true)
        .with_pooling_type(LlamaPoolingType::Cls);

    let mut all_embeddings: Vec<Vec<f32>> = Vec::new();

    // Snowflake Arctic Embed requires a query prefix for queries but not for documents
    let query_prefix = "Represent this sentence for searching relevant passages: ";

    for (i, text) in texts.iter().enumerate() {
        let mut ctx = model
            .new_context(&backend, ctx_params.clone())
            .map_err(|e| format!("Failed to create context: {}", e))?;

        let input_text = if is_query {
            format!("{}{}", query_prefix, text)
        } else {
            text.clone()
        };

        let tokens = model
            .str_to_token(&input_text, AddBos::Always)
            .map_err(|e| format!("Tokenization failed: {}", e))?;

        eprintln!("[cleanup-worker] Text {}/{}: {} tokens", i + 1, texts.len(), tokens.len());

        let batch_size = 512;
        let mut batch = LlamaBatch::new(batch_size, 1);
        let total = tokens.len();

        for chunk_start in (0..total).step_by(batch_size) {
            batch.clear();
            let chunk_end = (chunk_start + batch_size).min(total);
            for j in chunk_start..chunk_end {
                let is_last = j == total - 1;
                batch
                    .add(tokens[j], j as i32, &[0], is_last)
                    .map_err(|e| format!("Batch add failed: {}", e))?;
            }
            ctx.decode(&mut batch)
                .map_err(|e| format!("Decode failed: {}", e))?;
        }

        // Extract embeddings for the last token (sequence 0)
        let embeddings = ctx.embeddings_seq_ith(0)
            .map_err(|e| format!("Failed to get embeddings: {}", e))?;

        // Normalize the embedding vector (L2 norm)
        let norm: f32 = embeddings.iter().map(|x| x * x).sum::<f32>().sqrt();
        let normalized: Vec<f32> = if norm > 0.0 {
            embeddings.iter().map(|x| x / norm).collect()
        } else {
            embeddings.to_vec()
        };

        all_embeddings.push(normalized);
    }

    Ok(serde_json::to_string(&all_embeddings)
        .map_err(|e| format!("JSON serialization failed: {}", e))?)
}

fn run_inference(model_path: &str, note_text: &str, mode: Option<&str>, entity_types: Option<&[String]>, chat_template: &str, n_ctx: u32, custom_system_prompt: Option<&str>) -> Result<String, String> {
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
        .with_n_ctx(NonZeroU32::new(n_ctx))
        .with_n_batch(512);

    let mut ctx = model
        .new_context(&backend, ctx_params)
        .map_err(|e| format!("Failed to create context: {}", e))?;

    // Select system prompt based on mode
    let system_prompt = if let Some(custom) = custom_system_prompt {
        custom.to_string()
    } else {
        match mode {
            Some("extract") => {
                let types = entity_types.unwrap_or(&[]);
                if types.is_empty() {
                    return Err("Entity types required for extract mode".to_string());
                }
                build_extract_prompt(types)
            }
            _ => SYSTEM_PROMPT.to_string(),
        }
    };

    // Format prompt with the appropriate chat template
    let prompt = format_prompt(chat_template, &system_prompt, note_text);

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

        // Stop at end-of-turn marker for the active template
        let stop = stop_token(chat_template);
        if token_str.contains(stop) || (stop.len() > 3 && output.ends_with(&stop[..stop.len()-1])) {
            // Truncate any partial stop token from output
            for trim_len in (1..stop.len()).rev() {
                if output.ends_with(&stop[..trim_len]) {
                    output.truncate(output.len() - trim_len);
                    break;
                }
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
