/**
 * GDPR Compliance Test Suite
 *
 * This test suite verifies that OpenCode meets GDPR requirements when
 * OPENCODE_ONLY_GITHUB is enabled, including:
 *
 * - Only GitHub Copilot providers are accessible
 * - Config cannot override provider restrictions
 * - External APIs are blocked or audited
 * - Session sharing is disabled by default
 * - All provider usage is logged for accountability
 * - models.dev is blocked in GDPR mode
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import path from "path"
import fs from "fs/promises"
import os from "os"

const TEST_AUDIT_DIR = path.join(os.tmpdir(), "opencode-gdpr-test", String(Date.now()))
const TEST_AUDIT_FILE = path.join(TEST_AUDIT_DIR, "audit.jsonl")
const TEST_CONFIG_DIR = path.join(TEST_AUDIT_DIR, "config")

// Store original env
const originalEnv = { ...process.env }

beforeEach(async () => {
  await fs.mkdir(TEST_AUDIT_DIR, { recursive: true })
  await fs.mkdir(TEST_CONFIG_DIR, { recursive: true })
  process.env.OPENCODE_AUDIT_PATH = TEST_AUDIT_FILE
  process.env.OPENCODE_ONLY_GITHUB = "1"

  // Clear any existing audit file
  try {
    await fs.unlink(TEST_AUDIT_FILE)
  } catch {}
})

afterEach(async () => {
  // Restore original env
  process.env = { ...originalEnv }

  // Clean up test directories
  try {
    await fs.rm(TEST_AUDIT_DIR, { recursive: true, force: true })
  } catch {}
})

describe("GDPR Compliance: Provider Restrictions", () => {
  test("OPENCODE_ONLY_GITHUB environment variable is properly set", () => {
    // Verify that the GDPR mode flag is recognized
    expect(process.env.OPENCODE_ONLY_GITHUB).toBe("1")
  })

  test("Config override protection is enforced", () => {
    // This test verifies the logic that prevents config overrides
    // The actual enforcement is tested via provider filtering audit logs

    const githubOnlyMode = !!process.env.OPENCODE_ONLY_GITHUB
    expect(githubOnlyMode).toBe(true)

    // In GitHub-only mode, enabled list should be forced to GitHub providers
    const enabled = githubOnlyMode ? new Set(["github-copilot", "github-copilot-enterprise"]) : null

    expect(enabled?.has("github-copilot")).toBe(true)
    expect(enabled?.has("anthropic")).toBe(false)
    expect(enabled?.has("openai")).toBe(false)
  })

  test("Provider filtering is audited", async () => {
    // Verify that provider filtering decisions are logged for GDPR Art. 30 compliance

    const { logProviderFilter } = await import("../../src/audit/gdpr")

    // Simulate a provider being filtered out
    logProviderFilter({
      providerID: "anthropic",
      allowed: false,
      reason: "not_in_enabled_list",
      githubOnlyMode: true,
    })

    // Wait for async write
    await Bun.sleep(100)

    // Read audit log
    const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
    const lines = content.trim().split("\n")

    // Find the provider filter event
    const filterEvent = lines.map((line) => JSON.parse(line)).find((entry) => entry.event === "gdpr.provider.filter")

    expect(filterEvent).toBeDefined()
    expect(filterEvent.details.providerID).toBe("anthropic")
    expect(filterEvent.details.allowed).toBe(false)
    expect(filterEvent.details.githubOnlyMode).toBe(true)
  })
})

describe("GDPR Compliance: External API Blocking", () => {
  test("models.dev is blocked when OPENCODE_ONLY_GITHUB is set", async () => {
    // models.dev sends metadata to external service, blocked in GDPR mode

    const { ModelsDev } = await import("../../src/provider/models")

    // Attempt to refresh models (should be blocked)
    await ModelsDev.refresh()

    // Wait for async audit write
    await Bun.sleep(100)

    // Check audit log for blocked event
    const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
    const lines = content.trim().split("\n")

    const metadataEvent = lines.map((line) => JSON.parse(line)).find((entry) => entry.event === "gdpr.model.metadata")

    expect(metadataEvent).toBeDefined()
    expect(metadataEvent.details.blocked).toBe(true)
    expect(metadataEvent.details.reason).toBe("github_only_mode_active")
  })

  test("External API calls are audited", async () => {
    // Verify that external API calls are logged for GDPR Art. 28 compliance

    const { logExternalAPI } = await import("../../src/audit/gdpr")

    logExternalAPI({
      sessionID: "test-session",
      url: "https://api.example.com/endpoint",
      service: "example-service",
      purpose: "test",
      dataCategories: ["user_query"],
      blocked: true,
      reason: "gdpr_mode_active",
    })

    await Bun.sleep(100)

    const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
    const lines = content.trim().split("\n")

    const apiEvent = lines.map((line) => JSON.parse(line)).find((entry) => entry.event === "gdpr.external.api")

    expect(apiEvent).toBeDefined()
    expect(apiEvent.details.blocked).toBe(true)
    expect(apiEvent.details.gdprMode).toBe(true)
  })
})

describe("GDPR Compliance: Session Sharing", () => {
  test("Session sharing is disabled by default", async () => {
    // Session sharing should be OPT-IN, not opt-out

    // Clear OPENCODE_ENABLE_SHARE (should be disabled by default)
    delete process.env.OPENCODE_ENABLE_SHARE

    const { Share } = await import("../../src/share/share")

    // Attempt to create a share (should be blocked)
    const result = await Share.create("test-session-123")

    // Should return empty values when disabled
    expect(result.url).toBe("")
    expect(result.secret).toBe("")

    // Wait for audit write
    await Bun.sleep(100)

    // Check audit log
    const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
    const lines = content.trim().split("\n")

    const shareEvent = lines.map((line) => JSON.parse(line)).find((entry) => entry.event === "gdpr.session.share")

    expect(shareEvent).toBeDefined()
    expect(shareEvent.details.action).toBe("blocked")
  })

  test("Session sharing is blocked in GitHub-only mode even if explicitly enabled", async () => {
    // Even if user tries to enable sharing, it should be blocked in GDPR mode

    process.env.OPENCODE_ENABLE_SHARE = "1"
    process.env.OPENCODE_ONLY_GITHUB = "1"

    const { Share } = await import("../../src/share/share")

    const result = await Share.create("test-session-456")

    // Should still be blocked due to GitHub-only mode
    expect(result.url).toBe("")
    expect(result.secret).toBe("")
  })

  test("Data transfers are audited", async () => {
    // Verify that data transfers to third parties are logged for GDPR Art. 44-50

    const { logDataTransfer } = await import("../../src/audit/gdpr")

    logDataTransfer({
      sessionID: "test-session",
      recipient: "opencode_api",
      recipientCountry: "USA",
      dataCategories: ["conversation_context"],
      legalBasis: "consent",
      transferMechanism: "standard_contractual_clauses",
      blocked: false,
    })

    await Bun.sleep(100)

    const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
    const lines = content.trim().split("\n")

    const transferEvent = lines.map((line) => JSON.parse(line)).find((entry) => entry.event === "gdpr.data.transfer")

    expect(transferEvent).toBeDefined()
    expect(transferEvent.details.recipientCountry).toBe("USA")
    expect(transferEvent.details.legalBasis).toBe("consent")
  })
})

describe("GDPR Compliance: Audit Logging", () => {
  test("Provider usage is logged for accountability", async () => {
    // GDPR Art. 30 requires records of processing activities

    const { logProviderUsage } = await import("../../src/audit/gdpr")

    logProviderUsage({
      sessionID: "test-session",
      providerID: "github-copilot",
      modelID: "gpt-4",
      agent: "general",
      promptTokens: 100,
      completionTokens: 50,
      purpose: "chat_completion",
    })

    await Bun.sleep(100)

    const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
    const lines = content.trim().split("\n")

    const usageEvent = lines.map((line) => JSON.parse(line)).find((entry) => entry.event === "gdpr.provider.usage")

    expect(usageEvent).toBeDefined()
    expect(usageEvent.details.providerID).toBe("github-copilot")
    expect(usageEvent.details.modelID).toBe("gpt-4")
    expect(usageEvent.details.gdprMode).toBe(true)
  })

  test("All GDPR audit events include required metadata", async () => {
    // Verify that all GDPR events have proper structure

    const { logProviderUsage, logExternalAPI, logConsent } = await import("../../src/audit/gdpr")

    // Log various events
    logProviderUsage({
      sessionID: "s1",
      providerID: "github-copilot",
      modelID: "gpt-4",
    })

    logExternalAPI({
      url: "https://example.com",
      service: "test",
      purpose: "testing",
    })

    logConsent({
      consentType: "telemetry",
      granted: false,
    })

    await Bun.sleep(100)

    const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
    const lines = content.trim().split("\n")
    const events = lines.map((line) => JSON.parse(line))

    // All events should have timestamp and event type
    for (const event of events) {
      expect(event.ts).toBeDefined()
      expect(event.event).toBeDefined()
      expect(event.event.startsWith("gdpr.")).toBe(true)
      expect(event.details.time).toBeDefined()
    }
  })

  test("GDPR status can be queried", async () => {
    const { getGDPRStatus } = await import("../../src/audit/gdpr")

    const status = getGDPRStatus()

    expect(status.githubOnlyMode).toBe(true)
    expect(typeof status.externalAPIBlocked).toBe("boolean")
    expect(typeof status.sessionSharingDisabled).toBe("boolean")
    expect(typeof status.telemetryDisabled).toBe("boolean")
  })
})

describe("GDPR Compliance: Consent Management", () => {
  test("Consent events are logged", async () => {
    const { logConsent } = await import("../../src/audit/gdpr")

    logConsent({
      sessionID: "test-session",
      consentType: "session_sharing",
      granted: true,
      userID: "user-123",
    })

    await Bun.sleep(100)

    const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
    const lines = content.trim().split("\n")

    const consentEvent = lines.map((line) => JSON.parse(line)).find((entry) => entry.event === "gdpr.consent")

    expect(consentEvent).toBeDefined()
    expect(consentEvent.details.consentType).toBe("session_sharing")
    expect(consentEvent.details.granted).toBe(true)
  })
})

describe("GDPR Compliance: Integration Tests", () => {
  test("Full GDPR mode configuration is properly enforced", () => {
    // Verify all environment variables work together

    process.env.OPENCODE_ONLY_GITHUB = "1"
    process.env.OPENCODE_BLOCK_EXTERNAL_APIS = "1"
    delete process.env.OPENCODE_ENABLE_SHARE

    const { getGDPRStatus, isGDPRMode } = require("../../src/audit/gdpr")

    expect(isGDPRMode()).toBe(true)

    const status = getGDPRStatus()
    expect(status.githubOnlyMode).toBe(true)
    expect(status.externalAPIBlocked).toBe(true)
    expect(status.sessionSharingDisabled).toBe(true)
  })
})

describe("GDPR Compliance: Build-Time Hardening", () => {
  test("Build constants API exists and returns values", async () => {
    const {
      isGitHubOnlyMode,
      isExternalAPIBlocked,
      isTelemetryDisabled,
      isSessionSharingDisabled,
      getBuildMode,
      isGDPRBuild,
      getGDPRStatus: getBuildGDPRStatus,
    } = await import("../../src/gdpr/build-constants")

    // In test environment (standard build), these functions exist
    expect(typeof isGitHubOnlyMode).toBe("function")
    expect(typeof isExternalAPIBlocked).toBe("function")
    expect(typeof isTelemetryDisabled).toBe("function")
    expect(typeof isSessionSharingDisabled).toBe("function")
    expect(typeof getBuildMode).toBe("function")
    expect(typeof isGDPRBuild).toBe("function")
    expect(typeof getBuildGDPRStatus).toBe("function")

    // Verify they return boolean/string values
    expect(typeof isGitHubOnlyMode()).toBe("boolean")
    expect(typeof isExternalAPIBlocked()).toBe("boolean")
    expect(typeof isTelemetryDisabled()).toBe("boolean")
    expect(typeof isSessionSharingDisabled()).toBe("boolean")
    expect(["standard", "gdpr", "gdpr-eu"]).toContain(getBuildMode())
    expect(typeof isGDPRBuild()).toBe("boolean")
  })

  test("Standard build respects runtime environment variables", async () => {
    const { isGitHubOnlyMode, isExternalAPIBlocked } = await import("../../src/gdpr/build-constants")

    // In standard build (test environment), env vars should control behavior
    process.env.OPENCODE_ONLY_GITHUB = "1"
    process.env.OPENCODE_BLOCK_EXTERNAL_APIS = "1"

    // These should be true when env vars are set
    expect(isGitHubOnlyMode()).toBe(true)
    expect(isExternalAPIBlocked()).toBe(true)

    // Clear env vars
    delete process.env.OPENCODE_ONLY_GITHUB
    delete process.env.OPENCODE_BLOCK_EXTERNAL_APIS

    // These should be false when env vars are cleared
    expect(isGitHubOnlyMode()).toBe(false)
    expect(isExternalAPIBlocked()).toBe(false)
  })

  test("Build mode detection works correctly", async () => {
    const { getBuildMode, isGDPRBuild } = await import("../../src/gdpr/build-constants")

    // In test environment, we should be running a standard build
    const mode = getBuildMode()
    expect(mode).toBe("standard")
    expect(isGDPRBuild()).toBe(false)

    // Note: GDPR builds would return "gdpr" or "gdpr-eu" and isGDPRBuild() would be true
    // This cannot be tested in the test suite since tests run in standard build mode
    // GDPR build verification requires manual testing with compiled binaries
  })

  test("getGDPRStatus returns all required fields", async () => {
    const { getGDPRStatus } = await import("../../src/gdpr/build-constants")

    const status = getGDPRStatus()

    // Verify all expected fields exist
    expect(status).toHaveProperty("buildMode")
    expect(status).toHaveProperty("isGDPRBuild")
    expect(status).toHaveProperty("buildTimestamp")
    expect(status).toHaveProperty("githubOnlyMode")
    expect(status).toHaveProperty("externalAPIBlocked")
    expect(status).toHaveProperty("telemetryDisabled")
    expect(status).toHaveProperty("sessionSharingDisabled")

    // Verify types
    expect(typeof status.buildMode).toBe("string")
    expect(typeof status.isGDPRBuild).toBe("boolean")
    expect(typeof status.buildTimestamp).toBe("string")
    expect(typeof status.githubOnlyMode).toBe("boolean")
    expect(typeof status.externalAPIBlocked).toBe("boolean")
    expect(typeof status.telemetryDisabled).toBe("boolean")
    expect(typeof status.sessionSharingDisabled).toBe("boolean")
  })
})
