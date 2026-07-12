import { useState } from 'react';
import { useZimStore } from '../stores/zim';
import { useEntitlementStore } from '../stores/entitlement';
import { PaywallOverlay } from './PaywallOverlay';
import { sidecarCreate, sidecarExport, annotationsList, Payload } from '../bridge';

export function SidecarExportButton() {
	const { openHandles } = useZimStore();
	const entitlementStore = useEntitlementStore();
	const [isExporting, setIsExporting] = useState(false);
	const [lastError, setLastError] = useState<string | null>(null);
	const [showPaywall, setShowPaywall] = useState(false);

	const handleExport = async () => {
		if (openHandles.length === 0) {
			setLastError('No ZIM file is currently open');
			return;
		}

		// Check sidecar_export entitlement before export
		const entitled = await entitlementStore.check('sidecar_export');
		if (!entitled) {
			setShowPaywall(true);
			return;
		}

		setIsExporting(true);
		setLastError(null);

		try {
			const activeZim = openHandles[0];
			const annotations = await annotationsList(activeZim.handle, '');

			if (annotations.length === 0) {
				setLastError('No annotations to export');
				return;
			}

			const payload: Payload = {
				kind: 'AnnotationSet',
				body: {
					annotations: annotations.map(ann => ({
						id: new Uint8Array(16),
						region: {
							kind: ann.region.Char
								? { CharRange: { start: ann.region.Char.start, end: ann.region.Char.end } }
								: ann.region.Page
								? { Page: { page: ann.region.Page } }
								: ann.region.Custom
								? { Custom: { selector: ann.region.Custom } }
								: { Url: { url: '' } }
						},
						body_text: ann.body,
						body_voice: null,
						body_transcript: null,
						created_at: ann.created_at,
						updated_at: null,
						tags: []
					}))
				}
			};

			const sidecar = await sidecarCreate(payload, activeZim.handle, activeZim.uuid);
			const artifactId = sidecar.artifact_id.map(b => b.toString(16).padStart(2, '0')).join('');
			const bytes = await sidecarExport(artifactId);

			const blob = new Blob([new Uint8Array(bytes)], { type: 'application/cbor' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${activeZim.uuid}-${artifactId}.zsc`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (e) {
			setLastError(`Export failed: ${e}`);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<div className="sidecar-export-button">
			<button onClick={handleExport} disabled={isExporting || openHandles.length === 0}>
				{isExporting ? 'Exporting...' : 'Export Sidecar (.zsc)'}
			</button>
			{lastError && <div className="error-message">{lastError}</div>}
			<PaywallOverlay show={showPaywall} onClose={() => setShowPaywall(false)} />
		</div>
	);
}
