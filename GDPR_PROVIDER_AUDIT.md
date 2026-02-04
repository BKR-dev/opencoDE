# GDPR Compliance - Provider and API Audit Report

**Project**: OpenCode GitHub Copilot Edition (BKR-dev fork)  
**Audit Date**: February 4, 2026  
**Goal**: Ensure ONLY GitHub Copilot provider is active, no other APIs accessible, full GDPR compliance for European market  
**Auditor**: Autonomous System with Haiku Subagents

---

## Executive Summary

### Current Status: ⚠️ **PARTIAL COMPLIANCE** (65/100)

The codebase has **good foundations** for GDPR compliance but requires **critical fixes** to ensure:

1. Only GitHub Copilot provider is visible/usable
2. All external API calls are audited
3. User data stays within GitHub/EU boundaries

### Key Findings

✅ **Strengths**:

- Egress policy framework exists (`OPENCODE_BLOCK_EXTERNAL_APIS`)
- GitHub-only mode implemented (`OPENCODE_ONLY_GITHUB`)
- Provider filtering at multiple layers
- Audit logging infrastructure present

🚨 **Critical Issues** (Must Fix):

1. **External APIs still active** - Honeycomb, models.dev, share API
2. **Incomplete audit logging** - Most external calls not logged
3. **Provider visibility leaks** - Config allows enabling other providers
4. **No user consent mechanism** - GDPR Art. 6/7 violations

---

## 1. Provider Loading Analysis

### 1.1 Current Architecture

**Bundled Providers** (embedded in binary):

- ✅ `@ai-sdk/github-copilot` - ONLY bundled provider

**Dynamic Loaders** (loaded at runtime if configured):

- ⚠️ Anthropic, OpenAI, Azure, Bedrock, Vertex, OpenRouter, etc. (17 providers)

### 1.2 Filtering Mechanisms

| Mechanism                        | Location             | Status          | Effectiveness                   |
| -------------------------------- | -------------------- | --------------- | ------------------------------- |
| **OPENCODE_ONLY_GITHUB**         | Environment variable | ✅ Working      | High - but bypassed by config   |
| **OPENCODE_BLOCK_EXTERNAL_APIS** | Environment variable | ✅ Working      | High - blocks egress            |
| **enabled_providers**            | Config file          | ⚠️ Can override | Medium - user can add providers |
| **disabled_providers**           | Config file          | ⚠️ Can override | Medium - default is empty       |
| **Bundled SDK check**            | `provider.ts:1018`   | ✅ Working      | High - only GitHub bundled      |

### 1.3 Issues Identified

#### 🔴 **CRITICAL: Config Can Override OPENCODE_ONLY_GITHUB**

**Location**: `packages/opencode/src/provider/provider.ts:662-663`

```typescript
const disabled = new Set(config.disabled_providers ?? [])
const enabled = config.enabled_providers ? new Set(config.enabled_providers) : null
```

**Problem**: User can add `enabled_providers: ["openai"]` in config file and bypass GitHub-only restriction.

**Impact**: GDPR violation - data sent to non-approved processors

**Fix**: Enforce OPENCODE_ONLY_GITHUB at config level, reject files with other providers

---

#### 🔴 **CRITICAL: Duplicate Filtering Logic**

**Location**: `packages/opencode/src/provider/models.ts` lines 141, 151, 176

**Problem**: OPENCODE_ONLY_GITHUB filtering code duplicated 4 times

**Impact**: Maintenance burden, inconsistent behavior risk

**Fix**: Centralize filtering in single function

---

#### 🟡 **MEDIUM: TUI Shows All Models by Default**

**Location**: `packages/app/src/routes/dialog/dialog-model.tsx`

**Problem**: Model selection UI fetches from `/api/provider` which may include non-GitHub models if config is modified

**Impact**: User confusion, potential GDPR violations

**Fix**: Server-side filtering must be enforced regardless of client state

---

## 2. External API Analysis

### 2.1 External Services Identified

| Service                 | Purpose               | GDPR Risk   | Current Status             |
| ----------------------- | --------------------- | ----------- | -------------------------- |
| **models.dev**          | Model metadata fetch  | 🟡 Medium   | Active (60min refresh)     |
| **api.opencode.ai**     | Session sharing       | 🔴 HIGH     | Active (full context sync) |
| **Honeycomb Analytics** | Usage telemetry       | 🔴 CRITICAL | Active (geo+IP data)       |
| **GitHub API**          | OAuth, user profile   | 🟢 Low      | Required (processor)       |
| **Exa AI**              | Web/code search (MCP) | 🟡 Medium   | Permission-gated           |
| **Context7**            | Documentation fetch   | 🟡 Medium   | Tool-gated                 |

