// Copyright (c) 2026 EnZIME Suite. All rights reserved.

use crate::pack_catalog::manifest::PACK_CATALOG_PUBLIC_KEY;
use crate::pack_catalog::progress::{PackProgress, PackStage};
use crate::pack_catalog::types::ZimPack;
use crate::pack_catalog::PackError;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::time::Duration;
use tauri::ipc::Channel;
use tokio::fs::{self, File};
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufWriter};
use tokio::time::timeout;

/// Peer-share manifest signed by the catalog public key.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PeerShareManifest {
    pub pack_id: String,
    pub pack_title: String,
    pub pack_sha256: String,
    pub pack_size_bytes: u64,
    pub signature: Vec<u8>,
}

/// LAN peer fetcher using mDNS service discovery.
#[derive(Debug, Clone)]
pub struct LanPeerPackFetcher {
    /// Directory where downloaded pack ZIM files are stored.
    pub packs_dir: PathBuf,
}

impl LanPeerPackFetcher {
    /// Create a new LAN peer pack fetcher.
    pub fn new(packs_dir: PathBuf) -> Self {
        Self { packs_dir }
    }

    /// Get the final path for a given pack ID.
    fn pack_path(&self, pack_id: &str) -> PathBuf {
        self.packs_dir.join(format!("{}.zim", pack_id))
    }

    /// Fetch a pack ZIM file from a LAN peer via mDNS discovery.
    ///
    /// Browses for EnZIME pack services on the local network via mDNS.
    /// On discovering a peer, downloads the pack via HTTP and verifies
    /// against a peer-share manifest signed with PACK_CATALOG_PUBLIC_KEY.
    /// Returns Err(Network) if no peer is found or verification fails,
    /// allowing install() to fall through to the mirror tier.
    pub async fn fetch(
        &self,
        pack: &ZimPack,
        progress: Channel<PackProgress>,
    ) -> Result<PathBuf, PackError> {
        let pack_id = &pack.id;
        let final_path = self.pack_path(pack_id);

        // Emit probing stage
        progress
            .send(PackProgress {
                pack_id: pack_id.clone(),
                bytes_downloaded: 0,
                bytes_total: pack.size_bytes,
                stage: PackStage::Probing,
            })
            .map_err(|e| PackError::Network(format!("progress send failed: {}", e)))?;

        // Create mDNS service browser
        let mdns = ServiceDaemon::new()
            .map_err(|e| PackError::Network(format!("mDNS init failed: {}", e)))?;

        // Browse for EnZIME pack services with a short timeout
        let receiver = mdns
            .browse("_enzime-pack._tcp")
            .map_err(|e| PackError::Network(format!("mDNS browse failed: {}", e)))?;

        // SHORT timeout for peer discovery (2 seconds)
        let discover_timeout = Duration::from_secs(2);
        let mut peer_info: Option<(String, u16)> = None;

        // Wait for first peer response with timeout
        let discover_result = timeout(discover_timeout, async {
            loop {
                match receiver.recv_async().await {
                    Ok(ServiceEvent::ServiceResolved(info)) => {
                        // Extract peer address and port from first resolved service
                        if let Some(addr) = info.get_address() {
                            let port = info.get_port();
                            return Some((addr.to_string(), port));
                        }
                    }
                    Ok(_) => continue, // Ignore other events
                    Err(_) => return None,
                }
            }
        })
        .await;

        match discover_result {
            Ok(Some(info)) => peer_info = Some(info),
            Ok(None) | Err(_) => {
                // No peer found within timeout or receiver error
                return Err(PackError::Network(
                    "no LAN peer found within timeout".to_string(),
                ));
            }
        }

        let (peer_host, peer_port) = peer_info.ok_or_else(|| {
            PackError::Network("no peer discovered".to_string())
        })?;

        // Emit downloading stage
        progress
            .send(PackProgress {
                pack_id: pack_id.clone(),
                bytes_downloaded: 0,
                bytes_total: pack.size_bytes,
                stage: PackStage::Downloading,
            })
            .map_err(|e| PackError::Network(format!("progress send failed: {}", e)))?;

        // Build peer URL for pack download
        let peer_url = format!("http://{}:{}/packs/{}.zim", peer_host, peer_port, pack_id);

        // Download pack from peer
        let http = reqwest::Client::new();
        let response = http
            .get(&peer_url)
            .send()
            .await
            .map_err(|e| PackError::Network(format!("peer GET failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(PackError::Network(format!(
                "peer returned status: {}",
                response.status()
            )));
        }

        // Download to temporary file
        let temp_path = self.packs_dir.join(format!("{}.zim.tmp", pack_id));
        let mut file = File::create(&temp_path)
            .await
            .map_err(|e| PackError::Storage(e))?;

