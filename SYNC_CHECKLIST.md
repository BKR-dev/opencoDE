# Upstream Sync Checklist

Use when a sync PR arrives (auto-created daily by CI when a new upstream release is detected).

---

## Phase 1: PR Review

- [ ] PR title: `sync: upstream vX.X.X`
- [ ] Branch: `sync/upstream-vX.X.X` → base `gdpr/main`
- [ ] PR body shows conflict status and list of files changed upstream
- [ ] If conflicts flagged: plan to resolve before merging

---

## Phase 2: Local Checkout

```bash
git fetch origin
git checkout sync/upstream-vX.X.X

# Review what changed upstream vs gdpr/main
git diff gdpr/main...HEAD --name-only

# Check GDPR-critical files specifically
git diff gdpr/main...HEAD -- \
  packages/opencode/src/gdpr/ \
  packages/opencode/src/audit/ \
  packages/opencode/src/provider/provider.ts \
  packages/opencode/src/net/egress-policy.ts \
  packages/opencode/src/index.ts
```

If conflicts are present (conflict markers in files), resolve them now before testing.

---

## Phase 3: GDPR-Critical Files

Verify these integration points survived the merge:

- [ ] `src/provider/provider.ts` — `isGitHubOnlyMode()` calls intact
- [ ] `src/provider/models.ts` — `isGitHubOnlyMode()` blocks models.dev
- [ ] `src/net/egress-policy.ts` — `isExternalAPIBlocked()` and `logNetworkRequest()` calls intact
- [ ] `src/index.ts` — `--audit` flag, `logGDPRStatus()`, `enableNetworkAudit()` present
- [ ] `src/tool/webfetch.ts` — `isGitHubOnlyMode()` check present
- [ ] `src/tool/websearch.ts` — `isGitHubOnlyMode()` check present
- [ ] `src/share/share.ts` — session sharing disabled in GDPR mode

If upstream added a new AI provider or new external HTTP call, verify it is gated behind `isGitHubOnlyMode()` / `isExternalAPIBlocked()`.

---

## Phase 4: Local Validation

```bash
# Build GDPR binary and run a real audit session (requires GitHub Copilot auth)
make validate-gdpr
```

Inspect the printed audit log path:

- [ ] `gdpr.provider.usage` event present
- [ ] `audit.network.request` events present
- [ ] No requests to non-GitHub domains
- [ ] Session completed without errors

Optional deeper checks:

```bash
make test-gdpr     # GDPR unit tests
make verify-gdpr   # Code-level compliance checks
```

---

## Phase 5: Merge

- [ ] All checks above pass
- [ ] Conflicts resolved (if any)

```bash
gh pr merge <PR-NUMBER> --squash --delete-branch
```

---

## Phase 6: Post-Merge

```bash
# Update state file so CI doesn't re-open this PR tomorrow
echo "vX.X.X" > .github/upstream-version
git add .github/upstream-version
git commit -m "chore: update upstream-version to vX.X.X post-merge"
git push origin gdpr/main
```

Update sync history in `BRANCHING_STRATEGY.md`.

---

## Troubleshooting

**GDPR function missing after merge:**

```bash
grep -r "isGitHubOnlyMode" packages/opencode/src/
grep -r "isExternalAPIBlocked" packages/opencode/src/
# If missing, re-add at the same location following existing patterns
```

**Binary build fails:**

```bash
cd packages/opencode && bun install
bun run script/build.ts --gdpr --single
```

**Emergency rollback:**

```bash
git revert HEAD -m 1   # Creates a revert commit, safe
git push origin gdpr/main
```
