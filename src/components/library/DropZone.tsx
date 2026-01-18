// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useState, useCallback } from 'react';
import { Upload, FolderOpen, Download } from 'lucide-react';
import { zimService } from '../../services/zimService';
import { useArchiveStore } from '../../stores/archiveStore';

interface DropZoneProps {
  compact?: boolean;
}

export function DropZone({ compact = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addArchive } = useArchiveStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const zimFiles = files.filter(f => f.name.endsWith('.zim'));
    
    if (zimFiles.length > 0) {
      console.log('ZIM files dropped:', zimFiles.map(f => f.name));
    }
  }, []);

  const handleBrowse = useCallback(async () => {
    setIsLoading(true);
    try {
      const filePath = await zimService.openFileDialog();
      if (filePath) {
        const archiveInfo = await zimService.loadArchive(filePath);
        if (archiveInfo) {
          addArchive({
            id: archiveInfo.id,
            name: archiveInfo.name,
            title: archiveInfo.title,
            description: archiveInfo.description,
            language: archiveInfo.language,
            articleCount: archiveInfo.articleCount,
            mediaCount: 0,
            size: archiveInfo.size,
            path: archiveInfo.path,
            favicon: archiveInfo.favicon,
            addedAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to load archive:', error);
    } finally {
      setIsLoading(false);
    }
  }, [addArchive]);

  if (compact) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
          ${isDragging 
            ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
            : 'border-[var(--border)] hover:border-[var(--accent)]/50'
          }
        `}
        onClick={handleBrowse}
      >
        <div className="flex items-center justify-center gap-3">
          <Upload className={`w-5 h-5 ${isDragging ? 'text-[var(--accent)]' : 'text-secondary'}`} />
          <span className="text-sm text-secondary">
            Drop ZIM files here or <span className="text-[var(--accent)]">browse</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        h-full flex flex-col items-center justify-center
        border-2 border-dashed rounded-2xl p-8 transition-colors
        ${isDragging 
          ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
          : 'border-[var(--border)]'
        }
      `}
    >
      <div className={`
        w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-colors
        ${isDragging 
          ? 'bg-[var(--accent)]/20' 
          : 'bg-gradient-to-br from-cyan-400/20 to-blue-600/20'
        }
      `}>
        <Upload className={`w-10 h-10 ${isDragging ? 'text-[var(--accent)]' : 'text-[var(--accent)]'}`} />
      </div>

      <h2 className="text-xl font-semibold mb-2">
        {isLoading ? 'Loading archive...' : isDragging ? 'Drop to import' : 'Add your first archive'}
      </h2>
      
      <p className="text-secondary text-center max-w-md mb-6">
        Drag and drop ZIM files here, or use the buttons below to browse or download archives.
      </p>

      <div className="flex gap-3">
        <button 
          onClick={handleBrowse}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium"
        >
          <FolderOpen className="w-4 h-4" />
          Browse Files
        </button>
        <button className="surface flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium hover:border-[var(--accent)] transition-colors">
          <Download className="w-4 h-4" />
          Download Archives
        </button>
      </div>

      <p className="text-xs text-secondary mt-6">
        Supports .zim files from Kiwix and other ZIM-compatible sources
      </p>
    </div>
  );
}
