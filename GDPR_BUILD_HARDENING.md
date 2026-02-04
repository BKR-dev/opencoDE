# OpenCode GDPR Build-Time Hardening

## Overview

OpenCode now supports **build-time GDPR hardening**, where GDPR compliance settings are permanently baked into the compiled binary and **cannot be overridden at runtime**. This ensures tamper-proof GDPR compliance for European deployments.

## Build Modes

### 1. **Standard Build** (Default)

```bash
make build
# or
bun run build
```

**Characteristics**:

- Runtime environment variables control GDPR features
- Users can enable/disable features via `OPENCODE_ONLY_GITHUB=1`
- Flexible for development and testing
- Binary name: `opencode-{os}-{arch}`

**Use Cases**:

- Development environments
- Non-EU deployments
- Environments where runtime flexibility is needed

### 2. **GDPR-Hardened Build** (European Deployment)

```bash
make build-gdpr
# or
bun run build:gdpr
```

**Characteristics**:

- ✅ **GitHub Copilot only** (hardcoded, cannot be disabled)
- ✅ **External APIs blocked** (hardcoded, cannot be overridden)
- ✅ **Telemetry disabled** (hardcoded, no analytics)
- ✅ **Session sharing disabled** (hardcoded, opt-in required)
- Binary name: `opencode-{os}-{arch}-gdpr`

**Use Cases**:

- **European market deployment** (GDPR-compliant by design)
- Regulated industries requiring data sovereignty
- Environments where policy enforcement must be tamper-proof

### 3. **GDPR-Hardened Single-Platform Build** (Fast)

```bash
make build-gdpr-single
# or
bun run build:gdpr-single
```

Same as GDPR-hardened build, but only compiles for the current platform (faster build times).

## Build-Time vs Runtime Configuration

| Feature                   | Standard Build                             | GDPR Build                      |
| ------------------------- | ------------------------------------------ | ------------------------------- |
| **Provider Restriction**  | `OPENCODE_ONLY_GITHUB=1` (runtime)         | Hardcoded `true` (build-time)   |
| **External API Blocking** | `OPENCODE_BLOCK_EXTERNAL_APIS=1` (runtime) | Hardcoded `true` (build-time)   |
| **Telemetry**             | `OPENCODE_DISABLE_TELEMETRY=1` (runtime)   | Hardcoded `true` (build-time)   |
| **Session Sharing**       | Disabled by default (runtime override)     | Hardcoded disabled (build-time) |
| **Can be overridden**     | ✅ Yes (env vars)                          | ❌ No (compiled in)             |

## Architecture

### Build-Time Constants Injection

OpenCode uses **Bun's `define` feature** to replace placeholders at compilation:

```typescript
// At build time, these are replaced with actual boolean values
declare const OPENCODE_GDPR_ONLY_GITHUB: boolean // true in GDPR builds
declare const OPENCODE_GDPR_BLOCK_EXTERNAL_APIS: boolean // true in GDPR builds
declare const OPENCODE_GDPR_DISABLE_TELEMETRY: boolean // true in GDPR builds
declare const OPENCODE_GDPR_DISABLE_SHARE: boolean // true in GDPR builds
```

### How It Works

**Standard Build**:

```typescript
// In standard builds, this checks runtime env
function isGitHubOnlyMode(): boolean {
  if (OPENCODE_GDPR_ONLY_GITHUB) return true // false (build-time)
  return !!process.env.OPENCODE_ONLY_GITHUB // Check runtime env
}
```

**GDPR Build**:

```typescript
// In GDPR builds, this is compiled to:
function isGitHubOnlyMode(): boolean {
  if (true) return true // Hardcoded at build time!
  return !!process.env.OPENCODE_ONLY_GITHUB // Never reached
}
// The dead code is eliminated by the compiler
```

## Files Modified for Build-Time Hardening

### New Files Created

1. **`packages/opencode/script/gdpr-config.ts`** - Build configuration system
2. **`packages/opencode/src/gdpr/build-constants.ts`** - Runtime API for build-time constants

### Modified Files

3. **`packages/opencode/script/build.ts`** - Integrated GDPR config into build
4. **`packages/opencode/src/provider/provider.ts`** - Uses `isGitHubOnlyMode()`
5. **`packages/opencode/src/provider/models.ts`** - Uses build-time constants
6. **`packages/opencode/src/share/share.ts`** - Uses `isSessionSharingDisabled()`
7. **`packages/opencode/src/net/egress-policy.ts`** - Uses `isExternalAPIBlocked()`
8. **`packages/opencode/src/audit/gdpr.ts`** - Uses build-time constants
9. **`packages/opencode/src/tool/webfetch.ts`** - Uses `isGitHubOnlyMode()`
10. **`packages/opencode/src/tool/websearch.ts`** - Uses `isGitHubOnlyMode()`

## Build Process

### Standard Build Process

```
TypeScript Source → Bun Build → Binary
                        ↓
                   define: {
                     OPENCODE_GDPR_ONLY_GITHUB: "false"
                   }
```

### GDPR Build Process

```
TypeScript Source → Bun Build → Binary
                        ↓
                   define: {
                     OPENCODE_GDPR_ONLY_GITHUB: "true",
                     OPENCODE_GDPR_BLOCK_EXTERNAL_APIS: "true",
                     OPENCODE_GDPR_DISABLE_TELEMETRY: "true",
                     OPENCODE_GDPR_DISABLE_SHARE: "true"
                   }
```

