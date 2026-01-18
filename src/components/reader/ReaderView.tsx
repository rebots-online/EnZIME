// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Bookmark, 
  BookmarkCheck,
  Share2, 
  ZoomIn, 
  ZoomOut,
  Maximize,
  PanelRightOpen,
  Home,
  Loader2
} from 'lucide-react';
import { useArchiveStore, Article } from '../../stores/archiveStore';
import { zimService } from '../../services/zimService';

interface ReaderViewProps {
  onToggleMesh?: () => void;
  meshOpen?: boolean;
}

export function ReaderView({ onToggleMesh, meshOpen }: ReaderViewProps) {
  const { currentArticle, currentArchive, bookmarks, addBookmark, removeBookmark, setCurrentArticle } = useArchiveStore();
  const [fontSize, setFontSize] = useState(16);
  const [history] = useState<Article[]>([]);
  const [historyIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [articleContent, setArticleContent] = useState<string | null>(null);

  useEffect(() => {
    async function loadContent() {
      if (!currentArticle || !currentArchive) {
        setArticleContent(null);
        return;
      }

      if (currentArticle.content) {
        setArticleContent(currentArticle.content);
        return;
      }

      setIsLoading(true);
      try {
        const entry = zimService.getEntryByUrl(currentArchive.id, currentArticle.url);
        if (entry && !entry.isRedirect) {
          const content = await zimService.getArticleContent(currentArchive.id, entry);
          if (content) {
            setArticleContent(content);
            setCurrentArticle({ ...currentArticle, content });
          } else {
            setArticleContent('<p>Failed to load article content.</p>');
          }
        } else {
          setArticleContent('<p>Article not found.</p>');
        }
      } catch (error) {
        console.error('Failed to load article:', error);
        setArticleContent('<p>Error loading article content.</p>');
      } finally {
        setIsLoading(false);
      }
    }

    loadContent();
  }, [currentArticle?.url, currentArchive?.id, setCurrentArticle]);

  const isBookmarked = currentArticle && bookmarks.some(
    b => b.url === currentArticle.url && b.archiveId === currentArticle.archiveId
  );

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const handleBookmarkToggle = () => {
    if (!currentArticle) return;
    if (isBookmarked) {
      removeBookmark(currentArticle.url);
    } else {
      addBookmark(currentArticle);
    }
  };

  const handleZoomIn = () => setFontSize(prev => Math.min(prev + 2, 32));
  const handleZoomOut = () => setFontSize(prev => Math.max(prev - 2, 10));

  if (!currentArchive) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Home className="w-12 h-12 mx-auto mb-4 text-secondary" />
          <h2 className="text-xl font-semibold mb-2">No archive selected</h2>
          <p className="text-secondary">Select an archive from the library to start reading</p>
        </div>
      </div>
    );
  }

  if (!currentArticle) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <Home className="w-12 h-12 mx-auto mb-4 text-[var(--accent)]" />
          <h2 className="text-xl font-semibold mb-2">
            {currentArchive.title || currentArchive.name}
          </h2>
          <p className="text-secondary mb-4">{currentArchive.description}</p>
          <p className="text-sm text-secondary">
            Use the search bar above or browse topics to start reading
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Reader Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-2">
          {/* Navigation */}
          <button 
            onClick={() => {}}
            disabled={!canGoBack}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={() => {}}
            disabled={!canGoForward}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
            aria-label="Go forward"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <div className="ml-2 text-sm">
            <span className="text-secondary">{currentArchive.title} / </span>
            <span className="font-medium">{currentArticle.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom Controls */}
          <button 
            onClick={handleZoomOut}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-secondary w-10 text-center">{fontSize}px</span>
          <button 
            onClick={handleZoomIn}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-[var(--border)] mx-2" />

          {/* Actions */}
          <button 
            onClick={handleBookmarkToggle}
            className={`p-2 rounded-lg transition-colors ${
              isBookmarked 
                ? 'text-[var(--accent)] bg-[var(--accent)]/10' 
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
          <button 
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button 
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-[var(--border)] mx-2" />

          {/* Mesh Toggle */}
          <button 
            onClick={onToggleMesh}
            className={`p-2 rounded-lg transition-colors ${
              meshOpen 
                ? 'text-[var(--accent)] bg-[var(--accent)]/10' 
                : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            aria-label="Toggle semantic mesh"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Article Content */}
      <div className="flex-1 overflow-auto">
        <article 
          className="max-w-3xl mx-auto px-8 py-6 prose prose-neutral dark:prose-invert"
          style={{ fontSize: `${fontSize}px` }}
        >
          <h1>{currentArticle.title}</h1>
          
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-[var(--accent)]" />
              <p className="text-secondary">Loading article content...</p>
            </div>
          ) : articleContent ? (
            <div dangerouslySetInnerHTML={{ __html: articleContent }} />
          ) : (
            <div className="text-center py-12">
              <p className="text-secondary">No content available</p>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
