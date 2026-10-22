import { Plugin } from "@opencode/plugin/tui"
import { createMemo, createSignal, Show } from "solid-js"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Unidad en la que se mide el consumo:
 * - "tokens": tokens de entrada + salida (+ razonamiento).
 * - "requests": llamadas al modelo (pasos), como los "requests por 5 horas" de Go.
 */
type Unit = "tokens" | "requests"

type Options = {
  /** Presupuesto de la ventana, en la unidad elegida. */
  limit: number
  /** "day" = desde la medianoche local; un número = ventana móvil de N horas. */
  window: "day" | number
  unit: Unit
  /** Texto que aparece detrás del porcentaje. */
  label: string
  /** Mostrar el indicador en la barra inferior del prompt. */
  footer: boolean
  /** Mostrarlo además en la barra lateral. */
  sidebar: boolean
  /** Añadir el número absoluto que queda: "(12.3k)". */
  tokens: boolean
  /** Contar también los tokens de caché (lectura/escritura). */
  cache: boolean
  /** Milisegundos entre refrescos de la estadística de uso. */
  refresh: number
  /**
   * Si es true (por defecto), el indicador mide el consumo del **modelo actual**
   * (cada modelo tiene su propia cuota en el free tier). Si es false, suma todos
   * los modelos.
   */
  perModel: boolean
}

type Usage = {
  /** Consumo de la ventana actual, en la unidad elegida. */
  used: number
  /** Presupuesto de la ventana. */
  limit: number
  /** Porcentaje del presupuesto que queda. */
  remainingPercent: number
}

const DEFAULTS: Options = {
  limit: 1_000_000,
  window: "day",
  unit: "tokens",
  label: "IA",
  footer: true,
  sidebar: false,
  tokens: false,
  cache: false,
  refresh: 30_000,
  perModel: true,
}

function readOptions(raw: Record<string, any> | undefined): Options {
  const options = raw ?? {}
  const window =
    options.window === "day"
      ? ("day" as const)
      : typeof options.window === "number" && options.window > 0
        ? options.window
        : ("day" as const)
  return {
    limit: typeof options.limit === "number" && options.limit > 0 ? options.limit : DEFAULTS.limit,
    window,
    unit: options.unit === "requests" ? "requests" : "tokens",
    label: typeof options.label === "string" ? options.label : DEFAULTS.label,
    footer: options.footer !== false,
    sidebar: options.sidebar === true,
    tokens: options.tokens === true,
    cache: options.cache === true,
    refresh: typeof options.refresh === "number" && options.refresh > 0 ? options.refresh : DEFAULTS.refresh,
    perModel: options.perModel !== false,
  }
}

/**
 * Carga las opciones del plugin. En esta versión del host las opciones no
 * siempre llegan por `context.options`, así que también se leen del
 * `opencode.json` global como respaldo.
 */
function loadOptions(contextOptions: Record<string, any> | undefined): Options {
  if (contextOptions && Object.keys(contextOptions).length > 0) {
    return readOptions(contextOptions)
  }
  try {
    const configPath = join(homedir(), ".config", "opencode", "opencode.json")
    const config = JSON.parse(readFileSync(configPath, "utf8"))
    const entries = Array.isArray(config?.plugins) ? config.plugins : []
    const entry = entries.find((item: any) => {
      const pkg = typeof item === "string" ? item : item?.package
      return typeof pkg === "string" && pkg.includes("usage-remaining")
    })
    if (entry && typeof entry === "object") {
      return readOptions(entry.options)
    }
  } catch {
    // Sin configuración disponible: se usan los valores por defecto.
  }
  return { ...DEFAULTS }
}

/** Inicio de la ventana de consumo: medianoche local o ventana móvil de N horas. */
function windowRange(window: Options["window"]) {
  const to = Date.now()
  if (window === "day") {
    const start = new Date(to)
    start.setHours(0, 0, 0, 0)
    return { from: start.getTime(), to }
  }
  return { from: to - window * 60 * 60 * 1000, to }
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(value)
}