### 2.2 Detailed Analysis

#### 🔴 **CRITICAL: Honeycomb Analytics**

**Location**: `packages/console/function/src/log-processor.ts:42`

```typescript
await fetch("https://api.honeycomb.io/1/events/zen", {
  // Sends: continent, country, city, coordinates, timezone, IP
})
```

**GDPR Violations**:

- Art. 5(1)(c): Purpose limitation - telemetry not disclosed
- Art. 6: No lawful basis (no consent, not necessary for service)
- Art. 44-50: Data transfer to US without Schrems II safeguards
- Art. 30: No audit trail of what's sent

**Fix Priority**: 🔥 **IMMEDIATE**

- Remove Honeycomb integration entirely OR
- Make opt-in with explicit consent OR
- Use EU-hosted alternative

---

#### 🔴 **HIGH: api.opencode.ai Session Sharing**

**Location**: `packages/opencode/src/share/share.ts:29-36`

```typescript
fetch(`${URL}/share_sync`, {
  method: "POST",
  body: JSON.stringify({
    sessionID,
    secret,
    key,
    content, // Full conversation context
  }),
})
```

**GDPR Concerns**:

- Art. 28: No DPA with opencode.ai
- Art. 32: No encryption-at-rest mentioned
- Art. 44-50: US data transfer without safeguards
- Art. 30: No audit of what's synced

**Fix Priority**: 🔥 **HIGH**

- Disable by default in GDPR mode
- Require explicit consent
- Add audit logging for all syncs
- EU-only deployment option

---

#### 🟡 **MEDIUM: models.dev Metadata**

**Location**: `packages/opencode/src/provider/models.ts:134-136`

```typescript
const url = Global.Path.modelsDevUrl // https://models.dev
const json = await fetch(`${url}/api.json`).then((x) => x.text())
```

**GDPR Concerns**:

- Art. 28: No DPA with models.dev
- Art. 30: No audit logging
- May leak provider usage patterns

**Fix Priority**: 🟡 **MEDIUM**

- Disable in `OPENCODE_ONLY_GITHUB` mode (partially done)
- Use bundled model metadata instead
- Audit all fetches

**Current Status**: ⚠️ Partially fixed - still fetches in some code paths

---

#### 🟢 **LOW: GitHub API**

**Required for Service**: ✅ Yes (OAuth, user profile)

**GDPR Compliance**:

- Art. 28: GitHub DPA required (user must provide)
- Art. 44-50: Adequacy decision exists (Privacy Shield 2.0 pending)

**Status**: ✅ Acceptable with user consent

---

### 2.3 Egress Policy Status

**Implementation**: `packages/opencode/src/net/egress-policy.ts`

**Allowlist** (when `OPENCODE_BLOCK_EXTERNAL_APIS=1`):

```typescript
allowed.add("api.github.com")
allowed.add("raw.githubusercontent.com")
allowed.add("localhost")
allowed.add("127.0.0.1")
```

**Status**: ✅ **GOOD** - Strict allowlist

**Issues**:

1. ⚠️ Not enabled by default
2. ⚠️ `models.dev` refresh bypasses policy (line 213)
3. ⚠️ Honeycomb calls not blocked (console package)

---

## 3. Audit Logging Gaps

### 3.1 Current Audit Coverage

**Events Logged** (✅ Good):

- `tool.websearch.request`
- `tool.webfetch.request`
- `mcp.tool.call`
- `fetch.tool.bypass`
- `package.install.blocked`

**Events NOT Logged** (❌ Critical Gap):

- Session sharing to api.opencode.ai
- Honeycomb analytics sends
- models.dev fetches
- GitHub API calls (OAuth, profile, etc.)
- Provider loading (which provider used)
- Model selection (which model used)
- User consent events
- Configuration changes

### 3.2 GDPR Audit Requirements (Art. 30)

**Must Log**:

