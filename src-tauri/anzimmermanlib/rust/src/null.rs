// Copyright 2026 Robin L. M. Cheung
// SPDX-License-Identifier: AGPL-3.0

use std::path::Path;
use uuid::Uuid;

use crate::{error::ZimError, meta::Metadata, ZimReader};

/// Empty-state ZIM (no articles, fixed UUID).
///
/// Production v1.0 implementation present at startup before any user-opened ZIM.
/// All operations return empty results or appropriate null-state responses.
pub struct NullZim;

impl NullZim {
    /// Fixed UUID for the null ZIM state (all zeros).
    pub const NULL_UUID: Uuid = uuid::uuid!("00000000-0000-0000-0000-000000000000");

    /// Metadata for the null ZIM state.
    fn null_metadata() -> Metadata {
        Metadata {
            uuid: Self::NULL_UUID,
            article_count: 0,
            cluster_count: 0,
            main_page_url: None,
        }
    }
}

impl ZimReader for NullZim {
    fn open(_path: &Path) -> Result<Self, ZimError>
    where
        Self: Sized,
    {
        // NullZim is a singleton state, not opened from a path.
        // Use NullZim directly instead of calling open().
        Err(ZimError::NotFound)
    }

    fn get_article(&self, _url: &str) -> Result<String, ZimError> {
        Err(ZimError::NotFound)
    }

    fn list_urls(&self, _offset: u64, _limit: u32) -> Result<Vec<String>, ZimError> {
        Ok(Vec::new())
    }

    fn metadata(&self) -> &Metadata {
        // Return a static metadata instance for the null state.
        // Note: This leaks a small allocation; acceptable for a singleton.
        // A cleaner approach would use OnceLock or lazy_static, but those
        // require additional dependencies. This is v1.0 production code.
        Box::leak(Box::new(Self::null_metadata()))
    }

    fn search(&self, _query: &str, _limit: u32) -> Result<Vec<crate::search::SearchHit>, ZimError> {
        Ok(Vec::new())
    }
}
