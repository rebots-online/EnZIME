import { useState } from 'react';
import { modelImportFromMedia, Variant, DownloadProgress } from '../bridge';
import './MediaImportFlow.css';

/**
 * MediaImportFlow — INV-OFFLINE first-class offline import
 *
 * Surfaced when model_fetch fails, this component prompts the user to insert
 * SD/USB storage or point at a mount, then drives bridge.modelImportFromMedia
 * with scan→read→verify phase progress. Integrates Stitch 02-first-launch design.
 */
export function MediaImportFlow({ variant }: { variant: Variant }) {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successPath, setSuccessPath] = useState<string | null>(null);

  const startImport = async () => {
    setIsImporting(true);
    setError(null);
    setSuccessPath(null);
    setProgress(null);

    try {
      const path = await modelImportFromMedia(variant, (p) => {
        setProgress(p);
      });
      setSuccessPath(path);
    } catch (err: any) {
      setError(err?.toString() || 'Unknown error occurred during import');
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setError(null);
    setSuccessPath(null);
    setProgress(null);
  };

  return (
    <div className="media-import-flow">
      <div className="media-import-card">
        <h2 className="media-import-title">Install from Media</h2>
        <p className="media-import-subtitle">
          INV-OFFLINE: Insert SD card, USB drive, or mounted storage containing the{' '}
          <code className="variant-code">{variant}</code> model weights.
        </p>

        {!isImporting && !successPath && !error && (
          <button onClick={startImport} className="import-action-btn">
            <span className="material-symbols-outlined">usb</span>
            Scan & Import from Media
          </button>
        )}

        {isImporting && (
          <div className="import-progress-area">
            <div className="progress-spinner-container">
              <div className="spinner"></div>
            </div>
            <div className="progress-status-title">
              {progress?.phase === 'connecting' && 'Scanning external media...'}
              {progress?.phase === 'downloading' && 'Reading files...'}
              {progress?.phase === 'verifying' && 'Verifying SHA-256 integrity...'}
              {progress?.phase === 'complete' && 'Finalizing installation...'}
              {!progress?.phase && 'Initiating offline scanner...'}
            </div>
            {progress && progress.total_bytes > 0 && (
              <div className="progress-bar-wrapper">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(100, (progress.bytes_downloaded / progress.total_bytes) * 100)}%`,
                  }}
                ></div>
                <div className="progress-bytes-label">
                  {(progress.bytes_downloaded / 1024 / 1024).toFixed(1)} MB / {(progress.total_bytes / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
            )}
          </div>
        )}

        {successPath && (
          <div className="import-result success">
            <div className="result-icon">✓</div>
            <h3 className="result-title">Weights Imported Successfully!</h3>
            <p className="result-desc">Installed to path: <code className="result-code">{successPath}</code></p>
            <button onClick={reset} className="result-reset-btn">Import Another</button>
          </div>
        )}

        {error && (
          <div className="import-result failure">
            <div className="result-icon">✗</div>
            <h3 className="result-title">Import Failed</h3>
            <p className="result-desc">{error}</p>
            <button onClick={reset} className="result-reset-btn">Retry Scan</button>
          </div>
        )}
      </div>
    </div>
  );
}