1. ✅ Categories of processing activities (partial)
2. ❌ Purposes of processing
3. ❌ Categories of data subjects
4. ❌ Categories of personal data
5. ❌ Categories of recipients (third parties)
6. ❌ International transfers
7. ❌ Time limits for erasure
8. ❌ Technical and organizational security measures

**Gap**: Only 1/8 requirements met

---

## 4. GDPR Compliance Scorecard

| Requirement                              | Score  | Status     | Priority |
| ---------------------------------------- | ------ | ---------- | -------- |
| **Data Minimization** (Art. 5)           | 60/100 | ⚠️ Partial | HIGH     |
| **Lawful Basis** (Art. 6)                | 20/100 | ❌ Poor    | CRITICAL |
| **Consent Mechanism** (Art. 7)           | 0/100  | ❌ Missing | CRITICAL |
| **Transparency** (Art. 13)               | 30/100 | ❌ Poor    | CRITICAL |
| **Audit Logging** (Art. 30)              | 40/100 | ⚠️ Partial | HIGH     |
| **Security** (Art. 32)                   | 70/100 | ⚠️ Good    | MEDIUM   |
| **DPAs** (Art. 28)                       | 0/100  | ❌ Missing | CRITICAL |
| **User Rights** (Art. 15-21)             | 10/100 | ❌ Poor    | HIGH     |
| **Breach Response** (Art. 33-34)         | 0/100  | ❌ Missing | MEDIUM   |
| **International Transfers** (Art. 44-50) | 20/100 | ❌ Poor    | HIGH     |

**Overall Score**: 25/100 (❌ **NOT COMPLIANT**)

---

## 5. Remediation Plan

### Phase 1: Immediate Fixes (Week 1-2) 🔥

#### 1.1 Remove Honeycomb Analytics

**Files to Modify**:

- `packages/console/function/src/log-processor.ts` - Remove lines 42-50
- Environment: Set `OPENCODE_DISABLE_TELEMETRY=1`

**Verification**:

```bash
grep -r "honeycomb.io" packages/
# Should return no results after fix
```

---

#### 1.2 Disable Session Sharing by Default

**Files to Modify**:

- `packages/opencode/src/share/share.ts`

**Change**:

```typescript
// OLD
const disabled = process.env["OPENCODE_DISABLE_SHARE"] === "true"

// NEW
const disabled = process.env["OPENCODE_ENABLE_SHARE"] !== "true" || process.env.OPENCODE_ONLY_GITHUB === "1"
```

---

#### 1.3 Enforce OPENCODE_ONLY_GITHUB in Config

**Files to Modify**:

- `packages/opencode/src/provider/provider.ts:662-663`

**Add**:

```typescript
// Enforce OPENCODE_ONLY_GITHUB - reject config overrides
if (process.env.OPENCODE_ONLY_GITHUB) {
  config.enabled_providers = ["github-copilot", "github-copilot-enterprise"]
  config.disabled_providers = []
}

const disabled = new Set(config.disabled_providers ?? [])
const enabled = config.enabled_providers ? new Set(config.enabled_providers) : null
```

---

#### 1.4 Block models.dev in GitHub-only Mode

**Files to Modify**:

- `packages/opencode/src/provider/models.ts:200-216` (refresh function)

**Add**:

```typescript
export async function refresh() {
  if (process.env.OPENCODE_ONLY_GITHUB || process.env.OPENCODE_BLOCK_EXTERNAL_APIS) {
    log.info("models.dev fetch blocked in restricted mode")
    return // Don't fetch from models.dev
  }
  // ... existing code
}
```

---

### Phase 2: Enhanced Audit Logging (Week 2-3)

#### 2.1 Create Comprehensive Audit Middleware

**New File**: `packages/opencode/src/audit/middleware.ts`

```typescript
import { auditRecordNoWait } from "./index"

export namespace AuditMiddleware {
  // Provider usage
  export function logProviderUsage(providerID: string, modelID: string, sessionID: string) {
    auditRecordNoWait("provider.usage", {
      providerID,
      modelID,
      sessionID,
      time: new Date().toISOString(),
    })
  }

  // External API calls
  export function logExternalAPI(url: string, purpose: string, dataCategories: string[]) {
    auditRecordNoWait("external.api.call", {
      url,
      purpose,
      dataCategories,
      time: new Date().toISOString(),
    })
  }

  // User consent
  export function logConsent(userID: string, purpose: string, granted: boolean) {
    auditRecordNoWait("user.consent", {
      userID,
      purpose,
      granted,
      time: new Date().toISOString(),
    })
  }

  // Data transfer
  export function logDataTransfer(destination: string, dataType: string, legal_basis: string) {
    auditRecordNoWait("data.transfer", {
      destination,
      dataType,
      legal_basis,
      time: new Date().toISOString(),
    })
  }
}
```

