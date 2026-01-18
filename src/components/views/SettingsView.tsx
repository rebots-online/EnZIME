// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { Settings, Palette, Monitor, Moon, Sun, Globe, Volume2, Database } from 'lucide-react';
import { useTheme, themes, ThemeMode } from '../../contexts/ThemeContext';

export function SettingsView() {
  const { theme, setTheme, mode, setMode } = useTheme();

  const modeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <Settings className="w-5 h-5 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Appearance Section */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-medium mb-4">
              <Palette className="w-5 h-5" />
              Appearance
            </h2>

            {/* Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Color Mode</label>
              <div className="flex gap-2">
                {modeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setMode(option.value)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-colors ${
                      mode === option.value
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <option.icon className="w-4 h-4" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Theme</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {themes.map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`py-3 px-4 rounded-lg border text-sm font-medium capitalize transition-colors ${
                      theme === t
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Language Section */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-medium mb-4">
              <Globe className="w-5 h-5" />
              Language
            </h2>
            <select className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="zh">中文</option>
            </select>
          </section>

          {/* Audio Section */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-medium mb-4">
              <Volume2 className="w-5 h-5" />
              Text-to-Speech
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Voice</label>
                <select className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
                  <option>Default System Voice</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Speed</label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2" 
                  step="0.1" 
                  defaultValue="1"
                  className="w-full"
                />
              </div>
            </div>
          </section>

          {/* Storage Section */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-medium mb-4">
              <Database className="w-5 h-5" />
              Storage
            </h2>
            <div className="surface rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Archives Storage</span>
                <span className="text-sm font-medium">0 GB used</span>
              </div>
              <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: '0%' }} />
              </div>
              <p className="text-xs text-secondary mt-2">
                Archives are stored locally on your device
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
