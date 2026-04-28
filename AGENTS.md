- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `gdpr/main`.
- Never modify `packages/opencode/src/gdpr/` without understanding GDPR implications.
- Always preserve `isGitHubOnlyMode()` and `isExternalAPIBlocked()` calls when refactoring.

---

# OpenCode GDPR Edition

GDPR-hardened fork of `anomalyco/opencode` for the European market. GitHub Copilot is the only permitted LLM provider. All restrictions are baked in at build time — they cannot be overridden at runtime via config or environment variables.

---

## GDPR Compliance

Four mechanisms enforce compliance:

| Mechanism | What it does | Key file |
|---|---|---|
| Provider lock | Only `github-copilot` provider loads | `src/provider/provider.ts` |
| Egress block | Non-GitHub network requests blocked | `src/net/egress-policy.ts` |
| Build-time hardening | Restrictions compiled in via Bun `define` | `src/gdpr/build-constants.ts` |
| Audit trail | All requests logged to JSONL on `--audit` | `src/audit/gdpr.ts`, `src/audit/network.ts` |

**Two functions that must never be removed:**

```typescript
isGitHubOnlyMode()      // Returns true in GDPR builds — gates provider filtering
isExternalAPIBlocked()  // Returns true in GDPR builds — gates egress policy
```

**Allowed domains:** `api.github.com`, `raw.githubusercontent.com`, `localhost`

**GDPR articles addressed:** Art. 5 (minimization), Art. 25 (privacy by design), Art. 28 (processor), Art. 30 (audit logging), Art. 32 (security), Art. 44-50 (international transfers).

---

## Build & Validate

```bash
# Build GDPR binary for current platform
make build-gdpr-single
# Binary: packages/opencode/dist/opencode-{os}-{arch}-gdpr/bin/opencode

# Build GDPR binaries for all platforms
make build-gdpr

# Run a real audit session to validate GDPR compliance (requires GitHub Copilot auth)
make validate-gdpr
# Builds binary, runs --audit session, prints audit log location for inspection

# Run GDPR unit tests
make test-gdpr

# Run code-level GDPR checks
make verify-gdpr
```

**Standard build** (no GDPR restrictions): `bun run build` or `make build`

---

## CI / Upstream Sync

Upstream sync is driven by local `make` commands using upstream GitHub release tags. The Makefile, not a GitHub Actions workflow, is the source of truth for this process.

Rehearsal-proven structure:

- Run sync work in a dedicated worktree, not the main checkout
- Use `sync/upstream-vX.X.X` as the working branch for a target tag
- Treat the sync as three layers: workflow hardening, upstream baseline restore, GDPR reapply
- Keep `gdpr/main` clean until the sync branch validates locally

Normal flow:

```bash
# Step 1: validate environment and repo state
make sync-preflight TAG=vX.X.X

# Step 2: detect the target release tag and prepare the sync branch
make sync-check TAG=vX.X.X

# Step 3: review the sync branch locally
make sync-checkout TAG=vX.X.X

# Step 4: run local GDPR validation
make sync-validate
make verify-gdpr

# Step 5: merge the open sync PR
make sync-merge
```

Behavioral notes:

- `sync-preflight` is the first command for maintainers and AI agents
- Source of truth is the latest upstream GitHub release tag, or an explicit `TAG=vX.X.X`
- `sync-check` is safe to run from cron when already up to date
- `sync-check` creates or resets the local `sync/upstream-vX.X.X` branch from `origin/gdpr/main` and reuses an existing PR if one is already open
- Validation remains manual via `make sync-validate` and `make verify-gdpr`
- Agents should classify failures into environment, git/worktree, merge, baseline health, validation, or remote-integration failures
- Agents may fix issues within a clearly identified bucket, but should stop and report if root cause is unclear

Operational rules from the `v1.14.23` rehearsal:

- Always run sync work from a clean dedicated worktree rooted at `origin/gdpr/main`
- If `sync-check` reintroduces known-bad `packages/opencode` merge state, replay the validated repair commits or reapply the same repair sequence instead of hand-merging large corrupted files repeatedly
- When `packages/opencode` is broken after the upstream merge, the stable repair order is:
  1. restore `packages/opencode` to the upstream tag baseline,
  2. reapply only intentional GDPR restrictions,
  3. verify with focused `packages/opencode` checks before wider repo validation
