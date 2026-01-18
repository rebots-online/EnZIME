// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import { useEffect, useState } from 'react';
import { HardDrive, Download, Clock } from 'lucide-react';
import { useStore } from '../store';
import { getVersionString } from '../lib/themes';

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

interface StatusBarProps {
  theme?: {
    bg: string;
    bgSecondary: string;
    fg: string;
    fgSecondary: string;
    fgMuted: string;
    accent: string;
    border: string;
    success: string;
  };
}

export default function StatusBar({ theme }: StatusBarProps) {
  const { activeDownloads, config } = useStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalSpeed = activeDownloads.reduce((sum, d) => sum + d.speed, 0);
  const totalDownloading = activeDownloads.filter(d => d.status === 'downloading').length;

  // Default theme colors if not provided
  const colors = theme || {
    bg: '#1f2937',
    bgSecondary: '#374151',
    fg: '#f3f4f6',
    fgSecondary: '#d1d5db',
    fgMuted: '#9ca3af',
    accent: '#f97316',
    border: '#374151',
    success: '#22c55e',
  };

  return (
    <footer 
      className="flex items-center justify-between px-4 py-1 border-t text-xs"
      style={{ 
        backgroundColor: colors.bgSecondary, 
        borderColor: colors.border,
        color: colors.fgMuted 
      }}
    >
      <div className="flex items-center gap-4">
        {totalDownloading > 0 && (
          <div className="flex items-center gap-2">
            <Download size={12} style={{ color: colors.success }} />
            <span>{totalDownloading} downloading</span>
            <span style={{ color: colors.success }}>{formatSize(totalSpeed)}/s</span>
          </div>
        )}
        {config && (
          <div className="flex items-center gap-2">
            <HardDrive size={12} />
            <span className="truncate max-w-48">{config.download_dir}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Clock size={12} />
          <span>{time.toLocaleTimeString()}</span>
        </div>
        <span style={{ color: colors.accent }}>{getVersionString()}</span>
      </div>
    </footer>
  );
}
