// Copyright 2026 Robin L. M. Cheung
// SPDX-License-Identifier: AGPL-3.0

//! AnZimmermanLib — ZIM archive reader for EnZIME Suite.
//!
//! Fresh Rust implementation, not a port of the TypeScript code at
//! ~/forgejo/AnZimmermanLib/. That repo's 2026-05-06 audit findings
//! (BACKPORT-EN001..EN021-TS) are spec-knowledge source, not a porting
//! source.

use std::path::Path;

pub mod article;
pub mod blob;
pub mod checksum;
pub mod cluster;
pub mod dirent;
pub mod error;
pub mod header;
pub mod indices;
pub mod meta;
pub mod mime;
pub mod null;
pub mod pointers;
pub mod real;
pub mod search;

pub use error::ZimError;
pub use meta::Metadata;
pub use search::SearchHit;

/// ZIM v5/v6 reader trait.
///
/// Defines the contract for reading ZIM archives, implemented by both
/// concrete readers (RealZim) and the empty-state placeholder (NullZim).
pub trait ZimReader {
    /// Open a ZIM archive from the given path.
    fn open(_: &Path) -> Result<Self, ZimError>
    where
        Self: Sized;

    /// Get an article by URL path.
    fn get_article(&self, _: &str) -> Result<String, ZimError>;

    /// List URLs starting at an offset, with a limit.
    fn list_urls(&self, _: u64, _: u32) -> Result<Vec<String>, ZimError>;

    /// Get metadata for this ZIM archive.
    fn metadata(&self) -> &Metadata;

    /// Search for articles matching a query.
    ///
    /// Returns up to `limit` search results with URLs, titles, and relevance scores.
    /// Prefix-matches on article titles.
    fn search(&self, query: &str, limit: u32) -> Result<Vec<crate::search::SearchHit>, ZimError>;
}
