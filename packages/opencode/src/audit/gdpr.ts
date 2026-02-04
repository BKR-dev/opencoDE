/**
 * GDPR Compliance Audit Middleware
 *
 * This module provides comprehensive audit logging for GDPR compliance,
 * tracking all provider usage, external API calls, and data transfers.
 *
 * Required under GDPR Art. 30 (Records of Processing Activities)
 */

import { auditRecordNoWait } from "./index"
import {
  isGitHubOnlyMode,
  isExternalAPIBlocked,
  isSessionSharingDisabled,
  isTelemetryDisabled,
  getGDPRStatus as getBuildGDPRStatus,
} from "../gdpr/build-constants"
import { logProviderRequest, isNetworkAuditEnabled } from "./network"

/**
 * Log AI provider usage for GDPR accountability
 * Tracks which provider and model was used for each request
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
    gdprMode: isGitHubOnlyMode(),
  })

  // Log to network audit if enabled
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

/**
 * Log external API calls to third-party services
 * Required for GDPR Art. 28 (Processor agreements) and Art. 44-50 (International transfers)
 */
export function logExternalAPI(params: {
  sessionID?: string
  url: string
  method?: string
  service: string
  purpose: string
  dataCategories?: string[] // e.g., ["conversation_context", "user_query"]
  blocked?: boolean
  reason?: string
}) {
  auditRecordNoWait("gdpr.external.api", {
    method: "POST",
    ...params,
    time: new Date().toISOString(),
    gdprMode: isGitHubOnlyMode(),
    egressBlocked: isExternalAPIBlocked(),
  })
}

/**
 * Log user consent events
 * Required for GDPR Art. 7 (Conditions for consent)
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

/**
 * Log data transfers to third parties
 * Required for GDPR Art. 44-50 (International transfers)
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
    gdprMode: isGitHubOnlyMode(),
  })
}

/**
 * Log provider filtering decisions
 * Demonstrates compliance with GitHub-only restriction
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

/**
 * Log configuration changes that affect GDPR compliance
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
    gdprMode: isGitHubOnlyMode(),
  })
}

/**
 * Log session sharing events
 */
export function logSessionShare(params: {
  sessionID: string
  action: "create" | "sync" | "delete" | "blocked"
  url?: string
  reason?: string
}) {
  auditRecordNoWait("gdpr.session.share", {
    ...params,
    time: new Date().toISOString(),
    gdprMode: isGitHubOnlyMode(),
    sharingEnabled: !isSessionSharingDisabled(),
  })
}

/**
 * Log model metadata fetches
 */
export function logModelMetadataFetch(params: {
  source: "models.dev" | "provider"
  blocked?: boolean
  reason?: string
}) {
  auditRecordNoWait("gdpr.model.metadata", {
    ...params,
    time: new Date().toISOString(),
    gdprMode: isGitHubOnlyMode(),
  })
}

/**
 * Helper: Check if GDPR mode is active
 */
export function isGDPRMode(): boolean {
  return isGitHubOnlyMode()
}

/**
 * Helper: Get GDPR compliance status
 */
export function getGDPRStatus() {
  return getBuildGDPRStatus()
}
