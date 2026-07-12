use std::io;

#[derive(thiserror::Error, Debug)]
pub enum ZimError {
    #[error("I/O error: {0}")]
    Io(io::Error),
    #[error("malformed ZIM header")]
    MalformedHeader,
    #[error("article not found")]
    NotFound,
    #[error("checksum verification failed")]
    BadChecksum,
    #[error("unsupported compression type: {0}")]
    UnsupportedCompression(u8),
    #[error("truncated ZIM archive")]
    Truncated,
}
