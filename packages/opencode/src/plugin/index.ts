import type {
  Hooks,
  PluginInput,
  Plugin as PluginInstance,
  PluginModule,
  WorkspaceAdaptor as PluginWorkspaceAdaptor,
} from "@opencode-ai/plugin"
import { Config } from "../config"
import { Bus } from "../bus"
import { Log } from "../util"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { Flag } from "../flag/flag"
import { CodexAuthPlugin } from "./codex"
import { Session } from "../session"
import { NamedError } from "@opencode-ai/shared/util/error"
import { CopilotAuthPlugin } from "./copilot"
import { isGitHubOnlyMode } from "../gdpr/build-constants"

const log = Log.create({ service: "plugin" })

  const BUILTIN: string[] = ["@gitlab/opencode-gitlab-auth@1.3.2"]

  // Built-in plugins that are directly imported (not installed from npm)
  const INTERNAL_PLUGINS: PluginInstance[] = isGitHubOnlyMode()
    ? [CopilotAuthPlugin]
    : [CodexAuthPlugin, CopilotAuthPlugin]

  const state = Instance.state(async () => {
    const client = createOpencodeClient({
      baseUrl: "http://localhost:4096",
      // @ts-ignore - fetch type incompatibility
      fetch: async (...args) => Server.App().fetch(...args),
    })
    const config = await Config.get()
    const hooks: Hooks[] = []
    const input: PluginInput = {
      client,
      project: Instance.project,
      worktree: Instance.worktree,
      directory: Instance.directory,
      serverUrl: Server.url(),
      $: Bun.$,
    }

    for (const plugin of INTERNAL_PLUGINS) {
      log.info("loading internal plugin", { name: plugin.name })
      const init = await plugin(input)
      hooks.push(init)
    }

    const plugins = isGitHubOnlyMode() ? [] : [...(config.plugin ?? [])]
    if (!Flag.OPENCODE_DISABLE_DEFAULT_PLUGINS && !isGitHubOnlyMode()) {
      plugins.push(...BUILTIN)
    }

    for (let plugin of plugins) {
      // ignore old codex plugin since it is supported first party now
      if (plugin.includes("opencode-openai-codex-auth") || plugin.includes("opencode-copilot-auth")) continue
      log.info("loading plugin", { path: plugin })
      if (!plugin.startsWith("file://")) {
        const lastAtIndex = plugin.lastIndexOf("@")
        const pkg = lastAtIndex > 0 ? plugin.substring(0, lastAtIndex) : plugin
        const version = lastAtIndex > 0 ? plugin.substring(lastAtIndex + 1) : "latest"
        const builtin = BUILTIN.some((x) => x.startsWith(pkg + "@"))
        plugin = await BunProc.install(pkg, version).catch((err) => {
          if (!builtin) throw err

          const message = err instanceof Error ? err.message : String(err)
          log.error("failed to install builtin plugin", {
            pkg,
            version,
            error: message,
          })
          Bus.publish(Session.Event.Error, {
            error: new NamedError.Unknown({
              message: `Failed to install built-in plugin ${pkg}@${version}: ${message}`,
            }).toObject(),
          })

          return ""
        })
        if (!plugin) continue
      }
      const mod = await import(plugin)
      // Prevent duplicate initialization when plugins export the same function
      // as both a named export and default export (e.g., `export const X` and `export default X`).
      // Object.entries(mod) would return both entries pointing to the same function reference.
      const seen = new Set<PluginInstance>()
      for (const [_name, fn] of Object.entries<PluginInstance>(mod)) {
        if (seen.has(fn)) continue
        seen.add(fn)
        const init = await fn(input)
        hooks.push(init)
      }
    }

    return {
      hooks,
      input,
    }
  })

  export async function trigger<
    Name extends Exclude<keyof Required<Hooks>, "auth" | "event" | "tool">,
    Input = Parameters<Required<Hooks>[Name]>[0],
    Output = Parameters<Required<Hooks>[Name]>[1],
  >(
    name: Name,
    input: Input,
    output: Output,
  ) => Effect.Effect<Output>
  readonly list: () => Effect.Effect<Hooks[]>
  readonly init: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Plugin") {}

