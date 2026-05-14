import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig } from '@penumbra/types';
import { DEFAULT_CONFIG } from '@penumbra/core';

interface PersistedConfig extends Omit<AppConfig, 'providers'> {
  providers: AppConfig['providers'];
}

export class ConfigStore {
  private readonly configPath: string;
  private readonly secretsPath: string;

  constructor() {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    this.configPath = path.join(dir, 'config.json');
    this.secretsPath = path.join(dir, 'secrets.bin');
  }

  read(): AppConfig {
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedConfig>;
      return mergeConfig(DEFAULT_CONFIG, parsed);
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  write(config: AppConfig): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  update(partial: Partial<AppConfig>): AppConfig {
    const next = mergeConfig(this.read(), partial);
    this.write(next);
    return next;
  }

  setSecret(key: string, value: string): void {
    const bag = this.readSecretBag();
    bag[key] = value;
    this.writeSecretBag(bag);
  }

  getSecret(key: string): string | null {
    const bag = this.readSecretBag();
    return bag[key] ?? null;
  }

  private readSecretBag(): Record<string, string> {
    if (!fs.existsSync(this.secretsPath)) return {};
    const buf = fs.readFileSync(this.secretsPath);
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const plain = safeStorage.decryptString(buf);
        return JSON.parse(plain) as Record<string, string>;
      } catch {
        return {};
      }
    }
    // Fallback: store unencrypted (warn user via UI ideally).
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
}

function mergeConfig(base: AppConfig, partial: Partial<AppConfig>): AppConfig {
  return {
    ...base,
    ...partial,
    hotkeys: { ...base.hotkeys, ...(partial.hotkeys ?? {}) },
    providers: { ...base.providers, ...(partial.providers ?? {}) },
  };
}
