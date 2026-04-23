import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import z from "zod"
import { data } from "./models-macro" with { type: "macro" }
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

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  const filepath = path.join(Global.Path.cache, "models.json")

  export const Model = z.object({
    id: z.string(),
    name: z.string(),
    family: z.string().optional(),
    release_date: z.string(),
    attachment: z.boolean(),
    reasoning: z.boolean(),
    temperature: z.boolean(),
    tool_call: z.boolean(),
    interleaved: z
      .union([
        z.literal(true),
        z
          .object({
            field: z.enum(["reasoning_content", "reasoning_details"]),
          })
          .strict(),
      ])
      .optional(),
    cost: z
      .object({
        input: z.number(),
        output: z.number(),
        cache_read: z.number().optional(),
        cache_write: z.number().optional(),
        context_over_200k: z
          .object({
            input: z.number(),
            output: z.number(),
            cache_read: z.number().optional(),
            cache_write: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
    limit: z.object({
      context: z.number(),
      input: z.number().optional(),
      output: z.number(),
    }),
    modalities: z
      .object({
        input: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
        output: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
      })
      .optional(),
    experimental: z.boolean().optional(),
    status: z.enum(["alpha", "beta", "deprecated"]).optional(),
    options: z.record(z.string(), z.any()),
    headers: z.record(z.string(), z.string()).optional(),
    provider: z.object({ npm: z.string() }).optional(),
    variants: z.record(z.string(), z.record(z.string(), z.any())).optional(),
  })
  export type Model = z.infer<typeof Model>

  export const Provider = z.object({
    api: z.string().optional(),
    name: z.string(),
    env: z.array(z.string()),
    id: z.string(),
    npm: z.string().optional(),
    models: z.record(z.string(), Model),
  })

  export type Provider = z.infer<typeof Provider>

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

setInterval(() => ModelsDev.refresh(), 60 * 1000 * 60).unref()
