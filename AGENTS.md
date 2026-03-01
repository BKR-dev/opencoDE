- To test opencode in `packages/opencode`, run `bun dev`.
- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `gdpr/main`.

---

# OpenCode GDPR Edition - European Market Fork

## Project Vision

This is a **GDPR-hardened fork of OpenCode** designed specifically for the **European market**. The fork implements comprehensive data protection compliance through build-time hardening and full audit logging, ensuring that no user data leaves approved boundaries without explicit traceability.

**Core Objective**: Create a code assistant that meets EU data sovereignty requirements while providing full transparency to external auditors.

---

## Four Pillars of GDPR Compliance

### 1. No API Calls Outside Configured LLM Provider

**Implementation**:

- Build-time constants lock provider selection to GitHub Copilot only
- Egress policy blocks all external network requests except GitHub domains
- Package loader restricted to `@ai-sdk/github-copilot` only

**Key Files**:

- `packages/opencode/src/net/egress-policy.ts` - Network request blocking
- `packages/opencode/src/provider/provider.ts` - Provider filtering
- `packages/opencode/src/gdpr/build-constants.ts` - Build-time flags

**How It Works**:

```typescript
// In GDPR builds, these compile to `return true`:
isGitHubOnlyMode()     // Always true - only GitHub Copilot allowed
isExternalAPIBlocked() // Always true - blocks all external egress

// Allowed domains whitelist:
ALLOWED_DOMAINS = {"api.github.com", "raw.githubusercontent.com", "localhost"}
```

### 2. Full Audit Tracing for External Auditors

**Implementation**:

- `--audit` flag enables comprehensive network logging
- All HTTP requests logged to JSONL audit files
- Provider usage, external APIs, data transfers tracked
- Real-time console logging during execution

**Key Files**:

- `packages/opencode/src/audit/gdpr.ts` - GDPR-specific audit events
- `packages/opencode/src/audit/network.ts` - Network request logging
- `packages/opencode/src/cli/cmd/audit.ts` - Audit CLI commands

**Usage**:

```bash
# Run with audit mode
./opencode-gdpr --audit run "Implement feature X"

# Verify compliance
./opencode audit verify
```

**Logged Events**:

- `gdpr.provider.usage` - LLM provider/model used
- `gdpr.external.api` - Third-party API calls (blocked)
- `gdpr.data.transfer` - Data sent to external parties
- `gdpr.config.change` - Configuration modifications
- `gdpr.consent` - User consent decisions
- `audit.network.request` - All HTTP requests

### 3. Runtime Provider Modification Impossible

**Implementation**:

- Provider list hardcoded at build time
- Config file overrides ignored in GDPR mode
- Environment variable bypass attempts blocked
- Dynamic provider loading disabled

**Key Files**:

- `packages/opencode/src/gdpr/build-constants.ts` - Tamper-proof flags
- `packages/opencode/src/provider/provider.ts` - Provider enforcement

**How It Works**:

```typescript
// GDPR build: OPENCODE_GDPR_ONLY_GITHUB = true (compiled in)
// Runtime attempts to override are IGNORED:

// config.json: { "enabled_providers": ["openai"] }  ← IGNORED
// env: OPENCODE_ONLY_GITHUB=0                        ← IGNORED

// All provider filtering checks the BUILD-TIME constant,
// not runtime variables, in GDPR builds.
```

### 4. Build-Time Provider Configuration

**Implementation**:

- Two build modes: `standard` and `gdpr`
- GDPR build bakes restrictions into binary via Bun's `define`
- Dead code elimination removes non-GDPR code paths
- Binary naming: `opencode-{os}-{arch}-gdpr`

**Key Files**:

- `packages/opencode/script/gdpr-config.ts` - Build configuration
- `packages/opencode/script/build.ts` - Build process
- `packages/opencode/src/gdpr/build-constants.ts` - Runtime API

**Build Commands**:

```bash
# Standard build (runtime flexibility)
bun run build

# GDPR-hardened build (locked down)
bun run build:gdpr

# Output: opencode-linux-x64-gdpr, opencode-darwin-arm64-gdpr, etc.
```

