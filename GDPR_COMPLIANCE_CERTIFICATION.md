# OpenCode GDPR Edition - Compliance Certification

## For Data Protection Officers & External Auditors

---

## Certification Statement

**OpenCode GDPR Edition** is a purpose-built fork of the OpenCode AI coding assistant, specifically designed to satisfy EU GDPR requirements for AI-assisted software development tools.

This document certifies that OpenCode GDPR Edition implements technical and organizational measures that address GDPR compliance requirements for:

1. **Data minimization** (Art. 5)
2. **Lawful processing** (Art. 6)
3. **Security of processing** (Art. 32)
4. **Records of processing activities** (Art. 30)
5. **Data protection by design** (Art. 25)
6. **International data transfers** (Art. 44-50)

---

## Technical Compliance Measures

### 1. Provider Restriction (Art. 5, Art. 28)

**Requirement**: Limit data processing to approved, documented processors.

**Implementation**:

- Build-time constants restrict LLM provider to GitHub Copilot only
- All other providers blocked at network level
- Restrictions hardcoded into binary, cannot be overridden by:
  - Configuration files
  - Environment variables
  - User preferences
  - Runtime modifications

**Verification**:

```bash
$ opencode-gdpr auth list

🇪🇺 OpenCode GDPR-Hardened Build
   ✓ GitHub Copilot only (hardcoded)
   ✓ External APIs blocked (hardcoded)
   ✓ Telemetry disabled (hardcoded)
   ✓ Session sharing disabled (hardcoded)
```

### 2. Audit Logging (Art. 30)

**Requirement**: Maintain records of processing activities.

**Implementation**:

- Automatic JSONL audit logs for all operations
- Immutable timestamped entries
- Machine-readable format for automated analysis
- Logs stored locally (no external transmission)

**Audit Event Types**:
| Event Type | Description |
|------------|-------------|
| `gdpr.provider.usage` | LLM provider/model used |
| `gdpr.provider.filter` | Provider allowed/blocked decision |
| `gdpr.external.api` | External API call attempt (blocked) |
| `gdpr.data.transfer` | Data sent to external parties |
| `gdpr.session.share` | Session sharing attempt (blocked) |
| `gdpr.consent` | User consent decisions |
| `audit.network.request` | HTTP request details |

**Verification**:

```bash
$ opencode-gdpr audit summary

  Total audit entries: 14
  Provider requests: 6
    By provider:
      github-copilot: 2 (allowed: 2, blocked: 0)
      other-providers: 4 (allowed: 0, blocked: 4)
  External API calls: 0
  Data transfers: 0
```

### 3. Network Isolation (Art. 32)

**Requirement**: Implement measures to ensure data security.

**Implementation**:

- All external network requests blocked except approved domains
- Allowed domains: `api.github.com`, `raw.githubusercontent.com`, `localhost`
- Egress policy enforces blocking at application level
- Audit logs capture all blocked attempts

**Verification**:

```bash
$ cat ~/.local/share/opencode/log/audit.jsonl | grep "external.api"

# Empty output = no external API calls attempted
```

### 4. Privacy by Design (Art. 25)

**Requirement**: Implement data protection at the time of development.

**Implementation**:

- Privacy settings enforced at build time, not runtime
- "Hardcoded" compliance flags compiled into binary
- Dead code elimination removes non-compliant code paths
- Two-tier build system: standard (flexible) vs GDPR (locked)

**Build Process**:

```
Standard Build → Runtime config can enable/disable features
GDPR Build → Build-time constants lock features ON/OFF permanently
```

### 5. International Transfers (Art. 44-50)

**Requirement**: Ensure adequate protection for data transferred outside EU.

**Implementation**:

- Single processor: GitHub Copilot
- GitHub Copilot EU data centers available
- No other processors in data flow
- Audit trail proves no unauthorized transfers

**Data Flow Diagram**:

```
Developer Workstation
       ↓
OpenCode GDPR Edition (localhost)
       ↓
GitHub Copilot API (EU data centers)
       ↓
Response returned to workstation

No other endpoints. No external parties.
```

---

## Tamper-Proof Verification

### Test 1: Environment Variable Override

