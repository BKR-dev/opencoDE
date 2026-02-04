import { auditRecordNoWait } from "../audit"
import { isGitHubOnlyMode, isExternalAPIBlocked } from "../gdpr/build-constants"
import { logNetworkRequest, categorizeDestination, isNetworkAuditEnabled } from "../audit/network"

// Minimal egress policy wrapper to block external HTTP and package loads when OPENCODE_BLOCK_EXTERNAL_APIS=1 or OPENCODE_ONLY_GITHUB=1

const ALLOWED_DOMAINS = (() => {
  const allowed = new Set<string>()
  // allow github assets and localhost during dev
  allowed.add("api.github.com")
  allowed.add("raw.githubusercontent.com")
  allowed.add("localhost")
  allowed.add("127.0.0.1")
  return allowed
})()

export const isEgressBlocked = () => isExternalAPIBlocked() || isGitHubOnlyMode()

export function hostAllowed(url: string) {
  try {
    const u = new URL(url)
    return ALLOWED_DOMAINS.has(u.hostname)
  } catch (e) {
    return false
  }
}

export async function fetchWithPolicy(input: RequestInfo, init?: RequestInit) {
  const url = typeof input === "string" ? input : (input as Request).url
  const method = init?.method || "GET"
  const startTime = Date.now()

  // Log network request in audit mode
  if (isNetworkAuditEnabled()) {
    const destination = categorizeDestination(url)
    const allowed = !isEgressBlocked() || hostAllowed(url)
    const blocked = isEgressBlocked() && !hostAllowed(url)

    logNetworkRequest({
      url,
      method,
      protocol: "fetch",
      destination,
      allowed,
      blocked,
      reason: blocked ? "External APIs blocked in GDPR mode" : undefined,
    })
  }

  if (!isEgressBlocked()) {
    // @ts-ignore
    const response = await fetch(input, init)

    // Log response status in audit mode
    if (isNetworkAuditEnabled()) {
      const duration = Date.now() - startTime
      const destination = categorizeDestination(url)
      logNetworkRequest({
        url,
        method,
        protocol: "fetch",
        destination,
        allowed: true,
        status: response.status,
        duration,
      })
    }

    return response
  }

  if (!hostAllowed(url)) {
    throw new Error(`Blocked external network request to ${url} due to OPENCODE_BLOCK_EXTERNAL_APIS`)
  }

  // @ts-ignore
  const response = await fetch(input, init)

  // Log allowed request in audit mode
  if (isNetworkAuditEnabled()) {
    const duration = Date.now() - startTime
    const destination = categorizeDestination(url)
    logNetworkRequest({
      url,
      method,
      protocol: "fetch",
      destination,
      allowed: true,
      status: response.status,
      duration,
      reason: "Allowed domain (GitHub, localhost)",
    })
  }

  return response
}

// Tool bypass for controlled tool-based external fetches (webfetch/websearch)
// This allows specific tools to make external requests even when egress is blocked.
// Tool code SHOULD use fetchWithToolBypass only after confirming permission via ctx.ask.
export async function fetchWithToolBypass(input: RequestInfo, init?: RequestInit) {
  const url = typeof input === "string" ? input : (input as Request).url
  const method = init?.method || "GET"
  const startTime = Date.now()

  // Audit all tool-level bypass fetches so we can capture MCP/tool-driven network activity
  try {
    // @ts-ignore
    const { auditRecordNoWait } = await import("../audit")
    auditRecordNoWait("fetch.tool.bypass", {
      url,
      method,
      time: new Date().toISOString(),
      egressBlocked: isEgressBlocked(),
    })

    // Log in audit mode
    if (isNetworkAuditEnabled()) {
      const destination = categorizeDestination(url)
      logNetworkRequest({
        url,
        method,
        protocol: "fetch",
        destination,
        allowed: true,
        reason: "Tool bypass (user permission granted)",
      })
    }
  } catch (e) {
    // ignore
  }

  // Always forward to global fetch; tool-level permission checks are the responsibility of the tool.
  // @ts-ignore
  const response = await fetch(input, init)

  // Log response in audit mode
  if (isNetworkAuditEnabled()) {
    const duration = Date.now() - startTime
    const destination = categorizeDestination(url)
    logNetworkRequest({
      url,
      method,
      protocol: "fetch",
      destination,
      allowed: true,
      status: response.status,
      duration,
    })
  }

  return response
}

// Guard for package names (used by provider loader)
const ALLOWED_PACKAGES = new Set<string>(["@ai-sdk/github-copilot"])
export function packageAllowed(pkg: string) {
  if (!isEgressBlocked()) return true
  const allowed = ALLOWED_PACKAGES.has(pkg)
  if (!allowed) {
    // record blocked package install attempts for audit
    auditRecordNoWait("package.install.blocked", {
      pkg,
      allowedPackages: Array.from(ALLOWED_PACKAGES),
      time: new Date().toISOString(),
      egressBlocked: true,
    })
  }
  return allowed
}