**Build-Time Injection**:

```typescript
// Bun's `define` replaces placeholders at compile time:
declare const OPENCODE_GDPR_ONLY_GITHUB: boolean

// In GDPR build, becomes:
const OPENCODE_GDPR_ONLY_GITHUB = true // Hardcoded, immutable
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GDPR Build Pipeline                          │
├─────────────────────────────────────────────────────────────────┤
│  bun run build:gdpr                                             │
│       ↓                                                         │
│  Bun Compiler (define: { GDPR_FLAGS: "true" })                 │
│       ↓                                                         │
│  Dead Code Elimination (removes non-GDPR paths)                 │
│       ↓                                                         │
│  opencode-{os}-{arch}-gdpr Binary                               │
│       ↓                                                         │
│  Runtime: All flags hardcoded, cannot be overridden            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Runtime Enforcement                           │
├─────────────────────────────────────────────────────────────────┤
│  User Request → Provider Loader                                 │
│       ↓                                                         │
│  isGitHubOnlyMode()? ──→ true (hardcoded)                        │
│       ↓                                                         │
│  Filter: Only github-copilot allowed                            │
│       ↓                                                         │
│  Network Request → Egress Policy                                │
│       ↓                                                         │
│  isExternalAPIBlocked()? ──→ true (hardcoded)                   │
│       ↓                                                         │
│  Block non-GitHub requests                                      │
│       ↓                                                         │
│  Audit: Log all attempts (allowed & blocked)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## GDPR Articles Addressed

| Article    | Requirement             | Implementation                              |
| ---------- | ----------------------- | ------------------------------------------- |
| Art. 5     | Data minimization       | GitHub-only, no external APIs               |
| Art. 6     | Lawful basis            | Opt-in session sharing, telemetry disabled  |
| Art. 7     | Consent                 | Consent logging, disabled defaults          |
| Art. 25    | Privacy by design       | Build-time hardening                        |
| Art. 28    | Processor agreements    | Only GitHub Copilot used                    |
| Art. 30    | Audit logging           | Comprehensive JSONL audit trail             |
| Art. 32    | Security                | Network isolation, egress blocking          |
| Art. 44-50 | International transfers | Blocked external APIs, all transfers logged |

---

## Quick Reference

### Environment Variables (Standard Build Only)

```bash
OPENCODE_ONLY_GITHUB=1           # GitHub Copilot only
OPENCODE_BLOCK_EXTERNAL_APIS=1   # Block all external egress
OPENCODE_DISABLE_TELEMETRY=1     # Disable analytics
OPENCODE_DISABLE_SHARE=1         # Disable session sharing
OPENCODE_AUDIT_PATH=/path        # Custom audit log location
```

**Note**: In GDPR builds, these are hardcoded and ignored.

### Commands

```bash
# Build GDPR binary
bun run build:gdpr

# Run with audit mode
./opencode-gdpr --audit run "task"

# Verify compliance
./opencode-gdpr audit verify

# View audit logs
./opencode-gdpr audit view

