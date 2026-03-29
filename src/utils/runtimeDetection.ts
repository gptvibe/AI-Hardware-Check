import {
  classifyRuntimeDetection,
  type BrowserDetectedRuntime,
  type RuntimeDetectionResult,
} from '../domain'

const PROBE_TIMEOUT_MS = 2200

const runtimeProbeConfig: Record<
  BrowserDetectedRuntime,
  {
    url: string
    validate: (payload: unknown) => number | null
  }
> = {
  ollama: {
    url: 'http://localhost:11434/api/tags',
    validate: (payload) => {
      if (!payload || typeof payload !== 'object') return null
      const models = (payload as { models?: unknown }).models
      return Array.isArray(models) ? models.length : null
    },
  },
  lmstudio: {
    url: 'http://localhost:1234/v1/models',
    validate: (payload) => {
      if (!payload || typeof payload !== 'object') return null
      const data = (payload as { data?: unknown }).data
      return Array.isArray(data) ? data.length : null
    },
  },
}

const withTimeout = async <T>(factory: (signal: AbortSignal) => Promise<T>) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    return await factory(controller.signal)
  } finally {
    window.clearTimeout(timer)
  }
}

const getBrowserBlockedHint = (error: unknown) => {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('cors') ||
    message.includes('cross-origin') ||
    message.includes('private network') ||
    message.includes('mixed content')
  )
}

const probeReachableWithoutCors = async (url: string) => {
  try {
    await withTimeout((signal) =>
      fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal,
      }),
    )
    return true
  } catch {
    return false
  }
}

export const detectBrowserRuntime = async ({
  installedHint = false,
  runtime,
}: {
  installedHint?: boolean
  runtime: BrowserDetectedRuntime
}): Promise<RuntimeDetectionResult> => {
  const config = runtimeProbeConfig[runtime]

  try {
    const response = await withTimeout((signal) =>
      fetch(config.url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal,
      }),
    )

    if (!response.ok) {
      return classifyRuntimeDetection({
        runtime,
        installedHint,
      })
    }

    const payload = (await response.json()) as unknown
    const modelCount = config.validate(payload)

    return classifyRuntimeDetection({
      runtime,
      healthy: true,
      installedHint,
      modelCount,
    })
  } catch (error) {
    const browserBlocked = getBrowserBlockedHint(error)
    const reachableWithoutCors = await probeReachableWithoutCors(config.url)

    return classifyRuntimeDetection({
      runtime,
      browserBlocked,
      installedHint,
      reachableWithoutCors,
    })
  }
}
