import {
  getCompatibilityDetail,
  getCompatibilityStatus,
  type CompatibilityStatus,
  type ModelDatabaseEntry,
} from './compatibility'
import { QUANT_ORDER, RECOMMEND_ORDER } from './constants'
import { getQuantDownloadHint, getQuantDownloadUrl } from './installGuides'
import { rankModelsForMachine } from './recommendationEngine'
import type { HardwareProfile } from './systemHardware'
import type {
  GuidedRecommendation,
  QuantRow,
  QualityPreference,
  RecommendationTone,
  RuntimeId,
  RuntimeRecipe,
  UserGoal,
} from './types'

export const getRecommendation = (
  status: CompatibilityStatus,
): { label: string; tone: RecommendationTone } => {
  switch (status) {
    case 'Can Run':
      return { label: 'Good', tone: 'good' }
    case 'Maybe':
      return { label: 'Borderline', tone: 'borderline' }
    case 'Cannot Run':
      return { label: 'Bad', tone: 'bad' }
    default:
      return { label: 'Unknown', tone: 'unknown' }
  }
}

export const getQuantRows = (
  selectedModel: ModelDatabaseEntry | null,
  effectiveRamGb: number | null,
): QuantRow[] => {
  if (!selectedModel) return []
  const keys = QUANT_ORDER.filter(
    (key) => typeof selectedModel.ram_requirements_gb[key] === 'number',
  )
  return keys.map((key) => {
    const rawRequirement = selectedModel.ram_requirements_gb[key]
    const requirement =
      typeof rawRequirement === 'number' ? rawRequirement : null
    const detail = getCompatibilityDetail(effectiveRamGb, requirement)
    const status = detail.status
    const recommendation = getRecommendation(status)
    return {
      key,
      requirement,
      status,
      detail,
      recommendation,
      downloadUrl: getQuantDownloadUrl(selectedModel, key),
      downloadHint: getQuantDownloadHint(key),
    }
  })
}

export const getRecommendedQuant = (
  selectedModel: ModelDatabaseEntry | null,
  effectiveRamGb: number | null,
) => {
  if (!selectedModel) return null
  const keys = RECOMMEND_ORDER.filter(
    (key) => typeof selectedModel.ram_requirements_gb[key] === 'number',
  )
  for (const key of keys) {
    const requirement = selectedModel.ram_requirements_gb[key]
    const status = getCompatibilityStatus(effectiveRamGb, requirement)
    if (status === 'Can Run') return key
  }
  for (const key of keys) {
    const requirement = selectedModel.ram_requirements_gb[key]
    const status = getCompatibilityStatus(effectiveRamGb, requirement)
    if (status === 'Maybe') return key
  }
  return null
}

export const getGuidedRecommendation = ({
  filteredModels,
  hardwareProfile,
  runtimePreference,
  userGoal,
  qualityPreference,
  confidenceScore,
  chipMultiplier = 1,
  calibrationMultiplier = 1,
}: {
  filteredModels: ModelDatabaseEntry[]
  hardwareProfile: HardwareProfile
  runtimePreference: RuntimeId
  userGoal: UserGoal
  qualityPreference: QualityPreference
  confidenceScore: number
  chipMultiplier?: number
  calibrationMultiplier?: number
}): GuidedRecommendation => {
  const topRecommendations = rankModelsForMachine({
    models: filteredModels,
    hardwareProfile,
    runtimePreference,
    userGoal,
    qualityPreference,
    confidenceScore,
    chipMultiplier,
    calibrationMultiplier,
  })
    .filter((entry) => entry.breakdown.compatibility > 0 && entry.breakdown.modalityMatch > 0)
    .slice(0, 3)

  const model = topRecommendations[0]?.model || null
  const runtimeRecipes: RuntimeRecipe[] = model
    ? ([topRecommendations[0]?.runtimeRecipe].filter(Boolean) as RuntimeRecipe[])
    : []

  return {
    model,
    runtimeRecipes,
    topRecommendations,
  }
}
