# Upstream Sync Automation — Design Spec

**Date:** 2026-04-23  
**Status:** Approved  
**Scope:** Lean CI workflow to detect upstream releases and open merge PRs; local Makefile target for GDPR validation

---

## Problem

The GDPR fork has no automated way to track upstream releases from `anomalyco/opencode`. Keeping the fork current requires manually pulling upstream, resolving conflicts, re-applying GDPR patches, and verifying compliance — all with no guidance or tooling. The existing `.github/workflows/` setup is overly complex and not usable in the current free-tier context.

---

## Goals

1. Automatically detect new upstream release tags daily
2. Create a merge branch and PR without human intervention
3. Always produce a PR (even with conflict markers) so the developer can `git pull` and resolve
4. Provide `make validate-gdpr` as the single local command to build the GDPR binary and run compliance validation
5. Keep CI minutes minimal — no builds, no tests in CI

---

## Non-Goals

- Running tests or building the binary in CI
- Real-time (sub-hour) release detection
- Auto-merging anything
- Replacing or removing existing GDPR tests — these are preserved and extended via the Makefile

---

## Architecture

```
[GitHub Actions — daily schedule]
         │
         ▼
 Read .github/upstream-version
         │
         ▼
 Query anomalyco/opencode latest release tag (GitHub API)
         │
    New tag?
    ├── No  → exit (zero minutes wasted)
    └── Yes
         │
         ▼
 Checkout gdpr/main
 Add upstream remote
 Fetch tag only
 git merge -X ours (never abort — conflict markers on conflicts)
 Push sync/upstream-vX.X.X
         │
         ▼
 Open PR to gdpr/main
 PR body: tag, upstream release link, changed files list
         │
         ▼
[Developer]
 git pull sync/upstream-vX.X.X
 Resolve conflicts if any
 make validate-gdpr
 Inspect audit log
 Merge if satisfied
 .github/upstream-version updated post-merge
```

---

## Components

### 1. State File — `.github/upstream-version`

- Plain text file, one line: the last merged upstream tag (e.g. `v1.2.15`)
- Committed to `gdpr/main`
- Read by the detection workflow to determine if a new release exists
- Updated manually (or via a post-merge step) after each successful sync merge

### 2. Workflow — `.github/workflows/sync-upstream.yml`

**Triggers:**
- `schedule`: daily at 06:00 UTC
- `workflow_dispatch`: optional `tag` input to target a specific upstream tag (useful for manual catch-up or testing)

**Steps:**
1. Read `.github/upstream-version` to get the current synced tag
2. Call GitHub API `GET /repos/anomalyco/opencode/releases/latest` — no checkout, no minutes for this step
3. Compare tags — exit early if equal
4. Checkout `gdpr/main` (shallow `--depth=1`)
5. Add `anomalyco/opencode` as a remote
6. Fetch only the target tag (`git fetch upstream refs/tags/vX.X.X`)
7. Create branch `sync/upstream-vX.X.X`
8. Run `git merge -X ours FETCH_HEAD --no-edit --allow-unrelated-histories`  
   — merge never aborts; conflict markers are committed as-is
9. Push branch to origin
10. Create PR to `gdpr/main` via `gh pr create` with body:
    - New upstream tag and link to release notes
    - List of files changed in the upstream tag vs current `gdpr/main`
    - Note if conflicts were detected
    - Instructions: `git pull`, resolve if needed, `make validate-gdpr`, inspect audit log

**Permissions required:**
- `contents: write` (push branch)
- `pull-requests: write` (open PR)
- Uses default `GITHUB_TOKEN` — no extra secrets needed for the workflow itself

**Minute estimate:** ~2–3 minutes per run when a new tag exists (git fetch + merge + push). Under 30 seconds when no new tag (API call only).

### 3. Makefile — `Makefile` (repo root)

```makefile
validate-gdpr:
	cd packages/opencode && bun run build:gdpr-single
	./packages/opencode/dist/opencode-$(shell uname -s | tr A-Z a-z)-$(shell uname -m)-gdpr/bin/opencode \
	  --audit run \
	  --model github-copilot/claude-sonnet-4-6 \
	  "Use the available skills and web search to summarize the GDPR compliance status of this project"
	@echo ""
	@echo "Audit log written. Inspect with:"
	@echo "  cat ~/.local/share/opencode/audit.jsonl | jq ."
```

- Builds the GDPR binary fresh on each run
- Runs a real session with `--audit`, a real model, and a prompt that exercises skills + web search
- Prints the audit log location for manual inspection
- All existing tests in `packages/opencode/test/audit/gdpr-compliance.test.ts` remain intact and can be run separately via `bun test`
- The `validate-gdpr` target is the primary integration check; unit tests remain as regression coverage

---

## What Gets Replaced

| Existing | Replacement |
|---|---|
| `.github/workflows/sync-upstream.yml` (complex, manual-trigger only) | New lean scheduled workflow (same filename) |
| `.github/workflows/test-gdpr.yml` (CI test runner) | Removed — tests move to `make validate-gdpr` |
| `script/resolve-gdpr-conflicts.ts` | Kept as optional manual aid; no longer part of any automated flow |
| `SYNC_CHECKLIST.md` | Kept as human reference; superseded by PR description template for routine syncs |

---

## GDPR-Critical Files — Merge Safety

The `-X ours` strategy means any conflict in GDPR-owned files resolves to the fork's version automatically. The files that must never regress are:

- `packages/opencode/src/gdpr/build-constants.ts`
- `packages/opencode/src/net/egress-policy.ts`
- `packages/opencode/src/provider/provider.ts`
- `packages/opencode/src/audit/gdpr.ts`
- `packages/opencode/src/audit/network.ts`

If upstream touches these files without conflict, `-X ours` still wins. The developer reviews the diff in the PR to confirm upstream changes don't introduce a regression that isn't a conflict (e.g. upstream adds a new provider registration that bypasses the filter).

---

## Success Criteria

- A new upstream release tag results in a PR on `gdpr/main` within 24 hours, with no manual steps
- `make validate-gdpr` builds a working GDPR binary, runs a real session, and produces an audit log
- The audit log contains `gdpr.provider.usage` and `audit.network.request` events
- No external API calls appear in the audit log
- CI minutes consumed: ≤ 3 min/day on days with a new release, ~0 on days without

---

## Future Improvements

- Expand `make validate-gdpr` to validate specific audit log events programmatically (not just visually)
- Add a post-merge GitHub Actions step to auto-update `.github/upstream-version` after PR merge
- Add a PR body diff that highlights changes to GDPR-critical files specifically
