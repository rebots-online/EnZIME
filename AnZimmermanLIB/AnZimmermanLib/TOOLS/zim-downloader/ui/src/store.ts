// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import { create } from 'zustand';

export interface Repository {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface ZimEntry {
  id: string;
  name: string;
  title: string;
  language: string;
  category: string;
  size: number;
  url: string;
  mirrors: string[];
  date: string | null;
  sha256: string | null;
  article_count: number | null;
  media_count: number | null;
  repository: string;
  tags: string[];
  flavor: string | null;
}

export interface DownloadTask {
  id: string;
  zim: ZimEntry;
  target_path: string;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  downloaded: number;
  total: number;
  speed: number;
  eta: number | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

export interface Annotation {
  id: string;
  type: 'voice' | 'ink' | 'text';
  content: string; // Base64 audio, SVG path, or text
  x: number;
  y: number;
  color: string;
  createdAt: string;
  zimId?: string;
  pageUrl?: string;
}

export interface Config {
  download_dir: string;
  max_concurrent_downloads: number;
  enable_resume: boolean;
  verify_checksums: boolean;
  preferred_repositories: string[];
  auto_update_repos: boolean;
  theme: 'dark' | 'light';
  human_readable_sizes: boolean;
  speed_limit: number;
  proxy: { url: string; username?: string; password?: string } | null;
}

interface AppState {
  // Repositories
  repositories: Repository[];
  currentRepo: string | null;
  setRepositories: (repos: Repository[]) => void;
  setCurrentRepo: (id: string | null) => void;

  // ZIM entries
  zimEntries: ZimEntry[];
  filteredEntries: ZimEntry[];
  searchQuery: string;
  setZimEntries: (entries: ZimEntry[]) => void;
  setFilteredEntries: (entries: ZimEntry[]) => void;
  setSearchQuery: (query: string) => void;

  // Downloads
  activeDownloads: DownloadTask[];
  downloadHistory: DownloadTask[];
  setActiveDownloads: (downloads: DownloadTask[]) => void;
  setDownloadHistory: (history: DownloadTask[]) => void;
  addDownload: (download: DownloadTask) => void;
  updateDownload: (id: string, updates: Partial<DownloadTask>) => void;

  // Annotations
  annotations: Annotation[];
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;

  // Config
  config: Config | null;
  setConfig: (config: Config) => void;

  // UI State
  selectedZim: ZimEntry | null;
  setSelectedZim: (zim: ZimEntry | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Repositories
  repositories: [],
  currentRepo: null,
  setRepositories: (repos) => set({ repositories: repos }),
  setCurrentRepo: (id) => set({ currentRepo: id }),

  // ZIM entries
  zimEntries: [],
  filteredEntries: [],
  searchQuery: '',
  setZimEntries: (entries) => set({ zimEntries: entries, filteredEntries: entries }),
  setFilteredEntries: (entries) => set({ filteredEntries: entries }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Downloads
  activeDownloads: [],
  downloadHistory: [],
  setActiveDownloads: (downloads) => set({ activeDownloads: downloads }),
  setDownloadHistory: (history) => set({ downloadHistory: history }),
  addDownload: (download) =>
    set((state) => ({ activeDownloads: [...state.activeDownloads, download] })),
  updateDownload: (id, updates) =>
    set((state) => ({
      activeDownloads: state.activeDownloads.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    })),

  // Annotations
  annotations: [],
  addAnnotation: (annotation) =>
    set((state) => ({ annotations: [...state.annotations, annotation] })),
  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    })),
  updateAnnotation: (id, updates) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),

  // Config
  config: null,
  setConfig: (config) => set({ config }),

  // UI State
  selectedZim: null,
  setSelectedZim: (zim) => set({ selectedZim: zim }),
}));
