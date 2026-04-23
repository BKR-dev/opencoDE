import { Bus } from "../bus"
import { Installation } from "../installation"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Log } from "../util/log"
import { logSessionStart, logSessionEnd, logDataTransfer } from "../audit/gdpr"
import { isSessionSharingDisabled } from "../gdpr/build-constants"

export namespace Share {
  const log = Log.create({ service: "share" })

  let queue: Promise<void> = Promise.resolve()
  const pending = new Map<string, any>()

  // Per-session counters so we can emit a single lifecycle summary instead of
  // one audit line per streamed token.
  const sessionCounters = new Map<
    string,
    { messages: number; parts: number; cloudSyncBlocked: { info: number; message: number; part: number }; startMs: number }
  >()

  function getCounter(sessionID: string) {
    const existing = sessionCounters.get(sessionID)
    if (existing) return existing
    const counter = { messages: 0, parts: 0, cloudSyncBlocked: { info: 0, message: 0, part: 0 }, startMs: Date.now() }
    sessionCounters.set(sessionID, counter)
    return counter
  }

  export async function sync(key: string, content: any) {
    if (disabled) {
      const [root, ...splits] = key.split("/")
      if (root === "session") {
        const [sub, sessionID] = splits
        if (sub !== "share" && sessionID) {
          // Track by data type — emitted as a typed breakdown in gdpr.session.end
          const blocked = getCounter(sessionID).cloudSyncBlocked
          if (sub === "info") blocked.info++
          else if (sub === "message") blocked.message++
          else if (sub === "part") blocked.part++
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
      const sessionID = evt.properties.info.id
      const counter = getCounter(sessionID)
      counter.messages++

      // Emit session.start on first message update (session just became active)
      if (counter.messages === 1) {
        logSessionStart({ sessionID })
      }

      await sync("session/info/" + sessionID, evt.properties.info)
    })

    Bus.subscribe(MessageV2.Event.Updated, async (evt) => {
      await sync(
        "session/message/" + evt.properties.info.sessionID + "/" + evt.properties.info.id,
        evt.properties.info,
      )
    })

    Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
      const sessionID = evt.properties.part.sessionID
      getCounter(sessionID).parts++

      await sync(
        "session/part/" +
          sessionID +
          "/" +
          evt.properties.part.messageID +
          "/" +
          evt.properties.part.id,
        evt.properties.part,
      )
    })
  }

  /**
   * Call when a session finishes to emit a single summary audit event.
   */
  export function finalise(sessionID: string) {
    const counter = sessionCounters.get(sessionID)
    if (!counter) return
    logSessionEnd({
      sessionID,
      messageCount: counter.messages,
      partCount: counter.parts,
      cloudSyncBlocked: counter.cloudSyncBlocked,
      durationMs: Date.now() - counter.startMs,
    })
    sessionCounters.delete(sessionID)
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
    if (disabled) return { url: "", secret: "" }

    return fetch(`${URL}/share_create`, {
      method: "POST",
      body: JSON.stringify({ sessionID: sessionID }),
    })
      .then((x) => x.json())
      .then((x) => x as { url: string; secret: string })
  }

  export async function remove(sessionID: string, secret: string) {
    if (disabled) return {}

    return fetch(`${URL}/share_delete`, {
      method: "POST",
      body: JSON.stringify({ sessionID, secret }),
    }).then((x) => x.json())
  }
}
