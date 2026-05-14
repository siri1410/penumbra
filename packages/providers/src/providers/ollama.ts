import type {
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ContentPart,
  Provider,
  ProviderConfig,
} from '@penumbra/types';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export class OllamaProvider implements Provider {
  readonly id = 'ollama' as const;
  readonly supportsVision = true;
  readonly label: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: ProviderConfig) {
    this.label = config.label;
    this.baseUrl = (config.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
    this.defaultModel = config.defaultModel || 'llama3.2-vision';
  }

  async *chat(messages: ChatMessage[], opts: ChatOptions = {}): AsyncIterable<ChatChunk> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      signal: opts.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: opts.model ?? this.defaultModel,
        messages: messages.map(toOllamaMessage),
        stream: true,
        options: {
          temperature: opts.temperature,
          num_predict: opts.maxTokens,
        },
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Ollama ${res.status}: ${await res.text().catch(() => '')}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let payload: any;
          try {
            payload = JSON.parse(line);
          } catch {
            continue;
          }
          const text = payload.message?.content;
          if (typeof text === 'string' && text.length > 0) yield { delta: text };
          if (payload.done) {
            yield {
              delta: '',
              done: true,
              usage: {
                promptTokens: payload.prompt_eval_count,
                completionTokens: payload.eval_count,
              },
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

function toOllamaMessage(m: ChatMessage): OllamaMessage {
  if (typeof m.content === 'string') return { role: m.role, content: m.content };
  const text = (m.content as ContentPart[])
    .filter((p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
  const images = (m.content as ContentPart[])
    .filter((p): p is Extract<ContentPart, { type: 'image' }> => p.type === 'image')
    .map((p) => p.base64);
  return { role: m.role, content: text, images: images.length ? images : undefined };
}
