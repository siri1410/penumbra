import type { AppConfig } from '@penumbra/types';
import { DEFAULT_CONFIG } from '@penumbra/core';

export interface ScreenshotPayload {
  base64: string;
  mimeType: 'image/png';
}

export interface PenumbraBridge {
  config: {
    get(): Promise<AppConfig>;
    set(partial: Partial<AppConfig>): Promise<AppConfig>;
    setSecret(key: string, value: string): Promise<void>;
    getSecret(key: string): Promise<string | null>;
  };
  screenshot: { capture(): Promise<ScreenshotPayload> };
  window: { hide(): Promise<void>; close(): Promise<void> };
  on(event: 'capture', handler: (shot: ScreenshotPayload) => void): void;
  on(event: 'focus-chat', handler: () => void): void;
  on(event: 'open-settings', handler: () => void): void;
}

declare global {
  interface Window {
    penumbra?: PenumbraBridge;
  }
}

export const isElectron = typeof window !== 'undefined' && Boolean(window.penumbra);

/**
 * Browser-only fallback: persists config in localStorage so the dev URL
 * (http://localhost:5180) works for UI iteration without launching Electron.
 * Screenshots and global hotkeys are stubbed — those require the main process.
 */
function createBrowserBridge(): PenumbraBridge {
  const CONFIG_KEY = 'penumbra.config';
  const SECRETS_KEY = 'penumbra.secrets';

  const readConfig = (): AppConfig => {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return DEFAULT_CONFIG;
      return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<AppConfig>) };
    } catch {
      return DEFAULT_CONFIG;
    }
  };
  const writeConfig = (cfg: AppConfig) => localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));

  const readSecrets = (): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem(SECRETS_KEY) ?? '{}') as Record<string, string>;
    } catch {
      return {};
    }
  };
  const writeSecrets = (bag: Record<string, string>) =>
    localStorage.setItem(SECRETS_KEY, JSON.stringify(bag));

  return {
    config: {
      get: async () => readConfig(),
      set: async (partial) => {
        const next: AppConfig = {
          ...readConfig(),
          ...partial,
          hotkeys: { ...readConfig().hotkeys, ...(partial.hotkeys ?? {}) },
          providers: { ...readConfig().providers, ...(partial.providers ?? {}) },
        };
        writeConfig(next);
        return next;
      },
      setSecret: async (key, value) => {
        const bag = readSecrets();
        bag[key] = value;
        writeSecrets(bag);
      },
      getSecret: async (key) => readSecrets()[key] ?? null,
    },
    screenshot: {
      capture: async () => {
        throw new Error('Screenshots require Electron. Launch via `pnpm dev` and use the desktop window.');
      },
    },
    window: {
      hide: async () => {
        /* no-op in browser */
      },
      close: async () => {
        /* no-op in browser */
      },
    },
    on: () => {
      /* no events in browser */
    },
  };
}

export const bridge: PenumbraBridge = window.penumbra ?? createBrowserBridge();
