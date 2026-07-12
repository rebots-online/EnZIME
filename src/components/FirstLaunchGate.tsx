import React, { useEffect, useState } from 'react';
import { useVariantStore } from '../stores/variant';
import { VariantOverridePanel } from './VariantOverridePanel';
import { ModelDownloadProgress } from './ModelDownloadProgress';
import { MediaImportFlow } from './MediaImportFlow';
import { aiLoadModel } from '../bridge';
import { Variant } from '../bridge';

interface FirstLaunchGateProps {
  children: React.ReactNode;
}

export function FirstLaunchGate({ children }: FirstLaunchGateProps) {
  const {
    deviceCapability,
    currentVariant,
    isModelPresent,
    isFetching,
    downloadProgress,
    probeDevice,
    fetchCurrentVariant,
    checkModelPresent,
    fetchModel,
    importFromMedia,
  } = useVariantStore();

  const [onboardingState, setOnboardingState] = useState<
    'probing' | 'selecting-variant' | 'downloading' | 'importing' | 'loading-model' | 'ready'
  >('probing');
  const [error, setError] = useState<string | null>(null);
  const [showMediaImport, setShowMediaImport] = useState(false);

  // Phase 1: Device probe and variant detection on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        setOnboardingState('probing');
        setError(null);

        // Probe device capabilities
        if (!deviceCapability) {
          await probeDevice();
        }

        // Fetch current variant
        await fetchCurrentVariant();

        // Check if model is present
        if (currentVariant) {
          const present = await checkModelPresent(currentVariant);
          if (present) {
            setOnboardingState('loading-model');
            await aiLoadModel('');
            setOnboardingState('ready');
          } else {
            setOnboardingState('selecting-variant');
          }
        } else {
          setOnboardingState('selecting-variant');
        }
      } catch (err: any) {
        setError(err?.toString() || 'Failed to initialize device probe');
        setOnboardingState('selecting-variant');
      }
    };

    initialize();
  }, [deviceCapability, currentVariant]);

  // Handle download action
  const handleDownload = async (variant: Variant) => {
    try {
      setOnboardingState('downloading');
      setError(null);
      setShowMediaImport(false);

      const path = await fetchModel(variant);

      // Once download is complete, load the model
      setOnboardingState('loading-model');
      await aiLoadModel(path);
      setOnboardingState('ready');
    } catch (err: any) {
      setError(err?.toString() || 'Download failed. Try installing from media.');
      setOnboardingState('selecting-variant');
    }
  };

  // Handle media import action
  const handleMediaImport = async (variant: Variant) => {
    try {
      setOnboardingState('importing');
      setError(null);
      setShowMediaImport(true);

      const path = await importFromMedia(variant);

      // Once import is complete, load the model
      setOnboardingState('loading-model');
      await aiLoadModel(path);
      setOnboardingState('ready');
    } catch (err: any) {
      setError(err?.toString() || 'Media import failed. Try downloading instead.');
      setOnboardingState('selecting-variant');
    }
  };

  // Render ready state - show children
  if (onboardingState === 'ready') {
    return <>{children}</>;
  }

  // Render loading model state
  if (onboardingState === 'loading-model') {
    return (
      <div className="first-launch-gate">
        <div className="gate-content">
          <h2>Loading AI Model</h2>
          <p>Initializing on-device intelligence...</p>
        </div>
      </div>
    );
  }

  // Render probing state
  if (onboardingState === 'probing') {
    return (
      <div className="first-launch-gate">
        <div className="gate-content">
          <h2>Checking Device</h2>
          <p>Detecting hardware capabilities...</p>
        </div>
      </div>
    );
  }

  // Render downloading state with progress
  if (onboardingState === 'downloading' && currentVariant) {
    return (
      <div className="first-launch-gate">
        <div className="gate-content">
          <h2>Downloading AI Model</h2>
          <ModelDownloadProgress variant={currentVariant} />
        </div>
      </div>
    );
  }

  // Render media import state
  if (onboardingState === 'importing' && currentVariant) {
    return (
      <div className="first-launch-gate">
        <div className="gate-content">
          <MediaImportFlow variant={currentVariant} />
        </div>
      </div>
    );
  }

  // Render variant selection state (default onboarding flow)
  return (
    <div className="first-launch-gate">
      <div className="gate-content">
        <h2>Set Up Your On-Device AI</h2>
        <p>EnZIME works entirely offline. Choose your AI model to begin.</p>

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        <VariantOverridePanel />

        {currentVariant && (
          <div className="onboarding-actions">
            <button
              onClick={() => handleDownload(currentVariant)}
              disabled={isFetching}
              className="download-btn"
            >
              <span className="material-symbols-outlined">download</span>
              Download Model
            </button>

            <button
              onClick={() => handleMediaImport(currentVariant)}
              disabled={isFetching}
              className="import-btn"
            >
              <span className="material-symbols-outlined">usb</span>
              Install from Media
            </button>

            <p className="offline-note">
              "Install from media" (SD / USB / disc) — fully offline.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .first-launch-gate {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
          background: var(--background, #051424);
        }

        .gate-content {
          width: 100%;
          max-width: 720px;
        }

        .gate-content h2 {
          font-size: 32px;
          font-weight: 600;
          color: var(--on-surface, #d4e4fa);
          margin-bottom: 16px;
          font-family: 'Space Grotesk', sans-serif;
        }

        .gate-content p {
          font-size: 16px;
          color: var(--on-surface-variant, #bbcac6);
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .error-message {
          padding: 12px 16px;
          background: var(--error-container, #93000a);
          color: var(--on-error-container, #ffdad6);
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .onboarding-actions {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .download-btn,
        .import-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 24px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .download-btn {
          background: var(--primary, #4fdbc8);
          color: var(--on-primary, #003731);
          border: none;
        }

        .download-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: scale(0.98);
        }

        .download-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .import-btn {
          background: transparent;
          color: var(--on-surface, #d4e4fa);
          border: 1px solid var(--outline, #859490);
        }

        .import-btn:hover:not(:disabled) {
          background: var(--surface-variant, #273647);
          transform: scale(0.98);
        }

        .import-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .offline-note {
          text-align: center;
          font-size: 12px;
          color: var(--outline, #859490);
          font-style: italic;
          margin-top: 8px;
        }

        .material-symbols-outlined {
          font-size: 20px;
        }
      `}</style>
    </div>
  );
}
