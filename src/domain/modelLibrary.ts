import {
  getCompatibilityStatus,
  type CompatibilityStatus,
  type ModelDatabaseEntry,
} from './compatibility'
import { MODALITY_ORDER, PROVIDER_ORDER, QUANT_ORDER } from './constants'
import { parseParamCount, parseReleaseDate } from './formatters'
import type {
  CompanySummary,
  CompatibilityFilter,
  ProviderGroup,
  RunnableModelList,
} from './types'

export const getFamilyName = (model: ModelDatabaseEntry) => model.family || model.name

export const getFamilyKey = (model: ModelDatabaseEntry) =>
  `${model.provider || 'Other'}::${getFamilyName(model)}`

export const getModelId = (model: ModelDatabaseEntry) =>
  model.huggingface_repo || model.name

export const getCompatibilitySummary = (
  model: ModelDatabaseEntry,
  systemRamGb: number | null,
): CompatibilityStatus => {
  const keys = QUANT_ORDER.filter(
    (key) => typeof model.ram_requirements_gb[key] === 'number',
  )
  if (keys.length === 0) return 'Unknown'

  let hasMaybe = false
  let hasCannot = false

  for (const key of keys) {
    const requirement = model.ram_requirements_gb[key]
    const status = getCompatibilityStatus(systemRamGb, requirement)
    if (status === 'Can Run') return 'Can Run'
    if (status === 'Maybe') hasMaybe = true
    if (status === 'Cannot Run') hasCannot = true
  }

  if (hasMaybe) return 'Maybe'
  if (hasCannot) return 'Cannot Run'
  return 'Unknown'
}

export const matchesCompatibilityFilter = (
  status: CompatibilityStatus,
  filter: CompatibilityFilter,
) => {
  switch (filter) {
    case 'can-run':
      return status === 'Can Run'
    case 'maybe':
      return status === 'Maybe'
    case 'cannot-run':
      return status === 'Cannot Run'
    case 'unknown':
      return status === 'Unknown'
    default:
      return true
  }
}

