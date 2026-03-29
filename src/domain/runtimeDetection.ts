export type BrowserDetectedRuntime = 'ollama' | 'lmstudio'

export type RuntimeDetectionState =
  | 'idle'
  | 'checking'
  | 'healthy'
  | 'installed-not-running'
  | 'not-detected'
  | 'blocked'

export type RuntimeDetectionProbeSummary = {
  runtime: BrowserDetectedRuntime
  installedHint?: boolean
  healthy?: boolean
  browserBlocked?: boolean
  reachableWithoutCors?: boolean
  modelCount?: number | null
}

export type RuntimeDetectionResult = {
  runtime: BrowserDetectedRuntime
  state: Exclude<RuntimeDetectionState, 'idle' | 'checking'>
  title: string
  detail: string
  help?: string
  modelCount?: number | null
}

const getRuntimeLabel = (runtime: BrowserDetectedRuntime) =>
  runtime === 'ollama' ? 'Ollama' : 'LM Studio'

export const classifyRuntimeDetection = ({
  runtime,
  installedHint = false,
  healthy = false,
  browserBlocked = false,
  reachableWithoutCors = false,
  modelCount = null,
}: RuntimeDetectionProbeSummary): RuntimeDetectionResult => {
  const label = getRuntimeLabel(runtime)

  if (healthy) {
    const modelDetail =
      typeof modelCount === 'number'
        ? modelCount > 0
          ? ` Local API responded and reported ${modelCount} available model${modelCount === 1 ? '' : 's'}.`
          : ' Local API responded successfully.'
        : ''

    return {
      runtime,
      state: 'healthy',
      title: `${label} detected and healthy`,
      detail: `${label} is responding on its default localhost port.${modelDetail}`.trim(),
      modelCount,
    }
  }

  if (browserBlocked || reachableWithoutCors) {
    return {
      runtime,
      state: 'blocked',
      title: `${label} may be running, but the browser cannot confirm it`,
      detail:
        runtime === 'lmstudio'
          ? `Something is responding on localhost:1234, but browser access is blocked by CORS or local-network browser protections.`
          : `Something is responding on localhost:11434, but browser access is blocked by CORS or local-network browser protections.`,
      help:
        runtime === 'lmstudio'
          ? 'In LM Studio, enable CORS in Server Settings or start the server with `lms server start --cors --port 1234`, then retry.'
          : 'Retry from the same browser, or use the install steps below to verify the local API directly from your terminal.',
      modelCount,
    }
  }

  if (installedHint) {
    return {
      runtime,
      state: 'installed-not-running',
      title: `${label} looks installed, but the local server is not responding`,
      detail:
        runtime === 'lmstudio'
          ? 'The browser could not reach localhost:1234. Start the LM Studio server, then retry the check.'
          : 'The browser could not reach localhost:11434. Start Ollama, then retry the check.',
      help:
        runtime === 'lmstudio'
          ? 'Open LM Studio and start the local server, or run `lms server start --port 1234`.'
          : 'Launch Ollama and make sure the local API is available on `http://localhost:11434`.',
    }
  }

  return {
    runtime,
    state: 'not-detected',
    title: `${label} not detected`,
    detail:
      runtime === 'lmstudio'
        ? 'No local response was detected on localhost:1234 from this browser.'
        : 'No local response was detected on localhost:11434 from this browser.',
    help:
      runtime === 'lmstudio'
        ? 'If you have already installed LM Studio, start its local server and retry.'
        : 'If you have already installed Ollama, launch it and retry.',
  }
}
