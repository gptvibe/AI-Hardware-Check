export type CompatibilityStatus = 'Can Run' | 'Maybe' | 'Cannot Run' | 'Unknown'

export type QuantizationKey = 'FP16' | 'INT8' | 'INT4'

export type ModelDatabaseEntry = {
  name: string
  provider: string
  family?: string
  release_date?: string
  deployment?: 'local' | 'api'
  huggingface_repo?: string
  quant_download_links?: Record<string, string>
  parameter_count: string
  modalities?: string[]
  formats: string[]
  ram_requirements_gb: Record<string, number>
  notes?: string
  active_params_b?: number
  context_windows?: number[]
  runtime_recipe_templates?: Partial<Record<'ollama' | 'lmstudio' | 'llamacpp', string>>
  userAdded?: boolean
}

export type QuantRequirement = {
  key: QuantizationKey
  requirementGb: number | null
}

export type CompatibilityResult = {
  best: QuantizationKey | null
  status: CompatibilityStatus
  perQuant: Record<QuantizationKey, CompatibilityStatus>
}

export type CompatibilityDetail = {
  status: CompatibilityStatus
  minimumGb: number | null
  recommendedGb: number | null
  headroomGb: number | null
  reason: string
}

export const RUNTIME_OVERHEAD = 1.3

const BYTES_PER_B_TO_GIB = 1_000_000_000 / (1024 ** 3)
const WEIGHT_OVERHEAD_FACTOR = 1.08
const CACHE_OVERHEAD_GB = 0.35
const RUNTIME_BASE_OVERHEAD_GB = 0.45

const QUANT_BYTES_PER_PARAM: Record<string, number> = {
  FP16: 2,
  INT8: 1,
  INT4: 0.5,
  Q5_K_M: 0.625,
  Q4_K_M: 0.5,
  Q3_K_M: 0.375,
  Q2_K: 0.25,
}

const QUANT_FORMAT_ORDER = ['FP16', 'INT8', 'Q5_K_M', 'Q4_K_M', 'INT4', 'Q3_K_M', 'Q2_K']

const parseParameterCount = (value: string): number | null => {
  const normalized = value.replace(/,/g, '').trim()
  const match = normalized.match(/([0-9.]+)\s*([bBmMtT])?/)
  if (!match) return null
  const num = Number.parseFloat(match[1])
  if (!Number.isFinite(num)) return null
  const unit = match[2]?.toLowerCase()
  if (unit === 'm') return num / 1000
  if (unit === 't') return num * 1000
  return num
}

const estimateRamRequirements = (parameterCount: string): Record<string, number> => {
  const paramsB = parseParameterCount(parameterCount)
  if (!paramsB) return {}
  const result: Record<string, number> = {}
  for (const [key, bytes] of Object.entries(QUANT_BYTES_PER_PARAM)) {
    const weightMemory = paramsB * bytes * BYTES_PER_B_TO_GIB * WEIGHT_OVERHEAD_FACTOR
    const required = weightMemory + CACHE_OVERHEAD_GB + RUNTIME_BASE_OVERHEAD_GB
    result[key] = Number(required.toFixed(2))
  }
  return result
}

export const getCompatibilityDetail = (
  systemRamGb: number | null,
  requirementGb: number | null,
): CompatibilityDetail => {
  if (requirementGb === null) {
    return {
      status: 'Unknown',
      minimumGb: null,
      recommendedGb: null,
      headroomGb: null,
      reason: 'No memory requirement data is available for this quantization.',
    }
  }

  const minimumGb = Number(requirementGb.toFixed(2))
  const recommendedGb = Number((requirementGb * RUNTIME_OVERHEAD).toFixed(2))

  if (systemRamGb === null) {
    return {
      status: 'Unknown',
      minimumGb,
      recommendedGb,
      headroomGb: null,
      reason: `Needs about ${minimumGb} GB minimum (${recommendedGb} GB recommended), but system RAM is unknown.`,
    }
  }

  const headroomGb = Number((systemRamGb - recommendedGb).toFixed(2))
  if (systemRamGb >= recommendedGb) {
    return {
      status: 'Can Run',
      minimumGb,
      recommendedGb,
      headroomGb,
      reason: `Estimated to run comfortably with ${Math.abs(headroomGb).toFixed(1)} GB headroom.`,
    }
  }

  if (systemRamGb >= minimumGb) {
    return {
      status: 'Maybe',
      minimumGb,
      recommendedGb,
      headroomGb,
      reason: `May run, but memory is tight. Recommended target is ${recommendedGb} GB.`,
    }
  }

  return {
    status: 'Cannot Run',
    minimumGb,
    recommendedGb,
    headroomGb,
    reason: `Likely out-of-memory. Needs at least ${minimumGb} GB before runtime overhead.`,
  }
}

