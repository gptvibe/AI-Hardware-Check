import type { HardwareProfile } from './systemHardware'
import type {
  ChipProfile,
  ComputePreference,
  HardwareConfidenceDetail,
  HardwareConfidenceSummary,
  HardwareReadiness,
} from './types'

export const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem('aihc-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export const getAppleDeviceHint = (userAgent: string): string | null => {
  const ua = userAgent.toLowerCase()
  if (ua.includes('iphone')) {
    return 'Detected iPhone. Choose your iPhone model profile for better estimates.'
  }
  if (ua.includes('ipad')) {
    return 'Detected iPad. Newer iPads can use M-series chips; choose an M profile if applicable.'
  }
  if (ua.includes('macintosh') || ua.includes('mac os')) {
    return 'Detected Mac. Browser APIs usually hide exact chip generation; choose your M-series profile manually.'
  }
  return null
}

export const getRamSourceLabel = (
  hardwareProfile: HardwareProfile,
  ramOverrideGb: string,
) => {
  if (ramOverrideGb !== '') return 'Manual override'
  return hardwareProfile.ramGb.value === null
    ? 'Not reported by this browser'
    : 'Device memory API'
}

export const getHardwareConfidenceLevel = (confidenceScore: number) => {
  if (confidenceScore >= 80) return 'high'
  if (confidenceScore >= 60) return 'medium'
  return 'low'
}

export const needsHardwareOverride = (hardwareProfile: HardwareProfile) =>
  getHardwareConfidenceLevel(hardwareProfile.confidenceScore) !== 'high'

export const getDefaultComputePreference = (
  hardwareProfile: HardwareProfile,
): ComputePreference => (hardwareProfile.system.webgpu ? 'gpu-offload' : 'cpu-only')

export const getComputePreferenceMultiplier = (
  computePreference: ComputePreference,
): number => (computePreference === 'cpu-only' ? 0.62 : 1.04)

export const getHardwareConfidenceDetails = (
  hardwareProfile: HardwareProfile,
): HardwareConfidenceDetail[] => [
  {
    label: 'CPU threads',
    confidence: hardwareProfile.cpuCores.confidence,
    source: hardwareProfile.cpuCores.source,
    note: hardwareProfile.cpuCores.note || 'CPU thread count was inferred from browser signals.',
  },
  {
    label: 'System RAM',
    confidence: hardwareProfile.ramGb.confidence,
    source: hardwareProfile.ramGb.source,
    note: hardwareProfile.ramGb.note || 'System memory estimate was inferred.',
  },
  {
    label: 'WebGPU availability',
    confidence: hardwareProfile.webgpu.confidence,
    source: hardwareProfile.webgpu.source,
    note: hardwareProfile.webgpu.note || 'GPU acceleration availability was inferred.',
  },
  {
    label: 'GPU renderer',
    confidence: hardwareProfile.gpuRenderer.confidence,
    source: hardwareProfile.gpuRenderer.source,
    note: hardwareProfile.gpuRenderer.note || 'GPU renderer was inferred.',
  },
]

export const getHardwareConfidenceSummary = (
  hardwareProfile: HardwareProfile,
): HardwareConfidenceSummary => {
  const level = getHardwareConfidenceLevel(hardwareProfile.confidenceScore)
  const uncertainFields = getHardwareConfidenceDetails(hardwareProfile)
    .filter((detail) => detail.confidence !== 'high')
    .map((detail) => detail.label)

  if (level === 'high') {
    return {
      level,
      headline: 'Hardware estimate looks reliable.',
      uncertainFields,
    }
  }

  if (level === 'medium') {
    return {
      level,
      headline: 'Some hardware details need confirmation for better recommendations.',
      uncertainFields,
    }
  }

  return {
    level,
    headline: 'Browser hardware detection is limited on this machine.',
    uncertainFields,
  }
}

export const applyRamOverride = (
  hardwareProfile: HardwareProfile,
  effectiveRamGb: number | null,
  ramOverrideGb: string,
): HardwareProfile => ({
  ...hardwareProfile,
  system: {
    ...hardwareProfile.system,
    ramGb: effectiveRamGb,
  },
  ramGb: {
    ...hardwareProfile.ramGb,
    value: effectiveRamGb,
    source: ramOverrideGb !== '' ? 'inferred' : hardwareProfile.ramGb.source,
    confidence: ramOverrideGb !== '' ? 'medium' : hardwareProfile.ramGb.confidence,
    note: ramOverrideGb !== ''
      ? 'RAM set manually by user override.'
      : hardwareProfile.ramGb.note,
  },
})

export const applyComputePreference = (
  hardwareProfile: HardwareProfile,
  computePreference: ComputePreference,
): HardwareProfile => {
  if (computePreference === 'gpu-offload') {
    return hardwareProfile
  }

  return {
    ...hardwareProfile,
    system: {
      ...hardwareProfile.system,
      webgpu: false,
    },
    webgpu: {
      ...hardwareProfile.webgpu,
      value: false,
      note: 'Performance estimate adjusted for CPU-only inference.',
      source: 'inferred',
      confidence: 'medium',
    },
  }
}

export const getSelectedChipProfile = (
  chipProfileById: Record<string, ChipProfile>,
  chipOverrideId: string,
) => (chipOverrideId ? chipProfileById[chipOverrideId] || null : null)

export const getReadiness = (memory: number | null): HardwareReadiness => {
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
}
