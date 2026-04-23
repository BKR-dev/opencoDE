# Upstream Sync Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing manual-trigger-only sync workflow with a lean scheduled workflow that detects new upstream release tags daily and automatically opens a merge PR to `gdpr/main`, plus a `make validate-gdpr` Makefile target for local GDPR binary smoke testing.

**Architecture:** A single GitHub Actions workflow file handles both scheduled detection and manual dispatch. It reads a state file (`.github/upstream-version`) to avoid duplicate PRs, merges with `-X ours` so conflicts become markers rather than failures, and always opens a PR. Local validation is wired through the existing `Makefile` with a new `validate-gdpr` target that builds the GDPR binary and runs a real session with `--audit`.

**Tech Stack:** GitHub Actions (ubuntu-latest), `gh` CLI (pre-installed on runners), `git`, Bun, GNU Make

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `.github/upstream-version` | State file — last merged upstream tag |
| Replace | `.github/workflows/sync-upstream.yml` | Lean scheduled + dispatch sync workflow |
| Delete | `.github/workflows/test-gdpr.yml` | Removed — CI tests moved to local Makefile |
| Modify | `Makefile` | Add `validate-gdpr` target |

---

## Task 1: Create the upstream-version state file

**Files:**
- Create: `.github/upstream-version`

- [ ] **Step 1: Find the current upstream tag this fork was based on**

  Check AGENTS.md and git log to identify the upstream tag used when the fork was created:

  ```bash
  grep "upstream tag\|Last upstream tag\|sync-v" AGENTS.md | tail -5
  git log --oneline --all | grep -i "sync\|upstream" | head -10
  ```

- [ ] **Step 2: Create the state file**

  Create `.github/upstream-version` with the tag identified above. If uncertain, use the tag referenced in AGENTS.md (`v1.2.15` as of the last doc update):

  ```bash
  echo "v1.2.15" > .github/upstream-version
  ```

  The file must contain exactly one line: the tag string, no trailing whitespace, no quotes.

- [ ] **Step 3: Verify the file**

  ```bash
  cat .github/upstream-version
  # Expected output: v1.2.15
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add .github/upstream-version
  git commit -m "chore: add upstream-version state file for sync automation"
  ```

---

## Task 2: Replace the sync workflow

**Files:**
- Replace: `.github/workflows/sync-upstream.yml`

This task replaces the existing manual-trigger-only workflow (223 lines) with the new lean scheduled + dispatch workflow. The existing file has a typo in the upstream remote URL (`anomalyxo` instead of `anomalyco`) — the new file fixes this.

