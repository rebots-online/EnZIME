// Copyright 2026 Robin L. M. Cheung
// SPDX-License-Identifier: AGPL-3.0

// Copyright 2026 Robin L. M. Cheung
// SPDX-License-Identifier: AGPL-3.0

use crate::dirent::read_dirent;
use crate::error::ZimError;

/// Search result row representing a single match in a ZIM archive.
pub struct SearchHit {
    /// The URL of the matching article
    pub url: String,
    /// The title of the matching article
    pub title: String,
    /// Relevance score for this search result
    pub score: f32,
}

// Shadowing placeholder removed - now using crate::real::RealZim per E-ZIM-18

/// Prefix search on URL list.
///
/// Searches through the URL pointer list for entries that start with the query prefix.
/// Returns up to `max_results` URLs matching the prefix, in lexicographic order.
///
/// # Arguments
/// * `zim` - The ZIM archive to search
/// * `prefix` - The prefix string to match against URLs
/// * `max_results` - Maximum number of results to return
///
/// # Returns
/// A vector of URL strings that start with the given prefix
pub fn search_url_prefix(
    zim: &crate::real::RealZim,
    prefix: &str,
    max_results: u32,
) -> Result<Vec<String>, ZimError> {
    let url_ptrs = &zim.indices.urls.ptrs;
    let mmap = &zim.mmap;
    let minor = zim.header.minor;

    // Binary search for the lower bound (first URL >= prefix)
    let mut lower = 0;
    let mut upper = url_ptrs.len();

    while lower < upper {
        let mid = lower + (upper - lower) / 2;
        let mid_ptr = url_ptrs[mid];
        let dirent = read_dirent(mmap, mid_ptr, minor)?;

        if dirent.url.as_str() < prefix {
            lower = mid + 1;
        } else {
            upper = mid;
        }
    }

    // Collect all URLs starting with the prefix, up to max_results
    let mut results = Vec::new();
    for ptr in url_ptrs.iter().skip(lower) {
        if results.len() >= max_results as usize {
            break;
        }

        let dirent = read_dirent(mmap, *ptr, minor)?;

        if dirent.url.starts_with(prefix) {
            results.push(dirent.url);
        } else {
            // URLs are sorted, so we're done
            break;
        }
    }

    Ok(results)
}

/// Text search on titles.
///
/// Searches through the title index for entries that start with the query text.
/// The TitlePointerList is sorted by title, so we iterate sequentially and stop
/// when titles no longer match the prefix.
///
/// # Arguments
/// * `zim` - The ZIM archive to search
/// * `query` - The search query string (prefix match on titles)
/// * `max_results` - Maximum number of results to return
///
/// # Returns
/// A vector of `SearchHit` results with URL, title, and relevance score
pub fn search_title_text(
    zim: &crate::real::RealZim,
    query: &str,
    max_results: u32,
) -> Result<Vec<SearchHit>, ZimError> {
    let title_indices = &zim.indices.titles.idx;
    let url_ptrs = &zim.indices.urls.ptrs;
    let mmap = &zim.mmap;
    let minor = zim.header.minor;

    let mut results = Vec::new();

    // Iterate through title indices (sorted by title)
    for &title_idx in title_indices {
        if results.len() >= max_results as usize {
            break;
        }

        // Get the URL pointer for this title
        let url_ptr = url_ptrs.get(title_idx as usize)
            .ok_or(ZimError::Truncated)?;

        // Read the directory entry
        let dirent = read_dirent(mmap, *url_ptr, minor)?;

        // Check if title starts with query (prefix match)
        if dirent.title.starts_with(query) {
            results.push(SearchHit {
                url: dirent.url,
                title: dirent.title,
                score: query.len() as f32,
            });
        } else if !results.is_empty() {
            // Titles are sorted; if we stop matching and have results, we're done
            break;
        }
    }

    Ok(results)
}
