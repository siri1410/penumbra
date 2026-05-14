import type {
  ChatChunk,
  ChatMessage,
  ContentPart,
  Provider,
} from '@penumbra/types';

export interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string | ContentPart[];
  /** Streaming-in-progress flag; assistant turns flip to false on completion. */
  streaming?: boolean;
  createdAt: number;
}

export interface SessionInit {
  systemPrompt: string;
  provider: Provider;
}

/**
 * Stateless chat session — holds the turn log, builds the message array for
 * the provider, and yields assistant deltas to whoever is rendering.
 *
 * Intentionally framework-agnostic so the same session class powers the
 * Electron renderer, tests, and (eventually) a CLI.
 */
export class ChatSession {
  readonly turns: Turn[] = [];
  private nextId = 1;

  constructor(private readonly init: SessionInit) {}

  setProvider(provider: Provider): void {
    (this.init as { provider: Provider }).provider = provider;
  }

  setSystemPrompt(prompt: string): void {
    (this.init as { systemPrompt: string }).systemPrompt = prompt;
  }

  addUserTurn(content: string | ContentPart[]): Turn {
    const turn: Turn = {
      id: `u${this.nextId++}`,
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    this.turns.push(turn);
    return turn;
  }

  async *streamAssistant(opts?: { signal?: AbortSignal }): AsyncIterable<ChatChunk> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.init.systemPrompt },
      ...this.turns.map((t) => ({ role: t.role, content: t.content })),
    ];

    const assistantTurn: Turn = {
      id: `a${this.nextId++}`,
      role: 'assistant',
      content: '',
      streaming: true,
      createdAt: Date.now(),
    };
    this.turns.push(assistantTurn);

    try {
      for await (const chunk of this.init.provider.chat(messages, { signal: opts?.signal })) {
        if (chunk.delta) {
          assistantTurn.content = (assistantTurn.content as string) + chunk.delta;
        }
        if (chunk.done) {
          assistantTurn.streaming = false;
        }
        yield chunk;
      }
    } finally {
      assistantTurn.streaming = false;
    }
  }

  reset(): void {
    this.turns.length = 0;
    this.nextId = 1;
  }
}
