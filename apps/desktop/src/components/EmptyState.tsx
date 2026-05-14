import type { AppConfig } from '@penumbra/types';

interface Props {
  hasProvider: boolean;
  hotkeys: AppConfig['hotkeys'];
  onOpenSettings: () => void;
}

export function EmptyState({ hasProvider, hotkeys, onOpenSettings }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-3xl">🌑</div>
      <h2 className="text-base font-semibold text-white">Penumbra</h2>
      <p className="mt-1 text-xs text-penumbra-muted">Your AI in the margins.</p>

      {!hasProvider && (
        <button
          onClick={onOpenSettings}
          className="mt-4 rounded-md bg-penumbra-accent px-4 py-2 text-sm font-medium text-white"
        >
          Set up a provider
        </button>
      )}

      <div className="mt-6 space-y-1 text-xs text-penumbra-muted">
        <Hotkey label="Capture & ask" keys={hotkeys.capture} />
        <Hotkey label="Focus chat" keys={hotkeys.focusChat} />
        <Hotkey label="Toggle window" keys={hotkeys.toggle} />
      </div>
    </div>
  );
}

function Hotkey({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span>{label}</span>
      <kbd className="rounded border border-penumbra-border bg-penumbra-panel px-1.5 py-0.5 font-mono text-[10px] text-white">
        {keys.replace('CommandOrControl', '⌘/Ctrl')}
      </kbd>
    </div>
  );
}
