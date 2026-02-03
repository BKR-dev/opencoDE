import { auditRecordNoWait } from "../audit"
// Minimal egress policy wrapper to block external HTTP and package loads when OPENCODE_BLOCK_EXTERNAL_APIS=1 or OPENCODE_ONLY_GITHUB=1

const ALLOWED_DOMAINS = (() => {
  const allowed = new Set<string>();
  // allow github assets and localhost during dev
  allowed.add('api.github.com');
  allowed.add('raw.githubusercontent.com');
  allowed.add('localhost');
  allowed.add('127.0.0.1');
  return allowed;
})();

export const isEgressBlocked = () => !!process.env.OPENCODE_BLOCK_EXTERNAL_APIS || !!process.env.OPENCODE_ONLY_GITHUB;

export function hostAllowed(url: string) {
  try {
    const u = new URL(url);
    return ALLOWED_DOMAINS.has(u.hostname);
  } catch (e) {
    return false;
  }
}

export async function fetchWithPolicy(input: RequestInfo, init?: RequestInit) {
  if (!isEgressBlocked()) {
    // @ts-ignore
    return fetch(input, init);
  }

  const url = typeof input === 'string' ? input : (input as Request).url;
  if (!hostAllowed(url)) {
    throw new Error(`Blocked external network request to ${url} due to OPENCODE_BLOCK_EXTERNAL_APIS`);
  }
  // @ts-ignore
  return fetch(input, init);
}

// Tool bypass for controlled tool-based external fetches (webfetch/websearch)
// This allows specific tools to make external requests even when egress is blocked.
// Tool code SHOULD use fetchWithToolBypass only after confirming permission via ctx.ask.
export async function fetchWithToolBypass(input: RequestInfo, init?: RequestInit) {
  // Audit all tool-level bypass fetches so we can capture MCP/tool-driven network activity
  try {
    // @ts-ignore
    const { auditRecordNoWait } = await import("../audit")
    const url = typeof input === "string" ? input : (input as Request).url
    auditRecordNoWait("fetch.tool.bypass", { url, time: new Date().toISOString(), egressBlocked: isEgressBlocked() })
  } catch (e) {
    // ignore
  }
  // Always forward to global fetch; tool-level permission checks are the responsibility of the tool.
  // @ts-ignore
  return fetch(input, init);
}

// Guard for package names (used by provider loader)
const ALLOWED_PACKAGES = new Set<string>(['@ai-sdk/github-copilot']);
export function packageAllowed(pkg: string) {
  if (!isEgressBlocked()) return true;
  const allowed = ALLOWED_PACKAGES.has(pkg);
  if (!allowed) {
    // record blocked package install attempts for audit
    auditRecordNoWait("package.install.blocked", { pkg, allowedPackages: Array.from(ALLOWED_PACKAGES), time: new Date().toISOString(), egressBlocked: true })
  }
  return allowed;
}
