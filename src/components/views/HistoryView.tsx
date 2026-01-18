// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { Clock, Trash2, BookOpen } from 'lucide-react';
import { useArchiveStore } from '../../stores/archiveStore';
import { getEntitlementsGatekeeper } from '../../entitlements';

export function HistoryView() {
  const { recentArticles, archives, setCurrentArchive, setCurrentArticle } = useArchiveStore();
  const canViewHistory = getEntitlementsGatekeeper().can('history.view');

  if (!canViewHistory) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-[var(--accent)]" />
            <h1 className="text-xl font-semibold">History</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <Clock className="w-12 h-12 mx-auto mb-4 text-secondary" />
            <h2 className="text-lg font-medium mb-2">History is unavailable</h2>
            <p className="text-secondary text-sm">
              This capability is not enabled for your current entitlements.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleArticleClick = (article: typeof recentArticles[0]) => {
    const archive = archives.find(a => a.id === article.archiveId);
    if (archive) {
      setCurrentArchive(archive);
      setCurrentArticle(article);
    }
  };

  const groupByDate = (articles: typeof recentArticles) => {
    const groups: { [key: string]: typeof recentArticles } = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    articles.forEach(article => {
      const dateStr = today; // Placeholder since we don't track access time
      const label = dateStr === today ? 'Today' : dateStr === yesterday ? 'Yesterday' : dateStr;
      if (!groups[label]) groups[label] = [];
      groups[label].push(article);
    });

    return groups;
  };

  const groupedArticles = groupByDate(recentArticles);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="text-xl font-semibold">History</h1>
        </div>
        {recentArticles.length > 0 && (
          <button className="text-sm text-secondary hover:text-red-500 transition-colors flex items-center gap-1">
            <Trash2 className="w-4 h-4" />
            Clear History
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {recentArticles.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-secondary" />
              <h2 className="text-lg font-medium mb-2">No history yet</h2>
              <p className="text-secondary text-sm">
                Articles you read will appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedArticles).map(([date, articles]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-secondary mb-2">{date}</h3>
                <div className="space-y-1">
                  {articles.map((article, index) => (
                    <button
                      key={`${article.archiveId}-${article.url}-${index}`}
                      onClick={() => handleArticleClick(article)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors"
                    >
                      <BookOpen className="w-4 h-4 text-secondary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{article.title}</p>
                        <p className="text-xs text-secondary truncate">
                          {archives.find(a => a.id === article.archiveId)?.title || 'Unknown archive'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
