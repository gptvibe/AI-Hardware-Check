import type { ChipProfile, CompatibilityFilter, QuantLevel } from './types'

export const OLLAMA_INSTALL_COMMAND = 'winget install -e --id Ollama.Ollama'

export const quantizationLevels: QuantLevel[] = [
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

export const PROVIDER_ORDER = [
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

export const QUANT_ORDER = ['FP16', 'INT8', 'INT4', 'Q5_K_M', 'Q4_K_M', 'Q3_K_M', 'Q2_K']

export const RECOMMEND_ORDER = [
  'FP16',
  'INT8',
  'Q5_K_M',
  'Q4_K_M',
  'INT4',
  'Q3_K_M',
  'Q2_K',
]

export const THEME_KEY = 'aihc-theme'
export const PERF_CALIBRATION_KEY = 'aihc-perf-calibration'
export const USER_MODELS_KEY = 'aihc-user-models'

export const MODALITY_ORDER = ['Text', 'Image', 'Audio', 'Video']

export const RAM_OVERRIDE_OPTIONS = [
  2, 3, 4, 6, 8, 12, 16, 24, 32,
]

export const CHIP_PROFILES: ChipProfile[] = [
  {
    id: 'generic-cpu-only',
    label: 'CPU-only laptop / desktop',
    recommendedRamGb: 8,
    speedMultiplier: 0.72,
    note: 'Use this when you expect little or no GPU acceleration.',
  },
  {
    id: 'generic-integrated-gpu',
    label: 'Integrated GPU machine',
    recommendedRamGb: 16,
    speedMultiplier: 0.95,
    note: 'Best for modern laptops and desktops using integrated graphics.',
  },
  {
    id: 'generic-mainstream-gpu',
    label: 'Mainstream GPU machine',
    recommendedRamGb: 16,
    speedMultiplier: 1.25,
    note: 'Good default for consumer GPUs with practical local offload.',
  },
  {
    id: 'generic-highend-gpu',
    label: 'High-end GPU / workstation',
    recommendedRamGb: 32,
    speedMultiplier: 1.55,
    note: 'Use this for stronger discrete GPUs or workstation-class hardware.',
  },
  {
    id: 'apple-m1',
    label: 'Apple M1 (base)',
    recommendedRamGb: 8,
    speedMultiplier: 1.25,
    note: 'Entry Apple Silicon baseline.',
  },
  {
    id: 'apple-m1-pro',
    label: 'Apple M1 Pro/Max',
    recommendedRamGb: 16,
    speedMultiplier: 1.45,
    note: 'Higher GPU throughput and memory bandwidth.',
  },
  {
    id: 'apple-m2',
    label: 'Apple M2 (base)',
    recommendedRamGb: 8,
    speedMultiplier: 1.35,
    note: 'Slight uplift over M1 generation.',
  },
  {
    id: 'apple-m2-pro',
    label: 'Apple M2 Pro/Max',
    recommendedRamGb: 16,
    speedMultiplier: 1.55,
    note: 'Strong local inference profile.',
  },
  {
    id: 'apple-m3',
    label: 'Apple M3 (base)',
    recommendedRamGb: 8,
    speedMultiplier: 1.5,
    note: 'Modern baseline for Apple laptops/desktops.',
  },
  {
    id: 'apple-m3-pro',
    label: 'Apple M3 Pro/Max',
    recommendedRamGb: 18,
    speedMultiplier: 1.75,
    note: 'High-performance Apple Silicon tier.',
  },
  {
    id: 'apple-m4',
    label: 'Apple M4 (base)',
    recommendedRamGb: 16,
    speedMultiplier: 1.7,
    note: 'Latest baseline Apple Silicon tier.',
  },
  {
    id: 'apple-m4-pro',
    label: 'Apple M4 Pro/Max',
    recommendedRamGb: 24,
    speedMultiplier: 1.95,
    note: 'Top-end Apple Silicon profile.',
  },
  {
    id: 'iphone-15',
    label: 'iPhone 15',
    recommendedRamGb: 6,
    speedMultiplier: 0.95,
    note: 'Baseline iPhone 15 profile.',
  },
  {
    id: 'iphone-15-pro',
    label: 'iPhone 15 Pro',
    recommendedRamGb: 8,
    speedMultiplier: 1.1,
    note: 'iPhone 15 Pro profile with stronger GPU.',
  },
  {
    id: 'iphone-16',
    label: 'iPhone 16',
    recommendedRamGb: 8,
    speedMultiplier: 1.15,
    note: 'iPhone 16 profile with improved efficiency.',
  },
  {
    id: 'iphone-16-pro',
    label: 'iPhone 16 Pro',
    recommendedRamGb: 8,
    speedMultiplier: 1.25,
    note: 'Top iPhone profile for current generation.',
  },
  {
    id: 'iphone-17',
    label: 'iPhone 17',
    recommendedRamGb: 8,
    speedMultiplier: 1.28,
    note: 'iPhone 17 baseline profile.',
  },
  {
    id: 'iphone-17-pro',
    label: 'iPhone 17 Pro',
    recommendedRamGb: 8,
    speedMultiplier: 1.38,
    note: 'iPhone 17 Pro profile with stronger GPU.',
  },
  {
    id: 'iphone-17e',
    label: 'iPhone 17e',
    recommendedRamGb: 8,
    speedMultiplier: 1.2,
    note: 'iPhone 17e efficiency-focused profile.',
  },
]

export const CHIP_PROFILE_BY_ID = Object.fromEntries(
  CHIP_PROFILES.map((profile) => [profile.id, profile]),
) as Record<string, ChipProfile>

export const compatibilityFilterLabels: Record<CompatibilityFilter, string> = {
  all: 'All fit states',
  'can-run': 'Can run',
  maybe: 'Maybe',
  'cannot-run': 'Cannot run',
  unknown: 'Unknown',
}
