import {
  createCompanionHelloRequest,
  createCompanionSnapshotRequest,
  LOCAL_COMPANION_PROTOCOL_VERSION,
  parseLocalCompanionHardwareInfo,
  parseLocalCompanionMessage,
  type CompanionCapabilityFlags,
  type CompanionHelloAck,
  type LocalCompanionHardwareInfo,
  type LocalCompanionMessage,
} from '../domain'

export type LocalCompanionSession = {
  handshake: CompanionHelloAck
  requestHardwareSnapshot: () => Promise<LocalCompanionHardwareInfo>
  disconnect: () => Promise<void>
}

export interface LocalCompanionAdapter {
  connect(): Promise<LocalCompanionSession>
}

const MOCK_CAPABILITIES: CompanionCapabilityFlags = {
  totalRam: true,
  freeRam: true,
  gpuModel: true,
  vram: true,
  backendSupport: true,
  installedRuntimes: true,
  localModels: true,
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

const createMockSnapshot = (): LocalCompanionHardwareInfo =>
  parseLocalCompanionHardwareInfo({
    timestampIso: new Date().toISOString(),
    machine: {
      os: 'Windows 11 Pro',
      arch: 'x64',
      hostname: 'mock-workstation',
    },
    memory: {
      totalRamBytes: 34_359_738_368,
      freeRamBytes: 19_812_229_120,
    },
    gpus: [
      {
        model: 'NVIDIA GeForce RTX 4070',
        vendor: 'NVIDIA',
        vramBytes: 12_884_901_888,
        backendSupport: {
          cpu: true,
          cuda: true,
          rocm: false,
          metal: false,
          vulkan: true,
          directml: true,
        },
      },
    ],
    installedRuntimes: [
      {
        id: 'ollama',
        name: 'Ollama',
        version: '0.7.1',
        running: true,
        defaultPort: 11434,
      },
      {
        id: 'lmstudio',
        name: 'LM Studio',
        version: '0.4.2',
        running: false,
        defaultPort: 1234,
      },
    ],
    localModels: [
      {
        id: 'ollama:qwen2.5:7b',
        runtime: 'ollama',
        displayName: 'qwen2.5:7b',
        provider: 'Qwen',
        parameterCount: '7B',
        quant: 'Q4_K_M',
      },
      {
        id: 'lmstudio:gemma-2-2b',
        runtime: 'lmstudio',
        displayName: 'gemma-2-2b',
        provider: 'Google',
        parameterCount: '2B',
        quant: 'Q4_K_M',
      },
    ],
    notes: [
      'Mock companion payload for web-app contract testing only.',
      'Replace this adapter with a Tauri or Electron bridge later.',
    ],
  })

export const createMockLocalCompanionAdapter = (
  clientVersion = 'web-dev',
): LocalCompanionAdapter => ({
  async connect() {
    const helloRequest = createCompanionHelloRequest(clientVersion, MOCK_CAPABILITIES)
    parseLocalCompanionMessage(helloRequest)
    await wait(120)

    const helloAck = parseLocalCompanionMessage({
      protocol: LOCAL_COMPANION_PROTOCOL_VERSION,
      type: 'hello-ack',
      requestId: helloRequest.requestId,
      sessionId: 'mock-session-1',
      companion: {
        name: 'AI Hardware Check Mock Companion',
        version: '0.1.0',
      },
      capabilities: MOCK_CAPABILITIES,
    }) as CompanionHelloAck

    return {
      handshake: helloAck,
      async requestHardwareSnapshot() {
        const request = createCompanionSnapshotRequest(helloAck.sessionId)
        parseLocalCompanionMessage(request)
        await wait(140)

        const response = parseLocalCompanionMessage({
          protocol: LOCAL_COMPANION_PROTOCOL_VERSION,
          type: 'hardware-snapshot',
          requestId: request.requestId,
          sessionId: helloAck.sessionId,
          hardware: createMockSnapshot(),
        }) as Extract<LocalCompanionMessage, { type: 'hardware-snapshot' }>

        return response.hardware
      },
      async disconnect() {
        await wait(20)
      },
    }
  },
})
