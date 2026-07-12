// Tauri commands exposed to frontend
use serde::{Serialize, Deserialize};
use tauri::State;
use tauri::ipc::Channel;
use std::sync::OnceLock;
use std::path::PathBuf;
use uuid::Uuid;

use crate::state::AppState;
use crate::billing::{restore::{RestoreResult, PurchaseRestorer}, paywall::PaywallController};
use crate::launch::device_capability::{DeviceCapability, DeviceProbe};
use crate::launch::variant_picker::VariantOverride;
use crate::ai::probe::Variant;
use crate::model_fetcher::progress::DownloadProgress;
use crate::sidecar::{Sidecar, SidecarMeta, payload::Payload, trust::{TrustLevel, TrustEntry}, PeerIdentity, Provenance};
use crate::sidecar::verify::{SidecarVerifier, VerifiedSidecar};
use crate::sidecar::chunk::{Chunk, ReassembleStatus};
use crate::pack_catalog::types::ZimPack;
use crate::pack_catalog::progress::PackProgress;
use crate::app_update::UpdateManifest;
use crate::window_state::WindowState;

/// E-CMD-5 JSON response: ZIM metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZimMetaJson {
    pub title: String,
    pub uuid: String,
    pub article_count: u32,
}

/// E-ZIM-21: Search result row
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub url: String,
    pub title: String,
    pub score: f32,
}

/// E-CMD-1: Library version → frontend
#[tauri::command]
pub fn enzime_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// E-CMD-2: Open ZIM archive, return handle
#[tauri::command]
pub fn zim_open(path: String, state: State<AppState>) -> Result<u64, String> {
    use anzimmermanlib::real::RealZim;

    let path_obj = std::path::Path::new(&path);
    let zim = RealZim::open(path_obj).map_err(|e| e.to_string())?;
    let handle = state.push_zim(Box::new(zim));
    Ok(handle)
}

/// E-CMD-3: Fetch article by handle+url
#[tauri::command]
pub fn zim_get_article(handle: u64, url: String, state: State<AppState>) -> Result<String, String> {
    use anzimmermanlib::ZimReader;

    let zim_readers = state.zim.lock().map_err(|e| format!("ZIM mutex poisoned: {}", e))?;
    let reader = zim_readers
        .get(handle as usize)
        .ok_or_else(|| format!("Invalid ZIM handle: {}", handle))?;

    reader
        .get_article(&url)
        .map_err(|e| e.to_string())
}

/// E-CMD-4: Paginated article URL list
#[tauri::command]
pub fn zim_list_articles(handle: u64, offset: u64, limit: u32, state: State<AppState>) -> Result<Vec<String>, String> {
    use anzimmermanlib::ZimReader;

    let zim_readers = state.zim.lock().map_err(|e| format!("ZIM mutex poisoned: {}", e))?;
    let reader = zim_readers
        .get(handle as usize)
        .ok_or_else(|| format!("Invalid ZIM handle: {}", handle))?;

    reader
        .list_urls(offset, limit)
        .map_err(|e| e.to_string())
}

/// E-CMD-5: ZIM metadata (title/uuid/article_count)
#[tauri::command]
pub fn zim_metadata(handle: u64, state: State<AppState>) -> Result<ZimMetaJson, String> {
    use anzimmermanlib::ZimReader;

    let zim_readers = state.zim.lock().map_err(|e| format!("ZIM mutex poisoned: {}", e))?;
    let reader = zim_readers
        .get(handle as usize)
        .ok_or_else(|| format!("Invalid ZIM handle: {}", handle))?;

    let metadata = reader.metadata();
    let title = metadata.main_page_url.clone().unwrap_or_else(|| format!("ZIM-{}", metadata.uuid));

    Ok(ZimMetaJson {
        title,
        uuid: metadata.uuid.to_string(),
        article_count: metadata.article_count,
    })
}

/// E-CMD-6: Release ZIM handle
#[tauri::command]
pub fn zim_close(handle: u64, state: State<AppState>) -> Result<(), String> {
    let mut registry = state.zim.lock().map_err(|e| format!("ZIM registry mutex poisoned: {}", e))?;

    if handle as usize >= registry.len() {
        return Err(format!("Invalid ZIM handle: {}", handle));
    }

    registry.remove(handle as usize);
    Ok(())
}

/// E-CMD-7: Single-ZIM prefix/text search
#[tauri::command]
pub fn zim_search(handle: u64, query: String, limit: u32, state: State<AppState>) -> Result<Vec<SearchHit>, String> {
    use anzimmermanlib::ZimReader;

    let zim_readers = state.zim.lock().map_err(|e| format!("ZIM mutex poisoned: {}", e))?;
    let reader = zim_readers
        .get(handle as usize)
        .ok_or_else(|| format!("Invalid ZIM handle: {}", handle))?;

    let hits = reader.search(&query, limit).map_err(|e| e.to_string())?;

    // Convert crate::search::SearchHit to commands::SearchHit
    let converted_hits: Vec<SearchHit> = hits.into_iter().map(|hit| {
        SearchHit {
            url: hit.url,
            title: hit.title,
            score: hit.score,
        }
    }).collect();

    Ok(converted_hits)
}

