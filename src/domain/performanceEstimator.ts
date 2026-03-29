import type { HardwareProfile } from './systemHardware'

export type EstimatorConfidence = 'high' | 'medium' | 'low'
export type BenchmarkSource = 'synthetic' | 'ollama' | 'lmstudio'

export type PerformanceEstimate = {
  expectedTokPerSec: number | null
  conservativeTokPerSec: number | null
  firstTokenLatencyMs: number | null
  confidence: EstimatorConfidence
  explanation: string
}

export type EstimationInput = {
  paramsB: number | null
  quant: string | null
  contextTokens: number
  profile: HardwareProfile
  chipMultiplier?: number
  calibrationMultiplier?: number
  benchmarkResult?: LocalBenchmarkResult | null
}

export type RuntimeBenchmarkSample = {
  promptTokens?: number | null
  completionTokens?: number | null
  firstTokenLatencyMs?: number | null
  decodeTokensPerSecond?: number | null
  prefillTokensPerSecond?: number | null
}

export type LocalBenchmarkResult = {
  source: BenchmarkSource
  scoreOpsPerSec?: number
  suggestedMultiplier: number
  completedAtIso: string
  confidence?: EstimatorConfidence
  benchmarkModel?: string
  benchmarkParamsB?: number | null
  benchmarkQuant?: string | null
  shortPrompt?: RuntimeBenchmarkSample
  prefillPrompt?: RuntimeBenchmarkSample
  notes?: string
}

export type StoredBenchmarkResults = Partial<Record<BenchmarkSource, LocalBenchmarkResult>>

type RuntimeBenchmarkResultInput = {
  runtime: Exclude<BenchmarkSource, 'synthetic'>
  benchmarkModel: string
  benchmarkParamsB: number | null
  benchmarkQuant: string | null
  shortPrompt: RuntimeBenchmarkSample
  prefillPrompt: RuntimeBenchmarkSample
  profile: HardwareProfile
  chipMultiplier?: number
  notes?: string
}

type BenchmarkFreshness = {
  level: 'fresh' | 'recent' | 'stale' | 'unknown'
  label: string
}

