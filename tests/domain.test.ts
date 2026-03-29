import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  applyComputePreference,
  buildShareableReport,
  classifyRuntimeDetection,
  createRuntimeBenchmarkResult,
  formatShareableReportMarkdown,
  formatShareableReportSummary,
  estimateRamRequirements,
  getBenchmarkConfidence,
  getBenchmarkFreshness,
  getComputePreferenceMultiplier,
  getCalibrationMultiplier,
  getCompatibilityStatus,
  getHardwareConfidenceSummary,
  getInstallWizardGuides,
  getInstallSimplicityScore,
  getModalityMatchScore,
  getPreferredBenchmarkResult,
  getReportHash,
  getRecommendedQuantForPreference,
  getRuntimeRecipeCommand,
  parseShareableReport,
  loadModelDatabase,
  normalizeModelEntry,
  normalizeHfRepoInput,
  parseParamCount,
  rankModelsForMachine,
  validateHfRepoId,
} from '../src/domain'

const createHardwareProfile = (ramGb: number) => ({
  system: {
    cpuCores: 10,
    ramGb,
    platform: 'TestOS',
    userAgent: 'test-agent',
    webgpu: true,
  },
  gpu: {
    renderer: 'Test GPU',
    vendor: 'Test Vendor',
    api: 'WebGL2' as const,
    available: true,
  },
  cpuCores: {
    value: 10,
    source: 'reported' as const,
    confidence: 'medium' as const,
    note: 'test',
  },
  ramGb: {
    value: ramGb,
    source: 'reported' as const,
    confidence: 'medium' as const,
    note: 'test',
  },
  webgpu: {
    value: true,
    source: 'reported' as const,
    confidence: 'high' as const,
    note: 'test',
  },
  gpuRenderer: {
    value: 'Test GPU',
    source: 'reported' as const,
    confidence: 'medium' as const,
    note: 'test',
  },
  graphicsProbeScore: 1.8,
  performanceTier: 'mainstream' as const,
  confidenceScore: 84,
  unresolved: [],
})

describe('parameter count parsing', () => {
  it('parses common parameter count strings', () => {
    expect(parseParamCount('7B')).toBe(7)
    expect(parseParamCount('500M')).toBe(0.5)
    expect(parseParamCount('1.2T')).toBe(1200)
    expect(parseParamCount('not-a-count')).toBeNull()
  })
})

describe('Hugging Face repo input normalization', () => {
  it('accepts repo IDs and full model URLs', () => {
    expect(normalizeHfRepoInput('mistralai/Voxtral-4B-TTS-2603')).toBe(
      'mistralai/Voxtral-4B-TTS-2603',
    )
    expect(
      normalizeHfRepoInput('https://huggingface.co/mistralai/Voxtral-4B-TTS-2603'),
    ).toBe('mistralai/Voxtral-4B-TTS-2603')
    expect(validateHfRepoId('https://example.com/mistralai/Voxtral-4B-TTS-2603')).toBe(
      false,
    )
  })
})

describe('RAM estimation', () => {
  it('estimates RAM requirements across quantizations', () => {
    const estimate = estimateRamRequirements('7B')

    expect(estimate.FP16).toBeCloseTo(14.88, 2)
    expect(estimate.INT8).toBeCloseTo(7.84, 2)
    expect(estimate.INT4).toBeCloseTo(4.32, 2)
    expect(estimate.FP16).toBeGreaterThan(estimate.INT8)
    expect(estimate.INT8).toBeGreaterThan(estimate.INT4)
  })
})

describe('compatibility status', () => {
  it('returns expected status tiers', () => {
    expect(getCompatibilityStatus(16, 10)).toBe('Can Run')
    expect(getCompatibilityStatus(11, 10)).toBe('Maybe')
    expect(getCompatibilityStatus(9, 10)).toBe('Cannot Run')
    expect(getCompatibilityStatus(null, 10)).toBe('Unknown')
    expect(getCompatibilityStatus(16, null)).toBe('Unknown')
  })
})

