import type { HardwareProfile } from './systemHardware'

export type EstimatorConfidence = 'high' | 'medium' | 'low'

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
}

export type LocalBenchmarkResult = {
  scoreOpsPerSec: number
  suggestedMultiplier: number
  completedAtIso: string
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

const getConfidence = (profile: HardwareProfile, paramsB: number | null): EstimatorConfidence => {
  if (paramsB === null) return 'low'
  if (profile.confidenceScore >= 80) return 'high'
  if (profile.confidenceScore >= 60) return 'medium'
  return 'low'
}

export const estimatePerformanceRange = ({
  paramsB,
  quant,
  contextTokens,
  profile,
  chipMultiplier = 1,
  calibrationMultiplier = 1,
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

  const confidence = getConfidence(profile, paramsB)
  const uncertainty = confidence === 'high' ? 0.18 : confidence === 'medium' ? 0.3 : 0.45
  const conservative = clamp(expected * (1 - uncertainty), 0.1, expected)
  const firstTokenLatencyMs = clamp(700 + (paramsB * 120) / Math.max(0.5, expected), 120, 12000)

  return {
    expectedTokPerSec: Number(expected.toFixed(1)),
    conservativeTokPerSec: Number(conservative.toFixed(1)),
    firstTokenLatencyMs: Math.round(firstTokenLatencyMs),
    confidence,
    explanation:
      confidence === 'high'
        ? 'Measured signals and device metadata are aligned.'
        : confidence === 'medium'
          ? 'Estimate is based on partial browser hardware details.'
          : 'Estimate uses fallback heuristics because hardware metadata is limited.',
  }
}

export const formatSpeedRange = (
  expectedTokPerSec: number | null,
  conservativeTokPerSec: number | null,
): string => {
  if (expectedTokPerSec === null || conservativeTokPerSec === null) return '--'
  return `~${conservativeTokPerSec.toFixed(1)}-${expectedTokPerSec.toFixed(1)} tok/s`
}

export const runLocalCalibrationBenchmark = async (): Promise<LocalBenchmarkResult> => {
  if (typeof performance === 'undefined') {
    return {
      scoreOpsPerSec: 0,
      suggestedMultiplier: 1,
      completedAtIso: new Date().toISOString(),
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
    scoreOpsPerSec: Number(scoreOpsPerSec.toFixed(0)),
    suggestedMultiplier: Number(suggestedMultiplier.toFixed(3)),
    completedAtIso: new Date().toISOString(),
  }
}
