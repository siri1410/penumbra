import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE config (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE providers (
          id            TEXT PRIMARY KEY,
          label         TEXT NOT NULL,
          base_url      TEXT,
          default_model TEXT NOT NULL,
          models        TEXT,
          updated_at    INTEGER NOT NULL
        );

        CREATE TABLE conversations (
          id          TEXT PRIMARY KEY,
          title       TEXT NOT NULL DEFAULT 'New conversation',
          provider_id TEXT,
          model       TEXT,
          pinned      INTEGER NOT NULL DEFAULT 0,
          archived    INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );

        CREATE TABLE messages (
          id                TEXT PRIMARY KEY,
          conversation_id   TEXT NOT NULL,
          role              TEXT NOT NULL,
          content           TEXT NOT NULL,
          prompt_tokens     INTEGER,
          completion_tokens INTEGER,
          created_at        INTEGER NOT NULL,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE INDEX messages_conv_idx ON messages(conversation_id, created_at);
        CREATE INDEX conversations_updated_idx ON conversations(updated_at DESC) WHERE archived = 0;
      `);
    },
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name    TEXT    NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set<number>(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version,
    ),
  );

  const insert = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    const tx = db.transaction(() => {
      m.up(db);
      insert.run(m.version, m.name, Date.now());
    });
    tx();
  }
}