describe('runtime recipe generation', () => {
  const model = normalizeModelEntry({
    name: 'Llama-3.1-8B-Instruct',
    provider: 'Meta',
    family: 'Llama',
    huggingface_repo: 'meta-llama/Llama-3.1-8B-Instruct',
    parameter_count: '8B',
    formats: ['FP16'],
    ram_requirements_gb: {},
    context_windows: [8192],
    runtime_recipe_templates: {
      ollama: 'ollama run hf.co/{repo}:{quant_tag}',
    },
  })

  it('uses custom runtime templates when available', () => {
    expect(getRuntimeRecipeCommand(model, 'ollama', 'Q4_K_M')).toBe(
      'ollama run hf.co/meta-llama/Llama-3.1-8B-Instruct:q4_k_m',
    )
  })

  it('falls back to built-in runtime recipes', () => {
    expect(getRuntimeRecipeCommand(model, 'llamacpp', 'Q4_K_M')).toBe(
      'llama-cli -hf meta-llama/Llama-3.1-8B-Instruct -ngl 999 -c 8192',
    )
  })
})

describe('install wizard generation', () => {
  const model = normalizeModelEntry({
    name: 'Llama-3.1-8B-Instruct',
    provider: 'Meta',
    family: 'Llama',
    huggingface_repo: 'meta-llama/Llama-3.1-8B-Instruct',
    parameter_count: '8B',
    formats: ['INT8', 'Q4_K_M'],
    ram_requirements_gb: {
      INT8: 10,
      Q4_K_M: 6,
    },
  })

  it('builds OS-specific runtime guides with safe defaults', () => {
    const guides = getInstallWizardGuides({
      model,
      quant: 'Q4_K_M',
    })

    expect(guides).toHaveLength(3)

    const windowsGuide = guides.find((guide) => guide.os === 'windows')
    const linuxGuide = guides.find((guide) => guide.os === 'linux')

    expect(windowsGuide?.runtimeGuides).toHaveLength(2)
    expect(
      windowsGuide?.runtimeGuides.find((guide) => guide.runtime === 'ollama')?.defaultPort,
    ).toBe(11434)
    expect(
      windowsGuide?.runtimeGuides.find((guide) => guide.runtime === 'lmstudio')?.defaultPort,
    ).toBe(1234)
    expect(
      windowsGuide?.runtimeGuides
        .find((guide) => guide.runtime === 'ollama')
        ?.scripts.some((script) => script.fileName === 'install-ollama.ps1'),
    ).toBe(true)
    expect(
      linuxGuide?.runtimeGuides
        .find((guide) => guide.runtime === 'lmstudio')
        ?.steps.find((step) => step.id === 'install')
        ?.command,
    ).toContain('curl -fsSL https://lmstudio.ai/install.sh | bash')
  })

  it('includes copy-all content and runtime-specific commands', () => {
    const guides = getInstallWizardGuides({
      model,
      quant: 'Q4_K_M',
    })
    const macGuide = guides.find((guide) => guide.os === 'macos')
    const ollamaGuide = macGuide?.runtimeGuides.find((guide) => guide.runtime === 'ollama')
    const lmStudioGuide = macGuide?.runtimeGuides.find((guide) => guide.runtime === 'lmstudio')

    expect(ollamaGuide?.copyAllText).toContain('Ollama setup for macOS')
    expect(ollamaGuide?.copyAllText).toContain('ollama pull hf.co/meta-llama/Llama-3.1-8B-Instruct:q4_k_m')
    expect(lmStudioGuide?.copyAllText).toContain('lms server start --port 1234')
    expect(lmStudioGuide?.scripts[0]?.fileName).toBe('lmstudio-quickstart.sh')
  })
})

describe('runtime detection classification', () => {
  it('classifies healthy, blocked, installed-not-running, and not-detected states', () => {
    expect(
      classifyRuntimeDetection({
        runtime: 'ollama',
        healthy: true,
        modelCount: 2,
      }).state,
    ).toBe('healthy')

    const blockedLmStudio = classifyRuntimeDetection({
      runtime: 'lmstudio',
      reachableWithoutCors: true,
    })
    expect(blockedLmStudio.state).toBe('blocked')
    expect(blockedLmStudio.help).toContain('enable CORS')

    expect(
      classifyRuntimeDetection({
        runtime: 'lmstudio',
        installedHint: true,
      }).state,
    ).toBe('installed-not-running')

    expect(
      classifyRuntimeDetection({
        runtime: 'ollama',
      }).state,
    ).toBe('not-detected')
  })
})

