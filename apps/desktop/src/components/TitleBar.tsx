interface Props {
  showSettings: boolean;
  onToggleSettings: () => void;
  onReset: () => void;
  onHide: () => void;
}

export function TitleBar({ showSettings, onToggleSettings, onReset, onHide }: Props) {
  return (
    <div className="drag-region flex items-center justify-between border-b border-penumbra-border px-3 py-2 text-xs text-penumbra-muted">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-penumbra-accent" />
        <span className="font-semibold tracking-wide text-white">Penumbra</span>
      </div>
      <div className="no-drag flex items-center gap-1">
        <IconButton title="New conversation" onClick={onReset}>↻</IconButton>
        <IconButton
          title={showSettings ? 'Close settings' : 'Settings'}
          active={showSettings}
          onClick={onToggleSettings}
        >
          ⚙
        </IconButton>
        <IconButton title="Hide window" onClick={onHide}>×</IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-md px-2 py-1 transition hover:bg-white/10 ${
        active ? 'bg-white/10 text-white' : ''
      }`}
    >
      {children}
    </button>
  );
}
