import { useEffect, useState, useCallback } from 'react';
import { usePackStore } from '../stores/pack';
import { useEntitlementStore } from '../stores/entitlement';
import { PackInstallProgress } from './PackInstallProgress';
import { PaywallOverlay } from './PaywallOverlay';
import { ZimPack } from '../bridge';

/**
 * PackCatalogBrowser — Dynamic-Download catalog (Stitch 03-catalog, 3d5f962f...)
 *
 * Binds usePackStore (refreshCatalog, installPack, uninstallPack, catalog,
 * installedPackIds, installProgress). Renders a card grid with install/uninstall
 * buttons and inline PackInstallProgress. Refresh button re-pulls the catalog.
 *
 * Integrates Stitch 03-catalog (3d5f962f927f4023bd7714fb05864c76).
 */
export function PackCatalogBrowser() {
	const { catalog, installedPackIds, installProgress, isLoading, lastError, refreshCatalog, installPack, uninstallPack, clearError } = usePackStore();
	const entitlementStore = useEntitlementStore();
	const [searchQuery, setSearchQuery] = useState('');
	const [installingId, setInstallingId] = useState<string | null>(null);
	const [showPaywall, setShowPaywall] = useState(false);

	const loadCatalog = useCallback(async () => {
		try {
			await refreshCatalog();
		} catch (e) {
			console.error('Failed to load pack catalog:', e);
		}
	}, [refreshCatalog]);

	useEffect(() => {
		loadCatalog();
	}, [loadCatalog]);

	const handleInstall = async (pack: ZimPack) => {
		// Check pack_install entitlement before installing
		const entitled = await entitlementStore.check('pack_install');
		if (!entitled) {
			setShowPaywall(true);
			return;
		}

		setInstallingId(pack.pack_id);
		clearError();
		try {
			await installPack(pack.pack_id);
		} catch (e) {
			console.error('Failed to install pack:', e);
		} finally {
			setInstallingId(null);
		}
	};

	const handleUninstall = async (packId: string) => {
		clearError();
		try {
			await uninstallPack(packId);
		} catch (e) {
			console.error('Failed to uninstall pack:', e);
		}
	};

	const formatSize = (bytes: number): string => {
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = bytes;
		let unitIndex = 0;
		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}
		return `${size.toFixed(1)} ${units[unitIndex]}`;
	};

	const filteredCatalog = catalog.filter(pack =>
		pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
		pack.description.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<div className="pack-catalog-browser">
			<div className="catalog-header">
				<h2>ZIM Pack Catalog</h2>
				<button onClick={loadCatalog} disabled={isLoading} className="refresh-button">
					{isLoading ? 'Refreshing...' : 'Refresh Catalog'}
				</button>
			</div>

			{lastError && (
				<div className="error-message">
					{lastError}
					<button onClick={clearError} className="dismiss-button">×</button>
				</div>
			)}

			<div className="catalog-search">
				<input
					type="text"
					placeholder="Search packs by name or description..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="search-input"
				/>
			</div>

			<div className="pack-list">
				{isLoading && catalog.length === 0 ? (
					<p className="loading-message">Loading pack catalog...</p>
				) : filteredCatalog.length === 0 ? (
					<p className="empty-message">
						{searchQuery ? 'No packs match your search.' : 'No packs available in the catalog.'}
					</p>
				) : (
					<div className="pack-grid">
						{filteredCatalog.map((pack) => {
							const isInstalled = installedPackIds.has(pack.pack_id);
							const progress = installProgress.get(pack.pack_id);
							const isInstalling = installingId === pack.pack_id || progress !== undefined;

							return (
								<div key={pack.pack_id} className={`pack-card ${isInstalled ? 'installed' : ''}`}>
									<div className="pack-header">
										<h3 className="pack-name">{pack.name}</h3>
										{isInstalled && <span className="installed-badge">Installed</span>}
									</div>

									<p className="pack-description">{pack.description}</p>

									<div className="pack-meta">
										<span className="pack-size">{formatSize(pack.size_bytes)}</span>
										<span className="pack-checksum" title={`SHA-256: ${pack.checksum}`}>
											{pack.checksum.slice(0, 8)}...
										</span>
									</div>

									{isInstalling && <PackInstallProgress packId={pack.pack_id} />}

									{!isInstalling && (
										<div className="pack-actions">
											{isInstalled ? (
												<button
													onClick={() => handleUninstall(pack.pack_id)}
													disabled={isLoading}
													className="uninstall-button"
												>
													Uninstall
												</button>
											) : (
												<button
													onClick={() => handleInstall(pack)}
													disabled={isLoading || isInstalling}
													className="install-button"
												>
													Install
												</button>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}

			{/* Paywall overlay */}
			{showPaywall && <PaywallOverlay feature="pack_install" />}
			</div>
		</div>
	);
}