## Verification

### Build Mode Verification

When you run a GDPR-hardened binary:

```bash
$ ./opencode-linux-x64-gdpr

🇪🇺 OpenCode GDPR-Hardened Build
   Build: gdpr (2026-02-04T15:30:00.000Z)
   ✓ GitHub Copilot only (hardcoded)
   ✓ External APIs blocked (hardcoded)
   ✓ Telemetry disabled (hardcoded)
   ✓ Session sharing disabled (hardcoded)
```

### Runtime Verification

```bash
# Try to enable non-GitHub providers (will be ignored in GDPR build)
OPENCODE_ONLY_GITHUB=0 ./opencode-linux-x64-gdpr
# Still shows GitHub-only mode active!
```

### Makefile Verification

```bash
make verify-gdpr    # Runs tests + code checks
make gdpr-report    # Generates compliance report
```

## Distribution

### Binary Naming Convention

**Standard Builds**:

```
opencode-linux-x64
opencode-linux-arm64
opencode-darwin-x64
opencode-darwin-arm64
opencode-windows-x64
```

**GDPR Builds** (includes `-gdpr` suffix):

```
opencode-linux-x64-gdpr
opencode-linux-arm64-gdpr
opencode-darwin-x64-gdpr
opencode-darwin-arm64-gdpr
opencode-windows-x64-gdpr
```

### Distribution Strategy

For European customers, distribute only the `-gdpr` binaries to ensure compliance cannot be bypassed.

## Testing

### GDPR Build Testing

```bash
# Build GDPR binary
make build-gdpr-single

# Run GDPR tests against the binary
make test-gdpr

# Full verification
make verify-gdpr
```

### Test Coverage

- ✅ Provider restrictions (GitHub-only enforcement)
- ✅ Config override prevention
- ✅ External API blocking (models.dev, Honeycomb)
- ✅ Session sharing disabled by default
- ✅ Audit logging for all GDPR events

## Advantages of Build-Time Hardening

### Security

- **Tamper-proof**: Users cannot bypass GDPR restrictions
- **No runtime checks**: Eliminates potential bugs in env var parsing
- **Dead code elimination**: Compiler removes unreachable code paths

### Performance

- **Zero runtime overhead**: No environment variable checks at runtime
- **Smaller binary**: Dead code is eliminated during compilation
- **Faster startup**: No need to read/parse environment variables

### Compliance

- **Audit-friendly**: Binary itself proves GDPR compliance
- **Immutable**: Once compiled, settings cannot be changed
- **Verifiable**: `OPENCODE_BUILD_MODE` constant embedded in binary

## Migration from Runtime to Build-Time

**Old Approach** (Runtime env vars):

```bash
# User could bypass this
OPENCODE_ONLY_GITHUB=1 opencode
```

**New Approach** (Build-time hardening):

```bash
# Settings baked into binary, cannot be overridden
./opencode-linux-x64-gdpr
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Build GDPR-hardened binaries for EU
  run: |
    make build-gdpr

- name: Verify GDPR compliance
  run: |
    make verify-gdpr

- name: Upload GDPR binaries
  uses: actions/upload-artifact@v3
  with:
    name: opencode-gdpr-binaries
    path: packages/opencode/dist/**/*-gdpr/
```

### Docker Build Example

```dockerfile
FROM oven/bun:latest AS builder
WORKDIR /app
COPY . .
RUN bun install
RUN bun run build:gdpr-single

FROM oven/bun:alpine
COPY --from=builder /app/packages/opencode/dist/opencode-linux-x64-gdpr/bin/opencode /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/opencode"]
```

## Troubleshooting

### Issue: GDPR binary still allows non-GitHub providers

**Cause**: You built a standard binary, not a GDPR binary
**Solution**: Ensure you use `make build-gdpr` or `bun run build:gdpr`

### Issue: Binary name doesn't include `-gdpr` suffix

**Cause**: Build script didn't detect `--gdpr` flag
**Solution**: Verify build command includes `--gdpr`: `bun run script/build.ts --gdpr`

### Issue: Want to test GDPR features in development

**Solution**: Use standard build with runtime env vars:

```bash
OPENCODE_ONLY_GITHUB=1 bun run dev
```

## Legal Compliance

### GDPR Articles Addressed

- **Art. 5**: Data minimization (only GitHub Copilot, no external APIs)
- **Art. 6**: Lawful basis (opt-in session sharing)
- **Art. 25**: Data protection by design (build-time hardening)
- **Art. 28**: Processor agreements (external APIs audited/blocked)
- **Art. 30**: Records of processing (comprehensive audit logs)
- **Art. 44-50**: International transfers (Honeycomb disabled, transfers logged)

### Recommended Deployment

For **European Union deployments**, use GDPR-hardened builds exclusively:

```bash
# Build all GDPR binaries for distribution
make build-gdpr

# Distribute only the -gdpr binaries to EU customers
```

## Summary

Build-time GDPR hardening ensures:

- ✅ **Tamper-proof compliance**: Settings cannot be overridden
- ✅ **Performance**: Zero runtime overhead
- ✅ **Audit-friendly**: Binary itself proves compliance
- ✅ **Flexible**: Standard builds for non-EU deployments
- ✅ **Secure**: Dead code elimination prevents bypasses

For European market deployment, **always use `make build-gdpr`**.
