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

export interface SessionPersistor {
  onUserTurn?(turn: Turn): void | Promise<void>;
  onAssistantComplete?(
    turn: Turn,
    usage?: { promptTokens?: number; completionTokens?: number },
  ): void | Promise<void>;
}

export interface SessionInit {
  systemPrompt: string;
  provider: Provider;
  persistor?: SessionPersistor;
  /** Pre-seed turn log when resuming a conversation from storage. */
  initialTurns?: Turn[];
}

/**
 * Stateless chat session — holds the turn log, builds the message array for
 * the provider, yields assistant deltas, and invokes the optional persistor.
 */
export class ChatSession {
  readonly turns: Turn[] = [];
  private nextId = 1;

  constructor(private readonly init: SessionInit) {
    if (init.initialTurns?.length) {
      this.turns.push(...init.initialTurns);
      this.nextId = init.initialTurns.length + 1;
    }
  }

  setProvider(provider: Provider): void {
    (this.init as { provider: Provider }).provider = provider;
  }

  setSystemPrompt(prompt: string): void {
    (this.init as { systemPrompt: string }).systemPrompt = prompt;
  }

  setPersistor(persistor: SessionPersistor | undefined): void {
    (this.init as { persistor?: SessionPersistor }).persistor = persistor;
  }

  addUserTurn(content: string | ContentPart[]): Turn {
    const turn: Turn = {
      id: `u${this.nextId++}`,
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    this.turns.push(turn);
    void this.init.persistor?.onUserTurn?.(turn);
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

    let usage: { promptTokens?: number; completionTokens?: number } | undefined;

    try {
      for await (const chunk of this.init.provider.chat(messages, { signal: opts?.signal })) {
        if (chunk.delta) {
          assistantTurn.content = (assistantTurn.content as string) + chunk.delta;
        }
        if (chunk.usage) usage = chunk.usage;
        if (chunk.done) {
          assistantTurn.streaming = false;
        }
        yield chunk;
      }
    } finally {
      assistantTurn.streaming = false;
      await this.init.persistor?.onAssistantComplete?.(assistantTurn, usage);
    }
  }

  reset(): void {
    this.turns.length = 0;
    this.nextId = 1;
  }

  seed(turns: Turn[]): void {
    this.turns.length = 0;
    this.turns.push(...turns);
    this.nextId = turns.length + 1;
  }
}