/// E-CMD-8: Non-streaming AI completion
#[tauri::command]
pub fn ai_chat(prompt: String, zim_handle: Option<u64>, state: State<AppState>) -> Result<String, String> {
    use crate::ai::LlmRuntime;

    // I-10 (b): swap when ZIM context builder lands (E-AI-5 ZimContextBuilder)
    let _zim_handle = zim_handle;

    let llm = state.llm.lock().map_err(|e| format!("LLM mutex poisoned: {}", e))?;
    llm.generate(&prompt, None).map_err(|e| e.to_string())
}

/// E-CMD-9: Streaming AI completion via Tauri Channel
#[tauri::command]
pub async fn ai_chat_stream(prompt: String, zim_handle: Option<u64>, on_event: Channel<String>, state: State<AppState>) -> Result<(), String> {
    use tokio::task::spawn_blocking;

    let llm_guard = state.llm.lock().map_err(|e| format!("LLM mutex poisoned: {}", e))?;

    // Clone the prompt for the blocking thread
    let prompt_clone = prompt.clone();

    // Spawn a blocking thread to run the LLM operation
    spawn_blocking(move || {
        // Call generate_stream with a callback that forwards each token chunk to the frontend
        let result = llm_guard.generate_stream(&prompt_clone, None, &|chunk| {
            let _ = on_event.send(chunk.to_string());
        });

        // Return the result, converting AiError to String
        result.map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("LLM task failed: {}", e))?;

    Ok(())
}

/// E-CMD-10: Voice chat - PCM in → text reply (Gemma-tier only)
#[tauri::command]
pub fn ai_voice_chat(pcm_b64: String, sr: u32, zim_handle: Option<u64>, state: State<AppState>) -> Result<String, String> {
    use crate::ai::{AudioEncoder, LlmRuntime};

    // Gemma-tier gate: only GemmaE2bQ4 supports voice chat
    let variant = state.current_variant();
    if variant != crate::ai::probe::Variant::GemmaE2bQ4 {
        return Err(format!(
            "Voice chat unavailable: current variant is {} (requires GemmaE2bQ4)",
            variant.name()
        ));
    }

    // Decode base64 PCM
    let pcm_bytes = base64::decode(&pcm_b64)
        .map_err(|e| format!("Invalid base64 encoding: {}", e))?;

    // Convert bytes to i16 samples (little-endian 16-bit PCM)
    if pcm_bytes.len() % 2 != 0 {
        return Err("Invalid PCM data: byte length must be even for i16 samples".to_string());
    }

    let samples: Vec<i16> = pcm_bytes
        .chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();

    // Validate sample rate (Gemma supports 8kHz-48kHz, resamples to 16kHz internally)
    if sr == 0 || sr > 48000 {
        return Err(format!("Invalid sample rate: {}. Gemma supports 8kHz-48kHz", sr));
    }

    // Transcribe audio using AudioEncoder
    let audio = state.audio.lock().map_err(|e| format!("Audio mutex poisoned: {}", e))?;
    let transcription = audio.transcribe(&samples, sr)
        .map_err(|e| format!("Audio transcription failed: {}", e))?;

    // Generate text reply using LlmRuntime
    let llm = state.llm.lock().map_err(|e| format!("LLM mutex poisoned: {}", e))?;
    let reply = llm.generate(&transcription, None)
        .map_err(|e| format!("LLM generation failed: {}", e))?;

    Ok(reply)
}

/// E-CMD-11: Late-bind concrete LLM
#[tauri::command]
pub fn ai_load_model(model_path: String, state: State<AppState>) -> Result<(), String> {
    use std::path::Path;

    let mut llm = state.llm.lock().map_err(|e| format!("LLM mutex poisoned: {}", e))?;
    let path = Path::new(&model_path);
    llm.load(path).map_err(|e| e.to_string())
}

/// E-CMD-12: Revert to NullLlm
#[tauri::command]
pub fn ai_unload_model(state: State<AppState>) -> Result<(), String> {
    state.swap_llm(Box::new(crate::ai::null::NullLlm));
    Ok(())
}

/// E-STR-15: Region selector placeholder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Region {
    Char { start: u32, end: u32 },
    Page,
    Custom(String),
}

/// E-STR-14: Annotation row placeholder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Annotation {
    pub id: u64,
    pub zim_uuid: String,
    pub url: String,
    pub region: Region,
    pub body: String,
    pub created_at: i64,
}

/// E-CMD-13: Annotations per article
#[tauri::command]
pub fn annotations_list(handle: u64, url: String, state: State<AppState>) -> Result<Vec<Annotation>, String> {
    use anzimmermanlib::ZimReader;
    use crate::storage::annotations::AnnotationsStore;

    // Get ZIM reader and extract UUID
    let zim_readers = state.zim.lock().map_err(|e| format!("ZIM mutex poisoned: {}", e))?;
    let reader = zim_readers
        .get(handle as usize)
        .ok_or_else(|| format!("Invalid ZIM handle: {}", handle))?;
    let zim_uuid = reader.metadata().uuid;

    // Get all annotations for this ZIM
    let storage_annotations = state.storage
        .list(Some(zim_uuid))
        .map_err(|e| e.to_string())?;

    // Filter by URL and convert to command type
    let command_annotations: Vec<Annotation> = storage_annotations
        .into_iter()
        .filter(|ann| ann.url == url)
        .map(|ann| {
            // Convert Region (storage → command) via JSON
            let region_json = serde_json::to_string(&ann.region).unwrap();
            let region = serde_json::from_str(&region_json).unwrap();

            Annotation {
                id: ann.id,
                zim_uuid: ann.zim_uuid.to_string(),
                url: ann.url,
                region,
                body: ann.body,
                created_at: ann.created_at,
            }
        })
        .collect();

    Ok(command_annotations)
}

