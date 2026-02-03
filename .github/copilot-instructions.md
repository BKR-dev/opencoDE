# Copilot instructions for OpenCode

## Build, test, lint
- Install deps: `bun install`
- Dev (CLI/TUI): `bun dev` (runs `packages/opencode`); `bun dev <directory>` targets a repo
- API server: `bun dev serve` (default port 4096)
- Typecheck (monorepo): `bun run typecheck`
- Build CLI/localcode: `bun run --cwd packages/opencode build`
- Build desktop app: `bun run --cwd packages/desktop tauri build`
- Lint (opencode): `bun run --cwd packages/opencode lint`
- Tests (do not run from repo root):
  - All opencode tests: `bun run --cwd packages/opencode test`
  - Single opencode test: `bun run --cwd packages/opencode test test/tool/tool.test.ts`
  - App e2e: `bun run --cwd packages/app test:e2e:local` (needs backend at `localhost:4096`)
  - Single e2e: `bun run --cwd packages/app test:e2e:local -- --grep "settings"`

## High-level architecture
- Monorepo with core CLI/server in `packages/opencode`; the TUI lives in `packages/opencode/src/cli/cmd/tui/` (SolidJS + OpenTUI).
- Client/server design: the local server powers multiple clients (TUI, web app, desktop). Clients talk to the server via `@opencode-ai/sdk`.
- Web UI components live in `packages/app`; the desktop app wraps it via Tauri in `packages/desktop`.
- Docs/marketing site lives in `packages/web` (Astro/Starlight). JS SDK source is in `packages/sdk/js`; plugin in `packages/plugin`.
- ACP (Agent Client Protocol) implementation is in `packages/opencode/src/acp` and handles ACP + MCP server configuration.

## Key conventions
- Style guide: prefer `const`, avoid `let` and `else`, avoid `try/catch` where possible, avoid `any`, avoid unnecessary destructuring, prefer single-word names, use Bun APIs (e.g., `Bun.file()`).
- Validation uses Zod; tools implement `Tool.Info` with `execute()`. Use `Log.create({ service })` and `Storage` namespace patterns; DI via `App.provide()`.
- If server endpoints change, run `./script/generate.ts` to regenerate the SDK; rebuild JS SDK with `./packages/sdk/js/script/build.ts`.
- For local UI changes, do not use `opencode dev web` (it proxies prod). Run backend and app dev servers separately:
  - Backend: `bun run --conditions=browser ./src/index.ts serve --port 4096` (from `packages/opencode`)
  - App: `bun dev -- --port 4444` (from `packages/app`)
- SolidJS in app: prefer `createStore` over many `createSignal` calls.
