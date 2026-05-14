import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppConfig, ContentPart } from '@penumbra/types';
import { ChatSession, type SessionPersistor, type Turn } from '@penumbra/core';
import {
  bridge,
  type ScreenshotPayload,
  type ConversationSummary,
  type PersistedMessage,
} from './lib/bridge.js';
import { getActiveProvider } from './lib/provider-instance.js';
import { TitleBar } from './components/TitleBar.js';
import { ChatLog } from './components/ChatLog.js';
import { Composer } from './components/Composer.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { EmptyState } from './components/EmptyState.js';
import { ConversationDrawer } from './components/ConversationDrawer.js';

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingShot, setPendingShot] = useState<ScreenshotPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnsVersion, setTurnsVersion] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const sessionRef = useRef<ChatSession | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const turnToMessageIdRef = useRef<Map<string, string>>(new Map());

  const refreshConversations = useCallback(async () => {
    setConversations(await bridge.conversations.list());
  }, []);

  const buildPersistor = useCallback(
    (conversationId: string): SessionPersistor => ({
      onUserTurn: async (turn) => {
        const msg = await bridge.messages.append({
          conversationId,
          role: 'user',
          content: turn.content,
        });
        turnToMessageIdRef.current.set(turn.id, msg.id);
        await refreshConversations();
      },
      onAssistantComplete: async (turn, usage) => {
        const existing = turnToMessageIdRef.current.get(turn.id);
        if (existing) {
          await bridge.messages.update(existing, {
            content: turn.content,
            promptTokens: usage?.promptTokens,
            completionTokens: usage?.completionTokens,
          });
        } else {
          const msg = await bridge.messages.append({
            conversationId,
            role: 'assistant',
            content: turn.content,
            promptTokens: usage?.promptTokens,
            completionTokens: usage?.completionTokens,
          });
          turnToMessageIdRef.current.set(turn.id, msg.id);
        }
        await refreshConversations();
      },
    }),
    [refreshConversations],
  );

  const loadConversation = useCallback(
    async (id: string, cfg: AppConfig) => {
      const result = await bridge.conversations.load(id);
      if (!result) return;
      turnToMessageIdRef.current.clear();

      const turns: Turn[] = result.messages.map((m, idx) => {
        const turn: Turn = {
          id: `${m.role[0]}${idx + 1}`,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        };
        turnToMessageIdRef.current.set(turn.id, m.id);
        return turn;
      });

      const session = new ChatSession({
        systemPrompt: cfg.systemPrompt,
        provider: null as never, // wired lazily on send
        persistor: buildPersistor(id),
        initialTurns: turns,
      });
      sessionRef.current = session;
      setActiveConversationId(id);
      setTurnsVersion((v) => v + 1);
    },
    [buildPersistor],
  );

  const newConversation = useCallback(
    async (cfg: AppConfig) => {
      const conv = await bridge.conversations.create({
        providerId: cfg.activeProviderId ?? undefined,
        model: cfg.activeProviderId
          ? cfg.providers[cfg.activeProviderId]?.defaultModel
          : undefined,
      });
      turnToMessageIdRef.current.clear();
      const session = new ChatSession({
        systemPrompt: cfg.systemPrompt,
        provider: null as never,
        persistor: buildPersistor(conv.id),
      });
      sessionRef.current = session;
      setActiveConversationId(conv.id);
      setTurnsVersion((v) => v + 1);
      await refreshConversations();
    },
    [buildPersistor, refreshConversations],
  );

  // ── Bootstrap ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await bridge.config.get();
        if (cancelled) return;
        setConfig(cfg);

        const convs = await bridge.conversations.list();
        if (cancelled) return;
        setConversations(convs);

        if (convs.length > 0) {
          await loadConversation(convs[0]!.id, cfg);
        } else {
          await newConversation(cfg);
        }
      } catch (err) {
        console.error('[penumbra] bootstrap failed:', err);
        if (!cancelled) {
          setError(`Startup failed: ${String((err as Error).message ?? err)}`);
          // Still render the shell so the user can see the error.
          if (!config) {
            try {
              const fallback = await bridge.config.get();
              if (!cancelled) setConfig(fallback);
            } catch {
              /* ignore */
            }
          }
        }
      }
    })();

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

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateConfig = async (partial: Partial<AppConfig>) => {
    const next = await bridge.config.set(partial);
    setConfig(next);
    if (sessionRef.current) sessionRef.current.setSystemPrompt(next.systemPrompt);
  };

  const handleSend = async (text: string) => {
    if (!config || !sessionRef.current || !activeConversationId) return;
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
    sessionRef.current.setProvider(provider);
    sessionRef.current.setSystemPrompt(config.systemPrompt);

    const parts: ContentPart[] = [];
    if (pendingShot) {
      parts.push({ type: 'image', base64: pendingShot.base64, mimeType: pendingShot.mimeType });
    }
    parts.push({ type: 'text', text: text || (pendingShot ? 'What is on my screen?' : '') });
    sessionRef.current.addUserTurn(parts);
    setPendingShot(null);
    setTurnsVersion((v) => v + 1);

    // Auto-title the conversation from the first user message
    if (sessionRef.current.turns.filter((t) => t.role === 'user').length === 1) {
      const firstText = parts.find((p) => p.type === 'text');
      if (firstText && firstText.type === 'text' && firstText.text) {
        const title = firstText.text.slice(0, 60);
        void bridge.conversations.rename(activeConversationId, title).then(refreshConversations);
      }
    }

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

  const handleNewConversation = () => {
    if (!config) return;
    void newConversation(config);
  };

  const handleSelectConversation = (id: string) => {
    if (!config || id === activeConversationId) {
      setDrawerOpen(false);
      return;
    }
    void loadConversation(id, config).then(() => setDrawerOpen(false));
  };

  const handleRenameConversation = async (id: string, title: string) => {
    await bridge.conversations.rename(id, title);
    await refreshConversations();
  };

  const handleDeleteConversation = async (id: string) => {
    await bridge.conversations.delete(id);
    if (id === activeConversationId) {
      if (config) await newConversation(config);
    } else {
      await refreshConversations();
    }
  };

  const handleDeleteAllConversations = async () => {
    await bridge.conversations.deleteAll();
    if (config) await newConversation(config);
  };

  if (!config) return null;

  const hasProvider = Boolean(config.activeProviderId);
  const turns = sessionRef.current?.turns ?? [];

  return (
    <div className="flex h-screen rounded-2xl border border-penumbra-border bg-penumbra-bg shadow-overlay backdrop-blur-xl">
      <ConversationDrawer
        open={drawerOpen}
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onCreate={handleNewConversation}
        onRename={handleRenameConversation}
        onDelete={handleDeleteConversation}
        onDeleteAll={handleDeleteAllConversations}
        onClose={() => setDrawerOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((d) => !d)}
          onToggleSettings={() => setShowSettings((s) => !s)}
          onNewConversation={handleNewConversation}
          onHide={() => bridge.window.hide()}
          showSettings={showSettings}
        />

        {showSettings ? (
          <SettingsPanel
            config={config}
            onChange={updateConfig}
            onClose={() => setShowSettings(false)}
          />
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
    </div>
  );
}
