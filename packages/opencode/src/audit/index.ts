import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import os from "os"
import { Log } from "../util/log"

const auditFile = path.join(Global.Path.log, "audit.jsonl")
const homeAuditDir = path.join(os.homedir(), ".opencode", "audit")
const homeAuditFile = path.join(homeAuditDir, "audit.jsonl")
const xdgAuditDir = path.join(os.homedir(), ".local", "share", "opencode", "log")
const xdgAuditFile = path.join(xdgAuditDir, "audit.jsonl")

export async function auditRecord(event: string, details: Record<string, any>) {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), event, details }) + "\n"
    await fs.mkdir(homeAuditDir, { recursive: true })
    await fs.mkdir(xdgAuditDir, { recursive: true })
    await Promise.all([
      fs.appendFile(auditFile, line),
      fs.appendFile(homeAuditFile, line),
      fs.appendFile(xdgAuditFile, line),
    ])
  } catch (e) {
    Log.create({ service: "audit" }).error("failed to write audit", { error: String(e) })
  }
}

export function auditRecordNoWait(event: string, details: Record<string, any>) {
  auditRecord(event, details).catch(() => {})
}

export default { auditRecord, auditRecordNoWait }
