import type { AppConfig, Provider } from '@penumbra/types';
import { createProvider } from '@penumbra/providers';
import { bridge } from './bridge.js';

/**
 * Resolves the active provider config, hydrates its API key from the
 * encrypted secret store, and instantiates the runtime Provider.
 */
export async function getActiveProvider(config: AppConfig): Promise<Provider | null> {
  if (!config.activeProviderId) return null;
  const cfg = config.providers[config.activeProviderId];
  if (!cfg) return null;
  const apiKey = await bridge.config.getSecret(`apiKey:${cfg.id}`);
  return createProvider({ ...cfg, apiKey: apiKey ?? cfg.apiKey });
}
