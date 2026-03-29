import {
  CompanionErrorMessageSchema,
  CompanionHardwareSnapshotRequestSchema,
  CompanionHelloRequestSchema,
  CompanionCapabilityFlagsSchema,
  LocalCompanionHardwareInfoSchema,
  LocalCompanionMessageSchema,
  type CompanionCapabilityFlagsInput,
  type CompanionHardwareSnapshotRequestInput,
  type CompanionHardwareSnapshotResponseInput,
  type CompanionHelloAckInput,
  type CompanionHelloRequestInput,
  type LocalCompanionHardwareInfoInput,
  type LocalCompanionMessageInput,
} from './schemas'

export const LOCAL_COMPANION_PROTOCOL_VERSION = 'aihc-companion.v1' as const

export type CompanionCapabilityFlags = CompanionCapabilityFlagsInput
export type LocalCompanionHardwareInfo = LocalCompanionHardwareInfoInput
export type CompanionHelloRequest = CompanionHelloRequestInput
export type CompanionHelloAck = CompanionHelloAckInput
export type CompanionHardwareSnapshotRequest = CompanionHardwareSnapshotRequestInput
export type CompanionHardwareSnapshotResponse = CompanionHardwareSnapshotResponseInput
export type LocalCompanionMessage = LocalCompanionMessageInput

export type LocalCompanionConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export const DEFAULT_COMPANION_CAPABILITY_FLAGS: CompanionCapabilityFlags =
  CompanionCapabilityFlagsSchema.parse({})

export const LOCAL_COMPANION_HARDWARE_INFO_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'AI Hardware Check Local Companion Hardware Info',
  type: 'object',
  required: ['timestampIso', 'machine', 'memory', 'gpus', 'installedRuntimes', 'localModels', 'notes'],
  properties: {
    timestampIso: { type: 'string' },
    machine: {
      type: 'object',
      required: ['os'],
      properties: {
        os: { type: 'string' },
        arch: { type: 'string' },
        hostname: { type: 'string' },
      },
    },
    memory: {
      type: 'object',
      properties: {
        totalRamBytes: { type: 'integer', minimum: 1 },
        freeRamBytes: { type: 'integer', minimum: 0 },
      },
    },
    gpus: {
      type: 'array',
      items: {
        type: 'object',
        required: ['model'],
        properties: {
          model: { type: 'string' },
          vendor: { type: 'string' },
          vramBytes: { type: 'integer', minimum: 0 },
          backendSupport: {
            type: 'object',
            properties: {
              cpu: { type: 'boolean' },
              cuda: { type: 'boolean' },
              rocm: { type: 'boolean' },
              metal: { type: 'boolean' },
              vulkan: { type: 'boolean' },
              directml: { type: 'boolean' },
            },
          },
        },
      },
    },
    installedRuntimes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { enum: ['ollama', 'lmstudio', 'llamacpp', 'other'] },
          name: { type: 'string' },
          version: { type: 'string' },
          running: { type: 'boolean' },
          defaultPort: { type: 'integer', minimum: 1 },
        },
      },
    },
    localModels: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'runtime', 'displayName'],
        properties: {
          id: { type: 'string' },
          runtime: { enum: ['ollama', 'lmstudio', 'llamacpp', 'other'] },
          displayName: { type: 'string' },
          provider: { type: 'string' },
          parameterCount: { type: 'string' },
          quant: { type: 'string' },
          sizeBytes: { type: 'integer', minimum: 0 },
        },
      },
    },
    notes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const

export const LOCAL_COMPANION_HANDSHAKE_PROTOCOL = {
  protocolVersion: LOCAL_COMPANION_PROTOCOL_VERSION,
  flow: [
    '1. Web app sends a `hello` message with client name/version and requested capability hints.',
    '2. Local companion replies with `hello-ack`, a session id, and the capability flags it can satisfy.',
    '3. Web app sends `get-hardware-snapshot` with the negotiated session id.',
    '4. Local companion replies with `hardware-snapshot` containing validated local machine data.',
    '5. Either side may send `error` with a user-safe message if validation or access fails.',
  ],
} as const

export const parseLocalCompanionHardwareInfo = (value: unknown) =>
  LocalCompanionHardwareInfoSchema.parse(value)

export const parseLocalCompanionMessage = (value: unknown) =>
  LocalCompanionMessageSchema.parse(value)

export const createCompanionHelloRequest = (
  clientVersion: string,
  requestedCapabilities: Partial<CompanionCapabilityFlags> = {},
): CompanionHelloRequest =>
  CompanionHelloRequestSchema.parse({
    protocol: LOCAL_COMPANION_PROTOCOL_VERSION,
    type: 'hello',
    requestId: `hello-${Date.now()}`,
    client: {
      name: 'ai-hardware-check-web',
      version: clientVersion,
    },
    requestedCapabilities,
  })

export const createCompanionSnapshotRequest = (
  sessionId: string,
  requestId = `snapshot-${Date.now()}`,
): CompanionHardwareSnapshotRequest =>
  CompanionHardwareSnapshotRequestSchema.parse({
    protocol: LOCAL_COMPANION_PROTOCOL_VERSION,
    type: 'get-hardware-snapshot',
    requestId,
    sessionId,
  })

export const createCompanionErrorMessage = (message: string, requestId?: string) =>
  CompanionErrorMessageSchema.parse({
    protocol: LOCAL_COMPANION_PROTOCOL_VERSION,
    type: 'error',
    requestId,
    message,
  })

export const formatCompanionCapabilities = (capabilities: CompanionCapabilityFlags) => {
  const labels = [
    capabilities.totalRam ? 'Total RAM' : null,
    capabilities.freeRam ? 'Free RAM' : null,
    capabilities.gpuModel ? 'GPU model' : null,
    capabilities.vram ? 'VRAM' : null,
    capabilities.backendSupport ? 'Backend support' : null,
    capabilities.installedRuntimes ? 'Installed runtimes' : null,
    capabilities.localModels ? 'Local models' : null,
  ].filter(Boolean)

  return labels.length ? labels.join(', ') : 'No capabilities negotiated'
}
