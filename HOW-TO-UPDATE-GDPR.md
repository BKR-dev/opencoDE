# How to Update the GDPR Fork

Sync is driven by local `make` commands using upstream GitHub release tags. No GitHub Actions workflow is involved in the update path.

---

## Normal workflow

```bash
# Step 1: check for a new upstream release and open or reuse a PR
make sync-check

# Step 2: review and checkout the branch
make sync-checkout TAG=v1.14.23

# Step 3: validate GDPR compliance
make sync-validate
make verify-gdpr

# Step 4: merge the PR
make sync-merge

# Step 5: record the new version
echo "v1.14.23" > .github/upstream-version
git add .github/upstream-version
git commit -m "chore: update upstream-version to v1.14.23 post-merge"
git push origin gdpr/main
```

---

## Running sync-check via cron

`make sync-check` is safe to run on a schedule. If `.github/upstream-version` already matches the latest upstream release tag, it exits 0 with no side effects.

Example crontab (daily at 06:00, logged to `/var/log/opencode-sync.log`):

```bash
0 6 * * * cd /path/to/opencoDE && make sync-check >> /var/log/opencode-sync.log 2>&1
```

Requirements for the user running cron:

- `gh` CLI installed
- `gh auth login` already completed
- push access to `origin`

---

## Step-by-step detail

### sync-check

```bash
make sync-check
make sync-check TAG=v1.14.23
```

What it does:

- Reads `.github/upstream-version`
- Resolves the target upstream GitHub release tag
- Exits cleanly if already current
- Ensures the `upstream` remote exists and fetches the target tag
- Refreshes local `gdpr/main` from `origin/gdpr/main`
- Creates a fresh local `sync/upstream-vX.X.X` branch
- Merges the upstream tag with `-X ours` so GDPR fork behavior wins conflicts
- Pushes the sync branch
- Opens a PR to `gdpr/main`, or reports the existing open PR for that branch

Target a specific tag instead of latest:

```bash
make sync-check TAG=v1.14.23
```

### sync-checkout

```bash
make sync-checkout TAG=v1.14.23
```

Fetches origin and checks out the sync branch. Review the diff carefully, especially these GDPR-critical files:

| File | What to verify |
|---|---|
| `src/gdpr/build-constants.ts` | Build-time flags intact |
| `src/net/egress-policy.ts` | `isExternalAPIBlocked()` present |
| `src/provider/provider.ts` | `isGitHubOnlyMode()` present |
| `src/provider/models.ts` | models.dev blocking still present |
| `src/audit/gdpr.ts` | Audit functions present |
| `src/audit/network.ts` | Network logging intact |
| `src/index.ts` | `--audit` flag and GDPR status logging present |
| `src/tool/webfetch.ts` | GitHub-only guard still present |
| `src/tool/websearch.ts` | GitHub-only guard still present |
| `src/share/share.ts` | Session sharing remains disabled in GDPR mode |

### sync-validate

```bash
make sync-validate
make verify-gdpr
```

`make sync-validate` runs the local audit validation flow. `make verify-gdpr` runs the code-level GDPR checks. Inspect the audit log and confirm requests go only to approved GitHub endpoints.

### sync-merge

```bash
make sync-merge
```

Finds the open sync PR and merges it via `gh pr merge`. After that, update `.github/upstream-version` on `gdpr/main` and push the result.

---

## Conflict resolution

If the sync branch contains conflict markers or needs manual cleanup:

```bash
make sync-checkout TAG=v1.14.23
# edit conflicting files
git add <files>
git commit -m "fix: resolve conflicts for v1.14.23 sync"
make sync-validate
make verify-gdpr
make sync-merge
```

---

## Manual sync (no make)

```bash
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream https://github.com/anomalyco/opencode.git
git fetch upstream refs/tags/v1.14.23:refs/tags/v1.14.23
git fetch origin gdpr/main
git checkout -B gdpr/main origin/gdpr/main
git checkout -b sync/upstream-v1.14.23
git merge refs/tags/v1.14.23 -X ours --no-edit --allow-unrelated-histories
make sync-validate
make verify-gdpr
git push origin sync/upstream-v1.14.23
gh pr create --base gdpr/main --head sync/upstream-v1.14.23 \
  --title "sync: upstream v1.14.23" \
  --body "Manual sync from anomalyco/opencode v1.14.23"
```
