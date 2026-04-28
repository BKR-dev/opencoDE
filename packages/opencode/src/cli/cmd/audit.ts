import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import path from "path"
import os from "os"
import fs from "fs/promises"

export const AuditCommand = cmd({
  command: "audit",
  describe: "view and analyze GDPR compliance audit logs",
  builder: (yargs) =>
    yargs.command(AuditViewCommand).command(AuditSummaryCommand).command(AuditVerifyCommand).demandCommand(),
  async handler() {},
})

export const AuditViewCommand = cmd({
  command: "view [lines]",
  aliases: ["tail"],
  describe: "view recent audit log entries",
  builder: (yargs) =>
    yargs.positional("lines", {
      describe: "number of lines to show",
      type: "number",
      default: 50,
    }),
  async handler(args) {
    UI.empty()
    prompts.intro("Audit Log")

    const auditPaths = [
      path.join(os.homedir(), ".local", "share", "opencode", "log", "audit.jsonl"),
      path.join(os.homedir(), ".opencode", "audit", "audit.jsonl"),
    ]

    if (process.env.OPENCODE_AUDIT_PATH) {
      auditPaths.unshift(process.env.OPENCODE_AUDIT_PATH)
    }

    let auditFile: string | null = null
    for (const p of auditPaths) {
      try {
        await fs.access(p)
        auditFile = p
        break
      } catch {}
    }

    if (!auditFile) {
      prompts.log.error("No audit log found. Run with --audit flag to enable audit logging.")
      prompts.outro("Done")
      return
    }

    const content = await fs.readFile(auditFile, "utf-8")
    const lines = content.trim().split("\n")
    const recentLines = lines.slice(-args.lines)

    prompts.log.info(`Showing last ${recentLines.length} entries from ${auditFile}`)
    prompts.log.info("")

    for (const line of recentLines) {
      try {
        const entry = JSON.parse(line)
        const timestamp = new Date(entry.ts).toLocaleString()
        const eventType = entry.event.replace("gdpr.", "").replace("audit.", "")

        console.log(`[${timestamp}] ${eventType}`)

        // Show relevant details based on event type
        if (entry.event.includes("network.request")) {
          const icon = entry.details.blocked ? "🚫" : entry.details.allowed ? "✓" : "❌"
          console.log(`  ${icon} ${entry.details.method} ${entry.details.hostname}${entry.details.pathname}`)
          if (entry.details.status) console.log(`     Status: ${entry.details.status}`)
          if (entry.details.duration) console.log(`     Duration: ${entry.details.duration}ms`)
        } else if (entry.event.includes("provider")) {
          console.log(`  Provider: ${entry.details.providerID || "unknown"}`)
          if (entry.details.modelID) console.log(`  Model: ${entry.details.modelID}`)
          if (entry.details.promptTokens)
            console.log(`  Tokens: ${entry.details.promptTokens} → ${entry.details.completionTokens}`)
        } else if (entry.event.includes("external.api")) {
          console.log(`  URL: ${entry.details.url}`)
          console.log(`  Service: ${entry.details.service}`)
          console.log(`  Purpose: ${entry.details.purpose}`)
          if (entry.details.blocked) console.log(`  ⚠️ BLOCKED`)
        }

        console.log("")
      } catch (e) {
        console.log(line)
      }
    }

    prompts.outro(`Total entries: ${lines.length}`)
  },
})

export const AuditSummaryCommand = cmd({
  command: "summary",
  aliases: ["stats"],
  describe: "show audit log statistics",
  async handler() {
    UI.empty()
    prompts.intro("Audit Summary")

    const auditPaths = [
      path.join(os.homedir(), ".local", "share", "opencode", "log", "audit.jsonl"),
      path.join(os.homedir(), ".opencode", "audit", "audit.jsonl"),
    ]

    if (process.env.OPENCODE_AUDIT_PATH) {
      auditPaths.unshift(process.env.OPENCODE_AUDIT_PATH)
    }

    let auditFile: string | null = null
    for (const p of auditPaths) {
      try {
        await fs.access(p)
        auditFile = p
        break
      } catch {}
    }

    if (!auditFile) {
      prompts.log.error("No audit log found. Run with --audit flag to enable audit logging.")
      prompts.outro("Done")
      return
    }

    const content = await fs.readFile(auditFile, "utf-8")
    const lines = content.trim().split("\n")

    const stats = {
      total: lines.length,
      networkRequests: 0,
      providerRequests: 0,
      externalAPICalls: 0,
      blockedRequests: 0,
      consentEvents: 0,
      dataTransfers: 0,
      configChanges: 0,
      githubRequests: 0,
      byProvider: {} as Record<string, number>,
    }

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)

        if (entry.event.includes("network.request")) {
          stats.networkRequests++
          if (entry.details.blocked) stats.blockedRequests++
          if (entry.details.destination === "github") stats.githubRequests++
        }

        if (entry.event.includes("provider")) {
          stats.providerRequests++
          const provider = entry.details.providerID || "unknown"
          stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1
        }

        if (entry.event.includes("external.api")) {
          stats.externalAPICalls++
          if (entry.details.blocked) stats.blockedRequests++
        }

        if (entry.event.includes("consent")) {
          stats.consentEvents++
        }

        if (entry.event.includes("data.transfer")) {
          stats.dataTransfers++
        }

        if (entry.event.includes("config.change")) {
          stats.configChanges++
        }
      } catch {}
    }

    prompts.log.info(`Audit log: ${auditFile}`)
    prompts.log.info("")
    prompts.log.info(`Total audit entries: ${stats.total}`)
    prompts.log.info(`Network requests: ${stats.networkRequests}`)
    prompts.log.info(`  ✓ Allowed: ${stats.networkRequests - stats.blockedRequests}`)
    prompts.log.info(`  🚫 Blocked: ${stats.blockedRequests}`)
    prompts.log.info(`  🐙 GitHub: ${stats.githubRequests}`)
    prompts.log.info(`Provider requests: ${stats.providerRequests}`)

    if (Object.keys(stats.byProvider).length > 0) {
      prompts.log.info(`  By provider:`)
      for (const [provider, count] of Object.entries(stats.byProvider)) {
        prompts.log.info(`    ${provider}: ${count}`)
      }
    }

    prompts.log.info(`External API calls: ${stats.externalAPICalls}`)
    prompts.log.info(`Consent events: ${stats.consentEvents}`)
    prompts.log.info(`Data transfers: ${stats.dataTransfers}`)
    prompts.log.info(`Config changes: ${stats.configChanges}`)

    prompts.outro("Done")
  },
})

