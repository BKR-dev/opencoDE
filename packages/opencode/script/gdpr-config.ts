/**
 * GDPR Build Configuration
 *
 * This file defines build-time constants that are baked into the binary
 * and CANNOT be overridden at runtime. This ensures GDPR compliance
 * settings are hardened and tamper-proof.
 *
 * Usage:
 *   bun run build               # Standard build (GDPR disabled)
 *   bun run build:gdpr          # GDPR-hardened build for EU
 *   bun run build:gdpr --single # GDPR build for current platform only
 */

export interface GDPRBuildConfig {
  /**
   * Force GitHub Copilot as the only provider.
   * When true, only github-copilot and github-copilot-enterprise are allowed.
   * Config files cannot override this restriction.
   */
  OPENCODE_GDPR_ONLY_GITHUB: boolean

  /**
   * Block all external API calls except allowlisted domains.
   * When true, enforces strict egress policy.
   */
  OPENCODE_GDPR_BLOCK_EXTERNAL_APIS: boolean

  /**
   * Disable all telemetry and analytics.
   * When true, prevents data collection (Honeycomb, etc.)
   */
  OPENCODE_GDPR_DISABLE_TELEMETRY: boolean

  /**
   * Disable session sharing by default (opt-in required).
   * When true, session sharing requires explicit user consent.
   */
  OPENCODE_GDPR_DISABLE_SHARE: boolean

  /**
   * Build mode identifier for audit purposes.
   * Possible values: "standard", "gdpr", "gdpr-eu"
   */
  OPENCODE_BUILD_MODE: "standard" | "gdpr" | "gdpr-eu"

  /**
   * Build timestamp for audit trail.
   */
  OPENCODE_BUILD_TIMESTAMP: string
}

/**
 * Standard build configuration (default)
 * Runtime environment variables can control behavior
 */
export const STANDARD_CONFIG: GDPRBuildConfig = {
  OPENCODE_GDPR_ONLY_GITHUB: false,
  OPENCODE_GDPR_BLOCK_EXTERNAL_APIS: false,
  OPENCODE_GDPR_DISABLE_TELEMETRY: false,
  OPENCODE_GDPR_DISABLE_SHARE: false,
  OPENCODE_BUILD_MODE: "standard",
  OPENCODE_BUILD_TIMESTAMP: new Date().toISOString(),
}

/**
 * GDPR-hardened build configuration
 * All privacy restrictions are BAKED IN and cannot be overridden
 */
export const GDPR_CONFIG: GDPRBuildConfig = {
  OPENCODE_GDPR_ONLY_GITHUB: true,
  OPENCODE_GDPR_BLOCK_EXTERNAL_APIS: true,
  OPENCODE_GDPR_DISABLE_TELEMETRY: true,
  OPENCODE_GDPR_DISABLE_SHARE: true,
  OPENCODE_BUILD_MODE: "gdpr",
  OPENCODE_BUILD_TIMESTAMP: new Date().toISOString(),
}

/**
 * Get configuration based on build flags
 */
export function getBuildConfig(): GDPRBuildConfig {
  const gdprMode = process.argv.includes("--gdpr") || process.env.OPENCODE_BUILD_GDPR === "1"

  if (gdprMode) {
    console.log("🇪🇺 Building GDPR-hardened binary for European deployment")
    console.log("   ✓ GitHub Copilot only (hardcoded)")
    console.log("   ✓ External APIs blocked (hardcoded)")
    console.log("   ✓ Telemetry disabled (hardcoded)")
    console.log("   ✓ Session sharing disabled (hardcoded)")
    return GDPR_CONFIG
  }

  return STANDARD_CONFIG
}

/**
 * Convert config to Bun build `define` object
 */
export function toBuildDefines(config: GDPRBuildConfig): Record<string, string> {
  return {
    OPENCODE_GDPR_ONLY_GITHUB: String(config.OPENCODE_GDPR_ONLY_GITHUB),
    OPENCODE_GDPR_BLOCK_EXTERNAL_APIS: String(config.OPENCODE_GDPR_BLOCK_EXTERNAL_APIS),
    OPENCODE_GDPR_DISABLE_TELEMETRY: String(config.OPENCODE_GDPR_DISABLE_TELEMETRY),
    OPENCODE_GDPR_DISABLE_SHARE: String(config.OPENCODE_GDPR_DISABLE_SHARE),
    OPENCODE_BUILD_MODE: `'${config.OPENCODE_BUILD_MODE}'`,
    OPENCODE_BUILD_TIMESTAMP: `'${config.OPENCODE_BUILD_TIMESTAMP}'`,
  }
}
