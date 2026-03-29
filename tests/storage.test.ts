import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  parseStoredBenchmarkResult,
  parseStoredBenchmarkResults,
  parseStoredUserAddedModels,
} from '../src/domain'
import { loadJsonStorage } from '../src/utils'

describe('persisted localStorage parsing fallbacks', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('drops malformed stored user models safely', () => {
    expect(parseStoredUserAddedModels([{ name: 'broken' }])).toEqual([])
    expect(parseStoredUserAddedModels('not-an-array')).toEqual([])
  })

  it('drops malformed benchmark results safely', () => {
    expect(parseStoredBenchmarkResult({ scoreOpsPerSec: 10 })).toBeNull()
    expect(parseStoredBenchmarkResult('broken')).toBeNull()
    expect(parseStoredBenchmarkResults('broken')).toEqual({})
  })

  it('upgrades a legacy single benchmark object into stored benchmark results', () => {
    expect(
      parseStoredBenchmarkResults({
        scoreOpsPerSec: 10,
        suggestedMultiplier: 1.05,
        completedAtIso: '2026-03-29T00:00:00.000Z',
      }),
    ).toEqual({
      synthetic: {
        source: 'synthetic',
        scoreOpsPerSec: 10,
        suggestedMultiplier: 1.05,
        completedAtIso: '2026-03-29T00:00:00.000Z',
      },
    })
  })

  it('returns null for malformed JSON in localStorage without throwing', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn().mockReturnValue('{bad json'),
        setItem: vi.fn(),
      },
    })

    expect(() => loadJsonStorage('bad-key', parseStoredBenchmarkResult)).not.toThrow()
    expect(loadJsonStorage('bad-key', parseStoredBenchmarkResult)).toBeNull()
  })
})
