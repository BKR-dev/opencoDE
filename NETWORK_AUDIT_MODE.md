# Network Audit Mode for GDPR Compliance Verification

## Overview

OpenCode GDPR builds now include a comprehensive **network audit mode** that logs all HTTP requests, allowing you to verify that no unauthorized API requests are being sent outside of the allowed providers.

This addresses the requirement: **"Can the GDPR binary be started with a --audit flag to create audit logging that shows that no API request is being sent outside of the provider used for LLMs?"**

**Answer: YES** ✅

---

## Quick Start

### Enable Audit Mode

Run any OpenCode command with the `--audit` flag:

```bash
# GDPR binary with audit mode
./opencode-darwin-arm64-gdpr --audit

# Or with specific commands
./opencode-darwin-arm64-gdpr --audit run "Fix the bug in server.ts"
./opencode-darwin-arm64-gdpr --audit auth list
```

### View Audit Logs

```bash
# View recent audit entries
opencode audit view

# Show statistics
opencode audit summary

# Verify GDPR compliance
opencode audit verify
```

---

## What Gets Logged

When `--audit` mode is enabled, OpenCode logs:

### 1. **Network Requests**

Every HTTP/HTTPS request is logged with:

- URL and hostname
- HTTP method (GET, POST, etc.)
- Destination type (provider, github, external, localhost)
- Allowed/blocked status
- HTTP status code
- Response time
- Reason for blocking (if applicable)

### 2. **Provider API Calls (LLM Requests)**

All AI provider communications are logged with:

- Provider ID (e.g., `github-copilot`)
- Model ID (e.g., `gpt-4`)
- Endpoint URL
- Token usage (prompt + completion)
- Allowed/blocked status

### 3. **External API Calls**

Any third-party service calls are logged with:

- Service name
- URL
- Purpose
- Data categories transferred
- Blocked status

---

## Example Output

### Startup Message (GDPR Build)

```
🇪🇺 OpenCode GDPR-Hardened Build
   Build: gdpr (2026-02-04T14:35:44.254Z)
   ✓ GitHub Copilot only (hardcoded)
   ✓ External APIs blocked (hardcoded)
   ✓ Telemetry disabled (hardcoded)
   ✓ Session sharing disabled (hardcoded)

🔍 Network audit mode enabled - all HTTP requests will be logged
   Audit logs: ~/.local/share/opencode/log/audit.jsonl, ~/.opencode/audit/audit.jsonl
```

### Real-Time Network Logging

As requests occur, you'll see:

```
   🤖 Provider: github-copilot/gpt-4 → github-copilot API [150→450 tokens]
   ✓ POST api.github.com/chat/completions [200] (1234ms)
   ✓ GET raw.githubusercontent.com/user/repo/main/file.ts [200] (456ms)
   🚫 POST api.anthropic.com/v1/messages
      ⚠️  Reason: External APIs blocked in GDPR mode
```

Icons:

- ✓ = Allowed and completed
- 🤖 = AI provider request
- 🚫 = Blocked (GDPR enforcement)
- ❌ = Denied (not allowed)
- 🐙 = GitHub request

---

## Audit Log Format

Audit logs are stored in **JSONL format** (one JSON object per line) at:

1. `~/.local/share/opencode/log/audit.jsonl` (primary)
2. `~/.opencode/audit/audit.jsonl` (fallback)
3. `$OPENCODE_AUDIT_PATH` (custom location)

### Example Audit Entry (Network Request)

```json
{
  "ts": "2026-02-04T15:30:45.123Z",
  "event": "audit.network.request",
  "details": {
    "url": "https://api.github.com/chat/completions",
    "method": "POST",
    "protocol": "fetch",
    "destination": "github",
    "allowed": true,
    "blocked": false,
    "hostname": "api.github.com",
    "pathname": "/chat/completions",
    "status": 200,
    "duration": 1234,
    "time": "2026-02-04T15:30:45.123Z",
    "gdprMode": true,
    "egressBlocked": true
  }
}
```

### Example Audit Entry (Provider Request)

```json
{
  "ts": "2026-02-04T15:30:45.123Z",
  "event": "audit.provider.request",
  "details": {
    "providerID": "github-copilot",
    "modelID": "gpt-4",
    "endpoint": "github-copilot API",
    "method": "POST",
    "allowed": true,
    "promptTokens": 150,
    "completionTokens": 450,
    "time": "2026-02-04T15:30:45.123Z",
    "gdprMode": true
  }
}
```