# Sync with upstream
bun run script/resolve-gdpr-conflicts.ts
```

### Key Directories

```
packages/opencode/src/
├── gdpr/              # Build-time GDPR constants
├── audit/             # Audit logging (gdpr.ts, network.ts)
├── net/               # Egress policy
├── provider/          # Provider filtering
└── cli/cmd/           # Audit CLI commands
```

---

## Documentation Index

| File                               | Purpose                             | Audience        |
| ---------------------------------- | ----------------------------------- | --------------- |
| `GDPR_EXECUTIVE_SUMMARY.md`        | Business value proposition          | C-Suite, Buyers |
| `GDPR_ONE_PAGER.md`                | Quick reference for decision makers | Executives      |
| `GDPR_COMPLIANCE_CERTIFICATION.md` | Official compliance documentation   | DPOs, Auditors  |
| `GDPR_PROVIDER_AUDIT.md`           | Detailed provider/API analysis      | Technical Leads |
| `GDPR_BUILD_HARDENING.md`          | Build-time hardening guide          | Engineers       |
| `GDPR_FORK_MAINTENANCE.md`         | Fork maintenance procedures         | DevOps          |
| `NETWORK_AUDIT_MODE.md`            | Audit mode usage guide              | Security Teams  |
| `GDPR_QUICK_REFERENCE.md`          | Quick compliance checklist          | All Users       |
| `SYNC_CHECKLIST.md`                | Upstream sync procedures            | Maintainers     |

---

## Branch Strategy

```
gdpr/main              ← Primary branch (GDPR-compliant)
├── gdpr/v1.x-releases
├── sync/upstream-vX   ← Temporary sync branches
└── dev                ← Upstream mirror (reference only)
```

**Never merge to `gdpr/main` without**:

1. Running GDPR test suite: `bun test test/audit/gdpr-compliance.test.ts`
2. Building GDPR binary: `bun run build:gdpr-single`
3. Verifying GDPR status output
4. Following `SYNC_CHECKLIST.md`

---

## Upstream Sync Strategy

### Challenge

Upstream development velocity is **extremely high**: 415 releases in 6 months (Aug 2025 - Feb 2026), averaging **2-3 releases per day** with peak days seeing up to 14 releases.

### Sync Frequency Recommendation

| Sync Type          | Frequency          | Trigger                               |
| ------------------ | ------------------ | ------------------------------------- |
| **Security fixes** | Immediately        | Upstream security tag or CVE advisory |
| **Feature sync**   | Monthly            | Manual trigger via GitHub Actions     |
| **Major version**  | ASAP after testing | Upstream `vX.0.0` tag                 |

### Existing Automation

Your fork has comprehensive sync automation:

```
.github/workflows/sync-upstream.yml  → Manual tag-based sync
.github/workflows/test-gdpr.yml     → Automated GDPR tests
script/resolve-gdpr-conflicts.ts    → Conflict resolution
SYNC_CHECKLIST.md                   → 12-phase review process
```

### Sync Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Automated Sync Process                        │
├─────────────────────────────────────────────────────────────────┤
│  1. MANUAL TRIGGER (GitHub Actions UI)                          │
│     → Enter upstream tag (e.g., v1.2.0)                         │
│                                                                  │
│  2. WORKFLOW CREATES SYNC BRANCH                                 │
│     → sync/upstream-v1.2.0                                      │
│     → Merges with `-X ours` (GDPR-first)                        │
│                                                                  │
│  3. AUTOMATED TESTS RUN                                          │
│     → 17 GDPR compliance tests                                   │
│     → Binary build verification                                  │
│                                                                  │
│  4. PR CREATED TO gdpr/main                                      │
│     → Includes review checklist                                 │
│     → Labels: upstream-sync, needs-review                       │
│                                                                  │
│  5. MANUAL REVIEW (~30 min)                                      │
│     → Follow SYNC_CHECKLIST.md                                  │
│     → Verify GDPR-critical files unchanged                       │
│     → Run local tests                                            │
│                                                                  │
│  6. MERGE & TAG                                                  │
│     → Tag: sync-v1.2.0                                          │
│     → Update BRANCHING_STRATEGY.md sync history                  │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Sync Cadence

**Monthly sync** (suggested): Captures upstream features while minimizing maintenance overhead.

```bash
# Quick sync (when you want new features)
1. Go to: https://github.com/BKR-dev/opencoDE/actions/workflows/sync-upstream.yml
2. Check latest upstream tag: https://github.com/anomalyco/opencode/tags
3. Click "Run workflow" → enter tag → run
4. Review PR (~30 min)
5. Merge if tests pass
```

### Safety Guarantees

| Mechanism           | Protection                                           |
| ------------------- | ---------------------------------------------------- |
| Fork-only execution | Workflow only runs in BKR-dev/opencoDE               |
| Manual trigger only | No automatic cron jobs, no surprise runs             |
| GDPR-first merge    | `git merge -X ours` preserves GDPR code              |
| Automated tests     | 17 GDPR tests must pass                              |
| Manual review       | Human approval required                              |
| Conflict helper     | `resolve-gdpr-conflicts.ts` auto-resolves GDPR files |

### Key Integration Points to Monitor

When syncing, verify these files preserve GDPR logic:

| File                       | What to Check                                |
| -------------------------- | -------------------------------------------- |
| `src/provider/provider.ts` | `isGitHubOnlyMode()` calls intact            |
| `src/net/egress-policy.ts` | Network blocking logic preserved             |
| `src/index.ts`             | `--audit` flag and `logGDPRStatus()` present |
| `src/provider/models.ts`   | `isGitHubOnlyMode()` blocking models.dev     |
| `src/share/share.ts`       | Session sharing disabled in GDPR mode        |
| `src/tool/webfetch.ts`     | External fetch blocking                      |
| `src/tool/websearch.ts`    | External search blocking                     |

### Future Automation Opportunities

Consider adding:

1. **Release Monitor Workflow** - Weekly check for new upstream tags (creates issue, not PR)
2. **Automated Changelog Diff** - AI-generated summary of upstream changes
3. **Security Advisory Watch** - Alert on upstream CVE/security fixes

---

## Step-by-Step Sync Instructions

### Step 1: Get Latest Upstream Tag

**Option A: Via Web Browser**

```
1. Open: https://github.com/anomalyco/opencode/tags
2. Look for the latest tag at the top (e.g., v1.2.15)
3. Copy the tag name
```

**Option B: Via GitHub CLI**

```bash
gh release list --repo anomalyco/opencode --limit 5
# Or:
gh api repos/anomalyco/opencode/releases/latest --jq '.tag_name'
```

**Option C: Via Git (if upstream remote is configured)**

```bash
git fetch upstream --tags
git tag -l 'v*' | sort -V | tail -5
```

### Step 2: Trigger Sync Workflow

```
1. Open: https://github.com/BKR-dev/opencoDE/actions/workflows/sync-upstream.yml
2. Click "Run workflow" button (right side of page)
3. In the form that appears:
   - "upstream_tag": Enter the tag from Step 1 (e.g., v1.2.15)
   - "create_pr": Leave checked (default: true)
