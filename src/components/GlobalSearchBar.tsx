import type { JSX } from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { packSearchGlobal, type GlobalSearchHit } from '../bridge';

interface GlobalSearchBarProps {
  onNavigate: (uuid: string, url: string) => void;
}

/**
 * GlobalSearchBar component — cross-ZIM search with debounced input.
 *
 * Integrates Stitch screen 05-search (3c7cc8b3efac40869ba707792b6d6172).
 * Typing queries pack_search_global, rendering ranked GlobalSearchHit results.
 * Clicking a hit navigates to that article in the reader — all offline.
 */
export function GlobalSearchBar({ onNavigate }: GlobalSearchBarProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounce timer ref
  const searchTimerRef = useRef<number | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback((searchQuery: string) => {
    if (searchTimerRef.current !== null) {
      clearTimeout(searchTimerRef.current);
    }

    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    searchTimerRef.current = window.setTimeout(async () => {
      try {
        const hits = await packSearchGlobal(searchQuery, 20);
        setResults(hits);
      } catch (error) {
        console.error('Global search failed:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce
  }, []);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    debouncedSearch(newQuery);
  };

  // Handle result click
  const handleResultClick = (hit: GlobalSearchHit) => {
    onNavigate(hit.zim_uuid, hit.url);
    setShowResults(false);
    setQuery('');
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current !== null) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className="global-search-bar"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      {/* Search input */}
      <div
        className="global-search-input-wrapper"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <input
          type="search"
          className="global-search-input"
          placeholder="Search across all ZIMs..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          onBlur={() => {
            // Delay hiding to allow click events to fire
            setTimeout(() => setShowResults(false), 200);
          }}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '0.9375rem',
            fontFamily: 'var(--font-body)',
            color: 'var(--onSurface)',
            backgroundColor: 'var(--surfaceContainerHigh)',
            border: '1px solid var(--outline)',
            borderRadius: 'var(--radius-sm)',
            outline: 'none',
            transition: 'border-color 150ms ease',
          }}
        />
        {isSearching && (
          <div
            className="search-spinner"
            style={{
              position: 'absolute',
              right: '12px',
              width: '16px',
              height: '16px',
              border: '2px solid var(--outlineVariant)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        )}
      </div>

      {/* Search results dropdown */}
      {showResults && (
        <div
          className="global-search-results"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '400px',
            overflowY: 'auto',
            backgroundColor: 'var(--surfaceContainerHigh)',
            border: '1px solid var(--outline)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
          }}
        >
          {results.length === 0 ? (
            <div
              className="search-empty"
              style={{
                padding: '16px',
                textAlign: 'center',
                color: 'var(--onSurfaceVariant)',
                fontSize: '0.875rem',
              }}
            >
              {isSearching ? 'Searching...' : 'No results found'}
            </div>
          ) : (
            results.map((hit, index) => (
              <div
                key={`${hit.zim_uuid}-${hit.url}-${index}`}
                className="global-search-hit"
                onClick={() => handleResultClick(hit)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: index < results.length - 1 ? '1px solid var(--outlineVariant)' : 'none',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surfaceContainerHighest)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* ZIM title (source) */}
                <div
                  className="search-hit-zim-title"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--primary)',
                    fontWeight: 600,
                    marginBottom: '4px',
                    fontFamily: 'var(--font-label)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {hit.zim_title}
                </div>

                {/* Article title */}
                <div
                  className="search-hit-article-title"
                  style={{
                    fontSize: '0.9375rem',
                    color: 'var(--onSurface)',
                    fontWeight: 500,
                    marginBottom: '4px',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {hit.title}
                </div>

                {/* Snippet */}
                {hit.snippet && (
                  <div
                    className="search-hit-snippet"
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--onSurfaceVariant)',
                      lineHeight: '1.4',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {hit.snippet}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Inline styles for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
