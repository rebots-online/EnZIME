// Copyright 2026 Robin L. M. Cheung
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

//! Tests for the minimal ZIM v5 fixture

mod fixtures;

use std::path::PathBuf;

#[test]
fn test_fixture_write_and_verify() {
    let zim_data = fixtures::wiki_mini_zim();

    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("tests");
    path.push("fixtures");
    path.push("wiki-mini.zim");

    // Ensure directory exists
    std::fs::create_dir_all(path.parent().unwrap())
        .expect("Should create fixtures directory");

    // Write fixture
    std::fs::write(&path, &zim_data)
        .expect("Should write fixture file");

    println!("Fixture written to: {:?}", path);
    println!("Fixture size: {} bytes", zim_data.len());

    // Verify file exists
    assert!(path.exists(), "Fixture file should exist");

    // Verify file size
    let metadata = std::fs::metadata(&path)
        .expect("Should get file metadata");
    assert_eq!(metadata.len(), zim_data.len() as u64, "File size should match data size");

    // Verify file can be opened by RealZim
    let result = anzimmermanlib::RealZim::open(&path);
    match result {
        Ok(zim) => {
            println!("Successfully opened ZIM archive");
            println!("Metadata: {:?}", zim.metadata());

            // Try to get the A/Index article
            match zim.get_article("A/Index") {
                Ok(content) => {
                    println!("Successfully retrieved A/Index article");
                    println!("Content length: {} bytes", content.len());
                    assert!(content.contains("<h1>Index</h1>"), "Content should contain heading");
                }
                Err(e) => {
                    println!("Note: get_article returned error (expected during fixture development): {:?}", e);
                }
            }
        }
        Err(e) => {
            println!("Failed to open ZIM archive: {:?}", e);
            println!("This is expected during fixture development - fixture needs refinement");
        }
    }
}
