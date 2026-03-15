use serde::{Deserialize, Serialize};
use std::io::Read;

#[derive(Deserialize)]
struct Request {
    model_path: String,
    audio_path: String,
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

    let result = run_transcription(&req.model_path, &req.audio_path);

    let resp = match result {
        Ok(text) => Response { ok: true, result: Some(text), error: None },
        Err(e) => Response { ok: false, result: None, error: Some(e) },
    };

    if let Some(ref e) = resp.error {
        eprintln!("[whisper-worker] Error: {}", e);
    }
    let _ = writeln!(std::io::stdout(), "{}", serde_json::to_string(&resp).unwrap());
    let _ = std::io::stdout().flush();
}

fn load_wav_samples(path: &str) -> Result<Vec<f32>, String> {
    let reader = hound::WavReader::open(path)
        .map_err(|e| format!("Failed to open WAV file: {}", e))?;

    let spec = reader.spec();
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => {
            reader.into_samples::<f32>()
                .map(|s| s.map_err(|e| format!("Sample read error: {}", e)))
                .collect::<Result<Vec<_>, _>>()?
        }
        hound::SampleFormat::Int => {
            let bits = spec.bits_per_sample;
            let max = (1 << (bits - 1)) as f32;
            reader.into_samples::<i32>()
                .map(|s| s.map(|v| v as f32 / max).map_err(|e| format!("Sample read error: {}", e)))
                .collect::<Result<Vec<_>, _>>()?
        }
    };

    // Mix to mono if multichannel
    let channels = spec.channels as usize;
    let mono = if channels > 1 {
        samples.chunks(channels)
            .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
            .collect()
    } else {
        samples
    };

    // Resample to 16kHz if needed
    let sample_rate = spec.sample_rate;
    if sample_rate != 16000 {
        Ok(resample(&mono, sample_rate, 16000))
    } else {
        Ok(mono)
    }
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

fn run_transcription(model_path: &str, audio_path: &str) -> Result<String, String> {
    eprintln!("[whisper-worker] Loading audio from: {}", audio_path);
    let samples = load_wav_samples(audio_path)?;

    if samples.is_empty() {
        return Err("No audio samples in WAV file".to_string());
    }
    eprintln!("[whisper-worker] Loaded {} samples", samples.len());

    eprintln!("[whisper-worker] Loading model from: {}", model_path);
    let ctx = whisper_rs::WhisperContext::new_with_params(
        model_path,
        whisper_rs::WhisperContextParameters::default(),
    ).map_err(|e| format!("Failed to load whisper model: {}", e))?;

    let mut state = ctx.create_state()
        .map_err(|e| format!("Failed to create whisper state: {}", e))?;

    let mut params = whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);
    params.set_suppress_nst(true);

    eprintln!("[whisper-worker] Running transcription...");
    state.full(params, &samples)
        .map_err(|e| format!("Whisper transcription failed: {}", e))?;

    let num_segments = state.full_n_segments()
        .map_err(|e| format!("Failed to get segments: {}", e))?;

    let mut text = String::new();
    for i in 0..num_segments {
        if let Ok(segment) = state.full_get_segment_text(i) {
            text.push_str(&segment);
        }
    }

    eprintln!("[whisper-worker] Transcription complete: {} chars", text.len());
    Ok(text.trim().to_string())
}
