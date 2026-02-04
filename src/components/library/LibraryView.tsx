// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useState } from 'react';
import { Grid, List, Plus } from 'lucide-react';
import { useArchiveStore } from '../../stores/archiveStore';
import { ArchiveCard } from './ArchiveCard';
import { DropZone } from './DropZone';

type ViewMode = 'grid' | 'list';

export function LibraryView() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { archives, setCurrentArchive } = useArchiveStore();

  const handleOpenArchive = (archive: typeof archives[0]) => {
    setCurrentArchive(archive);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl font-semibold">Library</h1>
          <p className="text-sm text-secondary">
            {archives.length} {archives.length === 1 ? 'archive' : 'archives'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex surface rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-[var(--accent)] text-white' 
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list' 
                  ? 'bg-[var(--accent)] text-white' 
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Add Archive Button */}
          <button className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />
            Add Archive
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {archives.length === 0 ? (
          <DropZone />
        ) : (
          <>
            {/* Archive Grid/List */}
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'flex flex-col gap-2'
            }>
              {archives.map((archive) => (
                <ArchiveCard
                  key={archive.id}
                  archive={archive}
                  viewMode={viewMode}
                  onOpen={() => handleOpenArchive(archive)}
                />
              ))}
            </div>

            {/* Drop zone at bottom */}
            <div className="mt-6">
              <DropZone compact />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