4. Click green "Run workflow" button
5. Wait ~5 minutes for workflow to complete
```

**Expected Workflow Output**:

- Creates branch: `sync/upstream-v1.2.15`
- Merges upstream tag into this branch with `-X ours` (GDPR-first)
- Runs automated GDPR tests
- Creates PR to `gdpr/main`

### Step 3: Review the PR

**Check PR Status**

```
1. Go to: https://github.com/BKR-dev/opencoDE/pulls
2. Find PR titled: "Sync upstream vX.X.X (GDPR-first)"
3. Click to open the PR
```

**Verify Automated Checks Passed**

- Look for green checkmarks on the PR
- Confirm "GDPR Compliance Tests" passed (17/17 tests)
- Confirm "build-gdpr-binary" succeeded

**Review Changed Files**

```bash
# Checkout the sync branch locally
git fetch origin
git checkout sync/upstream-vX.X.X

# View changed files
git diff gdpr/main...HEAD --name-only

# Check GDPR-critical files (should be unchanged or auto-resolved)
git diff gdpr/main...HEAD -- \
  packages/opencode/src/gdpr/ \
  packages/opencode/src/audit/ \
  packages/opencode/src/provider/provider.ts \
  packages/opencode/src/net/egress-policy.ts
```

**Run Local GDPR Tests**

```bash
cd packages/opencode
bun test test/audit/gdpr-compliance.test.ts
# Expected: 17 pass, 0 fail
```

**Build and Verify GDPR Binary**

```bash
cd packages/opencode
bun run build:gdpr-single
./dist/opencode-darwin-arm64-gdpr/bin/opencode auth list

