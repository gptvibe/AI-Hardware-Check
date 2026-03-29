import type { CompatibilityDetail, CompatibilityStatus, ModelDatabaseEntry } from './compatibility'
import type { BenchmarkSource, PerformanceEstimate, StoredBenchmarkResults } from './performanceEstimator'

export type QuantLevel = {
  key: 'fp16' | 'int8' | 'int4'
  label: string
  bytes: number
  blurb: string
}

export type RecommendationTone = 'good' | 'borderline' | 'bad' | 'unknown'

export type ChipProfile = {
  id: string
  label: string
  recommendedRamGb: number
  speedMultiplier: number
  note: string
}

export type ComputePreference = 'gpu-offload' | 'cpu-only'

export type HardwareConfidenceSummary = {
  level: 'high' | 'medium' | 'low'
  headline: string
  uncertainFields: string[]
}

export type HardwareConfidenceDetail = {
  label: string
  confidence: 'high' | 'medium' | 'low'
  source: string
  note: string
}

export type FamilyGroup = {
  name: string
  models: ModelDatabaseEntry[]
  sizes: string[]
}

export type ProviderGroup = {
  name: string
  families: FamilyGroup[]
  totalModels: number
}

export type CompatibilityFilter =
  | 'all'
  | 'can-run'
  | 'maybe'
  | 'cannot-run'
  | 'unknown'

export type RuntimeId = 'ollama' | 'lmstudio' | 'llamacpp'

export type CompanySummaryTone = CompatibilityFilter

export type CompanySummary = {
  provider: string
  total: number
  canRun: number
  maybe: number
  cannot: number
  tone: CompanySummaryTone
}

export type RunnablePreviewEntry = {
  model: ModelDatabaseEntry
  summary: CompatibilityStatus
}

export type RunnableModelList = {
  canRunCount: number
  maybeCount: number
  totalRunnable: number
  preview: RunnablePreviewEntry[]
}

export type RuntimeRecipe = {
  runtime: RuntimeId
  label: string
  command: string
}

export type UserGoal = 'chat' | 'coding' | 'vision' | 'offline' | 'api-server'

export type QualityPreference = 'best-quality' | 'balanced' | 'fastest'

export type RecommendationRiskLevel = 'low' | 'medium' | 'high'

export type RecommendationScoreBreakdown = {
  compatibility: number
  estimatedSpeed: number
  modalityMatch: number
  installSimplicity: number
  confidence: number
  recencyBonus: number
}

export type RankedRecommendation = {
  model: ModelDatabaseEntry
  recommendedQuant: string | null
  shortReason: string
  riskLevel: RecommendationRiskLevel
  installReadinessScore: number
  score: number
  breakdown: RecommendationScoreBreakdown
  runtimeRecipe: RuntimeRecipe | null
}

export type HomepageRecommendationCard = {
  title: string
  subtitle: string
  recommendation: RankedRecommendation | null
}

export type HomepageRecommendations = {
  cards: HomepageRecommendationCard[]
  primaryModel: ModelDatabaseEntry | null
  primaryRuntimeRecipes: RuntimeRecipe[]
}

export type GuidedRecommendation = {
  model: ModelDatabaseEntry | null
  runtimeRecipes: RuntimeRecipe[]
  topRecommendations: RankedRecommendation[]
}

export type HardwareReadinessTone = 'great' | 'good' | 'possible' | 'unlikely' | 'unknown'

export type HardwareReadiness = {
  label: string
  detail: string
  tone: HardwareReadinessTone
}

export type QuantRow = {
  key: string
  requirement: number | null
  status: CompatibilityStatus
  detail: CompatibilityDetail
  recommendation: {
    label: string
    tone: RecommendationTone
  }
  downloadUrl: string | null
  downloadHint: string
}

export type AddModelStatus = {
  type: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}

export type BenchmarkState = {
  runningTarget: BenchmarkSource | null
  results: StoredBenchmarkResults
  error: string | null
}

export type SelectedModelPerformance = PerformanceEstimate
