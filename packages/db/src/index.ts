import { createRequire } from 'node:module';
import type Database from 'better-sqlite3';
import { runMigrations } from './migrations.js';

const require = createRequire(import.meta.url);
const BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3');
import { createConfigRepo, type ConfigRepo } from './repos/config.js';
import { createProvidersRepo, type ProvidersRepo } from './repos/providers.js';
import {
  createConversationsRepo,
  type ConversationsRepo,
  type ConversationRow,
  type ConversationListItem,
} from './repos/conversations.js';
import {
  createMessagesRepo,
  type MessagesRepo,
  type MessageRow,
  deserializeContent,
} from './repos/messages.js';

export interface PenumbraDb {
  raw: Database.Database;
  config: ConfigRepo;
  providers: ProvidersRepo;
  conversations: ConversationsRepo;
  messages: MessagesRepo;
  close(): void;
}

export interface OpenDbOptions {
  /** Disable WAL mode (default: WAL on). */
  noWal?: boolean;
}

export function openDb(path: string, opts: OpenDbOptions = {}): PenumbraDb {
  const db = new BetterSqlite3(path);
  db.pragma('foreign_keys = ON');
  if (!opts.noWal) {
    db.pragma('journal_mode = WAL');
  }

  runMigrations(db);

  return {
    raw: db,
    config: createConfigRepo(db),
    providers: createProvidersRepo(db),
    conversations: createConversationsRepo(db),
    messages: createMessagesRepo(db),
    close: () => db.close(),
  };
}

export { deserializeContent };
export type { ConversationRow, ConversationListItem, MessageRow };
export type { ProvidersRepo, ConversationsRepo, MessagesRepo, ConfigRepo };
