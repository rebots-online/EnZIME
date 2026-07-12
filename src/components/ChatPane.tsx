import type { JSX } from 'react';
import { useEffect, useState, useRef } from 'react';
import { useChatStore } from '../stores/chat';
import { useVariantStore } from '../stores/variant';
import { useEntitlementStore } from '../stores/entitlement';
import { MessageList } from './MessageList';
import { PaywallOverlay } from './PaywallOverlay';
import { Variant } from '../bridge';

// E-FE-3: ChatPane component props — numeric handles (UI-8, reconcile flag 4)
export interface ChatPaneProps {
	sessionId: number | null;
	zimHandle: number | null;
}

/**
 * ChatPane component — Reader-notebook Chat tab.
 *
 * - Binds useChatStore for message persistence and streaming
 * - Renders MessageList with live streaming support
 * - Composer input with send button
 * - Voice input gated to Gemma tier + has_microphone
 * - Integrates Stitch screen 04-reader (e40062bb…)
 *
 * @param props.sessionId - Chat session ID (numeric, not string)
 * @param props.zimHandle - Active ZIM handle (numeric, not string)
 */
export function ChatPane({ sessionId, zimHandle }: ChatPaneProps): JSX.Element {
	const chatStore = useChatStore();
	const variantStore = useVariantStore();
	const entitlementStore = useEntitlementStore();
	const [prompt, setPrompt] = useState('');
	const [isRecording, setIsRecording] = useState(false);
	const [showPaywall, setShowPaywall] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Load messages when sessionId changes
	useEffect(() => {
		if (sessionId !== null) {
			chatStore.loadMessages().catch((e) => {
				console.error('Failed to load messages:', e);
			});
		}
	}, [sessionId]);

	// Voice gating: enabled only on Gemma tier + has_microphone
	const isGemmaTier = variantStore.currentVariant === Variant.GemmaE2bQ4;
	const hasMicrophone = variantStore.deviceCapability?.has_microphone ?? false;
	const voiceEnabled = isGemmaTier && hasMicrophone;

	// Handle send button click
	const handleSend = async () => {
		if (!prompt.trim() || chatStore.streaming) return;

		// Check ai_chat entitlement before sending
		const entitled = await entitlementStore.check('ai_chat');
		if (!entitled) {
			setShowPaywall(true);
			return;
		}

		const promptToSend = prompt;
		setPrompt(''); // Clear immediately for responsiveness

		try {
			await chatStore.sendStream(promptToSend);
		} catch (e) {
			console.error('Failed to send message:', e);
			setPrompt(promptToSend); // Restore on error
		}
	};

	// Handle voice input (mic→PCM→aiVoiceChat)
	const handleVoiceInput = async () => {
		if (!voiceEnabled || isRecording || chatStore.streaming) return;

		// Check voice_transcription entitlement before starting voice input
		const entitled = await entitlementStore.check('voice_transcription');
		if (!entitled) {
			setShowPaywall(true);
			return;
		}

		setIsRecording(true);
		try {
			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaRecorder = new MediaRecorder(stream);
			const audioChunks: BlobPart[] = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunks.push(event.data);
				}
			};

			mediaRecorder.onstop = async () => {
				const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
				const arrayBuffer = await audioBlob.arrayBuffer();
				const uint8Array = new Uint8Array(arrayBuffer);

				// Convert to base64
				const binaryString = Array.from(uint8Array, (byte) => String.fromCharCode(byte)).join('');
				const pcmB64 = btoa(binaryString);

				// Assume 16kHz sample rate for browser recording
				const sampleRate = 16000;

				try {
					await chatStore.sendVoice(pcmB64, sampleRate);
				} catch (e) {
					console.error('Failed to process voice input:', e);
				}

				// Cleanup
				stream.getTracks().forEach((track) => track.stop());
				setIsRecording(false);
			};

			// Record for 5 seconds max
			mediaRecorder.start();
			setTimeout(() => {
				if (mediaRecorder.state === 'recording') {
					mediaRecorder.stop();
				}
			}, 5000);
		} catch (e) {
			console.error('Failed to access microphone:', e);
			setIsRecording(false);
		}
	};

	// Handle Enter key (send on single Enter, newline on Shift+Enter)
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	// Auto-resize textarea
	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setPrompt(e.target.value);
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
		}
	};

	// Extract streaming content from the last message
	const streamingContent = chatStore.streaming && chatStore.messages.length > 0
		? chatStore.messages[chatStore.messages.length - 1].content
		: undefined;

	return (
		<div className="chat-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			{/* Chat messages area */}
			<div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
				<MessageList
					messages={chatStore.messages}
					streaming={streamingContent}
				/>
			</div>

			{/* Input composer area */}
			<div
				style={{
					borderTop: '1px solid var(--outlineVariant)',
					backgroundColor: 'var(--surface)',
					padding: '16px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
					{/* Text input with optional voice button */}
					<div style={{ position: 'relative', flex: 1 }}>
						<textarea
							ref={textareaRef}
							value={prompt}
							onChange={handleInputChange}
							onKeyDown={handleKeyDown}
							placeholder="Ask about this article..."
							disabled={chatStore.streaming}
							rows={1}
							style={{
								width: '100%',
								backgroundColor: 'var(--surfaceContainerLow)',
								border: '1px solid var(--outlineVariant)',
								borderRadius: '12px',
								padding: '12px 40px 12px 16px',
								fontSize: '14px',
								color: 'var(--onSurface)',
								resize: 'none',
								fontFamily: 'var(--font-body)',
								lineHeight: '1.5',
								maxHeight: '120px',
								overflowY: 'auto',
							}}
						/>
						{/* Voice input button */}
						<button
							onClick={handleVoiceInput}
							disabled={!voiceEnabled || isRecording || chatStore.streaming}
							title={
								!voiceEnabled
									? !hasMicrophone
										? 'Microphone not available'
										: 'Voice input requires Gemma tier'
									: 'Voice input'
							}
							style={{
								position: 'absolute',
								right: '12px',
								top: '50%',
								transform: 'translateY(-50%)',
								background: 'none',
								border: 'none',
								color: isRecording
									? 'var(--primary)'
									: voiceEnabled
										? 'var(--onSurfaceVariant)'
										: 'var(--outline)',
								cursor: voiceEnabled && !isRecording && !chatStore.streaming ? 'pointer' : 'not-allowed',
								padding: '4px',
								transition: 'color 0.2s',
							}}
						>
							<span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
								{isRecording ? 'graphic_eq' : 'mic'}
							</span>
						</button>
					</div>

					{/* Send button */}
					<button
						onClick={handleSend}
						disabled={!prompt.trim() || chatStore.streaming}
						style={{
							width: '44px',
							height: '44px',
							backgroundColor: 'var(--primary)',
							color: 'var(--onPrimary)',
							border: 'none',
							borderRadius: '12px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							cursor: !prompt.trim() || chatStore.streaming ? 'not-allowed' : 'pointer',
							opacity: !prompt.trim() || chatStore.streaming ? 0.5 : 1,
							transition: 'all 0.2s',
						}}
					>
						<span className="material-symbols-outlined">send</span>
					</button>
				</div>

				{/* Privacy assurance text */}
				<div style={{ marginTop: '12px', textAlign: 'center' }}>
					<p
						style={{
							fontSize: '10px',
							color: 'var(--outline)',
							fontFamily: 'var(--font-code)',
							textTransform: 'uppercase',
							letterSpacing: '0.1em',
							margin: 0,
						}}
					>
						Secure Local Inference • No data leaves device
					</p>
				</div>
			</div>

			{/* Paywall overlay */}
			{showPaywall && <PaywallOverlay feature="ai_chat" />}
		</div>
	);
}
