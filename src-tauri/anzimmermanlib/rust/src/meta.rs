// Copyright 2026 Robin L. M. Cheung
// SPDX-License-Identifier: AGPL-3.0

use uuid::Uuid;

/// Public-facing metadata extracted from a ZIM archive.
pub struct Metadata {
    /// Unique identifier for this ZIM archive
    pub uuid: Uuid,
    /// Total number of articles in the archive
    pub article_count: u32,
    /// Total number of clusters in the archive
    pub cluster_count: u32,
    /// URL of the main page, if present
    pub main_page_url: Option<String>,
}