export const getSearchableText = (model: ModelDatabaseEntry) =>
  [
    model.name,
    model.provider,
    model.family,
    model.parameter_count,
    model.huggingface_repo,
    ...(model.modalities || ['Text']),
    ...(model.formats || []),
    model.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

export const getProviderOptions = (models: ModelDatabaseEntry[]) => {
  const providerSet = new Set(models.map((model) => model.provider || 'Other'))
  const extraProviders = [...providerSet].filter(
    (provider) => !PROVIDER_ORDER.includes(provider),
  )
  extraProviders.sort()
  return [...PROVIDER_ORDER, ...extraProviders].filter((provider) =>
    providerSet.has(provider),
  )
}

export const getModalityOptions = (models: ModelDatabaseEntry[]) => {
  const modalitySet = new Set<string>()
  for (const model of models) {
    for (const modality of model.modalities || ['Text']) {
      modalitySet.add(modality)
    }
  }
  const extraModalities = [...modalitySet].filter(
    (modality) => !MODALITY_ORDER.includes(modality),
  )
  extraModalities.sort()
  return [...MODALITY_ORDER, ...extraModalities].filter((modality) =>
    modalitySet.has(modality),
  )
}

export const getCompanyFilteredModels = ({
  allModels,
  compatibilityById,
  compatibilityFilter,
  modalityFilter,
  normalizedSearchQuery,
}: {
  allModels: ModelDatabaseEntry[]
  compatibilityById: Map<string, CompatibilityStatus>
  compatibilityFilter: CompatibilityFilter
  modalityFilter: string
  normalizedSearchQuery: string
}) => {
  return allModels.filter((model) => {
    const summary = compatibilityById.get(getModelId(model)) || 'Unknown'
    const searchMatches =
      !normalizedSearchQuery ||
      getSearchableText(model).includes(normalizedSearchQuery)
    const compatibilityMatches = matchesCompatibilityFilter(
      summary,
      compatibilityFilter,
    )
    const modalityMatches =
      modalityFilter === 'all' ||
      (model.modalities || ['Text']).includes(modalityFilter)

    return searchMatches && compatibilityMatches && modalityMatches
  })
}

export const getFilteredModels = ({
  companyFilteredModels,
  compatibilityById,
  compatibilityFilter,
  providerFilter,
}: {
  companyFilteredModels: ModelDatabaseEntry[]
  compatibilityById: Map<string, CompatibilityStatus>
  compatibilityFilter: CompatibilityFilter
  providerFilter: string
}) => {
  return companyFilteredModels.filter((model) => {
    const summary = compatibilityById.get(getModelId(model)) || 'Unknown'
    const providerMatches =
      providerFilter === 'all' || (model.provider || 'Other') === providerFilter
    return providerMatches && matchesCompatibilityFilter(summary, compatibilityFilter)
  })
}

export const getCompanySummaries = ({
  companyFilteredModels,
  compatibilityById,
  providerOptions,
}: {
  companyFilteredModels: ModelDatabaseEntry[]
  compatibilityById: Map<string, CompatibilityStatus>
  providerOptions: string[]
}): CompanySummary[] => {
  const grouped = new Map<string, ModelDatabaseEntry[]>()
  for (const model of companyFilteredModels) {
    const provider = model.provider || 'Other'
    const list = grouped.get(provider) || []
    list.push(model)
    grouped.set(provider, list)
  }

  const providers = providerOptions.filter((provider) => grouped.has(provider))

  return providers.map((provider) => {
    const list = grouped.get(provider) || []
    let canRun = 0
    let maybe = 0
    let cannot = 0
    for (const model of list) {
      const status = compatibilityById.get(getModelId(model)) || 'Unknown'
      if (status === 'Can Run') canRun += 1
      else if (status === 'Maybe') maybe += 1
      else if (status === 'Cannot Run') cannot += 1
    }

    const tone = canRun > 0
      ? 'can-run'
      : maybe > 0
        ? 'maybe'
        : cannot > 0
          ? 'cannot-run'
          : 'unknown'

    return {
      provider,
      total: list.length,
      canRun,
      maybe,
      cannot,
      tone,
    }
  })
}

export const getModelGroups = (filteredModels: ModelDatabaseEntry[]): ProviderGroup[] => {
  const providerMap = new Map<string, Map<string, ModelDatabaseEntry[]>>()

  for (const model of filteredModels) {
    const provider = model.provider || 'Other'
    const family = getFamilyName(model)
    let familyMap = providerMap.get(provider)
    if (!familyMap) {
      familyMap = new Map<string, ModelDatabaseEntry[]>()
      providerMap.set(provider, familyMap)
    }
    const list = familyMap.get(family) || []
    list.push(model)
    familyMap.set(family, list)
  }

  for (const familyMap of providerMap.values()) {
    for (const list of familyMap.values()) {
      list.sort((a, b) => {
        const aCount = parseParamCount(a.parameter_count)
        const bCount = parseParamCount(b.parameter_count)
        if (aCount === null && bCount === null) return 0
        if (aCount === null) return 1
        if (bCount === null) return -1
        return aCount - bCount
      })
    }
  }

  const providerSet = new Set(providerMap.keys())
  const extraProviders = [...providerSet].filter(
    (provider) => !PROVIDER_ORDER.includes(provider),
  )
  extraProviders.sort()
  const providers = [...PROVIDER_ORDER, ...extraProviders].filter((provider) =>
    providerSet.has(provider),
  )

  return providers.map((provider) => {
    const familyMap =
      providerMap.get(provider) || new Map<string, ModelDatabaseEntry[]>()
    const families = [...familyMap.entries()].map(([familyName, list]) => {
      const sizeSet = new Set(list.map((item) => item.parameter_count))
      const sizes = [...sizeSet]
      sizes.sort((a, b) => {
        const aCount = parseParamCount(a)
        const bCount = parseParamCount(b)
        if (aCount === null && bCount === null) return a.localeCompare(b)
        if (aCount === null) return 1
        if (bCount === null) return -1
        return aCount - bCount
      })
      return { name: familyName, models: list, sizes }
    })

    families.sort((a, b) => {
      const aCount = parseParamCount(a.sizes[0] || '')
      const bCount = parseParamCount(b.sizes[0] || '')
      if (aCount === null && bCount === null) return a.name.localeCompare(b.name)
      if (aCount === null) return 1
      if (bCount === null) return -1
      return aCount - bCount
    })

    const totalModels = families.reduce(
      (sum, family) => sum + family.models.length,
      0,
    )

    return {
      name: provider,
      families,
      totalModels,
    }
  })
}

export const getRunnableModelList = ({
  allModels,
  filteredModels,
  compatibilityById,
}: {
  allModels: ModelDatabaseEntry[]
  filteredModels: ModelDatabaseEntry[]
  compatibilityById: Map<string, CompatibilityStatus>
}): RunnableModelList => {
  const recencyById = new Map<string, number>()
  for (let index = 0; index < allModels.length; index += 1) {
    const model = allModels[index]
    const id = getModelId(model)
    const releaseTimestamp = parseReleaseDate(model.release_date)
    recencyById.set(id, releaseTimestamp ?? index)
  }

  const scored = filteredModels
    .map((model) => {
      const summary = compatibilityById.get(getModelId(model)) || 'Unknown'
      const rank =
        summary === 'Can Run' ? 0 : summary === 'Maybe' ? 1 : Number.POSITIVE_INFINITY
      return {
        model,
        summary,
        rank,
        recency: recencyById.get(getModelId(model)) ?? -1,
      }
    })
    .filter((entry) => Number.isFinite(entry.rank))

  scored.sort((a, b) => {
    if (a.recency !== b.recency) return b.recency - a.recency
    if (a.rank !== b.rank) return a.rank - b.rank
    const aCount = parseParamCount(a.model.parameter_count)
    const bCount = parseParamCount(b.model.parameter_count)
    if (aCount === null && bCount === null) {
      return a.model.name.localeCompare(b.model.name)
    }
    if (aCount === null) return 1
    if (bCount === null) return -1
    return aCount - bCount
  })

  const canRunCount = scored.filter((entry) => entry.summary === 'Can Run').length
  const maybeCount = scored.filter((entry) => entry.summary === 'Maybe').length

  return {
    canRunCount,
    maybeCount,
    totalRunnable: scored.length,
    preview: scored.slice(0, 2),
  }
}

export const getFirstSelectableModel = ({
  compatibilityById,
  modelGroups,
}: {
  compatibilityById: Map<string, CompatibilityStatus>
  modelGroups: ProviderGroup[]
}) => {
  for (const provider of modelGroups) {
    for (const family of provider.families) {
      for (const model of family.models) {
        const summary = compatibilityById.get(getModelId(model)) || 'Unknown'
        if (summary !== 'Cannot Run') return model
      }
    }
  }

  for (const provider of modelGroups) {
    for (const family of provider.families) {
      if (family.models[0]) return family.models[0]
    }
  }

  return null
}
