use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ModelDef {
    pub id: &'static str,
    pub name: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    pub size_bytes: u64,
    pub context_window: u32,
    pub chat_template: &'static str,
    pub model_type: &'static str,    // "generation" or "embedding"
    pub embedding_dim: Option<u32>,
}

pub static LOCAL_MODELS: &[ModelDef] = &[
    ModelDef {
        id: "gemma3-12b",
        name: "Gemma 3 12B (Recommended)",
        filename: "google_gemma-3-12b-it-Q4_K_M.gguf",
        url: "https://huggingface.co/bartowski/google_gemma-3-12b-it-GGUF/resolve/main/google_gemma-3-12b-it-Q4_K_M.gguf",
        size_bytes: 7_840_000_000,
        context_window: 4096,
        chat_template: "gemma3",
        model_type: "generation",
        embedding_dim: None,
    },
    ModelDef {
        id: "gemma3-4b",
        name: "Gemma 3 4B (Lightweight)",
        filename: "google_gemma-3-4b-it-Q4_K_M.gguf",
        url: "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf",
        size_bytes: 3_300_000_000,
        context_window: 2048,
        chat_template: "gemma3",
        model_type: "generation",
        embedding_dim: None,
    },
];

pub static EMBEDDING_MODEL: &ModelDef = &ModelDef {
    id: "snowflake-arctic-embed-110m",
    name: "Snowflake Arctic Embed",
    filename: "snowflake-arctic-embed-m-Q8_0.GGUF",
    url: "https://huggingface.co/ChristianAzinn/snowflake-arctic-embed-m-gguf/resolve/main/snowflake-arctic-embed-m-Q8_0.GGUF",
    size_bytes: 117_000_000,
    context_window: 512,
    chat_template: "none",
    model_type: "embedding",
    embedding_dim: Some(768),
};

pub fn get_model_by_id(id: &str) -> Option<&'static ModelDef> {
    LOCAL_MODELS.iter().find(|m| m.id == id)
        .or_else(|| if EMBEDDING_MODEL.id == id { Some(EMBEDDING_MODEL) } else { None })
}

pub fn get_embedding_model() -> &'static ModelDef {
    EMBEDDING_MODEL
}

#[tauri::command]
pub fn get_available_models() -> Vec<ModelDef> {
    LOCAL_MODELS.to_vec()
}

#[tauri::command]
pub fn get_embedding_model_info() -> ModelDef {
    EMBEDDING_MODEL.clone()
}
