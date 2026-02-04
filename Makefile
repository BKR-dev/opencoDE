# Makefile for OpenCode GitHub Copilot Edition
# Build, test, and deployment automation for BKR-dev fork

.PHONY: all install clean build test typecheck lint audit-test help
.PHONY: test-unit test-integration test-coverage test-watch
.PHONY: git-check git-sync dev publish
.PHONY: test-gdpr verify-gdpr gdpr-report
.PHONY: build-gdpr build-gdpr-single
.DEFAULT_GOAL := help

# Configuration
BUN_VERSION := 1.3.5
CURRENT_BUN := $(shell bun --version 2>/dev/null)
REPO_ORIGIN := git@github.com:BKR-dev/opencoDE.git
UPSTREAM_REPO := https://github.com/anomalyco/opencode.git
CURRENT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

## help: Display this help message
help:
	@echo "OpenCode GitHub Copilot Edition - Makefile Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Build & Development:"
	@echo "  install         Install dependencies with Bun"
	@echo "  build           Build all packages (standard)"
	@echo "  build-gdpr      Build GDPR-hardened binaries for EU"
	@echo "  build-gdpr-single  Build GDPR binary for current platform only"
	@echo "  dev             Start development server"
	@echo "  typecheck       Run TypeScript type checking"
	@echo "  clean           Remove build artifacts"
	@echo "  clean-all       Remove build artifacts and dependencies"
	@echo ""
	@echo "Testing:"
	@echo "  test            Run all tests"
	@echo "  test-unit       Run unit tests only"
	@echo "  test-coverage   Run tests with coverage"
	@echo "  test-watch      Run tests in watch mode"
	@echo "  audit-test      Test audit log functionality"
	@echo ""
	@echo "GDPR Compliance:"
	@echo "  test-gdpr       Run GDPR compliance test suite"
	@echo "  verify-gdpr     Verify GDPR compliance (tests + code checks)"
	@echo "  gdpr-report     Generate GDPR compliance report"
	@echo ""
	@echo "Git Operations:"
	@echo "  git-check       Verify git configuration is correct"
	@echo "  git-sync        Sync from upstream (with safety checks)"
	@echo ""
	@echo "Configuration:"
	@echo "  Current Branch: $(CURRENT_BRANCH)"
	@echo "  Bun Version:    $(BUN_VERSION) (current: $(CURRENT_BUN))"
	@echo "  Origin:         $(REPO_ORIGIN)"
	@echo ""

## install: Install all dependencies
install:
	@echo "$(GREEN)Installing dependencies...$(NC)"
	@if [ "$(CURRENT_BUN)" != "$(BUN_VERSION)" ]; then \
		echo "$(YELLOW)Warning: Bun version mismatch. Expected $(BUN_VERSION), got $(CURRENT_BUN)$(NC)"; \
	fi
	bun install
	@echo "$(GREEN)Dependencies installed successfully$(NC)"

## build: Build all packages (standard)
build: typecheck
	@echo "$(GREEN)Building packages...$(NC)"
	cd packages/opencode && bun run script/build.ts
	@echo "$(GREEN)Build completed successfully$(NC)"

## build-gdpr: Build GDPR-hardened binaries for European deployment
build-gdpr: typecheck
	@echo "$(GREEN)Building GDPR-hardened binaries...$(NC)"
	@echo "$(YELLOW)⚠  This build has GDPR restrictions permanently enabled:$(NC)"
	@echo "   • GitHub Copilot only (cannot be disabled)"
	@echo "   • External APIs blocked (cannot be overridden)"
	@echo "   • Telemetry disabled (hardcoded)"
	@echo "   • Session sharing disabled (hardcoded)"
	@echo ""
	cd packages/opencode && bun run script/build.ts --gdpr
	@echo "$(GREEN)GDPR-hardened build completed$(NC)"
	@echo "Binary names will include '-gdpr' suffix"