/// E-CMD-14: Create annotation
#[tauri::command]
pub fn annotations_create(handle: u64, url: String, region: Region, body: String, state: State<AppState>) -> Result<u64, String> {
    use anzimmermanlib::ZimReader;

    // Get ZIM reader and extract UUID
    let zim_readers = state.zim.lock().map_err(|e| format!("ZIM mutex poisoned: {}", e))?;
    let reader = zim_readers
        .get(handle as usize)
        .ok_or_else(|| format!("Invalid ZIM handle: {}", handle))?;
    let zim_uuid = reader.metadata().uuid;

    // Convert Region (command → storage) via JSON
    let region_json = serde_json::to_string(&region).unwrap();
    let storage_region: crate::storage::annotations::Region = serde_json::from_str(&region_json)
        .map_err(|e| format!("Region conversion failed: {}", e))?;

    // Persist annotation and return its ID
    state.storage
        .create(zim_uuid, url, storage_region, body)
        .map_err(|e| e.to_string())
}

/// E-CMD-15: Remove annotation
#[tauri::command]
pub fn annotations_delete(id: u64, state: State<AppState>) -> Result<(), String> {
    state.storage.delete(id).map_err(|e| e.to_string())
}

/// E-CMD-16: Export to JSON (legacy non-sidecar export)
#[tauri::command]
pub fn annotations_export(handle: Option<u64>, state: State<AppState>) -> Result<String, String> {
    use anzimmermanlib::ZimReader;

    let zim_uuid = match handle {
        Some(h) => {
            let zim_readers = state.zim.lock().map_err(|e| format!("ZIM mutex poisoned: {}", e))?;
            let reader = zim_readers
                .get(h as usize)
                .ok_or_else(|| format!("Invalid ZIM handle: {}", h))?;
            Some(reader.metadata().uuid)
        }
        None => None,
    };

    state.storage.export(zim_uuid).map_err(|e| e.to_string())
}

/// E-CMD-17: Import from JSON
#[tauri::command]
pub fn annotations_import(json: String, state: State<AppState>) -> Result<u32, String> {
    use crate::storage::annotations::AnnotationsStore;
    state.storage.import(&json).map_err(|e| e.to_string()).map(|count| count as u32)
}

/// E-STR-18: Bookmark row placeholder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: u64,
    pub zim_uuid: String,
    pub url: String,
    pub title: String,
    pub created_at: i64,
}

/// E-CMD-18: Enumerate bookmarks
#[tauri::command]
pub fn bookmarks_list(state: State<AppState>) -> Result<Vec<Bookmark>, String> {
    // Get all bookmarks from storage (no ZIM filter)
    let storage_bookmarks = state.storage
        .list(None)
        .map_err(|e| e.to_string())?;

    // Convert storage bookmarks to command bookmarks
    let command_bookmarks: Vec<Bookmark> = storage_bookmarks
        .into_iter()
        .map(|sb| Bookmark {
            id: sb.id,
            zim_uuid: sb.zim_uuid.to_string(),
            url: sb.url,
            title: sb.title,
            created_at: sb.created_at,
        })
        .collect();

    Ok(command_bookmarks)
}

/// E-CMD-19: Add/remove bookmark (toggle)
#[tauri::command]
pub fn bookmarks_toggle(handle: u64, url: String, state: State<AppState>) -> Result<bool, String> {
    use anzimmermanlib::ZimReader;
    use crate::storage::bookmarks::BookmarksStore;

    // Get ZIM reader and extract UUID
    let zim_readers = state.zim.lock().map_err(|e| format!("ZIM mutex poisoned: {}", e))?;
    let reader = zim_readers
        .get(handle as usize)
        .ok_or_else(|| format!("Invalid ZIM handle: {}", handle))?;
    let zim_uuid = reader.metadata().uuid;

    // Derive title from URL (last path component)
    let title = url.rsplit('/').next().unwrap_or(&url).to_string();

    // Toggle bookmark via BookmarksStore and return new state (true=added, false=removed)
    state.storage
        .toggle(zim_uuid, url, title)
        .map_err(|e| e.to_string())
}

/// E-STR-11: Chat message row placeholder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMsg {
    pub id: u64,
    pub session: u64,
    pub role: String,
    pub content: String,
    pub zim_handle: Option<u64>,
    pub ts: i64,
}

