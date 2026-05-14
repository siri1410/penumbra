import type {
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ContentPart,
  Provider,
  ProviderConfig,
  ProviderId,
} from '@penumbra/types';
import { parseSseStream } from '../sse.js';

interface OpenAIPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIPart[];
}

export class OpenAIProvider implements Provider {
  readonly id: ProviderId = 'openai';
  readonly supportsVision = true;
  readonly label: string;
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly defaultModel: string;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error('OpenAI provider requires an API key');
    this.apiKey = config.apiKey;
    this.label = config.label;
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.defaultModel = config.defaultModel || 'gpt-4o';
  }

  async *chat(messages: ChatMessage[], opts: ChatOptions = {}): AsyncIterable<ChatChunk> {
    const body = {
      model: opts.model ?? this.defaultModel,
      messages: messages.map((m) => toOpenAIMessage(m)),
      stream: true,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream_options: { include_usage: true },
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: opts.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw new Error(`OpenAI ${res.status}: ${await res.text().catch(() => '')}`);
    }

    for await (const evt of parseSseStream(res.body)) {
      if (!evt.data || evt.data === '[DONE]') continue;
      let payload: any;
      try {
        payload = JSON.parse(evt.data);
      } catch {
        continue;
      }
      const choice = payload.choices?.[0];
      const delta = choice?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        yield { delta };
      }
      if (choice?.finish_reason) {
        yield {
          delta: '',
          done: true,
          usage: payload.usage
            ? {
                promptTokens: payload.usage.prompt_tokens,
                completionTokens: payload.usage.completion_tokens,
              }
            : undefined,
        };
      }
    }
  }
}

export function toOpenAIMessage(m: ChatMessage): OpenAIMessage {
  if (typeof m.content === 'string') return { role: m.role, content: m.content };
  return { role: m.role, content: partsToOpenAI(m.content) };
}

function partsToOpenAI(parts: ContentPart[]): OpenAIPart[] {
  return parts.map((p) =>
    p.type === 'text'
      ? { type: 'text', text: p.text }
      : { type: 'image_url', image_url: { url: `data:${p.mimeType};base64,${p.base64}` } },
  );
}
