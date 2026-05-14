import type {
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ContentPart,
  Provider,
  ProviderConfig,
} from '@penumbra/types';
import { parseSseStream } from '../sse.js';

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
interface AnthropicImageBlock {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
}
type AnthropicBlock = AnthropicTextBlock | AnthropicImageBlock;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicBlock[];
}

export class AnthropicProvider implements Provider {
  readonly id = 'anthropic' as const;
  readonly supportsVision = true;
  readonly label: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error('Anthropic provider requires an API key');
    this.apiKey = config.apiKey;
    this.label = config.label;
    this.baseUrl = (config.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
    this.defaultModel = config.defaultModel || 'claude-opus-4-7';
  }

  async *chat(messages: ChatMessage[], opts: ChatOptions = {}): AsyncIterable<ChatChunk> {
    const { systemPrompt, body } = this.buildRequest(messages, opts);

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      signal: opts.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature,
        stream: true,
        system: systemPrompt,
        messages: body,
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Anthropic ${res.status}: ${await res.text().catch(() => '')}`);
    }

    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    for await (const evt of parseSseStream(res.body)) {
      if (!evt.data || evt.data === '[DONE]') continue;
      let payload: any;
      try {
        payload = JSON.parse(evt.data);
      } catch {
        continue;
      }
      if (payload.type === 'content_block_delta' && payload.delta?.type === 'text_delta') {
        yield { delta: payload.delta.text };
      } else if (payload.type === 'message_delta' && payload.usage) {
        completionTokens = payload.usage.output_tokens ?? completionTokens;
      } else if (payload.type === 'message_start' && payload.message?.usage) {
        promptTokens = payload.message.usage.input_tokens ?? promptTokens;
      } else if (payload.type === 'message_stop') {
        yield { delta: '', done: true, usage: { promptTokens, completionTokens } };
      }
    }
  }

  private buildRequest(
    messages: ChatMessage[],
    _opts: ChatOptions,
  ): { systemPrompt: string | undefined; body: AnthropicMessage[] } {
    let systemPrompt: string | undefined;
    const body: AnthropicMessage[] = [];

    for (const m of messages) {
      if (m.role === 'system') {
        systemPrompt = typeof m.content === 'string' ? m.content : partsToText(m.content);
        continue;
      }
      body.push({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : partsToAnthropic(m.content),
      });
    }
    return { systemPrompt, body };
  }
}

function partsToText(parts: ContentPart[]): string {
  return parts
    .filter((p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

function partsToAnthropic(parts: ContentPart[]): AnthropicBlock[] {
  return parts.map((p) => {
    if (p.type === 'text') return { type: 'text', text: p.text };
    return {
      type: 'image',
      source: { type: 'base64', media_type: p.mimeType, data: p.base64 },
    };
  });
}
