export type GpuInfo = {
  renderer: string
  vendor: string
  api: 'WebGL2' | 'WebGL' | 'Unavailable'
  available: boolean
}

export type HardwareSource = 'measured' | 'reported' | 'inferred' | 'unknown'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type HardwareSignal<T> = {
  value: T
  source: HardwareSource
  confidence: ConfidenceLevel
  note?: string
}

export type SystemHardware = {
  cpuCores: number | null
  ramGb: number | null
  platform: string
  userAgent: string
  webgpu: boolean
}

export type PerformanceTier = 'entry' | 'mainstream' | 'high' | 'unknown'

export type HardwareProfile = {
  system: SystemHardware
  gpu: GpuInfo
  cpuCores: HardwareSignal<number | null>
  ramGb: HardwareSignal<number | null>
  webgpu: HardwareSignal<boolean>
  gpuRenderer: HardwareSignal<string>
  graphicsProbeScore: number | null
  performanceTier: PerformanceTier
  confidenceScore: number
  unresolved: string[]
}

export const getDefaultGpuInfo = (): GpuInfo => ({
  renderer: 'Not detected',
  vendor: '--',
  api: 'Unavailable',
  available: false,
})

export const getSystemHardware = (): SystemHardware => {
  if (typeof navigator === 'undefined') {
    return {
      cpuCores: null,
      ramGb: null,
      platform: 'Unknown',
      userAgent: '',
      webgpu: false,
    }
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number
    userAgentData?: { platform?: string }
    gpu?: unknown
  }

  return {
    cpuCores:
      typeof nav.hardwareConcurrency === 'number'
        ? nav.hardwareConcurrency
        : null,
    ramGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    platform: nav.userAgentData?.platform || nav.platform || 'Unknown',
    userAgent: nav.userAgent || '',
    webgpu: typeof nav.gpu !== 'undefined',
  }
}

export const detectGpu = (): GpuInfo => {
  if (typeof document === 'undefined') {
    return getDefaultGpuInfo()
  }

  const canvas = document.createElement('canvas')
  const gl2 = canvas.getContext('webgl2')
  const gl = gl2 || canvas.getContext('webgl')

  if (!gl) {
    return {
      renderer: 'Not available',
      vendor: '--',
      api: 'Unavailable',
      available: false,
    }
  }

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info') as
    | {
        UNMASKED_RENDERER_WEBGL: number
        UNMASKED_VENDOR_WEBGL: number
      }
    | null

  const renderer = debugInfo
    ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
    : String(gl.getParameter(gl.RENDERER))
  const vendor = debugInfo
    ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
    : String(gl.getParameter(gl.VENDOR))

  return {
    renderer,
    vendor,
    api: gl2 ? 'WebGL2' : 'WebGL',
    available: true,
  }
}

const toPercent = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value * 100)))

const quickGraphicsProbe = (): number | null => {
  if (typeof document === 'undefined' || typeof performance === 'undefined') {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 108
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  if (!gl) return null

  const start = performance.now()
  let loops = 0

  while (performance.now() - start < 25) {
    gl.clearColor((loops % 10) / 10, 0.3, 0.5, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    loops += 1
  }

  const elapsedMs = performance.now() - start
  if (elapsedMs <= 0) return null
  return loops / elapsedMs
}

const classifyPerformanceTier = (
  system: SystemHardware,
  gpu: GpuInfo,
  probeScore: number | null,
): PerformanceTier => {
  if (!gpu.available && system.cpuCores === null && system.ramGb === null) {
    return 'unknown'
  }

  const corePoints = system.cpuCores === null ? 0.6 : Math.min(2.2, Math.sqrt(system.cpuCores / 4))
  const ramPoints = system.ramGb === null ? 0.6 : Math.min(2.4, Math.sqrt(system.ramGb / 8))
  const gpuPoints = gpu.available ? (system.webgpu ? 1.8 : 1.0) : 0.3
  const probePoints = probeScore === null ? 0.6 : Math.min(1.6, probeScore / 2.2)
  const score = corePoints + ramPoints + gpuPoints + probePoints

  if (score >= 6) return 'high'
  if (score >= 3.8) return 'mainstream'
  return 'entry'
}

const getSignalWeight = (confidence: ConfidenceLevel): number => {
  if (confidence === 'high') return 1
  if (confidence === 'medium') return 0.7
  return 0.45
}

export const getHardwareProfile = (): HardwareProfile => {
  const system = getSystemHardware()
  const gpu = detectGpu()
  const probeScore = quickGraphicsProbe()

  const cpuCores: HardwareSignal<number | null> = {
    value: system.cpuCores,
    source: system.cpuCores === null ? 'unknown' : 'reported',
    confidence: system.cpuCores === null ? 'low' : 'medium',
    note:
      system.cpuCores === null
        ? 'Browser did not expose hardware concurrency.'
        : 'Provided by navigator.hardwareConcurrency.',
  }

  const ramGb: HardwareSignal<number | null> = {
    value: system.ramGb,
    source: system.ramGb === null ? 'unknown' : 'reported',
    confidence: system.ramGb === null ? 'low' : 'medium',
    note:
      system.ramGb === null
        ? 'Some browsers hide device memory.'
        : 'Provided by navigator.deviceMemory and rounded by browser.',
  }

  const webgpu: HardwareSignal<boolean> = {
    value: system.webgpu,
    source: 'reported',
    confidence: 'high',
    note: system.webgpu
      ? 'WebGPU API is available in this browser.'
      : 'WebGPU API is not currently available.',
  }

  const gpuRenderer: HardwareSignal<string> = {
    value: gpu.renderer,
    source: gpu.available ? 'reported' : 'unknown',
    confidence: gpu.available ? 'medium' : 'low',
    note: gpu.available
      ? 'Renderer string from WebGL context.'
      : 'No GPU renderer could be read via WebGL.',
  }

  const unresolved: string[] = []
  if (ramGb.value === null) {
    unresolved.push('System RAM is not reported by this browser.')
  }
  if (!gpu.available) {
    unresolved.push('GPU details are limited because WebGL is unavailable.')
  }
  if (probeScore === null) {
    unresolved.push('Graphics probe could not be measured in this session.')
  }

  const weighted =
    getSignalWeight(cpuCores.confidence) +
    getSignalWeight(ramGb.confidence) +
    getSignalWeight(webgpu.confidence) +
    getSignalWeight(gpuRenderer.confidence)
  const confidenceScore = toPercent(weighted / 4)

  return {
    system,
    gpu,
    cpuCores,
    ramGb,
    webgpu,
    gpuRenderer,
    graphicsProbeScore: probeScore,
    performanceTier: classifyPerformanceTier(system, gpu, probeScore),
    confidenceScore,
    unresolved,
  }
}
