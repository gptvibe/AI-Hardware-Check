import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  getCompatibilityStatus,
  loadModelDatabase,
  normalizeModelEntry,
  RUNTIME_OVERHEAD,
  type CompatibilityStatus,
  type ModelDatabaseEntry,
} from './lib/compatibility'
import {
  detectGpu,
  getDefaultGpuInfo,
  getSystemHardware,
  type GpuInfo,
  type SystemHardware,
} from './lib/systemHardware'

type QuantLevel = {
  key: 'fp16' | 'int8' | 'int4'
  label: string
  bytes: number
  blurb: string
}

type RecommendationTone = 'good' | 'borderline' | 'bad' | 'unknown'

type FamilyGroup = {
  name: string
  models: ModelDatabaseEntry[]
  sizes: string[]
}

type ProviderGroup = {
  name: string
  families: FamilyGroup[]
  totalModels: number
}

type CompatibilityFilter =
  | 'all'
  | 'can-run'
  | 'maybe'
  | 'cannot-run'
  | 'unknown'

const quantizationLevels: QuantLevel[] = [
  {
    key: 'fp16',
    label: 'FP16',
    bytes: 2,
    blurb: 'Highest quality and stability, largest memory footprint.',
  },
  {
    key: 'int8',
    label: 'INT8',
    bytes: 1,
    blurb: 'Balanced fidelity and speed for most local setups.',
  },
  {
    key: 'int4',
    label: 'INT4',
    bytes: 0.5,
    blurb: 'Smallest footprint, best for tight memory budgets.',
  },
]

const PROVIDER_ORDER = [
  'Meta',
  'OpenAI',
  'DeepSeek',
  'Z.ai',
  'MiniMax',
  'Mistral',
  'Alibaba',
  'Qwen',
  'Google',
  'Moonshot AI',
  'Microsoft',
  'THUDM',
  'Other',
]

const QUANT_ORDER = ['FP16', 'INT8', 'INT4', 'Q5_K_M', 'Q4_K_M', 'Q3_K_M', 'Q2_K']
const RECOMMEND_ORDER = [
  'FP16',
  'INT8',
  'Q5_K_M',
  'Q4_K_M',
  'INT4',
  'Q3_K_M',
  'Q2_K',
]

const THEME_KEY = 'aihc-theme'
const MODALITY_ORDER = ['Text', 'Image', 'Audio', 'Video']
const DIRECT_DOWNLOAD_FORMATS = new Set(['FP16', 'BF16', 'FP8', 'Safetensors'])

const USER_MODELS_KEY = 'aihc-user-models'

// Validates the org/model-name format; only safe URL characters allowed
const HF_REPO_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/

const HF_ORG_TO_PROVIDER: Record<string, string> = {
  'meta-llama': 'Meta',
  facebook: 'Meta',
  openai: 'OpenAI',
  'deepseek-ai': 'DeepSeek',
  mistralai: 'Mistral',
  google: 'Google',
  microsoft: 'Microsoft',
  qwen: 'Alibaba',
  'alibaba-nlp': 'Alibaba',
  zhipuai: 'Z.ai',
  THUDM: 'Z.ai',
  thudm: 'Z.ai',
  'minimax-ai': 'MiniMax',
  moonshotai: 'Moonshot AI',
  nvidia: 'NVIDIA',
  'baichuan-inc': 'Baichuan',
  lmsys: 'LMSYS',
  eleutherai: 'EleutherAI',
  stabilityai: 'Stability AI',
  tiiuae: 'TII UAE',
  nousresearch: 'Nous Research',
  anthropic: 'Anthropic',
  cohere: 'Cohere',
}

const PIPELINE_TAG_TO_MODALITIES: Record<string, string[]> = {
  'text-generation': ['Text'],
  'text2text-generation': ['Text'],
  'image-to-text': ['Image', 'Text'],
  'visual-question-answering': ['Image', 'Text'],
  'image-text-to-text': ['Image', 'Text'],
  'text-to-image': ['Image'],
  'automatic-speech-recognition': ['Audio'],
  'text-to-speech': ['Audio'],
  'audio-classification': ['Audio'],
  'video-classification': ['Video'],
  'text-to-video': ['Video'],
}

const compatibilityFilterLabels: Record<CompatibilityFilter, string> = {
  all: 'All fit states',
  'can-run': 'Can run',
  maybe: 'Maybe',
  'cannot-run': 'Cannot run',
  unknown: 'Unknown',
}

const formatGb = (value: number) =>
  value >= 10 ? `${Math.round(value)} GB` : `${value.toFixed(1)} GB`

const formatRam = (value: number | null) =>
  value === null ? 'Not reported' : formatGb(value)

const formatRequirement = (value: number | null) =>
  value === null ? '--' : formatGb(value)

