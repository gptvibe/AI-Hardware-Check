export const formatGb = (value: number) =>
  value >= 10 ? `${Math.round(value)} GB` : `${value.toFixed(1)} GB`

export const formatRam = (value: number | null) =>
  value === null ? 'Not reported' : formatGb(value)

export const formatRequirement = (value: number | null) =>
  value === null ? '--' : formatGb(value)

export const formatPerfLatency = (value: number | null) =>
  value === null ? '--' : `~${(value / 1000).toFixed(1)}s first token`

export const getConfidenceLabel = (score: number) => {
  if (score >= 80) return 'High confidence'
  if (score >= 60) return 'Medium confidence'
  return 'Low confidence'
}

export const parseParamCount = (value: string): number | null => {
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

export const parseReleaseDate = (value?: string): number | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return timestamp
}
