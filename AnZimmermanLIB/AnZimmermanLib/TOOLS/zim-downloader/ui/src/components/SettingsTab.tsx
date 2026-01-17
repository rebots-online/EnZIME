import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Folder, Save, RotateCcw, Moon, Sun, Monitor } from 'lucide-react';
import { useStore, Config } from '../store';

export default function SettingsTab() {
  const { config, setConfig } = useStore();
  const [localConfig, setLocalConfig] = useState<Config | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setLocalConfig({ ...config });
    }
  }, [config]);

  const handleBrowseDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Download Directory',
      });
      if (selected && localConfig) {
        setLocalConfig({ ...localConfig, download_dir: selected as string });
      }
    } catch (error) {
      console.error('Failed to open directory picker:', error);
    }
  };

  const handleSave = async () => {
    if (!localConfig) return;
    try {
      await invoke('set_config', { config: localConfig });
      setConfig(localConfig);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const handleReset = () => {
    if (config) {
      setLocalConfig({ ...config });
    }
  };

  if (!localConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-white mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Download Directory */}
        <div className="bg-gray-800 rounded-lg p-4">
          <label className="block text-gray-400 text-sm mb-2">Download Directory</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={localConfig.download_dir}
              onChange={(e) => setLocalConfig({ ...localConfig, download_dir: e.target.value })}
              className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-orange-500 focus:outline-none"
            />
            <button
              onClick={handleBrowseDir}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <Folder size={18} />
            </button>
          </div>
        </div>

        {/* Downloads */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-medium mb-4">Downloads</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-gray-300">Max Concurrent Downloads</label>
                <p className="text-gray-500 text-sm">Number of downloads to run simultaneously</p>
              </div>
              <input
                type="number"
                min="1"
                max="10"
                value={localConfig.max_concurrent_downloads}
                onChange={(e) => setLocalConfig({ 
                  ...localConfig, 
                  max_concurrent_downloads: parseInt(e.target.value) || 1 
                })}
                className="w-20 bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-orange-500 focus:outline-none text-center"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-gray-300">Speed Limit (bytes/sec)</label>
                <p className="text-gray-500 text-sm">0 = unlimited</p>
              </div>
              <input
                type="number"
                min="0"
                value={localConfig.speed_limit}
                onChange={(e) => setLocalConfig({ 
                  ...localConfig, 
                  speed_limit: parseInt(e.target.value) || 0 
                })}
                className="w-32 bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-orange-500 focus:outline-none text-center"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-gray-300">Enable Resume</label>
                <p className="text-gray-500 text-sm">Resume interrupted downloads</p>
              </div>
              <button
                onClick={() => setLocalConfig({ ...localConfig, enable_resume: !localConfig.enable_resume })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  localConfig.enable_resume ? 'bg-orange-500' : 'bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  localConfig.enable_resume ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-gray-300">Verify Checksums</label>
                <p className="text-gray-500 text-sm">Verify file integrity after download</p>
              </div>
              <button
                onClick={() => setLocalConfig({ ...localConfig, verify_checksums: !localConfig.verify_checksums })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  localConfig.verify_checksums ? 'bg-orange-500' : 'bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  localConfig.verify_checksums ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-medium mb-4">Appearance</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setLocalConfig({ ...localConfig, theme: 'dark' })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                localConfig.theme === 'dark' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400'
              }`}
            >
              <Moon size={18} />
              Dark
            </button>
            <button
              onClick={() => setLocalConfig({ ...localConfig, theme: 'light' })}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                localConfig.theme === 'light' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400'
              }`}
            >
              <Sun size={18} />
              Light
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RotateCcw size={18} />
            Reset
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              saved ? 'bg-green-600' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            <Save size={18} />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Version Info */}
      <div className="mt-8 pt-4 border-t border-gray-700 text-center text-gray-500 text-sm">
        <p>ZIM Downloader v0.1.0</p>
        <p className="mt-1">Copyright © 2025 Robin L. M. Cheung, MBA. All rights reserved.</p>
      </div>
    </div>
  );
}
