import { useEffect, useRef, useState } from 'react';
import type { AppConfig, ContentPart } from '@penumbra/types';
import { ChatSession } from '@penumbra/core';
import { bridge, type ScreenshotPayload } from './lib/bridge.js';
import { getActiveProvider } from './lib/provider-instance.js';
import { TitleBar } from './components/TitleBar.js';
import { ChatLog } from './components/ChatLog.js';
import { Composer } from './components/Composer.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { EmptyState } from './components/EmptyState.js';

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingShot, setPendingShot] = useState<ScreenshotPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnsVersion, setTurnsVersion] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const sessionRef = useRef<ChatSession | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    void bridge.config.get().then(setConfig);
    bridge.on('capture', (shot) => {
      setPendingShot(shot);
      setShowSettings(false);
      composerRef.current?.focus();
    });
    bridge.on('focus-chat', () => {
      setShowSettings(false);
      composerRef.current?.focus();
    });
    bridge.on('open-settings', () => setShowSettings(true));
  }, []);

  const updateConfig = async (partial: Partial<AppConfig>) => {
    const next = await bridge.config.set(partial);
    setConfig(next);
  };

  const handleSend = async (text: string) => {
    if (!config) return;
    const provider = await getActiveProvider(config).catch((err) => {
      setError(String(err.message ?? err));
      return null;
    });
    if (!provider) {
      setError('No provider configured. Open settings and add an API key.');
      setShowSettings(true);
      return;
    }

    setError(null);

    if (!sessionRef.current) {
      sessionRef.current = new ChatSession({
        systemPrompt: config.systemPrompt,
        provider,
      });
    } else {
      sessionRef.current.setProvider(provider);
      sessionRef.current.setSystemPrompt(config.systemPrompt);
    }

    const parts: ContentPart[] = [];
    if (pendingShot) {
      parts.push({ type: 'image', base64: pendingShot.base64, mimeType: pendingShot.mimeType });
    }
    parts.push({ type: 'text', text: text || (pendingShot ? 'What is on my screen?' : '') });
    sessionRef.current.addUserTurn(parts);
    setPendingShot(null);
    setTurnsVersion((v) => v + 1);

    setStreaming(true);
    try {
      for await (const _chunk of sessionRef.current.streamAssistant()) {
        setTurnsVersion((v) => v + 1);
      }
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setStreaming(false);
      setTurnsVersion((v) => v + 1);
    }
  };

  const handleReset = () => {
    sessionRef.current?.reset();
    setPendingShot(null);
    setTurnsVersion((v) => v + 1);
  };

  if (!config) return null;

  const hasProvider = Boolean(config.activeProviderId);
  const turns = sessionRef.current?.turns ?? [];

  return (
    <div className="flex h-screen flex-col rounded-2xl border border-penumbra-border bg-penumbra-bg shadow-overlay backdrop-blur-xl">
      <TitleBar
        onToggleSettings={() => setShowSettings((s) => !s)}
        onReset={handleReset}
        onHide={() => bridge.window.hide()}
        showSettings={showSettings}
      />

      {showSettings ? (
        <SettingsPanel config={config} onChange={updateConfig} onClose={() => setShowSettings(false)} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {turns.length === 0 ? (
            <EmptyState
              hasProvider={hasProvider}
              hotkeys={config.hotkeys}
              onOpenSettings={() => setShowSettings(true)}
            />
          ) : (
            <ChatLog turns={turns} key={turnsVersion} />
          )}

          {error && (
            <div className="mx-4 mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <Composer
            ref={composerRef}
            pendingShot={pendingShot}
            onClearShot={() => setPendingShot(null)}
            onSend={handleSend}
            onCapture={async () => {
              const shot = await bridge.screenshot.capture();
              setPendingShot(shot);
              composerRef.current?.focus();
            }}
            streaming={streaming}
          />
        </div>
      )}
    </div>
  );
}
