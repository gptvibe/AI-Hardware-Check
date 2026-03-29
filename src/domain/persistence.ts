import {
  BenchmarkResultSchema,
  StoredBenchmarkResultsSchema,
  UserAddedModelSchema,
} from './schemas'
import { normalizeModelEntry, type ModelDatabaseEntry } from './compatibility'
import type { LocalBenchmarkResult, StoredBenchmarkResults } from './performanceEstimator'

export const parseStoredUserAddedModels = (value: unknown): ModelDatabaseEntry[] => {
  const result = UserAddedModelSchema.array().safeParse(value)
  if (!result.success) return []
  return result.data.map(normalizeModelEntry)
}

export const parseStoredBenchmarkResult = (
  value: unknown,
): LocalBenchmarkResult | null => {
  const result = BenchmarkResultSchema.safeParse(value)
  if (!result.success) return null
  return result.data
}

export const parseStoredBenchmarkResults = (
  value: unknown,
): StoredBenchmarkResults => {
  const single = parseStoredBenchmarkResult(value)
  if (single) {
    return { [single.source]: single }
  }

  const result = StoredBenchmarkResultsSchema.safeParse(value)
  if (!result.success) return {}

  return Object.fromEntries(
    Object.entries(result.data).filter(([, entry]) => Boolean(entry)),
  ) as StoredBenchmarkResults
}
