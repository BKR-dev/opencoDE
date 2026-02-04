#!/usr/bin/env bun

/**
 * GDPR Conflict Resolution Helper
 *
 * Analyzes merge conflicts and suggests resolutions that preserve GDPR compliance.
 * Run this after a merge conflict to get guidance on how to resolve.
 */

import { $ } from "bun"

async function main() {
  console.log("🔍 GDPR Conflict Resolution Helper\n")

  // Get conflicted files
  const result = await $`git diff --name-only --diff-filter=U`.text()
  const files = result.trim().split("\n").filter(Boolean)

  if (files.length === 0) {
    console.log("✅ No conflicts to resolve")
    return
  }

  console.log(`⚠️  Found ${files.length} conflicted file(s):\n`)

  for (const file of files) {
    await analyzeFile(file)
  }

  console.log("\n" + "=".repeat(60))
  console.log("\n💡 Next Steps:")
  console.log("   1. Review files marked for manual review")
  console.log("   2. Edit files to resolve conflicts")
  console.log("   3. Run: bun test test/audit/gdpr-compliance.test.ts")
  console.log("   4. If tests pass: git add . && git commit")
}

async function analyzeFile(file: string) {
  console.log(`\n📄 ${file}`)

  // Check if GDPR-critical file
  if (isGDPRCriticalFile(file)) {
    console.log("   🔒 GDPR-CRITICAL FILE")
    console.log("   📋 Action: Use our version (preserve GDPR code)")
    console.log("   💻 Command: git checkout --ours " + file)

    // Auto-resolve
    await $`git checkout --ours ${file}`.quiet()
    await $`git add ${file}`.quiet()
    console.log("   ✅ Auto-resolved (kept our version)")
    return
  }

  // Read file content
  const content = await Bun.file(file)
    .text()
    .catch(() => "")

  // Check for GDPR functions
  const functions = extractGDPRFunctions(content)

  if (functions.length > 0) {
    console.log("   ⚠️  Contains GDPR code - MANUAL REVIEW REQUIRED")
    console.log("   📋 GDPR functions found:")
    functions.forEach((fn) => console.log(`      - ${fn}()`))
    console.log("   💡 Tip: Preserve GDPR function calls after resolving")
  } else {
    console.log("   ℹ️  No GDPR code detected")
    console.log("   📋 Action: Consider accepting upstream changes")
    console.log("   💻 Command: git checkout --theirs " + file)
  }
}

function isGDPRCriticalFile(file: string): boolean {
  const patterns = [
    "packages/opencode/src/gdpr/",
    "packages/opencode/src/audit/gdpr.ts",
    "packages/opencode/src/audit/network.ts",
    "packages/opencode/src/cli/cmd/audit.ts",
    "packages/opencode/script/gdpr-config.ts",
    "packages/opencode/test/audit/gdpr-compliance.test.ts",
  ]

  return patterns.some((pattern) => file.includes(pattern))
}

function extractGDPRFunctions(content: string): string[] {
  const functions = [
    "isGitHubOnlyMode",
    "isExternalAPIBlocked",
    "isTelemetryDisabled",
    "isSessionSharingDisabled",
    "isGDPRBuild",
    "getBuildMode",
    "getGDPRStatus",
    "logGDPRStatus",
    "logNetworkRequest",
    "logProviderRequest",
    "enableNetworkAudit",
    "isNetworkAuditEnabled",
  ]

  return functions.filter((fn) => content.includes(fn))
}

main().catch(console.error)
