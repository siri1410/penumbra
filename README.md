# Penumbra

> Your AI in the margins.

Penumbra is an invisible, always-on-top desktop overlay that puts a multi-model AI assistant one keystroke away. Snap a screenshot, drop in an audio file, or chat — and get an answer from Claude, GPT, Gemini, or a model running on your own machine.

Inspired by [free-cluely](https://github.com/Prat011/free-cluely) and rebuilt from scratch with a provider-agnostic architecture, a clean monorepo, and first-class Claude support.

## Highlights

- **Truly invisible** — translucent always-on-top window, hides from screen sharing, no taskbar entry.
- **Multi-provider out of the box** — Anthropic Claude, OpenAI GPT, Google Gemini, Ollama, and any OpenAI-compatible endpoint (OpenRouter, Groq, Together, LM Studio, LocalAI, vLLM, llama.cpp).
- **Vision + screenshot** — capture any region of your screen and ask anything about it. Auto-deletes after processing.
- **Audio in** — drop in a recording and get a transcript or summary.
- **Global hotkeys** — toggle, capture, ask, hide. Never break your flow.
- **Local-first option** — run Ollama or LM Studio and Penumbra never leaves your machine.
- **Encrypted key storage** — API keys are stored via Electron `safeStorage` (OS keychain).

## Quick start

```bash
git clone https://github.com/siri1410/penumbra.git
cd penumbra
corepack enable
pnpm install
pnpm dev
```

On first launch, open the settings panel (`Cmd/Ctrl + ,`) and add at least one provider key.

## Hotkeys

| Action                 | macOS         | Windows / Linux |
|------------------------|---------------|-----------------|
| Toggle window          | `Cmd + B`     | `Ctrl + B`      |
| Capture & ask          | `Cmd + H`     | `Ctrl + H`      |
| Focus chat             | `Cmd + J`     | `Ctrl + J`      |
| Open settings          | `Cmd + ,`     | `Ctrl + ,`      |
| Quit                   | `Cmd + Q`     | `Ctrl + Q`      |

All hotkeys are remappable in settings.

## Architecture

Penumbra is a pnpm monorepo:

```
penumbra/
├── apps/
│   └── desktop/          Electron + React + Vite overlay app
├── packages/
│   ├── core/             Chat state, prompt builders, screenshot pipeline
│   ├── providers/        Unified provider interface + adapters
│   └── types/            Shared TypeScript types
```

### Adding a provider

Implement the `Provider` interface in `packages/providers/src/types.ts` and register it in `packages/providers/src/registry.ts`. See `anthropic.ts` for the canonical example.

## Roadmap

- [ ] Built-in audio transcription via Whisper (local)
- [ ] Plugin API for custom tools
- [ ] Conversation history & search
- [ ] Multi-window workspaces
- [ ] Linux Wayland screenshot support

## License

MIT — see [LICENSE](./LICENSE).
