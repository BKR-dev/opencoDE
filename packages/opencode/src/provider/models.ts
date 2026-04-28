import { Global } from "../global"
import { Log } from "../util"
import path from "path"
import { Schema } from "effect"
import { Installation } from "../installation"
import { Flag } from "../flag/flag"
import { logModelMetadataFetch } from "../audit/gdpr"
import { isGitHubOnlyMode } from "../gdpr/build-constants"
import { Auth } from "../auth"

// Shape of a single item returned by https://api.githubcopilot.com/models
interface GitHubModelItem {
  id: string
  name?: string
  friendly_name?: string
  model_picker_enabled?: boolean
  capabilities?: {
    supports_tool_calls?: boolean
    supports_vision?: boolean
    supports_reasoning?: boolean
    max_input_tokens?: number
    max_output_tokens?: number
    // Copilot API uses nested supports/limits objects
    supports?: {
      tool_calls?: boolean
      vision?: boolean
      streaming?: boolean
      reasoning_effort?: string[]
    }
    limits?: {
      max_context_window_tokens?: number
      max_output_tokens?: number
      max_prompt_tokens?: number
      vision?: object
    }
  }
}

// Try to import bundled snapshot (generated at build time)
// Falls back to undefined in dev mode when snapshot doesn't exist
/* @ts-ignore */

const log = Log.create({ service: "models.dev" })
const source = url()
const filepath = path.join(
  Global.Path.cache,
  source === "https://models.dev" ? "models.json" : `models-${Hash.fast(source)}.json`,
)
const ttl = 5 * 60 * 1000

const Cost = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
  cache_read: Schema.optional(Schema.Number),
  cache_write: Schema.optional(Schema.Number),
  context_over_200k: Schema.optional(
    Schema.Struct({
      input: Schema.Number,
      output: Schema.Number,
      cache_read: Schema.optional(Schema.Number),
      cache_write: Schema.optional(Schema.Number),
    }),
  ),
})

export const Model = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  family: Schema.optional(Schema.String),
  release_date: Schema.String,
  attachment: Schema.Boolean,
  reasoning: Schema.Boolean,
  temperature: Schema.Boolean,
  tool_call: Schema.Boolean,
  interleaved: Schema.optional(
    Schema.Union([
      Schema.Literal(true),
      Schema.Struct({
        field: Schema.Literals(["reasoning_content", "reasoning_details"]),
      }),
    ]),
  ),
  cost: Schema.optional(Cost),
  limit: Schema.Struct({
    context: Schema.Number,
    input: Schema.optional(Schema.Number),
    output: Schema.Number,
  }),
  modalities: Schema.optional(
    Schema.Struct({
      input: Schema.Array(Schema.Literals(["text", "audio", "image", "video", "pdf"])),
      output: Schema.Array(Schema.Literals(["text", "audio", "image", "video", "pdf"])),
    }),
  ),
  experimental: Schema.optional(
    Schema.Struct({
      modes: Schema.optional(
        Schema.Record(
          Schema.String,
          Schema.Struct({
            cost: Schema.optional(Cost),
            provider: Schema.optional(
              Schema.Struct({
                body: Schema.optional(Schema.Record(Schema.String, Schema.MutableJson)),
                headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
              }),
            ),
          }),
        ),
      ),
    }),
  ),
  status: Schema.optional(Schema.Literals(["alpha", "beta", "deprecated"])),
  provider: Schema.optional(
    Schema.Struct({ npm: Schema.optional(Schema.String), api: Schema.optional(Schema.String) }),
  ),
})
export type Model = Schema.Schema.Type<typeof Model>

