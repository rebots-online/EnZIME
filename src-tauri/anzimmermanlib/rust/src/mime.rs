// AnZimmermanLib - ZIM MIME type table
// SPDX-License-Identifier: AGPL-3.0

use crate::ZimError;

/// Mime type table mapping MIME indices to type strings.
pub struct MimeMap {
    pub types: Vec<String>,
}

/// Parse the MIME type list from a ZIM archive.
///
/// Reads NUL-terminated MIME type strings starting at `mime_list_ptr` offset
/// within `data`, building a MimeMap in index order. The list terminates with
/// an empty string (two consecutive NUL bytes).
///
/// # Arguments
/// * `data` - The full ZIM archive data
/// * `mime_list_ptr` - Offset within `data` where the MIME list begins
///
/// # Returns
/// * `Ok(MimeMap)` - Populated with MIME types in index order
/// * `Err(ZimError)` - If the data is truncated or malformed
pub fn parse_mime_list(data: &[u8], mime_list_ptr: u64) -> Result<MimeMap, ZimError> {
    use std::io::{Cursor, Read};

    let mut types = Vec::new();
    let mut cursor = Cursor::new(data);

    // Seek to the MIME list position
    if mime_list_ptr > data.len() as u64 {
        return Err(ZimError::Truncated);
    }
    cursor.set_position(mime_list_ptr);

    // Read NUL-terminated strings until empty string
    loop {
        let mut bytes = Vec::new();
        let mut byte = [0u8; 1];

        loop {
            if cursor.read_exact(&mut byte).is_err() {
                return Err(ZimError::Truncated);
            }
            let b = byte[0];
            if b == 0 {
                break;
            }
            bytes.push(b);
        }

        // Empty string terminates the list
        if bytes.is_empty() {
            break;
        }

        // Convert to UTF-8 string
        let mime_type = String::from_utf8(bytes)
            .map_err(|_| ZimError::MalformedHeader)?;
        types.push(mime_type);
    }

    Ok(MimeMap { types })
}