- [ ] **Step 1: Write the new workflow file**

  Overwrite `.github/workflows/sync-upstream.yml` with exactly this content:

  ```yaml
  name: Sync Upstream (Scheduled)

  on:
    schedule:
      - cron: "0 6 * * *"  # Daily at 06:00 UTC
    workflow_dispatch:
      inputs:
        tag:
          description: "Upstream tag to sync (e.g. v1.3.0). Leave empty to use latest."
          required: false
          type: string

  permissions:
    contents: write
    pull-requests: write

  jobs:
    sync:
      runs-on: ubuntu-latest
      steps:
        - name: Checkout gdpr/main
          uses: actions/checkout@v4
          with:
            ref: gdpr/main
            fetch-depth: 0
            token: ${{ secrets.GITHUB_TOKEN }}

        - name: Configure git
          run: |
            git config user.name "GDPR Sync Bot"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

        - name: Read current synced tag
          id: current
          run: |
            CURRENT=$(cat .github/upstream-version)
            echo "tag=$CURRENT" >> $GITHUB_OUTPUT
            echo "Current synced tag: $CURRENT"

        - name: Get latest upstream release tag
          id: upstream
          env:
            GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          run: |
            if [ -n "${{ github.event.inputs.tag }}" ]; then
              TAG="${{ github.event.inputs.tag }}"
              echo "Using manually specified tag: $TAG"
            else
              TAG=$(gh api repos/anomalyco/opencode/releases/latest --jq '.tag_name')
              echo "Latest upstream tag: $TAG"
            fi
            echo "tag=$TAG" >> $GITHUB_OUTPUT

        - name: Check if sync needed
          id: check
          run: |
            CURRENT="${{ steps.current.outputs.tag }}"
            UPSTREAM="${{ steps.upstream.outputs.tag }}"
            if [ "$CURRENT" = "$UPSTREAM" ]; then
              echo "Already up to date with $UPSTREAM — nothing to do"
              echo "needed=false" >> $GITHUB_OUTPUT
            else
              echo "New upstream release: $UPSTREAM (current: $CURRENT)"
              echo "needed=true" >> $GITHUB_OUTPUT
            fi

        - name: Add upstream remote and fetch tag
          if: steps.check.outputs.needed == 'true'
          run: |
            git remote add upstream https://github.com/anomalyco/opencode.git
            git fetch upstream refs/tags/${{ steps.upstream.outputs.tag }}:refs/tags/${{ steps.upstream.outputs.tag }}

        - name: Create sync branch
          if: steps.check.outputs.needed == 'true'
          id: branch
          run: |
            TAG="${{ steps.upstream.outputs.tag }}"
            BRANCH="sync/upstream-${TAG}"
            git checkout -b "$BRANCH"
            echo "name=$BRANCH" >> $GITHUB_OUTPUT

        - name: Merge upstream tag (GDPR-first)
          if: steps.check.outputs.needed == 'true'
          id: merge
          run: |
            TAG="${{ steps.upstream.outputs.tag }}"
            # -X ours: on conflict, keep our (GDPR fork) version
            # --allow-unrelated-histories: safe for tag-based merges
            # Never abort — conflict markers are committed as-is
            if git merge "refs/tags/$TAG" -X ours --no-edit --allow-unrelated-histories; then
              echo "Clean merge — no conflicts"
              echo "conflicts=false" >> $GITHUB_OUTPUT
            else
              echo "Conflicts detected — committing with markers"
              git add -A
              git commit -m "sync: merge upstream $TAG (GDPR-first, conflicts present)"
              echo "conflicts=true" >> $GITHUB_OUTPUT
            fi

        - name: Push sync branch
          if: steps.check.outputs.needed == 'true'
          run: |
            git push -u origin "${{ steps.branch.outputs.name }}"

        - name: Get list of files changed upstream
          if: steps.check.outputs.needed == 'true'
          id: changed
          run: |
            TAG="${{ steps.upstream.outputs.tag }}"
            CURRENT="${{ steps.current.outputs.tag }}"
            FILES=$(git diff --name-only "refs/tags/$CURRENT" "refs/tags/$TAG" 2>/dev/null | head -40 || echo "(could not compute diff)")
            # Escape for multiline output
            echo "files<<EOF" >> $GITHUB_OUTPUT
            echo "$FILES" >> $GITHUB_OUTPUT
            echo "EOF" >> $GITHUB_OUTPUT

        - name: Open PR
          if: steps.check.outputs.needed == 'true'
          env:
            GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
            TAG: ${{ steps.upstream.outputs.tag }}
            BRANCH: ${{ steps.branch.outputs.name }}
            CONFLICTS: ${{ steps.merge.outputs.conflicts }}
          run: |
            CONFLICT_NOTE=""
            if [ "$CONFLICTS" = "true" ]; then
              CONFLICT_NOTE="⚠️ **Conflicts detected.** Conflict markers are present in the branch. Resolve them before merging."
            else
              CONFLICT_NOTE="✅ Clean merge — no conflicts."
            fi

            gh pr create \
              --base gdpr/main \
              --head "$BRANCH" \
              --title "sync: upstream $TAG" \
              --body "## Upstream Sync: $TAG

  **Upstream release:** https://github.com/anomalyco/opencode/releases/tag/$TAG

  $CONFLICT_NOTE

  ### Files changed upstream

  \`\`\`
  ${{ steps.changed.outputs.files }}
  \`\`\`

  ### GDPR-critical files to review manually

  Check these files were not silently overridden (non-conflict upstream changes):
  - \`packages/opencode/src/gdpr/build-constants.ts\`
  - \`packages/opencode/src/net/egress-policy.ts\`
  - \`packages/opencode/src/provider/provider.ts\`
  - \`packages/opencode/src/audit/gdpr.ts\`
  - \`packages/opencode/src/audit/network.ts\`

  ### To validate locally

  \`\`\`bash
  git fetch origin
  git checkout $BRANCH
  # Resolve any conflict markers if present
  make validate-gdpr
  # Inspect audit log output
  \`\`\`

  After validation, update \`.github/upstream-version\` to \`$TAG\` and merge."

        - name: Job summary
          run: |
            NEEDED="${{ steps.check.outputs.needed }}"
            if [ "$NEEDED" = "true" ]; then
              echo "## Sync triggered for ${{ steps.upstream.outputs.tag }}" >> $GITHUB_STEP_SUMMARY
              echo "PR opened targeting gdpr/main." >> $GITHUB_STEP_SUMMARY
              echo "Conflicts: ${{ steps.merge.outputs.conflicts }}" >> $GITHUB_STEP_SUMMARY
            else
              echo "## Already up to date" >> $GITHUB_STEP_SUMMARY
              echo "Current synced tag: ${{ steps.current.outputs.tag }}" >> $GITHUB_STEP_SUMMARY
            fi
  ```

