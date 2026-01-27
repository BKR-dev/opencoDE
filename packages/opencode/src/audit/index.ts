import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import { Log } from "../util/log"

const auditFile = path.join(Global.Path.log, "audit.jsonl")

export async function auditRecord(event: string, details: Record<string, any>) {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), event, details }) + "\n"
    await fs.appendFile(auditFile, line)
  } catch (e) {
    Log.create({ service: "audit" }).error("failed to write audit", { error: String(e) })
  }
}

export function auditRecordNoWait(event: string, details: Record<string, any>) {
  auditRecord(event, details).catch(() => {})
}

export default { auditRecord, auditRecordNoWait }
