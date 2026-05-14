# Contributing to Penumbra

Thanks for considering a contribution! Penumbra is small, opinionated, and intentionally easy to read end-to-end.

## Dev setup

```bash
corepack enable
pnpm install
pnpm dev
```

The desktop app lives in `apps/desktop`. Shared code lives in `packages/*`. The renderer hot-reloads; the main process hot-reloads on save via `vite-plugin-electron`.

## Adding a provider

1. Implement the `Provider` interface in `packages/providers/src/providers/<name>.ts`.
2. Register it in `packages/providers/src/registry.ts` (descriptor + `createProvider` switch).
3. Confirm vision support if applicable.

The existing adapters (Anthropic, OpenAI, Gemini, Ollama, OpenAI-compatible) are reference implementations — copy the closest match.

## Code style

- TypeScript strict mode, no `any` without a comment.
- No comments unless the *why* is non-obvious.
- Prettier defaults; run `pnpm prettier --write .` before committing.

## Pull requests

- Keep PRs focused. A new provider, a UI tweak, and a bug fix should be three PRs, not one.
- Include a "Test plan" section in the description.
- CI must be green.
