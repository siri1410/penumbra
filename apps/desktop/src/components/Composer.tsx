import { forwardRef, useState } from 'react';
import type { ScreenshotPayload } from '../lib/bridge.js';

interface Props {
  pendingShot: ScreenshotPayload | null;
  onClearShot: () => void;
  onSend: (text: string) => void | Promise<void>;
  onCapture: () => void;
  streaming: boolean;
}

export const Composer = forwardRef<HTMLTextAreaElement, Props>(function Composer(
  { pendingShot, onClearShot, onSend, onCapture, streaming },
  ref,
) {
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed && !pendingShot) return;
    if (streaming) return;
    void onSend(trimmed);
    setText('');
  };

  return (
    <div className="border-t border-penumbra-border p-3">
      {pendingShot && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-penumbra-border bg-penumbra-panel p-2">
          <img
            src={`data:${pendingShot.mimeType};base64,${pendingShot.base64}`}
            alt="pending capture"
            className="h-10 w-16 rounded object-cover"
          />
          <span className="text-xs text-penumbra-muted flex-1">Screenshot ready to send</span>
          <button
            className="text-xs text-penumbra-muted hover:text-white"
            onClick={onClearShot}
          >
            remove
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={pendingShot ? 'Ask about this screenshot…' : 'Ask anything…'}
          rows={1}
          className="no-drag flex-1 resize-none rounded-lg border border-penumbra-border bg-penumbra-panel px-3 py-2 text-sm text-white placeholder-penumbra-muted outline-none focus:border-penumbra-accent"
        />
        <button
          onClick={onCapture}
          title="Capture screenshot"
          className="rounded-lg border border-penumbra-border bg-penumbra-panel px-3 py-2 text-sm hover:bg-white/10"
        >
          📸
        </button>
        <button
          onClick={submit}
          disabled={streaming}
          className="rounded-lg bg-penumbra-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {streaming ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
});
