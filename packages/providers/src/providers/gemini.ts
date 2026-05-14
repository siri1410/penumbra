import type {
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ContentPart,
  Provider,
  ProviderConfig,
} from '@penumbra/types';
import { parseSseStream } from '../sse.js';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export class GeminiProvider implements Provider {
  readonly id = 'gemini' as const;
  readonly supportsVision = true;
  readonly label: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error('Gemini provider requires an API key');
    this.apiKey = config.apiKey;
    this.label = config.label;
    this.baseUrl = (config.baseUrl ?? 'https://generativelanguage.googleapis.com').replace(
      /\/+$/,
      '',
    );
    this.defaultModel = config.defaultModel || 'gemini-2.0-flash';
  }

  async *chat(messages: ChatMessage[], opts: ChatOptions = {}): AsyncIterable<ChatChunk> {
    const { systemInstruction, contents } = this.buildRequest(messages);
    const model = opts.model ?? this.defaultModel;
    const url =
      `${this.baseUrl}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent` +
      `?alt=sse&key=${encodeURIComponent(this.apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      signal: opts.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          temperature: opts.temperature,
          maxOutputTokens: opts.maxTokens,
        },
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => '')}`);
    }

    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    for await (const evt of parseSseStream(res.body)) {
      if (!evt.data) continue;
      let payload: any;
      try {
        payload = JSON.parse(evt.data);
      } catch {
        continue;
      }
      const text = payload.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text)
        .filter(Boolean)
        .join('');
      if (text) yield { delta: text };
      if (payload.usageMetadata) {
        promptTokens = payload.usageMetadata.promptTokenCount ?? promptTokens;
        completionTokens = payload.usageMetadata.candidatesTokenCount ?? completionTokens;
      }
      if (payload.candidates?.[0]?.finishReason) {
        yield { delta: '', done: true, usage: { promptTokens, completionTokens } };
      }
    }
  }

  private buildRequest(messages: ChatMessage[]): {
    systemInstruction: { parts: GeminiPart[] } | undefined;
    contents: GeminiContent[];
  } {
    let systemInstruction: { parts: GeminiPart[] } | undefined;
    const contents: GeminiContent[] = [];
    for (const m of messages) {
      if (m.role === 'system') {
        systemInstruction = {
          parts: [{ text: typeof m.content === 'string' ? m.content : partsToText(m.content) }],
        };
        continue;
      }
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts:
          typeof m.content === 'string'
            ? [{ text: m.content }]
            : partsToGemini(m.content),
      });
    }
    return { systemInstruction, contents };
  }
}

function partsToText(parts: ContentPart[]): string {
  return parts
    .filter((p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

function partsToGemini(parts: ContentPart[]): GeminiPart[] {
  return parts.map((p) =>
    p.type === 'text'
      ? { text: p.text }
      : { inlineData: { mimeType: p.mimeType, data: p.base64 } },
  );
}