export const AuditVerifyCommand = cmd({
  command: "verify",
  describe: "verify GDPR compliance from audit logs",
  async handler() {
    UI.empty()
    prompts.intro("GDPR Compliance Verification")

    const auditPaths = [
      path.join(os.homedir(), ".local", "share", "opencode", "log", "audit.jsonl"),
      path.join(os.homedir(), ".opencode", "audit", "audit.jsonl"),
    ]

    if (process.env.OPENCODE_AUDIT_PATH) {
      auditPaths.unshift(process.env.OPENCODE_AUDIT_PATH)
    }

    let auditFile: string | null = null
    for (const p of auditPaths) {
      try {
        await fs.access(p)
        auditFile = p
        break
      } catch {}
    }

    if (!auditFile) {
      prompts.log.error("No audit log found. Run with --audit flag to enable audit logging.")
      prompts.outro("Done")
      return
    }

    const content = await fs.readFile(auditFile, "utf-8")
    const lines = content.trim().split("\n")

    const violations: string[] = []
    const warnings: string[] = []
    const allowedProviders = new Set(["github-copilot", "github-copilot-enterprise"])

    let gdprMode = false
    let nonGitHubProviders = new Set<string>()
    let externalAPIs = new Set<string>()
    let blockedRequests = 0

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)

        // Check if GDPR mode was active
        if (entry.details.gdprMode === true) {
          gdprMode = true
        }

        // Check for non-GitHub provider usage in GDPR mode
        if (entry.event.includes("provider.usage") && entry.details.gdprMode) {
          const provider = entry.details.providerID
          if (!allowedProviders.has(provider)) {
            nonGitHubProviders.add(provider)
          }
        }

        // Check for external API calls
        if (entry.event.includes("external.api") && !entry.details.blocked) {
          const service = entry.details.service || entry.details.url
          externalAPIs.add(service)
        }

        // Count blocked requests
        if (entry.details.blocked) {
          blockedRequests++
        }
      } catch {}
    }

    // Generate compliance report
    prompts.log.info(`Analyzed ${lines.length} audit entries`)
    prompts.log.info("")

    if (gdprMode) {
      prompts.log.success("✓ GDPR mode was active")

      if (nonGitHubProviders.size === 0) {
        prompts.log.success("✓ Only GitHub Copilot providers were used")
      } else {
        violations.push(`Non-GitHub providers detected: ${Array.from(nonGitHubProviders).join(", ")}`)
      }

      if (externalAPIs.size === 0) {
        prompts.log.success("✓ No external API calls detected")
      } else {
        warnings.push(`External APIs called: ${Array.from(externalAPIs).join(", ")}`)
      }

      if (blockedRequests > 0) {
        prompts.log.info(`ℹ️  ${blockedRequests} requests were blocked`)
      }
    } else {
      prompts.log.warn("⚠️  GDPR mode was not active during this session")
    }

    prompts.log.info("")

    if (violations.length > 0) {
      prompts.log.error("❌ GDPR Violations:")
      for (const violation of violations) {
        prompts.log.error(`   ${violation}`)
      }
    }

    if (warnings.length > 0) {
      prompts.log.warn("⚠️  Warnings:")
      for (const warning of warnings) {
        prompts.log.warn(`   ${warning}`)
      }
    }

    if (violations.length === 0 && warnings.length === 0 && gdprMode) {
      prompts.log.success("✅ No GDPR compliance issues detected")
    }

    prompts.outro("Done")
  },
})
