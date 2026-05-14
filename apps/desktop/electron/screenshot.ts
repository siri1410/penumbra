import { desktopCapturer, screen } from 'electron';

export interface ScreenshotResult {
  base64: string;
  mimeType: 'image/png';
}

/**
 * Captures the primary display as a PNG and returns base64 bytes.
 * Uses Electron's desktopCapturer so it works without extra native deps.
 */
export async function captureScreenshot(): Promise<ScreenshotResult> {
  const { workAreaSize, size } = screen.getPrimaryDisplay();
  const target = {
    width: Math.max(workAreaSize.width, size.width),
    height: Math.max(workAreaSize.height, size.height),
  };

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: target,
  });

  const primary = sources[0];
  if (!primary) throw new Error('No screen source available');

  const png = primary.thumbnail.toPNG();
  return { base64: png.toString('base64'), mimeType: 'image/png' };
}
