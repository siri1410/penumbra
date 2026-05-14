import type { Provider, ProviderConfig, ProviderId } from '@penumbra/types';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';
import { GeminiProvider } from './providers/gemini.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAICompatibleProvider } from './providers/openai-compatible.js';

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  supportsVision: boolean;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  defaultModel: string;
  suggestedModels: string[];
  docsUrl: string;
}

export const PROVIDER_CATALOG: readonly ProviderDescriptor[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    supportsVision: true,
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultModel: 'claude-opus-4-7',
    suggestedModels: [
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ],
    docsUrl: 'https://docs.anthropic.com/',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    supportsVision: true,
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultModel: 'gpt-4o',
    suggestedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'],
    docsUrl: 'https://platform.openai.com/docs',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    supportsVision: true,
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultModel: 'gemini-2.0-flash',
    suggestedModels: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-thinking-exp',
      'gemini-1.5-pro',
    ],
    docsUrl: 'https://ai.google.dev/',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    supportsVision: true,
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultModel: 'llama3.2-vision',
    suggestedModels: ['llama3.2-vision', 'llava', 'qwen2.5-coder', 'mistral'],
    docsUrl: 'https://ollama.com/',
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible (OpenRouter, Groq, LM Studio, vLLM, LocalAI)',
    supportsVision: true,
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultModel: '',
    suggestedModels: [],
    docsUrl: 'https://openrouter.ai/docs',
  },
];

export function getDescriptor(id: ProviderId): ProviderDescriptor {
  const found = PROVIDER_CATALOG.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown provider id: ${id}`);
  return found;
}

export function createProvider(config: ProviderConfig): Provider {
  switch (config.id) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config);
  }
}
