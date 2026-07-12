import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import type { ChatMsg } from '../bridge';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: ChatMsg[];
  streaming?: string;
}

/**
 * MessageList component — scrolling list of ChatMsg rows with auto-scroll.
 *
 * - Renders MessageItem for each settled message
 * - Shows a live streaming bubble for in-flight assistant content
 * - Auto-scrolls to keep the latest message in sight
 *
 * Integrates the notebook column of Stitch screen 04-reader.
 */
export function MessageList({ messages, streaming }: MessageListProps): JSX.Element {
  const listEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message when messages or streaming content changes
  useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streaming]);

  return (
    <div className="message-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', padding: '16px' }}>
      {/* Render settled messages */}
      {messages.map((msg) => (
        <MessageItem key={msg.id} msg={msg} />
      ))}

      {/* Render live streaming bubble if streaming content exists */}
      {streaming && streaming.length > 0 && (
        <MessageItem
          msg={{
            id: -1, // Temporary ID for streaming bubble
            session: messages[messages.length - 1]?.session ?? 0,
            role: 'assistant',
            content: streaming,
            zim_handle: null,
            ts: Date.now(),
          }}
          streaming={true}
        />
      )}

      {/* Anchor for auto-scroll */}
      <div ref={listEndRef} />
    </div>
  );
}
