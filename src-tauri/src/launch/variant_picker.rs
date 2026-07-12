//! Variant picker module
//!
//! Maps device capabilities to model variants.

use crate::ai::probe::Variant;
use crate::launch::device_capability::DeviceCapability;
use serde::{Deserialize, Serialize};

/// Maps `DeviceCapability` → `Variant`.
///
/// Selects the appropriate LLM variant based on device capabilities.
pub struct VariantPicker;

impl VariantPicker {
    /// Minimum RAM required for Gemma variant (6 GB).
    const GEMMA_MIN_RAM_BYTES: u64 = 6 * 1024 * 1024 * 1024;

    /// Minimum free storage required for Gemma variant (4 GB).
    const GEMMA_MIN_STORAGE_BYTES: u64 = 4 * 1024 * 1024 * 1024;

    /// Pick a variant based on device capability.
    ///
    /// Returns `GemmaE2bQ4` if the device has sufficient RAM and storage,
    /// otherwise returns `Qwen3_06B_Q4` as the universal floor.
    pub fn pick(cap: &DeviceCapability) -> Variant {
        if cap.ram_total_bytes >= Self::GEMMA_MIN_RAM_BYTES
            && cap.storage_free_bytes >= Self::GEMMA_MIN_STORAGE_BYTES
        {
            Variant::GemmaE2bQ4
        } else {
            Variant::Qwen3_06B_Q4
        }
    }

    /// Pick a variant with user override.
    ///
    /// Respects the override setting if provided, otherwise falls back
    /// to automatic selection based on device capability.
    pub fn pick_with_override(cap: &DeviceCapability, override_: VariantOverride) -> Variant {
        match override_ {
            VariantOverride::Auto => Self::pick(cap),
            VariantOverride::ForceQwen3 => Variant::Qwen3_06B_Q4,
            VariantOverride::ForceGemmaE2bQ4 => Variant::GemmaE2bQ4,
        }
    }
}

/// Settings-level override for model variant selection.
///
/// Allows users or configuration to force a specific model variant
/// regardless of device capability probing results.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
pub enum VariantOverride {
    /// Automatic selection based on device capability probing
    Auto,
    /// Force Qwen3 variant regardless of capability
    ForceQwen3,
    /// Force Gemma e2b q4 variant regardless of capability
    ForceGemmaE2bQ4,
}