- Keep commit boundaries logical during repair work:
  1. sync workflow/docs hardening,
  2. upstream `packages/opencode` baseline restore,
  3. GDPR reapply,
  4. validation-fix follow-ups if needed
- Do not trust stale static validation checks blindly; if `make verify-gdpr` fails but the code clearly contains the guard, update the verifier to match the live file layout before diagnosing product code
- If `sync-validate` fails with `bun.lock` duplicate-key or extraction errors after a conflict-heavy merge, confirm the lockfile is actually invalid and regenerate it with `bun install --lockfile-only` before retrying the build
- `sync-validate` is allowed to be long-running; use a longer command timeout than basic typecheck/test steps
- Before merging the sync branch back to `gdpr/main`, re-run validation on the merge result, not just on the rehearsal branch

**After merging a sync PR:**

```bash
echo "vX.X.X" > .github/upstream-version
git add .github/upstream-version
git commit -m "chore: update upstream-version to vX.X.X post-merge"
git push origin gdpr/main
```

After merging a sync PR, update `.github/upstream-version` on `gdpr/main` and push it.

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `gdpr/main` | Primary branch — always GDPR-compliant |
| `sync/upstream-vX.X.X` | Release-tag sync branch created by `make sync-check` |
| `feat/*`, `fix/*` | Short-lived working branches |

---

## GDPR-Critical Files

These files must be reviewed after every upstream sync:

| File | What to verify |
|---|---|
| `src/gdpr/build-constants.ts` | Build-time flags intact |
| `src/net/egress-policy.ts` | `isExternalAPIBlocked()` calls present |
| `src/provider/provider.ts` | `isGitHubOnlyMode()` calls present |
| `src/provider/models.ts` | `isGitHubOnlyMode()` blocks models.dev |
| `src/audit/gdpr.ts` | GDPR audit event functions present |
| `src/audit/network.ts` | Network request logging intact |
| `src/index.ts` | `--audit` flag and `logGDPRStatus()` present |
| `script/build.ts` | GDPR build path still hardcodes the restricted build flags |
| `package.json` | GDPR build/validation scripts still point at the intended paths |
| `src/plugin/index.ts` | GitHub-only mode disables plugin loading/origins as expected |
| `src/tool/webfetch.ts` | `isGitHubOnlyMode()` check present |
| `src/tool/websearch.ts` | `isGitHubOnlyMode()` check present |
| `src/share/session.ts` | Session sharing is disabled in GDPR mode |
| `src/share/share-next.ts` | Share backend respects GDPR session-sharing disablement |

Notes from the `v1.14.23` rehearsal:

- `src/share/share.ts` is obsolete in the current upstream layout; the live sharing path is `src/share/session.ts` plus `src/share/share-next.ts`
- `src/server/routes/provider.ts` was also obsolete in the repaired sync and should not be restored without checking the current upstream architecture first
- Guard coverage that proved useful during sync repair lives in:
  - `packages/opencode/test/gdpr/guards.test.ts`
  - `packages/opencode/test/tool/websearch.test.ts`
  - `packages/opencode/test/tool/webfetch.test.ts`
  - `packages/opencode/test/provider/provider.test.ts`

## Leftover Sync Docs

These files are implementation-history notes from the `v1.14.23` sync rehearsal:

- `docs/superpowers/specs/2026-04-27-sync-hardening-and-parser-repair-design.md`
- `docs/superpowers/plans/2026-04-27-sync-hardening-and-parser-repair.md`

Use them for context when a future sync run needs the reasoning behind the hardened workflow or the repair sequence.

Rules for future runs:

- Treat `Makefile`, `HOW-TO-UPDATE-GDPR.md`, and this `AGENTS.md` as the operational source of truth
- Treat the `docs/superpowers/*` files as historical design/plan references, not required release artifacts
- Do not automatically stage, commit, or push those leftover docs unless the user explicitly asks to preserve the planning history in git
