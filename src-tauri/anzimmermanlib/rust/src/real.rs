// Copyright 2026 Robin L. M. Cheung
// SPDX-License-Identifier: AGPL-3.0

use std::fs::File;
use std::path::Path;
use uuid::Uuid;

use crate::{
    article::Article,
    cluster::{ClusterCache, decompress_cluster, Compression},
    dirent::{read_dirent, DirEntry},
    error::ZimError,
    header::{parse_header, Header},
    indices::build_indices,
    indices::Indices,
    meta::Metadata,
    mime::parse_mime_list,
    mime::MimeMap,
    ZimReader,
};

/// Spec-compliant ZIM file reader.
///
/// Concrete implementation of ZimReader for actual ZIM archives on disk.
/// Holds the file handle, read-only mmap, parsed header, MIME type table,
/// pointer indices, metadata, and a bounded LRU cluster cache.
pub struct RealZim {
    file: File,
    // pub(crate): the sibling `search` module reads these directly (search_url_prefix /
    // search_title_text); kept out of the public API surface.
    pub(crate) mmap: memmap2::Mmap,
    pub(crate) header: Header,
    mime_map: MimeMap,
    pub(crate) indices: Indices,
    metadata: Metadata,
    cluster_cache: ClusterCache,
}

impl RealZim {
    /// Open a ZIM archive from the given path.
    ///
    /// Memory-maps the entire file (read-only), parses the 80-byte header,
    /// builds the MIME type map, URL/title/cluster pointer indices, and
    /// initializes the cluster cache.
    pub fn open(path: &Path) -> Result<Self, ZimError> {
        let file = File::open(path).map_err(ZimError::Io)?;

        // Create a read-only memory map of the entire file
        let mmap = unsafe { memmap2::MmapOptions::new().map_copy_read_only(&file) }
            .map_err(ZimError::Io)?;

        // Parse the 80-byte header from the start of the mmap
        let header = parse_header(&mut std::io::Cursor::new(&mmap[..80]))?;

        // Parse the MIME type list from the mmap
        let mime_map = parse_mime_list(&mmap, header.mime_list_ptr)?;

        // Build the URL, title, and cluster pointer indices
        let indices = build_indices(&mmap, &header)?;

        let metadata = Metadata {
            uuid: Uuid::from_bytes(header.uuid),
            article_count: header.article_count,
            cluster_count: header.cluster_count,
            main_page_url: None, // I-10 (b): swap when main page resolution lands
        };

        // Initialize the cluster cache with capacity 4
        let cluster_cache = ClusterCache::new(4);

        Ok(Self {
            file,
            mmap,
            header,
            mime_map,
            indices,
            metadata,
            cluster_cache,
        })
    }

