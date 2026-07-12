// Global search module — cross-ZIM search across all installed packs
pub mod ranking;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::pack_catalog::PackCatalog;
use crate::state::AppState;
use anzimmermanlib::ZimError;

/// Hit row with ZIM-of-origin attribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchHit {
    pub zim_uuid: Uuid,
    pub zim_title: String,
    pub url: String,
    pub article_title: String,
    pub score: f32,
}

/// Cross-ZIM search across all installed packs + the in-memory open handles
pub struct GlobalSearcher {
    pub catalog: Arc<PackCatalog>,
}

impl GlobalSearcher {
    pub fn search(&self, query: &str, limit: u32, app_state: &AppState) -> Result<Vec<GlobalSearchHit>, ZimError> {
        use crate::global_search::ranking::RankingConfig;
        use anzimmermanlib::search::{search_title_text, SearchHit};

        let config = RankingConfig::default();
        let mut all_hits: Vec<GlobalSearchHit> = Vec::new();

        // Iterate installed packs from catalog
        let installed_packs = self.catalog.installed_packs()
            .map_err(|e| ZimError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

        // I-10(b): swap when ZimReader::search (§7.3) lands and AppState provides ZIM-by-UUID lookup
        // Currently we can't correlate AppState.zim handles with InstalledPack.uuid,
        // so the full cross-ZIM merge isn't possible yet.
        // When §7.3 adds a `search` method to ZimReader trait and AppState tracks
        // which handle corresponds to which InstalledPack, we'll iterate:
        // for pack in installed_packs {
        //     let zim = app_state.get_zim_by_uuid(pack.zim_uuid)?;
        //     let pack_hits = zim.search(query, limit * 2)?; // fetch extra for ranking
        //     for hit in pack_hits {
        //         let score = bm25_score(&hit, &config, query);
        //         all_hits.push(GlobalSearchHit {
        //             zim_uuid: pack.zim_uuid,
        //             zim_title: pack.id.clone(),
        //             url: hit.url,
        //             article_title: hit.title,
        //             score,
        //         });
        //     }
        // }

        // Sort by score descending
        all_hits.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::ordering::Ordering::Equal));

        // Truncate to limit
        all_hits.truncate(limit as usize);

        Ok(all_hits)
    }
}