- [ ] **Step 2: Verify the file was written correctly**

  ```bash
  head -5 .github/workflows/sync-upstream.yml
  # Expected:
  # name: Sync Upstream (Scheduled)
  #
  # on:
  #   schedule:
  #     - cron: "0 6 * * *"
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add .github/workflows/sync-upstream.yml
  git commit -m "feat(ci): replace manual sync workflow with scheduled auto-detect"
  ```

---

## Task 3: Remove the CI test workflow

**Files:**
- Delete: `.github/workflows/test-gdpr.yml`

The `test-gdpr.yml` workflow runs GDPR tests and builds the binary in CI. Per the design, all testing moves to `make validate-gdpr` run locally. This workflow is removed to avoid burning Actions minutes on every PR.

- [ ] **Step 1: Delete the workflow file**

  ```bash
  rm .github/workflows/test-gdpr.yml
  ```

- [ ] **Step 2: Verify it's gone**

  ```bash
  ls .github/workflows/
  # Expected: only sync-upstream.yml remains
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add .github/workflows/test-gdpr.yml
  git commit -m "chore(ci): remove CI test workflow — testing moved to make validate-gdpr"
  ```

---

## Task 4: Add validate-gdpr Makefile target

**Files:**
- Modify: `Makefile`

Add a new `validate-gdpr` target that builds the GDPR binary for the current platform and runs a real session with `--audit`. The existing `test-gdpr`, `verify-gdpr`, and `gdpr-report` targets are kept untouched — they remain as unit/code-check targets.

- [ ] **Step 1: Add the target declaration to the .PHONY list**

  In `Makefile`, find the line:
  ```makefile
  .PHONY: test-gdpr verify-gdpr gdpr-report
  ```
  Change it to:
  ```makefile
  .PHONY: test-gdpr verify-gdpr gdpr-report validate-gdpr
  ```

- [ ] **Step 2: Add the validate-gdpr target**

  Find the `## gdpr-report:` target block (the last GDPR target in the file). Add the new target **before** it:

  ```makefile
  ## validate-gdpr: Build GDPR binary and run a real audit session for manual inspection
  validate-gdpr: build-gdpr-single
  	@echo "$(GREEN)Running GDPR audit validation session...$(NC)"
  	@echo "$(YELLOW)This runs a real LLM session — requires GitHub Copilot authentication$(NC)"
  	@echo ""
  	@BINARY=$$(find packages/opencode/dist -name "opencode*-gdpr" -type f -perm +111 2>/dev/null | head -1); \
  	if [ -z "$$BINARY" ]; then \
  		echo "$(RED)ERROR: GDPR binary not found. Run 'make build-gdpr-single' first.$(NC)"; \
  		exit 1; \
  	fi; \
  	echo "Using binary: $$BINARY"; \
  	echo ""; \
  	$$BINARY --audit run \
  		"Use the available tools and web search to give me a one-sentence summary of what OpenCode is. Keep it brief."; \
  	echo ""; \
  	echo "$(GREEN)Session complete.$(NC)"; \
  	echo ""; \
  	echo "Audit log location:"; \
  	find ~/.local/share/opencode ~/.config/opencode /tmp -name "audit*.jsonl" 2>/dev/null | head -3 || echo "  (check opencode default data directory)"; \
  	echo ""; \
  	echo "Inspect with:"; \
  	echo "  cat <audit-log-path> | jq ."
  ```

  Note: The indentation in Makefiles must use **tabs**, not spaces.

