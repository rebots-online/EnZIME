// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Download, FileText, Globe, HardDrive } from 'lucide-react';
import { useStore, ZimEntry, Repository } from '../store';

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

export default function BrowseTab() {
  const { 
    repositories, 
    currentRepo, 
    setCurrentRepo, 
    zimEntries, 
    setZimEntries,
    filteredEntries,
    setFilteredEntries,
    searchQuery,
    setSearchQuery,
    selectedZim,
    setSelectedZim
  } = useStore();
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentRepo) {
      fetchZimList(currentRepo);
    }
  }, [currentRepo]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = zimEntries.filter(z => 
        z.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        z.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        z.language.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredEntries(filtered);
    } else {
      setFilteredEntries(zimEntries);
    }
  }, [searchQuery, zimEntries]);

  const fetchZimList = async (repoId: string) => {
    setLoading(true);
    try {
      const entries = await invoke<ZimEntry[]>('fetch_zim_list', { repoId });
      setZimEntries(entries);
    } catch (error) {
      console.error('Failed to fetch ZIM list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (zim: ZimEntry) => {
    try {
      await invoke('start_download', { zim });
    } catch (error) {
      console.error('Failed to start download:', error);
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* Repository Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Repositories</h2>
          <div className="space-y-2">
            {repositories.map((repo) => (
              <button
                key={repo.id}
                onClick={() => setCurrentRepo(repo.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  currentRepo === repo.id
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span className="text-xl">{repo.icon}</span>
                <div className="overflow-hidden">
                  <div className="font-medium truncate">{repo.name}</div>
                  <div className="text-xs opacity-70 truncate">{repo.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search ZIM files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* ZIM List */}
        <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <FileText size={48} className="mb-4 opacity-50" />
              <p>Select a repository to browse ZIM files</p>
            </div>
          ) : (
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-gray-900 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-20">Lang</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-24">Size</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-28">Articles</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-medium w-24">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((zim) => (
                    <tr
                      key={zim.id}
                      onClick={() => setSelectedZim(zim)}
                      className={`border-t border-gray-700 cursor-pointer transition-colors ${
                        selectedZim?.id === zim.id ? 'bg-gray-700' : 'hover:bg-gray-750'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Globe size={16} className="text-cyan-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate">{zim.name}</div>
                            <div className="text-sm text-gray-400 truncate">{zim.title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs font-medium rounded">
                          {zim.language.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-green-400 font-mono text-sm">
                        {formatSize(zim.size)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {zim.article_count?.toLocaleString() || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(zim);
                          }}
                          className="p-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected ZIM Details */}
        {selectedZim && (
          <div className="mt-4 bg-gray-800 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedZim.name}</h3>
                <p className="text-gray-400 mt-1">{selectedZim.title}</p>
              </div>
              <button
                onClick={() => handleDownload(selectedZim)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              >
                <Download size={18} />
                Download
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-gray-400 text-sm">Size</div>
                <div className="text-white font-semibold">{formatSize(selectedZim.size)}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-gray-400 text-sm">Articles</div>
                <div className="text-white font-semibold">{selectedZim.article_count?.toLocaleString() || '-'}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-gray-400 text-sm">Media Files</div>
                <div className="text-white font-semibold">{selectedZim.media_count?.toLocaleString() || '-'}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-gray-400 text-sm">Flavor</div>
                <div className="text-white font-semibold">{selectedZim.flavor || 'Standard'}</div>
              </div>
            </div>
            {selectedZim.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedZim.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
