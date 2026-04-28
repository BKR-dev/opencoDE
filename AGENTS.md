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
| `src/tool/webfetch.ts` | `isGitHubOnlyMode()` check present |
| `src/tool/websearch.ts` | `isGitHubOnlyMode()` check present |
| `src/share/share.ts` | Session sharing disabled in GDPR mode |
