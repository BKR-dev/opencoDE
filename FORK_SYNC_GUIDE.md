# OpenCode GitHub Copilot Edition - Fork Management Guide

## Overview

This fork (BKR-dev/opencoDE) is a GitHub Copilot-only version of OpenCode designed for licensing. This guide covers how to safely manage the fork and keep it synchronized with the upstream repository.

## Repository Configuration

- **Origin (Your Fork)**: `git@github.com:BKR-dev/opencoDE.git`
- **Upstream (Source)**: `https://github.com/anomalyco/opencode.git`
- **Default Branch**: `dev` (not `main`)
- **Feature Branch**: `feat/restrict-github-only`

## Safety Checks

### Pre-configured Safety Mechanisms

1. **Git Remote Configuration**
   - Origin points to BKR-dev fork only
   - No upstream remote configured by default (prevents accidental pushes)
   - Pre-push hooks enforce Bun version and TypeScript checks

2. **Makefile Safety Features**
   - `make git-check`: Verifies remote configuration
   - `make git-sync`: Safe upstream sync with manual merge
   - Prevents force-push to protected branches
   - Validates working directory state before operations

### Recommended Git Configuration

```bash
# Disable automatic upstream tracking
git config push.autosetupremote false

# Set push default to current branch only
git config push.default current

# Ensure you're always pushing to origin
git remote set-url --push upstream no_push
```

## Fork Sync Workflow

### Step 1: Verify Configuration

```bash
make git-check
```

This validates:

- Origin points to BKR-dev/opencoDE
- Upstream is configured (or warns if missing)
- Working directory is clean
- Current branch status

### Step 2: Sync from Upstream

```bash
# Safe sync - fetches but doesn't merge automatically
make git-sync
```

This command:

1. Adds upstream remote if missing
2. Fetches latest changes from `anomalyco/opencode`
3. Shows preview of changes
4. **Does NOT automatically merge** (manual review required)

### Step 3: Review and Merge

```bash
# Review changes before merging
git log HEAD..upstream/dev --oneline

# If changes look good, merge
git merge upstream/dev

# Resolve any conflicts
# Test the changes
make test
make audit-test
```

### Step 4: Push to Your Fork

```bash
# Only pushes to origin (BKR-dev), NEVER to upstream
git push origin feat/restrict-github-only
```

## Manual Sync Process (Alternative)

If you prefer manual control:

```bash
# 1. Add upstream remote (first time only)
git remote add upstream https://github.com/anomalyco/opencode.git
git remote set-url --push upstream no_push  # Safety: prevent pushing

# 2. Fetch upstream changes
git fetch upstream

# 3. Review changes
git log HEAD..upstream/dev --oneline --graph

# 4. Merge changes
git checkout feat/restrict-github-only
git merge upstream/dev

# 5. Resolve conflicts if any
# 6. Test
make test

# 7. Push to your fork ONLY
git push origin feat/restrict-github-only
```

## Protection Against Upstream Pushes

### Pre-push Hook

The `.husky/pre-push` hook validates:

- Bun version matches `package.json` requirement
- TypeScript types are valid

To add upstream push protection, create `.husky/pre-push-upstream-check`:

```bash
#!/bin/sh
# Prevent accidental pushes to upstream

REMOTE="$1"
REMOTE_URL=$(git remote get-url "$REMOTE" 2>/dev/null)

# Check if pushing to upstream
if echo "$REMOTE_URL" | grep -q "anomalyco/opencode"; then
  echo "❌ ERROR: Attempting to push to upstream repository!"
  echo "   Remote: $REMOTE"
  echo "   URL: $REMOTE_URL"
  echo ""
  echo "   This fork should only push to BKR-dev/opencoDE"
  echo "   If you need to sync, use: make git-sync"
  exit 1
fi

# Check if pushing to protected branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "⚠️  WARNING: Pushing to protected branch: $BRANCH"
  read -p "Are you sure? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

exit 0
```

### Git Config Safeguards

Add to your global or local git config:

```bash
# Prevent force push to main/dev branches
git config branch.dev.pushRemote origin
git config branch.main.pushRemote origin

# Require explicit branch for push
git config push.default current
```

## Conflict Resolution Strategy

When merging from upstream, conflicts are likely in:

1. **Provider files** (`src/provider/*`)
   - Keep GitHub Copilot implementation
   - Remove other provider references
   - Preserve `OPENCODE_ONLY_GITHUB` logic

2. **API routes** (`src/server/*`)
   - Keep billing/Stripe removals
   - Merge new features carefully

3. **Configuration files**
   - Review model updates
   - Preserve GitHub Copilot priority

### Conflict Resolution Example

```bash
# If conflicts occur during merge
git status  # See conflicted files

# Edit conflicted files, keeping GitHub-only logic
# Look for markers: <<<<<<<, =======, >>>>>>>

# After resolving
git add <resolved-files>
git commit -m "Merge upstream/dev: resolved conflicts, preserved GitHub-only"

# Test before pushing
make test
make audit-test
```

## Testing After Sync

Always run the full test suite after syncing:

```bash
# Full build and test pipeline
make all

# Or individual steps
make clean
make install
make build
make test
make audit-test
```

## Branching Strategy

- **dev**: Main development branch (syncs with upstream)
- **feat/restrict-github-only**: Current feature branch with GitHub-only changes
- **feat/github-only-strip**: Alternative cleanup branch
- Feature branches for new work

When creating new features:

```bash
# Always branch from dev
git checkout dev
git pull origin dev
git checkout -b feat/your-feature-name

# When done
git push origin feat/your-feature-name
```

## Emergency: Rollback Sync

If a sync causes issues:

```bash
# Find the commit before merge
git log --oneline

# Reset to before merge (careful!)
git reset --hard <commit-before-merge>

# Or create a revert commit (safer)
git revert -m 1 HEAD
```

## Monitoring Upstream Changes

Set up notifications for upstream changes:

1. Watch the upstream repo on GitHub
2. Review `anomalyco/opencode` releases
3. Check for breaking changes before syncing

## FAQ

**Q: Can I push directly to anomalyco/opencode?**
A: No, you don't have permission. This is a fork for your licensed version.

**Q: What if I accidentally push to upstream?**
A: It will fail due to permissions. The remote is read-only for you.

**Q: How often should I sync?**
A: Depends on your needs. Monthly or when major features are released upstream.

**Q: What if upstream makes breaking changes?**
A: Review changes carefully before merging. You can choose not to merge breaking changes.

**Q: Can I contribute changes back to upstream?**
A: Yes, via Pull Requests to anomalyco/opencode, but keep your proprietary GitHub-only changes in your fork.

## Getting Help

- Makefile commands: `make help`
- Git safety check: `make git-check`
- Test everything: `make all`
