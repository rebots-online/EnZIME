import { useEffect, useState, useCallback } from 'react';
import { Annotation, annotationsList, annotationsCreate, annotationsDelete } from '../bridge';
import { SidecarExportButton } from './SidecarExportButton';

interface AnnotationsListProps {
	handle: number;
	url: string;
}

/**
 * AnnotationsList component — displays and manages per-article annotations.
 *
 * Loads annotations for the specified ZIM handle and article URL via bridge.annotationsList.
 * Each annotation shows:
 * - Highlighted text snippet or region
 * - User note/body text
 * - Creation timestamp
 * - Delete affordance
 *
 * Users can create annotations by selecting text in the article viewer and clicking "Add Annotation".
 * Deleting an annotation removes both the list item and the painted region from the reader.
 *
 * Integrates Stitch 07-annotator screen (eb681073…).
 */
export function AnnotationsList({ handle, url }: AnnotationsListProps): JSX.Element {
	const [annotations, setAnnotations] = useState<Annotation[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [selectedText, setSelectedText] = useState<string>('');
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [newAnnotationBody, setNewAnnotationBody] = useState('');

	const loadAnnotations = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const loaded = await annotationsList(handle, url);
			setAnnotations(loaded);
		} catch (e) {
			console.error('Failed to load annotations:', e);
			setError('Failed to load annotations');
		} finally {
			setLoading(false);
		}
	}, [handle, url]);

	useEffect(() => {
		loadAnnotations();
	}, [loadAnnotations]);

	const handleTextSelection = useCallback(() => {
		const selection = window.getSelection();
		if (selection && selection.toString().trim().length > 0) {
			setSelectedText(selection.toString().trim());
			setShowCreateForm(true);
		}
	}, []);

	const handleCreateAnnotation = useCallback(async () => {
		if (!selectedText || creating) return;

		setCreating(true);
		setError(null);

		try {
			// Get the range from current selection
			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0) {
				setError('No text selected');
				setCreating(false);
				return;
			}

			const range = selection.getRangeAt(0);
			const region = {
				Char: {
					start: range.startOffset,
					end: range.endOffset
				}
			};

			const body = newAnnotationBody || selectedText;
			await annotationsCreate(handle, url, region, body);

			// Clear selection and form
			selection.removeAllRanges();
			setSelectedText('');
			setNewAnnotationBody('');
			setShowCreateForm(false);

			// Reload annotations to show the new one
			await loadAnnotations();
		} catch (e) {
			console.error('Failed to create annotation:', e);
			setError('Failed to create annotation');
		} finally {
			setCreating(false);
		}
	}, [selectedText, newAnnotationBody, handle, url, creating, loadAnnotations]);

	const handleDeleteAnnotation = useCallback(async (annotation: Annotation) => {
		setDeletingId(annotation.id);
		setError(null);

		try {
			await annotationsDelete(annotation.id);

			// Reload annotations to show updated list
			await loadAnnotations();
		} catch (e) {
			console.error('Failed to delete annotation:', e);
			setError('Failed to delete annotation');
		} finally {
			setDeletingId(null);
		}
	}, [loadAnnotations]);

	const handleCancelCreate = useCallback(() => {
		setSelectedText('');
		setNewAnnotationBody('');
		setShowCreateForm(false);
		const selection = window.getSelection();
		if (selection) {
			selection.removeAllRanges();
		}
	}, []);

	const formatDate = (timestamp: number): string => {
		return new Date(timestamp).toLocaleString();
	};

	const getRegionText = (annotation: Annotation): string => {
		if (annotation.region.Char) {
			return `Character range: ${annotation.region.Char.start}–${annotation.region.Char.end}`;
		}
		if (annotation.region.Custom) {
			return `Custom: ${annotation.region.Custom}`;
		}
		return 'Page annotation';
	};

	return (
		<>
			<style>{`
				.annotations-list {
					display: flex;
					flex-direction: column;
					gap: var(--spacing-base, 8px);
					padding: var(--spacing-base, 8px);
				}

				.annotations-list-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: var(--spacing-base, 8px);
				}

				.annotations-list-header h2 {
					font-family: var(--font-heading, Space Grotesk);
					font-size: 1.5rem;
					font-weight: 600;
					color: var(--on-surface, #d4e4fa);
					margin: 0;
				}

				.annotations-refresh-button {
					background: var(--primary-container, #14b8a6);
					color: var(--on-primary-container, #00423b);
					border: none;
					padding: 8px 16px;
					border-radius: 4px;
					font-family: var(--font-label, Space Grotesk);
					font-size: 0.875rem;
					font-weight: 600;
					cursor: pointer;
					transition: opacity 0.2s;
				}

				.annotations-refresh-button:hover {
					opacity: 0.9;
				}

				.annotations-refresh-button:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.annotations-error {
					background: var(--error-container, #93000a);
					color: var(--on-error-container, #ffdad6);
					padding: 12px;
					border-radius: 8px;
					margin-bottom: var(--spacing-base, 8px);
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.annotations-error-close {
					background: transparent;
					border: none;
					color: var(--on-error-container, #ffdad6);
					font-size: 1.25rem;
					cursor: pointer;
					padding: 0 8px;
				}

				.annotations-loading {
					text-align: center;
					padding: 24px;
					color: var(--on-surface-variant, #bbcac6);
				}

				.annotations-empty {
					text-align: center;
					padding: 24px;
					color: var(--on-surface-variant, #bbcac6);
				}

				.annotations-create-prompt {
					background: var(--surface-container-low, #0d1c2d);
					border: 1px dashed var(--outline, #859490);
					border-radius: 8px;
					padding: 16px;
					margin-bottom: var(--spacing-base, 8px);
				}

				.annotations-create-prompt p {
					font-family: var(--font-body, Geist);
					font-size: 0.875rem;
					color: var(--on-surface-variant, #bbcac6);
					margin: 0 0 8px 0;
				}

				.annotations-create-prompt button {
					background: var(--primary, #4fdbc8);
					color: var(--on-primary, #003731);
					border: none;
					padding: 8px 16px;
					border-radius: 4px;
					font-family: var(--font-label, Space Grotesk);
					font-size: 0.875rem;
					font-weight: 600;
					cursor: pointer;
					transition: opacity 0.2s;
				}

				.annotations-create-prompt button:hover {
					opacity: 0.9;
				}

				.annotations-create-form {
					background: var(--surface-container-low, #0d1c2d);
					border: 1px solid var(--primary, #4fdbc8);
					border-radius: 8px;
					padding: 16px;
					margin-bottom: var(--spacing-base, 8px);
				}

				.annotations-create-form textarea {
					width: 100%;
					min-height: 80px;
					background: var(--surface, #09101a);
					border: 1px solid var(--outline, #859490);
					border-radius: 4px;
					padding: 8px;
					font-family: var(--font-body, Geist);
					font-size: 0.875rem;
					color: var(--on-surface, #d4e4fa);
					resize: vertical;
					margin-bottom: 8px;
					box-sizing: border-box;
				}

				.annotations-create-form textarea:focus {
					outline: none;
					border-color: var(--primary, #4fdbc8);
				}

				.annotations-create-form-buttons {
					display: flex;
					gap: 8px;
					justify-content: flex-end;
				}

				.annotations-create-form button {
					padding: 8px 16px;
					border-radius: 4px;
					font-family: var(--font-label, Space Grotesk);
					font-size: 0.875rem;
					font-weight: 600;
					cursor: pointer;
					transition: opacity 0.2s;
				}

				.annotations-create-form button.primary {
					background: var(--primary, #4fdbc8);
					color: var(--on-primary, #003731);
					border: none;
				}

				.annotations-create-form button.primary:hover {
					opacity: 0.9;
				}

				.annotations-create-form button.primary:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.annotations-create-form button.secondary {
					background: transparent;
					color: var(--on-surface-variant, #bbcac6);
					border: 1px solid var(--outline, #859490);
				}

				.annotations-create-form button.secondary:hover {
					background: var(--surface-container, #122131);
				}

				.annotation-item {
					display: flex;
					align-items: flex-start;
					gap: 12px;
					padding: 12px;
					background: var(--surface-container-low, #0d1c2d);
					border: 1px solid var(--outline, #859490);
					border-radius: 8px;
					transition: background 0.2s, border-color 0.2s;
				}

				.annotation-item:hover {
					background: var(--surface-container, #122131);
					border-color: var(--primary, #4fdbc8);
				}

				.annotation-delete {
					font-size: 1.25rem;
					color: var(--error, #ffb4ab);
					flex-shrink: 0;
					cursor: pointer;
					padding: 4px;
					background: transparent;
					border: none;
					transition: transform 0.2s;
				}

				.annotation-delete:hover {
					transform: scale(1.1);
				}

				.annotation-delete:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.annotation-content {
					flex: 1;
					min-width: 0;
				}

				.annotation-body {
					font-family: var(--font-body, Geist);
					font-size: 0.9375rem;
					font-weight: 400;
					color: var(--on-surface, #d4e4fa);
					margin: 0 0 4px 0;
					word-wrap: break-word;
				}

				.annotation-region {
					font-family: var(--font-code, Geist);
					font-size: 0.75rem;
					color: var(--on-surface-variant, #bbcac6);
					margin: 0 0 4px 0;
				}

				.annotation-date {
					font-family: var(--font-code, Geist);
					font-size: 0.75rem;
					color: var(--on-surface-variant, #bbcac6);
					flex-shrink: 0;
					white-space: nowrap;
				}

				.annotations-export-section {
					margin-top: var(--spacing-base, 8px);
					padding-top: var(--spacing-base, 8px);
					border-top: 1px solid var(--outline, #859490);
				}
			`}</style>

			<div className="annotations-list">
				<div className="annotations-list-header">
					<h2>Annotations</h2>
					<button
						onClick={loadAnnotations}
						disabled={loading}
						className="annotations-refresh-button"
					>
						{loading ? 'Refreshing...' : 'Refresh'}
					</button>
				</div>

				{error && (
					<div className="annotations-error">
						<span>{error}</span>
						<button
							onClick={() => setError(null)}
							className="annotations-error-close"
						>
							×
						</button>
					</div>
				)}

				{loading && annotations.length === 0 ? (
					<p className="annotations-loading">Loading annotations...</p>
				) : (
					<>
						{!showCreateForm && annotations.length === 0 && (
							<div className="annotations-create-prompt">
								<p>Select text in the article to create your first annotation.</p>
							</div>
						)}

						{showCreateForm && (
							<div className="annotations-create-form">
								<textarea
									placeholder="Add a note (optional)"
									value={newAnnotationBody}
									onChange={(e) => setNewAnnotationBody(e.target.value)}
									disabled={creating}
								/>
								<p style={{ fontFamily: 'var(--font-code, Geist)', fontSize: '0.75rem', color: 'var(--on-surface-variant, #bbcac6)', margin: '0 0 8px 0' }}>
									Selected: {selectedText}
								</p>
								<div className="annotations-create-form-buttons">
									<button
										onClick={handleCancelCreate}
										className="secondary"
										disabled={creating}
									>
										Cancel
									</button>
									<button
										onClick={handleCreateAnnotation}
										className="primary"
										disabled={creating || !selectedText}
									>
										{creating ? 'Creating...' : 'Add Annotation'}
									</button>
								</div>
							</div>
						)}

						{annotations.length === 0 && !showCreateForm ? (
							<p className="annotations-empty">No annotations yet for this article.</p>
						) : (
							annotations.map((annotation) => (
								<div key={annotation.id} className="annotation-item">
									<button
										className="annotation-delete"
										onClick={() => handleDeleteAnnotation(annotation)}
										disabled={deletingId === annotation.id}
										title="Delete annotation"
									>
										{deletingId === annotation.id ? '⋯' : '×'}
									</button>
									<div className="annotation-content">
										<p className="annotation-body">{annotation.body}</p>
										<p className="annotation-region">{getRegionText(annotation)}</p>
									</div>
									<span className="annotation-date">{formatDate(annotation.created_at)}</span>
								</div>
							))
						)}

						{annotations.length > 0 && (
							<div className="annotations-export-section">
								<SidecarExportButton />
							</div>
						)}
					</>
				)}
			</div>
		</>
	);
}
