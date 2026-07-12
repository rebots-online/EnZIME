/// Compression algorithm for ZIM clusters
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Compression {
    None,
    Zstd,
    Lzma,
    Zlib,
}

impl Compression {
    /// Map a compression byte (ZIM format) to Compression variant
    ///
    /// ZIM spec compression byte values:
    /// - 0 = None (uncompressed)
    /// - 1 = Zstandard (zstd)
    /// - 2 = LZMA
    /// - 3 = Zlib/DEFLATE
    pub fn from(byte: u8) -> Result<Self, crate::error::ZimError> {
        match byte {
            0 => Ok(Compression::None),
            1 => Ok(Compression::Zstd),
            2 => Ok(Compression::Lzma),
            3 => Ok(Compression::Zlib),
            n => Err(crate::error::ZimError::UnsupportedCompression(n)),
        }
    }
}

/// Compressed blob bundle
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cluster {
    pub compression: Compression,
    pub blobs: Vec<Vec<u8>>,
}

/// Bounded LRU cache for decompressed cluster data
///
/// Caches decompressed cluster blobs by cluster index, evicting
/// least-recently-used entries when capacity is exceeded.
pub struct ClusterCache {
    map: lru::LruCache<u32, std::sync::Arc<Vec<Vec<u8>>>>,
    cap: usize,
}

impl ClusterCache {
    /// Create a new LRU cache with the specified capacity
    ///
    /// Panics if capacity is zero (LRU cache requires positive capacity)
    pub fn new(cap: usize) -> Self {
        Self {
            map: lru::LruCache::new(
                std::num::NonZeroUsize::new(cap).expect("ClusterCache capacity must be non-zero"),
            ),
            cap,
        }
    }

    /// Get cached cluster data or insert it using the provided closure
    ///
    /// Returns a cached Arc if present, otherwise calls `f` to produce the data,
    /// inserts it into the cache (evicting LRU entry if at capacity), and returns it.
    ///
    /// # Arguments
    /// * `key` - Cluster index to look up
    /// * `f` - Function that produces the cluster data (decompression operation)
    ///
    /// # Returns
    /// * `Ok(Arc<Vec<Vec<u8>>>)` - Cached or newly inserted cluster data
    /// * `Err(ZimError)` - Error from the closure `f`
    pub fn get_or_insert_with(
        &mut self,
        key: u32,
        f: impl FnOnce() -> Result<Vec<Vec<u8>>, crate::error::ZimError>,
    ) -> Result<std::sync::Arc<Vec<Vec<u8>>>, crate::error::ZimError> {
        if let Some(cached) = self.map.get(&key) {
            return Ok(std::sync::Arc::clone(cached));
        }

        let data = std::sync::Arc::new(f()?);
        self.map.put(key, std::sync::Arc::clone(&data));
        Ok(data)
    }
}

/// Decompress a cluster's byte data into individual blobs
///
/// Takes compressed cluster data and the compression algorithm used,
/// returns a vector of decompressed blob byte arrays.
///
/// The OpenZIM offset table format:
/// - n+1 little-endian u32 offsets at the start of the (decompressed) payload
/// - n = off[0]/4 - 1 (number of blobs)
/// - blob i = payload[off[i]..off[i+1]]
pub fn decompress_cluster(data: &[u8], compression: Compression) -> Result<Vec<Vec<u8>>, crate::error::ZimError> {
    use std::io::Read;

    // Step 1: Decompress the payload according to the compression algorithm
    let payload = match compression {
        Compression::None => {
            // Identity: no decompression needed
            data.to_vec()
        }
        Compression::Zstd => {
            // Zstd compression
            zstd::decode_all(data)
                .map_err(|e| crate::error::ZimError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?
        }
        Compression::Lzma => {
            // LZMA compression — ZIM stores LZMA clusters in the XZ container.
            let mut reader = std::io::BufReader::new(data);
            let mut decompressed = Vec::new();
            lzma_rs::xz_decompress(&mut reader, &mut decompressed)
                .map_err(|e| crate::error::ZimError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
            decompressed
        }
        Compression::Zlib => {
            // Zlib/DEFLATE compression
            let mut decoder = flate2::read::DeflateDecoder::new(data);
            let mut decompressed = Vec::new();
            decoder
                .read_to_end(&mut decompressed)
                .map_err(crate::error::ZimError::Io)?;
            decompressed
        }
    };

    // Step 2: Parse the offset table and split into blobs
    // The offset table has n+1 little-endian u32 offsets
    // n = off[0]/4 - 1

    if payload.len() < 4 {
        return Err(crate::error::ZimError::Truncated);
    }

    // Read the first offset to determine the number of blobs
    let first_offset = u32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]]) as usize;
    let n = first_offset / 4 - 1;

    if n == 0 {
        // Empty cluster (no blobs)
        return Ok(Vec::new());
    }

    // Calculate the total size of the offset table: (n + 1) * 4 bytes
    let offset_table_size = (n + 1) * 4;

    if payload.len() < offset_table_size {
        return Err(crate::error::ZimError::Truncated);
    }

    // Parse all offsets
    let mut offsets = Vec::with_capacity(n + 1);
    for i in 0..=n {
        let start = i * 4;
        let offset = u32::from_le_bytes([
            payload[start],
            payload[start + 1],
            payload[start + 2],
            payload[start + 3],
        ]) as usize;
        offsets.push(offset);
    }

    // Extract blobs using the offsets
    let mut blobs = Vec::with_capacity(n);
    for i in 0..n {
        let start = offsets[i];
        let end = offsets[i + 1];

        // Validate offsets
        if start > end || end > payload.len() {
            return Err(crate::error::ZimError::MalformedHeader);
        }

        blobs.push(payload[start..end].to_vec());
    }

    Ok(blobs)
}