# Expected output should show:
# 🇪🇺 OpenCode GDPR-Hardened Build
#    ✓ GitHub Copilot only (hardcoded)
#    ✓ External APIs blocked (hardcoded)
# etc.
```

**Test Tamper-Proofing**

```bash
# Try to override with env var (should NOT work)
OPENCODE_ONLY_GITHUB=0 ./dist/opencode-*-gdpr/bin/opencode auth list
# Should STILL show "hardcoded" restrictions
```

### Step 4: Merge the PR

**Via GitHub Web UI**

```
1. On the PR page, scroll to bottom
2. Click "Merge pull request"
3. Choose "Squash and merge" (recommended)
4. Click "Confirm merge"
5. Delete the sync branch when prompted
```

**Via GitHub CLI**

```bash
gh pr merge <PR-NUMBER> --squash --delete-branch
```

### Step 5: Tag the Sync

```bash
git checkout gdpr/main
git pull origin gdpr/main
git tag sync-vX.X.X -m "Synced with upstream vX.X.X"
git push origin sync-vX.X.X
```

### Step 6: Update Sync History

Edit `BRANCHING_STRATEGY.md` to add a row to the sync history table:

```markdown
| YYYY-MM-DD | vX.X.X | sync/upstream-vX.X.X | #PR | ✅ Complete | Notes |
```

---

## Troubleshooting Sync Issues

### Tests Failed in CI

```bash
# Checkout sync branch and run tests locally
git checkout sync/upstream-vX.X.X
cd packages/opencode
bun test test/audit/gdpr-compliance.test.ts

# If tests fail, use conflict resolver
bun run ../../script/resolve-gdpr-conflicts.ts

# Fix issues, then push
git add .
git commit -m "fix(gdpr): preserve compliance after upstream sync"
git push origin sync/upstream-vX.X.X
```

### GDPR Functions Missing After Merge

```bash
# Search for GDPR function calls that should exist
grep -r "isGitHubOnlyMode" packages/opencode/src/
grep -r "isExternalAPIBlocked" packages/opencode/src/
grep -r "logGDPRStatus" packages/opencode/src/

# If missing, re-add them following patterns in existing GDPR code
```

### Binary Build Failed

```bash
# Check for TypeScript errors
cd packages/opencode
bun run typecheck

# Check for missing dependencies
bun install

# Try build again
bun run build:gdpr-single
```

---

## Quick Reference: Sync Commands

```bash
# 1. Get latest tag
gh api repos/anomalyco/opencode/releases/latest --jq '.tag_name'

# 2. Trigger workflow (via browser):
# https://github.com/BKR-dev/opencoDE/actions/workflows/sync-upstream.yml

# 3. Checkout sync branch
git fetch origin && git checkout sync/upstream-vX.X.X

# 4. Run GDPR tests
cd packages/opencode && bun test test/audit/gdpr-compliance.test.ts

# 5. Build GDPR binary
bun run build:gdpr-single

# 6. Verify binary
./dist/opencode-*-gdpr/bin/opencode auth list

# 7. Merge PR (if tests pass)
gh pr merge --squash --delete-branch

