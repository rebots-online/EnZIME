// Copyright 2026 Robin L. M. Cheung
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

//! Spec compliance test EN001: Magic number validation
//!
//! Per ZIM v5 spec, the first 4 bytes of a valid ZIM archive must be
//! the magic number 0x0444495A (little-endian representation of the
//! ASCII sequence "ZID\x04"). Files with any other magic number must
//! be rejected as malformed.
//!
//! This test fixture derives from the 2026-05-06 audit findings of
//! the predecessor TypeScript implementation (BACKPORT-EN001-TS).

use std::io::Cursor;

/// Correct ZIM v5 magic number: "ZID\x04" in little-endian
const ZIM5_MAGIC: u32 = 0x0444495A;

#[test]
fn EN001_no_magic_number() {
    // Test 1: A header with correct magic number should parse
    let valid_header = build_zim_header(ZIM5_MAGIC);
    println!("Header length: {}", valid_header.len());
    println!("Header bytes (first 16): {:?}", &valid_header[0..16]);

    // Try parse_header with a fresh cursor
    let mut cursor = Cursor::new(valid_header);
    let result = anzimmermanlib::header::parse_header(&mut cursor);
    if let Err(ref e) = result {
        println!("Parse error: {:?}", e);
    }
    assert!(result.is_ok(), "Valid ZIM v5 magic number should be accepted");
    let header = result.unwrap();
    assert_eq!(header.magic, ZIM5_MAGIC);

    // Test 2: Wrong magic number (all zeros) should fail
    let invalid_header = build_zim_header(0x00000000);
    let mut cursor = Cursor::new(invalid_header);
    let result = anzimmermanlib::header::parse_header(&mut cursor);
    assert!(result.is_err(), "Invalid magic number should be rejected");
    // Verify it's the specific error type
    if let Err(e) = result {
        assert!(matches!(e, anzimmermanlib::ZimError::MalformedHeader),
                "Wrong magic should return MalformedHeader error");
    }

    // Test 3: Wrong magic number (random value) should fail
    let invalid_header = build_zim_header(0xDEADBEEF);
    let mut cursor = Cursor::new(invalid_header);
    let result = anzimmermanlib::header::parse_header(&mut cursor);
    assert!(result.is_err(), "Invalid magic number should be rejected");
    // Verify it's the specific error type
    if let Err(e) = result {
        assert!(matches!(e, anzimmermanlib::ZimError::MalformedHeader),
                "Wrong magic should return MalformedHeader error");
    }
}

/// Build a minimal 80-byte ZIM header with the given magic number
fn build_zim_header(magic: u32) -> Vec<u8> {
    let mut header = vec![0u8; 80];

    // Write magic number (little-endian)
    header[0..4].copy_from_slice(&magic.to_le_bytes());

    // Write major version (5 for ZIM v5)
    header[4..6].copy_from_slice(&5u16.to_le_bytes());

    // Write minor version (0 for ZIM v5)
    header[6..8].copy_from_slice(&0u16.to_le_bytes());

    // UUID (bytes 8-23) - zeros are fine for test
    // Rest of header can remain zero

    header
}
