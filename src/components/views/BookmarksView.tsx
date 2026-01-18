// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { Bookmark, BookOpen, Trash2 } from 'lucide-react';
import { useArchiveStore } from '../../stores/archiveStore';

export function BookmarksView() {
  const { bookmarks, archives, setCurrentArchive, setCurrentArticle, removeBookmark } = useArchiveStore();

  const handleArticleClick = (article: typeof bookmarks[0]) => {
    const archive = archives.find(a => a.id === article.archiveId);
    if (archive) {
      setCurrentArchive(archive);
      setCurrentArticle(article);
    }
  };

  const handleRemoveBookmark = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    removeBookmark(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <Bookmark className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="text-xl font-semibold">Bookmarks</h1>
        </div>
        <span className="text-sm text-secondary">
          {bookmarks.length} {bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {bookmarks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Bookmark className="w-12 h-12 mx-auto mb-4 text-secondary" />
              <h2 className="text-lg font-medium mb-2">No bookmarks yet</h2>
              <p className="text-secondary text-sm">
                Save articles to read later by clicking the bookmark icon
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {bookmarks.map((article, index) => (
              <div
                key={`${article.archiveId}-${article.url}-${index}`}
                className="group surface rounded-lg p-4 hover:border-[var(--accent)] cursor-pointer transition-colors"
                onClick={() => handleArticleClick(article)}
              >
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{article.title}</p>
                    <p className="text-sm text-secondary truncate mt-1">
                      {archives.find(a => a.id === article.archiveId)?.title || 'Unknown archive'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleRemoveBookmark(e, article.url)}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all"
                    aria-label="Remove bookmark"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
