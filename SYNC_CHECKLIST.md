# Upstream Sync Checklist

Use this checklist when reviewing automated sync PRs from upstream.

## Overview

When GitHub Actions creates a sync PR (e.g., `sync/upstream-v2.0.0`), follow these steps to ensure GDPR compliance is maintained.

---

## Phase 1: Pre-Review Verification

- [ ] **PR automatically created** by GitHub Actions
- [ ] **PR title format**: "Sync upstream vX.X.X (GDPR-first)"
- [ ] **Branch naming correct**: `sync/upstream-vX.X.X`
- [ ] **Target branch is** `gdpr/main`
- [ ] **Automated tests ran** (check GitHub Actions status)

---

## Phase 2: Automated Test Results

Check the GitHub Actions results on the PR:

- [ ] **GDPR compliance tests passed** (17/17 tests)
- [ ] **GDPR binary build succeeded** (Linux + macOS)
- [ ] **No unexpected errors** in CI logs

If automated tests failed, investigate before proceeding.

---

## Phase 3: Local Review

### 3.1 Checkout Sync Branch

```bash
# Fetch and checkout the sync branch
git fetch origin
git checkout sync/upstream-vX.X.X

# View the merge commit
git log -1 --stat
```

### 3.2 Review Changed Files

```bash
# See all changed files
git diff gdpr/main...sync/upstream-vX.X.X --name-only

# Focus on GDPR-critical files
git diff gdpr/main...sync/upstream-vX.X.X -- \
  packages/opencode/src/gdpr/ \
  packages/opencode/src/audit/ \
  packages/opencode/src/provider/provider.ts \
  packages/opencode/src/net/egress-policy.ts \
  packages/opencode/src/index.ts \
  packages/opencode/script/build.ts
```

### 3.3 Check GDPR-Critical Files

Verify these files are UNCHANGED or only have non-GDPR changes:

- [ ] `packages/opencode/src/gdpr/build-constants.ts`
- [ ] `packages/opencode/src/audit/gdpr.ts`
- [ ] `packages/opencode/src/audit/network.ts`
- [ ] `packages/opencode/src/cli/cmd/audit.ts`
- [ ] `packages/opencode/script/gdpr-config.ts`
- [ ] `packages/opencode/test/audit/gdpr-compliance.test.ts`

### 3.4 Check Integration Points

Verify GDPR function calls are preserved in:

- [ ] `packages/opencode/src/provider/provider.ts`
  - [ ] `isGitHubOnlyMode()` calls present
  - [ ] GitHub-only enforcement logic intact
- [ ] `packages/opencode/src/provider/models.ts`
  - [ ] `isGitHubOnlyMode()` calls present
- [ ] `packages/opencode/src/net/egress-policy.ts`
  - [ ] `isExternalAPIBlocked()` calls present
  - [ ] `logNetworkRequest()` calls present
- [ ] `packages/opencode/src/index.ts`
  - [ ] `--audit` flag registration intact
  - [ ] `logGDPRStatus()` call at startup
  - [ ] `enableNetworkAudit()` call when flag present
- [ ] `packages/opencode/src/tool/webfetch.ts`
  - [ ] `isGitHubOnlyMode()` check present
- [ ] `packages/opencode/src/tool/websearch.ts`
  - [ ] `isGitHubOnlyMode()` check present

### 3.5 Check for New Providers

If upstream added new AI providers:

- [ ] New providers are NOT accessible in GDPR mode
- [ ] `isGitHubOnlyMode()` check blocks them
- [ ] Provider registration respects GDPR flags

### 3.6 Check for New Network Calls

If upstream added new HTTP/fetch calls:

- [ ] New calls go through `egress-policy.ts`
- [ ] `logNetworkRequest()` is called for audit trail
- [ ] External API calls respect `isExternalAPIBlocked()`

---

## Phase 4: Local Testing

### 4.1 Run GDPR Compliance Tests

```bash
cd packages/opencode
bun test test/audit/gdpr-compliance.test.ts
```

**Expected result**: All 17 tests pass ✅

- [ ] **Test result**: 17 pass, 0 fail

### 4.2 Build GDPR Binary

```bash
cd packages/opencode
bun run build:gdpr-single
```

**Expected result**: Build succeeds, binary created

- [ ] **Build succeeded**: No errors
- [ ] **Binary created**: `dist/opencode-*-gdpr/bin/opencode`

### 4.3 Verify GDPR Status

```bash
./dist/opencode-darwin-arm64-gdpr/bin/opencode auth list
```

**Expected output**:

```
🇪🇺 OpenCode GDPR-Hardened Build
   Build: gdpr (YYYY-MM-DDTHH:MM:SS.SSSZ)
   ✓ GitHub Copilot only (hardcoded)
   ✓ External APIs blocked (hardcoded)
   ✓ Telemetry disabled (hardcoded)
   ✓ Session sharing disabled (hardcoded)
```

- [ ] **Shows**: "GDPR-Hardened Build"
- [ ] **Shows**: "hardcoded" for all restrictions
- [ ] **Does NOT show**: "environment variable" for any setting

### 4.4 Test Tamper-Proofing

```bash
# Try to override with environment variables (should NOT work)
OPENCODE_ONLY_GITHUB=0 ./dist/opencode-*-gdpr/bin/opencode auth list
```

**Expected**: STILL shows "hardcoded" restrictions (ignores env var)

- [ ] **Tamper-proof**: Env vars have no effect

### 4.5 Test Audit Mode

```bash
./dist/opencode-*-gdpr/bin/opencode --audit run "test command"
```

