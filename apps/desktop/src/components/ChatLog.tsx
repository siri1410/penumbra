import { useEffect, useRef } from 'react';
import type { Turn } from '@penumbra/core';
import type { ContentPart } from '@penumbra/types';

export function ChatLog({ turns }: { turns: Turn[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
      {turns.map((t) => (
        <TurnView key={t.id} turn={t} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const isUser = turn.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-xl px-3 py-2 leading-relaxed ${
          isUser
            ? 'bg-penumbra-accent/20 text-white'
            : 'bg-penumbra-panel text-white/95 border border-penumbra-border'
        }`}
      >
        {renderContent(turn.content)}
        {turn.streaming && <span className="ml-1 inline-block animate-pulse">▍</span>}
      </div>
    </div>
  );
}

function renderContent(content: string | ContentPart[]) {
  if (typeof content === 'string') return <p className="whitespace-pre-wrap">{content}</p>;
  return (
    <div className="space-y-2">
      {content.map((p, i) => {
        if (p.type === 'text') return <p key={i} className="whitespace-pre-wrap">{p.text}</p>;
        return (
          <img
            key={i}
            src={`data:${p.mimeType};base64,${p.base64}`}
            alt="screenshot"
            className="max-h-40 rounded-md border border-penumbra-border"
          />
        );
      })}
    </div>
  );
}
