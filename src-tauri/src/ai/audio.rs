/// PCM buffer wrapper
pub struct AudioBuffer {
    pub samples: Vec<i16>,
    pub sample_rate: u32,
}

/// Resample audio from one sample rate to another using linear interpolation
pub fn resample(samples: &[i16], from_rate: u32, to_rate: u32) -> Vec<i16> {
    if from_rate == to_rate {
        return samples.to_vec();
    }

    let ratio = samples.len() as f64 * to_rate as f64 / from_rate as f64;
    let out_len = ratio.ceil() as usize;

    (0..out_len)
        .map(|i| {
            let src_pos = i as f64 * from_rate as f64 / to_rate as f64;
            let src_idx = src_pos.floor() as usize;
            let frac = src_pos - src_pos.floor();

            if src_idx + 1 < samples.len() {
                let a = samples[src_idx] as f64;
                let b = samples[src_idx + 1] as f64;
                (a + (b - a) * frac) as i16
            } else if src_idx < samples.len() {
                samples[src_idx]
            } else {
                0
            }
        })
        .collect()
}
