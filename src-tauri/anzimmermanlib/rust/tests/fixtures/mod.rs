// Copyright 2026 Robin L. M. Cheung
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

//! Minimal ZIM v5 fixture for testing
//!
//! Provides a programmatically-generated ZIM v5 archive that meets the
//! minimal requirements for spec validation:
//! - 80-byte header (magic 0x0444495A, major 5)
//! - One zstd-compressed cluster with ≥2 HTML blobs
//! - At least one redirect dirent
//! - Correct trailing 16-byte MD5 checksum

use std::io::Write;
use md5::{Digest, Md5};
use zstd;

/// Generate a minimal spec-valid ZIM v5 archive
///
/// Returns the complete ZIM archive bytes including header, data,
/// and trailing MD5 checksum.
pub fn wiki_mini_zim() -> Vec<u8> {
    let mut zim = Vec::new();

    // == Build Header (80 bytes) ==
    let mut header = vec![0u8; 80];

    // Magic number: 0x0444495A (little-endian)
    header[0..4].copy_from_slice(&0x0444495Au32.to_le_bytes());

    // Major/Minor version: 5.0
    header[4..6].copy_from_slice(&5u16.to_le_bytes());
    header[6..8].copy_from_slice(&0u16.to_le_bytes());

    // UUID (16 bytes) - placeholder
    let uuid: [u8; 16] = [
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
    ];
    header[8..24].copy_from_slice(&uuid);

    // Article count: 3 (Index page, redirect, content page)
    header[24..28].copy_from_slice(&3u32.to_le_bytes());

    // Cluster count: 1
    header[28..32].copy_from_slice(&1u32.to_le_bytes());

    // URL pointer list position (will be updated later)
    let url_ptr_pos = 80u64; // Starts right after header
    header[32..40].copy_from_slice(&url_ptr_pos.to_le_bytes());

    // Title pointer list position (will be updated later)
    let title_ptr_pos = url_ptr_pos + (3 * 8); // 3 URLs * 8 bytes each
    header[40..48].copy_from_slice(&title_ptr_pos.to_le_bytes());

    // Cluster pointer list position (will be updated later)
    let cluster_ptr_pos = title_ptr_pos + (2 * 8); // 2 titles * 8 bytes each
    header[48..56].copy_from_slice(&cluster_ptr_pos.to_le_bytes());

    // MIME list position (will be updated later)
    let mime_list_pos = cluster_ptr_pos + (1 * 8); // 1 cluster * 8 bytes
    header[56..64].copy_from_slice(&mime_list_pos.to_le_bytes());

    // Main page index: 0 (points to A/Index)
    header[64..68].copy_from_slice(&0u32.to_le_bytes());

    // Layout page index: 0xFFFFFFFF (none)
    header[68..72].copy_from_slice(&0xFFFFFFFFu32.to_le_bytes());

    // Checksum position (will be updated at end)
    header[72..80].copy_from_slice(&0u64.to_le_bytes());

    zim.extend_from_slice(&header);

    // == Build URL Pointer List (3 entries) ==
    // Each entry is 8 bytes pointing to directory entry offset
    let dir_entries_pos = mime_list_pos + 16 + 28; // MIME list is 16 bytes
    zim.extend_from_slice(&(dir_entries_pos as u64).to_le_bytes()); // Entry 0: A/Index
    zim.extend_from_slice(&((dir_entries_pos + 48) as u64).to_le_bytes()); // Entry 1: redirect
    zim.extend_from_slice(&((dir_entries_pos + 96) as u64).to_le_bytes()); // Entry 2: content

    // == Build Title Pointer List (2 entries) ==
    // Redirects don't have titles, so only 2 entries
    zim.extend_from_slice(&0u64.to_le_bytes()); // Title 0: points to URL entry 0 (A/Index)
    zim.extend_from_slice(&2u64.to_le_bytes()); // Title 1: points to URL entry 2 (content)

    // == Build Cluster Pointer List (1 entry) ==
    let cluster_data_start = dir_entries_pos + 144; // 3 entries * 48 bytes each
    zim.extend_from_slice(&(cluster_data_start as u64).to_le_bytes());

    // == Build MIME List ==
    // MIME list header: count + offsets
    zim.extend_from_slice(&2u32.to_le_bytes()); // 2 MIME types

    // MIME type offsets (relative to start of MIME string data)
    zim.extend_from_slice(&0u32.to_le_bytes()); // MIME type 0: text/html (starts at offset 0)
    zim.extend_from_slice(&10u32.to_le_bytes()); // MIME type 1: application/octet-stream (starts at offset 10)

    // MIME string data
    let mime_data = b"text/html\0application/octet-stream\0";
    zim.extend_from_slice(mime_data);

    // == Build Directory Entries (3 entries, 48 bytes each) ==
    // Entry 0: A/Index (content article)
    zim.extend_from_slice(&0u32.to_le_bytes()); // MIME type: 0 (text/html)
    zim.extend_from_slice(&0u32.to_le_bytes()); // Parameter length: 0
    zim.extend_from_slice(&0x00000001u32.to_le_bytes()); // Cluster number: 1 (1-indexed)
    zim.extend_from_slice(&0u32.to_le_bytes()); // Blob number: 0
    zim.extend_from_slice(&0u32.to_le_bytes()); // Redirect index: 0 (not a redirect)

    let url0 = b"A/Index\0";
    zim.extend_from_slice(url0);
    // Pad to 48 bytes
    while zim.len() < dir_entries_pos as usize + 48 {
        zim.push(0);
    }

    // Entry 1: OldPage (redirect to A/Content)
    zim.extend_from_slice(&0u32.to_le_bytes()); // MIME type: 0 (ignored for redirects)
    zim.extend_from_slice(&0u32.to_le_bytes()); // Parameter length: 0
    zim.extend_from_slice(&0xFFFFFFFFu32.to_le_bytes()); // Cluster number: 0xFFFFFFFF (redirect marker)
    zim.extend_from_slice(&0u32.to_le_bytes()); // Blob number: 0 (ignored for redirects)
    zim.extend_from_slice(&2u32.to_le_bytes()); // Redirect index: 2 (points to entry 2)

    let url1 = b"OldPage\0";
    zim.extend_from_slice(url1);
    // Pad to 48 bytes
    while zim.len() < dir_entries_pos as usize + 96 {
        zim.push(0);
    }

    // Entry 2: A/Content (content article)
    zim.extend_from_slice(&0u32.to_le_bytes()); // MIME type: 0 (text/html)
    zim.extend_from_slice(&0u32.to_le_bytes()); // Parameter length: 0
    zim.extend_from_slice(&0x00000001u32.to_le_bytes()); // Cluster number: 1 (1-indexed)
    zim.extend_from_slice(&1u32.to_le_bytes()); // Blob number: 1
    zim.extend_from_slice(&0u32.to_le_bytes()); // Redirect index: 0 (not a redirect)

    let url2 = b"A/Content\0";
    zim.extend_from_slice(url2);
    // Pad to 48 bytes
    while zim.len() < dir_entries_pos as usize + 144 {
        zim.push(0);
    }

    // == Build Cluster Data (zstd-compressed) ==
    // Cluster header: 1 byte compression flag + 4 bytes blob count
    zim.extend_from_slice(&1u8); // Compression type: 1 (zstd)

    // Build uncompressed blob data first
    let mut blob_data = Vec::new();

    // Blob 0: A/Index HTML
    let html0 = b"<html><head><title>Index Page</title></head><body><h1>Index</h1><p>Welcome to the minimal ZIM fixture.</p></body></html>";
    blob_data.extend_from_slice(&(html0.len() as u32).to_le_bytes());
    blob_data.extend_from_slice(html0);

    // Blob 1: A/Content HTML
    let html1 = b"<html><head><title>Content Page</title></head><body><h1>Content Page</h1><p>This is a test content page with some data.</p></body></html>";
    blob_data.extend_from_slice(&(html1.len() as u32).to_le_bytes());
    blob_data.extend_from_slice(html1);

    // Write blob count
    zim.extend_from_slice(&2u32.to_le_bytes());

    // Compress blob data using zstd
    let compressed = zstd::bulk::compress_to_buffer(&blob_data, blob_data.len(), 3)
        .expect("Zstd compression should succeed");

    zim.extend_from_slice(&compressed);

    // == Calculate and Append MD5 Checksum ==
    let checksum_pos = zim.len() as u64;

    // Update checksum position in header
    zim[72..80].copy_from_slice(&checksum_pos.to_le_bytes());

    // Calculate MD5 of everything before checksum
    let mut hasher = Md5::new();
    hasher.update(&zim);
    let checksum = hasher.finalize();

    zim.extend_from_slice(&checksum);

    zim
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_fixture_generation() {
        let zim = wiki_mini_zim();

        // Verify minimum size (header + minimal data + checksum)
        assert!(zim.len() > 96, "ZIM archive too small: {} bytes", zim.len());

        // Verify magic number
        assert_eq!(&zim[0..4], &0x0444495Au32.to_le_bytes()[..], "Magic number mismatch");

        // Verify major version
        let major = u16::from_le_bytes([zim[4], zim[5]]);
        assert_eq!(major, 5, "Major version should be 5");

        // Verify minor version
        let minor = u16::from_le_bytes([zim[6], zim[7]]);
        assert_eq!(minor, 0, "Minor version should be 0");

        // Verify article count
        let article_count = u32::from_le_bytes([zim[24], zim[25], zim[26], zim[27]]);
        assert_eq!(article_count, 3, "Should have 3 articles");

        // Verify cluster count
        let cluster_count = u32::from_le_bytes([zim[28], zim[29], zim[30], zim[31]]);
        assert_eq!(cluster_count, 1, "Should have 1 cluster");

        // Verify checksum position points to end - 16
        let checksum_pos = u64::from_le_bytes([
            zim[72], zim[73], zim[74], zim[75],
            zim[76], zim[77], zim[78], zim[79],
        ]) as usize;
        assert_eq!(checksum_pos, zim.len() - 16, "Checksum position should be at end - 16");

        // Verify MD5 checksum
        let mut hasher = Md5::new();
        hasher.update(&zim[..checksum_pos]);
        let expected_checksum = hasher.finalize();
        let actual_checksum = &zim[checksum_pos..];
        assert_eq!(actual_checksum, expected_checksum.as_slice(), "MD5 checksum mismatch");

        println!("Generated ZIM fixture: {} bytes", zim.len());
        println!("Checksum position: {}", checksum_pos);
        println!("Checksum: {:x}", actual_checksum.iter().format(""));
    }

    #[test]
    fn test_fixture_can_be_written() {
        let zim = wiki_mini_zim();

        let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        path.push("tests");
        path.push("fixtures");
        path.push("wiki-mini.zim");

        // Ensure directory exists
        std::fs::create_dir_all(path.parent().unwrap())
            .expect("Should create fixtures directory");

        // Write fixture
        std::fs::write(&path, &zim)
            .expect("Should write fixture file");

        println!("Fixture written to: {:?}", path);

        // Verify file was written and has correct size
        assert!(path.exists(), "Fixture file should exist");
        let written_data = std::fs::read(&path).expect("Should read fixture file");
        assert_eq!(written_data, zim, "Written data should match generated data");
    }
}

// Helper for formatting checksum bytes
#[cfg(test)]
struct ChecksumFormatter<'a>(&'a [u8]);

#[cfg(test)]
impl<'a> std::fmt::Display for ChecksumFormatter<'a> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        for byte in self.0 {
            write!(f, "{:02x}", byte)?;
        }
        Ok(())
    }
}

#[cfg(test)]
trait ChecksumFormat {
    fn iter(&self) -> ChecksumFormatter<Self> where Self: Sized {
        ChecksumFormatter(self)
    }
}

#[cfg(test)]
impl ChecksumFormat for [u8] {}
