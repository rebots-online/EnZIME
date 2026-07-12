use std::io::Cursor;

fn build_zim_header(magic: u32) -> Vec<u8> {
    let mut header = vec![0u8; 80];
    header[0..4].copy_from_slice(&magic.to_le_bytes());
    header[4..6].copy_from_slice(&5u16.to_le_bytes());
    header[6..8].copy_from_slice(&0u16.to_le_bytes());
    header
}

#[test]
fn test_parse_header_direct() {
    println!("=== Starting test_parse_header_direct ===");
    
    let valid_header = build_zim_header(0x0444495A);
    println!("Built header with length: {}", valid_header.len());
    println!("First 16 bytes: {:?}", &valid_header[0..16]);
    
    let mut cursor = Cursor::new(valid_header.clone());
    println!("Created cursor, position before: {}", cursor.position());
    
    let result = anzimmermanlib::header::parse_header(&mut cursor);
    println!("Parse result: {:?}", result);
    
    match result {
        Ok(header) => println!("Parsed header: magic={}, major={}", header.magic, header.major),
        Err(e) => println!("Parse error: {:?}", e),
    }
}
