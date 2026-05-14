import type Database from 'better-sqlite3';
import type { ProviderConfig, ProviderId } from '@penumbra/types';

interface ProviderRow {
  id: string;
  label: string;
  base_url: string | null;
  default_model: string;
  models: string | null;
  updated_at: number;
}

function rowToConfig(row: ProviderRow): ProviderConfig {
  return {
    id: row.id as ProviderId,
    label: row.label,
    baseUrl: row.base_url ?? undefined,
    defaultModel: row.default_model,
    models: row.models ? (JSON.parse(row.models) as string[]) : undefined,
  };
}

export interface ProvidersRepo {
  list(): ProviderConfig[];
  get(id: ProviderId): ProviderConfig | null;
  upsert(cfg: ProviderConfig): void;
  delete(id: ProviderId): void;
}

export function createProvidersRepo(db: Database.Database): ProvidersRepo {
  const selectAll = db.prepare<[], ProviderRow>('SELECT * FROM providers ORDER BY id');
  const selectOne = db.prepare<[string], ProviderRow>('SELECT * FROM providers WHERE id = ?');
  const upsert = db.prepare(
    `INSERT INTO providers (id, label, base_url, default_model, models, updated_at)
     VALUES (@id, @label, @base_url, @default_model, @models, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       label = excluded.label,
       base_url = excluded.base_url,
       default_model = excluded.default_model,
       models = excluded.models,
       updated_at = excluded.updated_at`,
  );
  const remove = db.prepare('DELETE FROM providers WHERE id = ?');

  return {
    list() {
      return selectAll.all().map(rowToConfig);
    },
    get(id) {
      const row = selectOne.get(id);
      return row ? rowToConfig(row) : null;
    },
    upsert(cfg) {
      upsert.run({
        id: cfg.id,
        label: cfg.label,
        base_url: cfg.baseUrl ?? null,
        default_model: cfg.defaultModel,
        models: cfg.models ? JSON.stringify(cfg.models) : null,
        updated_at: Date.now(),
      });
    },
    delete(id) {
      remove.run(id);
    },
  };
}
