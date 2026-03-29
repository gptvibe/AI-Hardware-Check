import { getCompatibilityDetail, getCompatibilityStatus, type CompatibilityStatus, type ModelDatabaseEntry } from './compatibility'
import { QUANT_ORDER, RECOMMEND_ORDER } from './constants'
import { parseParamCount, parseReleaseDate } from './formatters'
import { getRuntimeRecipeCommand } from './installGuides'
import { estimatePerformanceRange } from './performanceEstimator'
import type { HardwareProfile } from './systemHardware'
import type {
  HomepageRecommendations,
  QualityPreference,
  RankedRecommendation,
  RecommendationRiskLevel,
  RecommendationScoreBreakdown,
  RuntimeId,
  RuntimeRecipe,
  UserGoal,
} from './types'

type RecommendationEngineInput = {
  models: ModelDatabaseEntry[]
  hardwareProfile: HardwareProfile
  runtimePreference: RuntimeId
  userGoal: UserGoal
  qualityPreference: QualityPreference
  confidenceScore: number
  chipMultiplier?: number
  calibrationMultiplier?: number
}

type HomepageRecommendationInput = Omit<RecommendationEngineInput, 'qualityPreference'>

const FASTEST_QUANT_ORDER = ['Q2_K', 'Q3_K_M', 'INT4', 'Q4_K_M', 'Q5_K_M', 'INT8', 'FP16']

