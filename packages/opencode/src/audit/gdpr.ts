/**
 * GDPR Compliance Audit Middleware
 *
 * Semantic lifecycle events — one record per meaningful state change, not per
 * low-level operation.  Static build-time flags (gdprMode, sharingEnabled) are
 * written once in gdpr.session.start so they don't repeat on every line.
 *
 * Required under GDPR Art. 30 (Records of Processing Activities)
 */

import { auditRecordNoWait } from "./index"
import {
  isGitHubOnlyMode,
  isExternalAPIBlocked,
  isSessionSharingDisabled,
  getGDPRStatus as getBuildGDPRStatus,
} from "../gdpr/build-constants"
import { logProviderRequest, isNetworkAuditEnabled } from "./network"

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Emitted once when a session becomes active.
 * Carries all static GDPR build-time flags so they don't repeat on every line.
 */
export function logSessionStart(params: {
  sessionID: string
  model?: string
  provider?: string
}) {
  auditRecordNoWait("gdpr.session.start", {
    ...params,
    time: new Date().toISOString(),
    // Static build-time state — written here and nowhere else
    gdprMode: isGitHubOnlyMode(),
    sharingEnabled: !isSessionSharingDisabled(),
    externalAPIBlocked: isExternalAPIBlocked(),
  })
}

/**
 * Emitted once when a session ends.
 * Summarises what happened so auditors get one line per session, not hundreds.
 */
export function logSessionEnd(params: {
  sessionID: string
  messageCount: number
  partCount: number
  cloudSyncBlocked: { info: number; message: number; part: number }
  durationMs?: number
}) {
  auditRecordNoWait("gdpr.session.end", {
    ...params,
    time: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Provider / model usage
// ---------------------------------------------------------------------------

/**
 * Log AI provider usage for GDPR accountability.
 * Tracks which provider and model was used for each LLM request.
 */
export function logProviderUsage(params: {
  sessionID: string
  providerID: string
  modelID: string
  agent?: string
  promptTokens?: number
  completionTokens?: number
  purpose?: string
}) {
  auditRecordNoWait("gdpr.provider.usage", {
    ...params,
    time: new Date().toISOString(),
  })

  if (isNetworkAuditEnabled()) {
    logProviderRequest({
      providerID: params.providerID,
      modelID: params.modelID,
      endpoint: `${params.providerID} API`,
      method: "POST",
      allowed: true,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
    })
  }
}

// ---------------------------------------------------------------------------
// External API / egress
// ---------------------------------------------------------------------------

/**
 * Log external API calls to third-party services.
 * Required for GDPR Art. 28 (Processor agreements) and Art. 44-50 (International transfers).
 */
export function logExternalAPI(params: {
  sessionID?: string
  url: string
  method?: string
  service: string
  purpose: string
  dataCategories?: string[]
  blocked?: boolean
  reason?: string
}) {
  auditRecordNoWait("gdpr.external.api", {
    method: "POST",
    ...params,
    time: new Date().toISOString(),
    egressBlocked: isExternalAPIBlocked(),
  })
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

/**
 * Log user consent events.
 * Required for GDPR Art. 7 (Conditions for consent).
 */
export function logConsent(params: {
  sessionID?: string
  consentType: "session_sharing" | "telemetry" | "external_apis" | "provider_usage"
  granted: boolean
  timestamp?: string
  userID?: string
}) {
  auditRecordNoWait("gdpr.consent", {
    ...params,
    timestamp: params.timestamp ?? new Date().toISOString(),
    time: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Data transfer
// ---------------------------------------------------------------------------

/**
 * Log data transfers to third parties.
 * Required for GDPR Art. 44-50 (International transfers).
 */
export function logDataTransfer(params: {
  sessionID: string
  recipient: string
  recipientCountry?: string
  dataCategories: string[]
  legalBasis: "consent" | "contract" | "legitimate_interest" | "legal_obligation"
  transferMechanism?: "standard_contractual_clauses" | "adequacy_decision" | "binding_corporate_rules"
  blocked?: boolean
}) {
  auditRecordNoWait("gdpr.data.transfer", {
    ...params,
    time: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Provider filtering
// ---------------------------------------------------------------------------

/**
 * Log provider filtering decisions.
 * Demonstrates compliance with GitHub-only restriction.
 */
export function logProviderFilter(params: {
  providerID: string
  allowed: boolean
  reason: string
  githubOnlyMode: boolean
}) {
  auditRecordNoWait("gdpr.provider.filter", {
    ...params,
    time: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Config changes
// ---------------------------------------------------------------------------

/**
 * Log configuration changes that affect GDPR compliance.
 */
export function logConfigChange(params: {
  setting: string
  oldValue?: any
  newValue: any
  source: "config_file" | "environment" | "runtime"
  overrideBlocked?: boolean
}) {
  auditRecordNoWait("gdpr.config.change", {
    ...params,
    time: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Session sharing
// ---------------------------------------------------------------------------

/**
 * NO-OP stub kept for call-site compatibility.
 * Session sharing state is now captured once in gdpr.session.start and the
 * blocked-count summary is written in gdpr.session.end.
 * Individual blocked-sync events are no longer written — they were noise.
 */
export function logSessionShare(_params: {
  sessionID: string
  action: "create" | "sync" | "delete" | "blocked"
  url?: string
  reason?: string
}) {
  // Intentionally empty: lifecycle events replace per-call logging.
  // "create" and "delete" actions could be logged if needed in future.
}

// ---------------------------------------------------------------------------
// Model metadata
// ---------------------------------------------------------------------------

/**
 * Log model metadata fetches.
 */
export function logModelMetadataFetch(params: {
  source: "models.dev" | "provider"
  blocked?: boolean
  reason?: string
}) {
  auditRecordNoWait("gdpr.model.metadata", {
    ...params,
    time: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isGDPRMode(): boolean {
  return isGitHubOnlyMode()
}

export function getGDPRStatus() {
  return getBuildGDPRStatus()
}
