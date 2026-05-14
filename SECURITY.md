# Security Policy

## Reporting a vulnerability

Please report security issues **privately** rather than opening a public issue.

Email the maintainer or open a [GitHub Security Advisory](https://github.com/siri1410/penumbra/security/advisories/new). We aim to acknowledge reports within 72 hours.

When reporting, please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce
- Any proof-of-concept code or screenshots
- Your environment (OS, Penumbra version, provider in use)

We will coordinate disclosure with you. Reporters are credited in the release notes (or kept anonymous if preferred).

## Supported versions

Penumbra is in active development. We currently support only the latest `main` branch and the most recent release tag. Older versions do not receive security patches.

## Threat model

Penumbra runs as a local desktop application. Notable surfaces:

- **API keys** — stored locally via Electron `safeStorage` (OS keychain on macOS/Windows; libsecret on Linux when available; falls back to plaintext on disk with a warning if unavailable).
- **Screenshots** — captured locally, sent to the configured provider over HTTPS, then discarded by the app. If `autoDeleteScreenshots` is enabled (default) the in-memory copy is dropped after the request.
- **Network egress** — every request goes to the active provider's API. Penumbra does not phone home or call any other endpoint.
- **Renderer process** — runs with `contextIsolation: true`, `nodeIntegration: false`, and a minimal preload bridge. Renderer code cannot directly touch the filesystem or shell.

## Things to know

- Penumbra ships an **OpenAI-compatible** provider that accepts an arbitrary base URL. If you configure a URL you don't trust, that endpoint sees your full prompt and any attached screenshot. Don't point it at sketchy services.
- Custom system prompts (Settings → System prompt) can change model behavior significantly. Treat them like any other user-supplied input.
- Audio and screenshot ingestion currently happen client-side only. We do not upload them to anywhere other than the provider you configure.