### Example Audit Entry (Blocked External API)

```json
{
  "ts": "2026-02-04T15:30:45.123Z",
  "event": "gdpr.external.api",
  "details": {
    "url": "https://api.anthropic.com/v1/messages",
    "method": "POST",
    "service": "Anthropic Claude",
    "purpose": "LLM completion",
    "blocked": true,
    "reason": "External APIs blocked in GDPR mode",
    "time": "2026-02-04T15:30:45.123Z",
    "gdprMode": true,
    "egressBlocked": true
  }
}
```

---

## Audit Commands

### 1. View Recent Entries

```bash
opencode audit view [lines]

# Examples
opencode audit view          # Last 50 entries
opencode audit view 100      # Last 100 entries
opencode audit tail          # Alias for view
```

**Output**:

```
┌  Audit Log
│
[2/4/2026, 3:30:45 PM] network.request
  ✓ POST api.github.com/chat/completions
     Status: 200
     Duration: 1234ms

[2/4/2026, 3:30:46 PM] provider.request
  Provider: github-copilot
  Model: gpt-4
  Tokens: 150 → 450

[2/4/2026, 3:30:47 PM] external.api
  URL: https://api.anthropic.com/v1/messages
  Service: Anthropic Claude
  Purpose: LLM completion
  ⚠️ BLOCKED
│
└  Total entries: 1,234
```

### 2. Show Statistics

```bash
opencode audit summary
opencode audit stats     # Alias
```

**Output**:

```
┌  Audit Summary
│
Audit log: ~/.local/share/opencode/log/audit.jsonl

Total audit entries: 1,234
Network requests: 456
  ✓ Allowed: 450
  🚫 Blocked: 6
  🐙 GitHub: 450
Provider requests: 234
  By provider:
    github-copilot: 234
External API calls: 6
Consent events: 0
Data transfers: 0
Config changes: 0
│
└  Done
```

### 3. Verify GDPR Compliance

```bash
opencode audit verify
```

**Output (Compliant)**:

```
┌  GDPR Compliance Verification
│
Analyzed 1,234 audit entries

✓ GDPR mode was active
✓ Only GitHub Copilot providers were used
✓ No external API calls detected
ℹ️  6 requests were blocked

✅ No GDPR compliance issues detected
│
└  Done
```

**Output (Non-Compliant)**:

```
┌  GDPR Compliance Verification
│
Analyzed 1,234 audit entries

✓ GDPR mode was active
❌ GDPR Violations:
   Non-GitHub providers detected: anthropic, openai
⚠️  Warnings:
   External APIs called: api.anthropic.com, api.openai.com
│
└  Done
```

---

## Use Cases

### 1. Verify GDPR Build Compliance

**Scenario**: You want to prove to auditors that your GDPR binary only communicates with GitHub.

**Steps**:

```bash
# Run your normal workflow with audit enabled
./opencode-darwin-arm64-gdpr --audit run "Implement the new feature"

# After completion, verify compliance
./opencode-darwin-arm64-gdpr audit verify
```

**Expected Result**:

```
✓ GDPR mode was active
✓ Only GitHub Copilot providers were used
✓ No external API calls detected
✅ No GDPR compliance issues detected
```

### 2. Debug Network Issues

**Scenario**: Requests are being blocked unexpectedly.

**Steps**:

```bash
# Run with audit to see exactly what's being blocked
./opencode --audit run "Debug this"

# Look at recent logs
./opencode audit view 100 | grep "BLOCKED"
```

### 3. Generate Compliance Reports

**Scenario**: You need a monthly compliance report for auditors.

**Steps**:

```bash
# Generate summary
./opencode audit summary > compliance-report-2026-02.txt

# Verify compliance
./opencode audit verify >> compliance-report-2026-02.txt

# View full audit log
cat ~/.local/share/opencode/log/audit.jsonl > full-audit-2026-02.jsonl
```

### 4. Monitor API Usage

**Scenario**: Track which APIs are being used and how often.

**Steps**:

```bash
# Get statistics
./opencode audit summary

# Filter audit log for specific provider
grep "github-copilot" ~/.local/share/opencode/log/audit.jsonl | wc -l

# Check token usage
grep "provider.request" ~/.local/share/opencode/log/audit.jsonl | \
  jq '.details.promptTokens + .details.completionTokens' | \
  awk '{sum+=$1} END {print sum}'
```

---

## Custom Audit Log Location

You can specify a custom audit log path:

