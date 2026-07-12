// Token sampler trait

pub trait Sampler {
    fn sample(&self, logits: &[f32]) -> u32;
}

// Top-k sampler
// Selects from the top k tokens, applying temperature scaling

pub struct TopKSampler {
    pub k: u32,
    pub temperature: f32,
}

impl Sampler for TopKSampler {
    fn sample(&self, logits: &[f32]) -> u32 {
        let mut indexed: Vec<(usize, f32)> = logits.iter().enumerate().map(|(i, &v)| (i, v)).collect();

        indexed.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        let k = self.k.min(logits.len() as u32) as usize;
        indexed.truncate(k);

        for (_, logit) in indexed.iter_mut() {
            *logit = (*logit / self.temperature).exp();
        }

        let sum: f32 = indexed.iter().map(|(_, v)| v).sum();
        let mut rng = rand::thread_rng();
        let mut cutoff = rand::random::<f32>() * sum;

        for (idx, prob) in indexed.iter() {
            cutoff -= prob;
            if cutoff <= 0.0 {
                return *idx as u32;
            }
        }

        indexed.last().map(|(idx, _)| *idx as u32).unwrap_or(0)
    }
}

// Nucleus (top-p) sampler
// Selects from the smallest set of tokens whose cumulative probability reaches p

pub struct TopPSampler {
    pub p: f32,
    pub temperature: f32,
}

impl Sampler for TopPSampler {
    fn sample(&self, logits: &[f32]) -> u32 {
        let mut indexed: Vec<(usize, f32)> = logits.iter().enumerate().map(|(i, &v)| (i, v)).collect();

        indexed.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        for (_, logit) in indexed.iter_mut() {
            *logit = (*logit / self.temperature).exp();
        }

        let sum: f32 = indexed.iter().map(|(_, v)| v).sum();
        let mut cumulative = 0.0;
        let mut cutoff_idx = indexed.len();

        for (i, (_, prob)) in indexed.iter().enumerate() {
            cumulative += prob / sum;
            if cumulative >= self.p {
                cutoff_idx = i + 1;
                break;
            }
        }

        indexed.truncate(cutoff_idx);

        let truncated_sum: f32 = indexed.iter().map(|(_, v)| v).sum();
        let mut rng = rand::thread_rng();
        let mut cutoff = rand::random::<f32>() * truncated_sum;

        for (idx, prob) in indexed.iter() {
            cutoff -= prob;
            if cutoff <= 0.0 {
                return *idx as u32;
            }
        }

        indexed.last().map(|(idx, _)| *idx as u32).unwrap_or(0)
    }
}
