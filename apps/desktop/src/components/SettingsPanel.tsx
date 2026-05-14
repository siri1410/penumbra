import { useEffect, useState } from 'react';
import type { AppConfig, ProviderConfig, ProviderId } from '@penumbra/types';
import { PROVIDER_CATALOG, getDescriptor } from '@penumbra/providers';
import { bridge } from '../lib/bridge.js';

interface Props {
  config: AppConfig;
  onChange: (partial: Partial<AppConfig>) => Promise<void>;
  onClose: () => void;
}

export function SettingsPanel({ config, onChange, onClose }: Props) {
  const [activeId, setActiveId] = useState<ProviderId>(
    (config.activeProviderId ?? 'anthropic') as ProviderId,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 text-sm">
      <h3 className="mb-2 text-base font-semibold">Providers</h3>
      <p className="mb-4 text-xs text-penumbra-muted">
        Pick a provider, add credentials, and Penumbra uses it for chat + vision. Keys are stored
        encrypted via your OS keychain.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {PROVIDER_CATALOG.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              activeId === p.id
                ? 'border-penumbra-accent bg-penumbra-accent/20 text-white'
                : 'border-penumbra-border bg-penumbra-panel text-penumbra-muted hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <ProviderForm
        key={activeId}
        providerId={activeId}
        config={config.providers[activeId]}
        isActive={config.activeProviderId === activeId}
        onSave={async (cfg, apiKey) => {
          if (apiKey !== null) {
            await bridge.config.setSecret(`apiKey:${cfg.id}`, apiKey);
          }
          await onChange({
            activeProviderId: cfg.id,
            providers: { ...config.providers, [cfg.id]: cfg },
          });
        }}
      />

      <div className="mt-6 border-t border-penumbra-border pt-4">
        <h3 className="mb-2 text-base font-semibold">System prompt</h3>
        <textarea
          defaultValue={config.systemPrompt}
          onBlur={(e) => void onChange({ systemPrompt: e.target.value })}
          rows={6}
          className="w-full rounded-md border border-penumbra-border bg-penumbra-panel p-2 font-mono text-xs"
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-md bg-penumbra-accent px-4 py-2 text-sm font-medium"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ProviderForm({
  providerId,
  config,
  isActive,
  onSave,
}: {
  providerId: ProviderId;
  config: ProviderConfig | undefined;
  isActive: boolean;
  onSave: (cfg: ProviderConfig, apiKey: string | null) => Promise<void>;
}) {
  const descriptor = getDescriptor(providerId);
  const [label, setLabel] = useState(config?.label ?? descriptor.label);
  const [apiKey, setApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? '');
  const [model, setModel] = useState(config?.defaultModel ?? descriptor.defaultModel);

  useEffect(() => {
    void bridge.config.getSecret(`apiKey:${providerId}`).then((k) => setHasStoredKey(Boolean(k)));
  }, [providerId]);

  const save = async () => {
    const cfg: ProviderConfig = {
      id: providerId,
      label,
      baseUrl: baseUrl || undefined,
      defaultModel: model || descriptor.defaultModel,
      models: descriptor.suggestedModels,
    };
    await onSave(cfg, apiKey ? apiKey : null);
    setApiKey('');
    setHasStoredKey((prev) => prev || Boolean(apiKey));
  };

  return (
    <div className="space-y-3 rounded-md border border-penumbra-border bg-penumbra-panel p-3">
      <Field label="Display name">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-md border border-penumbra-border bg-black/30 px-2 py-1 text-sm"
        />
      </Field>

      {descriptor.requiresApiKey || providerId === 'openai-compatible' ? (
        <Field
          label={`API key${descriptor.requiresApiKey ? '' : ' (optional)'}`}
          hint={hasStoredKey ? 'A key is already stored — leave blank to keep it.' : undefined}
        >
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasStoredKey ? '••••••••' : 'sk-…'}
            className="w-full rounded-md border border-penumbra-border bg-black/30 px-2 py-1 text-sm"
          />
        </Field>
      ) : null}

      {descriptor.requiresBaseUrl || providerId === 'openai-compatible' ? (
        <Field
          label="Base URL"
          hint={
            providerId === 'ollama'
              ? 'Default: http://localhost:11434'
              : providerId === 'openai-compatible'
                ? 'e.g. https://openrouter.ai/api/v1 or http://localhost:1234/v1'
                : undefined
          }
        >
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={providerId === 'ollama' ? 'http://localhost:11434' : 'https://…'}
            className="w-full rounded-md border border-penumbra-border bg-black/30 px-2 py-1 text-sm"
          />
        </Field>
      ) : null}

      <Field label="Default model" hint={descriptor.suggestedModels.join(', ') || undefined}>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={descriptor.defaultModel}
          className="w-full rounded-md border border-penumbra-border bg-black/30 px-2 py-1 text-sm"
        />
      </Field>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-penumbra-muted">
          {isActive ? '✓ Active provider' : 'Save to set as active'}
        </span>
        <button
          onClick={save}
          className="rounded-md bg-penumbra-accent px-3 py-1.5 text-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-penumbra-muted">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[10px] text-penumbra-muted">{hint}</p>}
    </label>
  );
}