# 8. Tag sync
git checkout gdpr/main && git pull
git tag sync-vX.X.X -m "Synced" && git push origin sync-vX.X.X
```

---

## Self-Improvement & Keeping This Document Updated

### When to Update AGENTS.md

Update this document when:

1. **New GDPR features added** - Document new compliance mechanisms
2. **Architecture changes** - Update diagrams and workflows
3. **Sync process changes** - Update step-by-step instructions
4. **New commands added** - Add to quick reference
5. **Upstream changes structure** - Update sync strategy
6. **Tests added/removed** - Update test counts
7. **Documentation files added** - Update documentation index

### Accuracy Verification Checklist

Before considering this document accurate, verify:

| Check                | Command                                                           | Expected    |
| -------------------- | ----------------------------------------------------------------- | ----------- |
| GDPR tests count     | `bun test test/audit/gdpr-compliance.test.ts 2>&1 \| grep -c "✓"` | 17          |
| Build commands exist | `grep -c "build:gdpr" packages/opencode/package.json`             | ≥1          |
| Workflow exists      | `ls .github/workflows/sync-upstream.yml`                          | file exists |
| Conflict resolver    | `ls script/resolve-gdpr-conflicts.ts`                             | file exists |
| GDPR docs            | `ls GDPR_*.md \| wc -l`                                           | ≥8          |
| Default branch       | `git branch --show-current`                                       | gdpr/main   |

### Self-Improvement Prompts for AI Models

When working on this codebase, an AI model should:

1. **Check document freshness**:

   ```
   "Verify AGENTS.md is accurate: check test counts, file paths, and commands"
   ```

2. **Update after changes**:

   ```
   "Update AGENTS.md to reflect [specific change made]"
   ```

3. **Add missing documentation**:

   ```
   "This feature lacks documentation in AGENTS.md. Add a section explaining [feature]."
   ```

4. **Validate sync instructions**:

   ```
   "Test that the sync instructions in AGENTS.md are still accurate by checking workflow file exists and commands work"
   ```

5. **Check for outdated references**:
   ```
   "Scan AGENTS.md for outdated version numbers, file paths, or commands that no longer exist"
   ```

### Recommended Updates After Each Sync

After syncing with upstream, run this verification:

```bash
# 1. Verify test count still matches
cd packages/opencode
TEST_COUNT=$(bun test test/audit/gdpr-compliance.test.ts 2>&1 | grep -c "✓" || echo "0")
echo "GDPR tests passing: $TEST_COUNT"
# If different from 17, update AGENTS.md

# 2. Check if any GDPR files were modified
git diff HEAD~1 --name-only | grep -E "(gdpr|audit|egress|provider)" && echo "GDPR files changed - review AGENTS.md"

# 3. Check for new documentation
ls -la *.md | grep -i gdpr

# 4. Verify workflows still exist
ls .github/workflows/sync-upstream.yml .github/workflows/test-gdpr.yml
```

### Metadata for Document Maintenance

| Metric            | Current Value      | Last Verified |
| ----------------- | ------------------ | ------------- |
| Total lines       | 731                | 2026-03-01    |
| Sections          | 15                 | 2026-03-01    |
| GDPR tests        | 17                 | 2026-03-01    |
| Build modes       | 2 (standard, gdpr) | 2026-03-01    |
| Workflows         | 2 (sync, test)     | 2026-03-01    |
| Upstream velocity | 725+ releases      | 2026-03-01    |
| Last upstream tag | v1.2.15            | 2026-02-26    |

**Instructions for AI**: When updating this table, update the "Last Verified" date to the current date.

### Version History

| Date       | Change                                 | Author       |
| ---------- | -------------------------------------- | ------------ |
| 2026-03-01 | Initial comprehensive AGENTS.md        | AI Assistant |
|            | - Added 4 pillars of GDPR compliance   |              |
|            | - Added upstream sync strategy         |              |
|            | - Added step-by-step sync instructions |              |
|            | - Added self-improvement section       |              |
|            | - Added quick agent onboarding         |              |
|            | - Added marketing docs for C-suite     |              |

### Suggestions for Future Improvements

1. **Automated AGENTS.md validation** - Add a CI check that verifies document accuracy
2. **Keep version numbers in sync** - Auto-update upstream tag references
3. **Add API reference** - Document all GDPR-related functions with signatures
4. **Add troubleshooting database** - Collect and document common issues
5. **Add compliance checklist** - Machine-readable checklist for auditor verification

---

## Quick Agent Onboarding

If you are an AI agent starting work on this repository:

1. Read this file (`AGENTS.md`) completely
2. Verify you understand the 4 pillars of GDPR compliance
3. Check `SYNC_CHECKLIST.md` for sync procedures
4. Run `bun test test/audit/gdpr-compliance.test.ts` to verify tests pass
5. Never modify files in `packages/opencode/src/gdpr/` without understanding implications
6. Always preserve `isGitHubOnlyMode()` and related checks when refactoring

**Key Principle**: This fork's purpose is GDPR compliance. Every change must be evaluated against whether it affects data protection guarantees.
