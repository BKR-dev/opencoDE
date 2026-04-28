import { describe, expect, test } from "bun:test"
import path from "path"

const root = path.join(import.meta.dir, "../..");

async function read(relativePath: string) {
  return Bun.file(path.join(root, relativePath)).text()
}

describe("gdpr guard wiring", () => {
  test("index preserves audit startup wiring", async () => {
    const src = await read("src/index.ts")
    expect(src).toContain('option("audit"')
    expect(src).toContain("logGDPRStatus()")
    expect(src).toContain("enableNetworkAudit()")
  })

  test("plugin layer preserves GitHub-only gating", async () => {
    const src = await read("src/plugin/index.ts")
    expect(src).toContain("isGitHubOnlyMode")
    expect(src).toContain("isGitHubOnlyMode() ? []")
  })

  test("provider layer preserves GitHub-only gating", async () => {
    const src = await read("src/provider/provider.ts")
    expect(src).toContain("isGitHubOnlyMode")
    expect(src).toContain("const githubOnlyMode = isGitHubOnlyMode()")
  })

  test("build script preserves GDPR define injection", async () => {
    const src = await read("script/build.ts")
    expect(src).toContain('toBuildDefines(gdprConfig)')
    expect(src).toContain('OPENCODE_BUILD_MODE !== "standard" ? "gdpr" : undefined')
  })

  test("package scripts expose GDPR builds", async () => {
    const pkg = JSON.parse(await read("package.json")) as { scripts?: Record<string, string> }
    expect(pkg.scripts?.["build:gdpr"]).toBe("bun run script/build.ts --gdpr")
    expect(pkg.scripts?.["build:gdpr-single"]).toBe("bun run script/build.ts --gdpr --single")
  })
})