function computeUsage(stats: any, options: Options, modelId?: string): Usage | undefined {
  if (!stats?.tokens) return undefined
  const tokens = stats.tokens
  const limit = options.limit

  // Filtrar por modelo si procede (cada modelo tiene su propia cuota).
  let used: number
  if (options.perModel && modelId) {
    const entry = (stats.models ?? []).find((m: any) => m?.model?.id === modelId)
    if (!entry?.tokens) return undefined
    const t = entry.tokens
    used =
      options.unit === "requests"
        ? entry.steps
        : t.input + t.output + t.reasoning + (options.cache ? t.cache.read + t.cache.write : 0)
  } else {
    used =
      options.unit === "requests"
        ? stats.steps
        : tokens.input + tokens.output + tokens.reasoning + (options.cache ? tokens.cache.read + tokens.cache.write : 0)
  }

  const remainingPercent = Math.max(0, Math.min(100, Math.round(((limit - used) / limit) * 100)))
  return { used, limit, remainingPercent }
}

export default Plugin.define({
  id: "usage-remaining.tui",
  setup(context) {
    const options = loadOptions(context.options)
    // Uso por modelo (clave = id del modelo) y uso total.
    const [modelUsage, setModelUsage] = createSignal<Record<string, Usage>>({})
    const [totalUsage, setTotalUsage] = createSignal<Usage | undefined>()

    const refresh = async () => {
      try {
        const { from, to } = windowRange(options.window)
        const client = context.client as any
        const stats = await client?.session?.stats?.({ from, to })
        if (!stats?.tokens) return

        // Total (todos los modelos).
        setTotalUsage(computeUsage(stats, options))

        // Por modelo.
        const perModel: Record<string, Usage> = {}
        for (const m of stats.models ?? []) {
          const u = computeUsage(
            { tokens: m.tokens, steps: m.steps, models: [m] },
            options,
            m?.model?.id,
          )
          if (u && m?.model?.id) perModel[m.model.id] = u
        }
        setModelUsage(perModel)
      } catch {
        // Sin estadísticas disponibles: se mantiene el último valor conocido.
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), options.refresh)

    const color = (percent: number) =>
      percent <= 10
        ? context.theme.text.feedback.error.base
        : percent <= 25
          ? context.theme.text.feedback.warning.base
          : context.theme.text.feedback.success.base

    const text = (v: Usage, separator: boolean) =>
      `${separator ? " · " : ""}${v.remainingPercent}% ${options.label}${
        options.tokens ? ` (${formatTokens(Math.max(0, options.limit - v.used))})` : ""
      }`

    if (options.footer) {
      context.ui.slot({
        append: "prompt.footer",
        render: (props) => {
          const visible = createMemo(() => {
            if (!props.showDetails) return undefined
            const sid = props.sessionID
            const sess = sid ? context.data.session.get(sid) : undefined
            const mid = sess?.model?.id
            const mu = modelUsage()
            const u =
              options.perModel && mid && mu[mid] ? mu[mid] : totalUsage()
            return u
          })
          return (
            <Show when={visible()} keyed fallback={null}>
              {(v) => (
                <text fg={color(v.remainingPercent)} wrapMode="none" flexShrink={1}>
                  {text(v, true)}
                </text>
              )}
            </Show>
          )
        },
      })
    }

    if (options.sidebar) {
      context.ui.slot({
        append: "sidebar.content",
        render: (props) => {
          const visible = createMemo(() => {
            const sid = props.sessionID
            const sess = sid ? context.data.session.get(sid) : undefined
            const mid = sess?.model?.id
            const mu = modelUsage()
            const u =
              options.perModel && mid && mu[mid] ? mu[mid] : totalUsage()
            return u
          })
          return (
            <Show when={visible()} keyed fallback={null}>
              {(v) => (
                <text fg={color(v.remainingPercent)} wrapMode="none" flexShrink={1}>
                  {text(v, false)}
                </text>
              )}
            </Show>
          )
        },
      })
    }

    return () => clearInterval(timer)
  },
})
