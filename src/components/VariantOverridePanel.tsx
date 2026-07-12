import React from 'react';
import { useVariantStore, VariantOverride } from '../stores/variant';

export function VariantOverridePanel() {
	const { userOverride, setOverride, deviceCapability, currentVariant, isProbing, probeDevice } = useVariantStore();

	// Trigger device probe on mount if not already probed
	React.useEffect(() => {
		if (!deviceCapability && !isProbing) {
			probeDevice();
		}
	}, [deviceCapability, isProbing, probeDevice]);

	const handleOverrideChange = async (override: VariantOverride) => {
		await setOverride(override);
	};

	// Format RAM bytes to human-readable
	const formatRAM = (bytes: number): string => {
		const gb = bytes / (1024 * 1024 * 1024);
		return `${gb.toFixed(1)} GB`;
	};

	// Format storage bytes to human-readable
	const formatStorage = (bytes: number): string => {
		const gb = bytes / (1024 * 1024 * 1024);
		return `${gb.toFixed(1)} GB`;
	};

	return (
		<div className="variant-override-panel">
			<h3>AI Model Selection</h3>

			{/* Device capability summary row */}
			{deviceCapability && (
				<div className="capability-summary">
					<span className="capability-label">Device:</span>
					<span className="capability-value">
						{formatRAM(deviceCapability.ram_total_bytes)} RAM • {formatStorage(deviceCapability.storage_free_bytes)} free
					</span>
				</div>
			)}

			{/* Current active variant */}
			{currentVariant && (
				<div className="current-variant-info">
					<span className="current-variant-label">Active:</span>
					<span className="current-variant-value">{currentVariant}</span>
				</div>
			)}

			{/* Variant selection cards */}
			<div className="variant-cards">
				<div
					className={`variant-card ${userOverride === VariantOverride.Auto ? 'selected' : ''}`}
					onClick={() => handleOverrideChange(VariantOverride.Auto)}
					role="radio"
					aria-checked={userOverride === VariantOverride.Auto}
					tabIndex={0}
				>
					<div className="variant-card-content">
						<div className="variant-card-title">Auto</div>
						<div className="variant-card-description">Automatically choose based on device capability</div>
					</div>
				</div>

				<div
					className={`variant-card ${userOverride === VariantOverride.ForceQwen3 ? 'selected' : ''}`}
					onClick={() => handleOverrideChange(VariantOverride.ForceQwen3)}
					role="radio"
					aria-checked={userOverride === VariantOverride.ForceQwen3}
					tabIndex={0}
				>
					<div className="variant-card-content">
						<div className="variant-card-title">Qwen3 (Full)</div>
						<div className="variant-card-description">High-quality model • Requires more resources</div>
					</div>
				</div>

				<div
					className={`variant-card ${userOverride === VariantOverride.ForceGemmaE2bQ4 ? 'selected' : ''}`}
					onClick={() => handleOverrideChange(VariantOverride.ForceGemmaE2bQ4)}
					role="radio"
					aria-checked={userOverride === VariantOverride.ForceGemmaE2bQ4}
					tabIndex={0}
				>
					<div className="variant-card-content">
						<div className="variant-card-title">GemmaE2bQ4 (Lite)</div>
						<div className="variant-card-description">Efficient model • Runs on more devices</div>
					</div>
				</div>
			</div>

			<style jsx>{`
				.variant-override-panel {
					display: flex;
					flex-direction: column;
					gap: var(--spacing-base, 8px);
				}

				.variant-override-panel h3 {
					margin: 0;
					font-size: 18px;
					font-weight: 600;
					color: var(--onSurface);
				}

				.capability-summary {
					display: flex;
					gap: 8px;
					padding: 8px 12px;
					background: var(--surfaceContainerLow, #0d1c2d);
					border-radius: var(--radius-sm, 4px);
					font-size: 14px;
				}

				.capability-label {
					color: var(--onSurfaceVariant, #bbcac6);
					font-weight: 500;
				}

				.capability-value {
					color: var(--onSurface, #d4e4fa);
				}

				.current-variant-info {
					display: flex;
					gap: 8px;
					padding: 8px 12px;
					background: var(--surfaceContainerLow, #0d1c2d);
					border-radius: var(--radius-sm, 4px);
					font-size: 14px;
				}

				.current-variant-label {
					color: var(--onSurfaceVariant, #bbcac6);
					font-weight: 500;
				}

				.current-variant-value {
					color: var(--primary, #4fdbc8);
					font-weight: 600;
				}

				.variant-cards {
					display: flex;
					flex-direction: column;
					gap: var(--spacing-base, 8px);
				}

				.variant-card {
					border: 2px solid var(--outline, #859490);
					border-radius: var(--radius-md, 8px);
					padding: 16px;
					cursor: pointer;
					transition: all 0.2s ease;
					background: var(--surfaceContainer, #122131);
				}

				.variant-card:hover {
					border-color: var(--primary, #4fdbc8);
					background: var(--surfaceContainerHigh, #1c2b3c);
				}

				.variant-card.selected {
					border-color: var(--primary, #4fdbc8);
					background: var(--primaryContainer, #14b8a6);
					color: var(--onPrimaryContainer, #00423b);
				}

				.variant-card.selected .variant-card-title,
				.variant-card.selected .variant-card-description {
					color: var(--onPrimaryContainer, #00423b);
				}

				.variant-card-content {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}

				.variant-card-title {
					font-size: 16px;
					font-weight: 600;
					color: var(--onSurface, #d4e4fa);
				}

				.variant-card-description {
					font-size: 13px;
					color: var(--onSurfaceVariant, #bbcac6);
				}
			`}</style>
		</div>
	);
}
