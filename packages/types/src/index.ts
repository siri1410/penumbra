export type Role = 'system' | 'user' | 'assistant';

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  /** Raw base64-encoded image bytes (no data: prefix). */
  base64: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export type ContentPart = TextPart | ImagePart;

export interface ChatMessage {
  role: Role;
  content: string | ContentPart[];
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  signal?: AbortSignal;
}

export interface ChatChunk {
  /** Incremental text delta. */
  delta: string;
  /** Set on the final chunk. */
  done?: boolean;
  /** Usage info, set on final chunk when available. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'ollama'
  | 'openai-compatible';

export interface ProviderConfig {
  id: ProviderId;
  /** Display label shown in UI. For openai-compatible, user-supplied. */
  label: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  /** Optional models hint for UI dropdowns. */
  models?: string[];
}

export interface Provider {
  readonly id: ProviderId;
  readonly label: string;
  readonly supportsVision: boolean;
  chat(messages: ChatMessage[], opts?: ChatOptions): AsyncIterable<ChatChunk>;
}

export interface AppConfig {
  activeProviderId: ProviderId | null;
  providers: Record<string, ProviderConfig>;
  hotkeys: {
    toggle: string;
    capture: string;
    focusChat: string;
    settings: string;
  };
  systemPrompt: string;
  autoDeleteScreenshots: boolean;
}
