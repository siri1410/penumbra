interface Props {
  showSettings: boolean;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onToggleSettings: () => void;
  onNewConversation: () => void;
  onHide: () => void;
}

export function TitleBar({
  showSettings,
  drawerOpen,
  onToggleDrawer,
  onToggleSettings,
  onNewConversation,
  onHide,
}: Props) {
  return (
    <div className="drag-region flex items-center justify-between border-b border-penumbra-border px-3 py-2 text-xs text-penumbra-muted">
      <div className="no-drag flex items-center gap-1">
        <IconButton
          title={drawerOpen ? 'Close history' : 'Open history'}
          active={drawerOpen}
          onClick={onToggleDrawer}
        >
          ≡
        </IconButton>
        <span className="ml-1 inline-block h-2 w-2 rounded-full bg-penumbra-accent" />
        <span className="font-semibold tracking-wide text-white">Penumbra</span>
      </div>
      <div className="no-drag flex items-center gap-1">
        <IconButton title="New conversation" onClick={onNewConversation}>↻</IconButton>
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
