import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig, ProviderConfig, ProviderId } from '@penumbra/types';
import { DEFAULT_CONFIG } from '@penumbra/core';
import { openDb, type PenumbraDb } from '@penumbra/db';

/**
 * SQLite-backed local datastore.
 *
 * - All app state (config, providers, conversations, messages) lives in
 *   `userData/penumbra.db` so users have one private, portable file.
 * - API keys stay in `userData/secrets.bin`, encrypted via Electron
 *   `safeStorage` (OS keychain). We intentionally do NOT put plaintext or
 *   weakly-protected secrets in the SQLite file.
 * - On first launch of v0.2, if a legacy `config.json` exists it's imported
 *   into the new tables and renamed `.migrated-<ts>.bak`.
 */
export class DataStore {
  readonly db: PenumbraDb;
  private readonly secretsPath: string;
  private readonly legacyConfigPath: string;

  constructor() {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    this.secretsPath = path.join(dir, 'secrets.bin');
    this.legacyConfigPath = path.join(dir, 'config.json');
    const dbPath = path.join(dir, 'penumbra.db');
    this.db = openDb(dbPath);

    this.migrateLegacyConfigJson();
  }

  // ── Config ─────────────────────────────────────────────────────────────

  readConfig(): AppConfig {
    const bag = this.db.config.getAll();
    const providers = Object.fromEntries(
      this.db.providers.list().map((p) => [p.id, p] as const),
    );
    return {
      activeProviderId:
        (bag.activeProviderId as ProviderId | null | undefined) ?? DEFAULT_CONFIG.activeProviderId,
      providers,
      hotkeys: {
        ...DEFAULT_CONFIG.hotkeys,
        ...((bag.hotkeys as Partial<AppConfig['hotkeys']> | undefined) ?? {}),
      },
      systemPrompt: (bag.systemPrompt as string | undefined) ?? DEFAULT_CONFIG.systemPrompt,
      autoDeleteScreenshots:
        (bag.autoDeleteScreenshots as boolean | undefined) ?? DEFAULT_CONFIG.autoDeleteScreenshots,
    };
  }

  updateConfig(partial: Partial<AppConfig>): AppConfig {
    const current = this.readConfig();
    const next: AppConfig = {
      ...current,
      ...partial,
      hotkeys: { ...current.hotkeys, ...(partial.hotkeys ?? {}) },
      providers: { ...current.providers, ...(partial.providers ?? {}) },
    };

    const bag: Record<string, unknown> = {
      activeProviderId: next.activeProviderId,
      hotkeys: next.hotkeys,
      systemPrompt: next.systemPrompt,
      autoDeleteScreenshots: next.autoDeleteScreenshots,
    };
    this.db.config.setMany(bag);

    for (const provider of Object.values(next.providers ?? {})) {
      this.db.providers.upsert(provider as ProviderConfig);
    }
    return next;
  }

  // ── Secrets ────────────────────────────────────────────────────────────

  setSecret(key: string, value: string): void {
    const bag = this.readSecretBag();
    bag[key] = value;
    this.writeSecretBag(bag);
  }

  getSecret(key: string): string | null {
    return this.readSecretBag()[key] ?? null;
  }

  private readSecretBag(): Record<string, string> {
    if (!fs.existsSync(this.secretsPath)) return {};
    const buf = fs.readFileSync(this.secretsPath);
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return JSON.parse(safeStorage.decryptString(buf)) as Record<string, string>;
      } catch {
        return {};
      }
    }
    try {
      return JSON.parse(buf.toString('utf-8')) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private writeSecretBag(bag: Record<string, string>): void {
    const plain = JSON.stringify(bag);
    if (safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(this.secretsPath, safeStorage.encryptString(plain));
    } else {
      fs.writeFileSync(this.secretsPath, plain, 'utf-8');
    }
  }

  // ── Legacy migration ───────────────────────────────────────────────────

  private migrateLegacyConfigJson(): void {
    if (!fs.existsSync(this.legacyConfigPath)) return;
    try {
      const raw = fs.readFileSync(this.legacyConfigPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AppConfig>;
      this.updateConfig(parsed);
      const backup = `${this.legacyConfigPath}.migrated-${Date.now()}.bak`;
      fs.renameSync(this.legacyConfigPath, backup);
      console.log(`[penumbra] migrated legacy config.json → ${backup}`);
    } catch (err) {
      console.warn('[penumbra] legacy config migration failed:', err);
    }
  }

  close(): void {
    this.db.close();
  }
}