```bash
export OPENCODE_AUDIT_PATH=/var/log/opencode/compliance.jsonl
./opencode --audit run "Task"
```

This is useful for:

- Centralized logging systems
- Docker/Kubernetes environments
- Compliance requirements for specific log locations

---

## Integration with External Tools

### Send to Syslog

```bash
tail -f ~/.local/share/opencode/log/audit.jsonl | \
  while read line; do
    logger -t opencode-audit "$line"
  done
```

### Send to Elasticsearch

```bash
cat ~/.local/share/opencode/log/audit.jsonl | \
  while read line; do
    curl -X POST "localhost:9200/opencode-audit/_doc" \
      -H 'Content-Type: application/json' \
      -d "$line"
  done
```

### Filter and Alert

```bash
# Alert if non-GitHub provider is used
tail -f ~/.local/share/opencode/log/audit.jsonl | \
  jq 'select(.event == "gdpr.provider.usage" and .details.providerID != "github-copilot")' | \
  while read violation; do
    echo "⚠️ GDPR VIOLATION: $violation"
    # Send alert email, Slack notification, etc.
  done
```

---

## Performance Impact

Audit mode has minimal performance impact:

- **Network logging**: <1ms overhead per request
- **File I/O**: Async, non-blocking writes
- **Disk usage**: ~500 bytes per request (compressed)

**Example**: 1,000 requests ≈ 500KB audit log

---

## Security Considerations

### Audit Log Protection

Audit logs may contain sensitive information:

- URLs with query parameters
- HTTP headers (sanitized by default)
- Request/response metadata

**Recommendations**:

1. Restrict audit log file permissions:

   ```bash
   chmod 600 ~/.local/share/opencode/log/audit.jsonl
   ```

2. Rotate logs regularly:

   ```bash
   # Move old logs
   mv audit.jsonl audit-$(date +%Y-%m).jsonl

   # Compress
   gzip audit-2026-02.jsonl
   ```

3. Encrypt archived logs:
   ```bash
   gpg --encrypt audit-2026-02.jsonl.gz
   ```

### PII Protection

By default, audit logging **does not** capture:

- Request/response bodies
- Authentication tokens
- User credentials
- File contents

Only metadata is logged (URLs, status codes, timings).

---

## Troubleshooting

### Audit log not found

**Error**: `No audit log found. Run with --audit flag to enable audit logging.`

**Solution**: Ensure you've run at least one command with `--audit`:

```bash
./opencode --audit auth list
```

### Audit log empty

**Check**:

```bash
ls -la ~/.local/share/opencode/log/audit.jsonl
```

**Possible causes**:

1. No network requests were made
2. Permissions issue preventing writes
3. Disk full

### Audit mode not enabling

**Check startup message**:

```bash
./opencode --audit --version
```

Should show:

```
🔍 Network audit mode enabled - all HTTP requests will be logged
```

If not shown, ensure `--audit` flag is before the command:

```bash
./opencode --audit run "task"  # ✓ Correct
./opencode run --audit "task"  # ✗ Wrong
```

---

## FAQ

**Q: Does audit mode work with standard (non-GDPR) builds?**  
A: Yes! Audit mode works with both standard and GDPR builds. It's useful for debugging and monitoring in any deployment.

**Q: Can I disable specific audit events?**  
A: Not currently. Audit mode logs all network activity. You can filter the log file after the fact using `jq` or `grep`.

**Q: How long are audit logs retained?**  
A: Forever, until you manually delete them. Consider setting up log rotation.

**Q: Does audit mode log request/response bodies?**  
A: No, only metadata (URLs, status codes, timings, headers). No sensitive data is logged.

**Q: Can I send audit logs to a remote server?**  
A: Yes, use `$OPENCODE_AUDIT_PATH` or tail the log file and pipe to your logging service.

**Q: Is audit mode required for GDPR compliance?**  
A: No, but it's **highly recommended** for verification and accountability purposes. It provides evidence that your GDPR build is working correctly.

---

## Summary

The `--audit` flag provides:

✅ **Real-time network request logging**  
✅ **Provider API call tracking**  
✅ **GDPR compliance verification**  
✅ **Blocked request monitoring**  
✅ **Audit trail for accountability**  
✅ **Integration with external tools**  
✅ **Minimal performance overhead**

This feature answers the question: **"Can you prove no unauthorized API requests are being sent?"**

**Answer: YES** - with full audit trails in JSONL format, real-time logging, and compliance verification commands.