const QUANT_FACTORS: Record<string, number> = {
  FP16: 0.8,
  BF16: 0.82,
  FP8: 1.05,
  INT8: 1.25,
  Q5_K_M: 1.32,
  Q4_K_M: 1.45,
  INT4: 1.5,
  Q3_K_M: 1.65,
  Q2_K: 1.85,
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const tierBaseSpeed = (tier: HardwareProfile['performanceTier']) => {
  switch (tier) {
    case 'high':
      return 25
    case 'mainstream':
      return 13
    case 'entry':
      return 6
    default:
      return 8
  }
}

const getHardwareConfidence = (
  profile: HardwareProfile,
  paramsB: number | null,
): EstimatorConfidence => {
  if (paramsB === null) return 'low'
  if (profile.confidenceScore >= 80) return 'high'
  if (profile.confidenceScore >= 60) return 'medium'
  return 'low'
}

export const getBenchmarkFreshness = (
  result: LocalBenchmarkResult | null | undefined,
  now = Date.now(),
): BenchmarkFreshness => {
  if (!result?.completedAtIso) {
    return { level: 'unknown', label: 'No benchmark saved yet' }
  }

  const completedAt = Date.parse(result.completedAtIso)
  if (!Number.isFinite(completedAt)) {
    return { level: 'unknown', label: 'Saved benchmark time is invalid' }
  }

  const ageHours = Math.max(0, (now - completedAt) / 3_600_000)
  if (ageHours < 24) {
    return {
      level: 'fresh',
      label: ageHours < 1 ? 'Fresh: less than 1 hour ago' : `Fresh: ${Math.round(ageHours)}h ago`,
    }
  }
  if (ageHours < 72) {
    return {
      level: 'recent',
      label: `Recent: ${Math.round(ageHours / 24)} day${ageHours < 48 ? '' : 's'} ago`,
    }
  }
  return {
    level: 'stale',
    label: `Stale: ${Math.round(ageHours / 24)} days ago`,
  }
}

export const getBenchmarkConfidence = (
  result: LocalBenchmarkResult | null | undefined,
  now = Date.now(),
): EstimatorConfidence => {
  if (!result) return 'low'

  const freshness = getBenchmarkFreshness(result, now).level
  const stored = result.confidence

  if (stored === 'high' && freshness === 'fresh') return 'high'
  if (stored === 'high' && freshness === 'recent') return 'medium'
  if (stored === 'medium' && freshness !== 'stale') return 'medium'
  if (result.source === 'synthetic' && freshness === 'fresh') return 'medium'
  return 'low'
}

export const getPreferredBenchmarkResult = (
  results: StoredBenchmarkResults,
  runtimePreference: 'ollama' | 'lmstudio' | 'llamacpp',
): LocalBenchmarkResult | null => {
  if (runtimePreference === 'ollama' && results.ollama) return results.ollama
  if (runtimePreference === 'lmstudio' && results.lmstudio) return results.lmstudio
  return results.synthetic || null
}

export const getCalibrationMultiplier = (
  result: LocalBenchmarkResult | null | undefined,
) => result?.suggestedMultiplier || 1

const getBenchmarkExplanation = (
  benchmarkResult: LocalBenchmarkResult | null | undefined,
): string | null => {
  if (!benchmarkResult) return null
  const freshness = getBenchmarkFreshness(benchmarkResult).label
  if (benchmarkResult.source === 'synthetic') {
    return `Adjusted with a synthetic local benchmark. ${freshness}.`
  }
  return `Adjusted with a real ${benchmarkResult.source === 'ollama' ? 'Ollama' : 'LM Studio'} runtime benchmark. ${freshness}.`
}

export const estimatePerformanceRange = ({
  paramsB,
  quant,
  contextTokens,
  profile,
  chipMultiplier = 1,
  calibrationMultiplier = 1,
  benchmarkResult,
}: EstimationInput): PerformanceEstimate => {
  if (!paramsB || paramsB <= 0) {
    return {
      expectedTokPerSec: null,
      conservativeTokPerSec: null,
      firstTokenLatencyMs: null,
      confidence: 'low',
      explanation: 'Missing parameter count. Add parameter metadata to estimate speed.',
    }
  }

  const base = tierBaseSpeed(profile.performanceTier)
  const quantFactor = quant ? QUANT_FACTORS[quant] || 1 : 1
  const sizeFactor = clamp(7 / paramsB, 0.05, 8)
  const contextPenalty = clamp(4096 / Math.max(1024, contextTokens), 0.45, 1.12)
  const webgpuFactor = profile.system.webgpu ? 1.18 : 0.92
  const graphicsFactor = profile.graphicsProbeScore === null
    ? 1
    : clamp(profile.graphicsProbeScore / 1.4, 0.8, 1.35)

  const expected = clamp(
    base *
      quantFactor *
      sizeFactor *
      contextPenalty *
      webgpuFactor *
      graphicsFactor *
      chipMultiplier *
      calibrationMultiplier,
    0.15,
    220,
  )

  const hardwareConfidence = getHardwareConfidence(profile, paramsB)
  const benchmarkConfidence = getBenchmarkConfidence(benchmarkResult)
  const confidence =
    benchmarkConfidence === 'high'
      ? 'high'
      : benchmarkConfidence === 'medium'
        ? hardwareConfidence === 'low'
          ? 'medium'
          : hardwareConfidence
        : hardwareConfidence

  const uncertainty = confidence === 'high' ? 0.16 : confidence === 'medium' ? 0.28 : 0.45
  const conservative = clamp(expected * (1 - uncertainty), 0.1, expected)
  const firstTokenLatencyMs = clamp(700 + (paramsB * 120) / Math.max(0.5, expected), 120, 12000)
  const benchmarkExplanation = getBenchmarkExplanation(benchmarkResult)

  return {
    expectedTokPerSec: Number(expected.toFixed(1)),
    conservativeTokPerSec: Number(conservative.toFixed(1)),
    firstTokenLatencyMs: Math.round(firstTokenLatencyMs),
    confidence,
    explanation:
      benchmarkExplanation ||
      (confidence === 'high'
        ? 'Measured signals and device metadata are aligned.'
        : confidence === 'medium'
          ? 'Estimate is based on partial browser hardware details.'
          : 'Estimate uses fallback heuristics because hardware metadata is limited.'),
  }
}

export const formatSpeedRange = (
  expectedTokPerSec: number | null,
  conservativeTokPerSec: number | null,
): string => {
  if (expectedTokPerSec === null || conservativeTokPerSec === null) return '--'
  return `~${conservativeTokPerSec.toFixed(1)}-${expectedTokPerSec.toFixed(1)} tok/s`
}

export const createRuntimeBenchmarkResult = ({
  runtime,
  benchmarkModel,
  benchmarkParamsB,
  benchmarkQuant,
  shortPrompt,
  prefillPrompt,
  profile,
  chipMultiplier = 1,
  notes,
}: RuntimeBenchmarkResultInput): LocalBenchmarkResult => {
  const baselineEstimate = estimatePerformanceRange({
    paramsB: benchmarkParamsB,
    quant: benchmarkQuant,
    contextTokens: Math.max(1024, shortPrompt.promptTokens || 1024),
    profile,
    chipMultiplier,
    calibrationMultiplier: 1,
  })

  const actualDecode = shortPrompt.decodeTokensPerSecond || 0
  const baselineDecode = baselineEstimate.expectedTokPerSec || 1
  const throughputRatio = actualDecode > 0 ? actualDecode / baselineDecode : 1
  const latencyRatio =
    shortPrompt.firstTokenLatencyMs && baselineEstimate.firstTokenLatencyMs
      ? baselineEstimate.firstTokenLatencyMs / shortPrompt.firstTokenLatencyMs
      : 1
  const prefillRatio =
    prefillPrompt.prefillTokensPerSecond && shortPrompt.prefillTokensPerSecond
      ? prefillPrompt.prefillTokensPerSecond / shortPrompt.prefillTokensPerSecond
      : 1

  const combinedRatio = clamp(
    throughputRatio * 0.72 + latencyRatio * 0.2 + prefillRatio * 0.08,
    0.6,
    1.9,
  )

  const confidence: EstimatorConfidence =
    actualDecode >= 18 && (shortPrompt.firstTokenLatencyMs || 0) <= 2500
      ? 'high'
      : actualDecode >= 8
        ? 'medium'
        : 'low'

  return {
    source: runtime,
    suggestedMultiplier: Number(combinedRatio.toFixed(3)),
    completedAtIso: new Date().toISOString(),
    confidence,
    benchmarkModel,
    benchmarkParamsB,
    benchmarkQuant,
    shortPrompt,
    prefillPrompt,
    notes,
  }
}

export const runLocalCalibrationBenchmark = async (): Promise<LocalBenchmarkResult> => {
  if (typeof performance === 'undefined') {
    return {
      source: 'synthetic',
      scoreOpsPerSec: 0,
      suggestedMultiplier: 1,
      completedAtIso: new Date().toISOString(),
      confidence: 'low',
      notes: 'Performance API unavailable.',
    }
  }

  const durationMs = 20_000
  const start = performance.now()
  let now = start
  let loops = 0
  let sink = 0

  while (now - start < durationMs) {
    const chunkStart = performance.now()
    while (performance.now() - chunkStart < 120) {
      for (let i = 0; i < 1500; i += 1) {
        const x = (i + loops) % 97
        sink += Math.sqrt(x * x + 3)
      }
      loops += 1
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 0)
    })
    now = performance.now()
  }

  const elapsedSec = Math.max(0.05, (now - start) / 1000)
  const scoreOpsPerSec = (loops * 1500) / elapsedSec + sink * 0
  const baseline = 8_200_000
  const suggestedMultiplier = clamp(scoreOpsPerSec / baseline, 0.75, 1.35)

  return {
    source: 'synthetic',
    scoreOpsPerSec: Number(scoreOpsPerSec.toFixed(0)),
    suggestedMultiplier: Number(suggestedMultiplier.toFixed(3)),
    completedAtIso: new Date().toISOString(),
    confidence: 'medium',
    notes: 'Synthetic browser CPU benchmark fallback.',
  }
}
