import type Database from 'better-sqlite3';
import { ulid } from '../ulid.js';

export interface ConversationRow {
  id: string;
  title: string;
  provider_id: string | null;
  model: string | null;
  pinned: number;
  archived: number;
  created_at: number;
  updated_at: number;
}

export interface ConversationListItem extends ConversationRow {
  last_message_preview: string | null;
}

export interface ConversationsRepo {
  create(input: { providerId?: string; model?: string; title?: string }): ConversationRow;
  list(opts?: { includeArchived?: boolean; limit?: number }): ConversationListItem[];
  get(id: string): ConversationRow | null;
  rename(id: string, title: string): void;
  touch(id: string): void;
  setArchived(id: string, archived: boolean): void;
  delete(id: string): void;
  deleteAll(): void;
}

export function createConversationsRepo(db: Database.Database): ConversationsRepo {
  const insert = db.prepare(
    `INSERT INTO conversations (id, title, provider_id, model, pinned, archived, created_at, updated_at)
     VALUES (@id, @title, @provider_id, @model, 0, 0, @created_at, @updated_at)`,
  );

  const selectList = db.prepare<[number], ConversationListItem>(`
    SELECT c.*,
      (SELECT substr(m.content, 1, 200)
         FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1) AS last_message_preview
      FROM conversations c
     WHERE c.archived = 0
     ORDER BY c.updated_at DESC
     LIMIT ?
  `);

  const selectListWithArchived = db.prepare<[number], ConversationListItem>(`
    SELECT c.*,
      (SELECT substr(m.content, 1, 200)
         FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1) AS last_message_preview
      FROM conversations c
     ORDER BY c.updated_at DESC
     LIMIT ?
  `);

  const selectOne = db.prepare<[string], ConversationRow>(
    'SELECT * FROM conversations WHERE id = ?',
  );

  const updateTitle = db.prepare(
    'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
  );
  const touch = db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?');
  const setArchived = db.prepare(
    'UPDATE conversations SET archived = ?, updated_at = ? WHERE id = ?',
  );
  const remove = db.prepare('DELETE FROM conversations WHERE id = ?');
  const removeAll = db.prepare('DELETE FROM conversations');

  return {
    create({ providerId, model, title }) {
      const now = Date.now();
      const id = ulid(now);
      insert.run({
        id,
        title: title ?? 'New conversation',
        provider_id: providerId ?? null,
        model: model ?? null,
        created_at: now,
        updated_at: now,
      });
      return selectOne.get(id)!;
    },
    list({ includeArchived = false, limit = 200 } = {}) {
      const stmt = includeArchived ? selectListWithArchived : selectList;
      return stmt.all(limit);
    },
    get(id) {
      return selectOne.get(id) ?? null;
    },
    rename(id, title) {
      updateTitle.run(title, Date.now(), id);
    },
    touch(id) {
      touch.run(Date.now(), id);
    },
    setArchived(id, archived) {
      setArchived.run(archived ? 1 : 0, Date.now(), id);
    },
    delete(id) {
      remove.run(id);
    },
    deleteAll() {
      removeAll.run();
    },
  };
}