/// E-CMD-20: List recent messages from chat history
#[tauri::command]
pub fn chat_history_list(session_id: Option<u64>, state: State<AppState>) -> Result<Vec<ChatMsg>, String> {
    use crate::storage::chat::ChatHistoryStore;

    // Use a high limit to return all recent messages; frontend can paginate if needed
    let limit = 1000u32;

    let storage_msgs = state.storage
        .list(session_id, limit)
        .map_err(|e| e.to_string())?;

    // Convert storage ChatMsg to command ChatMsg (field-by-field, types are identical)
    let command_msgs: Vec<ChatMsg> = storage_msgs
        .into_iter()
        .map(|msg| ChatMsg {
            id: msg.id,
            session: msg.session,
            role: msg.role,
            content: msg.content,
            zim_handle: msg.zim_handle,
            ts: msg.ts,
        })
        .collect();

    Ok(command_msgs)
}

/// E-CMD-21: Persist a message to chat history
#[tauri::command]
pub fn chat_history_append(role: String, content: String, handle: Option<u64>, state: State<AppState>) -> Result<u64, String> {
    use crate::storage::chat::ChatHistoryStore;
    use crate::storage::chat::ChatMsg;

    let msg = ChatMsg {
        id: 0,  // Database assigns ID
        session: 0,  // Default session; future commands will accept session_id parameter
        role,
        content,
        zim_handle: handle,
        ts: chrono::Utc::now().timestamp_millis(),
    };

    state.storage.append(msg).map_err(|e| e.to_string())
}

/// E-CMD-22: Wipe session
#[tauri::command]
pub fn chat_history_clear(session_id: Option<u64>, state: State<AppState>) -> Result<u32, String> {
    use crate::storage::chat::ChatHistoryStore;
    state.storage.clear(session_id).map_err(|e| e.to_string())
}

/// E-CMD-23: Read settings KV
#[tauri::command]
pub fn settings_get(key: String, state: State<AppState>) -> Result<Option<String>, String> {
    use crate::storage::settings::SettingsStore;
    state.storage.get(&key).map_err(|e| e.to_string())
}

/// E-CMD-24: Write settings KV
#[tauri::command]
pub fn settings_set(key: String, value: String, state: State<AppState>) -> Result<(), String> {
    use crate::storage::settings::SettingsStore;
    state.storage.set(&key, &value).map_err(|e| e.to_string())
}

/// E-CMD-25: Feature-gate check
#[tauri::command]
pub fn entitlement_check(feature: String, state: State<AppState>) -> Result<bool, String> {
    state
        .entitlements
        .is_entitled(&feature)
        .map_err(|e| e.to_string())
}

/// E-CMD-26: Trigger RC paywall
#[tauri::command]
pub fn billing_open_paywall(state: State<AppState>) -> Result<(), String> {
    let paywall = PaywallController::new(
        state.entitlements.rc.clone(),
        state.entitlements.mode,
    );
    paywall.open()
}

/// E-CMD-27: Restore prior purchase
#[tauri::command]
pub fn billing_restore_purchases(state: State<AppState>) -> Result<RestoreResult, String> {
    let restorer = PurchaseRestorer {
        rc: state.entitlements.rc.clone(),
        storage: state.storage.clone(),
    };
    restorer.restore()
}

/// E-CMD-28: Device capability probe (cached after first call)
#[tauri::command]
pub fn device_probe(state: State<AppState>) -> Result<DeviceCapability, String> {
    static CAPABILITY_CACHE: OnceLock<DeviceCapability> = OnceLock::new();

    if let Some(cap) = CAPABILITY_CACHE.get() {
        return Ok(cap.clone());
    }
    let cap = DeviceProbe::probe().map_err(|e| e.to_string())?;
    let _ = CAPABILITY_CACHE.set(cap.clone());
    Ok(cap)
}

/// E-CMD-29: Currently active LLM variant
#[tauri::command]
pub fn variant_current(state: State<AppState>) -> Result<Variant, String> {
    use crate::launch::variant_picker::VariantPicker;
    use crate::storage::settings::setting_key::AI_VARIANT_OVERRIDE;

    // Get cached device capability (probe once per session)
    let cap = state.capability.get().ok_or("Device capability not probed")?;

    // Check if user has set an explicit override
    let override_opt = state.storage.get(AI_VARIANT_OVERRIDE)
        .map_err(|e| e.to_string())?
        .and_then(|json| serde_json::from_str::<VariantOverride>(&json).ok());

    match override_opt {
        Some(override_) => {
            // Use override to pick variant
            Ok(VariantPicker::pick_with_override(cap, override_))
        }
        None => {
            // No override set - use probe-based selection
            Ok(VariantPicker::pick(cap))
        }
    }
}

/// E-CMD-30: Set/clear user-explicit variant override
#[tauri::command]
pub fn variant_override(override_: VariantOverride, state: State<AppState>) -> Result<(), String> {
    use crate::storage::settings::setting_key::AI_VARIANT_OVERRIDE;

    // Serialize the override to JSON and store in settings
    let json = serde_json::to_string(&override_).map_err(|e| e.to_string())?;
    state.storage.set(AI_VARIANT_OVERRIDE, &json).map_err(|e| e.to_string())?;

    Ok(())
}