## build-gdpr-single: Build GDPR binary for current platform only (fast)
build-gdpr-single: typecheck
	@echo "$(GREEN)Building GDPR-hardened binary for current platform...$(NC)"
	cd packages/opencode && bun run script/build.ts --gdpr --single
	@echo "$(GREEN)GDPR-hardened single-platform build completed$(NC)"

## dev: Start development server
dev:
	@echo "$(GREEN)Starting development server...$(NC)"
	bun run dev

## typecheck: Run TypeScript type checking across all packages
typecheck:
	@echo "$(GREEN)Running type checks...$(NC)"
	bun turbo typecheck
	@echo "$(GREEN)Type checking passed$(NC)"

## test: Run all tests
test:
	@echo "$(GREEN)Running all tests...$(NC)"
	cd packages/opencode && bun test
	@echo "$(GREEN)All tests passed$(NC)"

## test-unit: Run unit tests only
test-unit:
	@echo "$(GREEN)Running unit tests...$(NC)"
	cd packages/opencode && bun test --preload test/setup.ts
	@echo "$(GREEN)Unit tests passed$(NC)"

## test-coverage: Run tests with coverage report
test-coverage:
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	cd packages/opencode && bun test --coverage
	@echo "$(GREEN)Coverage report generated$(NC)"

## test-watch: Run tests in watch mode
test-watch:
	@echo "$(GREEN)Running tests in watch mode...$(NC)"
	cd packages/opencode && bun test --watch

## audit-test: Test audit log functionality
audit-test:
	@echo "$(GREEN)Testing audit log functionality...$(NC)"
	cd packages/opencode && bun test test/audit/audit.test.ts
	@echo "$(GREEN)Audit log tests passed$(NC)"

## git-check: Verify git configuration is safe for fork
git-check:
	@echo "$(GREEN)Checking git configuration...$(NC)"
	@CURRENT_ORIGIN=$$(git remote get-url origin 2>/dev/null || echo "none"); \
	if [ "$$CURRENT_ORIGIN" != "$(REPO_ORIGIN)" ]; then \
		echo "$(RED)ERROR: Origin mismatch!$(NC)"; \
		echo "Expected: $(REPO_ORIGIN)"; \
		echo "Got:      $$CURRENT_ORIGIN"; \
		exit 1; \
	fi
	@echo "  ✓ Origin correctly set to BKR-dev fork"
	@UPSTREAM=$$(git remote get-url upstream 2>/dev/null || echo "none"); \
	if [ "$$UPSTREAM" = "none" ]; then \
		echo "$(YELLOW)  ⚠ No upstream remote configured$(NC)"; \
		echo "  Run: git remote add upstream $(UPSTREAM_REPO)"; \
	else \
		echo "  ✓ Upstream configured: $$UPSTREAM"; \
	fi
	@if git diff --quiet; then \
		echo "  ✓ Working directory is clean"; \
	else \
		echo "$(YELLOW)  ⚠ Working directory has uncommitted changes$(NC)"; \
	fi
	@if [ "$(CURRENT_BRANCH)" = "main" ] || [ "$(CURRENT_BRANCH)" = "master" ]; then \
		echo "$(YELLOW)  ⚠ On protected branch: $(CURRENT_BRANCH)$(NC)"; \
	else \
		echo "  ✓ On branch: $(CURRENT_BRANCH)"; \
	fi
	@echo "$(GREEN)Git configuration check complete$(NC)"

## git-sync: Sync from upstream (with safety checks)
git-sync: git-check
	@echo "$(GREEN)Syncing from upstream...$(NC)"
	@if [ "$$(git remote get-url upstream 2>/dev/null)" = "" ]; then \
		echo "$(YELLOW)Adding upstream remote...$(NC)"; \
		git remote add upstream $(UPSTREAM_REPO); \
	fi
	@echo "Fetching from upstream..."
	@git fetch upstream
	@echo "$(YELLOW)Ready to merge upstream/dev into $(CURRENT_BRANCH)$(NC)"
	@echo "Review changes before merging:"
	@git log HEAD..upstream/dev --oneline --max-count=10
	@echo ""
	@echo "To complete the sync, run:"
	@echo "  git merge upstream/dev"
	@echo "  make test"
	@echo "  git push origin $(CURRENT_BRANCH)"
	@echo ""
	@echo "$(YELLOW)Note: This will NOT push to upstream, only to your fork$(NC)"