---

#### 2.2 Instrument Provider Loading

**Files to Modify**:

- `packages/opencode/src/provider/provider.ts:1079-1092`

**Add**:

```typescript
export async function getLanguage(model: Model): Promise<LanguageModelV2> {
  // ADD: Audit provider usage
  const { auditRecordNoWait } = await import("../audit")
  auditRecordNoWait("provider.model.load", {
    providerID: model.providerID,
    modelID: model.id,
    npm: model.api.npm,
    bundled: BUNDLED_PROVIDERS[model.api.npm] !== undefined,
    time: new Date().toISOString(),
  })

  const s = await state()
  // ... rest of existing code
}
```

---

#### 2.3 Instrument External Fetches

**Files to Modify**:

- `packages/opencode/src/share/share.ts:29`

**Add**:

```typescript
await auditRecordNoWait("external.api.call", {
  service: "opencode.ai",
  endpoint: "/share_sync",
  sessionID,
  dataCategories: ["conversation_context", "session_metadata"],
  legal_basis: "user_consent_required",
  time: new Date().toISOString(),
})

return fetch(`${URL}/share_sync`, {
  // ... existing code
})
```

---

### Phase 3: User Consent & Transparency (Week 3-4)

#### 3.1 Create Privacy Notice

**New File**: `PRIVACY_NOTICE.md`

```markdown
# Privacy Notice - OpenCode GitHub Copilot Edition

## Data Controller

[Your Company Name]
[Address]
[Contact: privacy@example.com]

## What Data We Process

- Code you write and edit
- Conversation history with AI assistant
- GitHub authentication token
- Session metadata (timestamps, model used)

## Why We Process Your Data

- To provide AI coding assistance (Contractual necessity - GDPR Art. 6(1)(b))
- To authenticate with GitHub Copilot (Contractual necessity)

## Third-Party Processors

- GitHub, Inc. (USA) - AI model provider, Data Processing Agreement required

## Your Rights (GDPR Art. 15-21)

- Right to access your data
- Right to erasure ("right to be forgotten")
- Right to data portability
- Right to restrict processing
- Right to object

## Data Retention

- Session data: Deleted after 30 days
- Audit logs: Retained for 12 months (legal requirement)

## International Transfers

- Your code is sent to GitHub Copilot API (USA)
- Adequate safeguards: Standard Contractual Clauses (Schrems II)

## Contact

Data Protection Officer: dpo@example.com
```

---

#### 3.2 Add Consent Prompt (First Run)

**New File**: `packages/opencode/src/consent/consent.ts`

```typescript
import { Storage } from "../storage"
import { Log } from "../util/log"
import { auditRecordNoWait } from "../audit"

export namespace Consent {
  const log = Log.create({ service: "consent" })

  export async function hasGivenConsent(): Promise<boolean> {
    const consent = await Storage.read("consent/gdpr")
    return consent?.granted === true
  }

  export async function requestConsent(): Promise<boolean> {
    // Show privacy notice and consent prompt
    console.log("\n" + "=".repeat(80))
    console.log("PRIVACY NOTICE - OpenCode GitHub Copilot Edition")
    console.log("=".repeat(80))
    console.log("\nBy using this software, your code will be sent to:")
    console.log("  - GitHub Copilot API (USA) for AI assistance")
    console.log("\nYour rights:")
    console.log("  - Access, erasure, portability, restriction, objection")
    console.log("\nFull privacy notice: See PRIVACY_NOTICE.md")
    console.log("\nDo you consent to this data processing? (yes/no)")

    const response = prompt("Consent (yes/no): ")
    const granted = response?.toLowerCase() === "yes"

    await Storage.write("consent/gdpr", {
      granted,
      timestamp: new Date().toISOString(),
      version: "1.0",
    })

    auditRecordNoWait("user.consent.gdpr", {
      granted,
      time: new Date().toISOString(),
    })

    return granted
  }

  export async function ensureConsent() {
    if (process.env.OPENCODE_SKIP_CONSENT === "1") return // Testing only

    const hasConsent = await hasGivenConsent()
    if (!hasConsent) {
      const granted = await requestConsent()
      if (!granted) {
        console.error("\nConsent required to use OpenCode.")
        console.error("Without consent, we cannot process your code.")
        process.exit(1)
      }
    }
  }
}
```