const parseParamCount = (value: string): number | null => {
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

const parseReleaseDate = (value?: string): number | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return timestamp
}

const estimateTokensPerSec = (
  paramsB: number | null,
  hardware: SystemHardware,
): number | null => {
  if (!paramsB) return null
  const base = hardware.webgpu ? 22 : 11
  const sizeFactor = 7 / paramsB
  const ramFactor =
    hardware.ramGb === null ? 0.8 : Math.min(1.6, Math.sqrt(hardware.ramGb / 16))
  const cpuFactor =
    hardware.cpuCores === null
      ? 0.9
      : Math.min(1.4, Math.sqrt(hardware.cpuCores / 8))
  const raw = base * sizeFactor * ramFactor * cpuFactor
  return Math.min(80, Math.max(0.2, raw))
}

const formatTokensPerSec = (value: number | null) =>
  value === null ? '--' : `~${value.toFixed(1)} tok/s`

const getFamilyName = (model: ModelDatabaseEntry) => model.family || model.name

const getFamilyKey = (model: ModelDatabaseEntry) =>
  `${model.provider || 'Other'}::${getFamilyName(model)}`

const getModelId = (model: ModelDatabaseEntry) =>
  model.huggingface_repo || model.name

const getCompatibilitySummary = (
  model: ModelDatabaseEntry,
  hardware: SystemHardware,
): CompatibilityStatus => {
  const keys = QUANT_ORDER.filter(
    (key) => typeof model.ram_requirements_gb[key] === 'number',
  )
  if (keys.length === 0) return 'Unknown'

  let hasMaybe = false
  let hasCannot = false

  for (const key of keys) {
    const requirement = model.ram_requirements_gb[key]
    const status = getCompatibilityStatus(hardware.ramGb, requirement)
    if (status === 'Can Run') return 'Can Run'
    if (status === 'Maybe') hasMaybe = true
    if (status === 'Cannot Run') hasCannot = true
  }

  if (hasMaybe) return 'Maybe'
  if (hasCannot) return 'Cannot Run'
  return 'Unknown'
}

const getModelRepoUrl = (repo: string) => `https://huggingface.co/${repo}`

const getRepoModelSlug = (repo: string) => {
  const parts = repo.split('/')
  return parts[parts.length - 1] || repo
}

const getQuantDownloadUrl = (
  model: ModelDatabaseEntry,
  quant: string,
): string | null => {
  const explicitLink = model.quant_download_links?.[quant]
  if (explicitLink) return explicitLink

  if (!model.huggingface_repo) return null
  if (DIRECT_DOWNLOAD_FORMATS.has(quant)) {
    return getModelRepoUrl(model.huggingface_repo)
  }
  const modelSlug = getRepoModelSlug(model.huggingface_repo)
  const query = encodeURIComponent(`${modelSlug} ${quant}`)
  return `https://huggingface.co/models?search=${query}`
}

const getQuantDownloadHint = (quant: string) =>
  DIRECT_DOWNLOAD_FORMATS.has(quant) ? 'Official repo' : 'Search Hugging Face'

