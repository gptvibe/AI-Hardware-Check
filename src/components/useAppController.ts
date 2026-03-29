import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  applyComputePreference,
  applyRamOverride,
  buildShareableReport,
  DEFAULT_COMPANION_CAPABILITY_FLAGS,
  formatCompanionCapabilities,
  getBenchmarkConfidence,
  getBenchmarkFreshness,
  getCalibrationMultiplier,
  CHIP_PROFILE_BY_ID,
  compatibilityFilterLabels,
  estimatePerformanceRange,
  fetchHuggingFaceModelEntry,
  getAppleDeviceHint,
  getCompanyFilteredModels,
  getCompanySummaries,
  getComputePreferenceMultiplier,
  getDefaultComputePreference,
  getCompatibilitySummary,
  getFilteredModels,
  getFirstSelectableModel,
  getGuidedRecommendation,
  getHardwareConfidenceDetails,
  getHardwareConfidenceSummary,
  getHardwareProfile,
  getHomepageRecommendations,
  getInitialTheme,
  getModelGroups,
  getModelId,
  getModalityOptions,
  getPreferredBenchmarkResult,
  getProviderOptions,
  getQuantRows,
  getRamSourceLabel,
  getReadiness,
  getRecommendedQuant,
  getRunnableModelList,
  getSelectedChipProfile,
  loadModelDatabase,
  needsHardwareOverride as shouldOverrideHardware,
  normalizeHfRepoInput,
  parseStoredBenchmarkResults,
  parseStoredUserAddedModels,
  parseParamCount,
  PERF_CALIBRATION_KEY,
  runLocalCalibrationBenchmark,
  THEME_KEY,
  USER_MODELS_KEY,
  validateHfRepoId,
  type AddModelStatus,
  type BenchmarkSource,
  type BenchmarkState,
  type CompatibilityFilter,
  type CompatibilityStatus,
  type CompanionHelloAck,
  type ComputePreference,
  type HardwareProfile,
  type LocalCompanionConnectionState,
  type LocalCompanionHardwareInfo,
  type ModelDatabaseEntry,
  type QualityPreference,
  type RuntimeId,
  type UserGoal,
} from '../domain'
import {
  copyTextToClipboard,
  createMockLocalCompanionAdapter,
  loadJsonStorage,
  runLmStudioRuntimeBenchmark,
  runOllamaRuntimeBenchmark,
  saveJsonStorage,
} from '../utils'

const clearLater = (
  setValue: (value: string | null | ((current: string | null) => string | null)) => void,
  nextValue: string,
) => {
  setValue(nextValue)
  window.setTimeout(() => {
    setValue((current) => (current === nextValue ? null : current))
  }, 1500)
}