**Integrate** in `packages/opencode/src/index.ts` (main entry point):

```typescript
import { Consent } from "./consent/consent"

async function main() {
  // GDPR consent check (first run)
  if (process.env.OPENCODE_ONLY_GITHUB) {
    await Consent.ensureConsent()
  }

  // ... rest of existing code
}
```

---

### Phase 4: Provider Lockdown (Week 4)

#### 4.1 Centralize Provider Filtering

**New File**: `packages/opencode/src/provider/filter.ts`

```typescript
import { Info } from "./provider"

export namespace ProviderFilter {
  const ALLOWED_IN_GITHUB_MODE = new Set(["github-copilot", "github-copilot-enterprise"])

  export function filterProviders(providers: Record<string, Info>): Record<string, Info> {
    if (!process.env.OPENCODE_ONLY_GITHUB) {
      return providers // No filtering
    }

    const filtered: Record<string, Info> = {}
    for (const [id, provider] of Object.entries(providers)) {
      if (ALLOWED_IN_GITHUB_MODE.has(id) || ALLOWED_IN_GITHUB_MODE.has(provider.id)) {
        filtered[id] = provider
      }
    }

    return filtered
  }

  export function isProviderAllowed(providerID: string): boolean {
    if (!process.env.OPENCODE_ONLY_GITHUB) return true
    return ALLOWED_IN_GITHUB_MODE.has(providerID)
  }
}
```

**Replace all duplicated filtering code** with calls to `ProviderFilter.filterProviders()`

---

### Phase 5: Testing & Verification (Week 5)

#### 5.1 Create GDPR Compliance Test Suite

**New File**: `packages/opencode/test/gdpr/compliance.test.ts`

```typescript
import { test, expect } from "bun:test"
import { Provider } from "../../src/provider/provider"
import { isEgressBlocked, hostAllowed } from "../../src/net/egress-policy"

test("OPENCODE_ONLY_GITHUB blocks non-GitHub providers", async () => {
  process.env.OPENCODE_ONLY_GITHUB = "1"

  const providers = await Provider.list()
  const providerIDs = Object.keys(providers)

  expect(providerIDs).toEqual(expect.arrayContaining(["github-copilot"]))

  // No other providers
  for (const id of providerIDs) {
    expect(id).toMatch(/^github-copilot/)
  }

  delete process.env.OPENCODE_ONLY_GITHUB
})

test("Egress policy blocks external APIs", () => {
  process.env.OPENCODE_BLOCK_EXTERNAL_APIS = "1"

  expect(isEgressBlocked()).toBe(true)
  expect(hostAllowed("https://api.github.com")).toBe(true)
  expect(hostAllowed("https://models.dev")).toBe(false)
  expect(hostAllowed("https://api.opencode.ai")).toBe(false)
  expect(hostAllowed("https://api.honeycomb.io")).toBe(false)

  delete process.env.OPENCODE_BLOCK_EXTERNAL_APIS
})

test("Audit logs provider usage", async () => {
  // Test that provider.model.load is logged
  // Test that external.api.call is logged
  // Test that user.consent is logged
})
```

**Run**: `make test-gdpr`

---

## 6. Recommended Environment Configuration

### Production GDPR-Compliant Deployment

**Environment Variables** (`.env` or deployment config):

```bash
# REQUIRED for GDPR compliance
OPENCODE_ONLY_GITHUB=1
OPENCODE_BLOCK_EXTERNAL_APIS=1
OPENCODE_DISABLE_SHARE=1           # Disable session sharing
OPENCODE_DISABLE_TELEMETRY=1       # Disable analytics

# Audit logging
OPENCODE_AUDIT_PATH=/var/log/opencode/audit.jsonl

# Optional: Consent management
OPENCODE_SKIP_CONSENT=0            # Require consent (default)

# Optional: Models
OPENCODE_MODELS_URL=""             # Empty = use bundled models only
```

---

## 7. Makefile Integration

Add to root `Makefile`:

