import {
  createRuntimeBenchmarkResult,
  parseParamCount,
  type HardwareProfile,
  type LocalBenchmarkResult,
} from '../domain'

type OllamaModelRecord = {
  name: string
  size?: number
  details?: {
    parameter_size?: string
    quantization_level?: string
  }
}

type LmStudioModelRecord = {
  id: string
  quantization?: string
  state?: string
  loaded?: boolean
}

const REQUEST_TIMEOUT_MS = 25_000

const SHORT_PROMPT =
  'Reply with a single short sentence about local AI. Keep it under 20 words.'

const PREFILL_PROMPT = [
  'You are benchmarking a local model runtime.',
  'Summarize the following notes in one short sentence:',
  'local inference avoids cloud round trips',
  'decode throughput matters for interactive chat',
  'prefill speed matters for larger prompts',
  'first-token latency shapes perceived responsiveness',
  'quantization changes speed and memory',
  'browser hardware detection is approximate',
  'runtime measurements improve heuristics',
  'keep the answer concise',
].join(' ')

const OLLAMA_SMALL_MODEL_HINTS = [
  'qwen2.5:0.5b',
  'qwen2.5:1.5b',
  'llama3.2:1b',
  'gemma3:1b',
  'smollm2',
]

const LM_STUDIO_SMALL_MODEL_HINTS = [
  '0.5b',
  '1b',
  '1.5b',
  '2b',
  'smollm',
]

const normalizeError = (runtime: 'ollama' | 'lmstudio', error: unknown) => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('401') || message.includes('403')) {
      return runtime === 'lmstudio'
        ? 'LM Studio server is running but requires authentication, so the browser cannot benchmark it directly.'
        : 'Ollama rejected the request from this browser.'
    }
    if (
      message.includes('cors') ||
      message.includes('cross-origin') ||
      message.includes('private network')
    ) {
      return runtime === 'lmstudio'
        ? 'LM Studio is reachable, but the browser is blocked by CORS or local network protections. Enable CORS in Server Settings, then retry.'
        : 'Ollama is reachable, but the browser cannot complete the benchmark because local network access is blocked.'
    }
    return error.message
  }
  return `Unable to benchmark ${runtime === 'ollama' ? 'Ollama' : 'LM Studio'} right now.`
}

const withTimeout = async <T>(factory: (signal: AbortSignal) => Promise<T>) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await factory(controller.signal)
  } finally {
    window.clearTimeout(timer)
  }
}

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await withTimeout((signal) =>
    fetch(url, {
      ...init,
      cache: 'no-store',
      signal,
    }),
  )

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return (await response.json()) as T
}

const chooseOllamaBenchmarkModel = (models: OllamaModelRecord[]) => {
  if (models.length === 0) return null

  for (const hint of OLLAMA_SMALL_MODEL_HINTS) {
    const match = models.find((model) => model.name.toLowerCase() === hint || model.name.toLowerCase().startsWith(`${hint}:`))
    if (match) return match
  }

  return [...models].sort((left, right) => {
    const leftParams = parseParamCount(left.details?.parameter_size || '') || Number.MAX_SAFE_INTEGER
    const rightParams = parseParamCount(right.details?.parameter_size || '') || Number.MAX_SAFE_INTEGER
    if (leftParams !== rightParams) return leftParams - rightParams
    return (left.size || Number.MAX_SAFE_INTEGER) - (right.size || Number.MAX_SAFE_INTEGER)
  })[0]
}

const chooseLmStudioBenchmarkModel = (models: LmStudioModelRecord[]) => {
  if (models.length === 0) return null

  for (const hint of LM_STUDIO_SMALL_MODEL_HINTS) {
    const preferred = models.find((model) => model.id.toLowerCase().includes(hint))
    if (preferred) return preferred
  }

  return [...models].sort((left, right) => {
    const leftLoaded = left.loaded || left.state === 'loaded' ? 0 : 1
    const rightLoaded = right.loaded || right.state === 'loaded' ? 0 : 1
    if (leftLoaded !== rightLoaded) return leftLoaded - rightLoaded

    const leftParams = parseParamCount(left.id) || Number.MAX_SAFE_INTEGER
    const rightParams = parseParamCount(right.id) || Number.MAX_SAFE_INTEGER
    if (leftParams !== rightParams) return leftParams - rightParams
    return left.id.localeCompare(right.id)
  })[0]
}

const buildOllamaSample = (payload: {
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
  load_duration?: number
}) => ({
  promptTokens:
    typeof payload.prompt_eval_count === 'number' ? payload.prompt_eval_count : null,
  completionTokens:
    typeof payload.eval_count === 'number' ? payload.eval_count : null,
  firstTokenLatencyMs: Math.round(
    (((payload.load_duration || 0) + (payload.prompt_eval_duration || 0)) / 1_000_000) || 0,
  ) || null,
  decodeTokensPerSecond:
    payload.eval_count && payload.eval_duration
      ? Number(((payload.eval_count / payload.eval_duration) * 1_000_000_000).toFixed(1))
      : null,
  prefillTokensPerSecond:
    payload.prompt_eval_count && payload.prompt_eval_duration
      ? Number(
          ((payload.prompt_eval_count / payload.prompt_eval_duration) * 1_000_000_000).toFixed(1),
        )
      : null,
})

const getLmStudioTtftSeconds = (stats: Record<string, unknown>) => {
  const modern = stats.time_to_first_token_seconds
  if (typeof modern === 'number' && Number.isFinite(modern)) return modern
  const legacy = stats.time_to_first_token
  if (typeof legacy === 'number' && Number.isFinite(legacy)) return legacy
  return null
}