export const Provider = Schema.Struct({
  api: Schema.optional(Schema.String),
  name: Schema.String,
  env: Schema.Array(Schema.String),
  id: Schema.String,
  npm: Schema.optional(Schema.String),
  models: Schema.Record(Schema.String, Model),
})

  // Fetch the live model list directly from the GitHub Copilot API.
  // This is the only correct source of truth for available models in GDPR mode —
  // the macro-embedded data is fetched from models.dev at build time and only
  // contains whatever models.dev knew about at that moment (often just gpt-4o-mini).
  async function fetchGitHubCopilotModels(): Promise<Record<string, Provider>> {
    const auth = await Auth.get("github-copilot")
    const token = auth?.type === "oauth" ? auth.refresh : undefined
    const headers: Record<string, string> = {
      "User-Agent": Installation.USER_AGENT,
      Accept: "application/json",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const resp = await fetch("https://api.githubcopilot.com/models", { headers }).catch(() => undefined)
    if (!resp?.ok) {
      log.warn("Failed to fetch GitHub Copilot models from API", { status: resp?.status })
      return {}
    }

    const body = (await resp.json()) as { data: GitHubModelItem[] }
    const items = body.data ?? []
    const models: Record<string, ModelsDev.Model> = {}
    for (const item of items) {
      const cap = item.capabilities ?? {}
      const supports = cap.supports ?? {}
      const limits = cap.limits ?? {}
      const hasVision = !!(supports.vision || cap.supports_vision)
      const hasToolCall = !!(supports.tool_calls || cap.supports_tool_calls)
      const hasReasoning = Array.isArray(supports.reasoning_effort) && supports.reasoning_effort.length > 0
      const contextWindow = limits.max_context_window_tokens ?? 128000
      const outputTokens = limits.max_output_tokens ?? 4096
      models[item.id] = {
        id: item.id,
        name: item.name ?? item.id,
        release_date: "2026-01-01",
        attachment: hasVision,
        reasoning: hasReasoning,
        temperature: true,
        tool_call: hasToolCall,
        cost: { input: 0, output: 0 },
        limit: {
          context: contextWindow,
          input: limits.max_prompt_tokens,
          output: outputTokens,
        },
        modalities: {
          input: hasVision ? ["text", "image"] : ["text"],
          output: ["text"],
        },
        options: {},
      }
    }

    return {
      "github-copilot": {
        id: "github-copilot",
        name: "GitHub Copilot",
        env: [],
        npm: "@ai-sdk/github-copilot",
        api: "https://api.githubcopilot.com",
        models,
      },
    }
  }

  export async function get(): Promise<Record<string, Provider>> {
    // In GitHub-only (GDPR) mode: bypass the macro/cache entirely and fetch
    // live from https://api.github.com/models so the full model catalogue is shown.
    if (isGitHubOnlyMode()) {
      return fetchGitHubCopilotModels()
    }

    refresh()
    const file = Bun.file(filepath)
    let result = await file.json().catch(() => {})

    if (!result && typeof data === "function") {
      const json = await data()
      result = JSON.parse(json)
    }

    if (!result) {
      const url = Global.Path.modelsDevUrl
      const json = await fetch(`${url}/api.json`).then((x) => x.text())
      result = JSON.parse(json)
    }

    return result as Record<string, Provider>
  }

  export async function refresh() {
    // GDPR COMPLIANCE: Block models.dev fetch in GitHub-only mode.
    // models.dev sends metadata about installed providers to an external service.
    // In GDPR mode we fetch directly from the GitHub API instead (see get()).
    if (isGitHubOnlyMode()) {
      log.info("models.dev fetch blocked in GitHub-only (GDPR) mode")
      logModelMetadataFetch({
        source: "models.dev",
        blocked: true,
        reason: "github_only_mode_active",
      })
      return
    }

    if (Flag.OPENCODE_DISABLE_MODELS_FETCH) return
    const file = Bun.file(filepath)
    log.info("refreshing", { file })
    const url = Global.Path.modelsDevUrl
    const result = await fetch(`${url}/api.json`, {
      headers: { "User-Agent": Installation.USER_AGENT },
      signal: AbortSignal.timeout(10 * 1000),
    }).catch((e) => {
      log.error("Failed to fetch models.dev", { error: e })
    })
    if (result && result.ok) await Bun.write(file, await result.text())
  }
}

function fresh() {
  return Date.now() - Number(Filesystem.stat(filepath)?.mtimeMs ?? 0) < ttl
}

function skip(force: boolean) {
  return !force && fresh()
}

const fetchApi = async () => {
  const result = await fetch(`${url()}/api.json`, {
    headers: { "User-Agent": Installation.USER_AGENT },
    signal: AbortSignal.timeout(10000),
  })
  return { ok: result.ok, text: await result.text() }
}

export const Data = lazy(async () => {
  const result = await Filesystem.readJson(Flag.OPENCODE_MODELS_PATH ?? filepath).catch(() => {})
  if (result) return result
  // @ts-ignore
  const snapshot = await import("./models-snapshot.js")
    .then((m) => m.snapshot as Record<string, unknown>)
    .catch(() => undefined)
  if (snapshot) return snapshot
  if (Flag.OPENCODE_DISABLE_MODELS_FETCH) return {}
  return Flock.withLock(`models-dev:${filepath}`, async () => {
    const result = await Filesystem.readJson(Flag.OPENCODE_MODELS_PATH ?? filepath).catch(() => {})
    if (result) return result
    const result2 = await fetchApi()
    if (result2.ok) {
      await Filesystem.write(filepath, result2.text).catch((e) => {
        log.error("Failed to write models cache", { error: e })
      })
    }
    return JSON.parse(result2.text)
  })
})

export async function get() {
  const result = await Data()
  return result as Record<string, Provider>
}

export async function refresh(force = false) {
  if (skip(force)) return Data.reset()
  await Flock.withLock(`models-dev:${filepath}`, async () => {
    if (skip(force)) return Data.reset()
    const result = await fetchApi()
    if (!result.ok) return
    await Filesystem.write(filepath, result.text)
    Data.reset()
  }).catch((e) => {
    log.error("Failed to fetch models.dev", {
      error: e,
    })
  })
}

if (!Flag.OPENCODE_DISABLE_MODELS_FETCH && !process.argv.includes("--get-yargs-completions")) {
  void refresh()
  setInterval(
    async () => {
      await refresh()
    },
    60 * 1000 * 60,
  ).unref()
}