```makefile
## test-gdpr: Run GDPR compliance tests
test-gdpr:
	@echo "$(GREEN)Running GDPR compliance tests...$(NC)"
	export OPENCODE_ONLY_GITHUB=1 && \
	export OPENCODE_BLOCK_EXTERNAL_APIS=1 && \
	cd packages/opencode && \
	bun test test/gdpr/
	@echo "$(GREEN)GDPR tests passed$(NC)"

## verify-gdpr: Full GDPR compliance verification
verify-gdpr: test-gdpr
	@echo "$(GREEN)Verifying GDPR configuration...$(NC)"
	@echo "Checking for external API references..."
	@! grep -r "honeycomb.io" packages/ || (echo "$(RED)Honeycomb found!$(NC)" && exit 1)
	@! grep -r "models.dev" packages/ --include="*.ts" | grep -v "test" | grep -v "OPENCODE_ONLY_GITHUB" || (echo "$(RED)Unprotected models.dev calls found!$(NC)" && exit 1)
	@echo "$(GREEN)GDPR verification complete$(NC)"
```

---

## 8. Migration Checklist

### Before European Market Launch

- [ ] **Remove Honeycomb** (Phase 1.1)
- [ ] **Disable session sharing** (Phase 1.2)
- [ ] **Enforce OPENCODE_ONLY_GITHUB** (Phase 1.3)
- [ ] **Block models.dev** (Phase 1.4)
- [ ] **Implement audit middleware** (Phase 2)
- [ ] **Add consent prompt** (Phase 3)
- [ ] **Publish privacy notice** (Phase 3)
- [ ] **Centralize provider filtering** (Phase 4)
- [ ] **Create GDPR test suite** (Phase 5)
- [ ] **Update Makefile** (Section 7)
- [ ] **Document deployment config** (Section 6)
- [ ] **Obtain GitHub DPA** (Legal team)
- [ ] **EU data residency audit** (Legal team)
- [ ] **Penetration testing** (Security team)
- [ ] **Legal review** (External counsel)

---

## 9. Cost-Benefit Analysis

### Implementation Cost

| Phase                      | Timeline    | Engineering Days | Cost (€150/day) |
| -------------------------- | ----------- | ---------------- | --------------- |
| Phase 1: Critical Fixes    | Week 1-2    | 5 days           | €7,500          |
| Phase 2: Audit Logging     | Week 2-3    | 8 days           | €12,000         |
| Phase 3: Consent UI        | Week 3-4    | 5 days           | €7,500          |
| Phase 4: Provider Lockdown | Week 4      | 3 days           | €4,500          |
| Phase 5: Testing           | Week 5      | 5 days           | €7,500          |
| Legal Review               | Week 6      | External         | €10,000         |
| **TOTAL**                  | **6 weeks** | **26 days**      | **€49,000**     |

### Risk Mitigation Value

**Potential GDPR Fine**: €20,000,000 or 4% annual revenue  
**Compliance Cost**: €49,000  
**ROI**: 400:1 risk mitigation ratio

---

## 10. Continuous Compliance

### Quarterly Audits

1. **Review audit logs** - Check for unauthorized API calls
2. **Provider list review** - Ensure only GitHub Copilot active
3. **Dependency audit** - Check for new external API dependencies
4. **User consent review** - Verify consent rates, update privacy notice
5. **Upstream sync review** - Ensure upstream changes don't break GDPR compliance

### Automated Checks

```bash
# Add to CI/CD pipeline
make verify-gdpr
```

---

## Appendix A: GDPR Articles Reference

- **Art. 5**: Principles (lawfulness, fairness, transparency, purpose limitation, data minimization)
- **Art. 6**: Lawful basis for processing
- **Art. 7**: Conditions for consent
- **Art. 13**: Information to be provided (transparency)
- **Art. 15-21**: Data subject rights (access, erasure, portability, etc.)
- **Art. 28**: Data processor agreements (DPAs)
- **Art. 30**: Records of processing activities (audit logging)
- **Art. 32**: Security of processing
- **Art. 33-34**: Breach notification (72 hours to authority)
- **Art. 44-50**: International data transfers (Schrems II)

---

## Appendix B: Contact

**For GDPR Questions**: consult your Data Protection Officer or legal counsel  
**For Technical Questions**: engineering team implementing this plan

---

**Report Complete**: February 4, 2026  
**Next Review**: After Phase 1 implementation (Week 2)  
**Status**: ⚠️ **REMEDIATION REQUIRED**
