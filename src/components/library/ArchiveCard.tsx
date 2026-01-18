// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { BookOpen, MoreVertical, Trash2, FolderOpen, Info } from 'lucide-react';
import { ZimArchive } from '../../stores/archiveStore';

interface ArchiveCardProps {
  archive: ZimArchive;
  viewMode: 'grid' | 'list';
  onOpen: () => void;
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function ArchiveCard({ archive, viewMode, onOpen }: ArchiveCardProps) {
  if (viewMode === 'list') {
    return (
      <div 
        className="surface rounded-lg p-4 flex items-center gap-4 hover:border-[var(--accent)] cursor-pointer transition-colors"
        onClick={onOpen}
      >
        {/* Icon */}
        <div className="w-12 h-12 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
          {archive.favicon ? (
            <img src={archive.favicon} alt="" className="w-8 h-8" />
          ) : (
            <BookOpen className="w-6 h-6 text-[var(--accent)]" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{archive.title || archive.name}</h3>
          <p className="text-sm text-secondary truncate">{archive.description}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm text-secondary">
          <span>{formatNumber(archive.articleCount)} articles</span>
          <span>{formatSize(archive.size)}</span>
          <span className="uppercase">{archive.language}</span>
        </div>

        {/* Actions */}
        <button 
          className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="surface rounded-xl overflow-hidden hover:border-[var(--accent)] cursor-pointer transition-all hover:shadow-lg group"
      onClick={onOpen}
    >
      {/* Header/Icon */}
      <div className="h-32 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 flex items-center justify-center relative">
        {archive.favicon ? (
          <img src={archive.favicon} alt="" className="w-16 h-16" />
        ) : (
          <BookOpen className="w-12 h-12 text-[var(--accent)]" />
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
            <FolderOpen className="w-5 h-5 text-white" />
          </button>
          <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
            <Info className="w-5 h-5 text-white" />
          </button>
          <button className="p-2 bg-white/20 rounded-lg hover:bg-red-500/50 transition-colors">
            <Trash2 className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium truncate mb-1">{archive.title || archive.name}</h3>
        <p className="text-sm text-secondary line-clamp-2 mb-3">{archive.description}</p>
        
        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-secondary">
          <span>{formatNumber(archive.articleCount)} articles</span>
          <span>{formatSize(archive.size)}</span>
          <span className="uppercase font-medium">{archive.language}</span>
        </div>
      </div>
    </div>
  );
}
