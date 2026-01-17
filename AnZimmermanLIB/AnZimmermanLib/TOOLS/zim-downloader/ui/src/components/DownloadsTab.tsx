import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play, Pause, X, Download, RefreshCw } from 'lucide-react';
import { useStore, DownloadTask } from '../store';

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

function formatSpeed(bytesPerSec: number): string {
  return `${formatSize(bytesPerSec)}/s`;
}

function formatEta(seconds: number | null): string {
  if (!seconds) return '--:--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default function DownloadsTab() {
  const { activeDownloads, setActiveDownloads } = useStore();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const downloads = await invoke<DownloadTask[]>('get_download_progress');
        setActiveDownloads(downloads);
      } catch (error) {
        console.error('Failed to get download progress:', error);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handlePause = async (taskId: string) => {
    try {
      await invoke('pause_download', { taskId });
    } catch (error) {
      console.error('Failed to pause download:', error);
    }
  };

  const handleResume = async (taskId: string) => {
    try {
      await invoke('resume_download', { taskId });
    } catch (error) {
      console.error('Failed to resume download:', error);
    }
  };

  const handleCancel = async (taskId: string) => {
    try {
      await invoke('cancel_download', { taskId });
    } catch (error) {
      console.error('Failed to cancel download:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'downloading': return 'text-green-400';
      case 'paused': return 'text-yellow-400';
      case 'completed': return 'text-blue-400';
      case 'failed': return 'text-red-400';
      case 'cancelled': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'downloading': return <RefreshCw className="animate-spin" size={16} />;
      case 'paused': return <Pause size={16} />;
      case 'completed': return <Download size={16} />;
      default: return null;
    }
  };

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Active Downloads</h2>
        <span className="text-gray-400">{activeDownloads.length} active</span>
      </div>

      {activeDownloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-800 rounded-lg">
          <Download size={48} className="text-gray-600 mb-4" />
          <p className="text-gray-400">No active downloads</p>
          <p className="text-gray-500 text-sm mt-2">Go to Browse tab and select a ZIM file to download</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeDownloads.map((task) => {
            const progress = task.total > 0 ? (task.downloaded / task.total) * 100 : 0;
            
            return (
              <div key={task.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={getStatusColor(task.status)}>
                        {getStatusIcon(task.status)}
                      </span>
                      <h3 className="font-medium text-white truncate">{task.zim.name}</h3>
                    </div>
                    <p className="text-sm text-gray-400 truncate mt-1">{task.zim.title}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {task.status === 'downloading' && (
                      <button
                        onClick={() => handlePause(task.id)}
                        className="p-2 bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 rounded-lg transition-colors"
                        title="Pause"
                      >
                        <Pause size={16} />
                      </button>
                    )}
                    {task.status === 'paused' && (
                      <button
                        onClick={() => handleResume(task.id)}
                        className="p-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors"
                        title="Resume"
                      >
                        <Play size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleCancel(task.id)}
                      className="p-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`absolute left-0 top-0 h-full transition-all duration-300 ${
                      task.status === 'downloading' ? 'bg-orange-500' :
                      task.status === 'paused' ? 'bg-yellow-500' :
                      task.status === 'completed' ? 'bg-green-500' :
                      'bg-gray-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400">
                      {formatSize(task.downloaded)} / {formatSize(task.total)}
                    </span>
                    <span className="text-orange-400 font-mono">
                      {progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {task.status === 'downloading' && (
                      <>
                        <span className="text-green-400">{formatSpeed(task.speed)}</span>
                        <span className="text-gray-400">ETA: {formatEta(task.eta)}</span>
                      </>
                    )}
                    {task.error && (
                      <span className="text-red-400">{task.error}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
