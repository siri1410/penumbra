import type { AppConfig, ContentPart } from '@penumbra/types';
import { DEFAULT_CONFIG } from '@penumbra/core';

export interface ScreenshotPayload {
  base64: string;
  mimeType: 'image/png';
}

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
  screenshot: { capture(): Promise<ScreenshotPayload> };
  window: { hide(): Promise<void>; close(): Promise<void> };
  conversations: {
    list(): Promise<ConversationSummary[]>;
    create(input?: {
      providerId?: string;
      model?: string;
      title?: string;
    }): Promise<ConversationSummary>;
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
  on(event: 'capture', handler: (shot: ScreenshotPayload) => void): void;
  on(event: 'focus-chat', handler: () => void): void;
  on(event: 'open-settings', handler: () => void): void;
}

declare global {
  interface Window {
    penumbra?: PenumbraBridge;
  }
}

export const isElectron = typeof window !== 'undefined' && Boolean(window.penumbra);

// ── Browser fallback ───────────────────────────────────────────────────────

function shortId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function previewFromContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content.slice(0, 200);
  const text = content.find((p) => p.type === 'text');
  return text && text.type === 'text' ? text.text.slice(0, 200) : '[image]';
}

function createBrowserBridge(): PenumbraBridge {
  const CONFIG_KEY = 'penumbra.config';
  const SECRETS_KEY = 'penumbra.secrets';
  const CONVS_KEY = 'penumbra.conversations';
  const MSGS_KEY = (id: string) => `penumbra.messages.${id}`;

  const readConfig = (): AppConfig => {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return DEFAULT_CONFIG;
      return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<AppConfig>) };
    } catch {
      return DEFAULT_CONFIG;
    }
  };
  const writeConfig = (cfg: AppConfig) => localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));

  const readSecrets = (): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem(SECRETS_KEY) ?? '{}') as Record<string, string>;
    } catch {
      return {};
    }
  };
  const writeSecrets = (bag: Record<string, string>) =>
    localStorage.setItem(SECRETS_KEY, JSON.stringify(bag));

  const readConvs = (): ConversationSummary[] => {
    try {
      return JSON.parse(localStorage.getItem(CONVS_KEY) ?? '[]') as ConversationSummary[];
    } catch {
      return [];
    }
  };
  const writeConvs = (list: ConversationSummary[]) =>
    localStorage.setItem(CONVS_KEY, JSON.stringify(list));

  const readMessages = (id: string): PersistedMessage[] => {
    try {
      return JSON.parse(localStorage.getItem(MSGS_KEY(id)) ?? '[]') as PersistedMessage[];
    } catch {
      return [];
    }
  };
  const writeMessages = (id: string, msgs: PersistedMessage[]) =>
    localStorage.setItem(MSGS_KEY(id), JSON.stringify(msgs));

  const touchConv = (id: string) => {
    const list = readConvs();
    const idx = list.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const item = list[idx]!;
    list[idx] = { ...item, updated_at: Date.now() };
    list.sort((a, b) => b.updated_at - a.updated_at);
    writeConvs(list);
  };

  return {
    config: {
      get: async () => readConfig(),
      set: async (partial) => {
        const next: AppConfig = {
          ...readConfig(),
          ...partial,
          hotkeys: { ...readConfig().hotkeys, ...(partial.hotkeys ?? {}) },
          providers: { ...readConfig().providers, ...(partial.providers ?? {}) },
        };
        writeConfig(next);
        return next;
      },
      setSecret: async (key, value) => {
        const bag = readSecrets();
        bag[key] = value;
        writeSecrets(bag);
      },
      getSecret: async (key) => readSecrets()[key] ?? null,
    },
    screenshot: {
      capture: async () => {
        throw new Error(
          'Screenshots require Electron. Launch via `pnpm dev` and use the desktop window.',
        );
      },
    },
    window: {
      hide: async () => {},
      close: async () => {},
    },
    conversations: {
      list: async () =>
        readConvs()
          .filter((c) => c.archived === 0)
          .sort((a, b) => b.updated_at - a.updated_at),
      create: async (input) => {
        const now = Date.now();
        const conv: ConversationSummary = {
          id: shortId('c'),
          title: input?.title ?? 'New conversation',
          model: input?.model ?? null,
          provider_id: input?.providerId ?? null,
          pinned: 0,
          archived: 0,
          created_at: now,
          updated_at: now,
          last_message_preview: null,
        };
        const list = readConvs();
        list.unshift(conv);
        writeConvs(list);
        writeMessages(conv.id, []);
        return conv;
      },
      load: async (id) => {
        const conv = readConvs().find((c) => c.id === id);
        if (!conv) return null;
        const { last_message_preview: _drop, ...rest } = conv;
        return { conversation: rest, messages: readMessages(id) };
      },
      rename: async (id, title) => {
        const list = readConvs();
        const i = list.findIndex((c) => c.id === id);
        if (i < 0) return;
        list[i] = { ...list[i]!, title, updated_at: Date.now() };
        writeConvs(list);
      },
      delete: async (id) => {
        writeConvs(readConvs().filter((c) => c.id !== id));
        localStorage.removeItem(MSGS_KEY(id));
      },
      deleteAll: async () => {
        for (const c of readConvs()) localStorage.removeItem(MSGS_KEY(c.id));
        writeConvs([]);
      },
    },
    messages: {
      append: async (input) => {
        const msg: PersistedMessage = {
          id: shortId('m'),
          role: input.role,
          content: input.content,
          createdAt: Date.now(),
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
        };
        const msgs = readMessages(input.conversationId);
        msgs.push(msg);
        writeMessages(input.conversationId, msgs);

        // Update conversation preview + ordering
        const list = readConvs();
        const idx = list.findIndex((c) => c.id === input.conversationId);
        if (idx >= 0) {
          list[idx] = {
            ...list[idx]!,
            last_message_preview: previewFromContent(input.content),
            updated_at: Date.now(),
          };
          list.sort((a, b) => b.updated_at - a.updated_at);
          writeConvs(list);
        }
        return msg;
      },
      update: async (id, patch) => {
        // Find which conv owns this message
        for (const c of readConvs()) {
          const msgs = readMessages(c.id);
          const i = msgs.findIndex((m) => m.id === id);
          if (i < 0) continue;
          msgs[i] = {
            ...msgs[i]!,
            ...(patch.content !== undefined ? { content: patch.content } : {}),
            ...(patch.promptTokens !== undefined ? { promptTokens: patch.promptTokens } : {}),
            ...(patch.completionTokens !== undefined
              ? { completionTokens: patch.completionTokens }
              : {}),
          };
          writeMessages(c.id, msgs);
          touchConv(c.id);
          return;
        }
      },
    },
    on: () => {},
  };
}

export const bridge: PenumbraBridge = window.penumbra ?? createBrowserBridge();
