# Fork Sync Guide

## How It Works

The daily CI workflow (`.github/workflows/sync-upstream.yml`) checks `anomalyco/opencode` for new release tags each morning at 06:00 UTC. If a release newer than `.github/upstream-version` exists, it automatically creates a `sync/upstream-vX.X.X` branch, merges with `-X ours` (GDPR fork always wins conflicts), and opens a PR to `gdpr/main`.

No action needed to trigger this — just review and merge the PR when it arrives.

---

## Normal Workflow (Automated PR)

```bash
# 1. Fetch and checkout the sync branch
git fetch origin
git checkout sync/upstream-vX.X.X

# 2. Resolve any conflict markers if present
# Edit files with <<<<<<< markers, then:
git add .
git commit -m "fix: resolve conflicts for upstream vX.X.X"

# 3. Validate GDPR compliance locally
make validate-gdpr
# Inspect the audit log output — verify only GitHub domains appear

# 4. Merge
gh pr merge <PR-NUMBER> --squash --delete-branch

# 5. Update the state file (prevents CI from re-opening tomorrow)
echo "vX.X.X" > .github/upstream-version
git add .github/upstream-version
git commit -m "chore: update upstream-version to vX.X.X post-merge"
git push origin gdpr/main
```

---

## Manual Trigger

To sync to a specific upstream tag immediately (without waiting for the daily run):

**Via browser:**
1. Go to [Actions → Sync Upstream (Scheduled)](https://github.com/BKR-dev/opencoDE/actions/workflows/sync-upstream.yml)
2. Click "Run workflow"
3. Optionally enter a specific tag (leave empty to use latest)

**Via CLI:**

```bash
gh workflow run sync-upstream.yml --ref gdpr/main -f tag=vX.X.X
```

---

## Manual Sync (CI Down / Fallback)

If the workflow is unavailable:

```bash
# Add upstream remote (one-time)
git remote add upstream https://github.com/anomalyco/opencode.git

# Fetch the specific tag
git fetch upstream refs/tags/vX.X.X:refs/tags/vX.X.X

# Create sync branch and merge
git checkout gdpr/main
git checkout -b sync/upstream-vX.X.X
git merge "refs/tags/vX.X.X" -X ours --no-edit --allow-unrelated-histories

# Push and open PR
git push -u origin sync/upstream-vX.X.X
gh pr create --base gdpr/main --head sync/upstream-vX.X.X --title "sync: upstream vX.X.X"
```

---

## Safety

The CI workflow only has write access to `BKR-dev/opencoDE`. It reads `anomalyco/opencode` via public GitHub API and `git fetch` only — nothing is ever pushed upstream. The `GITHUB_TOKEN` used is scoped to this repository.
