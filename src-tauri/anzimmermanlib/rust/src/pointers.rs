// AnZimmermanLib - ZIM pointer tables
// SPDX-License-Identifier: AGPL-3.0

/// URL pointer table: maps URL pointers to blob pointers.
pub struct UrlPointerList {
    pub ptrs: Vec<u64>,
}

/// Title pointer table: maps title pointers to URL pointer indices.
pub struct TitlePointerList {
    pub idx: Vec<u32>,
}

/// Cluster pointer table: cluster byte offsets.
pub struct ClusterPointerList {
    pub ptrs: Vec<u64>,
}
