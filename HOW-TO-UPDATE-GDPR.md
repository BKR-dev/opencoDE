# How to Update the GDPR Fork

Sync is driven by a local `make` command — no GitHub Actions workflow involved.

---

## Normal workflow

```bash
# Step 1: check for a new release and open a PR (also schedulable via cron)
make sync-check

# Step 2: review and checkout the branch
make sync-checkout TAG=v1.14.21

# Step 3: validate GDPR compliance
make sync-validate

# Step 4: merge the PR
make sync-merge

# Step 5: record the new version
echo "v1.14.21" > .github/upstream-version
git add .github/upstream-version
git commit -m "chore: update upstream-version to v1.14.21 post-merge"
git push origin gdpr/main
```

---

## Running sync-check via cron

`make sync-check` is safe to run on a schedule — it exits 0 with no side effects if already up to date.

Example crontab (daily at 06:00, logged to `/var/log/opencode-sync.log`):

```
0 6 * * * cd /path/to/opencoDE && make sync-check >> /var/log/opencode-sync.log 2>&1
```

Requires `gh` CLI to be authenticated (`gh auth login`) for the user running the cron job.

---

## Step-by-step detail

### sync-check

Reads `.github/upstream-version`, fetches the latest release from `anomalyco/opencode`, and if ahead:
- Creates `sync/upstream-vX.X.X` from `gdpr/main`
- Merges the upstream tag with `-X ours` (GDPR fork always wins conflicts)
- Pushes the branch and opens a PR

Target a specific tag instead of latest:

```bash
make sync-check TAG=v1.14.21
```

### sync-checkout

```bash
make sync-checkout TAG=v1.14.21
```

Fetches origin and checks out the sync branch. Review the diff — pay attention to GDPR-critical files:

| File | What to verify |
|---|---|
| `src/gdpr/build-constants.ts` | Build-time flags intact |
| `src/net/egress-policy.ts` | `isExternalAPIBlocked()` present |
| `src/provider/provider.ts` | `isGitHubOnlyMode()` present |
| `src/audit/gdpr.ts` | Audit functions present |
| `src/audit/network.ts` | Network logging intact |

### sync-validate

```bash
make sync-validate
```

Builds the GDPR binary and runs a real `--audit` session. Inspect the audit log:

```bash
cat <audit-log-path> | jq .
```

Confirm all requests go only to `api.github.com` or `raw.githubusercontent.com`.

Also run code-level checks:

```bash
make verify-gdpr
```

### sync-merge

```bash
make sync-merge
```

Finds the open sync PR and merges it via `gh pr merge`.

---

## Conflict resolution

If the PR has conflict markers:

```bash
git checkout sync/upstream-vX.X.X
# edit conflicting files
git add <files>
git commit -m "fix: resolve conflicts for vX.X.X sync"
make sync-validate
make sync-merge
```

---

## Manual sync (no make)

```bash
git remote add upstream https://github.com/anomalyco/opencode.git  # if not present
git fetch upstream
git checkout -b sync/upstream-vX.X.X gdpr/main
git merge upstream/vX.X.X -X ours -m "chore: sync upstream vX.X.X"
make sync-validate
git push origin sync/upstream-vX.X.X
gh pr create --base gdpr/main --head sync/upstream-vX.X.X \
  --title "sync: upstream vX.X.X" \
  --body "Manual sync from anomalyco/opencode vX.X.X"
make sync-merge
```
