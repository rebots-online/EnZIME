import { useVariantStore } from '../stores/variant';
import { DownloadProgress, Variant } from '../bridge';
import { useMemo } from 'react';

// I-10(b): Pause/Cancel swap when store exposes cancel method
// TODO: Add cancel to VariantStore interface and invoke here

export function ModelDownloadProgress({ variant }: { variant: Variant }) {
  const { downloadProgress, isFetching, fetchModel } = useVariantStore();

  const progress = useMemo(() => downloadProgress.get(variant), [downloadProgress, variant]);

  const percent = progress?.total_bytes && progress.total_bytes > 0
    ? Math.round((progress.bytes_downloaded / progress.total_bytes) * 100)
    : 0;

  const phase = progress?.phase || 'connecting';

  const handlePause = () => {
    // I-10(b): Implement pause when store exposes pause/cancel
    console.log('Pause download for variant:', variant);
  };

  const handleCancel = () => {
    // I-10(b): Implement cancel when store exposes cancel method
    console.log('Cancel download for variant:', variant);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="model-download-progress" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>{variant}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isFetching && phase !== 'complete' && (
            <>
              <button
                onClick={handlePause}
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  border: '1px solid #859490',
                  borderRadius: '4px',
                  background: 'transparent',
                  color: '#d4e4fa',
                  cursor: 'pointer',
                }}
              >
                Pause
              </button>
              <button
                onClick={handleCancel}
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  border: '1px solid #859490',
                  borderRadius: '4px',
                  background: 'transparent',
                  color: '#d4e4fa',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4px teal track */}
      <div
        style={{
          width: '100%',
          height: '4px',
          backgroundColor: '#273647',
          borderRadius: '2px',
          overflow: 'hidden',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            backgroundColor: '#4fdbc8',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#bbcac6' }}>
        <span>{phase.charAt(0).toUpperCase() + phase.slice(1)}</span>
        {progress && (
          <span>
            {formatBytes(progress.bytes_downloaded)} / {formatBytes(progress.total_bytes)} ({percent}%)
          </span>
        )}
      </div>
    </div>
  );
}