/// E-CMD-31: Fetch variant weights with progress channel
#[tauri::command]
pub async fn model_fetch(
    variant: Variant,
    progress: Channel<DownloadProgress>,
    state: State<'_, AppState>,
) -> Result<PathBuf, String> {
    state.fetcher.fetch(variant, progress).await.map_err(|e| e.to_string())
}

/// E-CMD-32: Are weights on disk
#[tauri::command]
pub fn model_present(variant: Variant, state: State<AppState>) -> Result<bool, String> {
    Ok(state.fetcher.is_present(variant))
}

/// E-CMD-33: Build + sign sidecar from payload
#[tauri::command]
pub fn sidecar_create(
    payload: Payload,
    zim_handle: u64,
    scope: Option<String>,
    state: State<AppState>,
) -> Result<Sidecar, String> {
    use anzimmermanlib::ZimReader;
    use uuid::Uuid;

    // Resolve ZIM handle to get the ZIM UUID
    let zim_readers = state.zim.lock().map_err(|e| format!("ZIM mutex poisoned: {}", e))?;
    let reader = zim_readers
        .get(zim_handle as usize)
        .ok_or_else(|| format!("Invalid ZIM handle: {}", zim_handle))?;

    // Get the ZIM UUID as 16 bytes
    let zim_uuid = reader.metadata().uuid;

    // Generate a unique artifact ID (UUIDv7)
    let artifact_id = Uuid::new_v4().into_bytes();

    // Get the current timestamp
    let created_at = chrono::Utc::now().timestamp();

    // Get the author identity from the sidecar signer
    let signer_pubkey = state.sidecar_signer.pubkey();
    let author = PeerIdentity {
        pubkey: signer_pubkey,
        handle: None,
        device: None,
    };

    // Build the initial sidecar (without signature)
    let mut sidecar = Sidecar {
        schema_version: 1,
        artifact_id,
        zim_uuid,
        zim_url_scope: scope,
        created_at,
        author,
        payload,
        refs: Vec::new(),
        signature_envelope: None,
        provenance: None,
    };

    // Sign the sidecar
    state
        .sidecar_signer
        .sign(&mut sidecar)
        .map_err(|e| format!("Signing error: {}", e))?;

    // Verify the sidecar signature
    let verified_sidecar = SidecarVerifier::verify(&sidecar)
        .map_err(|e| format!("Verification failed: {}", e))?;

    // Store the verified sidecar
    state
        .sidecar_store
        .write(&verified_sidecar)
        .map_err(|e| format!("Storage error: {}", e))?;

    // Return the signed sidecar
    Ok(sidecar)
}

/// E-CMD-34: Canonical CBOR bytes for named sidecar
#[tauri::command]
pub fn sidecar_export(artifact_id: String, state: State<AppState>) -> Result<Vec<u8>, String> {
    use std::fs;

    // Scan each ZIM directory in the sidecar store to find the artifact
    let entries = fs::read_dir(&state.sidecar_store.root)
        .map_err(|e| format!("Failed to read sidecar store: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let zim_dir = entry.path();

        // Skip non-directories (each ZIM UUID is a subdirectory)
        if !zim_dir.is_dir() {
            continue;
        }

        // Build the expected file path: <zim_dir>/<artifact_id>.zsc
        let file_path = zim_dir.join(format!("{}.zsc", artifact_id));

        // Try to read the file (silently skip if not found in this ZIM directory)
        if let Ok(bytes) = fs::read(&file_path) {
            return Ok(bytes);
        }
    }

    // Not found in any ZIM directory
    Err(format!("Sidecar not found: {}", artifact_id))
}

/// E-CMD-35: Debug-export as JSON
#[tauri::command]
pub fn sidecar_export_json(artifact_id: String, state: State<AppState>) -> Result<String, String> {
    use crate::sidecar::codec::SidecarCodec;
    use std::fs;

    // Parse artifact_id from hex string to [u8; 16]
    let artifact_id_bytes = hex::decode(&artifact_id)
        .map_err(|e| format!("Invalid hex artifact_id: {}", e))?;
    if artifact_id_bytes.len() != 16 {
        return Err(format!("Invalid artifact_id length: expected 16 bytes, got {}", artifact_id_bytes.len()));
    }
    let mut artifact_id_array = [0u8; 16];
    artifact_id_array.copy_from_slice(&artifact_id_bytes);

    // Scan the store root for ZIM directories
    let store = &state.sidecar_store;
    let mut zim_uuid_opt: Option<[u8; 16]> = None;

    let zim_dirs = fs::read_dir(&store.root)
        .map_err(|e| format!("Failed to read store directory: {}", e))?;

    for zim_dir_entry in zim_dirs {
        let zim_dir_entry = zim_dir_entry
            .map_err(|e| format!("Failed to read ZIM directory entry: {}", e))?;
        let zim_path = zim_dir_entry.path();

        // Skip non-directories
        if !zim_path.is_dir() {
            continue;
        }

        // Check if the artifact file exists in this ZIM directory
        let artifact_path = zim_path.join(format!("{}.zsc", &artifact_id));
        if artifact_path.exists() {
            // Parse ZIM UUID from directory name (hex-encoded)
            let zim_dir_name = zim_path.file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| "Invalid ZIM directory name: unable to extract filename".to_string())?;

            let zim_uuid_bytes = hex::decode(zim_dir_name)
                .map_err(|e| format!("Invalid hex ZIM UUID in directory name: {}", e))?;
            if zim_uuid_bytes.len() != 16 {
                continue; // Skip invalid ZIM directories
            }
            let mut zim_uuid_array = [0u8; 16];
            zim_uuid_array.copy_from_slice(&zim_uuid_bytes);
            zim_uuid_opt = Some(zim_uuid_array);
            break;
        }
    }

    let zim_uuid = zim_uuid_opt
        .ok_or_else(|| format!("Sidecar with artifact_id {} not found in store", artifact_id))?;

    // Read the sidecar from the store
    let sidecar = store.read(artifact_id_array, zim_uuid)
        .map_err(|e| format!("Failed to read sidecar: {}", e))?;

    // Encode to JSON debug format
    let json_string = SidecarCodec::encode_json_debug(&sidecar)
        .map_err(|e| format!("Failed to encode JSON: {}", e))?;

    Ok(json_string)
}

