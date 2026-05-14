import type { AppConfig } from '@penumbra/types';
import { DEFAULT_SYSTEM_PROMPT } from '../prompts/system.js';

export const DEFAULT_CONFIG: AppConfig = {
  activeProviderId: null,
  providers: {},
  hotkeys: {
    toggle: 'CommandOrControl+B',
    capture: 'CommandOrControl+H',
    focusChat: 'CommandOrControl+J',
    settings: 'CommandOrControl+,',
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  autoDeleteScreenshots: true,
};
