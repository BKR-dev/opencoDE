/**
 * Network Audit Module
 *
 * Provides comprehensive audit logging of all network requests when --audit flag is enabled.
 * This allows verification that GDPR-hardened builds only communicate with allowed endpoints.
 *
 * Usage: opencode --audit [command]
 */

import { auditRecordNoWait } from "./index"
import { isGitHubOnlyMode, isExternalAPIBlocked } from "../gdpr/build-constants"

let auditEnabled = false

/**
 * Enable network audit logging
 * Called when --audit flag is present
 */
export function enableNetworkAudit() {
  auditEnabled = true
  console.log("🔍 Network audit mode enabled - all HTTP requests will be logged")
  console.log(`   Audit logs: ${getAuditPaths().join(", ")}`)
}

/**
 * Check if network audit is enabled
 */
export function isNetworkAuditEnabled(): boolean {
  return auditEnabled
}

/**
 * Get audit file paths
 */
function getAuditPaths(): string[] {
  const paths = ["~/.local/share/opencode/log/audit.jsonl", "~/.opencode/audit/audit.jsonl"]

  if (process.env.OPENCODE_AUDIT_PATH) {
    paths.unshift(process.env.OPENCODE_AUDIT_PATH)
  }

  return paths
}

/**
 * Log a network request
 */
export function logNetworkRequest(params: {
  url: string
  method: string
  protocol: "http" | "https" | "fetch"
  destination: "provider" | "external" | "github" | "localhost"
  allowed: boolean
  blocked?: boolean
  reason?: string
  headers?: Record<string, string>
  status?: number
  duration?: number
}) {
  if (!auditEnabled) return

  const urlObj = new URL(params.url)

  auditRecordNoWait("audit.network.request", {
    ...params,
    hostname: urlObj.hostname,
    pathname: urlObj.pathname,
    time: new Date().toISOString(),
    gdprMode: isGitHubOnlyMode(),
    egressBlocked: isExternalAPIBlocked(),
  })

  // Also log to console in audit mode
  const icon = params.allowed ? (params.blocked ? "🚫" : "✓") : "❌"
  const statusText = params.status ? ` [${params.status}]` : ""
  const durationText = params.duration ? ` (${params.duration}ms)` : ""
  console.log(`   ${icon} ${params.method} ${urlObj.hostname}${urlObj.pathname}${statusText}${durationText}`)

  if (params.blocked || !params.allowed) {
    console.log(`      ⚠️  Reason: ${params.reason || "Unknown"}`)
  }
}

/**
 * Log a provider API call (LLM request)
 */
export function logProviderRequest(params: {
  providerID: string
  modelID: string
  endpoint: string
  method: string
  allowed: boolean
  blocked?: boolean
  reason?: string
  promptTokens?: number
  completionTokens?: number
}) {
  if (!auditEnabled) return

  auditRecordNoWait("audit.provider.request", {
    ...params,
    time: new Date().toISOString(),
    gdprMode: isGitHubOnlyMode(),
  })

  const icon = params.allowed ? (params.blocked ? "🚫" : "🤖") : "❌"
  const tokens =
    params.promptTokens && params.completionTokens ? ` [${params.promptTokens}→${params.completionTokens} tokens]` : ""
  console.log(`   ${icon} Provider: ${params.providerID}/${params.modelID} → ${params.endpoint}${tokens}`)

  if (params.blocked || !params.allowed) {
    console.log(`      ⚠️  Reason: ${params.reason || "Unknown"}`)
  }
}

/**
 * Categorize a URL by destination type
 */
export function categorizeDestination(url: string): "provider" | "external" | "github" | "localhost" {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    // Localhost
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.")) {
      return "localhost"
    }

    // GitHub domains
    if (hostname.includes("github.com") || hostname.includes("githubusercontent.com")) {
      return "github"
    }

    // Known provider domains
    const providerDomains = [
      "api.anthropic.com",
      "api.openai.com",
      "generativelanguage.googleapis.com",
      "bedrock-runtime",
      "openrouter.ai",
      "api.perplexity.ai",
    ]

    if (providerDomains.some((domain) => hostname.includes(domain))) {
      return "provider"
    }

    return "external"
  } catch {
    return "external"
  }
}

/**
 * Generate an audit report summary
 */
export function logAuditSummary(summary: {
  totalRequests: number
  allowedRequests: number
  blockedRequests: number
  providerRequests: number
  externalRequests: number
  githubRequests: number
}) {
  if (!auditEnabled) return

  console.log("\n📊 Network Audit Summary:")
  console.log(`   Total requests: ${summary.totalRequests}`)
  console.log(`   ✓ Allowed: ${summary.allowedRequests}`)
  console.log(`   🚫 Blocked: ${summary.blockedRequests}`)
  console.log(`   🤖 Provider (LLM): ${summary.providerRequests}`)
  console.log(`   🐙 GitHub: ${summary.githubRequests}`)
  console.log(`   🌐 External: ${summary.externalRequests}`)

  auditRecordNoWait("audit.summary", {
    ...summary,
    time: new Date().toISOString(),
    gdprMode: isGitHubOnlyMode(),
    egressBlocked: isExternalAPIBlocked(),
  })
}