export const useAppController = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme())
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile>(() =>
    getHardwareProfile(),
  )
  const [models, setModels] = useState<ModelDatabaseEntry[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [copiedRepo, setCopiedRepo] = useState<string | null>(null)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [compareModelIds, setCompareModelIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState('all')
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [compatibilityFilter, setCompatibilityFilter] =
    useState<CompatibilityFilter>('all')
  const [modalityFilter, setModalityFilter] = useState('all')
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    () => new Set(),
  )
  const [userAddedModels, setUserAddedModels] = useState<ModelDatabaseEntry[]>(
    () => loadJsonStorage(USER_MODELS_KEY, parseStoredUserAddedModels) || [],
  )
  const [addModelInput, setAddModelInput] = useState('')
  const [addModelStatus, setAddModelStatus] = useState<AddModelStatus>({ type: 'idle' })
  const [ramOverrideGb, setRamOverrideGb] = useState('')
  const [chipOverrideId, setChipOverrideId] = useState('')
  const [computePreference, setComputePreference] = useState<ComputePreference>(() =>
    getDefaultComputePreference(getHardwareProfile()),
  )
  const [experienceMode, setExperienceMode] = useState<'beginner' | 'advanced'>('beginner')
  const [runtimePreference, setRuntimePreference] = useState<RuntimeId>('ollama')
  const [userGoal, setUserGoal] = useState<UserGoal>('chat')
  const [qualityPreference, setQualityPreference] =
    useState<QualityPreference>('balanced')
  const [benchmarkState, setBenchmarkState] = useState<BenchmarkState>(() => ({
    runningTarget: null,
    results: loadJsonStorage(PERF_CALIBRATION_KEY, parseStoredBenchmarkResults) || {},
    error: null,
  }))
  const [companionStatus, setCompanionStatus] =
    useState<LocalCompanionConnectionState>('disconnected')
  const [companionHandshake, setCompanionHandshake] = useState<CompanionHelloAck | null>(null)
  const [companionHardwareInfo, setCompanionHardwareInfo] =
    useState<LocalCompanionHardwareInfo | null>(null)
  const [companionError, setCompanionError] = useState<string | null>(null)
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
    const nextProfile = getHardwareProfile()
    setHardwareProfile(nextProfile)
    setComputePreference(getDefaultComputePreference(nextProfile))
  }, [])

  useEffect(() => {
    saveJsonStorage(USER_MODELS_KEY, userAddedModels)
  }, [userAddedModels])

  useEffect(() => {
    saveJsonStorage(PERF_CALIBRATION_KEY, benchmarkState.results)
  }, [benchmarkState.results])

  const allModels = useMemo(
    () => [...models, ...userAddedModels],
    [models, userAddedModels],
  )

  const effectiveRamGb = useMemo(() => {
    if (!ramOverrideGb) return hardwareProfile.ramGb.value
    const parsed = Number.parseFloat(ramOverrideGb)
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : hardwareProfile.ramGb.value
  }, [hardwareProfile.ramGb.value, ramOverrideGb])

  const ramAdjustedHardwareProfile = useMemo(
    () => applyRamOverride(hardwareProfile, effectiveRamGb, ramOverrideGb),
    [effectiveRamGb, hardwareProfile, ramOverrideGb],
  )

  const effectiveHardwareProfile = useMemo(
    () => applyComputePreference(ramAdjustedHardwareProfile, computePreference),
    [computePreference, ramAdjustedHardwareProfile],
  )

  const selectedChipProfile = useMemo(
    () => getSelectedChipProfile(CHIP_PROFILE_BY_ID, chipOverrideId),
    [chipOverrideId],
  )

  const appleDeviceHint = useMemo(
    () => getAppleDeviceHint(hardwareProfile.system.userAgent),
    [hardwareProfile.system.userAgent],
  )

  const ramSourceLabel = getRamSourceLabel(hardwareProfile, ramOverrideGb)
  const needsHardwareOverride = shouldOverrideHardware(hardwareProfile)
  const hardwareConfidenceSummary = useMemo(
    () => getHardwareConfidenceSummary(hardwareProfile),
    [hardwareProfile],
  )
  const hardwareConfidenceDetails = useMemo(
    () => getHardwareConfidenceDetails(hardwareProfile),
    [hardwareProfile],
  )
  const effectiveAccelerationMultiplier =
    (selectedChipProfile?.speedMultiplier || 1) *
    getComputePreferenceMultiplier(computePreference)

  const compatibilityById = useMemo(() => {
    const map = new Map<string, CompatibilityStatus>()
    for (const model of allModels) {
      map.set(getModelId(model), getCompatibilitySummary(model, effectiveRamGb))
    }
    return map
  }, [effectiveRamGb, allModels])

  const providerOptions = useMemo(
    () => getProviderOptions(allModels),
    [allModels],
  )

  const modalityOptions = useMemo(
    () => getModalityOptions(allModels),
    [allModels],
  )

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase()
  const hasManualFilters =
    normalizedSearchQuery.length > 0 ||
    selectedCompany !== null ||
    compatibilityFilter !== 'all' ||
    modalityFilter !== 'all'

  const companyFilteredModels = useMemo(
    () =>
      getCompanyFilteredModels({
        allModels,
        compatibilityById,
        compatibilityFilter,
        modalityFilter,
        normalizedSearchQuery,
      }),
    [
      allModels,
      compatibilityById,
      compatibilityFilter,
      modalityFilter,
      normalizedSearchQuery,
    ],
  )

  const filteredModels = useMemo(
    () =>
      getFilteredModels({
        companyFilteredModels,
        compatibilityById,
        compatibilityFilter,
        providerFilter,
      }),
    [
      companyFilteredModels,
      compatibilityById,
      compatibilityFilter,
      providerFilter,
    ],
  )

  const companySummaries = useMemo(
    () =>
      getCompanySummaries({
        companyFilteredModels,
        compatibilityById,
        providerOptions,
      }),
    [companyFilteredModels, compatibilityById, providerOptions],
  )

  const modelGroups = useMemo(
    () => getModelGroups(filteredModels),
    [filteredModels],
  )

  const runnableModelList = useMemo(
    () =>
      getRunnableModelList({
        allModels,
        filteredModels,
        compatibilityById,
      }),
    [allModels, compatibilityById, filteredModels],
  )

  const firstModel = useMemo(
    () =>
      getFirstSelectableModel({
        compatibilityById,
        modelGroups,
      }),
    [compatibilityById, modelGroups],
  )

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

  const comparedModels = useMemo(
    () =>
      compareModelIds
        .map((id) => allModels.find((model) => getModelId(model) === id) || null)
        .filter((model): model is ModelDatabaseEntry => Boolean(model)),
    [allModels, compareModelIds],
  )

  useEffect(() => {
    if (!selectedModel) return
    const summary = compatibilityById.get(getModelId(selectedModel)) || 'Unknown'
    if (summary !== 'Cannot Run') return
    const key = `${selectedModel.provider || 'Other'}::${selectedModel.family || selectedModel.name}`
    setExpandedFamilies((current) => {
      if (current.has(key)) return current
      const next = new Set(current)
      next.add(key)
      return next
    })
  }, [compatibilityById, selectedModel])

  useEffect(() => {
    setCompareModelIds((current) =>
      current.filter((id) => allModels.some((model) => getModelId(model) === id)),
    )
  }, [allModels])

  const handleCopyRepo = async (repo: string) => {
    const copied = await copyTextToClipboard(repo)
    if (!copied) {
      setCopiedRepo(null)
      return
    }
    clearLater(setCopiedRepo, repo)
  }

  const handleCopyCommand = async (command: string) => {
    const copied = await copyTextToClipboard(command)
    if (!copied) {
      setCopiedCommand(null)
      return
    }
    clearLater(setCopiedCommand, command)
  }

  const runCalibration = async (target: BenchmarkSource = 'synthetic') => {
    setBenchmarkState((current) => ({
      ...current,
      runningTarget: target,
      error: null,
    }))
    try {
      const result =
        target === 'ollama'
          ? await runOllamaRuntimeBenchmark({
              profile: effectiveHardwareProfile,
              chipMultiplier: effectiveAccelerationMultiplier,
            })
          : target === 'lmstudio'
            ? await runLmStudioRuntimeBenchmark({
                profile: effectiveHardwareProfile,
                chipMultiplier: effectiveAccelerationMultiplier,
              })
            : await runLocalCalibrationBenchmark()

      setBenchmarkState((current) => ({
        runningTarget: null,
        results: {
          ...current.results,
          [target]: result,
        },
        error: null,
      }))
    } catch (error) {
      setBenchmarkState((current) => ({
        runningTarget: null,
        results: current.results,
        error:
          error instanceof Error
            ? error.message
            : 'Calibration benchmark failed on this browser.',
      }))
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

  const readiness = useMemo(
    () => getReadiness(effectiveRamGb),
    [effectiveRamGb],
  )

  const quantRows = useMemo(
    () => getQuantRows(selectedModel, effectiveRamGb),
    [effectiveRamGb, selectedModel],
  )

  const effectiveRuntimePreference =
    experienceMode === 'beginner' ? 'ollama' : runtimePreference

  const recommendedQuant = useMemo(
    () => getRecommendedQuant(selectedModel, effectiveRamGb),
    [effectiveRamGb, selectedModel],
  )

  const selectedParamCount = selectedModel
    ? selectedModel.active_params_b ?? parseParamCount(selectedModel.parameter_count)
    : null
  const benchmarkResult = useMemo(
    () => getPreferredBenchmarkResult(benchmarkState.results, effectiveRuntimePreference),
    [benchmarkState.results, effectiveRuntimePreference],
  )
  const calibrationMultiplier = getCalibrationMultiplier(benchmarkResult)
  const benchmarkFreshness = getBenchmarkFreshness(benchmarkResult)
  const benchmarkConfidence = getBenchmarkConfidence(benchmarkResult)
  const selectedContextTokens = selectedModel?.context_windows?.[0] || 4096
  const selectedPerformance = selectedModel
    ? estimatePerformanceRange({
        paramsB: selectedParamCount,
        quant: recommendedQuant,
        contextTokens: selectedContextTokens,
        profile: effectiveHardwareProfile,
        chipMultiplier: effectiveAccelerationMultiplier,
        calibrationMultiplier,
        benchmarkResult,
      })
    : {
        expectedTokPerSec: null,
        conservativeTokPerSec: null,
        firstTokenLatencyMs: null,
        confidence: 'low' as const,
        explanation: 'No model selected.',
      }

  const selectedSummary = selectedModel
    ? compatibilityById.get(getModelId(selectedModel)) || 'Unknown'
    : 'Unknown'

  const libraryResultCount = selectedCompany
    ? filteredModels.length
    : companySummaries.length

  const guidedRecommendation = useMemo(
    () =>
      getGuidedRecommendation({
        filteredModels,
        hardwareProfile: effectiveHardwareProfile,
        runtimePreference: effectiveRuntimePreference,
        userGoal,
        qualityPreference,
        confidenceScore: effectiveHardwareProfile.confidenceScore,
        chipMultiplier: effectiveAccelerationMultiplier,
        calibrationMultiplier,
      }),
    [
      calibrationMultiplier,
      effectiveAccelerationMultiplier,
      effectiveHardwareProfile,
      effectiveRuntimePreference,
      filteredModels,
      qualityPreference,
      userGoal,
    ],
  )

  const homepageRecommendations = useMemo(
    () =>
      getHomepageRecommendations({
        models: filteredModels,
        hardwareProfile: effectiveHardwareProfile,
        runtimePreference: effectiveRuntimePreference,
        userGoal,
        confidenceScore: effectiveHardwareProfile.confidenceScore,
        chipMultiplier: effectiveAccelerationMultiplier,
        calibrationMultiplier,
      }),
    [
      calibrationMultiplier,
      effectiveAccelerationMultiplier,
      effectiveHardwareProfile,
      effectiveRuntimePreference,
      filteredModels,
      userGoal,
    ],
  )

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCompany(null)
    setProviderFilter('all')
    setCompatibilityFilter('all')
    setModalityFilter('all')
  }

  const handleSelectCompany = (provider: string) => {
    setSelectedCompany(provider)
    setProviderFilter(provider)
  }

  const handleBackToCompanies = () => {
    setSelectedCompany(null)
    setProviderFilter('all')
  }

  const fetchAndAddModel = async () => {
    const rawRepoInput = addModelInput.trim()
    if (!rawRepoInput) return
    const repoId = normalizeHfRepoInput(rawRepoInput)

    if (!repoId || !validateHfRepoId(rawRepoInput)) {
      setAddModelStatus({
        type: 'error',
        message:
          'Use a Hugging Face repo ID or model URL — e.g. meta-llama/Llama-3.1-8B-Instruct or https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct',
      })
      return
    }

    if (allModels.some((model) => model.huggingface_repo === repoId)) {
      setAddModelStatus({ type: 'error', message: `${repoId} is already in the list.` })
      return
    }

    setAddModelStatus({ type: 'loading', message: 'Fetching model info from HuggingFace…' })

    try {
      const result = await fetchHuggingFaceModelEntry(repoId)
      if (!result.ok) {
        setAddModelStatus({ type: 'error', message: result.message })
        return
      }

      setUserAddedModels((previous) => [...previous, result.entry])
      setAddModelStatus({
        type: 'success',
        message: `Added ${result.slug} · ${result.parameterCount} · ${result.provider}`,
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
    setUserAddedModels((previous) => previous.filter((item) => getModelId(item) !== id))
  }

  const handleChipOverrideChange = (nextChipId: string) => {
    setChipOverrideId(nextChipId)
    if (!nextChipId) return
    const profile = CHIP_PROFILE_BY_ID[nextChipId]
    if (profile) {
      setRamOverrideGb(String(profile.recommendedRamGb))
    }
  }

  const connectMockCompanion = async () => {
    setCompanionStatus('connecting')
    setCompanionError(null)

    try {
      const adapter = createMockLocalCompanionAdapter('1.0.0')
      const session = await adapter.connect()
      const snapshot = await session.requestHardwareSnapshot()
      setCompanionHandshake(session.handshake)
      setCompanionHardwareInfo(snapshot)
      setCompanionStatus('connected')
    } catch (error) {
      setCompanionStatus('error')
      setCompanionError(
        error instanceof Error
          ? error.message
          : 'Mock companion handshake failed.',
      )
    }
  }

  const disconnectCompanion = () => {
    setCompanionStatus('disconnected')
    setCompanionHandshake(null)
    setCompanionHardwareInfo(null)
    setCompanionError(null)
  }

  const companionCapabilities =
    companionHandshake?.capabilities || DEFAULT_COMPANION_CAPABILITY_FLAGS
  const companionCapabilitiesLabel = formatCompanionCapabilities(companionCapabilities)

  const addModelToCompare = (model: ModelDatabaseEntry) => {
    const id = getModelId(model)
    setCompareModelIds((current) => {
      if (current.includes(id)) return current
      return [...current, id].slice(0, 3)
    })
  }

  const removeModelFromCompare = (model: ModelDatabaseEntry) => {
    const id = getModelId(model)
    setCompareModelIds((current) => current.filter((entry) => entry !== id))
  }

  const toggleModelCompare = (model: ModelDatabaseEntry) => {
    const id = getModelId(model)
    setCompareModelIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id].slice(0, 3),
    )
  }

  const clearCompareTray = () => {
    setCompareModelIds([])
  }

  const shareableReport = useMemo(
    () =>
      buildShareableReport({
        benchmarkConfidence,
        benchmarkFreshnessLabel: benchmarkFreshness.label,
        benchmarkSource: benchmarkResult?.source || null,
        comparedModels,
        computePreference,
        confidenceSummary: hardwareConfidenceSummary,
        hardwareProfile: effectiveHardwareProfile,
        runtimePreference: effectiveRuntimePreference,
        selectedGoal: userGoal,
        selectedInstallModel: homepageRecommendations.primaryModel,
        selectedInstallQuant:
          homepageRecommendations.cards[0]?.recommendation?.recommendedQuant ||
          recommendedQuant,
        topRecommendations: homepageRecommendations.cards.map((card) => ({
          slot: card.title,
          recommendation: card.recommendation,
        })),
      }),
    [
      benchmarkConfidence,
      benchmarkFreshness.label,
      benchmarkResult?.source,
      comparedModels,
      computePreference,
      effectiveHardwareProfile,
      effectiveRuntimePreference,
      hardwareConfidenceSummary,
      homepageRecommendations,
      recommendedQuant,
      userGoal,
    ],
  )

  return {
    addModelInput,
    addModelStatus,
    addModelToCompare,
    appleDeviceHint,
    benchmarkState,
    benchmarkConfidence,
    benchmarkFreshness,
    benchmarkResult,
    calibrationMultiplier,
    chipOverrideId,
    clearFilters,
    clearCompareTray,
    companionCapabilities,
    companionCapabilitiesLabel,
    companionError,
    companionHandshake,
    companionHardwareInfo,
    companionStatus,
    computePreference,
    connectMockCompanion,
    compareModelIds,
    comparedModels,
    compatibilityById,
    compatibilityFilter,
    compatibilityFilterLabels,
    companySummaries,
    copiedCommand,
    copiedRepo,
    effectiveAccelerationMultiplier,
    effectiveHardwareProfile,
    effectiveRamGb,
    effectiveRuntimePreference,
    experienceMode,
    expandedFamilies,
    fetchAndAddModel,
    filteredModels,
    guidedRecommendation,
    handleBackToCompanies,
    handleChipOverrideChange,
    handleCopyCommand,
    handleCopyRepo,
    handleSelectCompany,
    hasManualFilters,
    hardwareConfidenceDetails,
    hardwareConfidenceSummary,
    homepageRecommendations,
    libraryResultCount,
    modalityFilter,
    modalityOptions,
    modelGroups,
    modelsError,
    needsHardwareOverride,
    qualityPreference,
    quantRows,
    ramOverrideGb,
    ramSourceLabel,
    readiness,
    recommendedQuant,
    removeUserModel,
    removeModelFromCompare,
    disconnectCompanion,
    runCalibration,
    runtimePreference,
    runnableModelList,
    searchQuery,
    selectedChipProfile,
    selectedCompany,
    selectedModel,
    selectedModelId,
    selectedPerformance,
    selectedSummary,
    setAddModelInput,
    setAddModelStatus,
    setCompatibilityFilter,
    setComputePreference,
    setExperienceMode,
    setModalityFilter,
    setQualityPreference,
    setRamOverrideGb,
    setRuntimePreference,
    setSearchQuery,
    setSelectedModelId,
    setTheme,
    setUserGoal,
    shareableReport,
    theme,
    toggleModelCompare,
    toggleFamily,
    userGoal,
  }
}

export type AppController = ReturnType<typeof useAppController>
