// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { Library, BookOpen, History, Bookmark, Settings, FolderOpen } from 'lucide-react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active 
          ? 'bg-[var(--accent)] text-white' 
          : 'hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Sidebar() {
  return (
    <aside className="surface w-64 border-r flex flex-col">
      {/* Navigation */}
      <nav className="p-3 space-y-1">
        <NavItem icon={<Library className="w-5 h-5" />} label="Library" active />
        <NavItem icon={<BookOpen className="w-5 h-5" />} label="Reader" />
        <NavItem icon={<History className="w-5 h-5" />} label="History" />
        <NavItem icon={<Bookmark className="w-5 h-5" />} label="Bookmarks" />
      </nav>

      {/* Divider */}
      <div className="border-t border-[var(--border)] mx-3 my-2"></div>

      {/* Archives Section */}
      <div className="flex-1 overflow-auto p-3">
        <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
          Archives
        </h3>
        <div className="space-y-1">
          <div className="p-3 surface rounded-lg border border-dashed border-[var(--border)] text-center">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 text-secondary" />
            <p className="text-sm text-secondary">Drop ZIM files here</p>
            <p className="text-xs text-secondary mt-1">or click to browse</p>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="p-3 border-t border-[var(--border)]">
        <NavItem icon={<Settings className="w-5 h-5" />} label="Settings" />
      </div>
    </aside>
  );
}