describe('benchmark calibration helpers', () => {
  const hardwareProfile = createHardwareProfile(16)

  it('builds runtime benchmark results and prefers runtime-specific calibration', () => {
    const result = createRuntimeBenchmarkResult({
      runtime: 'ollama',
      benchmarkModel: 'qwen2.5:0.5b',
      benchmarkParamsB: 0.5,
      benchmarkQuant: 'Q4_K_M',
      shortPrompt: {
        promptTokens: 14,
        completionTokens: 28,
        firstTokenLatencyMs: 620,
        decodeTokensPerSecond: 74,
        prefillTokensPerSecond: 210,
      },
      prefillPrompt: {
        promptTokens: 96,
        completionTokens: 8,
        firstTokenLatencyMs: 980,
        decodeTokensPerSecond: 68,
        prefillTokensPerSecond: 260,
      },
      profile: hardwareProfile,
      chipMultiplier: 1,
    })

    const preferred = getPreferredBenchmarkResult(
      {
        synthetic: {
          source: 'synthetic',
          scoreOpsPerSec: 9_000_000,
          suggestedMultiplier: 1.08,
          completedAtIso: '2026-03-28T10:00:00.000Z',
          confidence: 'medium',
        },
        ollama: result,
      },
      'ollama',
    )

    expect(result.suggestedMultiplier).toBeGreaterThanOrEqual(0.6)
    expect(preferred?.source).toBe('ollama')
    expect(getCalibrationMultiplier(preferred)).toBe(result.suggestedMultiplier)
  })

  it('reports benchmark freshness and degrades stale confidence', () => {
    const staleResult = {
      source: 'lmstudio' as const,
      suggestedMultiplier: 1.12,
      completedAtIso: '2026-03-20T00:00:00.000Z',
      confidence: 'high' as const,
    }

    expect(getBenchmarkFreshness(staleResult, Date.parse('2026-03-29T00:00:00.000Z')).level).toBe('stale')
    expect(getBenchmarkConfidence(staleResult, Date.parse('2026-03-29T00:00:00.000Z'))).toBe('low')
  })
})

describe('shareable report helpers', () => {
  const hardwareProfile = createHardwareProfile(16)
  const model = normalizeModelEntry({
    name: 'FriendlyChat-8B-Instruct',
    provider: 'Acme',
    family: 'FriendlyChat',
    huggingface_repo: 'acme/friendlychat-8b',
    parameter_count: '8B',
    modalities: ['Text'],
    formats: ['INT8', 'Q4_K_M'],
    ram_requirements_gb: {
      INT8: 10,
      Q4_K_M: 6,
    },
  })

  it('builds markdown and serializes a shareable report', () => {
    const topRecommendations = rankModelsForMachine({
      models: [model],
      hardwareProfile,
      runtimePreference: 'ollama',
      userGoal: 'chat',
      qualityPreference: 'balanced',
      confidenceScore: 84,
    })

    const report = buildShareableReport({
      benchmarkConfidence: 'medium',
      benchmarkFreshnessLabel: 'Fresh: less than 1 hour ago',
      benchmarkSource: 'synthetic',
      comparedModels: [model],
      computePreference: 'gpu-offload',
      confidenceSummary: {
        level: 'high',
        headline: 'Hardware signals line up well.',
        uncertainFields: [],
      },
      hardwareProfile,
      runtimePreference: 'ollama',
      selectedGoal: 'chat',
      selectedInstallModel: model,
      selectedInstallQuant: 'Q4_K_M',
      topRecommendations: [
        {
          slot: 'Best overall for your machine',
          recommendation: topRecommendations[0] || null,
        },
      ],
    })

    expect(formatShareableReportSummary(report)).toContain('Top recommendations')
    expect(formatShareableReportMarkdown(report)).toContain('## Install Steps')
    expect(parseShareableReport(getReportHash(report).slice('#report='.length))?.selectedRuntime).toBe('ollama')
  })
})

