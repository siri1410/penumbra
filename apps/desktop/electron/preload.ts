import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig } from '@penumbra/types';

export interface PenumbraBridge {
  config: {
    get(): Promise<AppConfig>;
    set(partial: Partial<AppConfig>): Promise<AppConfig>;
    setSecret(key: string, value: string): Promise<void>;
    getSecret(key: string): Promise<string | null>;
  };
  screenshot: {
    capture(): Promise<{ base64: string; mimeType: 'image/png' }>;
  };
  window: {
    hide(): Promise<void>;
    close(): Promise<void>;
  };
  on(event: 'capture', handler: (shot: { base64: string; mimeType: 'image/png' }) => void): void;
  on(event: 'focus-chat', handler: () => void): void;
  on(event: 'open-settings', handler: () => void): void;
}

const bridge: PenumbraBridge = {
  config: {
    get: () => ipcRenderer.invoke('penumbra:config:get'),
    set: (partial) => ipcRenderer.invoke('penumbra:config:set', partial),
    setSecret: (key, value) => ipcRenderer.invoke('penumbra:config:secret:set', key, value),
    getSecret: (key) => ipcRenderer.invoke('penumbra:config:secret:get', key),
  },
  screenshot: {
    capture: () => ipcRenderer.invoke('penumbra:screenshot:capture'),
  },
  window: {
    hide: () => ipcRenderer.invoke('penumbra:window:hide'),
    close: () => ipcRenderer.invoke('penumbra:window:close'),
  },
  on: (event, handler) => {
    const channel = `penumbra:${event}`;
    ipcRenderer.on(channel, (_e, payload) => (handler as (p: unknown) => void)(payload));
  },
};

contextBridge.exposeInMainWorld('penumbra', bridge);