const GOAL_MODALITY_MAP: Record<UserGoal, string[]> = {
  chat: ['Text'],
  coding: ['Text'],
  vision: ['Image'],
  offline: ['Text', 'Image', 'Audio', 'Video'],
  'api-server': ['Text'],
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const roundScore = (value: number) => Math.round(clamp(value, 0, 100))

export const getQuantPreferenceOrder = (qualityPreference: QualityPreference) => {
  if (qualityPreference === 'best-quality') {
    return RECOMMEND_ORDER
  }
  if (qualityPreference === 'fastest') {
    return FASTEST_QUANT_ORDER
  }
  return ['INT8', 'Q5_K_M', 'Q4_K_M', 'INT4', 'FP16', 'Q3_K_M', 'Q2_K']
}

const getQualityWeights = (qualityPreference: QualityPreference) => {
  if (qualityPreference === 'best-quality') {
    return {
      compatibility: 0.34,
      estimatedSpeed: 0.12,
      modalityMatch: 0.2,
      installSimplicity: 0.12,
      confidence: 0.12,
      recencyBonus: 0.1,
    }
  }
  if (qualityPreference === 'fastest') {
    return {
      compatibility: 0.28,
      estimatedSpeed: 0.28,
      modalityMatch: 0.18,
      installSimplicity: 0.14,
      confidence: 0.07,
      recencyBonus: 0.05,
    }
  }
  return {
    compatibility: 0.32,
    estimatedSpeed: 0.2,
    modalityMatch: 0.18,
    installSimplicity: 0.14,
    confidence: 0.1,
    recencyBonus: 0.06,
  }
}

const getCompatibilityScore = (status: CompatibilityStatus) => {
  switch (status) {
    case 'Can Run':
      return 100
    case 'Maybe':
      return 62
    case 'Unknown':
      return 36
    default:
      return 0
  }
}

export const getModalityMatchScore = (
  model: ModelDatabaseEntry,
  userGoal: UserGoal,
): number => {
  const modalities = model.modalities || ['Text']
  const requiredModalities = GOAL_MODALITY_MAP[userGoal]
  const hasRequired = requiredModalities.some((modality) => modalities.includes(modality))

  if (userGoal === 'vision') {
    return hasRequired ? 100 : 0
  }

  if (userGoal === 'coding') {
    const searchable = `${model.name} ${model.family || ''} ${model.notes || ''}`.toLowerCase()
    if (!modalities.includes('Text')) return 0
    if (/(code|coder|coding|program)/.test(searchable)) return 100
    if (/instruct/.test(searchable)) return 88
    return 78
  }

  if (userGoal === 'offline') {
    if (model.deployment === 'api') return 12
    return model.huggingface_repo ? 100 : 72
  }

  if (userGoal === 'api-server') {
    if (!modalities.includes('Text')) return 20
    return model.huggingface_repo ? 92 : 60
  }

  return hasRequired ? 92 : 25
}

export const getInstallSimplicityScore = (
  model: ModelDatabaseEntry,
  runtimePreference: RuntimeId,
  userGoal: UserGoal,
): number => {
  if (!model.huggingface_repo) return 8

  const runtimeRecipe = getRuntimeRecipeCommand(model, runtimePreference, 'Q4_K_M')
  const hasRuntimeTemplate = Boolean(model.runtime_recipe_templates?.[runtimePreference])

  let base =
    runtimePreference === 'ollama'
      ? 92
      : runtimePreference === 'lmstudio'
        ? 88
        : 72

  if (runtimeRecipe) base += 4
  if (hasRuntimeTemplate) base += 4

  if (userGoal === 'api-server') {
    if (runtimePreference === 'lmstudio') base -= 18
    if (runtimePreference === 'llamacpp') base += 8
    if (runtimePreference === 'ollama') base += 4
  }

  if (userGoal === 'offline' && model.deployment === 'api') {
    base = 5
  }

  return roundScore(base)
}

export const getRecencyScores = (models: ModelDatabaseEntry[]) => {
  const values = models.map((model, index) => parseReleaseDate(model.release_date) ?? index)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return new Map(
    models.map((model, index) => {
      const value = values[index]
      const score = max === min ? 50 : ((value - min) / (max - min)) * 100
      return [model.huggingface_repo || `${model.provider}:${model.name}`, roundScore(score)] as const
    }),
  )
}

export const getRecommendedQuantForPreference = ({
  model,
  hardwareProfile,
  qualityPreference,
}: {
  model: ModelDatabaseEntry
  hardwareProfile: HardwareProfile
  qualityPreference: QualityPreference
}) => {
  const order = getQuantPreferenceOrder(qualityPreference)
  const ramGb = hardwareProfile.system.ramGb
  const availableKeys = order.filter(
    (key) => typeof model.ram_requirements_gb[key] === 'number',
  )

  for (const key of availableKeys) {
    const status = getCompatibilityStatus(ramGb, model.ram_requirements_gb[key])
    if (status === 'Can Run') return key
  }
  for (const key of availableKeys) {
    const status = getCompatibilityStatus(ramGb, model.ram_requirements_gb[key])
    if (status === 'Maybe') return key
  }
  return availableKeys[0] || QUANT_ORDER.find((key) => typeof model.ram_requirements_gb[key] === 'number') || null
}

const getEstimatedSpeedScore = ({
  hardwareProfile,
  model,
  quant,
  chipMultiplier = 1,
  calibrationMultiplier = 1,
}: {
  hardwareProfile: HardwareProfile
  model: ModelDatabaseEntry
  quant: string | null
  chipMultiplier?: number
  calibrationMultiplier?: number
}) => {
  const paramsB = model.active_params_b ?? parseParamCount(model.parameter_count)
  const performance = estimatePerformanceRange({
    paramsB,
    quant,
    contextTokens: model.context_windows?.[0] || 4096,
    profile: hardwareProfile,
    chipMultiplier,
    calibrationMultiplier,
  })
  const conservative = performance.conservativeTokPerSec ?? 0
  const score = roundScore((conservative / 25) * 100)
  return { score, performance }
}

const getRiskLevel = ({
  compatibilityStatus,
  confidenceScore,
  installReadinessScore,
}: {
  compatibilityStatus: CompatibilityStatus
  confidenceScore: number
  installReadinessScore: number
}): RecommendationRiskLevel => {
  if (
    compatibilityStatus === 'Cannot Run' ||
    compatibilityStatus === 'Unknown' ||
    confidenceScore < 55 ||
    installReadinessScore < 45
  ) {
    return 'high'
  }
  if (compatibilityStatus === 'Maybe' || confidenceScore < 75 || installReadinessScore < 70) {
    return 'medium'
  }
  return 'low'
}

const getShortReason = ({
  compatibilityStatus,
  installSimplicity,
  modalityMatch,
  performanceScore,
  recommendedQuant,
  userGoal,
}: {
  compatibilityStatus: CompatibilityStatus
  installSimplicity: number
  modalityMatch: number
  performanceScore: number
  recommendedQuant: string | null
  userGoal: UserGoal
}) => {
  const fitLabel =
    compatibilityStatus === 'Can Run'
      ? 'fits comfortably'
      : compatibilityStatus === 'Maybe'
        ? 'should fit with tighter memory headroom'
        : compatibilityStatus === 'Unknown'
          ? 'has uncertain fit on this machine'
          : 'is risky for this machine'

  const modalityLabel =
    userGoal === 'vision'
      ? modalityMatch >= 100
        ? 'matches vision workloads'
        : 'is not ideal for vision tasks'
      : userGoal === 'coding'
        ? modalityMatch >= 95
          ? 'is tuned for coding-style prompts'
          : 'can still handle coding prompts'
        : performanceScore >= 70
          ? 'has strong local speed'
          : installSimplicity >= 85
            ? 'is simple to install'
            : 'balances fit and setup'

  return [recommendedQuant ? `${recommendedQuant} ${fitLabel}` : fitLabel, modalityLabel].join('; ')
}

export const rankModelsForMachine = ({
  models,
  hardwareProfile,
  runtimePreference,
  userGoal,
  qualityPreference,
  confidenceScore,
  chipMultiplier = 1,
  calibrationMultiplier = 1,
}: RecommendationEngineInput): RankedRecommendation[] => {
  const weights = getQualityWeights(qualityPreference)
  const recencyScores = getRecencyScores(models)
  const normalizedConfidence = roundScore(confidenceScore)

  return models
    .map((model) => {
      const recommendedQuant = getRecommendedQuantForPreference({
        model,
        hardwareProfile,
        qualityPreference,
      })

      const requirement =
        recommendedQuant && typeof model.ram_requirements_gb[recommendedQuant] === 'number'
          ? model.ram_requirements_gb[recommendedQuant]
          : null
      const compatibilityDetail = getCompatibilityDetail(
        hardwareProfile.system.ramGb,
        requirement,
      )
      const compatibilityScore = getCompatibilityScore(compatibilityDetail.status)
      const modalityMatch = getModalityMatchScore(model, userGoal)
      const installSimplicity = getInstallSimplicityScore(
        model,
        runtimePreference,
        userGoal,
      )
      const recencyBonus =
        recencyScores.get(model.huggingface_repo || `${model.provider}:${model.name}`) ?? 50
      const { score: estimatedSpeed, performance } = getEstimatedSpeedScore({
        hardwareProfile,
        model,
        quant: recommendedQuant,
        chipMultiplier,
        calibrationMultiplier,
      })
      const breakdown: RecommendationScoreBreakdown = {
        compatibility: compatibilityScore,
        estimatedSpeed,
        modalityMatch,
        installSimplicity,
        confidence: normalizedConfidence,
        recencyBonus,
      }

      const score = roundScore(
        breakdown.compatibility * weights.compatibility +
          breakdown.estimatedSpeed * weights.estimatedSpeed +
          breakdown.modalityMatch * weights.modalityMatch +
          breakdown.installSimplicity * weights.installSimplicity +
          breakdown.confidence * weights.confidence +
          breakdown.recencyBonus * weights.recencyBonus,
      )

      const installReadinessScore = roundScore(
        breakdown.installSimplicity * 0.55 +
          breakdown.compatibility * 0.3 +
          breakdown.confidence * 0.15,
      )

      const runtimeCommand =
        recommendedQuant && model.huggingface_repo
          ? getRuntimeRecipeCommand(model, runtimePreference, recommendedQuant)
          : null
      const runtimeRecipe: RuntimeRecipe | null = runtimeCommand
        ? {
            runtime: runtimePreference,
            label:
              runtimePreference === 'ollama'
                ? 'Ollama'
                : runtimePreference === 'lmstudio'
                  ? 'LM Studio'
                  : 'llama.cpp',
            command: runtimeCommand,
          }
        : null

      return {
        model,
        recommendedQuant,
        shortReason: getShortReason({
          compatibilityStatus: compatibilityDetail.status,
          installSimplicity,
          modalityMatch,
          performanceScore: performance.conservativeTokPerSec ?? estimatedSpeed,
          recommendedQuant,
          userGoal,
        }),
        riskLevel: getRiskLevel({
          compatibilityStatus: compatibilityDetail.status,
          confidenceScore: normalizedConfidence,
          installReadinessScore,
        }),
        installReadinessScore,
        score,
        breakdown,
        runtimeRecipe,
      } satisfies RankedRecommendation
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      if (a.installReadinessScore !== b.installReadinessScore) {
        return b.installReadinessScore - a.installReadinessScore
      }
      return a.model.name.localeCompare(b.model.name)
    })
}

const getUsableRecommendation = (
  recommendations: RankedRecommendation[],
  minimumSpeedScore: number,
) =>
  recommendations.find((entry) =>
    entry.breakdown.compatibility >= 62 &&
    entry.breakdown.estimatedSpeed >= minimumSpeedScore &&
    entry.riskLevel !== 'high',
  ) || recommendations.find((entry) => entry.breakdown.compatibility >= 62) || recommendations[0] || null

export const getHomepageRecommendations = ({
  models,
  hardwareProfile,
  runtimePreference,
  userGoal,
  confidenceScore,
  chipMultiplier = 1,
  calibrationMultiplier = 1,
}: HomepageRecommendationInput): HomepageRecommendations => {
  const bestOverall = getUsableRecommendation(
    rankModelsForMachine({
      models,
      hardwareProfile,
      runtimePreference,
      userGoal,
      qualityPreference: 'balanced',
      confidenceScore,
      chipMultiplier,
      calibrationMultiplier,
    }).filter((entry) => entry.breakdown.modalityMatch > 0 && entry.breakdown.compatibility > 0),
    18,
  )

  const fastestGoodOption = getUsableRecommendation(
    rankModelsForMachine({
      models,
      hardwareProfile,
      runtimePreference,
      userGoal,
      qualityPreference: 'fastest',
      confidenceScore,
      chipMultiplier,
      calibrationMultiplier,
    }).filter((entry) => entry.breakdown.modalityMatch > 0 && entry.breakdown.compatibility >= 62),
    24,
  )

  const bestQualityUsable = getUsableRecommendation(
    rankModelsForMachine({
      models,
      hardwareProfile,
      runtimePreference,
      userGoal,
      qualityPreference: 'best-quality',
      confidenceScore,
      chipMultiplier,
      calibrationMultiplier,
    }).filter((entry) => entry.breakdown.modalityMatch > 0 && entry.breakdown.compatibility >= 62),
    15,
  )

  const primaryRecommendation = bestOverall || fastestGoodOption || bestQualityUsable

  return {
    cards: [
      {
        title: 'Best overall for your machine',
        subtitle: 'Best balance of fit, speed, and setup.',
        recommendation: bestOverall,
      },
      {
        title: 'Fastest good option',
        subtitle: 'Prioritizes responsiveness without picking a clearly risky fit.',
        recommendation: fastestGoodOption,
      },
      {
        title: 'Best quality that still feels usable',
        subtitle: 'Pushes quality higher while keeping the experience practical.',
        recommendation: bestQualityUsable,
      },
    ],
    primaryModel: primaryRecommendation?.model || null,
    primaryRuntimeRecipes: primaryRecommendation?.runtimeRecipe
      ? [primaryRecommendation.runtimeRecipe]
      : [],
  }
}
