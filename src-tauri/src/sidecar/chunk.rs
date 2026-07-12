// LoRa-friendly chunking for sidecar transport

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::sidecar::{Sidecar, codec::CodecError};

/// LoRa-friendly chunked sidecar packet
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Chunk {
    /// Unique artifact identifier (UUIDv7)
    pub artifact_id: [u8; 16],
    /// Zero-based chunk index
    pub chunk_index: u32,
    /// Total number of chunks for this artifact
    pub total_chunks: u32,
    /// Partial payload data for this chunk
    pub payload_part: Vec<u8>,
}

/// Chunk ingest result for reassembly tracking
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReassembleStatus {
    /// Still waiting for more chunks
    Pending { received: u32, total: u32 },
    /// All chunks received and reassembled into complete sidecar
    Complete(Sidecar),
    /// Reassembly failed (codec error, duplicate, or malformed chunk)
    Failed(CodecError),
}

/// Splits CBOR sidecar into LoRa-friendly chunks
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChunkEncoder {
    /// Maximum payload bytes per chunk
    pub max_payload_bytes: usize,
}

impl ChunkEncoder {
    /// Create a new encoder with the specified max payload size
    pub fn new(max_payload_bytes: usize) -> Self {
        Self { max_payload_bytes }
    }

    /// Encode a sidecar into chunks
    pub fn encode(&self, sidecar: &Sidecar) -> Result<Vec<Chunk>, CodecError> {
        use crate::sidecar::codec;

        // Serialize sidecar to CBOR
        let cbor_bytes = codec::SidecarCodec::encode_cbor(sidecar)?;

        // Calculate total chunks needed
        let total_chunks = (cbor_bytes.len() + self.max_payload_bytes - 1) / self.max_payload_bytes;
        let total_chunks = total_chunks as u32;

        let mut chunks = Vec::with_capacity(total_chunks as usize);

        // Split into chunks
        for (i, chunk_bytes) in cbor_bytes.chunks(self.max_payload_bytes).enumerate() {
            chunks.push(Chunk {
                artifact_id: sidecar.artifact_id,
                chunk_index: i as u32,
                total_chunks,
                payload_part: chunk_bytes.to_vec(),
            });
        }

        Ok(chunks)
    }
}

/// Buffer for tracking in-progress chunk reassembly for a single artifact
#[derive(Debug)]
struct ChunkBuffer {
    /// Total number of chunks expected
    total_chunks: u32,
    /// Received chunks: chunk_index -> payload part
    received_chunks: HashMap<u32, Vec<u8>>,
    /// Creation timestamp (for cleanup)
    created_at: i64,
}

impl ChunkBuffer {
    /// Create a new chunk buffer
    fn new(total_chunks: u32, created_at: i64) -> Self {
        Self {
            total_chunks,
            received_chunks: HashMap::new(),
            created_at,
        }
    }

    /// Check if all chunks have been received
    fn is_complete(&self) -> bool {
        self.received_chunks.len() as u32 == self.total_chunks
    }
}

/// Buffers and reassembles received chunks into complete sidecars
#[derive(Debug)]
pub struct ChunkReassembler {
    /// Active reassembly buffers, keyed by artifact_id
    buffers: HashMap<[u8; 16], ChunkBuffer>,
}

impl ChunkReassembler {
    /// Create a new chunk reassembler
    pub fn new() -> Self {
        Self {
            buffers: HashMap::new(),
        }
    }

    /// Ingest a received chunk and return reassembly status
    pub fn ingest(&mut self, chunk: Chunk) -> ReassembleStatus {
        use crate::sidecar::codec;

        // Get or create buffer for this artifact
        let entry = self.buffers.entry(chunk.artifact_id);

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let buffer = entry.or_insert_with(|| {
            ChunkBuffer::new(chunk.total_chunks, now)
        });

        // Validate chunk index
        if chunk.chunk_index >= chunk.total_chunks {
            return ReassembleStatus::Failed(CodecError::InvalidChunkIndex {
                index: chunk.chunk_index,
                total: chunk.total_chunks,
            });
        }

        // Check for duplicate chunk
        if buffer.received_chunks.contains_key(&chunk.chunk_index) {
            return ReassembleStatus::Failed(CodecError::DuplicateChunk {
                index: chunk.chunk_index,
            });
        }

        // Store the chunk payload
        buffer.received_chunks.insert(chunk.chunk_index, chunk.payload_part);

        // Check if reassembly is complete
        if buffer.is_complete() {
            // Reassemble chunks in order
            let mut cbor_bytes = Vec::new();
            for i in 0..buffer.total_chunks {
                match buffer.received_chunks.get(&i) {
                    Some(payload) => cbor_bytes.extend_from_slice(payload),
                    None => {
                        return ReassembleStatus::Failed(CodecError::MissingChunk {
                            index: i,
                        });
                    }
                }
            }

            // Remove the buffer
            self.buffers.remove(&chunk.artifact_id);

            // Decode CBOR to Sidecar
            match codec::SidecarCodec::decode_cbor(&cbor_bytes) {
                Ok(sidecar) => ReassembleStatus::Complete(sidecar),
                Err(e) => ReassembleStatus::Failed(e),
            }
        } else {
            let received = buffer.received_chunks.len() as u32;
            ReassembleStatus::Pending {
                received,
                total: buffer.total_chunks,
            }
        }
    }

    /// Remove expired buffers older than the given timestamp threshold
    pub fn cleanup_expired(&mut self, threshold_timestamp: i64) {
        self.buffers
            .retain(|_, buffer| buffer.created_at >= threshold_timestamp);
    }
}

impl Default for ChunkReassembler {
    fn default() -> Self {
        Self::new()
    }
}
