import { useState, useCallback } from 'react';
import { sidecarImport, trustGet, trustSet, TrustLevel, SidecarMeta } from '../bridge';

export function SidecarImportFlow() {
	const [isDragging, setIsDragging] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [pendingImport, setPendingImport] = useState<SidecarMeta | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const handleDrop = useCallback(async (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);

		const files = Array.from(e.dataTransfer.files);
		const zscFile = files.find(f => f.name.endsWith('.zsc'));

		if (!zscFile) {
			setError('Please drop a .zsc file');
			return;
		}

		setIsProcessing(true);
		setError(null);
		setSuccess(null);

		try {
			const bytes = Array.from(new Uint8Array(await zscFile.arrayBuffer()));
			const meta = await sidecarImport(bytes);

			const trust = await trustGet(meta.signer_pubkey);

			if (trust === null || trust === TrustLevel.Unknown) {
				setPendingImport(meta);
			} else {
				setSuccess(`Imported sidecar ${meta.artifact_id} from ${meta.signer_pubkey}`);
			}
		} catch (e) {
			setError(`Import failed: ${e}`);
		} finally {
			setIsProcessing(false);
		}
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback(() => {
		setIsDragging(false);
	}, []);

	const handleTrustDecision = async (level: TrustLevel) => {
		if (!pendingImport) return;

		try {
			await trustSet(
				pendingImport.signer_pubkey,
				level,
				null,
				null,
				'User approved via import flow'
			);
			setSuccess(`Imported sidecar ${pendingImport.artifact_id}. Trust set to ${level}`);
			setPendingImport(null);
		} catch (e) {
			setError(`Failed to set trust: ${e}`);
		}
	};

	const handleReject = async () => {
		if (!pendingImport) return;

		try {
			await trustSet(
				pendingImport.signer_pubkey,
				TrustLevel.Rejected,
				null,
				null,
				'User rejected via import flow'
			);
			setSuccess(`Sidecar rejected. Peer ${pendingImport.signer_pubkey} marked as Rejected`);
			setPendingImport(null);
		} catch (e) {
			setError(`Failed to set trust: ${e}`);
		}
	};

	return (
		<div className="sidecar-import-flow">
			<div
				className={`drop-zone ${isDragging ? 'dragging' : ''}`}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
			>
				{isProcessing ? (
					<p>Processing...</p>
				) : (
					<p>Drop a .zsc file here to import</p>
				)}
			</div>

			{pendingImport && (
				<div className="trust-prompt">
					<h3>Import from Unknown Peer</h3>
					<p><strong>Sidecar ID:</strong> {pendingImport.artifact_id}</p>
					<p><strong>Signer:</strong> {pendingImport.signer_pubkey}</p>
					<p><strong>Kind:</strong> {pendingImport.kind}</p>
					<p><strong>Created:</strong> {new Date(pendingImport.created_at * 1000).toISOString()}</p>
					<p className="trust-question">Do you trust this peer?</p>
					<div className="trust-actions">
						<button onClick={() => handleTrustDecision(TrustLevel.Trusted)}>
							Trusted
						</button>
						<button onClick={() => handleTrustDecision(TrustLevel.Verified)}>
							Verified
						</button>
						<button onClick={handleReject} className="reject">
							Reject
						</button>
					</div>
				</div>
			)}

			{error && <div className="error-message">{error}</div>}
			{success && <div className="success-message">{success}</div>}
		</div>
	);
}
