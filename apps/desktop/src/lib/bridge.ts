import type { AppConfig } from '@penumbra/types';

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
    penumbra: PenumbraBridge;
  }
}

export const bridge: PenumbraBridge = window.penumbra;