    /// Resolve an article by URL path.
    ///
    /// Binary-searches the URL pointer list by (namespace, url), reads the dirent,
    /// follows redirects if needed (bounded ≤8 hops), decompresses the cluster data,
    /// and returns the Article with MIME type and body.
    ///
    /// # Arguments
    /// * `url` - URL path in the form "namespace/path" (e.g., "A/Index")
    ///
    /// # Returns
    /// * `Ok(Article)` - Article with url, title, mime, and body
    /// * `Err(ZimError::NotFound)` - URL not found in archive
    /// * `Err(ZimError::Truncated)` - Redirect cycle detected or data truncated
    /// * `Err(ZimError::MalformedHeader)` - Invalid dirent or cluster data
    pub fn resolve_article(&self, url: &str) -> Result<Article, ZimError> {
        // Parse URL into namespace and path
        let (namespace, path) = url.split_once('/').ok_or(ZimError::NotFound)?;
        if namespace.len() != 1 || path.is_empty() {
            return Err(ZimError::NotFound);
        }
        let namespace_char = namespace.chars().next().ok_or(ZimError::NotFound)?;
        let namespace_byte = namespace_char as u8;

        // Binary search URL pointer list for matching (namespace, url)
        let url_ptrs = &self.indices.urls.ptrs;
        if url_ptrs.is_empty() {
            return Err(ZimError::NotFound);
        }

        let mut left = 0u64;
        let mut right = url_ptrs.len() as u64;
        let mut found_idx = None;

        while left < right {
            let mid = left + (right - left) / 2;
            let offset = url_ptrs[mid as usize];

            let dirent = read_dirent(&self.mmap, offset, self.header.minor)?;

            // Compare by namespace first, then by URL
            match namespace_byte.cmp(&dirent.namespace) {
                std::cmp::Ordering::Equal => {
                    match path.cmp(&dirent.url) {
                        std::cmp::Ordering::Equal => {
                            found_idx = Some(mid);
                            break;
                        }
                        std::cmp::Ordering::Less => {
                            right = mid;
                        }
                        std::cmp::Ordering::Greater => {
                            left = mid + 1;
                        }
                    }
                }
                std::cmp::Ordering::Less => {
                    right = mid;
                }
                std::cmp::Ordering::Greater => {
                    left = mid + 1;
                }
            }
        }

        let dirent_offset = match found_idx {
            Some(idx) => url_ptrs[idx as usize],
            None => return Err(ZimError::NotFound),
        };

        let mut dirent = read_dirent(&self.mmap, dirent_offset, self.header.minor)?;

        // Follow redirects (mime_type 0xFFFF) with cycle detection
        let max_hops = 8;
        let mut visited = std::collections::HashSet::new();

        for hop in 0..max_hops {
            if !dirent.is_redirect {
                break;
            }

            if visited.contains(&dirent.redirect_index) {
                return Err(ZimError::Truncated); // Redirect cycle
            }
            visited.insert(dirent.redirect_index);

            let target_idx = dirent.redirect_index as usize;
            if target_idx >= url_ptrs.len() {
                return Err(ZimError::Truncated);
            }

            let target_offset = url_ptrs[target_idx];
            dirent = read_dirent(&self.mmap, target_offset, self.header.minor)?;

            if hop == max_hops - 1 && dirent.is_redirect {
                return Err(ZimError::Truncated); // Too many hops
            }
        }

        if dirent.is_redirect {
            return Err(ZimError::Truncated); // Still redirect after max hops
        }

        // Get MIME type string
        let mime = if dirent.mime_type as usize >= self.mime_map.types.len() {
            return Err(ZimError::MalformedHeader);
        } else {
            self.mime_map.types[dirent.mime_type as usize].clone()
        };

        // Get cluster byte range: cluster_ptr_list[c..c+1]
        let cluster_idx = dirent.cluster_number as usize;
        if cluster_idx >= self.indices.clusters.ptrs.len() {
            return Err(ZimError::Truncated);
        }

        let cluster_start = self.indices.clusters.ptrs[cluster_idx];
        let cluster_end = if cluster_idx + 1 < self.indices.clusters.ptrs.len() {
            self.indices.clusters.ptrs[cluster_idx + 1]
        } else {
            self.header.checksum_pos // Last cluster ends at checksum
        };

        if cluster_start >= cluster_end || cluster_end > self.mmap.len() as u64 {
            return Err(ZimError::Truncated);
        }

        let cluster_data = &self.mmap[cluster_start as usize..cluster_end as usize];

        // Read compression byte from cluster data
        if cluster_data.is_empty() {
            return Err(ZimError::Truncated);
        }
        let compression_byte = cluster_data[0];
        let compression = Compression::from(compression_byte)?;

        // Decompress cluster data (cache handles this internally)
        let blobs = decompress_cluster(cluster_data, compression)?;

        // Get the specific blob
        let blob_idx = dirent.blob_number as usize;
        if blob_idx >= blobs.len() {
            return Err(ZimError::Truncated);
        }
        let body = blobs[blob_idx].clone();

        Ok(Article {
            url: dirent.url,
            title: dirent.title,
            mime,
            body,
        })
    }
}

impl ZimReader for RealZim {
    fn open(path: &Path) -> Result<Self, ZimError>
    where
        Self: Sized,
    {
        Self::open(path)
    }

    fn get_article(&self, url: &str) -> Result<String, ZimError> {
        let article = self.resolve_article(url)?;
        Ok(String::from_utf8_lossy(&article.body).to_string())
    }

    fn list_urls(&self, _offset: u64, _limit: u32) -> Result<Vec<String>, ZimError> {
        // I-10 (b): placeholder URL listing - swap when url_ptr traversal lands
        Ok(Vec::new())
    }

    fn metadata(&self) -> &Metadata {
        &self.metadata
    }

    fn search(&self, query: &str, limit: u32) -> Result<Vec<crate::search::SearchHit>, ZimError> {
        crate::search::search_title_text(self, query, limit)
    }
}