// Built-in plugins that are directly imported (not installed from npm)
const INTERNAL_PLUGINS: PluginInstance[] = [
  CodexAuthPlugin,
  CopilotAuthPlugin,
  GitlabAuthPlugin,
  PoeAuthPlugin,
  CloudflareWorkersAuthPlugin,
  CloudflareAIGatewayAuthPlugin,
]

function isServerPlugin(value: unknown): value is PluginInstance {
  return typeof value === "function"
}

function getServerPlugin(value: unknown) {
  if (isServerPlugin(value)) return value
  if (!value || typeof value !== "object" || !("server" in value)) return
  if (!isServerPlugin(value.server)) return
  return value.server
}

function getLegacyPlugins(mod: Record<string, unknown>) {
  const seen = new Set<unknown>()
  const result: PluginInstance[] = []

  for (const entry of Object.values(mod)) {
    if (seen.has(entry)) continue
    seen.add(entry)
    const plugin = getServerPlugin(entry)
    if (!plugin) throw new TypeError("Plugin export is not a function")
    result.push(plugin)
  }

  return result
}

async function applyPlugin(load: PluginLoader.Loaded, input: PluginInput, hooks: Hooks[]) {
  const plugin = readV1Plugin(load.mod, load.spec, "server", "detect")
  if (plugin) {
    await resolvePluginId(load.source, load.spec, load.target, readPluginId(plugin.id, load.spec), load.pkg)
    hooks.push(await (plugin as PluginModule).server(input, load.options))
    return
  }

  for (const server of getLegacyPlugins(load.mod)) {
    hooks.push(await server(input, load.options))
  }
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    const config = yield* Config.Service

    const state = yield* InstanceState.make<State>(
      Effect.fn("Plugin.state")(function* (ctx) {
        const hooks: Hooks[] = []
        const bridge = yield* EffectBridge.make()

        function publishPluginError(message: string) {
          bridge.fork(bus.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() }))
        }

        const { Server } = yield* Effect.promise(() => import("../server/server"))

        const client = createOpencodeClient({
          baseUrl: "http://localhost:4096",
          directory: ctx.directory,
          headers: Flag.OPENCODE_SERVER_PASSWORD
            ? {
                Authorization: `Basic ${Buffer.from(`${Flag.OPENCODE_SERVER_USERNAME ?? "opencode"}:${Flag.OPENCODE_SERVER_PASSWORD}`).toString("base64")}`,
              }
            : undefined,
          fetch: async (...args) => (await Server.Default()).app.fetch(...args),
        })
        const cfg = yield* config.get()
        const input: PluginInput = {
          client,
          project: ctx.project,
          worktree: ctx.worktree,
          directory: ctx.directory,
          experimental_workspace: {
            register(type: string, adaptor: PluginWorkspaceAdaptor) {
              registerAdaptor(ctx.project.id, type, adaptor as WorkspaceAdaptor)
            },
          },
          get serverUrl(): URL {
            return Server.url ?? new URL("http://localhost:4096")
          },
          // @ts-expect-error
          $: typeof Bun === "undefined" ? undefined : Bun.$,
        }

        for (const plugin of INTERNAL_PLUGINS) {
          log.info("loading internal plugin", { name: plugin.name })
          const init = yield* Effect.tryPromise({
            try: () => plugin(input),
            catch: (err) => {
              log.error("failed to load internal plugin", { name: plugin.name, error: err })
            },
          }).pipe(Effect.option)
          if (init._tag === "Some") hooks.push(init.value)
        }

        const plugins = Flag.OPENCODE_PURE ? [] : (cfg.plugin_origins ?? [])
        if (Flag.OPENCODE_PURE && cfg.plugin_origins?.length) {
          log.info("skipping external plugins in pure mode", { count: cfg.plugin_origins.length })
        }
        if (plugins.length) yield* config.waitForDependencies()

        const loaded = yield* Effect.promise(() =>
          PluginLoader.loadExternal({
            items: plugins,
            kind: "server",
            report: {
              start(candidate) {
                log.info("loading plugin", { path: candidate.plan.spec })
              },
              missing(candidate, _retry, message) {
                log.warn("plugin has no server entrypoint", { path: candidate.plan.spec, message })
              },
              error(candidate, _retry, stage, error, resolved) {
                const spec = candidate.plan.spec
                const cause = error instanceof Error ? (error.cause ?? error) : error
                const message = stage === "load" ? errorMessage(error) : errorMessage(cause)

                if (stage === "install") {
                  const parsed = parsePluginSpecifier(spec)
                  log.error("failed to install plugin", { pkg: parsed.pkg, version: parsed.version, error: message })
                  publishPluginError(`Failed to install plugin ${parsed.pkg}@${parsed.version}: ${message}`)
                  return
                }

                if (stage === "compatibility") {
                  log.warn("plugin incompatible", { path: spec, error: message })
                  publishPluginError(`Plugin ${spec} skipped: ${message}`)
                  return
                }

                if (stage === "entry") {
                  log.error("failed to resolve plugin server entry", { path: spec, error: message })
                  publishPluginError(`Failed to load plugin ${spec}: ${message}`)
                  return
                }

                log.error("failed to load plugin", { path: spec, target: resolved?.entry, error: message })
                publishPluginError(`Failed to load plugin ${spec}: ${message}`)
              },
            },
          }),
        )
        for (const load of loaded) {
          if (!load) continue

          // Keep plugin execution sequential so hook registration and execution
          // order remains deterministic across plugin runs.
          yield* Effect.tryPromise({
            try: () => applyPlugin(load, input, hooks),
            catch: (err) => {
              const message = errorMessage(err)
              log.error("failed to load plugin", { path: load.spec, error: message })
              return message
            },
          }).pipe(
            Effect.catch(() => {
              // TODO: make proper events for this
              // bus.publish(Session.Event.Error, {
              //   error: new NamedError.Unknown({
              //     message: `Failed to load plugin ${load.spec}: ${message}`,
              //   }).toObject(),
              // })
              return Effect.void
            }),
          )
        }

        // Notify plugins of current config
        for (const hook of hooks) {
          yield* Effect.tryPromise({
            try: () => Promise.resolve((hook as any).config?.(cfg)),
            catch: (err) => {
              log.error("plugin config hook failed", { error: err })
            },
          }).pipe(Effect.ignore)
        }

        // Subscribe to bus events, fiber interrupted when scope closes
        yield* bus.subscribeAll().pipe(
          Stream.runForEach((input) =>
            Effect.sync(() => {
              for (const hook of hooks) {
                void hook["event"]?.({ event: input as any })
              }
            }),
          ),
          Effect.forkScoped,
        )

        return { hooks }
      }),
    )

    const trigger = Effect.fn("Plugin.trigger")(function* <
      Name extends TriggerName,
      Input = Parameters<Required<Hooks>[Name]>[0],
      Output = Parameters<Required<Hooks>[Name]>[1],
    >(name: Name, input: Input, output: Output) {
      if (!name) return output
      const s = yield* InstanceState.get(state)
      for (const hook of s.hooks) {
        const fn = hook[name] as any
        if (!fn) continue
        yield* Effect.promise(async () => fn(input, output))
      }
      return output
    })

    const list = Effect.fn("Plugin.list")(function* () {
      const s = yield* InstanceState.get(state)
      return s.hooks
    })

    const init = Effect.fn("Plugin.init")(function* () {
      yield* InstanceState.get(state)
    })

    return Service.of({ trigger, list, init })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Bus.layer), Layer.provide(Config.defaultLayer))

export * as Plugin from "."