describe('recommendation engine', () => {
  const hardwareProfile = createHardwareProfile(16)
  const codingModel = normalizeModelEntry({
    name: 'DeepCoder-7B',
    provider: 'Acme',
    family: 'DeepCoder',
    huggingface_repo: 'acme/deepcoder-7b',
    parameter_count: '7B',
    modalities: ['Text'],
    formats: ['INT8', 'Q4_K_M'],
    ram_requirements_gb: {
      INT8: 8,
      Q4_K_M: 5,
    },
    notes: 'Strong coding model.',
    release_date: '2026-01-10',
    runtime_recipe_templates: {
      ollama: 'ollama run hf.co/{repo}:{quant_tag}',
    },
  })
  const chatModel = normalizeModelEntry({
    name: 'FriendlyChat-8B-Instruct',
    provider: 'Acme',
    family: 'FriendlyChat',
    huggingface_repo: 'acme/friendlychat-8b',
    parameter_count: '8B',
    modalities: ['Text'],
    formats: ['INT8', 'Q4_K_M'],
    ram_requirements_gb: {
      INT8: 10,
      Q4_K_M: 6,
    },
    notes: 'Helpful general chat model.',
    release_date: '2026-02-14',
  })
  const visionModel = normalizeModelEntry({
    name: 'VisionPro-11B',
    provider: 'Acme',
    family: 'VisionPro',
    huggingface_repo: 'acme/visionpro-11b',
    parameter_count: '11B',
    modalities: ['Text', 'Image'],
    formats: ['Q4_K_M'],
    ram_requirements_gb: {
      Q4_K_M: 9,
    },
    notes: 'Vision-capable multimodal model.',
    release_date: '2026-03-01',
  })

  it('ranks models by goal, runtime, and quality preference', () => {
    const recommendations = rankModelsForMachine({
      models: [chatModel, codingModel, visionModel],
      hardwareProfile,
      runtimePreference: 'ollama',
      userGoal: 'coding',
      qualityPreference: 'balanced',
      confidenceScore: 84,
    })

    expect(recommendations).toHaveLength(3)
    expect(recommendations[0].model.name).toBe('DeepCoder-7B')
    expect(recommendations[0].recommendedQuant).toBe('INT8')
    expect(recommendations[0].runtimeRecipe?.runtime).toBe('ollama')
    expect(recommendations[0].installReadinessScore).toBeGreaterThanOrEqual(80)
  })

  it('prefers multimodal models for vision and exposes pure scoring helpers', () => {
    const recommendations = rankModelsForMachine({
      models: [chatModel, codingModel, visionModel],
      hardwareProfile,
      runtimePreference: 'lmstudio',
      userGoal: 'vision',
      qualityPreference: 'best-quality',
      confidenceScore: 84,
    })

    expect(recommendations[0].model.name).toBe('VisionPro-11B')
    expect(getModalityMatchScore(visionModel, 'vision')).toBe(100)
    expect(getInstallSimplicityScore(visionModel, 'lmstudio', 'vision')).toBeGreaterThan(80)
    expect(
      getRecommendedQuantForPreference({
        model: visionModel,
        hardwareProfile,
        qualityPreference: 'best-quality',
      }),
    ).toBe('INT8')
  })
})

describe('catalog validation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects invalid catalog entries with a friendly error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ provider: 'Meta', parameter_count: '8B' }],
      }),
    )

    await expect(loadModelDatabase()).rejects.toThrow(
      /Model catalog contains invalid entries/i,
    )
  })
})

describe('hardware confidence corrections', () => {
  it('summarizes uncertain hardware fields and applies CPU-only preference', () => {
    const mediumConfidenceProfile = {
      ...createHardwareProfile(8),
      confidenceScore: 64,
      ramGb: {
        value: null,
        source: 'unknown' as const,
        confidence: 'low' as const,
        note: 'Browser did not expose device memory.',
      },
      gpuRenderer: {
        value: 'Not detected',
        source: 'unknown' as const,
        confidence: 'low' as const,
        note: 'Renderer was hidden.',
      },
    }

    const summary = getHardwareConfidenceSummary(mediumConfidenceProfile)
    const cpuOnlyProfile = applyComputePreference(mediumConfidenceProfile, 'cpu-only')

    expect(summary.level).toBe('medium')
    expect(summary.uncertainFields).toContain('System RAM')
    expect(summary.uncertainFields).toContain('GPU renderer')
    expect(cpuOnlyProfile.system.webgpu).toBe(false)
    expect(getComputePreferenceMultiplier('cpu-only')).toBeLessThan(1)
  })
})
