import { describe, expect, test } from "bun:test"
import path from "path"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool"
import { Instance } from "../../src/project/instance"
import { WebSearchTool } from "../../src/tool/websearch"
import { SessionID, MessageID } from "../../src/session/schema"

const projectRoot = path.join(import.meta.dir, "../..")

const ctx = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make("message"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

function exec(args: { query: string }) {
  return WebSearchTool.pipe(
    Effect.flatMap((info) => info.init()),
    Effect.flatMap((tool) =>
      tool.execute(
        {
          query: args.query,
          type: "auto",
          numResults: 1,
        },
        ctx,
      ),
    ),
    Effect.provide(Layer.mergeAll(FetchHttpClient.layer, Truncate.defaultLayer, Agent.defaultLayer)),
    Effect.runPromise,
  )
}

describe("tool.websearch", () => {
  test("is disabled in GitHub-only mode", async () => {
    const previous = process.env.OPENCODE_ONLY_GITHUB
    process.env.OPENCODE_ONLY_GITHUB = "1"

    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        await expect(exec({ query: "hello" })).rejects.toThrow("websearch tool disabled in GitHub-only mode")
      },
    })

    if (previous === undefined) delete process.env.OPENCODE_ONLY_GITHUB
    else process.env.OPENCODE_ONLY_GITHUB = previous
  })
})
