import { create } from 'zustand';
import type { ChatMsg } from '../bridge';
import { chatHistoryList, chatHistoryAppend, chatHistoryClear, aiChatStream, aiVoiceChat } from '../bridge';

// E-FE-24: Chat-state Zustand hook bound to bridge
export interface ChatStore {
  messages: ChatMsg[];
  sessionId: number | null;
  zimHandle: number | null;
  streaming: boolean;
  loadMessages: () => Promise<void>;
  sendStream: (prompt: string) => Promise<void>;
  sendVoice: (pcmB64: string, sr: number) => Promise<void>;
  clearMessages: () => Promise<void>;
}

const store = create<ChatStore>((set, get) => ({
  messages: [],
  sessionId: null,
  zimHandle: null,
  streaming: false,

  loadMessages: async () => {
    const { sessionId } = get();
    try {
      const messages = await chatHistoryList(sessionId);
      set({ messages });
    } catch (e) {
      throw e;
    }
  },

  sendStream: async (prompt: string) => {
    const { zimHandle, sessionId } = get();
    set({ streaming: true });

    // Create a live assistant message for accumulation
    const assistantMsg: ChatMsg = {
      id: 0, // Placeholder ID until persisted
      session: sessionId ?? 0,
      role: 'assistant',
      content: '',
      zim_handle: zimHandle,
      ts: Date.now(),
    };

    // Add the live assistant message to the UI immediately
    set((state) => ({ messages: [...state.messages, assistantMsg] }));

    let accumulatedContent = '';

    try {
      // Stream tokens from bridge, accumulating into the live message
      await aiChatStream(prompt, zimHandle, (token: string) => {
        accumulatedContent += token;
        set((state) => {
          const updated = [...state.messages];
          // Update the last message (the live assistant message)
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: accumulatedContent,
            };
          }
          return { messages: updated };
        });
      });

      // Persist both turns after streaming completes
      await chatHistoryAppend('user', prompt, zimHandle);
      await chatHistoryAppend('assistant', accumulatedContent, zimHandle);

      // Reload messages to get persisted state with correct IDs
      const messages = await chatHistoryList(sessionId);
      set({ messages, streaming: false });
    } catch (e) {
      set({ streaming: false });
      throw e;
    }
  },

  sendVoice: async (pcmB64: string, sr: number) => {
    const { zimHandle, sessionId } = get();
    set({ streaming: true });

    try {
      // Call bridge.aiVoiceChat
      const reply = await aiVoiceChat(pcmB64, sr, zimHandle);

      // Persist both turns
      await chatHistoryAppend('user', `[voice input: ${sr} Hz PCM]`, zimHandle);
      await chatHistoryAppend('assistant', reply, zimHandle);

      // Reload messages to get persisted state
      const messages = await chatHistoryList(sessionId);
      set({ messages, streaming: false });
    } catch (e) {
      set({ streaming: false });
      throw e;
    }
  },

  clearMessages: async () => {
    const { sessionId } = get();
    try {
      await chatHistoryClear(sessionId);
      set({ messages: [] });
    } catch (e) {
      throw e;
    }
  },
}));

export function useChatStore(): ChatStore {
  return store();
}
