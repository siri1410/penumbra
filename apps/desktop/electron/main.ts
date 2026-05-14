import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigStore } from './config-store.js';
import { captureScreenshot } from './screenshot.js';
import { registerHotkeys } from './hotkeys.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
process.env.APP_ROOT = path.join(__dirname, '..');
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

let mainWindow: BrowserWindow | null = null;
const configStore = new ConfigStore();

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Best-effort: exclude from screen sharing on supported platforms.
  if (process.platform === 'darwin' || process.platform === 'win32') {
    try {
      win.setContentProtection(true);
    } catch {
      // Older Electron / unsupported platform.
    }
  }

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  win.once('ready-to-show', () => win.show());
  return win;
}

function toggleWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
}

app.whenReady().then(() => {
  mainWindow = createWindow();

  const config = configStore.read();
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

  ipcMain.handle('penumbra:config:get', () => configStore.read());
  ipcMain.handle('penumbra:config:set', (_e, partial) => configStore.update(partial));
  ipcMain.handle('penumbra:config:secret:set', (_e, key: string, value: string) =>
    configStore.setSecret(key, value),
  );
  ipcMain.handle('penumbra:config:secret:get', (_e, key: string) =>
    configStore.getSecret(key),
  );
  ipcMain.handle('penumbra:screenshot:capture', () => captureScreenshot());
  ipcMain.handle('penumbra:window:hide', () => mainWindow?.hide());
  ipcMain.handle('penumbra:window:close', () => app.quit());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
