/**
 * GDPR Build-Time Constants
 *
 * These constants are injected at BUILD TIME and cannot be changed at runtime.
 * This ensures GDPR compliance settings are tamper-proof.
 *
 * For GDPR-hardened builds (built with --gdpr flag):
 * - OPENCODE_GDPR_ONLY_GITHUB = true (hardcoded)
 * - OPENCODE_GDPR_BLOCK_EXTERNAL_APIS = true (hardcoded)
 * - OPENCODE_GDPR_DISABLE_TELEMETRY = true (hardcoded)
 * - OPENCODE_GDPR_DISABLE_SHARE = true (hardcoded)
 *
 * For standard builds:
 * - All constants = false (runtime env vars can enable features)
 */

// These are replaced at build time by Bun's `define` feature
declare const OPENCODE_GDPR_ONLY_GITHUB: boolean
declare const OPENCODE_GDPR_BLOCK_EXTERNAL_APIS: boolean
declare const OPENCODE_GDPR_DISABLE_TELEMETRY: boolean
declare const OPENCODE_GDPR_DISABLE_SHARE: boolean
declare const OPENCODE_BUILD_MODE: "standard" | "gdpr" | "gdpr-eu"
declare const OPENCODE_BUILD_TIMESTAMP: string

/**
 * Check if this is a GDPR-hardened build
 * In GDPR builds, all restrictions are permanently enabled
 */
export function isGDPRBuild(): boolean {
  // This will be replaced with `true` or `false` at build time
  // In dev/test environments, the constant is undefined, so we default to false
  return typeof OPENCODE_GDPR_ONLY_GITHUB !== "undefined" ? OPENCODE_GDPR_ONLY_GITHUB : false
}

/**
 * Get the build mode for audit logs
 */
export function getBuildMode(): "standard" | "gdpr" | "gdpr-eu" {
  return typeof OPENCODE_BUILD_MODE !== "undefined" ? OPENCODE_BUILD_MODE : "standard"
}

/**
 * Get build timestamp for audit trail
 */
export function getBuildTimestamp(): string {
  return typeof OPENCODE_BUILD_TIMESTAMP !== "undefined" ? OPENCODE_BUILD_TIMESTAMP : new Date().toISOString()
}

/**
 * GDPR Feature Flags (Build-Time + Runtime Hybrid)
 *
 * Strategy:
 * - GDPR builds: Flags are hardcoded to true (cannot be disabled)
 * - Standard builds: Flags respect runtime environment variables
 *
 * This allows flexibility in development while ensuring production GDPR builds
 * are tamper-proof.
 */

/**
 * Check if GitHub-only mode is active
 *
 * GDPR build: Always returns true (hardcoded)
 * Standard build: Returns true if OPENCODE_ONLY_GITHUB env var is set
 */
export function isGitHubOnlyMode(): boolean {
  // In GDPR builds, this is replaced with `return true` at build time
  if (typeof OPENCODE_GDPR_ONLY_GITHUB !== "undefined" && OPENCODE_GDPR_ONLY_GITHUB) return true

  // In standard builds, check runtime env var
  return !!process.env.OPENCODE_ONLY_GITHUB
}

/**
 * Check if external APIs should be blocked
 *
 * GDPR build: Always returns true (hardcoded)
 * Standard build: Returns true if OPENCODE_BLOCK_EXTERNAL_APIS env var is set
 */
export function isExternalAPIBlocked(): boolean {
  if (typeof OPENCODE_GDPR_BLOCK_EXTERNAL_APIS !== "undefined" && OPENCODE_GDPR_BLOCK_EXTERNAL_APIS) return true
  return !!process.env.OPENCODE_BLOCK_EXTERNAL_APIS
}

/**
 * Check if telemetry is disabled
 *
 * GDPR build: Always returns true (hardcoded)
 * Standard build: Returns true if OPENCODE_DISABLE_TELEMETRY env var is set
 */
export function isTelemetryDisabled(): boolean {
  if (typeof OPENCODE_GDPR_DISABLE_TELEMETRY !== "undefined" && OPENCODE_GDPR_DISABLE_TELEMETRY) return true
  return !!process.env.OPENCODE_DISABLE_TELEMETRY
}

/**
 * Check if session sharing is disabled
 *
 * GDPR build: Always returns true (hardcoded)
 * Standard build: Disabled by default, enabled only if OPENCODE_ENABLE_SHARE=1
 */
export function isSessionSharingDisabled(): boolean {
  if (typeof OPENCODE_GDPR_DISABLE_SHARE !== "undefined" && OPENCODE_GDPR_DISABLE_SHARE) return true

  // In standard builds, session sharing is opt-in (disabled by default)
  const explicitlyEnabled = process.env.OPENCODE_ENABLE_SHARE === "1"
  return !explicitlyEnabled
}

/**
 * Get comprehensive GDPR status for audit logs
 */
export function getGDPRStatus() {
  return {
    buildMode: getBuildMode(),
    buildTimestamp: getBuildTimestamp(),
    isGDPRBuild: isGDPRBuild(),
    githubOnlyMode: isGitHubOnlyMode(),
    externalAPIBlocked: isExternalAPIBlocked(),
    telemetryDisabled: isTelemetryDisabled(),
    sessionSharingDisabled: isSessionSharingDisabled(),
  }
}

/**
 * Log GDPR status at startup
 */
export function logGDPRStatus() {
  const status = getGDPRStatus()

  if (status.isGDPRBuild) {
    console.log("🇪🇺 OpenCode GDPR-Hardened Build")
    console.log(`   Build: ${status.buildMode} (${status.buildTimestamp})`)
    console.log("   ✓ GitHub Copilot only (hardcoded)")
    console.log("   ✓ External APIs blocked (hardcoded)")
    console.log("   ✓ Telemetry disabled (hardcoded)")
    console.log("   ✓ Session sharing disabled (hardcoded)")
  } else {
    console.log("OpenCode Standard Build")
    console.log(`   Build: ${status.buildMode} (${status.buildTimestamp})`)
    if (status.githubOnlyMode) console.log("   ⚙ GitHub-only mode enabled (env)")
    if (status.externalAPIBlocked) console.log("   ⚙ External APIs blocked (env)")
    if (status.telemetryDisabled) console.log("   ⚙ Telemetry disabled (env)")
    if (status.sessionSharingDisabled) console.log("   ⚙ Session sharing disabled")
  }
}