export const getCompatibilityStatus = (
  systemRamGb: number | null,
  requirementGb: number | null,
): CompatibilityStatus => {
  return getCompatibilityDetail(systemRamGb, requirementGb).status
}

const ORDER: QuantizationKey[] = ['FP16', 'INT8', 'INT4']

export const evaluateCompatibility = (
  systemRamGb: number | null,
  requirements: QuantRequirement[],
): CompatibilityResult => {
  const perQuant: Record<QuantizationKey, CompatibilityStatus> = {
    FP16: 'Unknown',
    INT8: 'Unknown',
    INT4: 'Unknown',
  }

  for (const item of requirements) {
    perQuant[item.key] = getCompatibilityStatus(systemRamGb, item.requirementGb)
  }

  if (Object.values(perQuant).every((value) => value === 'Unknown')) {
    return { best: null, status: 'Unknown', perQuant }
  }

  if (systemRamGb === null) {
    return { best: null, status: 'Unknown', perQuant }
  }

  const canRun = ORDER.find((key) => perQuant[key] === 'Can Run') || null
  const maybe = ORDER.find((key) => perQuant[key] === 'Maybe') || null
  const best = canRun || maybe
  const status = best ? perQuant[best] : 'Cannot Run'

  return { best, status, perQuant }
}

export const normalizeModelEntry = (entry: ModelDatabaseEntry): ModelDatabaseEntry => {
  const deployment = entry.deployment === 'api' ? 'api' : 'local'
  const estimated = estimateRamRequirements(entry.parameter_count)
  const ramRequirements = {
    ...estimated,
    ...(entry.ram_requirements_gb || {}),
  }
  const declaredFormats = Array.isArray(entry.formats)
    ? entry.formats.filter((format) => typeof format === 'string' && format.trim())
    : []
  const quantFormats = QUANT_FORMAT_ORDER.filter(
    (format) => typeof ramRequirements[format] === 'number',
  )
  const hasQuantFormats = declaredFormats.some((format) =>
    quantFormats.includes(format),
  )
  const formats = hasQuantFormats
    ? declaredFormats
    : [...quantFormats, ...declaredFormats.filter((format) => !quantFormats.includes(format))]
  const quantDownloadLinks =
    entry.quant_download_links && typeof entry.quant_download_links === 'object'
      ? Object.fromEntries(
          Object.entries(entry.quant_download_links).filter(
            ([key, value]) => typeof key === 'string' && typeof value === 'string' && value.trim(),
          ),
        )
      : undefined
  const activeParams =
    typeof entry.active_params_b === 'number' && Number.isFinite(entry.active_params_b)
      ? Number(entry.active_params_b)
      : parseParameterCount(entry.parameter_count)
  const contextWindows = Array.isArray(entry.context_windows)
    ? entry.context_windows
      .filter((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
      .map((value) => Math.round(value))
      .sort((a, b) => a - b)
    : [4096]
  const runtimeRecipeTemplates =
    entry.runtime_recipe_templates && typeof entry.runtime_recipe_templates === 'object'
      ? {
          ollama:
            typeof entry.runtime_recipe_templates.ollama === 'string'
              ? entry.runtime_recipe_templates.ollama
              : undefined,
          lmstudio:
            typeof entry.runtime_recipe_templates.lmstudio === 'string'
              ? entry.runtime_recipe_templates.lmstudio
              : undefined,
          llamacpp:
            typeof entry.runtime_recipe_templates.llamacpp === 'string'
              ? entry.runtime_recipe_templates.llamacpp
              : undefined,
        }
      : undefined

  return {
    ...entry,
    provider: entry.provider || 'Other',
    family: entry.family || entry.name,
    deployment,
    modalities: Array.isArray(entry.modalities) && entry.modalities.length
      ? entry.modalities
      : ['Text'],
    formats,
    quant_download_links: quantDownloadLinks,
    active_params_b: activeParams === null ? undefined : Number(activeParams.toFixed(2)),
    context_windows: contextWindows.length ? contextWindows : [4096],
    runtime_recipe_templates: runtimeRecipeTemplates,
    ram_requirements_gb: ramRequirements,
  }
}

export const loadModelDatabase = async (): Promise<ModelDatabaseEntry[]> => {
  if (typeof fetch === 'undefined') return []
  const response = await fetch('/models.json', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load models.json (${response.status})`)
  }
  const data = (await response.json()) as ModelDatabaseEntry[]
  if (!Array.isArray(data)) return []
  return data.map(normalizeModelEntry)
}
