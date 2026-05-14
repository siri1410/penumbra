import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentPart } from '@penumbra/types';
import { deserializeContent } from '@penumbra/db';
import { DataStore } from './data-store.js';
import { captureScreenshot } from './screenshot.js';
import { registerHotkeys } from './hotkeys.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
process.env.APP_ROOT = path.join(__dirname, '..');
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

let mainWindow: BrowserWindow | null = null;
let store: DataStore | null = null;

function createWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 480;
  const height = 640;

  const win = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + 24,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.platform === 'darwin' || process.platform === 'win32') {
    try {
      win.setContentProtection(true);
    } catch {
      /* older Electron / unsupported platform */
    }
  }

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  win.once('ready-to-show', () => win.show());

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[penumbra] renderer gone:', details);
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[penumbra] did-fail-load:', code, desc);
  });

  return win;
}

function toggleWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
}

app.whenReady().then(() => {
  store = new DataStore();
  mainWindow = createWindow();

  const config = store.readConfig();
  registerHotkeys(config.hotkeys, {
    toggle: toggleWindow,
    capture: async () => {
      const shot = await captureScreenshot();
      mainWindow?.show();
      mainWindow?.webContents.send('penumbra:capture', shot);
    },
    focusChat: () => {
      mainWindow?.show();
      mainWindow?.webContents.send('penumbra:focus-chat');
    },
    settings: () => {
      mainWindow?.show();
      mainWindow?.webContents.send('penumbra:open-settings');
    },
  });

  // ── Config + secrets ────────────────────────────────────────────────
  ipcMain.handle('penumbra:config:get', () => store!.readConfig());
  ipcMain.handle('penumbra:config:set', (_e, partial) => store!.updateConfig(partial));
  ipcMain.handle('penumbra:config:secret:set', (_e, key: string, value: string) =>
    store!.setSecret(key, value),
  );
  ipcMain.handle('penumbra:config:secret:get', (_e, key: string) => store!.getSecret(key));

  // ── Screenshots ──────────────────────────────────────────────────────
  ipcMain.handle('penumbra:screenshot:capture', () => captureScreenshot());

  // ── Window controls ──────────────────────────────────────────────────
  ipcMain.handle('penumbra:window:hide', () => mainWindow?.hide());
  ipcMain.handle('penumbra:window:close', () => app.quit());

  // ── Conversations ────────────────────────────────────────────────────
  ipcMain.handle('penumbra:conversation:list', () => store!.db.conversations.list());
  ipcMain.handle(
    'penumbra:conversation:create',
    (_e, input?: { providerId?: string; model?: string; title?: string }) =>
      store!.db.conversations.create(input ?? {}),
  );
  ipcMain.handle('penumbra:conversation:load', (_e, id: string) => {
    const conv = store!.db.conversations.get(id);
    if (!conv) return null;
    const rows = store!.db.messages.list(id);
    const messages = rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: deserializeContent(r.content) as string | ContentPart[],
      createdAt: r.created_at,
      promptTokens: r.prompt_tokens ?? undefined,
      completionTokens: r.completion_tokens ?? undefined,
    }));
    return { conversation: conv, messages };
  });
  ipcMain.handle('penumbra:conversation:rename', (_e, id: string, title: string) =>
    store!.db.conversations.rename(id, title),
  );
  ipcMain.handle('penumbra:conversation:delete', (_e, id: string) =>
    store!.db.conversations.delete(id),
  );
  ipcMain.handle('penumbra:conversation:deleteAll', () => store!.db.conversations.deleteAll());

  // ── Messages ─────────────────────────────────────────────────────────
  ipcMain.handle(
    'penumbra:message:append',
    (
      _e,
      input: {
        conversationId: string;
        role: 'user' | 'assistant';
        content: string | ContentPart[];
        promptTokens?: number;
        completionTokens?: number;
      },
    ) => store!.db.messages.append(input),
  );
  ipcMain.handle(
    'penumbra:message:update',
    (
      _e,
      id: string,
      patch: {
        content?: string | ContentPart[];
        promptTokens?: number;
        completionTokens?: number;
      },
    ) => store!.db.messages.update(id, patch),
  );

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  store?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
