// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ZimArchive {
  id: string;
  name: string;
  title: string;
  description: string;
  language: string;
  articleCount: number;
  mediaCount: number;
  size: number;
  path: string;
  favicon?: string;
  lastOpened?: Date;
  addedAt: Date;
}

export interface Article {
  url: string;
  title: string;
  content?: string;
  archiveId: string;
}

interface ArchiveState {
  archives: ZimArchive[];
  currentArchive: ZimArchive | null;
  currentArticle: Article | null;
  recentArticles: Article[];
  bookmarks: Article[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addArchive: (archive: ZimArchive) => void;
  removeArchive: (id: string) => void;
  setCurrentArchive: (archive: ZimArchive | null) => void;
  setCurrentArticle: (article: Article | null) => void;
  addToRecent: (article: Article) => void;
  addBookmark: (article: Article) => void;
  removeBookmark: (url: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useArchiveStore = create<ArchiveState>()(
  persist(
    (set, get) => ({
      archives: [],
      currentArchive: null,
      currentArticle: null,
      recentArticles: [],
      bookmarks: [],
      isLoading: false,
      error: null,

      addArchive: (archive) => {
        set((state) => ({
          archives: [...state.archives.filter(a => a.id !== archive.id), archive],
        }));
      },

      removeArchive: (id) => {
        set((state) => ({
          archives: state.archives.filter((a) => a.id !== id),
          currentArchive: state.currentArchive?.id === id ? null : state.currentArchive,
        }));
      },

      setCurrentArchive: (archive) => {
        if (archive) {
          set((state) => ({
            currentArchive: archive,
            archives: state.archives.map(a => 
              a.id === archive.id ? { ...a, lastOpened: new Date() } : a
            ),
          }));
        } else {
          set({ currentArchive: null });
        }
      },

      setCurrentArticle: (article) => {
        set({ currentArticle: article });
        if (article) {
          get().addToRecent(article);
        }
      },

      addToRecent: (article) => {
        set((state) => {
          const filtered = state.recentArticles.filter(
            (a) => a.url !== article.url || a.archiveId !== article.archiveId
          );
          return {
            recentArticles: [article, ...filtered].slice(0, 50),
          };
        });
      },

      addBookmark: (article) => {
        set((state) => ({
          bookmarks: state.bookmarks.some(
            (b) => b.url === article.url && b.archiveId === article.archiveId
          )
            ? state.bookmarks
            : [...state.bookmarks, article],
        }));
      },

      removeBookmark: (url) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.url !== url),
        }));
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'enzim-archive-store',
      partialize: (state) => ({
        archives: state.archives,
        recentArticles: state.recentArticles,
        bookmarks: state.bookmarks,
      }),
    }
  )
);
