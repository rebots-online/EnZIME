import { useState, useEffect, useCallback } from 'react';
import { trustList, trustSet, TrustLevel, TrustEntry } from '../bridge';

export function PeerTrustManager() {
	const [entries, setEntries] = useState<TrustEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [editingPubkey, setEditingPubkey] = useState<string | null>(null);
	const [newPubkey, setNewPubkey] = useState('');
	const [newLevel, setNewLevel] = useState(TrustLevel.Trusted);
	const [newReason, setNewReason] = useState('');

	const loadEntries = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await trustList();
			setEntries(result);
		} catch (e) {
			setError(`Failed to load trust entries: ${e}`);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadEntries();
	}, [loadEntries]);

	const handleSetTrust = async (pubkey: string, level: TrustLevel, reason?: string) => {
		setError(null);
		setSuccess(null);
		try {
			await trustSet(pubkey, level, null, null, reason || `Manual update via Trust Manager`);
			await loadEntries();
			setSuccess(`Trust level for ${pubkey.slice(0, 8)}... set to ${level}`);
			setEditingPubkey(null);
		} catch (e) {
			setError(`Failed to update trust: ${e}`);
		}
	};

	const handleRemoveTrust = async (pubkey: string) => {
		setError(null);
		setSuccess(null);
		try {
			await trustSet(pubkey, TrustLevel.Unknown, null, null, 'Removed via Trust Manager');
			await loadEntries();
			setSuccess(`Trust entry for ${pubkey.slice(0, 8)}... removed`);
		} catch (e) {
			setError(`Failed to remove trust: ${e}`);
		}
	};

	const handleAddEntry = async () => {
		if (!newPubkey.trim()) {
			setError('Public key is required');
			return;
		}
		setError(null);
		setSuccess(null);
		try {
			await trustSet(newPubkey.trim(), newLevel, null, null, newReason || 'Manually added via Trust Manager');
			await loadEntries();
			setSuccess(`Added trust entry for ${newPubkey.trim().slice(0, 8)}...`);
			setNewPubkey('');
			setNewReason('');
		} catch (e) {
			setError(`Failed to add trust entry: ${e}`);
		}
	};

	const formatSource = (entry: TrustEntry): string => {
		if (entry.source.Manual !== null && entry.source.Manual !== undefined) return 'Manual';
		if (entry.source.Gossip) return `Gossip from ${entry.source.Gossip.from_pubkey.slice(0, 8)}...`;
		if (entry.source.Operator !== null && entry.source.Operator !== undefined) return 'Operator';
		return 'Unknown';
	};

	const levelOrder: Record<TrustLevel, number> = {
		[TrustLevel.Trusted]: 3,
		[TrustLevel.Verified]: 2,
		[TrustLevel.Rejected]: 1,
		[TrustLevel.Unknown]: 0,
	};

	const sortedEntries = [...entries].sort((a, b) => {
		const levelDiff = levelOrder[b.level] - levelOrder[a.level];
		if (levelDiff !== 0) return levelDiff;
		return a.pubkey.localeCompare(b.pubkey);
	});

	return (
		<div className="peer-trust-manager">
			<h2>Peer Trust Database</h2>

			{error && <div className="error-message">{error}</div>}
			{success && <div className="success-message">{success}</div>}

			<div className="trust-add-form">
				<h3>Add Trust Entry</h3>
				<div className="form-row">
					<label>
						Public Key (ed25519 hex):
						<input
							type="text"
							value={newPubkey}
							onChange={(e) => setNewPubkey(e.target.value)}
							placeholder="64 hex characters"
						/>
					</label>
				</div>
				<div className="form-row">
					<label>
						Trust Level:
						<select value={newLevel} onChange={(e) => setNewLevel(e.target.value as TrustLevel)}>
							<option value={TrustLevel.Trusted}>Trusted</option>
							<option value={TrustLevel.Verified}>Verified</option>
							<option value={TrustLevel.Rejected}>Rejected</option>
						</select>
					</label>
				</div>
				<div className="form-row">
					<label>
						Reason (optional):
						<input
							type="text"
							value={newReason}
							onChange={(e) => setNewReason(e.target.value)}
							placeholder="Why do you trust this peer?"
						/>
					</label>
				</div>
				<button onClick={handleAddEntry} disabled={!newPubkey.trim()}>
					Add Entry
				</button>
			</div>

			<div className="trust-list">
				<h3>Trust Entries ({entries.length})</h3>
				{loading ? (
					<p>Loading...</p>
				) : sortedEntries.length === 0 ? (
					<p>No trust entries found.</p>
				) : (
					<table className="trust-table">
						<thead>
							<tr>
								<th>Public Key</th>
								<th>Level</th>
								<th>Source</th>
								<th>Reason</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{sortedEntries.map((entry) => (
								<tr key={entry.pubkey}>
									<td>
										<code title={entry.pubkey}>{entry.pubkey.slice(0, 16)}...</code>
									</td>
									<td>
										<span className={`level-badge level-${entry.level.toLowerCase()}`}>
											{entry.level}
										</span>
									</td>
									<td>{formatSource(entry)}</td>
									<td>{entry.reason || '-'}</td>
									<td>
										{editingPubkey === entry.pubkey ? (
											<div className="edit-actions">
												<button onClick={() => handleSetTrust(entry.pubkey, TrustLevel.Trusted)}>
													Trusted
												</button>
												<button onClick={() => handleSetTrust(entry.pubkey, TrustLevel.Verified)}>
													Verified
												</button>
												<button onClick={() => handleSetTrust(entry.pubkey, TrustLevel.Rejected)} className="reject">
													Rejected
												</button>
												<button onClick={() => setEditingPubkey(null)} className="cancel">
													Cancel
												</button>
											</div>
										) : (
											<div className="row-actions">
												<button onClick={() => setEditingPubkey(entry.pubkey)}>
													Edit
												</button>
												<button onClick={() => handleRemoveTrust(entry.pubkey)} className="reject">
													Remove
												</button>
											</div>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
