import type Database from 'better-sqlite3';

export interface ConfigRepo {
  getAll(): Record<string, unknown>;
  get<T = unknown>(key: string): T | null;
  set(key: string, value: unknown): void;
  setMany(entries: Record<string, unknown>): void;
}

export function createConfigRepo(db: Database.Database): ConfigRepo {
  const selectAll = db.prepare<[], { key: string; value: string }>('SELECT key, value FROM config');
  const selectOne = db.prepare<[string], { value: string }>(
    'SELECT value FROM config WHERE key = ?',
  );
  const upsert = db.prepare(
    `INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );

  return {
    getAll(): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const row of selectAll.all()) {
        try {
          out[row.key] = JSON.parse(row.value);
        } catch {
          out[row.key] = row.value;
        }
      }
      return out;
    },

    get<T = unknown>(key: string): T | null {
      const row = selectOne.get(key);
      if (!row) return null;
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return row.value as unknown as T;
      }
    },

    set(key: string, value: unknown): void {
      upsert.run(key, JSON.stringify(value), Date.now());
    },

    setMany(entries: Record<string, unknown>): void {
      const tx = db.transaction((batch: Record<string, unknown>) => {
        const now = Date.now();
        for (const [k, v] of Object.entries(batch)) upsert.run(k, JSON.stringify(v), now);
      });
      tx(entries);
    },
  };
}
