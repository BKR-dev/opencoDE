import { Bus } from "../bus"
import { Installation } from "../installation"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Log } from "../util/log"
import { logSessionShare, logDataTransfer } from "../audit/gdpr"
import { isGitHubOnlyMode, isSessionSharingDisabled } from "../gdpr/build-constants"

export namespace Share {
  const log = Log.create({ service: "share" })

  let queue: Promise<void> = Promise.resolve()
  const pending = new Map<string, any>()

  export async function sync(key: string, content: any) {
    if (disabled) {
      // GDPR Audit: Log blocked sharing attempt
      const [root, ...splits] = key.split("/")
      if (root === "session") {
        const [sub, sessionID] = splits
        if (sub !== "share") {
          logSessionShare({
            sessionID: sessionID ?? "unknown",
            action: "blocked",
            reason: "session_sharing_disabled",
          })
        }
      }
      return
    }
    const [root, ...splits] = key.split("/")
    if (root !== "session") return
    const [sub, sessionID] = splits
    if (sub === "share") return
    const share = await Session.getShare(sessionID).catch(() => {})
    if (!share) return
    const { secret } = share

    // GDPR Audit: Log data transfer to external API
    logDataTransfer({
      sessionID,
      recipient: "opencode_api",
      recipientCountry: "USA",
      dataCategories: ["conversation_context", "session_metadata"],
      legalBasis: "consent",
      transferMechanism: "standard_contractual_clauses",
    })

    pending.set(key, content)
    queue = queue
      .then(async () => {
        const content = pending.get(key)
        if (content === undefined) return
        pending.delete(key)

        return fetch(`${URL}/share_sync`, {
          method: "POST",
          body: JSON.stringify({
            sessionID: sessionID,
            secret,
            key: key,
            content,
          }),
        })
      })
      .then((x) => {
        if (x) {
          log.info("synced", {
            key: key,
            status: x.status,
          })
        }
      })
  }

  export function init() {
    Bus.subscribe(Session.Event.Updated, async (evt) => {
      await sync("session/info/" + evt.properties.info.id, evt.properties.info)
    })
    Bus.subscribe(MessageV2.Event.Updated, async (evt) => {
      await sync("session/message/" + evt.properties.info.sessionID + "/" + evt.properties.info.id, evt.properties.info)
    })
    Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
      await sync(
        "session/part/" +
          evt.properties.part.sessionID +
          "/" +
          evt.properties.part.messageID +
          "/" +
          evt.properties.part.id,
        evt.properties.part,
      )
    })
  }

  export const URL =
    process.env["OPENCODE_API"] ??
    (Installation.isPreview() || Installation.isLocal() ? "https://api.dev.opencode.ai" : "https://api.opencode.ai")

  // GDPR COMPLIANCE: Session sharing is now OPT-IN instead of opt-out
  // - By default, session sharing is DISABLED to comply with GDPR Art. 6 (lawful basis)
  // - In GitHub-only mode, sharing is ALWAYS disabled (European deployments)
  // - To enable sharing, set OPENCODE_ENABLE_SHARE=1 (requires user consent)
  // - In GDPR builds, this is hardcoded at build time and cannot be overridden
  const disabled = isSessionSharingDisabled()

  export async function create(sessionID: string) {
    if (disabled) {
      logSessionShare({ sessionID, action: "blocked", reason: "session_sharing_disabled" })
      return { url: "", secret: "" }
    }

    logSessionShare({ sessionID, action: "create" })

    return fetch(`${URL}/share_create`, {
      method: "POST",
      body: JSON.stringify({ sessionID: sessionID }),
    })
      .then((x) => x.json())
      .then((x) => x as { url: string; secret: string })
  }

  export async function remove(sessionID: string, secret: string) {
    if (disabled) {
      logSessionShare({ sessionID, action: "blocked", reason: "session_sharing_disabled" })
      return {}
    }

    logSessionShare({ sessionID, action: "delete" })

    return fetch(`${URL}/share_delete`, {
      method: "POST",
      body: JSON.stringify({ sessionID, secret }),
    }).then((x) => x.json())
  }
}
