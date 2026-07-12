use std::io::Cursor;

#[test]
fn test_minimal_header() {
    let mut header = vec![0u8; 80];
    header[0..4].copy_from_slice(&0x0444495Au32.to_le_bytes());
    header[4..6].copy_from_slice(&5u16.to_le_bytes());
    header[6..8].copy_from_slice(&0u16.to_le_bytes());
    
    println!("Header length: {}", header.len());
    
    let mut cursor = Cursor::new(header);
    let mut buf = [0u8; 80];
    
    match std::io::Read::read_exact(&mut cursor, &mut buf) {
        Ok(_) => println!("read_exact succeeded"),
        Err(e) => println!("read_exact failed: {:?}", e),
    }
    
    println!("First 16 bytes of buffer: {:?}", &buf[0..16]);
}
