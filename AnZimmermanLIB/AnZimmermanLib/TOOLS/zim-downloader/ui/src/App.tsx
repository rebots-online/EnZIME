// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Download, 
  Library, 
  History, 
  Settings, 
  Mic, 
  Pencil, 
  StickyNote,
  Moon,
  Sun,
  Palette
} from 'lucide-react';
import { useStore, Repository } from './store';
import BrowseTab from './components/BrowseTab';
import DownloadsTab from './components/DownloadsTab';
import HistoryTab from './components/HistoryTab';
import SettingsTab from './components/SettingsTab';
import AnnotationPanel from './components/AnnotationPanel';
import StatusBar from './components/StatusBar';
import { 
  ThemeName, 
  ThemeMode, 
  getTheme, 
  nextTheme, 
  nextMode, 
  loadThemePrefs, 
  saveThemePrefs,
  themeInfo,
  THEME_NAMES
} from './lib/themes';

type Tab = 'browse' | 'downloads' | 'history' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [themeName, setThemeName] = useState<ThemeName>('kinetic');
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const { setRepositories, setConfig } = useStore();

  // Load theme preferences on mount
  useEffect(() => {
    const prefs = loadThemePrefs();
    setThemeName(prefs.theme);
    setThemeMode(prefs.mode);
  }, []);

  // Get current theme colors
  const theme = getTheme(themeName, themeMode);

  useEffect(() => {
    // Initialize app data
    const init = async () => {
      try {
        const repos = await invoke<Repository[]>('get_repositories');
        setRepositories(repos);
        
        const config = await invoke('get_config');
        setConfig(config);
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };
    init();
  }, []);

  // Handle theme change
  const handleThemeChange = (newTheme: ThemeName) => {
    setThemeName(newTheme);
    saveThemePrefs(newTheme, themeMode);
    setShowThemePicker(false);
  };

  // Handle mode change
  const handleModeChange = () => {
    const newMode = nextMode(themeMode);
    setThemeMode(newMode);
    saveThemePrefs(themeName, newMode);
  };

  const tabs = [
    { id: 'browse' as Tab, label: 'Browse', icon: Library },
    { id: 'downloads' as Tab, label: 'Downloads', icon: Download },
    { id: 'history' as Tab, label: 'History', icon: History },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  // Determine if dark mode based on theme mode
  const isDark = themeMode === 'dark' || 
    (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div 
      className="flex flex-col h-screen"
      style={{ 
        backgroundColor: theme.bg, 
        color: theme.fg 
      }}
    >
      {/* Header */}
      <header 
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ 
          backgroundColor: theme.bgSecondary, 
          borderColor: theme.border 
        }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold" style={{ color: theme.accent }}>📚 ZIM Downloader</h1>
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: activeTab === tab.id ? theme.accent : 'transparent',
                  color: activeTab === tab.id ? theme.selectionFg : theme.fgSecondary
                }}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Annotation Tools */}
          <div 
            className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ backgroundColor: theme.bgTertiary }}
          >
            <button
              onClick={() => setShowAnnotations(!showAnnotations)}
              className="p-2 rounded transition-colors"
              style={{
                backgroundColor: showAnnotations ? theme.accent : 'transparent',
                color: showAnnotations ? theme.selectionFg : theme.fgSecondary
              }}
              title="Toggle Annotations"
            >
              <StickyNote size={18} />
            </button>
            <button 
              className="p-2 rounded transition-colors" 
              style={{ color: theme.fgSecondary }}
              title="Voice Note"
            >
              <Mic size={18} />
            </button>
            <button 
              className="p-2 rounded transition-colors" 
              style={{ color: theme.fgSecondary }}
              title="Ink Annotation"
            >
              <Pencil size={18} />
            </button>
          </div>

          {/* Theme Picker */}
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: theme.fgSecondary }}
              title={`Theme: ${themeInfo[themeName].name}`}
            >
              <Palette size={18} />
            </button>
            {showThemePicker && (
              <div 
                className="absolute right-0 top-full mt-2 p-2 rounded-lg shadow-lg z-50 min-w-48"
                style={{ backgroundColor: theme.bgTertiary, border: `1px solid ${theme.border}` }}
              >
                <div className="text-sm font-medium mb-2" style={{ color: theme.fg }}>Select Theme</div>
                {THEME_NAMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    className="w-full text-left px-3 py-2 rounded transition-colors flex items-center gap-2"
                    style={{ 
                      backgroundColor: t === themeName ? theme.accent : 'transparent',
                      color: t === themeName ? theme.selectionFg : theme.fgSecondary
                    }}
                  >
                    <span>{themeInfo[t].icon}</span>
                    <span>{themeInfo[t].name}</span>
                  </button>
                ))}
                <div className="border-t my-2" style={{ borderColor: theme.border }}></div>
                <button
                  onClick={handleModeChange}
                  className="w-full text-left px-3 py-2 rounded transition-colors flex items-center gap-2"
                  style={{ color: theme.fgSecondary }}
                >
                  {themeMode === 'dark' ? <Moon size={16} /> : themeMode === 'light' ? <Sun size={16} /> : <span>🌓</span>}
                  <span>Mode: {themeMode}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto p-4">
          {activeTab === 'browse' && <BrowseTab />}
          {activeTab === 'downloads' && <DownloadsTab />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>

        {/* Annotation Panel */}
        {showAnnotations && (
          <AnnotationPanel onClose={() => setShowAnnotations(false)} />
        )}
      </div>

      {/* Status Bar */}
      <StatusBar theme={theme} />
    </div>
  );
}

export default App;
