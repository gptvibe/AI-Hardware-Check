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

export const RUNTIME_OVERHEAD = 1.3

const BYTES_PER_B_TO_GIB = 1_000_000_000 / (1024 ** 3)

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
    result[key] = Number((paramsB * bytes * BYTES_PER_B_TO_GIB).toFixed(2))
  }
  return result
}

export const getCompatibilityStatus = (
  systemRamGb: number | null,
  requirementGb: number | null,
): CompatibilityStatus => {
  if (systemRamGb === null || requirementGb === null) return 'Unknown'
  if (systemRamGb >= requirementGb * RUNTIME_OVERHEAD) return 'Can Run'
  if (systemRamGb >= requirementGb) return 'Maybe'
  return 'Cannot Run'
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