## clean: Remove build artifacts
clean:
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	@find packages -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	@find packages -type d -name ".turbo" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf .turbo
	@rm -rf $(AUDIT_TEST_DIR)
	@echo "$(GREEN)Clean complete$(NC)"

## clean-all: Remove build artifacts and dependencies
clean-all: clean
	@echo "$(GREEN)Removing all dependencies...$(NC)"
	@rm -rf node_modules
	@find packages -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	@echo "$(GREEN)Deep clean complete$(NC)"

## all: Run full build and test pipeline
all: clean install build test audit-test
	@echo "$(GREEN)========================================$(NC)"
	@echo "$(GREEN)All tasks completed successfully!$(NC)"
	@echo "$(GREEN)========================================$(NC)"

## test-gdpr: Run GDPR compliance test suite
test-gdpr:
	@echo "$(GREEN)Running GDPR compliance tests...$(NC)"
	@echo "Testing with OPENCODE_ONLY_GITHUB=1 environment"
	@export OPENCODE_ONLY_GITHUB=1 && \
	export OPENCODE_BLOCK_EXTERNAL_APIS=1 && \
	cd packages/opencode && \
	bun test test/audit/gdpr-compliance.test.ts
	@echo "$(GREEN)GDPR compliance tests passed$(NC)"

## verify-gdpr: Comprehensive GDPR compliance verification
verify-gdpr: test-gdpr
	@echo "$(GREEN)Verifying GDPR compliance...$(NC)"
	@echo ""
	@echo "$(YELLOW)Checking for GDPR violations in code:$(NC)"
	@echo ""
	@echo "  [1/4] Checking for Honeycomb analytics..."
	@if grep -r "api.honeycomb.io" packages/ 2>/dev/null | grep -v "GDPR COMPLIANCE" | grep -v "//" | grep -q .; then \
		echo "$(RED)    ✗ FAIL: Honeycomb analytics still active$(NC)"; \
		grep -r "api.honeycomb.io" packages/ | grep -v "GDPR COMPLIANCE" | grep -v "//"; \
		exit 1; \
	else \
		echo "$(GREEN)    ✓ PASS: No active Honeycomb calls found$(NC)"; \
	fi
	@echo ""
	@echo "  [2/4] Checking models.dev blocking..."
	@if grep -A5 "export async function refresh()" packages/opencode/src/provider/models.ts | grep -q "OPENCODE_ONLY_GITHUB"; then \
		echo "$(GREEN)    ✓ PASS: models.dev blocked in GDPR mode$(NC)"; \
	else \
		echo "$(RED)    ✗ FAIL: models.dev not blocked in GDPR mode$(NC)"; \
		exit 1; \
	fi
	@echo ""
	@echo "  [3/4] Checking session sharing defaults..."
	@if grep -A10 "const disabled" packages/opencode/src/share/share.ts | grep -q "githubOnlyMode"; then \
		echo "$(GREEN)    ✓ PASS: Session sharing disabled by default$(NC)"; \
	else \
		echo "$(RED)    ✗ FAIL: Session sharing not properly disabled$(NC)"; \
		exit 1; \
	fi
	@echo ""
	@echo "  [4/4] Checking config override protection..."
	@if grep -A5 "githubOnlyMode = " packages/opencode/src/provider/provider.ts | grep -q "OPENCODE_ONLY_GITHUB"; then \
		echo "$(GREEN)    ✓ PASS: Config override protection in place$(NC)"; \
	else \
		echo "$(RED)    ✗ FAIL: Config override protection missing$(NC)"; \
		exit 1; \
	fi
	@echo ""
	@echo "$(GREEN)========================================$(NC)"
	@echo "$(GREEN)GDPR Compliance Verification PASSED$(NC)"
	@echo "$(GREEN)========================================$(NC)"
	@echo ""
	@echo "Summary:"
	@echo "  ✓ Honeycomb analytics disabled"
	@echo "  ✓ models.dev blocked in GDPR mode"
	@echo "  ✓ Session sharing disabled by default"
	@echo "  ✓ Config override protection active"
	@echo "  ✓ All GDPR tests passed"
	@echo ""

