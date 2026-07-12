import type { JSX } from 'react';
import type { ChatMsg } from '../bridge';

interface MessageItemProps {
  msg: ChatMsg;
  streaming?: boolean;
}

/**
 * MessageItem component — renders a single chat message with role-aware styling.
 *
 * User messages: right-aligned, ghost (outlined/transparent background)
 * Assistant messages: left-aligned, filled (solid background)
 * Streaming: shows a blinking teal caret while generating
 * Provenance: displays "Asked about: <article>" when zim_handle is set
 */
export function MessageItem({ msg, streaming }: MessageItemProps): JSX.Element {
  const isUser = msg.role === 'user';
  const isAssistant = msg.role === 'assistant';

  return (
    <>
      {/* CSS animation for streaming caret */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>

      <div
        className={`message-item ${isUser ? 'message-user' : 'message-assistant'}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 'var(--spacing-base)',
        }}
      >
        {/* Provenance line when zim_handle is set */}
        {msg.zim_handle !== null && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--onSurfaceVariant)',
              marginBottom: '4px',
              opacity: 0.7,
            }}
          >
            Asked about: article #{msg.zim_handle}
          </div>
        )}

        {/* Message bubble */}
        <div
          className="message-bubble"
          style={{
            maxWidth: '80%',
            padding: '12px 16px',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            backgroundColor: isUser ? 'transparent' : 'var(--surfaceContainerHigh)',
            border: isUser ? '1px solid var(--outline)' : 'none',
            color: 'var(--onSurface)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            lineHeight: '1.5',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          {/* Message content */}
          <div className="message-content">{msg.content}</div>

          {/* Streaming caret for assistant messages */}
          {isAssistant && streaming && (
            <span
              className="streaming-caret"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '16px',
                backgroundColor: 'var(--primary)',
                marginLeft: '4px',
                verticalAlign: 'middle',
                animation: 'blink 1s step-end infinite',
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
