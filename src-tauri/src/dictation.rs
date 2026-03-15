use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::worker::run_worker;

const WHISPER_MODEL_FILENAME: &str = "ggml-base.en.bin";
const WHISPER_MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin";

fn whisper_model_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(dir.join(WHISPER_MODEL_FILENAME))
}

pub struct RecordingState {
    pub samples: Arc<Mutex<Vec<f32>>>,
    pub stream: Mutex<Option<cpal::Stream>>,
    pub is_recording: Mutex<bool>,
    pub sample_rate: Mutex<u32>,
}

// cpal::Stream is not Send, but we only access it from the main thread via Mutex
unsafe impl Send for RecordingState {}
unsafe impl Sync for RecordingState {}

impl RecordingState {
    pub fn new() -> Self {
        Self {
            samples: Arc::new(Mutex::new(Vec::new())),
            stream: Mutex::new(None),
            is_recording: Mutex::new(false),
            sample_rate: Mutex::new(16000),
        }
    }
}

#[tauri::command]
pub fn start_recording(state: State<'_, RecordingState>) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host.default_input_device()
        .ok_or("No input device available")?;

    let config = device.default_input_config()
        .map_err(|e| format!("Failed to get input config: {}", e))?;

    let sr = config.sample_rate().0;
    *state.sample_rate.lock().unwrap() = sr;

    // Clear previous samples
    state.samples.lock().unwrap().clear();

    let samples = Arc::clone(&state.samples);
    let channels = config.channels() as usize;

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => {
            device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    let mut buf = samples.lock().unwrap();
                    for chunk in data.chunks(channels) {
                        let mono: f32 = chunk.iter().sum::<f32>() / channels as f32;
                        buf.push(mono);
                    }
                },
                |err| eprintln!("Recording error: {}", err),
                None,
            ).map_err(|e| format!("Failed to build stream: {}", e))?
        }
        cpal::SampleFormat::I16 => {
            let samples = Arc::clone(&state.samples);
            device.build_input_stream(
                &config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    let mut buf = samples.lock().unwrap();
                    for chunk in data.chunks(channels) {
                        let mono: f32 = chunk.iter().map(|&s| s as f32 / 32768.0).sum::<f32>() / channels as f32;
                        buf.push(mono);
                    }
                },
                |err| eprintln!("Recording error: {}", err),
                None,
            ).map_err(|e| format!("Failed to build stream: {}", e))?
        }
        format => return Err(format!("Unsupported sample format: {:?}", format)),
    };

    stream.play().map_err(|e| format!("Failed to start recording: {}", e))?;

    *state.stream.lock().unwrap() = Some(stream);
    *state.is_recording.lock().unwrap() = true;

    Ok(())
}

#[tauri::command]
pub fn stop_recording(state: State<'_, RecordingState>) -> Result<(), String> {
    *state.is_recording.lock().unwrap() = false;
    *state.stream.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub fn get_recording_status(state: State<'_, RecordingState>) -> bool {
    *state.is_recording.lock().unwrap()
}

#[tauri::command]
pub async fn transcribe(state: State<'_, RecordingState>, model_path: String) -> Result<String, String> {
    let samples = state.samples.lock().unwrap().clone();
    let source_rate = *state.sample_rate.lock().unwrap();

    if samples.is_empty() {
        return Err("No audio recorded".to_string());
    }

    // Resample to 16kHz if needed
    let samples_16k = if source_rate != 16000 {
        resample(&samples, source_rate, 16000)
    } else {
        samples
    };

    // Write samples to a temp WAV file for the worker
    let audio_path = std::env::temp_dir().join(format!("sidquest-dictation-{}.wav", uuid::Uuid::new_v4()));
    let audio_path_str = audio_path.to_string_lossy().to_string();

    write_wav(&audio_path_str, &samples_16k, 16000)
        .map_err(|e| format!("Failed to write temp WAV: {}", e))?;

    let result = tokio::task::spawn_blocking(move || {
        let request = serde_json::json!({
            "model_path": model_path,
            "audio_path": audio_path_str,
        });
        let result = run_worker("whisper-worker", &request);
        // Clean up temp file
        let _ = std::fs::remove_file(&audio_path);
        result
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(result)
}

fn write_wav(path: &str, samples: &[f32], sample_rate: u32) -> Result<(), String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };
    let mut writer = hound::WavWriter::create(path, spec)
        .map_err(|e| format!("Failed to create WAV writer: {}", e))?;
    for &sample in samples {
        writer.write_sample(sample)
            .map_err(|e| format!("Failed to write sample: {}", e))?;
    }
    writer.finalize()
        .map_err(|e| format!("Failed to finalize WAV: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn check_whisper_model(app: AppHandle) -> Result<bool, String> {
    let path = whisper_model_path(&app)?;
    Ok(path.exists())
}

#[tauri::command]
pub async fn download_whisper_model(app: AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    use futures_util::StreamExt;

    let path = whisper_model_path(&app)?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let response = reqwest::get(WHISPER_MODEL_URL)
        .await
        .map_err(|e| format!("Failed to download model: {}", e))?;

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file = tokio::fs::File::create(&path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;

        downloaded += chunk.len() as u64;
        let _ = window.emit("whisper-model-progress", serde_json::json!({
            "downloaded": downloaded,
            "total": total,
        }));
    }

    Ok(())
}

fn resample(input: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    let ratio = from_rate as f64 / to_rate as f64;
    let output_len = (input.len() as f64 / ratio) as usize;
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let src_idx = i as f64 * ratio;
        let idx = src_idx as usize;
        let frac = src_idx - idx as f64;

        if idx + 1 < input.len() {
            let sample = input[idx] as f64 * (1.0 - frac) + input[idx + 1] as f64 * frac;
            output.push(sample as f32);
        } else if idx < input.len() {
            output.push(input[idx]);
        }
    }

    output
}
