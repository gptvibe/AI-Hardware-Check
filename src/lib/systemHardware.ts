export type GpuInfo = {
  renderer: string
  vendor: string
  api: 'WebGL2' | 'WebGL' | 'Unavailable'
  available: boolean
}

export type SystemHardware = {
  cpuCores: number | null
  ramGb: number | null
  platform: string
  userAgent: string
  webgpu: boolean
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