        let mut downloaded = 0u64;
        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result
                .map_err(|e| PackError::Network(format!("stream error: {}", e)))?;

            file.write_all(&chunk)
                .await
                .map_err(|e| PackError::Storage(e))?;

            downloaded += chunk.len() as u64;

            progress
                .send(PackProgress {
                    pack_id: pack_id.clone(),
                    bytes_downloaded: downloaded,
                    bytes_total: pack.size_bytes,
                    stage: PackStage::Downloading,
                })
                .map_err(|e| PackError::Network(format!("progress send failed: {}", e)))?;
        }

        file.flush()
            .await
            .map_err(|e| PackError::Storage(e))?;
        file.sync_all()
            .await
            .map_err(|e| PackError::Storage(e))?;

        // Emit verifying stage
        progress
            .send(PackProgress {
                pack_id: pack_id.clone(),
                bytes_downloaded: downloaded,
                bytes_total: pack.size_bytes,
                stage: PackStage::Verifying,
            })
            .map_err(|e| PackError::Network(format!("progress send failed: {}", e)))?;

        // Fetch peer-share manifest for verification
        let manifest_url = format!("http://{}:{}/manifests/{}.json", peer_host, peer_port, pack_id);
        let manifest_response = http
            .get(&manifest_url)
            .send()
            .await
            .map_err(|e| PackError::Network(format!("manifest GET failed: {}", e)))?;

        if !manifest_response.status().is_success() {
            fs::remove_file(&temp_path)
                .await
                .map_err(|e| PackError::Storage(e))?;
            return Err(PackError::Network(format!(
                "manifest returned status: {}",
                manifest_response.status()
            )));
        }

        let manifest_bytes = manifest_response
            .bytes()
            .await
            .map_err(|e| PackError::Network(format!("manifest read failed: {}", e)))?;

        let manifest: PeerShareManifest = serde_json::from_slice(&manifest_bytes)
            .map_err(|_| {
                fs::remove_file(&temp_path)
                    .await
                    .ok();
                PackError::Verify("invalid manifest JSON".to_string())
            })?;

        // Verify pack ID matches
        if manifest.pack_id != *pack_id {
            fs::remove_file(&temp_path)
                .await
                .map_err(|e| PackError::Storage(e))?;
            return Err(PackError::Verify("pack ID mismatch".to_string()));
        }

        // Verify ed25519 signature using PACK_CATALOG_PUBLIC_KEY
        let public_key = VerifyingKey::from_bytes(PACK_CATALOG_PUBLIC_KEY)
            .map_err(|_| PackError::Verify("invalid public key".to_string()))?;

        let signature = Signature::from_slice(&manifest.signature)
            .map_err(|_| PackError::Verify("invalid signature".to_string()))?;

        // The signature covers the manifest JSON without the signature field
        let manifest_json = serde_json::to_string(&manifest)
            .map_err(|e| PackError::Verify(format!("manifest serialization failed: {}", e)))?;

        // Remove the signature field for verification
        let mut manifest_value: serde_json::Value = serde_json::from_str(&manifest_json)
            .map_err(|e| PackError::Verify(format!("manifest parse failed: {}", e)))?;
        manifest_value
            .as_object_mut()
            .unwrap()
            .remove("signature");
        let manifest_bytes = serde_json::to_vec(&manifest_value)
            .map_err(|e| PackError::Verify(format!("manifest encoding failed: {}", e)))?;

        public_key
            .verify(&manifest_bytes, &signature)
            .map_err(|_| {
                fs::remove_file(&temp_path)
                    .await
                    .ok();
                PackError::Verify("signature verification failed".to_string())
            })?;

        // Compute sha256 of downloaded file
        let file_bytes = fs::read(&temp_path)
            .await
            .map_err(|e| PackError::Storage(e))?;
        let computed_hash: [u8; 32] = Sha256::digest(&file_bytes).into();

        // Verify against pack.sha256
        if computed_hash != pack.sha256 {
            fs::remove_file(&temp_path)
                .await
                .map_err(|e| PackError::Storage(e))?;
            return Err(PackError::Verify("sha256 mismatch".to_string()));
        }

        // Atomic rename to final path
        fs::rename(&temp_path, &final_path)
            .await
            .map_err(|e| PackError::Storage(e))?;

        // Emit done stage
        progress
            .send(PackProgress {
                pack_id: pack_id.clone(),
                bytes_downloaded: downloaded,
                bytes_total: pack.size_bytes,
                stage: PackStage::Done,
            })
            .map_err(|e| PackError::Network(format!("progress send failed: {}", e)))?;

        Ok(final_path)
    }
}
