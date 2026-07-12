use serde::{Deserialize, Serialize};

/// Active LLM variant enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Variant {
    Qwen3_06B_Q4,
    GemmaE2bQ4,
}

impl Variant {
    pub const fn name(self) -> &'static str {
        match self {
            Self::Qwen3_06B_Q4 => "Qwen3_06B_Q4",
            Self::GemmaE2bQ4 => "GemmaE2bQ4",
        }
    }
}

impl std::fmt::Display for Variant {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name())
    }
}

/// Per-device variant catalog
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VariantManifest {
    pub variants: Vec<Variant>,
    pub picked: Variant,
}