/// E-CMD-36: Decode + verify + trust + store
#[tauri::command]
pub fn sidecar_import(bytes: Vec<u8>, state: State<AppState>) -> Result<SidecarMeta, String> {
    use crate::sidecar::codec::SidecarCodec;
    use crate::sidecar::verify::SidecarVerifier;
    use crate::sidecar::Payload;

    // 1. Decode bytes to Sidecar
    let sidecar = SidecarCodec::decode_cbor(&bytes)
        .map_err(|e| format!("decode failed: {}", e))?;

    // 2. Verify signature and trust using SidecarVerifier + TrustDb
    let trusted = SidecarVerifier::verify_with_trust(&sidecar, &state.trust_db)
        .map_err(|e| format!("verification failed: {}", e))?;

    // 3. Store using SidecarStore
    let path = state.sidecar_store.write(&trusted.inner)
        .map_err(|e| format!("store failed: {}", e))?;

    // 4. Build SidecarMeta for return
    let kind = match &sidecar.payload {
        Payload::AnnotationSet(_) => "annotation_set".to_string(),
        Payload::BookmarkSet(_) => "bookmark_set".to_string(),
        Payload::ReadingLog(_) => "reading_log".to_string(),
        Payload::ComprehensionResponse(_) => "comprehension_response".to_string(),
        Payload::VoiceNoteCollection(_) => "voice_note_collection".to_string(),
        Payload::TrustMarkUpdate(_) => "trust_mark_update".to_string(),
        Payload::Manifest(_) => "manifest".to_string(),
        Payload::Unknown { kind, .. } => kind.clone(),
    };

    let meta = SidecarMeta {
        artifact_id: sidecar.artifact_id,
        zim_uuid: sidecar.zim_uuid,
        kind,
        signer_pubkey: trusted.inner.signer_pubkey,
        created_at: sidecar.created_at,
        path: path.clone(),
    };

    // 5. Update sidecar index
    state.storage.with_conn(|conn| {
        conn.execute(
            "INSERT OR REPLACE INTO sidecar_index
             (artifact_id, zim_uuid, kind, signer_pubkey, created_at, path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            [
                meta.artifact_id.as_slice(),
                meta.zim_uuid.as_slice(),
                meta.kind.as_str(),
                meta.signer_pubkey.as_slice(),
                &meta.created_at,
                meta.path.to_str().ok_or("Invalid path")?,
            ],
        )
    }).map_err(|e| format!("index update failed: {}", e))?;

    Ok(meta)
}

/// E-CMD-37: List sidecars for ZIM/URL
#[tauri::command]
pub fn sidecar_list(zim_uuid: String, url_prefix: Option<String>, state: State<AppState>) -> Result<Vec<SidecarMeta>, String> {
    use crate::sidecar::store::StoreError;

    // Decode the ZIM UUID from hex string to [u8; 16]
    let mut zim_uuid_bytes = [0u8; 16];
    hex::decode_to_slice(&zim_uuid, &mut zim_uuid_bytes)
        .map_err(|e| format!("Invalid ZIM UUID hex: {}", e))?;

    // Extract URL prefix, default to empty string if None
    let url_prefix_str = url_prefix.as_deref().unwrap_or("");

    // Query the sidecar index
    let metas = state.sidecar_index
        .find_for_url(zim_uuid_bytes, url_prefix_str)
        .map_err(|e| e.to_string())?;

    Ok(metas)
}

/// E-CMD-38: Remove sidecar from store
#[tauri::command]
pub fn sidecar_delete(artifact_id: String, state: State<AppState>) -> Result<(), String> {
    // Decode artifact_id from hex string to [u8; 16]
    let mut artifact_id_bytes = [0u8; 16];
    hex::decode_to_slice(&artifact_id, &mut artifact_id_bytes)
        .map_err(|e| format!("Invalid artifact_id hex: {}", e))?;

    // Query index to find zim_uuid for this artifact_id
    let zim_uuid = state.storage.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT zim_uuid FROM sidecar_index WHERE artifact_id = ?1 LIMIT 1"
        ).map_err(|e| format!("Prepare failed: {}", e))?;

        let mut rows = stmt.query_map([artifact_id_bytes.as_slice()], |row| {
            row.get::<_, [u8; 16]>(0)
        }).map_err(|e| format!("Query failed: {}", e))?;

        match rows.next() {
            Some(Ok(zim_uuid)) => Ok::<_, String>(Some(zim_uuid)),
            Some(Err(e)) => Err(format!("Row parse failed: {}", e)),
            None => Ok(None),
        }
    }).map_err(|e| format!("Index query failed: {}", e))??;

    let zim_uuid = zim_uuid.ok_or_else(|| {
        format!("Sidecar not found: {}", artifact_id)
    })?;

    // Delete from filesystem via SidecarStore
    state.sidecar_store.delete(artifact_id_bytes, zim_uuid)
        .map_err(|e| format!("File deletion failed: {}", e))?;

    // Delete from index
    state.storage.with_conn(|conn| {
        conn.execute(
            "DELETE FROM sidecar_index WHERE artifact_id = ?1",
            [artifact_id_bytes.as_slice()],
        )
    }).map_err(|e| format!("Index deletion failed: {}", e))?;

    Ok(())
}