- [ ] **Audit flag works**: No errors
- [ ] **Creates audit log**: `~/.local/share/opencode/log/audit.jsonl`

```bash
./dist/opencode-*-gdpr/bin/opencode audit summary
```

- [ ] **Shows summary**: Request counts, destinations
- [ ] **Verifies**: Only allowed destinations (GitHub, localhost)

### 4.6 Test Provider Restrictions

```bash
./dist/opencode-*-gdpr/bin/opencode auth list
```

- [ ] **Only shows**: GitHub Copilot provider
- [ ] **Does NOT show**: Anthropic, OpenAI, or other providers

```bash
# Try to add non-GitHub provider (should fail)
./dist/opencode-*-gdpr/bin/opencode auth add anthropic
```

- [ ] **Fails gracefully**: Shows GDPR restriction message

---

## Phase 5: Review Upstream Changes

### 5.1 Read Upstream Changelog

Visit: `https://github.com/anomalyxo/opencode/releases/tag/vX.X.X`

- [ ] **Read release notes**: Understand what changed
- [ ] **Identify security fixes**: Note any CVEs or security patches
- [ ] **Identify breaking changes**: Note any API changes
- [ ] **Assess GDPR impact**: Does anything affect compliance?

### 5.2 Check for Dependency Changes

```bash
git diff gdpr/main...sync/upstream-vX.X.X -- package.json
```

- [ ] **New dependencies added**: Review each one
- [ ] **Dependency versions bumped**: Check if security-related
- [ ] **No suspicious dependencies**: No analytics, telemetry, etc.

---

## Phase 6: Merge Decision

### 6.1 Final Checklist

Only merge if ALL of these are true:

- [ ] All automated tests passed
- [ ] All GDPR-critical files unchanged or reviewed
- [ ] All GDPR function calls preserved
- [ ] GDPR binary builds successfully
- [ ] GDPR status shows "hardcoded" restrictions
- [ ] Tamper-proofing verified (env vars ignored)
- [ ] Audit mode works correctly
- [ ] Provider restrictions work
- [ ] No new security concerns
- [ ] Upstream changelog reviewed

### 6.2 Merge the PR

If all checks pass:

```bash
# Merge via GitHub UI or CLI
gh pr merge sync/upstream-vX.X.X --squash

# Or via web: https://github.com/BKR-dev/opencoDE/pull/XXX
```

---

## Phase 7: Post-Merge Actions

### 7.1 Tag the Sync

```bash
# Checkout gdpr/main
git checkout gdpr/main
git pull origin gdpr/main

# Tag the sync for history
git tag sync-vX.X.X -m "Synced with upstream vX.X.X"
git push origin sync-vX.X.X
```

- [ ] **Sync tag created**: `sync-vX.X.X`
- [ ] **Tag pushed**: Visible on GitHub

### 7.2 Update Documentation

Edit `BRANCHING_STRATEGY.md` sync history table:

```markdown
| 2026-XX-XX | vX.X.X | sync/upstream-vX.X.X | #XX | ✅ Complete | No conflicts |
```

- [ ] **Sync history updated**: Date, tag, PR, status, notes

### 7.3 Consider GDPR Release

If upstream changes include:

- Security fixes
- Important features
- Bug fixes

Consider creating a new GDPR release:

```bash
# Bump GDPR version
git checkout gdpr/main
git tag v1.X.X-gdpr -m "GDPR Build v1.X.X - Includes upstream vX.X.X"
git push origin v1.X.X-gdpr

# Build binaries
make build-gdpr

# Create GitHub release
# Upload binaries to: https://github.com/BKR-dev/opencoDE/releases
```

- [ ] **New GDPR release**: If warranted
- [ ] **Release notes**: Document upstream changes included

---

## If Tests Fail

### Conflict Resolution

If merge had conflicts or tests fail:

```bash
# Use the conflict resolution helper
bun run script/resolve-gdpr-conflicts.ts

# Review suggested resolutions
# Edit files manually if needed

# Re-run tests
bun test test/audit/gdpr-compliance.test.ts

# If passing, commit fixes
git add .
git commit -m "fix(gdpr): preserve GDPR compliance after upstream merge"
git push origin sync/upstream-vX.X.X
```

### Common Issues

| Issue                      | Solution                                    |
| -------------------------- | ------------------------------------------- |
| GDPR function call removed | Re-add the function call in same location   |
| File refactored upstream   | Find new location, add GDPR check           |
| New provider added         | Add `isGitHubOnlyMode()` check to block it  |
| New network call added     | Add `logNetworkRequest()` call for audit    |
| Test fails                 | Check what changed, update test or fix code |

---

## Emergency Rollback

If sync causes critical issues:

```bash
# Revert the merge on gdpr/main
git checkout gdpr/main
git revert HEAD -m 1
git push origin gdpr/main

# Document the issue
# Create issue on GitHub
# Investigate and fix before retrying sync
```

---

## Checklist Summary

Quick reference for experienced reviewers:

1. ✅ PR created, tests passed
2. ✅ GDPR-critical files unchanged
3. ✅ GDPR functions preserved
4. ✅ Local tests pass (17/17)
5. ✅ Binary builds and shows "hardcoded"
6. ✅ Tamper-proof (env vars ignored)
7. ✅ Audit mode works
8. ✅ Provider restrictions work
9. ✅ Upstream changelog reviewed
10. ✅ Merge to gdpr/main
11. ✅ Tag sync (sync-vX.X.X)
12. ✅ Update BRANCHING_STRATEGY.md

---

**Time estimate**: ~30-45 minutes for thorough review

**Frequency**: Only when upstream releases new version tags (typically every few weeks)
