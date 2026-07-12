// Tauri command invoke wrappers — one typed export per Tauri command (§7.1 E-FE-2)
import { invoke } from '@tauri-apps/api/core';

// Result types matching backend responses (§7.1)
export interface ZimMetaJson { uuid: string; title: string; article_count: number; main_page_url: string | null; }
export interface SearchHit { url: string; title: string; score: number; }
export interface Annotation { id: number; zim_uuid: string; url: string; region: Region; body: string; created_at: number; }
export interface Region { Char?: { start: number; end: number }; Page?: null; Custom?: string; }
export interface Bookmark { id: number; zim_uuid: string; url: string; title: string; created_at: number; }
export interface ChatMsg { id: number; session: number; role: string; content: string; zim_handle: number | null; ts: number; }
export interface RestoreResult { restored: number; errors: string[]; }
export interface DeviceCapability { has_gpu: boolean; has_microphone: boolean; has_speaker: boolean; platform: string; arch: string; }
export enum Variant { Qwen3_06B_Q4 = 'Qwen3_06B_Q4', GemmaE2bQ4 = 'GemmaE2bQ4', }
export interface DownloadProgress { bytes_downloaded: number; total_bytes: number; phase: 'connecting' | 'downloading' | 'verifying' | 'complete'; }
export interface Sidecar { schema_version: number; artifact_id: number[]; zim_uuid: number[]; zim_url_scope: string | null; created_at: number; author: PeerIdentity; payload: Payload; refs: SidecarRef[]; signature_envelope: SignatureEnvelope | null; provenance: Provenance | null; }
export interface PeerIdentity { pubkey: number[]; handle: string | null; device: string | null; }
export interface SidecarRef { artifact_id: number[]; pubkey: number[]; relation: string; }
export interface SignatureEnvelope { alg: string; pubkey: number[]; signature: number[]; signed_at: number; }
export interface Provenance { reader_version: string; reader_variant: string | null; device_class: string | null; network_context: string | null; cleanroom: boolean | null; }
export interface Payload { kind: string; body: unknown; }
export interface SidecarMeta { artifact_id: string; zim_uuid: string; kind: string; signer_pubkey: string; created_at: number; path: string; }
export enum TrustLevel { Trusted = 'Trusted', Verified = 'Verified', Rejected = 'Rejected', Unknown = 'Unknown', }
export interface TrustEntry { pubkey: string; level: TrustLevel; scope: string | null; expires_at: number | null; reason: string | null; source: { Manual?: null; Gossip?: { from_pubkey: string }; Operator?: null }; }
export enum ReassembleStatus { Pending = 'Pending', Complete = 'Complete', Failed = 'Failed', }
export interface ZimPack { pack_id: string; name: string; description: string; size_bytes: number; checksum: string; download_url: string; }
export interface PackProgress { pack_id: string; bytes_downloaded: number; total_bytes: number; phase: 'connecting' | 'downloading' | 'installing' | 'complete'; }
export interface GlobalSearchHit { zim_uuid: string; zim_title: string; url: string; title: string; snippet: string; }
export interface UpdateManifest { version: string; notes: string; pub_date: string; signature: string; url: string; }
export interface WindowState { x: number; y: number; width: number; height: number; is_maximized: boolean; }

