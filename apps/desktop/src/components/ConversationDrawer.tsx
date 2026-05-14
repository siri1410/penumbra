import { useEffect, useMemo, useState } from 'react';
import type { ConversationSummary } from '../lib/bridge.js';

interface Props {
  open: boolean;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onClose: () => void;
}

export function ConversationDrawer({
  open,
  conversations,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onDeleteAll,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  useEffect(() => {
    if (!open) setConfirmDeleteAll(false);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.last_message_preview ?? '').toLowerCase().includes(q),
    );
  }, [conversations, query]);

  if (!open) return null;

  return (
    <div className="flex h-full w-[260px] flex-col border-r border-penumbra-border bg-penumbra-panel/70 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-penumbra-border p-2">
        <span className="text-xs font-semibold tracking-wide text-white">History</span>
        <button
          onClick={onClose}
          className="rounded px-2 py-1 text-xs text-penumbra-muted hover:bg-white/10 hover:text-white"
          title="Close drawer"
        >
          ≡
        </button>
      </div>

      <div className="space-y-2 border-b border-penumbra-border p-2">
        <button
          onClick={onCreate}
          className="w-full rounded-md bg-penumbra-accent px-3 py-1.5 text-xs font-medium text-white"
        >
          + New conversation
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-md border border-penumbra-border bg-black/30 px-2 py-1 text-xs text-white placeholder-penumbra-muted outline-none focus:border-penumbra-accent"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-penumbra-muted">
            {conversations.length === 0 ? 'No conversations yet.' : 'No matches.'}
          </div>
        ) : (
          filtered.map((c) => (
            <ConversationRow
              key={c.id}
              conv={c}
              active={c.id === activeId}
              onSelect={() => onSelect(c.id)}
              onRename={(title) => onRename(c.id, title)}
              onDelete={() => onDelete(c.id)}
            />
          ))
        )}
      </div>

      <div className="border-t border-penumbra-border p-2">
        {confirmDeleteAll ? (
          <div className="space-y-1">
            <p className="text-[10px] text-penumbra-muted">Delete all conversations?</p>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  onDeleteAll();
                  setConfirmDeleteAll(false);
                }}
                className="flex-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/20"
              >
                Yes, delete all
              </button>
              <button
                onClick={() => setConfirmDeleteAll(false)}
                className="rounded-md border border-penumbra-border px-2 py-1 text-[11px] text-penumbra-muted hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDeleteAll(true)}
            className="w-full rounded-md px-2 py-1 text-[11px] text-penumbra-muted hover:bg-white/5 hover:text-white"
          >
            Delete all
          </button>
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  conv,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  conv: ConversationSummary;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conv.title);

  const submitRename = () => {
    const t = draft.trim();
    if (t && t !== conv.title) onRename(t);
    setEditing(false);
  };

  return (
    <div
      onClick={() => !editing && onSelect()}
      className={`group relative cursor-pointer rounded-md px-2 py-2 ${
        active ? 'bg-penumbra-accent/20' : 'hover:bg-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') {
                  setDraft(conv.title);
                  setEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded border border-penumbra-accent bg-black/30 px-1 text-xs text-white outline-none"
            />
          ) : (
            <div className="truncate text-xs font-medium text-white">{conv.title}</div>
          )}
          <div className="mt-0.5 truncate text-[10px] text-penumbra-muted">
            {conv.last_message_preview?.replace(/\s+/g, ' ') ?? '—'}
          </div>
          <div className="mt-1 text-[9px] text-penumbra-muted">{relativeTime(conv.updated_at)}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((m) => !m);
          }}
          className="rounded p-1 text-penumbra-muted opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white"
          title="Actions"
        >
          ⋮
        </button>
      </div>

      {menuOpen && (
        <div
          className="absolute right-1 top-7 z-10 w-28 rounded-md border border-penumbra-border bg-penumbra-bg/95 py-1 text-xs shadow-overlay backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setEditing(true);
              setMenuOpen(false);
            }}
            className="block w-full px-2 py-1 text-left text-white hover:bg-white/10"
          >
            Rename
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            className="block w-full px-2 py-1 text-left text-red-300 hover:bg-red-500/10"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
