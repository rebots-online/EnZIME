// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useState, useCallback } from 'react';
import { Search, X, Clock, TrendingUp, BookOpen } from 'lucide-react';
import { useArchiveStore } from '../../stores/archiveStore';
import { zimService } from '../../services/zimService';

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  archiveId: string;
  archiveName: string;
  score: number;
}

export function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { archives, recentArticles, setCurrentArticle, setCurrentArchive } = useArchiveStore();

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      const allResults: SearchResult[] = [];
      
      for (const archive of archives) {
        const entries = zimService.searchArticles(archive.id, searchQuery, 20);
        
        for (const entry of entries) {
          allResults.push({
            url: entry.url,
            title: entry.title,
            snippet: `Article from ${archive.title}`,
            archiveId: archive.id,
            archiveName: archive.title,
            score: entry.title.toLowerCase().startsWith(searchQuery.toLowerCase()) ? 1 : 0.5,
          });
        }
      }
      
      // Sort by score descending
      allResults.sort((a, b) => b.score - a.score);
      setResults(allResults.slice(0, 50));
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [archives]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    handleSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
  };

  const handleResultClick = (result: SearchResult) => {
    const archive = archives.find(a => a.id === result.archiveId);
    if (archive) {
      setCurrentArchive(archive);
      setCurrentArticle({
        url: result.url,
        title: result.title,
        archiveId: result.archiveId,
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search across all archives..."
            className="w-full pl-12 pr-10 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded"
            >
              <X className="w-4 h-4 text-secondary" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isSearching ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : query && results.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 mx-auto mb-4 text-secondary" />
            <p className="text-secondary">No results found for "{query}"</p>
          </div>
        ) : !query ? (
          <div className="max-w-2xl mx-auto">
            {/* Recent Searches */}
            {recentArticles.length > 0 && (
              <div className="mb-8">
                <h3 className="flex items-center gap-2 text-sm font-medium text-secondary mb-3">
                  <Clock className="w-4 h-4" />
                  Recently Viewed
                </h3>
                <div className="space-y-2">
                  {recentArticles.slice(0, 5).map((article, index) => (
                    <button
                      key={`${article.archiveId}-${article.url}-${index}`}
                      onClick={() => handleResultClick({
                        url: article.url,
                        title: article.title,
                        snippet: '',
                        archiveId: article.archiveId,
                        archiveName: '',
                        score: 1,
                      })}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors"
                    >
                      <BookOpen className="w-4 h-4 text-secondary flex-shrink-0" />
                      <span className="truncate">{article.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Topics */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-medium text-secondary mb-3">
                <TrendingUp className="w-4 h-4" />
                Explore Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {['Science', 'History', 'Technology', 'Mathematics', 'Geography', 'Arts'].map(topic => (
                  <button
                    key={topic}
                    onClick={() => {
                      setQuery(topic);
                      handleSearch(topic);
                    }}
                    className="px-4 py-2 rounded-full border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {results.map((result, index) => (
              <button
                key={`${result.archiveId}-${result.url}-${index}`}
                onClick={() => handleResultClick(result)}
                className="w-full text-left p-4 rounded-lg surface hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{result.title}</h4>
                    <p className="text-sm text-secondary line-clamp-2 mt-1">{result.snippet}</p>
                    <p className="text-xs text-secondary mt-2">{result.archiveName}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
