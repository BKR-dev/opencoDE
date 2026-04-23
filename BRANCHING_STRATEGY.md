# Branch Strategy

## Branches

| Branch | Purpose |
|---|---|
| `gdpr/main` | Primary branch — always GDPR-compliant, never breaks |
| `sync/upstream-vX.X.X` | Auto-created by CI for each upstream release, deleted after merge |
| `feat/*`, `fix/*` | Short-lived working branches — merge to `gdpr/main`, then delete |

## Remotes

- `origin` → `git@github.com:BKR-dev/opencoDE.git` — your fork, push here
- Upstream (`anomalyco/opencode`) is read-only, fetched only by CI — no upstream remote needed locally

## After Merging a Sync PR

Update the state file so the daily CI workflow doesn't re-open the same PR:

```bash
echo "vX.X.X" > .github/upstream-version
git add .github/upstream-version
git commit -m "chore: update upstream-version to vX.X.X post-merge"
git push origin gdpr/main
```

## Sync History

| Sync Date  | Upstream Tag  | Sync Branch               | PR | Status      | Notes                       |
|------------|---------------|---------------------------|----|-------------|-----------------------------|
| 2026-02-04 | v1.0.0 (fork) | gdpr/v1.0-build-hardening | -  | ✅ Complete | Initial GDPR implementation |

Add a row here after each sync merge.
