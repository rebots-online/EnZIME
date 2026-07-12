// Copyright 2026 Robin L. M. Cheung
// SPDX-License-Identifier: AGPL-3.0

//! Directory entry representation for ZIM archives.
//!
//! A dirent can represent either an article entry or a redirect entry.
//! Article entries carry MIME type, namespace, cluster/blob numbers, URL, and title.
//! Redirect entries (mime_type = 0xFFFF) carry a redirect index instead.

use crate::error::ZimError;

/// Directory entry in a ZIM archive.
///
/// # Fields
///
/// - `mime_type`: MIME type identifier (0xFFFF indicates a redirect entry)
/// - `namespace`: Namespace character (e.g., 'A' for articles, 'I' for images)
/// - `is_redirect`: Whether this entry is a redirect (true when mime_type == 0xFFFF)
/// - `cluster_number`: Cluster number (valid for article entries)
/// - `blob_number`: Blob number within the cluster (valid for article entries)
/// - `redirect_index`: Index of the target dirent (valid for redirect entries)
/// - `url`: URL path of this entry
/// - `title`: Human-readable title
pub struct DirEntry {
    pub mime_type: u16,
    pub namespace: u8,
    pub is_redirect: bool,
    pub cluster_number: u32,
    pub blob_number: u32,
    pub redirect_index: u32,
    pub url: String,
    pub title: String,
}

/// Parse one dirent at a byte offset in the mmap.
///
/// Reads a directory entry (dirent) from a ZIM archive at the given offset.
/// The dirent format is little-endian with NUL-terminated URL and title strings.
/// The parameter field is read only when `minor >= 1`.
///
/// # Arguments
/// * `data` - The mmap'd ZIM file data
/// * `offset` - Byte offset at which the dirent starts
/// * `minor` - ZIM minor version (controls whether parameter field is present)
///
/// # Returns
/// * `Ok(DirEntry)` - Successfully parsed dirent
/// * `Err(ZimError::Truncated)` - Offset past EOF or truncated fields
/// * `Err(ZimError::MalformedHeader)` - Missing NUL terminator
///
/// # Bounds checking
/// Every read is bounds-checked; missing data returns `Err(ZimError::Truncated)`.
pub fn read_dirent(data: &[u8], offset: u64, minor: u16) -> Result<DirEntry, ZimError> {
    let mut pos = offset as usize;

    // Read mime_type (u16, LE) - offset 0
    if pos + 2 > data.len() {
        return Err(ZimError::Truncated);
    }
    let mime_type = u16::from_le_bytes([data[pos], data[pos + 1]]);
    pos += 2;

    // Read parameter (u32, LE) - offset 2 - ONLY when minor >= 1
    if minor >= 1 {
        if pos + 4 > data.len() {
            return Err(ZimError::Truncated);
        }
        let _parameter = u32::from_le_bytes([
            data[pos],
            data[pos + 1],
            data[pos + 2],
            data[pos + 3],
        ]);
        pos += 4;
    }

    // Read namespace (u8) - offset 6 (or 2 if minor < 1)
    if pos + 1 > data.len() {
        return Err(ZimError::Truncated);
    }
    let namespace = data[pos];
    pos += 1;

    // Determine if this is a redirect entry
    let is_redirect = mime_type == 0xFFFF;

    // Read redirect_index or cluster_number (u32, LE) - offset 7 (or 3 if minor < 1)
    if pos + 4 > data.len() {
        return Err(ZimError::Truncated);
    }
    let (redirect_index, cluster_number) = if is_redirect {
        let redirect_index = u32::from_le_bytes([
            data[pos],
            data[pos + 1],
            data[pos + 2],
            data[pos + 3],
        ]);
        (redirect_index, 0)
    } else {
        let cluster_number = u32::from_le_bytes([
            data[pos],
            data[pos + 1],
            data[pos + 2],
            data[pos + 3],
        ]);
        (0, cluster_number)
    };
    pos += 4;

    // Read blob_number (u32, LE) - offset 11 (or 7 if minor < 1) - for article entries only
    let blob_number = if !is_redirect {
        if pos + 4 > data.len() {
            return Err(ZimError::Truncated);
        }
        let blob_number = u32::from_le_bytes([
            data[pos],
            data[pos + 1],
            data[pos + 2],
            data[pos + 3],
        ]);
        pos += 4;
        blob_number
    } else {
        0
    };

    // Read NUL-terminated URL
    let url_start = pos;
    let url_end = data[pos..]
        .iter()
        .position(|&b| b == 0)
        .ok_or(ZimError::MalformedHeader)?;
    let url = String::from_utf8_lossy(&data[url_start..url_start + url_end])
        .trim_end_matches('\0')
        .to_string();
    pos = url_start + url_end + 1;

    // Read NUL-terminated title
    let title_start = pos;
    let title_end = data[pos..]
        .iter()
        .position(|&b| b == 0)
        .ok_or(ZimError::MalformedHeader)?;
    let title = String::from_utf8_lossy(&data[title_start..title_start + title_end])
        .trim_end_matches('\0')
        .to_string();

    Ok(DirEntry {
        mime_type,
        namespace,
        is_redirect,
        cluster_number,
        blob_number,
        redirect_index,
        url,
        title,
    })
}
