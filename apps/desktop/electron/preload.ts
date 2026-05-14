import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, ContentPart } from '@penumbra/types';

export interface ConversationSummary {
  id: string;
  title: string;
  model: string | null;
  provider_id: string | null;
  pinned: number;
  archived: number;
  created_at: number;
  updated_at: number;
  last_message_preview: string | null;
}

export interface PersistedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string | ContentPart[];
  createdAt: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ConversationLoadResult {
  conversation: Omit<ConversationSummary, 'last_message_preview'>;
  messages: PersistedMessage[];
}

export interface PenumbraBridge {
  config: {
    get(): Promise<AppConfig>;
    set(partial: Partial<AppConfig>): Promise<AppConfig>;
    setSecret(key: string, value: string): Promise<void>;
    getSecret(key: string): Promise<string | null>;
  };
  screenshot: {
    capture(): Promise<{ base64: string; mimeType: 'image/png' }>;
  };
  window: {
    hide(): Promise<void>;
    close(): Promise<void>;
  };
  conversations: {
    list(): Promise<ConversationSummary[]>;
    create(input?: { providerId?: string; model?: string; title?: string }): Promise<ConversationSummary>;
    load(id: string): Promise<ConversationLoadResult | null>;
    rename(id: string, title: string): Promise<void>;
    delete(id: string): Promise<void>;
    deleteAll(): Promise<void>;
  };
  messages: {
    append(input: {
      conversationId: string;
      role: 'user' | 'assistant';
      content: string | ContentPart[];
      promptTokens?: number;
      completionTokens?: number;
    }): Promise<PersistedMessage>;
    update(
      id: string,
      patch: {
        content?: string | ContentPart[];
        promptTokens?: number;
        completionTokens?: number;
      },
    ): Promise<void>;
  };
  on(event: 'capture', handler: (shot: { base64: string; mimeType: 'image/png' }) => void): void;
  on(event: 'focus-chat', handler: () => void): void;
  on(event: 'open-settings', handler: () => void): void;
}

const bridge: PenumbraBridge = {
  config: {
    get: () => ipcRenderer.invoke('penumbra:config:get'),
    set: (partial) => ipcRenderer.invoke('penumbra:config:set', partial),
    setSecret: (key, value) => ipcRenderer.invoke('penumbra:config:secret:set', key, value),
    getSecret: (key) => ipcRenderer.invoke('penumbra:config:secret:get', key),
  },
  screenshot: {
    capture: () => ipcRenderer.invoke('penumbra:screenshot:capture'),
  },
  window: {
    hide: () => ipcRenderer.invoke('penumbra:window:hide'),
    close: () => ipcRenderer.invoke('penumbra:window:close'),
  },
  conversations: {
    list: () => ipcRenderer.invoke('penumbra:conversation:list'),
    create: (input) => ipcRenderer.invoke('penumbra:conversation:create', input),
    load: (id) => ipcRenderer.invoke('penumbra:conversation:load', id),
    rename: (id, title) => ipcRenderer.invoke('penumbra:conversation:rename', id, title),
    delete: (id) => ipcRenderer.invoke('penumbra:conversation:delete', id),
    deleteAll: () => ipcRenderer.invoke('penumbra:conversation:deleteAll'),
  },
  messages: {
    append: (input) => ipcRenderer.invoke('penumbra:message:append', input),
    update: (id, patch) => ipcRenderer.invoke('penumbra:message:update', id, patch),
  },
  on: (event, handler) => {
    const channel = `penumbra:${event}`;
    ipcRenderer.on(channel, (_e, payload) => (handler as (p: unknown) => void)(payload));
  },
};

contextBridge.exposeInMainWorld('penumbra', bridge);
