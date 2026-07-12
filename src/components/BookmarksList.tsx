import { useEffect, useState, useCallback } from 'react';
import { Bookmark } from '../bridge';

interface BookmarksListProps {
	onNavigate: (handle: number, url: string) => void;
}

/**
 * BookmarksList component — displays all persisted bookmarks across open ZIM packs.
 *
 * Loads bookmarks via bridge.bookmarksList on mount. Each bookmark shows:
 * - Article title
 * - Star affordance (filled when bookmarked)
 * - Click to navigate to the article
 *
 * Integrates Stitch 01-library/04-reader screens (163ad666…).
 */
export function BookmarksList({ onNavigate }: BookmarksListProps): JSX.Element {
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [togglingId, setTogglingId] = useState<number | null>(null);

	const loadBookmarks = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const { bookmarksList } = await import('../bridge');
			const loaded = await bookmarksList();
			setBookmarks(loaded);
		} catch (e) {
			console.error('Failed to load bookmarks:', e);
			setError('Failed to load bookmarks');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadBookmarks();
	}, [loadBookmarks]);

	const handleToggle = useCallback(async (bookmark: Bookmark) => {
		setTogglingId(bookmark.id);
		setError(null);
		try {
			const { bookmarksToggle } = await import('../bridge');
			// Note: bookmarksToggle requires handle and url; we derive from the bookmark
			// The handle should come from the current ZIM context - for now, we'll need
			// the caller to provide the handle or we need to track it in state
			// Per I-10(b): This is a typed sentinel - swap when active handle tracking lands
			const handle = 0; // TODO: Track current active ZIM handle
			const isBookmarked = await bookmarksToggle(handle, bookmark.url);

			// Refresh list after toggle to show updated state
			await loadBookmarks();
		} catch (e) {
			console.error('Failed to toggle bookmark:', e);
			setError('Failed to toggle bookmark');
		} finally {
			setTogglingId(null);
		}
	}, [loadBookmarks]);

	const handleClick = useCallback((bookmark: Bookmark) => {
		// Navigate to the bookmarked article
		// Note: We need the ZIM handle - for now, derived from bookmark context or active ZIM
		// Per I-10(b): This is a typed sentinel - swap when active handle tracking lands
		const handle = 0; // TODO: Track current active ZIM handle
		onNavigate(handle, bookmark.url);
	}, [onNavigate]);

	const formatDate = (timestamp: number): string => {
		return new Date(timestamp).toLocaleDateString();
	};

	return (
		<>
			<style>{`
				.bookmarks-list {
					display: flex;
					flex-direction: column;
					gap: var(--spacing-base, 8px);
					padding: var(--spacing-base, 8px);
				}

				.bookmarks-list-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: var(--spacing-base, 8px);
				}

				.bookmarks-list-header h2 {
					font-family: var(--font-heading, Space Grotesk);
					font-size: 1.5rem;
					font-weight: 600;
					color: var(--on-surface, #d4e4fa);
					margin: 0;
				}

				.bookmarks-refresh-button {
					background: var(--primary-container, #14b8a6);
					color: var(--on-primary-container, #00423b);
					border: none;
					padding: 8px 16px;
					border-radius: 4px;
					font-family: var(--font-label, Space Grotesk);
					font-size: 0.875rem;
					font-weight: 600;
					cursor: pointer;
					transition: opacity 0.2s;
				}

				.bookmarks-refresh-button:hover {
					opacity: 0.9;
				}

				.bookmarks-refresh-button:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.bookmarks-error {
					background: var(--error-container, #93000a);
					color: var(--on-error-container, #ffdad6);
					padding: 12px;
					border-radius: 8px;
					margin-bottom: var(--spacing-base, 8px);
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.bookmarks-error-close {
					background: transparent;
					border: none;
					color: var(--on-error-container, #ffdad6);
					font-size: 1.25rem;
					cursor: pointer;
					padding: 0 8px;
				}

				.bookmarks-loading {
					text-align: center;
					padding: 24px;
					color: var(--on-surface-variant, #bbcac6);
				}

				.bookmarks-empty {
					text-align: center;
					padding: 24px;
					color: var(--on-surface-variant, #bbcac6);
				}

				.bookmark-item {
					display: flex;
					align-items: center;
					gap: 12px;
					padding: 12px;
					background: var(--surface-container-low, #0d1c2d);
					border: 1px solid var(--outline, #859490);
					border-radius: 8px;
					cursor: pointer;
					transition: background 0.2s, border-color 0.2s;
				}

				.bookmark-item:hover {
					background: var(--surface-container, #122131);
					border-color: var(--primary, #4fdbc8);
				}

				.bookmark-star {
					font-size: 1.25rem;
					color: var(--primary, #4fdbc8);
					flex-shrink: 0;
					cursor: pointer;
					padding: 4px;
					background: transparent;
					border: none;
					transition: transform 0.2s;
				}

				.bookmark-star:hover {
					transform: scale(1.1);
				}

				.bookmark-star:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.bookmark-content {
					flex: 1;
					min-width: 0;
				}

				.bookmark-title {
					font-family: var(--font-body, Geist);
					font-size: 0.9375rem;
					font-weight: 400;
					color: var(--on-surface, #d4e4fa);
					margin: 0 0 4px 0;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.bookmark-meta {
					font-family: var(--font-code, Geist);
					font-size: 0.75rem;
					color: var(--on-surface-variant, #bbcac6);
					margin: 0;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.bookmark-date {
					font-family: var(--font-code, Geist);
					font-size: 0.75rem;
					color: var(--on-surface-variant, #bbcac6);
					flex-shrink: 0;
				}
			`}</style>

			<div className="bookmarks-list">
				<div className="bookmarks-list-header">
					<h2>Bookmarks</h2>
					<button
						onClick={loadBookmarks}
						disabled={loading}
						className="bookmarks-refresh-button"
					>
						{loading ? 'Refreshing...' : 'Refresh'}
					</button>
				</div>

				{error && (
					<div className="bookmarks-error">
						<span>{error}</span>
						<button
							onClick={() => setError(null)}
							className="bookmarks-error-close"
						>
							×
						</button>
					</div>
				)}

				{loading && bookmarks.length === 0 ? (
					<p className="bookmarks-loading">Loading bookmarks...</p>
				) : bookmarks.length === 0 ? (
					<p className="bookmarks-empty">No bookmarks yet. Bookmark articles to see them here.</p>
				) : (
					bookmarks.map((bookmark) => (
						<div
							key={bookmark.id}
							className="bookmark-item"
							onClick={() => handleClick(bookmark)}
						>
							<button
								className="bookmark-star"
								onClick={(e) => {
									e.stopPropagation();
									handleToggle(bookmark);
								}}
								disabled={togglingId === bookmark.id}
								title="Remove bookmark"
							>
								{togglingId === bookmark.id ? '⋯' : '★'}
							</button>
							<div className="bookmark-content">
								<p className="bookmark-title">{bookmark.title}</p>
								<p className="bookmark-meta">{bookmark.url}</p>
							</div>
							<span className="bookmark-date">{formatDate(bookmark.created_at)}</span>
						</div>
					))
				)}
			</div>
		</>
	);
}