export const runOllamaRuntimeBenchmark = async ({
  chipMultiplier = 1,
  profile,
}: {
  chipMultiplier?: number
  profile: HardwareProfile
}): Promise<LocalBenchmarkResult> => {
  try {
    const tags = await fetchJson<{ models?: OllamaModelRecord[] }>(
      'http://localhost:11434/api/tags',
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
    )

    const model = chooseOllamaBenchmarkModel(tags.models || [])
    if (!model) {
      throw new Error('Ollama is reachable, but no local models are installed to benchmark.')
    }

    const baseBody = {
      model: model.name,
      stream: false,
      options: {
        temperature: 0,
        num_ctx: 1024,
      },
      keep_alive: '5m',
    }

    await fetchJson('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...baseBody,
        prompt: 'Say ready.',
        options: {
          ...baseBody.options,
          num_predict: 1,
        },
      }),
    })

    const shortPrompt = buildOllamaSample(
      await fetchJson('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...baseBody,
          prompt: SHORT_PROMPT,
          options: {
            ...baseBody.options,
            num_predict: 32,
          },
        }),
      }),
    )

    const prefillPrompt = buildOllamaSample(
      await fetchJson('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...baseBody,
          prompt: PREFILL_PROMPT,
          options: {
            ...baseBody.options,
            num_predict: 8,
          },
        }),
      }),
    )

    return createRuntimeBenchmarkResult({
      runtime: 'ollama',
      benchmarkModel: model.name,
      benchmarkParamsB: parseParamCount(model.details?.parameter_size || ''),
      benchmarkQuant: model.details?.quantization_level || null,
      shortPrompt,
      prefillPrompt,
      profile,
      chipMultiplier,
      notes: 'Measured via Ollama local API.',
    })
  } catch (error) {
    throw new Error(normalizeError('ollama', error))
  }
}

export const runLmStudioRuntimeBenchmark = async ({
  chipMultiplier = 1,
  profile,
}: {
  chipMultiplier?: number
  profile: HardwareProfile
}): Promise<LocalBenchmarkResult> => {
  try {
    const payload = await fetchJson<{ data?: LmStudioModelRecord[] }>(
      'http://localhost:1234/api/v0/models',
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
    )

    const model = chooseLmStudioBenchmarkModel(payload.data || [])
    if (!model) {
      throw new Error('LM Studio server is reachable, but no local models are available to benchmark.')
    }

    const benchmarkRequest = async (input: string, maxTokens: number) =>
      fetchJson<{
        usage?: {
          prompt_tokens?: number
          completion_tokens?: number
        }
        stats?: Record<string, unknown>
        model_info?: {
          quant?: string
        }
      }>('http://localhost:1234/api/v0/chat/completions', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: 'user', content: input }],
          temperature: 0,
          max_tokens: maxTokens,
          stream: false,
        }),
      })

    const shortResponse = await benchmarkRequest(SHORT_PROMPT, 32)
    const shortTtft = getLmStudioTtftSeconds(shortResponse.stats || {})
    const shortPrompt = {
      promptTokens:
        typeof shortResponse.usage?.prompt_tokens === 'number'
          ? shortResponse.usage.prompt_tokens
          : null,
      completionTokens:
        typeof shortResponse.usage?.completion_tokens === 'number'
          ? shortResponse.usage.completion_tokens
          : null,
      firstTokenLatencyMs: shortTtft ? Math.round(shortTtft * 1000) : null,
      decodeTokensPerSecond:
        typeof shortResponse.stats?.tokens_per_second === 'number'
          ? Number(shortResponse.stats.tokens_per_second.toFixed(1))
          : null,
      prefillTokensPerSecond:
        shortTtft && shortResponse.usage?.prompt_tokens
          ? Number((shortResponse.usage.prompt_tokens / shortTtft).toFixed(1))
          : null,
    }

    const prefillResponse = await benchmarkRequest(PREFILL_PROMPT, 8)
    const prefillTtft = getLmStudioTtftSeconds(prefillResponse.stats || {})
    const prefillPrompt = {
      promptTokens:
        typeof prefillResponse.usage?.prompt_tokens === 'number'
          ? prefillResponse.usage.prompt_tokens
          : null,
      completionTokens:
        typeof prefillResponse.usage?.completion_tokens === 'number'
          ? prefillResponse.usage.completion_tokens
          : null,
      firstTokenLatencyMs: prefillTtft ? Math.round(prefillTtft * 1000) : null,
      decodeTokensPerSecond:
        typeof prefillResponse.stats?.tokens_per_second === 'number'
          ? Number(prefillResponse.stats.tokens_per_second.toFixed(1))
          : null,
      prefillTokensPerSecond:
        prefillTtft && prefillResponse.usage?.prompt_tokens
          ? Number((prefillResponse.usage.prompt_tokens / prefillTtft).toFixed(1))
          : null,
    }

    return createRuntimeBenchmarkResult({
      runtime: 'lmstudio',
      benchmarkModel: model.id,
      benchmarkParamsB: parseParamCount(model.id),
      benchmarkQuant: prefillResponse.model_info?.quant || model.quantization || null,
      shortPrompt,
      prefillPrompt,
      profile,
      chipMultiplier,
      notes: 'Measured via LM Studio local API.',
    })
  } catch (error) {
    throw new Error(normalizeError('lmstudio', error))
  }
}