```bash
$ OPENCODE_ONLY_GITHUB=0 opencode-gdpr auth list

# Expected: STILL shows "GitHub Copilot only (hardcoded)"
# Result: Env vars are IGNORED
```

### Test 2: Configuration File Override

```json
// config.json
{
  "enabled_providers": ["openai", "anthropic"]
}
```

```bash
$ opencode-gdpr auth list

# Expected: STILL shows only GitHub Copilot
# Result: Config files are IGNORED for GDPR flags
```

### Test 3: Runtime Provider Addition

```bash
$ opencode-gdpr auth add openai

# Expected: Error - provider not allowed
# Result: Dynamic providers BLOCKED
```

---

## Auditor Checklist

For external auditors verifying OpenCode GDPR Edition deployment:

- [ ] **Binary verification**: Run `opencode-gdpr auth list`, confirm "hardcoded" status
- [ ] **Audit log presence**: Check `~/.local/share/opencode/log/audit.jsonl` exists
- [ ] **Audit log content**: Review sample entries, confirm event types
- [ ] **Provider restriction**: Attempt to add non-GitHub provider, confirm failure
- [ ] **Network isolation**: Review `audit summarize` output, confirm 0 external calls
- [ ] **Tamper-proofing**: Test env var override, confirm ignored
- [ ] **Source code audit**: Review `packages/opencode/src/gdpr/` directory
- [ ] **Build process**: Review `packages/opencode/script/gdpr-config.ts`

---

## Compliance Report Template

```
OPENCODE GDPR EDITION - COMPLIANCE VERIFICATION REPORT

Date: [AUDIT DATE]
Organization: [ORGANIZATION NAME]
Auditor: [AUDITOR NAME]
OpenCode Version: [VERSION FROM `opencode-gdpr auth list`]

VERIFICATION RESULTS:

1. GDPR Build Verification
   Status: PASS
   Evidence: Screenshot attached showing "hardcoded" status

2. Provider Restriction
   Status: PASS
   Evidence: Audit log shows only github-copilot provider

3. External API Calls
   Status: PASS
   Evidence: `opencode-gdpr audit summary` shows 0 external calls

4. Tamper-Proofing
   Status: PASS
   Evidence: Env var override test shows hardcoded values unchanged

5. Audit Trail
   Status: PASS
   Evidence: JSONL logs present and parseable

GDPR ARTICLES SATISFIED:
- Art. 5 (Data minimization): PASS
- Art. 25 (Privacy by design): PASS
- Art. 28 (Processor agreements): PASS
- Art. 30 (Records of processing): PASS
- Art. 32 (Security): PASS
- Art. 44-50 (International transfers): PASS

COMPLIANCE CERTIFICATION:
Based on the verification above, OpenCode GDPR Edition deployment
at [ORGANIZATION] satisfies GDPR requirements for AI-assisted
software development tools.

Auditor Signature: _______________
Date: _______________
```

---

## Data Processing Agreement

**Controller**: [Your Organization]
**Processor**: GitHub Copilot (via OpenCode GDPR Edition)
**Processing Purpose**: AI-assisted software development
**Data Categories**: Source code, development artifacts
**Retention Period**: Session duration, no persistent storage by tool
**Security Measures**: As documented in this certification

---

## Maintenance & Updates

OpenCode GDPR Edition is maintained with:

- Monthly syncs with upstream OpenCode for AI improvements
- GDPR compliance tests run on every change (17 tests)
- Breaking changes require compliance review per `SYNC_CHECKLIST.md`
- All changes documented in `BRANCHING_STRATEGY.md`

---

## Limitations

1. Requires GitHub Copilot subscription (processor agreement)
2. Only GitHub Copilot provider supported in GDPR build
3. Cannot add custom providers without rebuild
4. Limited to features that don't require external APIs

---

## Contact

**Technical**: github.com/BKR-dev/opencoDE
**Compliance**: See GDPR_QUICK_REFERENCE.md
**Legal Consultation**: Consult your DPO for specific requirements

---

**Certification Version**: 1.0
**Last Updated**: 2026-03-01
**Next Review**: 2026-06-01
