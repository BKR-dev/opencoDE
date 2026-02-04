# BKR-dev Fork Branching Strategy

## Overview

This fork (BKR-dev/opencoDE) maintains GDPR-specific features that are NOT pushed upstream to anomalyxo/opencode.

## Remote Configuration

```bash
origin      -> git@github.com:BKR-dev/opencoDE.git (YOUR FORK)
upstream    -> git@github.com:anomalyxo/opencode.git (ORIGINAL REPO)
```

**Current Status**: `upstream` remote is NOT configured (intentionally, to avoid accidental pushes)

## Branch Strategy

### 1. Primary GDPR Branch

- **`gdpr/main`** - YOUR PRIMARY BRANCH (like upstream's dev)
  - Contains all GDPR hardening code
  - Receives upstream updates only on version tags (v2.0.0, etc.)
  - Always builds GDPR-compliant binaries
  - Protected: requires GDPR tests to pass

### 2. GDPR Release Branches (BKR-Specific)

Use semantic versioning for GDPR releases:

- **`gdpr/v1.0-build-hardening`** - Build-time GDPR hardening (initial release)
- **`gdpr/v1.1-audit-enhancements`** - Future: Enhanced audit features
- **`gdpr/v2.0-compliance-suite`** - Future: Full compliance toolkit

### 3. Sync Branches (Temporary)

- **`sync/upstream-v2.0.0`** - Created automatically when new upstream tag detected
- Merged to `gdpr/main` after testing
- Deleted after merge

### 4. Working Branches (Temporary)

- **`feat/*`** - Feature development (delete after merging to GDPR branch)
- **`fix/*`** - Bug fixes specific to GDPR builds

### 5. Upstream Mirror (Optional)

- **`dev`** - Mirrors `anomalyxo/opencode:dev`
  - NEVER push BKR-specific changes here
  - Used for reference only

## Workflow

### Initial Setup (One-Time)

```bash
# Add upstream remote for pulling updates (optional)
git remote add upstream https://github.com/anomalyxo/opencode.git

# Verify remotes
git remote -v
# origin    git@github.com:BKR-dev/opencoDE.git (fetch/push)
# upstream  https://github.com/anomalyxo/opencode.git (fetch)
```

**IMPORTANT**: Upstream is fetch-only. You CAN'T accidentally push to it.

### Creating a GDPR Release Branch

```bash
# Start from latest upstream dev
git checkout dev
git pull origin dev  # Pull from YOUR fork

# Optional: Sync with upstream
# git pull upstream dev

# Create GDPR release branch
git checkout -b gdpr/v1.0-build-hardening

# Work on your changes...
git add .
git commit -m "feat(gdpr): add build-time hardening"

# Push to YOUR fork only
git push -u origin gdpr/v1.0-build-hardening
```

### Building Binaries from GDPR Branch

```bash
# Checkout the GDPR branch
git checkout gdpr/v1.0-build-hardening

# Build GDPR binaries
make build-gdpr

# Tag the release
git tag -a v1.0.0-gdpr -m "GDPR Build v1.0.0 - Build-time hardening"
git push origin v1.0.0-gdpr

# Binaries will be in:
# dist/opencode-linux-x64-gdpr/
# dist/opencode-darwin-arm64-gdpr/
# etc.
```

### Syncing with Upstream (Tag-Based Automated)

**This fork uses TAG-BASED syncing** - only pulls from upstream when they release a new version tag.

#### Automated Workflow (Recommended)

1. **Trigger the sync manually** (no automatic cron jobs):

   ```bash
   # Go to GitHub Actions
   # https://github.com/BKR-dev/opencoDE/actions/workflows/sync-upstream.yml
   # Click "Run workflow"
   # Enter upstream tag (e.g., v2.0.0)
   # Click "Run workflow"
   ```

2. **GitHub Actions will**:
   - Create branch: `sync/upstream-v2.0.0`
   - Merge with GDPR-first strategy (`-X ours`)
   - Create PR to `gdpr/main`
   - Run GDPR compliance tests

3. **You review the PR**:
   - Check the automated test results
   - Review changes locally (see below)
   - Merge if tests pass

#### Manual Sync (If Automation Fails)

```bash
# Add upstream remote (one-time)
git remote add upstream https://github.com/anomalyxo/opencode.git

# Fetch upstream tags
git fetch upstream --tags

# Create sync branch
git checkout gdpr/main
git checkout -b sync/upstream-v2.0.0

# Merge with GDPR-first strategy (your code wins conflicts)
git merge upstream/v2.0.0 -X ours

# If conflicts remain, use the helper script
bun run script/resolve-gdpr-conflicts.ts

# Test GDPR compliance
cd packages/opencode
bun test test/audit/gdpr-compliance.test.ts

# If tests pass, push and create PR
git push -u origin sync/upstream-v2.0.0
# Then create PR via GitHub UI
```

#### After Merging Sync PR

```bash
# Tag the sync for history
git checkout gdpr/main
git pull origin gdpr/main
git tag sync-v2.0.0 -m "Synced with upstream v2.0.0"
git push origin sync-v2.0.0

# Update sync history (see Sync History section below)
```

### Merging Working Branches

```bash
# Merge feat branch into GDPR release branch
git checkout gdpr/v1.0-build-hardening
git merge feat/restrict-github-only

# Push to origin (your fork)
git push origin gdpr/v1.0-build-hardening

# Delete working branch
git branch -d feat/restrict-github-only
git push origin --delete feat/restrict-github-only
```

## Safety Rules

### ✅ ALWAYS SAFE (Push to Your Fork)

```bash
git push origin <any-branch>              # Push to BKR-dev fork
git push origin gdpr/v1.0-build-hardening # SAFE
git push origin feat/my-feature           # SAFE
```

### ⚠️ REQUIRES CARE (Upstream Sync)

```bash
git pull upstream dev                     # Pull FROM upstream (safe)
git push upstream <any-branch>            # ❌ ERROR - no push access (intentional)
```

### ❌ NEVER DO

```bash
# DON'T configure upstream with SSH (prevents accidental pushes)
git remote add upstream git@github.com:anomalyxo/opencode.git  # ❌ NO

# DON'T push to upstream
git push upstream dev  # ❌ Will fail (no write access)

# DON'T create PRs to upstream with GDPR code
# (Keep GDPR features in BKR-dev fork only)
```

## Current Branches

### Active GDPR Work

- **`feat/restrict-github-only`** ← Current work
  - Contains build-time hardening implementation
  - Contains network audit mode
  - 16 commits ahead of origin
  - Ready to merge into `gdpr/v1.0-build-hardening`

### Recommended Next Steps

```bash
# 1. Create GDPR release branch
git checkout -b gdpr/v1.0-build-hardening

# 2. Stage all GDPR changes
git add packages/opencode/script/gdpr-config.ts
git add packages/opencode/src/gdpr/
git add packages/opencode/src/audit/gdpr.ts
git add packages/opencode/src/audit/network.ts
git add packages/opencode/src/cli/cmd/audit.ts
git add packages/opencode/test/audit/
git add GDPR_BUILD_HARDENING.md
git add NETWORK_AUDIT_MODE.md
git add Makefile
git add packages/opencode/package.json
git add packages/opencode/script/build.ts
# ... (all modified files)

# 3. Commit
git commit -m "feat(gdpr): implement build-time hardening with network audit mode

- Add build-time GDPR constant injection via Bun define
- Implement hybrid build system (standard vs GDPR builds)
- Add --audit flag for comprehensive network logging
- Create audit CLI commands (view, summary, verify)
- Replace all process.env checks with build-constant functions
- Add startup GDPR status logging
- Create gdpr-prefixed binaries (opencode-*-gdpr)
- Add 17 GDPR compliance tests (all passing)
- Document build-time hardening and network audit mode

Binary naming:
- Standard: opencode-linux-x64
- GDPR: opencode-linux-x64-gdpr

Build commands:
- make build         # Standard build
- make build-gdpr    # GDPR-hardened build

Audit commands:
- opencode --audit <cmd>  # Enable network audit
- opencode audit view     # View audit logs
- opencode audit summary  # Show statistics
- opencode audit verify   # Verify GDPR compliance"

# 4. Push to YOUR fork
git push -u origin gdpr/v1.0-build-hardening

# 5. Tag the release
git tag -a v1.0.0-gdpr -m "GDPR Build v1.0.0 - Build-time Hardening + Network Audit"
git push origin v1.0.0-gdpr
```

## Release Process

### 1. Create Release Branch

```bash
git checkout -b gdpr/v1.0-build-hardening
git add .
git commit -m "feat(gdpr): ..."
git push -u origin gdpr/v1.0-build-hardening
```

### 2. Build Binaries

```bash
# Build all GDPR binaries
make build-gdpr

# Verify binaries
ls -la packages/opencode/dist/opencode-*-gdpr/bin/

# Test GDPR binary
./packages/opencode/dist/opencode-darwin-arm64-gdpr/bin/opencode --version
./packages/opencode/dist/opencode-darwin-arm64-gdpr/bin/opencode auth list
```

### 3. Tag Release

```bash
git tag -a v1.0.0-gdpr -m "GDPR Build v1.0.0"
git push origin v1.0.0-gdpr
```

### 4. Create GitHub Release

1. Go to https://github.com/BKR-dev/opencoDE/releases
2. Click "Create a new release"
3. Tag: `v1.0.0-gdpr`
4. Title: "GDPR Build v1.0.0 - Build-time Hardening"
5. Description: Copy from GDPR_BUILD_HARDENING.md summary
6. Upload binaries from `packages/opencode/dist/opencode-*-gdpr/`

### 5. Distribution

```bash
# Standard builds (public)
dist/opencode-linux-x64/bin/opencode
dist/opencode-darwin-arm64/bin/opencode

# GDPR builds (EU/regulated environments)
dist/opencode-linux-x64-gdpr/bin/opencode
dist/opencode-darwin-arm64-gdpr/bin/opencode
```

## Version Numbering

### GDPR Releases

Follow semantic versioning with `-gdpr` suffix:

- `v1.0.0-gdpr` - First GDPR build with build-time hardening
- `v1.1.0-gdpr` - Minor update (new audit features)
- `v1.0.1-gdpr` - Patch (bug fix)
- `v2.0.0-gdpr` - Major update (breaking changes)

### Branch Naming

- `gdpr/v1.0-build-hardening` - Major.minor series
- `gdpr/v1.1-audit-enhancements`
- `gdpr/v2.0-compliance-suite`

## File Organization

### GDPR-Specific Files (Keep in Fork)

```
GDPR_BUILD_HARDENING.md          # Build-time hardening docs
NETWORK_AUDIT_MODE.md            # Audit mode docs
GDPR_EXECUTIVE_SUMMARY.md        # Executive summary
GDPR_PROVIDER_AUDIT.md           # Provider audit logs
GDPR_COMPLIANCE_SUMMARY.md       # Compliance assessment
Makefile                         # Build targets (build-gdpr, etc.)
packages/opencode/script/gdpr-config.ts
packages/opencode/src/gdpr/build-constants.ts
packages/opencode/src/audit/gdpr.ts
packages/opencode/src/audit/network.ts
packages/opencode/src/cli/cmd/audit.ts
packages/opencode/test/audit/gdpr-compliance.test.ts
```

### Modified Upstream Files (Careful with Merges)

```
packages/opencode/script/build.ts          # GDPR build integration
packages/opencode/src/index.ts             # --audit flag
packages/opencode/src/net/egress-policy.ts # Network audit
packages/opencode/src/provider/provider.ts # GDPR checks
packages/opencode/src/share/share.ts       # GDPR session sharing
# ... (other modified files)
```

**Strategy**: When syncing with upstream, manually resolve conflicts to preserve GDPR features.

## Future Considerations

### Option 1: Contribute Generic Parts Upstream

Some features could potentially be contributed to anomalyxo/opencode:

- Generic audit logging framework (without GDPR specifics)
- `--audit` flag (useful for all users)
- Build-time configuration system (generic)

### Option 2: Keep Fully Separate

Maintain a complete fork with all GDPR features:

- Easier to manage
- No coordination with upstream needed
- Full control over GDPR features

### Recommended: Option 2 (Keep Separate)

Since GDPR requirements are specific to BKR-dev's use case, it's cleaner to maintain a separate fork. Sync periodically with upstream for bug fixes and features, but keep GDPR code isolated.

## Quick Reference

```bash
# Check where you'll push
git remote -v

# Check current branch
git branch -vv

# Trigger automated sync (via GitHub Actions UI)
# https://github.com/BKR-dev/opencoDE/actions/workflows/sync-upstream.yml

# Manual sync if needed
git fetch upstream --tags
git checkout -b sync/upstream-v2.0.0
git merge upstream/v2.0.0 -X ours
bun run script/resolve-gdpr-conflicts.ts
bun test test/audit/gdpr-compliance.test.ts

# Build GDPR binaries
make build-gdpr

# Tag release
git tag v1.0.0-gdpr
git push origin v1.0.0-gdpr
```

**Remember**: As long as you push to `origin`, you're pushing to YOUR fork (BKR-dev/opencoDE), NOT upstream. This is safe and correct. ✅

---

## Sync History

Track all upstream syncs here for audit trail:

| Sync Date  | Upstream Tag  | Sync Branch               | PR  | Status      | Notes                       |
| ---------- | ------------- | ------------------------- | --- | ----------- | --------------------------- |
| 2026-02-04 | v1.0.0 (fork) | gdpr/v1.0-build-hardening | -   | ✅ Complete | Initial GDPR implementation |
| TBD        | v2.0.0        | sync/upstream-v2.0.0      | TBD | ⏳ Pending  | Awaiting upstream release   |

**Instructions**: After each sync, add a row to this table with:

- Date merged to gdpr/main
- Upstream tag synced
- Sync branch name
- PR link
- Status (✅ Complete, ⚠️ Had conflicts, ❌ Failed)
- Notes about any issues or manual fixes needed
