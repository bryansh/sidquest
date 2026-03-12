use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};
use tauri::State;

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

    // Run whisper on a blocking thread since it's CPU-intensive
    let result = std::thread::spawn(move || -> Result<String, String> {
        let ctx = whisper_rs::WhisperContext::new_with_params(
            &model_path,
            whisper_rs::WhisperContextParameters::default(),
        ).map_err(|e| format!("Failed to load whisper model: {}", e))?;

        let mut wstate = ctx.create_state()
            .map_err(|e| format!("Failed to create whisper state: {}", e))?;

        let mut params = whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("en"));
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_suppress_blank(true);
        params.set_suppress_nst(true);

        wstate.full(params, &samples_16k)
            .map_err(|e| format!("Whisper transcription failed: {}", e))?;

        let num_segments = wstate.full_n_segments()
            .map_err(|e| format!("Failed to get segments: {}", e))?;

        let mut text = String::new();
        for i in 0..num_segments {
            if let Ok(segment) = wstate.full_get_segment_text(i) {
                text.push_str(&segment);
            }
        }

        Ok(text.trim().to_string())
    }).join().map_err(|_| "Transcription thread panicked".to_string())??;

    Ok(result)
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
