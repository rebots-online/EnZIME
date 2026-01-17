import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle, XCircle, Clock, Trash2, FolderOpen } from 'lucide-react';
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

export default function HistoryTab() {
  const { downloadHistory, setDownloadHistory } = useStore();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await invoke<DownloadTask[]>('get_download_history');
        setDownloadHistory(history);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      }
    };
    fetchHistory();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="text-green-400" size={20} />;
      case 'failed': return <XCircle className="text-red-400" size={20} />;
      case 'cancelled': return <XCircle className="text-gray-400" size={20} />;
      default: return <Clock className="text-yellow-400" size={20} />;
    }
  };

  const openFolder = async (path: string) => {
    try {
      await invoke('plugin:shell|open', { path: path.replace(/[^/\\]+$/, '') });
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Download History</h2>
        <span className="text-gray-400">{downloadHistory.length} items</span>
      </div>

      {downloadHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-800 rounded-lg">
          <Clock size={48} className="text-gray-600 mb-4" />
          <p className="text-gray-400">No download history</p>
          <p className="text-gray-500 text-sm mt-2">Completed downloads will appear here</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Size</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Completed</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {downloadHistory.map((task) => (
                <tr key={task.id} className="border-t border-gray-700 hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      <span className="text-gray-300 capitalize">{task.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{task.zim.name}</div>
                    <div className="text-sm text-gray-400 truncate max-w-md">{task.target_path}</div>
                  </td>
                  <td className="px-4 py-3 text-green-400 font-mono text-sm">
                    {formatSize(task.total)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatDate(task.completed_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {task.status === 'completed' && (
                        <button
                          onClick={() => openFolder(task.target_path)}
                          className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition-colors"
                          title="Open folder"
                        >
                          <FolderOpen size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
