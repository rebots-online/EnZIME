// AnZimmermanLib - ZIM index aggregation
// SPDX-License-Identifier: AGPL-3.0

use crate::pointers::{UrlPointerList, TitlePointerList, ClusterPointerList};

/// Aggregated pointer tables for ZIM file access.
pub struct Indices {
    pub urls: UrlPointerList,
    pub titles: TitlePointerList,
    pub clusters: ClusterPointerList,
}

/// Read all three pointer lists from the ZIM mmap.
pub fn build_indices(data: &[u8], header: &super::header::Header) -> Result<Indices, crate::ZimError> {
    use crate::header::Header;

    // Helper to read a slice of u64 pointers at a given offset
    fn read_u64_pointers(data: &[u8], offset: u64, count: u32) -> Result<Vec<u64>, crate::ZimError> {
        let start = offset as usize;
        let end = start.checked_add(count as usize * 8)
            .ok_or(crate::ZimError::Truncated)?;

        let slice = data.get(start..end)
            .ok_or(crate::ZimError::Truncated)?;

        let mut ptrs = Vec::with_capacity(count as usize);
        let mut i = 0;
        while i < slice.len() {
            let bytes = slice[i..i+8].try_into()
                .map_err(|_| crate::ZimError::Truncated)?;
            ptrs.push(u64::from_le_bytes(bytes));
            i += 8;
        }

        Ok(ptrs)
    }

    // Helper to read a slice of u32 indices at a given offset
    fn read_u32_indices(data: &[u8], offset: u64, count: u32) -> Result<Vec<u32>, crate::ZimError> {
        let start = offset as usize;
        let end = start.checked_add(count as usize * 4)
            .ok_or(crate::ZimError::Truncated)?;

        let slice = data.get(start..end)
            .ok_or(crate::ZimError::Truncated)?;

        let mut idx = Vec::with_capacity(count as usize);
        let mut i = 0;
        while i < slice.len() {
            let bytes = slice[i..i+4].try_into()
                .map_err(|_| crate::ZimError::Truncated)?;
            idx.push(u32::from_le_bytes(bytes));
            i += 4;
        }

        Ok(idx)
    }

    // Read URL pointer table (article_count × u64)
    let url_ptrs = read_u64_pointers(data, header.url_ptr_list_ptr, header.article_count)?;

    // Read title pointer table (article_count × u32)
    let title_idx = read_u32_indices(data, header.title_ptr_list_ptr, header.article_count)?;

    // Read cluster pointer table (cluster_count × u64)
    let cluster_ptrs = read_u64_pointers(data, header.cluster_ptr_list_ptr, header.cluster_count)?;

    Ok(Indices {
        urls: UrlPointerList { ptrs: url_ptrs },
        titles: TitlePointerList { idx: title_idx },
        clusters: ClusterPointerList { ptrs: cluster_ptrs },
    })
}
