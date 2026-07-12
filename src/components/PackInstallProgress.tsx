import { usePackStore } from '../stores/pack';

/**
 * PackInstallProgress — Per-pack install progress (Dynamic-Download identity; Stitch 03-catalog)
 *
 * Reads the STORE's `installProgress` map (UI-6), NOT a passed channel.
 * Shows 4px teal track with phase (connecting/downloading/installing/complete), bytes, %.
 * Integrates Stitch `03-catalog` (3d5f962f…).
 */
interface PackInstallProgressProps {
	packId: string;
}

export function PackInstallProgress({ packId }: PackInstallProgressProps) {
	const { installProgress, installedPackIds } = usePackStore();
	const progress = installProgress.get(packId);
	const isInstalled = installedPackIds.has(packId);

	// If no progress and not installed, don't render
	if (!progress && !isInstalled) {
		return null;
	}

	// If installed and no active progress, show complete state
	if (isInstalled && !progress) {
		return (
			<div className="pack-install-progress">
				<span className="progress-phase">complete</span>
			</div>
		);
	}

	if (!progress) {
		return null;
	}

	const percent = progress.total_bytes > 0
		? Math.round((progress.bytes_downloaded / progress.total_bytes) * 100)
		: 0;

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

	return (
		<div className="pack-install-progress">
			<div className="progress-header">
				<span className="progress-phase">{progress.phase}</span>
			</div>
			<div
				className="progress-bar-container"
				style={{
					height: '4px',
					backgroundColor: 'var(--surface-container-high)',
					borderRadius: 'var(--radius-md)',
					overflow: 'hidden',
				}}
			>
				<div
					className="progress-bar-fill"
					style={{
						width: `${percent}%`,
						height: '100%',
						backgroundColor: 'var(--primary)',
						transition: 'width 0.3s ease',
					}}
				/>
			</div>
			<div className="progress-details">
				<span className="bytes-downloaded">
					{formatSize(progress.bytes_downloaded)} / {formatSize(progress.total_bytes)}
				</span>
				<span className="percent-complete">{percent}%</span>
			</div>
		</div>
	);
}
