// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { Menu, Search, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';

interface AppInfo {
  name: string;
  version: string;
}

interface HeaderProps {
  appInfo: AppInfo;
  onMenuToggle: () => void;
}

export function Header({ appInfo, onMenuToggle }: HeaderProps) {
  const { mode, setMode, effectiveMode } = useTheme();

  const cycleMode = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  const getModeIcon = () => {
    if (mode === 'system') return <Monitor className="w-5 h-5" />;
    if (effectiveMode === 'dark') return <Moon className="w-5 h-5" />;
    return <Sun className="w-5 h-5" />;
  };

  return (
    <header className="surface h-16 flex items-center px-4 gap-4 border-b">
      {/* Menu Toggle */}
      <button 
        onClick={onMenuToggle}
        className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">E</span>
        </div>
        <span className="font-semibold text-lg">{appInfo.name}</span>
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-2xl mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
          <input
            type="text"
            placeholder="Search articles... ⌘K"
            className="w-full pl-10 pr-4 py-2 surface rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-2 text-sm text-secondary">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Ready
        </span>
      </div>

      {/* Theme Toggle */}
      <button 
        onClick={cycleMode}
        className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
        aria-label={`Current mode: ${mode}. Click to change.`}
        title={`Mode: ${mode}`}
      >
        {getModeIcon()}
      </button>

      {/* User Avatar Placeholder */}
      <button className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
        <span className="text-xs font-medium">U</span>
      </button>
    </header>
  );
}
