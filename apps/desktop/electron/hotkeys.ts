import { globalShortcut } from 'electron';
import type { AppConfig } from '@penumbra/types';

export interface HotkeyHandlers {
  toggle: () => void;
  capture: () => void;
  focusChat: () => void;
  settings: () => void;
}

export function registerHotkeys(hotkeys: AppConfig['hotkeys'], handlers: HotkeyHandlers): void {
  globalShortcut.unregisterAll();
  safeRegister(hotkeys.toggle, handlers.toggle);
  safeRegister(hotkeys.capture, handlers.capture);
  safeRegister(hotkeys.focusChat, handlers.focusChat);
  safeRegister(hotkeys.settings, handlers.settings);
}

function safeRegister(accelerator: string, handler: () => void): void {
  try {
    const ok = globalShortcut.register(accelerator, handler);
    if (!ok) console.warn(`[penumbra] failed to register hotkey: ${accelerator}`);
  } catch (err) {
    console.warn(`[penumbra] hotkey error for "${accelerator}":`, err);
  }
}
