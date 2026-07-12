import { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../stores/app';
import { useVariantStore } from '../stores/variant';
import { useSidecarStore } from '../stores/sidecar';
import { VariantOverridePanel } from './VariantOverridePanel';
import { PeerTrustManager } from './PeerTrustManager';
import { settingsGet, settingsSet, billingRestorePurchases, enzimeVersion } from '../bridge';

// Settings keys (persisted via bridge.settingsGet/settingsSet)
const SETTINGS_KEYS = {
	READING_FONT_SIZE: 'reading.fontSize',
	READING_LINE_WIDTH: 'reading.lineWidth',
	READING_FONT_FAMILY: 'reading.fontFamily',
	PRIVACY_AUTO_LOCK_TIMEOUT: 'privacy.autoLockTimeout',
	PRIVACY_REQUIRE_UNLOCK: 'privacy.requireUnlockOnLaunch',
} as const;

type LineWidth = 'narrow' | 'optimal' | 'wide';
type AutoLockTimeout = 'off' | '1min' | '5min' | '15min';

export function SettingsPane() {
	const { themeMode, setThemeMode } = useAppState();
	const { deviceCapability, currentVariant } = useVariantStore();
	const { trustEntries } = useSidecarStore();

	// Reading settings state
	const [fontSize, setFontSize] = useState(16);
	const [lineWidth, setLineWidth] = useState<LineWidth>('optimal');
	const [fontFamily, setFontFamily] = useState('Literata');

	// Privacy settings state
	const [autoLockTimeout, setAutoLockTimeout] = useState<AutoLockTimeout>('5min');
	const [requireUnlock, setRequireUnlock] = useState(true);

	// Subscription restore state
	const [restoreResult, setRestoreResult] = useState<string | null>(null);
	const [isRestoring, setIsRestoring] = useState(false);

	// About info
	const [appVersion, setAppVersion] = useState<string>('v1.0.0');

	// Active section for navigation highlighting
	const [activeSection, setActiveSection] = useState<string>('ai-model');

	// Load all settings on mount
	useEffect(() => {
		const loadSettings = async () => {
			try {
				// Reading settings
				const fontSizeVal = await settingsGet(SETTINGS_KEYS.READING_FONT_SIZE);
				if (fontSizeVal) setFontSize(parseInt(fontSizeVal, 10));

				const lineWidthVal = await settingsGet(SETTINGS_KEYS.READING_LINE_WIDTH);
				if (lineWidthVal) setLineWidth(lineWidthVal as LineWidth);

				const fontFamilyVal = await settingsGet(SETTINGS_KEYS.READING_FONT_FAMILY);
				if (fontFamilyVal) setFontFamily(fontFamilyVal);

				// Privacy settings
				const autoLockVal = await settingsGet(SETTINGS_KEYS.PRIVACY_AUTO_LOCK_TIMEOUT);
				if (autoLockVal) setAutoLockTimeout(autoLockVal as AutoLockTimeout);

				const requireUnlockVal = await settingsGet(SETTINGS_KEYS.PRIVACY_REQUIRE_UNLOCK);
				if (requireUnlockVal) setRequireUnlock(requireUnlockVal === 'true');

				// App version
				const version = await enzimeVersion();
				setAppVersion(`v${version}`);
			} catch (e) {
				console.error('Failed to load settings:', e);
			}
		};
		loadSettings();
	}, []);

	// Theme handlers
	const handleThemeChange = (mode: 'light' | 'dark') => {
		setThemeMode(mode);
	};

	// Reading settings handlers
	const handleFontSizeChange = async (newSize: number) => {
		setFontSize(newSize);
		try {
			await settingsSet(SETTINGS_KEYS.READING_FONT_SIZE, newSize.toString());
		} catch (e) {
			console.error('Failed to save font size:', e);
		}
	};

	const handleLineWidthChange = async (newWidth: LineWidth) => {
		setLineWidth(newWidth);
		try {
			await settingsSet(SETTINGS_KEYS.READING_LINE_WIDTH, newWidth);
		} catch (e) {
			console.error('Failed to save line width:', e);
		}
	};

	const handleFontFamilyChange = async (newFamily: string) => {
		setFontFamily(newFamily);
		try {
			await settingsSet(SETTINGS_KEYS.READING_FONT_FAMILY, newFamily);
		} catch (e) {
			console.error('Failed to save font family:', e);
		}
	};

	// Privacy settings handlers
	const handleAutoLockTimeoutChange = async (newTimeout: AutoLockTimeout) => {
		setAutoLockTimeout(newTimeout);
		try {
			await settingsSet(SETTINGS_KEYS.PRIVACY_AUTO_LOCK_TIMEOUT, newTimeout);
		} catch (e) {
			console.error('Failed to save auto-lock timeout:', e);
		}
	};

	const handleRequireUnlockChange = async (required: boolean) => {
		setRequireUnlock(required);
		try {
			await settingsSet(SETTINGS_KEYS.PRIVACY_REQUIRE_UNLOCK, required.toString());
		} catch (e) {
			console.error('Failed to save require unlock:', e);
		}
	};

	// Subscription restore handler
	const handleRestorePurchases = async () => {
		setIsRestoring(true);
		setRestoreResult(null);
		try {
			const result = await billingRestorePurchases();
			if (result.restored > 0) {
				setRestoreResult(`Restored ${result.restored} purchase(s)`);
			} else {
				setRestoreResult('No purchases to restore');
			}
		} catch (e) {
			setRestoreResult(`Restore failed: ${e}`);
		} finally {
			setIsRestoring(false);
		}
	};

	// Smooth scroll to section
	const scrollToSection = (sectionId: string) => {
		setActiveSection(sectionId);
		document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
	};

	// Format RAM for display
	const formatRAM = (bytes: number): string => {
		const gb = bytes / (1024 * 1024 * 1024);
		return `${gb.toFixed(1)} GB`;
	};

	return (
		<div className="settings-pane">
			<div className="settings-container">
				{/* Section Navigation (Left Pane) */}
				<aside className="settings-nav">
					<nav>
						<button
							className={`nav-item ${activeSection === 'ai-model' ? 'active' : ''}`}
							onClick={() => scrollToSection('ai-model')}
						>
							<span className="material-symbols-outlined">neurology</span>
							<span>AI Model</span>
						</button>
						<button
							className={`nav-item ${activeSection === 'reading' ? 'active' : ''}`}
							onClick={() => scrollToSection('reading')}
						>
							<span className="material-symbols-outlined">book_2</span>
							<span>Reading</span>
						</button>
						<button
							className={`nav-item ${activeSection === 'privacy' ? 'active' : ''}`}
							onClick={() => scrollToSection('privacy')}
						>
							<span className="material-symbols-outlined">lock</span>
							<span>Privacy & Security</span>
						</button>
						<button
							className={`nav-item ${activeSection === 'sharing' ? 'active' : ''}`}
							onClick={() => scrollToSection('sharing')}
						>
							<span className="material-symbols-outlined">verified_user</span>
							<span>Sharing & Trust</span>
						</button>
						<button
							className={`nav-item ${activeSection === 'storage' ? 'active' : ''}`}
							onClick={() => scrollToSection('storage')}
						>
							<span className="material-symbols-outlined">storage</span>
							<span>Storage</span>
						</button>
						<button
							className={`nav-item ${activeSection === 'subscription' ? 'active' : ''}`}
							onClick={() => scrollToSection('subscription')}
						>
							<span className="material-symbols-outlined">payments</span>
							<span>Subscription</span>
						</button>
						<button
							className={`nav-item ${activeSection === 'about' ? 'active' : ''}`}
							onClick={() => scrollToSection('about')}
						>
							<span className="material-symbols-outlined">info</span>
							<span>About</span>
						</button>
					</nav>
				</aside>

				{/* Detail Pane (Right Pane) */}
				<section className="settings-detail">
					<div className="settings-content">
						{/* AI MODEL SECTION */}
						<div id="ai-model" className="settings-section">
							<h2>AI Model</h2>
							<div className="settings-card">
								<VariantOverridePanel />
							</div>
						</div>

						{/* READING SECTION */}
						<div id="reading" className="settings-section">
							<h2>Reading</h2>
							<div className="settings-card">
								{/* Theme */}
								<div className="settings-row">
									<span className="settings-label">Appearance</span>
									<div className="theme-toggle-group">
										<button
											className={`theme-button ${themeMode === 'light' ? 'active' : ''}`}
											onClick={() => handleThemeChange('light')}
										>
											Light
										</button>
										<button
											className={`theme-button ${themeMode === 'dark' ? 'active' : ''}`}
											onClick={() => handleThemeChange('dark')}
										>
											Dark
										</button>
									</div>
								</div>

								{/* Font Size */}
								<div className="settings-row-block">
									<div className="flex-between">
										<span className="settings-label">Font size</span>
										<span className="settings-value">{fontSize}px</span>
									</div>
									<input
										type="range"
										min="12"
										max="24"
										value={fontSize}
										onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10))}
										className="settings-slider"
									/>
								</div>

								{/* Line Width */}
								<div className="settings-row-block">
									<div className="flex-between">
										<span className="settings-label">Reading line-width</span>
										<span className="settings-value">{lineWidth === 'optimal' ? 'Optimal (720px)' : `${lineWidth}`}</span>
									</div>
									<div className="line-width-buttons">
										<button
											className={`line-width-btn ${lineWidth === 'narrow' ? 'active' : ''}`}
											onClick={() => handleLineWidthChange('narrow')}
										>
											<span className="material-symbols-outlined">align_horizontal_left</span>
											<span>Narrow</span>
										</button>
										<button
											className={`line-width-btn ${lineWidth === 'optimal' ? 'active' : ''}`}
											onClick={() => handleLineWidthChange('optimal')}
										>
											<span className="material-symbols-outlined">align_horizontal_center</span>
											<span>Optimal</span>
										</button>
										<button
											className={`line-width-btn ${lineWidth === 'wide' ? 'active' : ''}`}
											onClick={() => handleLineWidthChange('wide')}
										>
											<span className="material-symbols-outlined">align_horizontal_right</span>
											<span>Wide</span>
										</button>
									</div>
								</div>

								{/* Font Family */}
								<div className="settings-row border-top">
									<span className="settings-label">Font family</span>
									<button className="font-family-button">
										<span style={{ fontFamily: fontFamily === 'Literata' ? 'Literata, serif' : 'sans-serif' }}>
											{fontFamily}
										</span>
										<span className="material-symbols-outlined">expand_more</span>
									</button>
								</div>
							</div>
						</div>

						{/* PRIVACY & SECURITY SECTION */}
						<div id="privacy" className="settings-section">
							<h2>Privacy & Security</h2>
							<div className="settings-card">
								{/* Auto-lock timeout */}
								<div className="settings-row">
									<div className="settings-info">
										<span className="settings-label">Auto-lock timeout</span>
										<p className="settings-description">Locks the vault after inactivity</p>
									</div>
									<select
										value={autoLockTimeout}
										onChange={(e) => handleAutoLockTimeoutChange(e.target.value as AutoLockTimeout)}
										className="settings-select"
									>
										<option value="off">Off</option>
										<option value="1min">1 min</option>
										<option value="5min">5 min</option>
										<option value="15min">15 min</option>
									</select>
								</div>

								{/* Require unlock on launch */}
								<div className="settings-row border-top">
									<div className="settings-info">
										<span className="settings-label">Require unlock on launch</span>
										<p className="settings-description">Biometric or password check</p>
									</div>
									<label className="toggle-switch">
										<input
											type="checkbox"
											checked={requireUnlock}
											onChange={(e) => handleRequireUnlockChange(e.target.checked)}
										/>
										<span className="toggle-slider"></span>
									</label>
								</div>

								{/* Offline badge */}
								<div className="offline-badge">
									<span className="material-symbols-outlined">verified</span>
									<span>All data stays on this device</span>
								</div>
							</div>
						</div>

						{/* SHARING & TRUST SECTION */}
						<div id="sharing" className="settings-section">
							<h2>Sharing & Trust</h2>
							<div className="settings-card">
								<PeerTrustManager />
							</div>
						</div>

						{/* STORAGE SECTION */}
						<div id="storage" className="settings-section">
							<h2>Storage</h2>
							<div className="settings-card">
								<div className="storage-summary">
									<div className="flex-between">
										<div>
											<span className="storage-total">118 GB</span>
											<p className="storage-label">Total Disk Allocated</p>
										</div>
										<span className="storage-used">8.012 GB Used</span>
									</div>
									<div className="storage-bar">
										<div className="bar-segment packs" style={{ width: '55%' }} title="Packs 6.2 GB"></div>
										<div className="bar-segment models" style={{ width: '15%' }} title="Models 1.8 GB"></div>
										<div className="bar-segment annotations" style={{ width: '2%' }} title="Annotations 12 MB"></div>
									</div>
									<div className="storage-legend">
										<div className="legend-item">
											<div className="legend-dot packs"></div>
											<span className="legend-label">Packs 6.2GB</span>
										</div>
										<div className="legend-item">
											<div className="legend-dot models"></div>
											<span className="legend-label">Models 1.8GB</span>
										</div>
										<div className="legend-item">
											<div className="legend-dot annotations"></div>
											<span className="legend-label">Annot. 12MB</span>
										</div>
										<div className="legend-item">
											<div className="legend-dot free"></div>
											<span className="legend-label">Free 110GB</span>
										</div>
									</div>
								</div>
								<div className="settings-actions border-top">
									<button className="button-secondary">Manage packs</button>
									<button className="button-danger">Clear cache</button>
								</div>
							</div>
						</div>

						{/* SUBSCRIPTION SECTION */}
						<div id="subscription" className="settings-section">
							<h2>Subscription</h2>
							<div className="settings-card subscription-card">
								<div className="subscription-header">
									<div>
										<h3>EnZIME Free</h3>
										<p>Limited local context (2,048 tokens)</p>
									</div>
									<div className="subscription-icon">
										<span className="material-symbols-outlined">workspace_premium</span>
									</div>
								</div>
								<button className="button-primary">Upgrade to Pro</button>
								<div className="restore-section">
									{restoreResult && (
										<div className={`restore-message ${restoreResult.startsWith('Restored') ? 'success' : 'info'}`}>
											{restoreResult}
										</div>
									)}
									<button
										className="restore-button"
										onClick={handleRestorePurchases}
										disabled={isRestoring}
									>
										{isRestoring ? 'Restoring...' : 'Restore purchases'}
									</button>
								</div>
							</div>
						</div>

						{/* ABOUT SECTION */}
						<div id="about" className="settings-section">
							<h2>About</h2>
							<div className="settings-card">
								<div className="about-header">
									<div className="about-info">
										<div className="about-logo">E</div>
										<div>
											<p className="about-name">EnZIME</p>
											<p className="about-version">{appVersion} Stable</p>
										</div>
									</div>
									<span className="offline-badge-chip">
										<span className="material-symbols-outlined">wifi_off</span>
										Works fully offline
									</span>
								</div>
								<div className="about-footer border-top">
									<span>© 2024 EnZIME Labs</span>
									<a href="#" className="link-primary">Licenses</a>
								</div>
							</div>
						</div>
					</div>
				</section>
			</div>

			<style jsx>{`
				.settings-pane {
					display: flex;
					flex-direction: column;
					height: 100%;
					background: var(--background);
				}

				.settings-container {
					display: flex;
					flex: 1;
					overflow: hidden;
				}

				.settings-nav {
					width: 256px;
					border-right: 1px solid var(--outlineVariant);
					background: var(--surfaceContainerLowest);
					padding: 32px 0;
					display: flex;
					flex-direction: column;
				}

				.settings-nav nav {
					display: flex;
					flex-direction: column;
					gap: 4px;
					padding: 0 16px;
				}

				.nav-item {
					display: flex;
					align-items: center;
					gap: 12px;
					padding: 12px 16px;
					border-radius: var(--radius-md);
					color: var(--onSurfaceVariant);
					background: transparent;
					border: none;
					cursor: pointer;
					transition: all 0.2s;
					font-family: var(--font-label);
					font-size: 14px;
				}

				.nav-item:hover {
					background: var(--surfaceContainer);
				}

				.nav-item.active {
					background: var(--surfaceContainerHigh);
					color: var(--primary);
					font-weight: 600;
				}

				.settings-detail {
					flex: 1;
					overflow-y: auto;
					background: var(--surface);
					padding: 48px 40px;
				}

				.settings-detail::-webkit-scrollbar {
					width: 4px;
				}

				.settings-detail::-webkit-scrollbar-track {
					background: var(--background);
				}

				.settings-detail::-webkit-scrollbar-thumb {
					background: var(--surfaceVariant);
					border-radius: 2px;
				}

				.settings-content {
					max-width: 720px;
					margin: 0 auto;
					display: flex;
					flex-direction: column;
					gap: 64px;
					padding-bottom: 96px;
				}

				.settings-section {
					scroll-margin-top: 96px;
				}

				.settings-section h2 {
					font-size: 32px;
					font-weight: 600;
					font-family: var(--font-heading);
					color: var(--onSurface);
					margin: 0 0 24px 0;
				}

				.settings-card {
					background: var(--surfaceContainer);
					border: 1px solid var(--outlineVariant);
					border-radius: var(--radius-md);
					padding: 24px;
					display: flex;
					flex-direction: column;
					gap: 24px;
					transition: border-color 0.2s;
				}

				.settings-card:hover {
					border-color: var(--primary);
				}

				/* Settings rows */
				.settings-row {
					display: flex;
					align-items: center;
					justify-content: space-between;
				}

				.settings-row.border-top {
					padding-top: 24px;
					border-top: 1px solid var(--outlineVariant);
				}

				.settings-row-block {
					display: flex;
					flex-direction: column;
					gap: 16px;
				}

				.flex-between {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.settings-label {
					font-size: 16px;
					font-weight: 500;
					color: var(--onSurface);
				}

				.settings-value {
					font-family: var(--font-body);
					font-size: 14px;
					color: var(--onSurfaceVariant);
				}

				.settings-info {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}

				.settings-description {
					font-size: 14px;
					color: var(--onSurfaceVariant);
					margin: 0;
				}

				/* Theme toggle */
				.theme-toggle-group {
					display: flex;
					background: var(--surfaceContainerLow);
					border-radius: var(--radius-sm);
					padding: 4px;
					border: 1px solid var(--outlineVariant);
				}

				.theme-button {
					padding: 6px 16px;
					border-radius: var(--radius-sm);
					border: none;
					background: transparent;
					color: var(--onSurfaceVariant);
					font-family: var(--font-label);
					font-size: 14px;
					cursor: pointer;
					transition: all 0.2s;
				}

				.theme-button.active {
					background: var(--surfaceContainerHigh);
					color: var(--primary);
					border: 1px solid var(--outlineVariant);
				}

				/* Slider */
				.settings-slider {
					width: 100%;
					-webkit-appearance: none;
					background: var(--surfaceVariant);
					height: 4px;
					border-radius: 2px;
					outline: none;
				}

				.settings-slider::-webkit-slider-thumb {
					-webkit-appearance: none;
					width: 16px;
					height: 16px;
					background: var(--primary);
					border-radius: 50%;
					cursor: pointer;
				}

				/* Line width buttons */
				.line-width-buttons {
					display: grid;
					grid-template-columns: repeat(3, 1fr);
					gap: 12px;
				}

				.line-width-btn {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 4px;
					padding: 12px;
					border: 1px solid var(--outlineVariant);
					border-radius: var(--radius-md);
					background: transparent;
					color: var(--onSurfaceVariant);
					cursor: pointer;
					transition: all 0.2s;
				}

				.line-width-btn:hover {
					border-color: var(--primary);
				}

				.line-width-btn.active {
					border: 2px solid var(--primary);
					background: rgba(79, 219, 200, 0.05);
					color: var(--primary);
				}

				.line-width-btn .material-symbols-outlined {
					font-size: 20px;
				}

				.line-width-btn span:last-child {
					font-size: 10px;
					font-weight: 700;
					text-transform: uppercase;
					letter-spacing: 0.05em;
				}

				/* Font family button */
				.font-family-button {
					display: flex;
					align-items: center;
					gap: 8px;
					padding: 8px 16px;
					border: 1px solid var(--outlineVariant);
					border-radius: var(--radius-md);
					background: transparent;
					color: var(--onSurface);
					cursor: pointer;
					transition: all 0.2s;
				}

				.font-family-button:hover {
					background: var(--surfaceContainerHigh);
				}

				/* Settings select */
				.settings-select {
					background: var(--surfaceContainerLow);
					border: 1px solid var(--outlineVariant);
					color: var(--onSurface);
					border-radius: var(--radius-md);
					padding: 8px 16px;
					outline: none;
				}

				.settings-select:focus {
					ring: 1px solid var(--primary);
				}

				/* Toggle switch */
				.toggle-switch {
					position: relative;
					display: inline-flex;
					align-items: center;
					cursor: pointer;
				}

				.toggle-switch input {
					position: absolute;
					opacity: 0;
					width: 0;
					height: 0;
				}

				.toggle-slider {
					position: relative;
					width: 44px;
					height: 24px;
					background: var(--surfaceContainerHigh);
					border-radius: 24px;
					transition: all 0.2s;
				}

				.toggle-slider::after {
					content: '';
					position: absolute;
					top: 2px;
					left: 2px;
					width: 20px;
					height: 20px;
					background: white;
					border-radius: 50%;
					transition: all 0.2s;
				}

				.toggle-switch input:checked + .toggle-slider {
					background: var(--primary);
				}

				.toggle-switch input:checked + .toggle-slider::after {
					transform: translateX(20px);
				}

				/* Offline badge */
				.offline-badge {
					display: flex;
					align-items: center;
					gap: 8px;
					padding-top: 16px;
					color: var(--onSurfaceVariant);
					opacity: 0.6;
				}

				.offline-badge .material-symbols-outlined {
					font-size: 18px;
				}

				.offline-badge span:last-child {
					font-size: 14px;
					font-family: var(--font-label);
					font-style: italic;
				}

				/* Storage */
				.storage-summary {
					display: flex;
					flex-direction: column;
					gap: 16px;
				}

				.storage-total {
					font-size: 20px;
					font-weight: 700;
					color: var(--onSurface);
				}

				.storage-label {
					font-size: 14px;
					color: var(--onSurfaceVariant);
					margin: 0;
				}

				.storage-used {
					font-family: var(--font-body);
					font-size: 14px;
					color: var(--onSurfaceVariant);
				}

				.storage-bar {
					display: flex;
					height: 16px;
					background: var(--surfaceContainerHigh);
					border-radius: 8px;
					overflow: hidden;
				}

				.bar-segment {
					height: 100%;
				}

				.bar-segment.packs {
					background: var(--primary);
				}

				.bar-segment.models {
					background: var(--secondary);
				}

				.bar-segment.annotations {
					background: var(--tertiary);
				}

				.storage-legend {
					display: grid;
					grid-template-columns: repeat(4, 1fr);
					gap: 16px;
				}

				.legend-item {
					display: flex;
					align-items: center;
					gap: 8px;
				}

				.legend-dot {
					width: 8px;
					height: 8px;
					border-radius: 50%;
				}

				.legend-dot.packs {
					background: var(--primary);
				}

				.legend-dot.models {
					background: var(--secondary);
				}

				.legend-dot.annotations {
					background: var(--tertiary);
				}

				.legend-dot.free {
					background: var(--surfaceContainerHigh);
					border: 1px solid var(--outline);
				}

				.legend-label {
					font-family: var(--font-body);
					font-size: 11px;
					color: var(--onSurfaceVariant);
				}

				/* Settings actions */
				.settings-actions {
					display: flex;
					gap: 16px;
					padding-top: 16px;
				}

				.button-secondary {
					padding: 10px 24px;
					background: transparent;
					border: 1px solid var(--outlineVariant);
					color: var(--onSurface);
					border-radius: var(--radius-md);
					font-family: var(--font-label);
					font-size: 14px;
					cursor: pointer;
					transition: all 0.2s;
				}

				.button-secondary:hover {
					background: var(--surfaceContainerHigh);
				}

				.button-danger {
					padding: 10px 24px;
					background: transparent;
					border: none;
					color: var(--error);
					border-radius: var(--radius-md);
					font-family: var(--font-label);
					font-size: 14px;
					cursor: pointer;
					transition: all 0.2s;
				}

				.button-danger:hover {
					background: rgba(255, 180, 171, 0.1);
				}

				/* Subscription */
				.subscription-card {
					background: linear-gradient(to bottom right, var(--surfaceContainerLowest), var(--surfaceContainerLow));
					border-color: rgba(79, 219, 200, 0.2);
				}

				.subscription-header {
					display: flex;
					justify-content: space-between;
					align-items: flex-start;
					margin-bottom: 32px;
				}

				.subscription-header h3 {
					font-size: 20px;
					font-weight: 700;
					color: var(--onSurface);
					margin: 0 0 4px 0;
				}

				.subscription-header p {
					font-size: 16px;
					color: var(--onSurfaceVariant);
					margin: 0;
				}

				.subscription-icon {
					width: 48px;
					height: 48px;
					border-radius: var(--radius-md);
					background: rgba(79, 219, 200, 0.1);
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.subscription-icon .material-symbols-outlined {
					font-size: 32px;
					color: var(--primary);
				}

				.button-primary {
					width: 100%;
					padding: 16px;
					background: var(--primary);
					color: var(--onPrimary);
					border: none;
					border-radius: var(--radius-md);
					font-family: var(--font-label);
					font-size: 14px;
					font-weight: 700;
					cursor: pointer;
					transition: all 0.2s;
				}

				.button-primary:hover {
					transform: scale(1.01);
				}

				.button-primary:active {
					transform: scale(0.98);
				}

				.restore-section {
					margin-top: 24px;
					text-align: center;
				}

				.restore-message {
					padding: 8px 12px;
					border-radius: var(--radius-sm);
					font-size: 14px;
					margin-bottom: 8px;
				}

				.restore-message.success {
					background: rgba(79, 219, 200, 0.1);
					color: var(--primary);
				}

				.restore-message.info {
					background: rgba(188, 198, 224, 0.1);
					color: var(--onSurfaceVariant);
				}

				.restore-button {
					background: transparent;
					border: none;
					color: var(--onSurfaceVariant);
					font-family: var(--font-label);
					font-size: 14px;
					cursor: pointer;
					transition: all 0.2s;
				}

				.restore-button:hover:not(:disabled) {
					color: var(--primary);
				}

				.restore-button:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}

				/* About */
				.about-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.about-info {
					display: flex;
					align-items: center;
					gap: 16px;
				}

				.about-logo {
					width: 40px;
					height: 40px;
					border-radius: var(--radius-md);
					background: var(--surfaceContainerHighest);
					display: flex;
					align-items: center;
					justify-content: center;
					font-weight: 700;
					color: var(--primary);
					border: 1px solid var(--outlineVariant);
				}

				.about-name {
					font-size: 16px;
					font-weight: 700;
					color: var(--onSurface);
					margin: 0;
				}

				.about-version {
					font-size: 14px;
					color: var(--onSurfaceVariant);
					margin: 0;
				}

				.offline-badge-chip {
					display: flex;
					align-items: center;
					gap: 4px;
					padding: 4px 12px;
					border-radius: 999px;
					background: var(--surfaceContainerHigh);
					border: 1px solid var(--outlineVariant);
					font-size: 11px;
					font-weight: 700;
					color: var(--primary);
				}

				.offline-badge-chip .material-symbols-outlined {
					font-size: 14px;
				}

				.about-footer {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding-top: 16px;
				}

				.about-footer span {
					font-size: 14px;
					color: var(--onSurfaceVariant);
				}

				.link-primary {
					color: var(--primary);
					text-decoration: none;
					font-size: 14px;
				}

				.link-primary:hover {
					text-decoration: underline;
				}

				.border-top {
					border-top: 1px solid var(--outlineVariant);
				}
			`}</style>
		</div>
	);
}
