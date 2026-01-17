// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useState, useRef, useEffect } from 'react';
import { 
  FolderOpen, 
  Download, 
  Settings, 
  LogOut,
  Undo,
  Redo,
  Copy,
  Scissors,
  ClipboardPaste,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sidebar,
  HelpCircle,
  Book,
  Info,
  ExternalLink
} from 'lucide-react';

interface MenuItemProps {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
}

interface MenuProps {
  label: string;
  items: MenuItemProps[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function MenuItem({ label, icon, shortcut, onClick, disabled, divider }: MenuItemProps) {
  if (divider) {
    return <div className="border-t border-[var(--border)] my-1" />;
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-1.5 text-sm text-left transition-colors ${
        disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:bg-[var(--accent)] hover:text-white'
      }`}
    >
      <span className="w-4 h-4 flex items-center justify-center">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs opacity-60">{shortcut}</span>
      )}
    </button>
  );
}

function Menu({ label, items, isOpen, onToggle, onClose }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={onToggle}
        className={`px-3 py-1 text-sm rounded transition-colors ${
          isOpen 
            ? 'bg-[var(--accent)] text-white' 
            : 'hover:bg-black/5 dark:hover:bg-white/5'
        }`}
      >
        {label}
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 surface rounded-lg shadow-xl border border-[var(--border)] py-1 min-w-[200px] z-50">
          {items.map((item, index) => (
            <MenuItem key={index} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}

interface MenuBarProps {
  onOpenFile?: () => void;
  onShowAbout?: () => void;
  onToggleSidebar?: () => void;
}

export function MenuBar({ onOpenFile, onShowAbout, onToggleSidebar }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleMenu = (menu: string) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const closeMenu = () => {
    setOpenMenu(null);
  };

  const fileItems: MenuItemProps[] = [
    { label: 'Open ZIM Archive...', icon: <FolderOpen className="w-4 h-4" />, shortcut: '⌘O', onClick: () => { onOpenFile?.(); closeMenu(); } },
    { label: 'Download Archives...', icon: <Download className="w-4 h-4" />, shortcut: '⌘D' },
    { divider: true, label: '' },
    { label: 'Settings', icon: <Settings className="w-4 h-4" />, shortcut: '⌘,' },
    { divider: true, label: '' },
    { label: 'About EnZIM', icon: <Info className="w-4 h-4" />, onClick: () => { onShowAbout?.(); closeMenu(); } },
    { divider: true, label: '' },
    { label: 'Exit', icon: <LogOut className="w-4 h-4" />, shortcut: '⌘Q' },
  ];

  const editItems: MenuItemProps[] = [
    { label: 'Undo', icon: <Undo className="w-4 h-4" />, shortcut: '⌘Z', disabled: true },
    { label: 'Redo', icon: <Redo className="w-4 h-4" />, shortcut: '⇧⌘Z', disabled: true },
    { divider: true, label: '' },
    { label: 'Cut', icon: <Scissors className="w-4 h-4" />, shortcut: '⌘X' },
    { label: 'Copy', icon: <Copy className="w-4 h-4" />, shortcut: '⌘C' },
    { label: 'Paste', icon: <ClipboardPaste className="w-4 h-4" />, shortcut: '⌘V' },
    { divider: true, label: '' },
    { label: 'Find...', icon: <Search className="w-4 h-4" />, shortcut: '⌘F' },
  ];

  const viewItems: MenuItemProps[] = [
    { label: 'Toggle Sidebar', icon: <Sidebar className="w-4 h-4" />, shortcut: '⌘B', onClick: () => { onToggleSidebar?.(); closeMenu(); } },
    { divider: true, label: '' },
    { label: 'Zoom In', icon: <ZoomIn className="w-4 h-4" />, shortcut: '⌘+' },
    { label: 'Zoom Out', icon: <ZoomOut className="w-4 h-4" />, shortcut: '⌘-' },
    { label: 'Actual Size', shortcut: '⌘0' },
    { divider: true, label: '' },
    { label: 'Full Screen', icon: <Maximize className="w-4 h-4" />, shortcut: '⌃⌘F' },
  ];

  const helpItems: MenuItemProps[] = [
    { label: 'Documentation', icon: <Book className="w-4 h-4" /> },
    { label: 'Getting Started', icon: <HelpCircle className="w-4 h-4" /> },
    { divider: true, label: '' },
    { label: 'Report Issue', icon: <ExternalLink className="w-4 h-4" /> },
    { label: 'GitHub Repository', icon: <ExternalLink className="w-4 h-4" /> },
    { divider: true, label: '' },
    { label: 'About EnZIM', icon: <Info className="w-4 h-4" />, onClick: () => { onShowAbout?.(); closeMenu(); } },
  ];

  return (
    <div className="flex items-center gap-1 px-2">
      <Menu 
        label="File" 
        items={fileItems} 
        isOpen={openMenu === 'file'} 
        onToggle={() => toggleMenu('file')}
        onClose={closeMenu}
      />
      <Menu 
        label="Edit" 
        items={editItems} 
        isOpen={openMenu === 'edit'} 
        onToggle={() => toggleMenu('edit')}
        onClose={closeMenu}
      />
      <Menu 
        label="View" 
        items={viewItems} 
        isOpen={openMenu === 'view'} 
        onToggle={() => toggleMenu('view')}
        onClose={closeMenu}
      />
      <Menu 
        label="Help" 
        items={helpItems} 
        isOpen={openMenu === 'help'} 
        onToggle={() => toggleMenu('help')}
        onClose={closeMenu}
      />
    </div>
  );
}
