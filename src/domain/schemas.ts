import { z } from 'zod'

const stringArraySchema = z.array(z.string().min(1))

const recordOfStringSchema = z.record(z.string(), z.string().min(1))
const recordOfNumberSchema = z.record(z.string(), z.number().finite())

const runtimeRecipeTemplatesSchema = z.object({
  ollama: z.string().min(1).optional(),
  lmstudio: z.string().min(1).optional(),
  llamacpp: z.string().min(1).optional(),
})

const backendSupportSchema = z.object({
  cpu: z.boolean().default(true),
  cuda: z.boolean().default(false),
  rocm: z.boolean().default(false),
  metal: z.boolean().default(false),
  vulkan: z.boolean().default(false),
  directml: z.boolean().default(false),
})

export const CompanionCapabilityFlagsSchema = z.object({
  totalRam: z.boolean().default(false),
  freeRam: z.boolean().default(false),
  gpuModel: z.boolean().default(false),
  vram: z.boolean().default(false),
  backendSupport: z.boolean().default(false),
  installedRuntimes: z.boolean().default(false),
  localModels: z.boolean().default(false),
})

export const CompanionInstalledRuntimeSchema = z.object({
  id: z.enum(['ollama', 'lmstudio', 'llamacpp', 'other']),
  name: z.string().min(1),
  version: z.string().min(1).optional(),
  running: z.boolean().optional(),
  defaultPort: z.number().int().positive().optional(),
})

export const CompanionLocalModelSchema = z.object({
  id: z.string().min(1),
  runtime: z.enum(['ollama', 'lmstudio', 'llamacpp', 'other']),
  displayName: z.string().min(1),
  provider: z.string().min(1).optional(),
  parameterCount: z.string().min(1).optional(),
  quant: z.string().min(1).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
})

export const CompanionGpuSchema = z.object({
  model: z.string().min(1),
  vendor: z.string().min(1).optional(),
  vramBytes: z.number().int().nonnegative().optional(),
  backendSupport: backendSupportSchema.optional(),
})

export const LocalCompanionHardwareInfoSchema = z.object({
  timestampIso: z.string().min(1),
  machine: z.object({
    os: z.string().min(1),
    arch: z.string().min(1).optional(),
    hostname: z.string().min(1).optional(),
  }),
  memory: z.object({
    totalRamBytes: z.number().int().positive().optional(),
    freeRamBytes: z.number().int().nonnegative().optional(),
  }),
  gpus: z.array(CompanionGpuSchema).default([]),
  installedRuntimes: z.array(CompanionInstalledRuntimeSchema).default([]),
  localModels: z.array(CompanionLocalModelSchema).default([]),
  notes: z.array(z.string().min(1)).default([]),
})

const companionProtocolSchema = z.literal('aihc-companion.v1')
const companionRequestIdSchema = z.string().min(1)

export const CompanionHelloRequestSchema = z.object({
  protocol: companionProtocolSchema,
  type: z.literal('hello'),
  requestId: companionRequestIdSchema,
  client: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
  requestedCapabilities: CompanionCapabilityFlagsSchema.partial().optional(),
})

export const CompanionHelloAckSchema = z.object({
  protocol: companionProtocolSchema,
  type: z.literal('hello-ack'),
  requestId: companionRequestIdSchema,
  sessionId: z.string().min(1),
  companion: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
  capabilities: CompanionCapabilityFlagsSchema,
})

export const CompanionHardwareSnapshotRequestSchema = z.object({
  protocol: companionProtocolSchema,
  type: z.literal('get-hardware-snapshot'),
  requestId: companionRequestIdSchema,
  sessionId: z.string().min(1),
})

export const CompanionHardwareSnapshotResponseSchema = z.object({
  protocol: companionProtocolSchema,
  type: z.literal('hardware-snapshot'),
  requestId: companionRequestIdSchema,
  sessionId: z.string().min(1),
  hardware: LocalCompanionHardwareInfoSchema,
})

export const CompanionErrorMessageSchema = z.object({
  protocol: companionProtocolSchema,
  type: z.literal('error'),
  requestId: companionRequestIdSchema.optional(),
  message: z.string().min(1),
})

export const LocalCompanionMessageSchema = z.union([
  CompanionHelloRequestSchema,
  CompanionHelloAckSchema,
  CompanionHardwareSnapshotRequestSchema,
  CompanionHardwareSnapshotResponseSchema,
  CompanionErrorMessageSchema,
])

