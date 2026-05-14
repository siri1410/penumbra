import type { ProviderConfig } from '@penumbra/types';
import { OpenAIProvider } from './openai.js';

/**
 * Catch-all for any service that speaks the OpenAI /v1/chat/completions wire
 * format: OpenRouter, Groq, Together AI, Fireworks, DeepInfra, LM Studio,
 * LocalAI, vLLM, llama.cpp's server mode, and friends.
 *
 * It accepts an empty API key (some local servers don't require one) and
 * mandates baseUrl. Vision passthrough works for backends that support it;
 * those that don't will just error from the upstream.
 */
export class OpenAICompatibleProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    if (!config.baseUrl) {
      throw new Error('OpenAI-compatible provider requires a baseUrl');
    }
    super({ ...config, apiKey: config.apiKey ?? 'sk-no-key-required' });
    (this as { id: typeof config.id }).id = 'openai-compatible';
  }
}
