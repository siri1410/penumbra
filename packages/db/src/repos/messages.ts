import type Database from 'better-sqlite3';
import type { ContentPart } from '@penumbra/types';
import { ulid } from '../ulid.js';

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: number;
}

export interface AppendInput {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string | ContentPart[];
  promptTokens?: number;
  completionTokens?: number;
}

export interface MessagesRepo {
  list(conversationId: string): MessageRow[];
  append(input: AppendInput): MessageRow;
  update(id: string, patch: { content?: string | ContentPart[]; promptTokens?: number; completionTokens?: number }): void;
  count(conversationId: string): number;
}

function serializeContent(content: string | ContentPart[]): string {
  return typeof content === 'string' ? JSON.stringify({ t: 'text', v: content }) : JSON.stringify({ t: 'parts', v: content });
}

export function deserializeContent(raw: string): string | ContentPart[] {
  try {
    const obj = JSON.parse(raw) as { t: 'text' | 'parts'; v: unknown };
    if (obj.t === 'text') return obj.v as string;
    return obj.v as ContentPart[];
  } catch {
    return raw;
  }
}

export function createMessagesRepo(db: Database.Database): MessagesRepo {
  const selectByConv = db.prepare<[string], MessageRow>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
  );
  const insert = db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, prompt_tokens, completion_tokens, created_at)
     VALUES (@id, @conversation_id, @role, @content, @prompt_tokens, @completion_tokens, @created_at)`,
  );
  const selectOne = db.prepare<[string], MessageRow>('SELECT * FROM messages WHERE id = ?');
  const updateContent = db.prepare(
    `UPDATE messages SET content = ?, prompt_tokens = ?, completion_tokens = ? WHERE id = ?`,
  );
  const countByConv = db.prepare<[string], { c: number }>(
    'SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ?',
  );
  const touchConv = db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?');

  return {
    list(conversationId) {
      return selectByConv.all(conversationId);
    },

    append(input) {
      const now = Date.now();
      const id = ulid(now);
      const tx = db.transaction(() => {
        insert.run({
          id,
          conversation_id: input.conversationId,
          role: input.role,
          content: serializeContent(input.content),
          prompt_tokens: input.promptTokens ?? null,
          completion_tokens: input.completionTokens ?? null,
          created_at: now,
        });
        touchConv.run(now, input.conversationId);
      });
      tx();
      return selectOne.get(id)!;
    },

    update(id, patch) {
      const current = selectOne.get(id);
      if (!current) return;
      const newContent =
        patch.content !== undefined ? serializeContent(patch.content) : current.content;
      const newPrompt = patch.promptTokens ?? current.prompt_tokens;
      const newCompletion = patch.completionTokens ?? current.completion_tokens;
      const tx = db.transaction(() => {
        updateContent.run(newContent, newPrompt, newCompletion, id);
        touchConv.run(Date.now(), current.conversation_id);
      });
      tx();
    },

    count(conversationId) {
      return countByConv.get(conversationId)?.c ?? 0;
    },
  };
}