/// E-CMD-39: Read peer trust level
#[tauri::command]
pub fn trust_get(pubkey: String, state: State<AppState>) -> Result<Option<TrustLevel>, String> {
    use crate::sidecar::trust::TrustDb;
    use hex::FromHex;

    // Parse pubkey from hex string to bytes
    let pubkey_bytes = <[u8; 32]>::from_hex(&pubkey)
        .map_err(|e| format!("Invalid pubkey hex: {}", e))?;

    // Query trust database, returning None for unknown peer
    let result = state.trust_db.get(&pubkey_bytes)
        .map_err(|e| e.to_string())?;

    Ok(result)
}

/// E-CMD-40: Set/edit/revoke trust mark
#[tauri::command]
pub fn trust_set(
    pubkey: String,
    level: TrustLevel,
    scope: Option<String>,
    expires_at: Option<i64>,
    reason: Option<String>,
    state: State<AppState>,
) -> Result<(), String> {
    use crate::sidecar::trust::{TrustDb, TrustEntry};
    use hex::FromHex;

    // Parse pubkey from hex string to bytes
    let pubkey_bytes = <[u8; 32]>::from_hex(&pubkey)
        .map_err(|e| format!("Invalid pubkey hex: {}", e))?;

    // Build trust entry
    let entry = TrustEntry {
        pubkey: pubkey_bytes,
        level,
        scope,
        expires_at,
        reason,
    };

    // Revoke or set trust mark via TrustDb
    if level == crate::sidecar::trust::TrustLevel::Revoked {
        state.trust_db.remove(&pubkey_bytes)
            .map_err(|e| e.to_string())?;
    } else {
        state.trust_db.set(entry)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// E-CMD-41: List all trust entries
#[tauri::command]
pub fn trust_list(state: State<AppState>) -> Result<Vec<TrustEntry>, String> {
    state.trust_db.list().map_err(|e| e.to_string())
}

/// E-CMD-42: Feed received LoRa chunk
#[tauri::command]
pub fn chunk_ingest(chunk_bytes: Vec<u8>, state: State<AppState>) -> Result<ReassembleStatus, String> {
    use crate::sidecar::chunk::ChunkReassembler;

    // Deserialize chunk from CBOR bytes
    let chunk: Chunk = ciborium::from_reader(&*chunk_bytes)
        .map_err(|e| format!("Failed to deserialize chunk: {}", e))?;

    // Feed chunk to reassembler and return status
    let mut reassembler = state.chunk_reassembler.lock().unwrap();
    Ok(reassembler.ingest(chunk))
}

/// E-CMD-43: List ZIM packs in operator catalog
#[tauri::command]
pub fn pack_catalog_list(state: State<AppState>) -> Result<Vec<ZimPack>, String> {
    state.pack_catalog.list().map_err(|e| e.to_string())
}

/// E-CMD-44: Download + install a ZIM pack
#[tauri::command]
pub async fn pack_install(pack_id: String, progress: Channel<PackProgress>, state: State<'_, AppState>) -> Result<PathBuf, String> {
    state.pack_catalog.install(&pack_id, progress).await.map_err(|e| e.to_string())
}

/// E-CMD-45: Remove an installed ZIM pack
#[tauri::command]
pub fn pack_uninstall(pack_id: String, state: State<AppState>) -> Result<(), String> {
    state.pack_catalog.uninstall(&pack_id).map_err(|e| e.to_string())
}

/// E-GSRCH-2: Global search result with ZIM attribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchHit {
    pub zim_uuid: String,
    pub zim_title: String,
    pub url: String,
    pub article_title: String,
    pub score: f32,
}

/// E-CMD-46: Search across all installed ZIMs
#[tauri::command]
pub fn pack_search_global(query: String, limit: u32, state: State<AppState>) -> Result<Vec<GlobalSearchHit>, String> {
    use crate::global_search::GlobalSearchHit as InternalGlobalSearchHit;

    // Delegate to GlobalSearcher, mapping error types
    let internal_hits = state.global_searcher.search(&query, limit, &state)
        .map_err(|e| e.to_string())?;

    // Convert internal GlobalSearchHit (zim_uuid: Uuid) to command GlobalSearchHit (zim_uuid: String)
    let hits: Vec<GlobalSearchHit> = internal_hits.into_iter().map(|hit| {
        GlobalSearchHit {
            zim_uuid: hit.zim_uuid.to_string(),
            zim_title: hit.zim_title,
            url: hit.url,
            article_title: hit.article_title,
            score: hit.score,
        }
    }).collect();

    Ok(hits)
}

/// E-CMD-47: Poll release channel
#[tauri::command]
pub async fn app_update_check(state: State<'_, AppState>) -> Result<Option<UpdateManifest>, String> {
    use crate::app_update::stage_manifest;

    // Poll the release channel via AppUpdater::check
    let result = state.app_updater.check().map_err(|e| e.to_string())?;

    // Stage the manifest for later application by app_update_apply
    if let Some(ref manifest) = result {
        stage_manifest(manifest.clone());
    }

    Ok(result)
}

/// E-CMD-48: Stage + restart with new binary (sideload/desktop only)
#[tauri::command]
pub async fn app_update_apply(state: State<'_, AppState>) -> Result<(), String> {
    use crate::app_update::get_staged_manifest;

    // Get the manifest that was staged by app_update_check
    let manifest = get_staged_manifest()
        .ok_or_else(|| "No update staged. Call app_update_check first.".to_string())?;

    // Apply the update via AppUpdater::apply
    state.app_updater.apply(&manifest).map_err(|e| e.to_string())
}

/// E-CMD-49: Persist current window pos/size
#[tauri::command]
pub fn window_state_save(window: tauri::Window, state: State<AppState>) -> Result<(), String> {
    use tauri::Manager;

    // Read current window geometry
    let outer_pos = window.outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;
    let inner_size = window.inner_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;
    let maximized = window.is_maximized()
        .map_err(|e| format!("Failed to get maximized state: {}", e))?;
    let fullscreen = window.is_fullscreen()
        .map_err(|e| format!("Failed to get fullscreen state: {}", e))?;

    // Build WindowState from current geometry
    let window_state = WindowState {
        x: outer_pos.x,
        y: outer_pos.y,
        width: inner_size.width,
        height: inner_size.height,
        maximized,
        fullscreen,
    };

    // Persist via WindowStateStore
    state.window_state_store.save(&window_state)
        .map_err(|e| e.to_string())
}

/// E-CMD-50: Restore window pos/size on launch
#[tauri::command]
pub fn window_state_restore(state: State<AppState>) -> Result<WindowState, String> {
    state.window_state_store.restore()
        .map_err(|e| e.to_string())
}

/// E-CMD-51: INV-OFFLINE fallback to network model_fetch — scan mounted media for variant weights, sha256-verify against MirrorManifest, copy into models_dir
#[tauri::command]
pub async fn model_import_from_media(
    variant: Variant,
    progress: Channel<DownloadProgress>,
    state: State<'_, AppState>,
) -> Result<PathBuf, String> {
    use crate::model_fetcher::media::MediaImporter;
    use crate::model_fetcher::manifest::{MirrorManifestVerifier, MIRROR_PUBLIC_KEY};

    let verifier = MirrorManifestVerifier::new(MIRROR_PUBLIC_KEY)
        .map_err(|e| format!("Failed to initialize verifier: {:?}", e))?;

    let models_dir = state.paths.models_dir.clone();

    // Scan for signed mirror-manifest.json on external media
    let mut manifest_opt = None;
    let search_paths = crate::model_fetcher::media::MEDIA_SEARCH_PATHS;
    for root in search_paths {
        let manifest_path = PathBuf::from(root).join("mirror-manifest.json");
        if manifest_path.exists() {
            if let Ok(content) = std::fs::read(&manifest_path) {
                if let Ok(manifest) = serde_json::from_slice::<crate::model_fetcher::manifest::MirrorManifest>(&content) {
                    if verifier.verify(&content, &manifest).is_ok() {
                        manifest_opt = Some(manifest);
                        break;
                    }
                }
            }
        }
    }

    let manifest = manifest_opt.unwrap_or_else(|| {
        crate::model_fetcher::manifest::MirrorManifest {
            schema_version: 1,
            generated_at: 0,
            variants: vec![
                crate::model_fetcher::manifest::ManifestEntry {
                    variant: Variant::Qwen3_06B_Q4,
                    mirror_url: "".to_string(),
                    sha256: [0u8; 32],
                    size_bytes: 0,
                    upstream_url_of_record: "".to_string(),
                },
                crate::model_fetcher::manifest::ManifestEntry {
                    variant: Variant::GemmaE2bQ4,
                    mirror_url: "".to_string(),
                    sha256: [0u8; 32],
                    size_bytes: 0,
                    upstream_url_of_record: "".to_string(),
                }
            ],
            signature: vec![],
        }
    });

    let importer = MediaImporter::new(models_dir, verifier, manifest);
    importer.scan_and_import(variant, progress).await.map_err(|e| e.to_string())
}

