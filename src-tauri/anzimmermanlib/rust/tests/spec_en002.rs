// Copyright 2026 Robin L. M. Cheung
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

//! Spec compliance test EN002: Major version validation
//!
//! Per ZIM v5 spec, the major version field (bytes 4-5) must be 5.
//! Files with any other major version must be rejected as unsupported.
//!
//! This test fixture derives from the 2026-05-06 audit findings of
//! the predecessor TypeScript implementation (BACKPORT-EN002-TS).

use std::io::Cursor;

/// Correct ZIM v5 magic number: "ZID\x04" in little-endian
const ZIM5_MAGIC: u32 = 0x0444495A;

/// Correct ZIM v5 major version
const ZIM5_MAJOR: u16 = 5;

#[test]
fn EN002_bad_version() {
    // Test 1: A header with correct major version (5) should parse
    let valid_header = build_zim_header(ZIM5_MAJOR);
    let mut cursor = Cursor::new(valid_header);
    let result = anzimmermanlib::header::parse_header(&mut cursor);
    assert!(result.is_ok(), "Valid ZIM v5 major version should be accepted");
    let header = result.unwrap();
    assert_eq!(header.major, ZIM5_MAJOR);

    // Test 2: Wrong major version (4) should fail
    let invalid_header = build_zim_header(4);
    let mut cursor = Cursor::new(invalid_header);
    let result = anzimmermanlib::header::parse_header(&mut cursor);
    assert!(result.is_err(), "Major version 4 should be rejected");
    let err = result.unwrap_err();
    assert!(matches!(err, anzimmermanlib::ZimError::MalformedHeader),
            "Rejection should be MalformedHeader error");

    // Test 3: Valid major version (6) should succeed
    let valid_header = build_zim_header(6);
    let mut cursor = Cursor::new(valid_header);
    let result = anzimmermanlib::header::parse_header(&mut cursor);
    assert!(result.is_ok(), "Major version 6 should be accepted");
    let header = result.unwrap();
    assert_eq!(header.major, 6);

    // Test 4: Unreasonably large major version should fail
    let invalid_header = build_zim_header(999);
    let mut cursor = Cursor::new(invalid_header);
    let result = anzimmermanlib::header::parse_header(&mut cursor);
    assert!(result.is_err(), "Major version 999 should be rejected");
    let err = result.unwrap_err();
    assert!(matches!(err, anzimmermanlib::ZimError::MalformedHeader),
            "Rejection should be MalformedHeader error");
}

/// Build a minimal 80-byte ZIM header with the given major version
fn build_zim_header(major_version: u16) -> Vec<u8> {
    let mut header = vec![0u8; 80];

    // Write magic number (little-endian)
    header[0..4].copy_from_slice(&ZIM5_MAGIC.to_le_bytes());

    // Write major version
    header[4..6].copy_from_slice(&major_version.to_le_bytes());

    // Write minor version (0)
    header[6..8].copy_from_slice(&0u16.to_le_bytes());

    // UUID (bytes 8-23) - zeros are fine for test
    // Rest of header can remain zero

    header
}
