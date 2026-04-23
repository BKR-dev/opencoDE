# How to Update the GDPR Fork

This document describes the full workflow for syncing a new upstream release from
`anomalyco/opencode` into this GDPR-hardened fork.

---

## Automated path (normal case)

CI runs daily at 06:00 UTC and opens a PR automatically when a new release is
detected. If the PR is open, start at Step 3.

```
Step 1  make sync-trigger          # manually dispatch the workflow (optional)
Step 2  make sync-checkout TAG=vX.X.X
Step 3  make sync-validate         # builds GDPR binary, runs --audit session
Step 4  make sync-merge            # merges the PR via gh CLI
Step 5  update .github/upstream-version  (see below)
```

---

## Step-by-step

### 1. Trigger (optional)

CI runs automatically. If you want to trigger it right now:

```bash
make sync-trigger
```

Watch progress at:
<https://github.com/BKR-dev/opencoDE/actions/workflows/sync-upstream.yml>

### 2. Checkout the sync branch

Once the PR is open:

```bash
make sync-checkout TAG=v1.14.21   # replace with the actual version
```

Review the diff. Pay special attention to the GDPR-critical files listed in
`AGENTS.md`. The merge used `-X ours`, so GDPR fork changes win conflicts, but
verify that nothing was unexpectedly dropped.

**GDPR-critical files to check after every sync:**

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

### 3. Validate

Build the GDPR binary and run a real audit session:

```bash
make sync-validate
```

This runs `make validate-gdpr` which:
1. Builds the GDPR binary (`build-gdpr-single`)
2. Runs a one-shot `--audit` session against GitHub Copilot
3. Prints the audit log location

Inspect the audit log:

```bash
cat <audit-log-path> | jq .
```

Confirm:
- All requests go only to `api.github.com` or `raw.githubusercontent.com`
- No requests to OpenAI, Anthropic, Google, or any other external host
- Audit events are present and structured

Also run the code-level checks:

```bash
make verify-gdpr
```

### 4. Merge

```bash
make sync-merge
```

This merges the PR and deletes the sync branch via `gh pr merge`.

### 5. Update upstream-version

After merging, record the new upstream version:

```bash
echo "v1.14.21" > .github/upstream-version
git add .github/upstream-version
git commit -m "chore: update upstream-version to v1.14.21 post-merge"
git push origin gdpr/main
```

This prevents CI from opening duplicate PRs for the same release.

---

## Manual conflict resolution

If the sync PR has conflict markers (possible when upstream changed a
GDPR-critical file), resolve them manually on the sync branch before merging:

```bash
git checkout sync/upstream-vX.X.X
# edit conflict files
git add <resolved-files>
git commit -m "fix: resolve conflicts for vX.X.X sync"
make sync-validate   # re-validate after resolution
make sync-merge
```

---

## If CI is down

Manual sync without the workflow:

```bash
git remote add upstream https://github.com/anomalyco/opencode.git  # if not present
git fetch upstream
git checkout -b sync/upstream-vX.X.X gdpr/main
git merge upstream/vX.X.X -X ours -m "chore: sync upstream vX.X.X"
make sync-validate
git push origin sync/upstream-vX.X.X
gh pr create --base gdpr/main --head sync/upstream-vX.X.X \
  --title "chore: sync upstream vX.X.X" \
  --body "Manual sync from anomalyco/opencode vX.X.X"
make sync-merge
```