- [ ] **Step 3: Verify the Makefile parses correctly**

  ```bash
  make help | grep validate-gdpr
  # Expected: validate-gdpr  Build GDPR binary and run a real audit session for manual inspection
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add Makefile
  git commit -m "feat: add validate-gdpr Makefile target for local GDPR binary smoke test"
  ```

---

## Task 5: Smoke test the workflow locally

Before pushing, validate the workflow YAML is syntactically correct and the Makefile target works as expected.

- [ ] **Step 1: Lint the workflow YAML**

  ```bash
  # If actionlint is available:
  actionlint .github/workflows/sync-upstream.yml
  # If not available, use python yaml parser as a quick check:
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/sync-upstream.yml'))" && echo "YAML valid"
  # Expected: YAML valid
  ```

- [ ] **Step 2: Verify the workflow has the schedule trigger**

  ```bash
  grep -A2 "schedule:" .github/workflows/sync-upstream.yml
  # Expected:
  #   schedule:
  #     - cron: "0 6 * * *"
  ```

- [ ] **Step 3: Verify the upstream URL is correct (no typo)**

  ```bash
  grep "anomalyco" .github/workflows/sync-upstream.yml
  # Expected: https://github.com/anomalyco/opencode.git
  # Must NOT contain: anomalyxo
  ```

- [ ] **Step 4: Verify the upstream-version file exists and is readable**

  ```bash
  cat .github/upstream-version
  # Expected: a tag string like v1.2.15
  ```

- [ ] **Step 5: Dry-run the validate-gdpr target (build only, skip run)**

  ```bash
  make build-gdpr-single
  # Expected: build completes, binary appears in packages/opencode/dist/
  find packages/opencode/dist -name "opencode*-gdpr" -type f
  # Expected: one binary path printed
  ```

- [ ] **Step 6: Commit any fixes found during smoke test**

  ```bash
  git add -A
  git commit -m "fix: address smoke test findings" --allow-empty
  ```

---

## Task 6: Push and verify on GitHub

- [ ] **Step 1: Push all commits to gdpr/main**

  ```bash
  git push origin gdpr/main
  ```

- [ ] **Step 2: Verify the workflow appears in GitHub Actions**

  Open: `https://github.com/BKR-dev/opencoDE/actions`

  You should see "Sync Upstream (Scheduled)" listed. It will not have run yet (next run is 06:00 UTC).

- [ ] **Step 3: Manually trigger a test run against the current known tag**

  On the Actions page, click "Sync Upstream (Scheduled)" → "Run workflow" → enter the tag currently in `.github/upstream-version` (e.g. `v1.2.15`) → run.

  Expected result: workflow runs, reaches the "Check if sync needed" step, logs "Already up to date — nothing to do", and exits without creating a PR.

- [ ] **Step 4: Manually trigger a test run against a newer tag (if one exists)**

  Check `https://github.com/anomalyco/opencode/releases` for a tag newer than what's in `.github/upstream-version`. If one exists, trigger the workflow with that tag.

  Expected result: a PR is opened on `BKR-dev/opencoDE` targeting `gdpr/main` with title `sync: upstream vX.X.X`.

- [ ] **Step 5: Verify the PR body contains the expected sections**

  Check the opened PR contains:
  - Link to upstream release notes
  - Conflict status (true/false)
  - List of files changed upstream
  - GDPR-critical files checklist
  - `make validate-gdpr` instructions

---

## Post-Merge: Updating upstream-version

After you merge a sync PR, manually update `.github/upstream-version` to the new tag and commit to `gdpr/main`:

```bash
echo "vX.X.X" > .github/upstream-version
git add .github/upstream-version
git commit -m "chore: update upstream-version to vX.X.X post-merge"
git push origin gdpr/main
```

This prevents the workflow from re-opening the same PR on the next daily run.

> **Future improvement:** This step can be automated with a post-merge workflow that reads the PR title and updates the file automatically.
