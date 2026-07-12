/// ZIM file header (80 bytes per spec)
#[derive(Debug, Clone, PartialEq)]
pub struct Header {
    pub magic: u32,
    pub major: u16,
    pub minor: u16,
    pub uuid: [u8; 16],
    pub article_count: u32,
    pub cluster_count: u32,
    pub url_ptr_list_ptr: u64,
    pub title_ptr_list_ptr: u64,
    pub cluster_ptr_list_ptr: u64,
    pub mime_list_ptr: u64,
    pub main_page: u32,
    pub layout_page: u32,
    pub checksum_pos: u64,
}

/// Decode 80-byte header from a reader
pub fn parse_header<R: std::io::Read>(reader: &mut R) -> Result<Header, crate::ZimError> {
    use std::io::{self, Read};

    let mut buf = [0u8; 80];
    reader.read_exact(&mut buf).map_err(|e| match e.kind() {
        io::ErrorKind::UnexpectedEof => crate::ZimError::MalformedHeader,
        _ => crate::ZimError::Io(e),
    })?;

    let mut cursor = io::Cursor::new(buf);

    macro_rules! read_le {
        () => {{
            let mut buf = [0u8; 4];
            cursor.read_exact(&mut buf).map_err(|e| crate::ZimError::Io(e))?;
                            u32::from_le_bytes(buf)
        }};
    }

    macro_rules! read_le_u16 {
        () => {{
            let mut buf = [0u8; 2];
            cursor.read_exact(&mut buf).map_err(|e| crate::ZimError::Io(e))?;
            u16::from_le_bytes(buf)
        }};
    }

    macro_rules! read_le_u64 {
        () => {{
            let mut buf = [0u8; 8];
            cursor.read_exact(&mut buf).map_err(|e| crate::ZimError::Io(e))?;
            u64::from_le_bytes(buf)
        }};
    }

    let magic = read_le!();
    let major = read_le_u16!();
    let minor = read_le_u16!();

    // Validate magic number and major version (EN001/EN002/EN021)
    if magic != 0x0444495A {
        return Err(crate::ZimError::MalformedHeader);
    }
    if major != 5 && major != 6 {
        return Err(crate::ZimError::MalformedHeader);
    }

    let mut uuid = [0u8; 16];
    cursor.read_exact(&mut uuid).map_err(|e| crate::ZimError::Io(e))?;

    let article_count = read_le!();
    let cluster_count = read_le!();
    let url_ptr_list_ptr = read_le_u64!();
    let title_ptr_list_ptr = read_le_u64!();
    let cluster_ptr_list_ptr = read_le_u64!();
    let mime_list_ptr = read_le_u64!();
    let main_page = read_le!();
    let layout_page = read_le!();
    let checksum_pos = read_le_u64!();

    Ok(Header {
        magic,
        major,
        minor,
        uuid,
        article_count,
        cluster_count,
        url_ptr_list_ptr,
        title_ptr_list_ptr,
        cluster_ptr_list_ptr,
        mime_list_ptr,
        main_page,
        layout_page,
        checksum_pos,
    })
}