// E-CMD-1: Library version → frontend
export const enzimeVersion = (): Promise<string> => invoke<string>('enzime_version');
// E-CMD-2: Open ZIM, return handle
export const zimOpen = (path: string): Promise<number> => invoke<number>('zim_open', { path });
// E-CMD-3: Fetch article by handle+url
export const zimGetArticle = (handle: number, url: string): Promise<string> => invoke<string>('zim_get_article', { handle, url });
// E-CMD-4: Paginated article URL list
export const zimListArticles = (handle: number, offset: number, limit: number): Promise<string[]> => invoke<string[]>('zim_list_articles', { handle, offset, limit });
// E-CMD-5: Title/uuid/article_count
export const zimMetadata = (handle: number): Promise<ZimMetaJson> => invoke<ZimMetaJson>('zim_metadata', { handle });
// E-CMD-6: Release handle
export const zimClose = (handle: number): Promise<void> => invoke<void>('zim_close', { handle });
// E-CMD-7: Single-ZIM prefix/text search
export const zimSearch = (handle: number, query: string, limit: number): Promise<SearchHit[]> => invoke<SearchHit[]>('zim_search', { handle, query, limit });
// E-CMD-8: Non-streaming completion
export const aiChat = (prompt: string, zimHandle: number | null): Promise<string> => invoke<string>('ai_chat', { prompt, zimHandle });
// E-CMD-9: Streaming via Tauri Channel
export const aiChatStream = (prompt: string, zimHandle: number | null, onEvent: (event: string) => void): Promise<void> => invoke<void>('ai_chat_stream', { prompt, zimHandle, onEvent });
// E-CMD-10: PCM in → text reply (Gemma-tier only)
export const aiVoiceChat = (pcmB64: string, sr: number, zimHandle: number | null): Promise<string> => invoke<string>('ai_voice_chat', { pcmB64, sr, zimHandle });
// E-CMD-11: Late-bind concrete LLM
export const aiLoadModel = (modelPath: string): Promise<void> => invoke<void>('ai_load_model', { modelPath });
// E-CMD-12: Revert to NullLlm
export const aiUnloadModel = (): Promise<void> => invoke<void>('ai_unload_model');
// E-CMD-13: Annotations per article
export const annotationsList = (handle: number, url: string): Promise<Annotation[]> => invoke<Annotation[]>('annotations_list', { handle, url });
// E-CMD-14: Create annotation
export const annotationsCreate = (handle: number, url: string, region: Region, body: string): Promise<number> => invoke<number>('annotations_create', { handle, url, region, body });
// E-CMD-15: Remove annotation
export const annotationsDelete = (id: number): Promise<void> => invoke<void>('annotations_delete', { id });
// E-CMD-16: Export to JSON (legacy non-sidecar export)
export const annotationsExport = (handle: number | null): Promise<string> => invoke<string>('annotations_export', { handle });
// E-CMD-17: Import from JSON
export const annotationsImport = (json: string): Promise<number> => invoke<number>('annotations_import', { json });
// E-CMD-18: Enumerate bookmarks
export const bookmarksList = (): Promise<Bookmark[]> => invoke<Bookmark[]>('bookmarks_list');
// E-CMD-19: Add/remove bookmark
export const bookmarksToggle = (handle: number, url: string): Promise<boolean> => invoke<boolean>('bookmarks_toggle', { handle, url });
// E-CMD-20: Recent messages
export const chatHistoryList = (sessionId: number | null): Promise<ChatMsg[]> => invoke<ChatMsg[]>('chat_history_list', { sessionId });
// E-CMD-21: Persist a message
export const chatHistoryAppend = (role: string, content: string, handle: number | null): Promise<number> => invoke<number>('chat_history_append', { role, content, handle });
// E-CMD-22: Wipe session
export const chatHistoryClear = (sessionId: number | null): Promise<number> => invoke<number>('chat_history_clear', { sessionId });
// E-CMD-23: Read settings KV
export const settingsGet = (key: string): Promise<string | null> => invoke<string | null>('settings_get', { key });
// E-CMD-24: Write settings KV
export const settingsSet = (key: string, value: string): Promise<void> => invoke<void>('settings_set', { key, value });
// E-CMD-25: Feature-gate check
export const entitlementCheck = (feature: string): Promise<boolean> => invoke<boolean>('entitlement_check', { feature });
// E-CMD-26: Trigger RC paywall
export const billingOpenPaywall = (): Promise<void> => invoke<void>('billing_open_paywall');
// E-CMD-27: Restore prior purchase
export const billingRestorePurchases = (): Promise<RestoreResult> => invoke<RestoreResult>('billing_restore_purchases');
// E-CMD-28: Capability probe (cached after first call)
export const deviceProbe = (): Promise<DeviceCapability> => invoke<DeviceCapability>('device_probe');
// E-CMD-29: Currently active LLM variant
export const variantCurrent = (): Promise<Variant> => invoke<Variant>('variant_current');
// E-CMD-30: Set/clear user-explicit override
export const variantOverride = (override_: Variant | null): Promise<void> => invoke<void>('variant_override', { override: override_ });
// E-CMD-31: Fetch variant weights with progress channel
export const modelFetch = (variant: Variant, onProgress: (progress: DownloadProgress) => void): Promise<string> => invoke<string>('model_fetch', { variant, onProgress });
// E-CMD-32: Are weights on disk
export const modelPresent = (variant: Variant): Promise<boolean> => invoke<boolean>('model_present', { variant });
// E-CMD-33: Build + sign sidecar from payload
export const sidecarCreate = (payload: Payload, zimHandle: number, scope: string | null): Promise<Sidecar> => invoke<Sidecar>('sidecar_create', { payload, zimHandle, scope });
// E-CMD-34: Canonical CBOR bytes for named sidecar
export const sidecarExport = (artifactId: string): Promise<number[]> => invoke<number[]>('sidecar_export', { artifactId });
// E-CMD-35: Debug-export as JSON
export const sidecarExportJson = (artifactId: string): Promise<string> => invoke<string>('sidecar_export_json', { artifactId });
// E-CMD-36: Decode + verify + trust + store
export const sidecarImport = (bytes: number[]): Promise<SidecarMeta> => invoke<SidecarMeta>('sidecar_import', { bytes });
// E-CMD-37: List sidecars for ZIM/URL
export const sidecarList = (zimUuid: string, urlPrefix: string | null): Promise<SidecarMeta[]> => invoke<SidecarMeta[]>('sidecar_list', { zimUuid, urlPrefix });
// E-CMD-38: Remove sidecar from store
export const sidecarDelete = (artifactId: string): Promise<void> => invoke<void>('sidecar_delete', { artifactId });
// E-CMD-39: Read peer trust level
export const trustGet = (pubkey: string): Promise<TrustLevel | null> => invoke<TrustLevel | null>('trust_get', { pubkey });
// E-CMD-40: Set/edit/revoke trust mark
export const trustSet = (pubkey: string, level: TrustLevel, scope: string | null, expiresAt: number | null, reason: string | null): Promise<void> => invoke<void>('trust_set', { pubkey, level, scope, expiresAt, reason });
// E-CMD-41: List all trust entries
export const trustList = (): Promise<TrustEntry[]> => invoke<TrustEntry[]>('trust_list');
// E-CMD-42: Feed received LoRa chunk
export const chunkIngest = (chunkBytes: number[]): Promise<ReassembleStatus> => invoke<ReassembleStatus>('chunk_ingest', { chunkBytes });
// E-CMD-43: List ZIM packs in operator catalog
export const packCatalogList = (): Promise<ZimPack[]> => invoke<ZimPack[]>('pack_catalog_list');
// E-CMD-44: Download + install a ZIM pack
export const packInstall = (packId: string, onProgress: (progress: PackProgress) => void): Promise<string> => invoke<string>('pack_install', { packId, onProgress });
// E-CMD-45: Remove an installed ZIM pack
export const packUninstall = (packId: string): Promise<void> => invoke<void>('pack_uninstall', { packId });
// E-CMD-46: Search across all installed ZIMs
export const packSearchGlobal = (query: string, limit: number): Promise<GlobalSearchHit[]> => invoke<GlobalSearchHit[]>('pack_search_global', { query, limit });
// E-CMD-47: Poll release channel
export const appUpdateCheck = (): Promise<UpdateManifest | null> => invoke<UpdateManifest | null>('app_update_check');
// E-CMD-48: Stage + restart with new binary (sideload/desktop only)
export const appUpdateApply = (): Promise<void> => invoke<void>('app_update_apply');
// E-CMD-49: Persist current window pos/size
export const windowStateSave = (): Promise<void> => invoke<void>('window_state_save');
// E-CMD-50: Restore window pos/size on launch
export const windowStateRestore = (): Promise<WindowState> => invoke<WindowState>('window_state_restore');
// E-CMD-51: INV-OFFLINE fallback to network model_fetch — scan mounted media for variant weights
export const modelImportFromMedia = (variant: Variant, onProgress: (progress: DownloadProgress) => void): Promise<string> => invoke<string>('model_import_from_media', { variant, onProgress });