const runtimeBenchmarkSampleSchema = z.object({
  promptTokens: z.number().finite().nullable().optional(),
  completionTokens: z.number().finite().nullable().optional(),
  firstTokenLatencyMs: z.number().finite().nullable().optional(),
  decodeTokensPerSecond: z.number().finite().nullable().optional(),
  prefillTokensPerSecond: z.number().finite().nullable().optional(),
})

export const ModelDatabaseEntrySchema = z.object({
  name: z.string().min(1),
  provider: z.string().min(1).default('Other'),
  family: z.string().min(1).optional(),
  release_date: z.string().min(1).optional(),
  deployment: z.enum(['local', 'api']).optional(),
  huggingface_repo: z.string().min(1).optional(),
  quant_download_links: recordOfStringSchema.optional(),
  parameter_count: z.string().min(1),
  modalities: stringArraySchema.optional(),
  formats: stringArraySchema.default([]),
  ram_requirements_gb: recordOfNumberSchema.default({}),
  notes: z.string().min(1).optional(),
  active_params_b: z.number().finite().positive().optional(),
  context_windows: z.array(z.number().int().positive()).optional(),
  runtime_recipe_templates: runtimeRecipeTemplatesSchema.optional(),
  userAdded: z.boolean().optional(),
})

export const UserAddedModelSchema = ModelDatabaseEntrySchema.extend({
  userAdded: z.literal(true).default(true),
})

export const BenchmarkResultSchema = z.object({
  source: z.enum(['synthetic', 'ollama', 'lmstudio']).default('synthetic'),
  scoreOpsPerSec: z.number().finite().optional(),
  suggestedMultiplier: z.number().finite(),
  completedAtIso: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  benchmarkModel: z.string().min(1).optional(),
  benchmarkParamsB: z.number().finite().positive().nullable().optional(),
  benchmarkQuant: z.string().min(1).nullable().optional(),
  shortPrompt: runtimeBenchmarkSampleSchema.optional(),
  prefillPrompt: runtimeBenchmarkSampleSchema.optional(),
  notes: z.string().min(1).optional(),
})

export const StoredBenchmarkResultsSchema = z.object({
  synthetic: BenchmarkResultSchema.optional(),
  ollama: BenchmarkResultSchema.optional(),
  lmstudio: BenchmarkResultSchema.optional(),
})

const formatPath = (path: PropertyKey[]) =>
  path.length === 0 ? 'root' : path.map(String).join('.')

export const formatValidationIssues = (issues: z.ZodIssue[], maxIssues = 4) => {
  const visibleIssues = issues.slice(0, maxIssues)
  const details = visibleIssues.map((issue) => {
    const path = formatPath(issue.path)
    return `${path}: ${issue.message}`
  })
  const hiddenCount = issues.length - visibleIssues.length
  if (hiddenCount > 0) {
    details.push(`and ${hiddenCount} more issue${hiddenCount === 1 ? '' : 's'}`)
  }
  return details.join('; ')
}

export const getCatalogValidationErrorMessage = (issues: z.ZodIssue[]) =>
  `Model catalog contains invalid entries. ${formatValidationIssues(issues)}.`

export type ModelDatabaseEntryInput = z.infer<typeof ModelDatabaseEntrySchema>
export type UserAddedModelInput = z.infer<typeof UserAddedModelSchema>
export type BenchmarkResultInput = z.infer<typeof BenchmarkResultSchema>
export type StoredBenchmarkResultsInput = z.infer<typeof StoredBenchmarkResultsSchema>
export type CompanionCapabilityFlagsInput = z.infer<typeof CompanionCapabilityFlagsSchema>
export type LocalCompanionHardwareInfoInput = z.infer<typeof LocalCompanionHardwareInfoSchema>
export type CompanionHelloRequestInput = z.infer<typeof CompanionHelloRequestSchema>
export type CompanionHelloAckInput = z.infer<typeof CompanionHelloAckSchema>
export type CompanionHardwareSnapshotRequestInput = z.infer<typeof CompanionHardwareSnapshotRequestSchema>
export type CompanionHardwareSnapshotResponseInput = z.infer<typeof CompanionHardwareSnapshotResponseSchema>
export type LocalCompanionMessageInput = z.infer<typeof LocalCompanionMessageSchema>