## gdpr-report: Generate GDPR compliance report
gdpr-report:
	@echo "$(GREEN)Generating GDPR Compliance Report...$(NC)"
	@echo ""
	@echo "=========================================="
	@echo "OpenCode GDPR Compliance Report"
	@echo "Generated: $$(date '+%Y-%m-%d %H:%M:%S')"
	@echo "Branch: $(CURRENT_BRANCH)"
	@echo "=========================================="
	@echo ""
	@echo "Environment Configuration:"
	@echo "  OPENCODE_ONLY_GITHUB:          $${OPENCODE_ONLY_GITHUB:-not set}"
	@echo "  OPENCODE_BLOCK_EXTERNAL_APIS:  $${OPENCODE_BLOCK_EXTERNAL_APIS:-not set}"
	@echo "  OPENCODE_ENABLE_SHARE:         $${OPENCODE_ENABLE_SHARE:-not set}"
	@echo "  OPENCODE_DISABLE_TELEMETRY:    $${OPENCODE_DISABLE_TELEMETRY:-not set}"
	@echo ""
	@echo "Code Compliance Status:"
	@echo ""
	@echo "1. Provider Restrictions:"
	@if grep -q "githubOnlyMode = !!process.env.OPENCODE_ONLY_GITHUB" packages/opencode/src/provider/provider.ts; then \
		echo "   ✓ Config override protection implemented"; \
	else \
		echo "   ✗ Config override protection missing"; \
	fi
	@echo ""
	@echo "2. External API Blocking:"
	@if grep -q "GDPR COMPLIANCE" packages/opencode/src/provider/models.ts; then \
		echo "   ✓ models.dev blocked in GDPR mode"; \
	else \
		echo "   ✗ models.dev not blocked"; \
	fi
	@if grep -q "GDPR COMPLIANCE" packages/console/function/src/log-processor.ts; then \
		echo "   ✓ Honeycomb analytics disabled"; \
	else \
		echo "   ✗ Honeycomb analytics still active"; \
	fi
	@echo ""
	@echo "3. Session Sharing:"
	@if grep -q "githubOnlyMode" packages/opencode/src/share/share.ts; then \
		echo "   ✓ Session sharing disabled by default"; \
	else \
		echo "   ✗ Session sharing not properly configured"; \
	fi
	@echo ""
	@echo "4. Audit Logging:"
	@if [ -f "packages/opencode/src/audit/gdpr.ts" ]; then \
		echo "   ✓ GDPR audit middleware exists"; \
		echo "   ✓ Functions: $$(grep -c "^export function" packages/opencode/src/audit/gdpr.ts) audit functions"; \
	else \
		echo "   ✗ GDPR audit middleware missing"; \
	fi
	@echo ""
	@echo "5. Test Coverage:"
	@if [ -f "packages/opencode/test/audit/gdpr-compliance.test.ts" ]; then \
		echo "   ✓ GDPR compliance tests exist"; \
		echo "   ✓ Test cases: $$(grep -c "^  test(" packages/opencode/test/audit/gdpr-compliance.test.ts)"; \
	else \
		echo "   ✗ GDPR compliance tests missing"; \
	fi
	@echo ""
	@echo "=========================================="
	@echo ""
	@echo "Recommended Environment for EU Deployment:"
	@echo ""
	@echo "  export OPENCODE_ONLY_GITHUB=1"
	@echo "  export OPENCODE_BLOCK_EXTERNAL_APIS=1"
	@echo "  export OPENCODE_DISABLE_TELEMETRY=1"
	@echo "  # Session sharing is disabled by default (opt-in)"
	@echo ""
	@echo "To verify compliance:"
	@echo "  make verify-gdpr"
	@echo ""