const matchesCompatibilityFilter = (
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

const getSearchableText = (model: ModelDatabaseEntry) =>
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

const getRecommendation = (
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

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme())
  const [gpuInfo, setGpuInfo] = useState<GpuInfo>(() => getDefaultGpuInfo())
  const hardware = useMemo<SystemHardware>(() => getSystemHardware(), [])
  const [models, setModels] = useState<ModelDatabaseEntry[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [copiedRepo, setCopiedRepo] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState('all')
  const [compatibilityFilter, setCompatibilityFilter] =
    useState<CompatibilityFilter>('all')
  const [modalityFilter, setModalityFilter] = useState('all')
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    () => new Set(),
  )
  const [userAddedModels, setUserAddedModels] = useState<ModelDatabaseEntry[]>(() => {
    try {
      const stored = window.localStorage.getItem(USER_MODELS_KEY)
      if (!stored) return []
      const parsed = JSON.parse(stored) as unknown
      if (!Array.isArray(parsed)) return []
      return (parsed as ModelDatabaseEntry[]).map(normalizeModelEntry)
    } catch {
      return []
    }
  })
  const [addModelInput, setAddModelInput] = useState('')
  const [addModelStatus, setAddModelStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error'
    message?: string
  }>({ type: 'idle' })
  const deferredSearchQuery = useDeferredValue(searchQuery)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    let active = true
    loadModelDatabase()
      .then((data) => {
        if (!active) return
        setModels(data)
        setModelsError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        const message =
          error instanceof Error ? error.message : 'Failed to load models.'
        setModelsError(message)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setGpuInfo(detectGpu())
  }, [])

  // Persist user-added models to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(USER_MODELS_KEY, JSON.stringify(userAddedModels))
    } catch { /* quota exceeded or unavailable */ }
  }, [userAddedModels])

  const allModels = useMemo(
    () => [...models, ...userAddedModels],
    [models, userAddedModels],
  )

  const compatibilityById = useMemo(() => {
    const map = new Map<string, CompatibilityStatus>()
    for (const model of allModels) {
      map.set(getModelId(model), getCompatibilitySummary(model, hardware))
    }
    return map
  }, [hardware, allModels])

  const providerOptions = useMemo(() => {
    const providerSet = new Set(allModels.map((model) => model.provider || 'Other'))
    const extraProviders = [...providerSet].filter(
      (provider) => !PROVIDER_ORDER.includes(provider),
    )
    extraProviders.sort()
    return [...PROVIDER_ORDER, ...extraProviders].filter((provider) =>
      providerSet.has(provider),
    )
  }, [allModels])

  const modalityOptions = useMemo(() => {
    const modalitySet = new Set<string>()
    for (const model of allModels) {
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
  }, [allModels])

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase()
  const hasManualFilters =
    normalizedSearchQuery.length > 0 ||
    providerFilter !== 'all' ||
    compatibilityFilter !== 'all' ||
    modalityFilter !== 'all'

  const filteredModels = useMemo(() => {
    return allModels.filter((model) => {
      const summary = compatibilityById.get(getModelId(model)) || 'Unknown'
      const searchMatches =
        !normalizedSearchQuery ||
        getSearchableText(model).includes(normalizedSearchQuery)
      const providerMatches =
        providerFilter === 'all' || (model.provider || 'Other') === providerFilter
      const compatibilityMatches = matchesCompatibilityFilter(
        summary,
        compatibilityFilter,
      )
      const modalityMatches =
        modalityFilter === 'all' ||
        (model.modalities || ['Text']).includes(modalityFilter)

      return (
        searchMatches &&
        providerMatches &&
        compatibilityMatches &&
        modalityMatches
      )
    })
  }, [
    compatibilityById,
    compatibilityFilter,
    modalityFilter,
    allModels,
    normalizedSearchQuery,
    providerFilter,
  ])

  const modelGroups = useMemo<ProviderGroup[]>(() => {
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
        const sizeSet = new Set(
          list.map((item: ModelDatabaseEntry) => item.parameter_count),
        )
        const sizes: string[] = [...sizeSet]
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
  }, [filteredModels])

  const runnableModelList = useMemo(() => {
    const recencyById = new Map<string, number>()
    for (let index = 0; index < allModels.length; index += 1) {
      const model = allModels[index]
      const id = getModelId(model)
      const releaseTimestamp = parseReleaseDate(model.release_date)
      // Prefer explicit release date, fallback to catalog order (later entries assumed newer).
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
  }, [compatibilityById, filteredModels, allModels])

  const firstModel = useMemo(() => {
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
  }, [compatibilityById, modelGroups])

  useEffect(() => {
    if (filteredModels.length === 0) {
      if (selectedModelId !== null) {
        setSelectedModelId(null)
      }
      return
    }

    if (
      selectedModelId &&
      filteredModels.some((model) => getModelId(model) === selectedModelId)
    ) {
      return
    }

    if (firstModel) {
      setSelectedModelId(getModelId(firstModel))
    }
  }, [filteredModels, firstModel, selectedModelId])

  const selectedModel = useMemo(() => {
    if (!selectedModelId) return firstModel
    return (
      filteredModels.find((model) => getModelId(model) === selectedModelId) || null
    )
  }, [filteredModels, firstModel, selectedModelId])

  useEffect(() => {
    if (!selectedModel) return
    const summary = compatibilityById.get(getModelId(selectedModel)) || 'Unknown'
    if (summary !== 'Cannot Run') return
    const key = getFamilyKey(selectedModel)
    setExpandedFamilies((current) => {
      if (current.has(key)) return current
      const next = new Set(current)
      next.add(key)
      return next
    })
  }, [compatibilityById, selectedModel])

  const handleCopyRepo = (repo: string) => {
    const setCopied = () => {
      setCopiedRepo(repo)
      window.setTimeout(() => {
        setCopiedRepo((current) => (current === repo ? null : current))
      }, 1500)
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(repo).then(setCopied).catch(() => {
        setCopiedRepo(null)
      })
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = repo
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      setCopied()
    } catch {
      setCopiedRepo(null)
    } finally {
      document.body.removeChild(textarea)
    }
  }

  const toggleFamily = (key: string) => {
    setExpandedFamilies((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const readiness = useMemo(() => {
    const memory = hardware.ramGb
    if (memory === null) {
      return {
        label: 'Unknown',
        detail: 'Browser did not report system RAM.',
        tone: 'unknown',
      }
    }

    if (memory >= 32) {
      return {
        label: 'Creator-grade',
        detail: 'Large 70B models in 4-bit are realistic.',
        tone: 'great',
      }
    }

    if (memory >= 16) {
      return {
        label: 'Pro',
        detail: '7B to 13B models in 8-bit fit comfortably.',
        tone: 'good',
      }
    }

    if (memory >= 8) {
      return {
        label: 'Everyday',
        detail: '3B to 7B models in 4-bit are likely.',
        tone: 'possible',
      }
    }

    return {
      label: 'Light',
      detail: 'Small models only.',
      tone: 'unlikely',
    }
  }, [hardware.ramGb])

  const readinessStyles: Record<string, string> = {
    great: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    good: 'bg-teal-100 text-teal-700 border border-teal-200',
    possible: 'bg-amber-100 text-amber-700 border border-amber-200',
    unlikely: 'bg-rose-100 text-rose-700 border border-rose-200',
    unknown: 'bg-slate-100 text-slate-600 border border-slate-200',
  }

  const compatibilityStyles: Record<string, string> = {
    'Can Run': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    Maybe: 'bg-amber-100 text-amber-700 border border-amber-200',
    'Cannot Run': 'bg-rose-100 text-rose-700 border border-rose-200',
    Unknown: 'bg-slate-100 text-slate-600 border border-slate-200',
  }

  const recommendationStyles: Record<RecommendationTone, string> = {
    good: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    borderline: 'bg-amber-100 text-amber-700 border border-amber-200',
    bad: 'bg-rose-100 text-rose-700 border border-rose-200',
    unknown: 'bg-slate-100 text-slate-600 border border-slate-200',
  }

  const quantRows = useMemo(() => {
    if (!selectedModel) return []
    const keys = QUANT_ORDER.filter(
      (key) => typeof selectedModel.ram_requirements_gb[key] === 'number',
    )
    return keys.map((key) => {
      const rawRequirement = selectedModel.ram_requirements_gb[key]
      const requirement =
        typeof rawRequirement === 'number' ? rawRequirement : null
      const status = getCompatibilityStatus(hardware.ramGb, requirement)
      const recommendation = getRecommendation(status)
      return {
        key,
        requirement,
        status,
        recommendation,
        downloadUrl: getQuantDownloadUrl(selectedModel, key),
        downloadHint: getQuantDownloadHint(key),
      }
    })
  }, [hardware.ramGb, selectedModel])

  const recommendedQuant = useMemo(() => {
    if (!selectedModel) return null
    const keys = RECOMMEND_ORDER.filter(
      (key) => typeof selectedModel.ram_requirements_gb[key] === 'number',
    )
    for (const key of keys) {
      const requirement = selectedModel.ram_requirements_gb[key]
      const status = getCompatibilityStatus(hardware.ramGb, requirement)
      if (status === 'Can Run') return key
    }
    for (const key of keys) {
      const requirement = selectedModel.ram_requirements_gb[key]
      const status = getCompatibilityStatus(hardware.ramGb, requirement)
      if (status === 'Maybe') return key
    }
    return null
  }, [hardware.ramGb, selectedModel])

  const selectedParamCount = selectedModel
    ? parseParamCount(selectedModel.parameter_count)
    : null
  const selectedTokens = selectedModel
    ? estimateTokensPerSec(selectedParamCount, hardware)
    : null
  const selectedSummary = selectedModel
    ? compatibilityById.get(getModelId(selectedModel)) || 'Unknown'
    : 'Unknown'

  const clearFilters = () => {
    setSearchQuery('')
    setProviderFilter('all')
    setCompatibilityFilter('all')
    setModalityFilter('all')
  }

  const fetchAndAddModel = async () => {
    const repoId = addModelInput.trim()
    if (!repoId) return

    if (!HF_REPO_PATTERN.test(repoId)) {
      setAddModelStatus({
        type: 'error',
        message: 'Use the format org/model-name — e.g. meta-llama/Llama-3.1-8B-Instruct',
      })
      return
    }

    if (allModels.some((m) => m.huggingface_repo === repoId)) {
      setAddModelStatus({ type: 'error', message: `${repoId} is already in the list.` })
      return
    }

    setAddModelStatus({ type: 'loading', message: 'Fetching model info from HuggingFace…' })

    try {
      const response = await fetch(`https://huggingface.co/api/models/${repoId}`)
      if (response.status === 404) {
        setAddModelStatus({ type: 'error', message: 'Model not found. Double-check the repo ID.' })
        return
      }
      if (response.status === 401 || response.status === 403) {
        setAddModelStatus({ type: 'error', message: 'Private model — only public repos are supported.' })
        return
      }
      if (!response.ok) {
        setAddModelStatus({ type: 'error', message: `HuggingFace returned an error (${response.status}).` })
        return
      }

      const data = await response.json() as {
        pipeline_tag?: string
        safetensors?: { total?: number }
      }

      const [org, ...rest] = repoId.split('/')
      const slug = rest.join('/')

      const provider =
        HF_ORG_TO_PROVIDER[org] ||
        HF_ORG_TO_PROVIDER[org.toLowerCase()] ||
        org.charAt(0).toUpperCase() + org.slice(1)

      let parameterCount = 'Unknown'
      const totalParams = data.safetensors?.total
      if (typeof totalParams === 'number' && totalParams > 0) {
        const paramsB = totalParams / 1e9
        if (paramsB >= 1000) {
          parameterCount = `${(paramsB / 1000).toFixed(1)}T`
        } else if (paramsB >= 10) {
          parameterCount = `${Math.round(paramsB)}B`
        } else if (paramsB >= 1) {
          parameterCount = `${paramsB.toFixed(1)}B`
        } else {
          parameterCount = `${Math.round(paramsB * 1000)}M`
        }
      } else {
        const sizeMatch = slug.match(/[-_](\d+\.?\d*)\s*([bBmMtT])\b/)
        if (sizeMatch) {
          parameterCount = `${sizeMatch[1]}${sizeMatch[2].toUpperCase()}`
        }
      }

      const modalities =
        (data.pipeline_tag && PIPELINE_TAG_TO_MODALITIES[data.pipeline_tag]) ||
        ['Text']

      const entry: ModelDatabaseEntry = {
        name: slug,
        provider,
        family: slug,
        huggingface_repo: repoId,
        parameter_count: parameterCount,
        modalities,
        formats: ['FP16', 'BF16', 'Safetensors'],
        ram_requirements_gb: {},
        userAdded: true,
      }

      const normalized = normalizeModelEntry(entry)
      setUserAddedModels((prev) => [...prev, normalized])
      setAddModelStatus({
        type: 'success',
        message: `Added ${slug} · ${parameterCount} · ${provider}`,
      })
      setAddModelInput('')
    } catch {
      setAddModelStatus({
        type: 'error',
        message: 'Failed to reach HuggingFace API. Check your connection.',
      })
    }
  }

  const removeUserModel = (model: ModelDatabaseEntry) => {
    const id = getModelId(model)
    setUserAddedModels((prev) => prev.filter((m) => getModelId(m) !== id))
  }

  return (
    <div className="app-shell">
      <div className="app-container mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
        <header className="reveal">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip">Browser only</span>
              <span className="chip">No uploads</span>
              <span className="chip">Open-source only</span>
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={() =>
                setTheme((current) => (current === 'light' ? 'dark' : 'light'))
              }
            >
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Theme
              </span>
              <span className="theme-pill">
                {theme === 'light' ? 'Light' : 'Dark'}
              </span>
            </button>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="display-title text-4xl font-semibold md:text-5xl lg:text-6xl">
                AI Hardware Check
              </h1>
              <p className="mt-4 text-base text-[color:var(--muted)] md:text-lg">
                Browse model families, estimate local performance, and pick the
                best quantization for your system in seconds.
              </p>
              <form
                className="add-model-bar mt-6"
                onSubmit={(event) => {
                  event.preventDefault()
                  void fetchAndAddModel()
                }}
              >
                <input
                  type="text"
                  className="add-model-input"
                  value={addModelInput}
                  onChange={(event) => {
                    setAddModelInput(event.target.value)
                    if (addModelStatus.type !== 'idle') setAddModelStatus({ type: 'idle' })
                  }}
                  placeholder="Add any model — paste a HuggingFace ID (e.g. meta-llama/Llama-3.1-8B-Instruct)"
                  disabled={addModelStatus.type === 'loading'}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                <button
                  type="submit"
                  className="add-model-btn"
                  disabled={addModelStatus.type === 'loading' || !addModelInput.trim()}
                >
                  {addModelStatus.type === 'loading' ? 'Adding…' : 'Add model'}
                </button>
              </form>
              {addModelStatus.type !== 'idle' && addModelStatus.message ? (
                <div className={`add-model-status add-model-status--${addModelStatus.type}`}>
                  {addModelStatus.message}
                </div>
              ) : null}
            </div>
            <div className="card p-5">
              <div className="runnable-header-row">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Runs on this system
                </div>
                <span className="text-xs text-[color:var(--muted)]">
                  Latest 2
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="status-pill bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Can Run: {runnableModelList.canRunCount}
                </span>
                <span className="status-pill bg-amber-100 text-amber-700 border border-amber-200">
                  Maybe: {runnableModelList.maybeCount}
                </span>
              </div>
              {runnableModelList.preview.length === 0 ? (
                <div className="empty-state mt-4">
                  No runnable models in the current filters.
                </div>
              ) : (
                <div className="runnable-list mt-4">
                  {runnableModelList.preview.map((entry) => {
                    const id = getModelId(entry.model)
                    const isActive = selectedModelId === id
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`runnable-item ${isActive ? 'active' : ''}`}
                        onClick={() => setSelectedModelId(id)}
                      >
                        <span className="runnable-name">{entry.model.name}</span>
                        <span className="runnable-meta">
                          {entry.model.parameter_count} · {entry.summary}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              {runnableModelList.totalRunnable > runnableModelList.preview.length ? (
                <p className="mt-3 text-xs text-[color:var(--muted)]">
                  Showing latest runnable models based on release date (or catalog order when date is missing).
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] xl:grid-cols-[minmax(0,1fr)_minmax(430px,520px)]">
          <div className="space-y-8">
            <section className="card p-6 reveal delay-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Model library</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Pick a model to see quantization fit and recommendations.
                  </p>
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Small to big
                </div>
              </div>
              <div className="library-toolbar mt-6">
                <label className="search-field">
                  <span className="toolbar-label">Search</span>
                  <input
                    type="search"
                    className="toolbar-input"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by model, family, provider, quant, or repo"
                  />
                </label>
                <label className="filter-field">
                  <span className="toolbar-label">Provider</span>
                  <select
                    className="toolbar-select"
                    value={providerFilter}
                    onChange={(event) => setProviderFilter(event.target.value)}
                  >
                    <option value="all">All providers</option>
                    {providerOptions.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="filter-field">
                  <span className="toolbar-label">Compatibility</span>
                  <select
                    className="toolbar-select"
                    value={compatibilityFilter}
                    onChange={(event) =>
                      setCompatibilityFilter(
                        event.target.value as CompatibilityFilter,
                      )
                    }
                  >
                    {Object.entries(compatibilityFilterLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="filter-field">
                  <span className="toolbar-label">Modality</span>
                  <select
                    className="toolbar-select"
                    value={modalityFilter}
                    onChange={(event) => setModalityFilter(event.target.value)}
                  >
                    <option value="all">All modalities</option>
                    {modalityOptions.map((modality) => (
                      <option key={modality} value={modality}>
                        {modality}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="toolbar-actions">
                  <span className="toolbar-summary">
                    {filteredModels.length} match
                    {filteredModels.length === 1 ? '' : 'es'}
                  </span>
                  <button
                    type="button"
                    className="family-toggle"
                    onClick={clearFilters}
                    disabled={!hasManualFilters}
                  >
                    Clear filters
                  </button>
                </div>
              </div>
              {modelsError ? (
                <div className="empty-state mt-6">{modelsError}</div>
              ) : filteredModels.length === 0 ? (
                <div className="empty-state mt-6">
                  No models match the current search and filters.
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {modelGroups.map((provider) => (
                    <div key={provider.name} className="provider-section">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="provider-title">{provider.name}</h3>
                        <span className="provider-count">
                          {provider.totalModels} models ·{' '}
                          {provider.families.length} families
                        </span>
                      </div>
                      {provider.families.length === 0 ? (
                        <div className="empty-state">
                          Add models in public/models.json.
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          {provider.families.map((family) => {
                            const familyKey = `${provider.name}::${family.name}`
                            const visibleModels = family.models.filter(
                              (model) =>
                                (compatibilityById.get(getModelId(model)) ||
                                  'Unknown') !== 'Cannot Run',
                            )
                            const hiddenModels = family.models.filter(
                              (model) =>
                                (compatibilityById.get(getModelId(model)) ||
                                  'Unknown') === 'Cannot Run',
                            )
                            const showAll = expandedFamilies.has(familyKey)
                            const modelsToShow = hasManualFilters
                              ? family.models
                              : showAll
                                ? family.models
                                : visibleModels

                            return (
                              <div key={familyKey} className="family-block">
                                <div className="family-header">
                                  <div>
                                    <div className="family-title">
                                      {family.name}
                                    </div>
                                    <div className="family-meta">
                                      Sizes: {family.sizes.join(', ')}
                                    </div>
                                  </div>
                                  <div className="family-actions">
                                    <span className="family-count">
                                      {modelsToShow.length} shown
                                    </span>
                                    {hiddenModels.length > 0 && !hasManualFilters ? (
                                      <button
                                        type="button"
                                        className="family-toggle"
                                        onClick={() => toggleFamily(familyKey)}
                                      >
                                        {showAll
                                          ? 'Hide unavailable'
                                          : `Show unavailable (${hiddenModels.length})`}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                                {modelsToShow.length === 0 ? (
                                  <div className="empty-state">
                                    No sizes fit this system. Show unavailable
                                    to view the full family.
                                  </div>
                                ) : (
                                  <div className="model-grid">
                                    {modelsToShow.map((model) => {
                                      const id = getModelId(model)
                                      const isActive = selectedModelId === id
                                      const paramsB = parseParamCount(
                                        model.parameter_count,
                                      )
                                      const tokens = estimateTokensPerSec(
                                        paramsB,
                                        hardware,
                                      )
                                      const summary =
                                        compatibilityById.get(id) || 'Unknown'
                                      const unavailable =
                                        summary === 'Cannot Run'

                                      return (
                                        <button
                                          key={id}
                                          type="button"
                                          className={`model-card ${isActive ? 'active' : ''} ${unavailable ? 'unavailable' : ''}`}
                                          onClick={() =>
                                            setSelectedModelId(id)
                                          }
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div>
                                              <div className="model-name">
                                                {model.name}
                                                {model.userAdded ? (
                                                  <span className="user-badge ml-1.5">Custom</span>
                                                ) : null}
                                              </div>
                                              <div className="model-meta">
                                        <span className="mono">
                                          {model.parameter_count}
                                        </span>
                                        {(model.modalities || ['Text']).map(
                                          (modality) => (
                                            <span
                                              key={`${id}-${modality}`}
                                              className="chip chip-compact"
                                            >
                                              {modality}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                            <span
                                              className={`status-pill ${compatibilityStyles[summary]}`}
                                            >
                                              {summary}
                                            </span>
                                          </div>
                                          <div className="model-stats">
                                            <span className="text-xs text-[color:var(--muted)]">
                                              Est. speed
                                            </span>
                                            <span className="mono">
                                              {formatTokensPerSec(tokens)}
                                            </span>
                                          </div>
                                          {model.notes ? (
                                            <div className="model-notes">
                                              {model.notes}
                                            </div>
                                          ) : null}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="card p-6 reveal delay-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">System hardware</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Collected locally from browser APIs only.
                  </p>
                </div>
                <span
                  className={`status-pill ${readinessStyles[readiness.tone]}`}
                >
                  {readiness.label}
                </span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="stat">
                  <div className="text-[11px] uppercase text-[color:var(--muted)]">
                    CPU Threads
                  </div>
                  <div className="text-2xl font-semibold">
                    {hardware.cpuCores || '--'}
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">
                    Hardware concurrency
                  </div>
                </div>
                <div className="stat">
                  <div className="text-[11px] uppercase text-[color:var(--muted)]">
                    System RAM
                  </div>
                  <div className="text-2xl font-semibold">
                    {formatRam(hardware.ramGb)}
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">
                    Device memory API
                  </div>
                </div>
                <div className="stat">
                  <div className="text-[11px] uppercase text-[color:var(--muted)]">
                    GPU Renderer
                  </div>
                  <div className="text-lg font-semibold" title={gpuInfo.renderer}>
                    {gpuInfo.renderer}
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">
                    {gpuInfo.vendor}
                  </div>
                </div>
                <div className="stat">
                  <div className="text-[11px] uppercase text-[color:var(--muted)]">
                    Graphics API
                  </div>
                  <div className="text-2xl font-semibold">{gpuInfo.api}</div>
                  <div className="text-xs text-[color:var(--muted)]">
                    WebGL detection
                  </div>
                </div>
                <div className="stat">
                  <div className="text-[11px] uppercase text-[color:var(--muted)]">
                    WebGPU
                  </div>
                  <div className="text-2xl font-semibold">
                    {hardware.webgpu ? 'Yes' : 'No'}
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">
                    GPU compute in browser
                  </div>
                </div>
                <div className="stat">
                  <div className="text-[11px] uppercase text-[color:var(--muted)]">
                    Platform
                  </div>
                  <div className="text-2xl font-semibold">
                    {hardware.platform}
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">
                    {gpuInfo.available ? 'GPU detected' : 'GPU not detected'}
                  </div>
                </div>
              </div>
              <p className="mt-5 text-xs text-[color:var(--muted)] mono break-all">
                User agent: {hardware.userAgent}
              </p>
            </section>

          </div>

          <aside className="detail-panel card card-strong p-5 sm:p-6 reveal delay-3 xl:sticky xl:top-8 h-fit">
            {selectedModel ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {selectedModel.provider}
                    </div>
                    <h3 className="mt-2 text-2xl font-semibold">
                      {selectedModel.name}
                    </h3>
                    {selectedModel.notes ? (
                      <p className="mt-2 text-sm text-[color:var(--muted)]">
                        {selectedModel.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <div className="flex flex-wrap gap-2">
                      {(selectedModel.modalities || ['Text']).map((modality) => (
                        <span
                          key={`modal-${modality}`}
                          className="chip chip-compact"
                        >
                          {modality}
                        </span>
                      ))}
                    </div>
                    {recommendedQuant ? (
                      <span className="recommend-pill">
                        Recommended: {recommendedQuant}
                      </span>
                    ) : null}
                    <span
                      className={`status-pill ${compatibilityStyles[selectedSummary]}`}
                    >
                      Compatibility: {selectedSummary}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="stat sm:col-span-2">
                    <div className="text-[11px] uppercase text-[color:var(--muted)]">
                      Selected system fit
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`status-pill ${compatibilityStyles[selectedSummary]}`}
                      >
                        {selectedSummary}
                      </span>
                      {recommendedQuant ? (
                        <span className="recommend-pill">
                          Best fit: {recommendedQuant}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="text-[11px] uppercase text-[color:var(--muted)]">
                      Params
                    </div>
                    <div className="text-lg font-semibold">
                      {selectedModel.parameter_count}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="text-[11px] uppercase text-[color:var(--muted)]">
                      Modalities
                    </div>
                    <div className="text-sm font-semibold">
                      {(selectedModel.modalities || ['Text']).join(', ')}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="text-[11px] uppercase text-[color:var(--muted)]">
                      Est. speed
                    </div>
                    <div className="text-lg font-semibold">
                      {formatTokensPerSec(selectedTokens)}
                    </div>
                  </div>
                  <div className="stat sm:col-span-2">
                    <div className="text-[11px] uppercase text-[color:var(--muted)]">
                      Formats
                    </div>
                    <div className="format-chip-list mt-2 text-sm font-semibold">
                      {selectedModel.formats.length ? (
                        selectedModel.formats.map((format) => {
                          const formatUrl = getQuantDownloadUrl(
                            selectedModel,
                            format,
                          )
                          return formatUrl ? (
                            <a
                              key={format}
                              className="format-chip"
                              href={formatUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={`${format}: ${getQuantDownloadHint(format)}`}
                            >
                              {format}
                            </a>
                          ) : (
                            <span key={format} className="format-chip static">
                              {format}
                            </span>
                          )
                        })
                      ) : (
                        '--'
                      )}
                    </div>
                  </div>
                  <div className="stat sm:col-span-2">
                    <div className="text-[11px] uppercase text-[color:var(--muted)]">
                      Repo
                    </div>
                    <div className="text-sm font-semibold break-all">
                      {selectedModel.huggingface_repo || 'Not listed'}
                    </div>
                  </div>
                </div>

                {selectedModel.huggingface_repo ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      className="pill-button"
                      href={`https://huggingface.co/${selectedModel.huggingface_repo}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open HuggingFace
                    </a>
                    <button
                      type="button"
                      className="pill-button"
                      onClick={() =>
                        handleCopyRepo(selectedModel.huggingface_repo || '')
                      }
                    >
                      {copiedRepo === selectedModel.huggingface_repo
                        ? 'Copied'
                        : 'Copy Repo ID'}
                    </button>
                  </div>
                ) : null}

                {selectedModel.userAdded ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="pill-button pill-button--remove"
                      onClick={() => removeUserModel(selectedModel)}
                    >
                      Remove custom model
                    </button>
                  </div>
                ) : null}

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-sm font-semibold">
                      Quantization & RAM fit
                    </h4>
                    <span className="text-xs text-[color:var(--muted)]">
                      {Math.round((RUNTIME_OVERHEAD - 1) * 100)}% runtime
                      overhead
                    </span>
                  </div>
                  {quantRows.length === 0 ? (
                    <div className="empty-state mt-3">
                      Quantization data not available for this model.
                    </div>
                  ) : (
                    <div className="table-wrap mt-4">
                      <table>
                        <thead>
                          <tr className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
                            <th>Quant</th>
                            <th>RAM required</th>
                            <th>Compatibility</th>
                            <th>System fit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quantRows.map((row) => (
                            <tr key={row.key}>
                              <td className="mono">
                                <div className="quant-cell">
                                  {row.downloadUrl ? (
                                    <a
                                      className="quant-link"
                                      href={row.downloadUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={`${row.key}: ${row.downloadHint}`}
                                    >
                                      {row.key}
                                    </a>
                                  ) : (
                                    <span>{row.key}</span>
                                  )}
                                  {recommendedQuant === row.key ? (
                                    <span className="recommend-tag">
                                      Recommended
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td>{formatRequirement(row.requirement)}</td>
                              <td>
                                <span
                                  className={`status-pill ${compatibilityStyles[row.status]}`}
                                >
                                  {row.status}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`status-pill ${recommendationStyles[row.recommendation.tone]}`}
                                >
                                  {row.recommendation.label}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-[color:var(--muted)]">
                    FP16 and other full-precision links open the official repo.
                    Lower-bit quants search Hugging Face for matching downloads.
                  </p>
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-semibold">Quality guidance</h4>
                  <div className="mt-3 space-y-3">
                    {quantizationLevels.map((level) => (
                      <div key={level.key} className="stat">
                        <div className="flex items-center justify-between">
                          <span className="mono text-sm">{level.label}</span>
                          <span className="text-xs text-[color:var(--muted)]">
                            {level.bytes} bytes/param
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">
                          {level.blurb}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                Pick a model to see details.
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  )
}

export default App
