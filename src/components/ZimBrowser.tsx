import { useState, useEffect, useCallback, useMemo } from 'react';
import { useZimStore } from '../stores/zim';

interface ZimBrowserProps {
	handle: number;
	onNavigate: (url: string) => void;
}

/**
 * ZimBrowser component — browses an open ZIM's article URLs.
 *
 * Shows a paginated article directory via bridge.zim_list_articles,
 * with in-pack search via bridge.zim_search.
 *
 * Integrates Stitch 01-library pack contents + 04-reader left list screens.
 *
 * @param handle - Numeric ZIM handle (per UI-8, reconcile flag 4)
 * @param onNavigate - Callback to navigate to a clicked article URL
 */
export function ZimBrowser({ handle, onNavigate }: ZimBrowserProps): JSX.Element {
	const [articles, setArticles] = useState<string[]>([]);
	const [searchResults, setSearchResults] = useState<{ url: string; title: string; score: number }[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [offset, setOffset] = useState(0);
	const [totalCount, setTotalCount] = useState(0);
	const [hasMore, setHasMore] = useState(true);

	const limit = 50; // Articles per page

	const { listArticles, searchInPack } = useZimStore();

	// Load paginated article directory
	const loadArticles = useCallback(async () => {
		if (!handle && handle !== 0) return;

		try {
			setLoading(true);
			setError(null);
			const urls = await listArticles(handle, offset, limit);
			setArticles(urls);

			// If we got fewer than limit, we've reached the end
			setHasMore(urls.length === limit);

			// Estimate total count (this is rough; real count would need metadata)
			if (urls.length < limit) {
				setTotalCount(offset + urls.length);
			} else {
				setTotalCount(offset + limit + 1); // +1 to indicate "more"
			}
		} catch (e) {
			console.error('Failed to list articles:', e);
			setError('Failed to load article directory');
			setArticles([]);
		} finally {
			setLoading(false);
		}
	}, [handle, offset, limit, listArticles]);

	// Search within the ZIM pack
	const handleSearch = useCallback(async (query: string) => {
		if (!handle && handle !== 0) return;

		setSearchQuery(query);

		if (!query.trim()) {
			setSearchResults([]);
			return;
		}

		try {
			setLoading(true);
			setError(null);
			const results = await searchInPack(handle, query, 100);
			setSearchResults(results);
		} catch (e) {
			console.error('Failed to search in pack:', e);
			setError('Search failed');
			setSearchResults([]);
		} finally {
			setLoading(false);
		}
	}, [handle, searchInPack]);

	// Debounced search handler
	const debouncedSearch = useMemo(() => {
		let timeout: NodeJS.Timeout;
		return (query: string) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => handleSearch(query), 300);
		};
	}, [handleSearch]);

	// Load articles on mount and when offset changes
	useEffect(() => {
		if (!searchQuery) {
			loadArticles();
		}
	}, [loadArticles, searchQuery]);

	// Handle search input
	const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const query = e.target.value;
		setSearchQuery(query);
		debouncedSearch(query);
	};

	// Navigation handlers
	const handleArticleClick = (url: string) => {
		onNavigate(url);
	};

	// Pagination handlers
	const handleNextPage = () => {
		setOffset(prev => prev + limit);
	};

	const handlePrevPage = () => {
		setOffset(prev => Math.max(0, prev - limit));
	};

	const handleResetOffset = () => {
		setOffset(0);
	};

	// Display articles (directory or search results)
	const displayArticles = searchQuery ? searchResults.map(r => r.url) : articles;
	const displayCount = searchQuery ? searchResults.length : articles.length;
	const isSearchActive = searchQuery.trim().length > 0;

	return (
		<>
			<style>{`
				.zim-browser {
					display: flex;
					flex-direction: column;
					gap: var(--spacing-base, 8px);
					padding: var(--spacing-base, 8px);
					height: 100%;
					overflow: hidden;
				}

				.zim-browser-header {
					display: flex;
					flex-direction: column;
					gap: var(--spacing-base, 8px);
					padding-bottom: var(--spacing-base, 8px);
					border-bottom: 1px solid var(--outline, #859490);
				}

				.zim-browser-title {
					font-family: var(--font-heading, Space Grotesk);
					font-size: 1.25rem;
					font-weight: 600;
					color: var(--on-surface, #d4e4fa);
					margin: 0;
				}

				.zim-browser-search {
					display: flex;
					gap: 8px;
				}

				.zim-browser-search-input {
					flex: 1;
					background: var(--surface-container-low, #0d1c2d);
					color: var(--on-surface, #d4e4fa);
					border: 1px solid var(--outline, #859490);
					border-radius: var(--radius-sm, 4px);
					padding: 8px 12px;
					font-family: var(--font-body, Geist);
					font-size: 0.875rem;
					outline: none;
					transition: border-color 0.2s;
				}

				.zim-browser-search-input:focus {
					border-color: var(--primary, #4fdbc8);
				}

				.zim-browser-search-input::placeholder {
					color: var(--on-surface-variant, #bbcac6);
				}

				.zim-browser-content {
					flex: 1;
					overflow-y: auto;
					display: flex;
					flex-direction: column;
					gap: 4px;
				}

				.zim-browser-error {
					background: var(--error-container, #93000a);
					color: var(--on-error-container, #ffdad6);
					padding: 12px;
					border-radius: var(--radius-md, 8px);
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.zim-browser-error-close {
					background: transparent;
					border: none;
					color: var(--on-error-container, #ffdad6);
					font-size: 1.25rem;
					cursor: pointer;
					padding: 0 8px;
				}

				.zim-browser-loading {
					text-align: center;
					padding: 24px;
					color: var(--on-surface-variant, #bbcac6);
				}

				.zim-browser-empty {
					text-align: center;
					padding: 24px;
					color: var(--on-surface-variant, #bbcac6);
				}

				.zim-browser-item {
					display: flex;
					align-items: center;
					gap: 12px;
					padding: 12px;
					background: var(--surface-container-low, #0d1c2d);
					border: 1px solid var(--outline, #859490);
					border-radius: var(--radius-md, 8px);
					cursor: pointer;
					transition: background 0.2s, border-color 0.2s;
				}

				.zim-browser-item:hover {
					background: var(--surface-container, #122131);
					border-color: var(--primary, #4fdbc8);
				}

				.zim-browser-item-icon {
					color: var(--primary, #4fdbc8);
					font-size: 1.125rem;
					flex-shrink: 0;
				}

				.zim-browser-item-content {
					flex: 1;
					min-width: 0;
				}

				.zim-browser-item-title {
					font-family: var(--font-body, Geist);
					font-size: 0.9375rem;
					font-weight: 400;
					color: var(--on-surface, #d4e4fa);
					margin: 0;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.zim-browser-item-url {
					font-family: var(--font-code, Geist);
					font-size: 0.75rem;
					color: var(--on-surface-variant, #bbcac6);
					margin: 2px 0 0 0;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.zim-browser-item-score {
					font-family: var(--font-code, Geist);
					font-size: 0.75rem;
					color: var(--primary, #4fdbc8);
					flex-shrink: 0;
				}

				.zim-browser-pagination {
					display: flex;
					gap: 8px;
					padding-top: var(--spacing-base, 8px);
					border-top: 1px solid var(--outline, #859490);
					justify-content: center;
					align-items: center;
				}

				.zim-browser-pagination button {
					background: var(--primary-container, #14b8a6);
					color: var(--on-primary-container, #00423b);
					border: none;
					padding: 8px 16px;
					border-radius: var(--radius-sm, 4px);
					font-family: var(--font-label, Space Grotesk);
					font-size: 0.875rem;
					font-weight: 600;
					cursor: pointer;
					transition: opacity 0.2s;
				}

				.zim-browser-pagination button:hover:not(:disabled) {
					opacity: 0.9;
				}

				.zim-browser-pagination button:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.zim-browser-pagination-info {
					font-family: var(--font-code, Geist);
					font-size: 0.875rem;
					color: var(--on-surface-variant, #bbcac6);
				}
			`}</style>

			<div className="zim-browser">
				<div className="zim-browser-header">
					<h2 className="zim-browser-title">
						{isSearchActive ? 'Search Results' : 'Article Directory'}
					</h2>
					<div className="zim-browser-search">
						<input
							type="text"
							className="zim-browser-search-input"
							placeholder="Search in this pack..."
							value={searchQuery}
							onChange={handleSearchInputChange}
						/>
					</div>
				</div>

				{error && (
					<div className="zim-browser-error">
						<span>{error}</span>
						<button
							onClick={() => setError(null)}
							className="zim-browser-error-close"
						>
							×
						</button>
					</div>
				)}

				<div className="zim-browser-content">
					{loading && displayArticles.length === 0 ? (
						<p className="zim-browser-loading">Loading...</p>
					) : displayArticles.length === 0 ? (
						<p className="zim-browser-empty">
							{isSearchActive ? 'No results found' : 'No articles available'}
						</p>
					) : (
						<>
							{displayArticles.map((url, index) => {
								// For search results, show title and score
								const searchResult = searchResults.find(r => r.url === url);
								const title = searchResult?.title || url;
								const score = searchResult?.score;

								return (
									<div
										key={url}
										className="zim-browser-item"
										onClick={() => handleArticleClick(url)}
									>
										<span className="zim-browser-item-icon">📄</span>
										<div className="zim-browser-item-content">
											<p className="zim-browser-item-title">{title}</p>
											<p className="zim-browser-item-url">{url}</p>
										</div>
										{score !== undefined && (
											<span className="zim-browser-item-score">{score.toFixed(2)}</span>
										)}
									</div>
								);
							})}
						</>
					)}
				</div>

				{/* Pagination for directory view (not search) */}
				{!isSearchActive && !loading && articles.length > 0 && (
					<div className="zim-browser-pagination">
						<button
							onClick={handlePrevPage}
							disabled={offset === 0}
						>
							← Previous
						</button>
						<span className="zim-browser-pagination-info">
							Showing {offset + 1}-{Math.min(offset + limit, totalCount)}
							{hasMore ? '+' : ''}
						</span>
						<button
							onClick={handleNextPage}
							disabled={!hasMore}
						>
							Next →
						</button>
					</div>
				)}

				{/* Reset button when searching */}
				{isSearchActive && !loading && (
					<div className="zim-browser-pagination">
						<button onClick={handleResetOffset}>
							Clear Search
						</button>
					</div>
				)}
			</div>
		</>
	);
}
