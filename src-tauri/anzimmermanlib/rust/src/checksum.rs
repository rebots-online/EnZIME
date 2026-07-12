use std::fs::File;
use std::io::{Read, Seek, SeekFrom};

use digest::Digest;
use md5::Md5;

use crate::error::ZimError;
use crate::header::Header;

/// Verify the MD5 checksum of a ZIM file
///
/// Reads the stored checksum from `header.checksum_pos`, computes the MD5 hash
/// of all file bytes before that position, and compares them.
pub fn verify_checksum(file: &File, header: &Header) -> Result<bool, ZimError> {

    let checksum_pos = header.checksum_pos as usize;

    // Seek to the stored checksum location
    let mut file_clone = file.try_clone().map_err(ZimError::Io)?;
    file_clone
        .seek(SeekFrom::Start(checksum_pos as u64))
        .map_err(ZimError::Io)?;

    // Read the 16-byte MD5 checksum
    let mut stored_checksum = [0u8; 16];
    file_clone
        .read_exact(&mut stored_checksum)
        .map_err(ZimError::Io)?;

    // Compute MD5 of file up to checksum position
    let mut file_clone = file.try_clone().map_err(ZimError::Io)?;
    file_clone
        .seek(SeekFrom::Start(0))
        .map_err(ZimError::Io)?;

    let mut hasher = Md5::new();
    let mut buffer = vec![0u8; 8192];
    let mut total_read = 0;

    loop {
        let n = file_clone.read(&mut buffer).map_err(ZimError::Io)?;
        if n == 0 {
            break;
        }

        let bytes_to_hash = if total_read + n > checksum_pos {
            checksum_pos - total_read
        } else {
            n
        };

        hasher.update(&buffer[..bytes_to_hash]);
        total_read += bytes_to_hash;

        if total_read >= checksum_pos {
            break;
        }
    }

    let computed_checksum = hasher.finalize();

    Ok(computed_checksum.as_slice() == stored_checksum)
}
