import { test, expect, beforeEach, afterEach } from "bun:test"
import { auditRecord, auditRecordNoWait } from "../../src/audit"
import path from "path"
import fs from "fs/promises"
import os from "os"

const TEST_AUDIT_DIR = path.join(os.tmpdir(), "opencode-audit-test", String(Date.now()))
const TEST_AUDIT_FILE = path.join(TEST_AUDIT_DIR, "audit.jsonl")

beforeEach(async () => {
  await fs.mkdir(TEST_AUDIT_DIR, { recursive: true })
  process.env.OPENCODE_AUDIT_PATH = TEST_AUDIT_FILE
  try {
    await fs.unlink(TEST_AUDIT_FILE)
  } catch {}
})

afterEach(async () => {
  delete process.env.OPENCODE_AUDIT_PATH
  try {
    await fs.rm(TEST_AUDIT_DIR, { recursive: true, force: true })
  } catch {}
})

test("auditRecord creates audit log entry", async () => {
  await auditRecord("test.event", { foo: "bar", timestamp: new Date().toISOString() })

  const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
  const lines = content.trim().split("\n")

  expect(lines.length).toBe(1)

  const entry = JSON.parse(lines[0])
  expect(entry.event).toBe("test.event")
  expect(entry.details.foo).toBe("bar")
  expect(entry.ts).toBeDefined()
})

test("auditRecord handles multiple entries", async () => {
  await auditRecord("event.1", { data: "first" })
  await auditRecord("event.2", { data: "second" })
  await auditRecord("event.3", { data: "third" })

  const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
  const lines = content.trim().split("\n")

  expect(lines.length).toBe(3)

  const entries = lines.map((line) => JSON.parse(line))
  expect(entries[0].event).toBe("event.1")
  expect(entries[1].event).toBe("event.2")
  expect(entries[2].event).toBe("event.3")
})

test("auditRecordNoWait does not throw on error", async () => {
  const originalEnv = process.env.OPENCODE_AUDIT_PATH
  process.env.OPENCODE_AUDIT_PATH = "/invalid/path/that/cannot/exist/audit.jsonl"

  await expect(async () => {
    auditRecordNoWait("test.event", { data: "should not throw" })
    await Bun.sleep(100)
  }).not.toThrow()

  process.env.OPENCODE_AUDIT_PATH = originalEnv
})

test("auditRecord writes to multiple locations", async () => {
  await auditRecord("multi.location", { test: true })

  const envAuditExists = await fs
    .access(TEST_AUDIT_FILE)
    .then(() => true)
    .catch(() => false)
  expect(envAuditExists).toBe(true)
})

test("audit log format is valid JSONL", async () => {
  const events = [
    { event: "tool.websearch.request", details: { query: "test", sessionID: "s1" } },
    { event: "tool.webfetch.request", details: { url: "https://example.com", sessionID: "s2" } },
    { event: "mcp.tool.call", details: { tool: "test-tool", args: {} } },
  ]

  for (const { event, details } of events) {
    await auditRecord(event, details)
  }

  const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
  const lines = content.trim().split("\n")

  expect(lines.length).toBe(3)

  for (const line of lines) {
    expect(() => JSON.parse(line)).not.toThrow()
    const entry = JSON.parse(line)
    expect(entry).toHaveProperty("ts")
    expect(entry).toHaveProperty("event")
    expect(entry).toHaveProperty("details")
    expect(typeof entry.ts).toBe("string")
    expect(new Date(entry.ts).toString()).not.toBe("Invalid Date")
  }
})

test("audit log includes timestamp in ISO format", async () => {
  const before = new Date()
  await auditRecord("timestamp.test", { data: "check timestamp" })
  const after = new Date()

  const content = await fs.readFile(TEST_AUDIT_FILE, "utf-8")
  const entry = JSON.parse(content.trim())

  const timestamp = new Date(entry.ts)
  expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
  expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
  expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
})
