import type { ModelDatabaseEntry } from './compatibility'
import { OLLAMA_INSTALL_COMMAND } from './constants'
import type { RuntimeId } from './types'

const DIRECT_DOWNLOAD_FORMATS = new Set(['FP16', 'BF16', 'FP8', 'Safetensors'])

export type InstallWizardOs = 'windows' | 'macos' | 'linux'
export type InstallWizardRuntime = 'ollama' | 'lmstudio'
export type InstallWizardStepId =
  | 'install'
  | 'verify'
  | 'download'
  | 'run'
  | 'api'

export type InstallWizardStep = {
  id: InstallWizardStepId
  title: string
  description: string
  command: string
  optional?: boolean
}

export type InstallWizardScript = {
  fileName: string
  label: string
  content: string
}

export type RuntimeInstallGuide = {
  runtime: InstallWizardRuntime
  label: string
  officialUrl: string
  defaultPort: number
  portLabel: string
  steps: InstallWizardStep[]
  scripts: InstallWizardScript[]
  copyAllText: string
}

export type InstallWizardOsGuide = {
  os: InstallWizardOs
  label: string
  runtimeGuides: RuntimeInstallGuide[]
}

export type InstallWizardInput = {
  model: ModelDatabaseEntry
  quant: string | null
}

const INSTALL_WIZARD_OSS: InstallWizardOs[] = ['windows', 'macos', 'linux']

const OLLAMA_DOWNLOAD_URLS: Record<InstallWizardOs, string> = {
  windows: 'https://ollama.com/download/windows',
  macos: 'https://ollama.com/download/mac',
  linux: 'https://ollama.com/download/linux',
}

const LM_STUDIO_DOWNLOAD_URL = 'https://lmstudio.ai/download'

export const OLLAMA_DEFAULT_PORT = 11434
export const LM_STUDIO_DEFAULT_PORT = 1234

const fillTemplate = (
  template: string,
  values: Record<string, string>,
) => template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => values[key] || '')

const joinLines = (lines: string[]) => lines.filter(Boolean).join('\n')

const getOsLabelMap: Record<InstallWizardOs, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
}

const getOllamaModelRef = (
  model: ModelDatabaseEntry,
  quant: string | null,
): string => {
  if (!model.huggingface_repo) {
    return model.name
  }
  return `hf.co/${model.huggingface_repo}:${(quant || 'Q4_K_M').toLowerCase()}`
}

const getLmStudioModelRef = (model: ModelDatabaseEntry) =>
  model.huggingface_repo || model.name

const getVerifyOllamaCommand = () => 'ollama --version'

const getOllamaApiCommand = (
  os: InstallWizardOs,
  model: ModelDatabaseEntry,
  quant: string | null,
) => {
  const modelRef = getOllamaModelRef(model, quant)
  if (os === 'windows') {
    return joinLines([
      `$body = @{ model = '${modelRef}'; prompt = 'Hello from localhost'; stream = $false } | ConvertTo-Json`,
      `Invoke-RestMethod -Method Post -Uri "http://localhost:${OLLAMA_DEFAULT_PORT}/api/generate" -ContentType "application/json" -Body $body`,
    ])
  }

  return `curl http://localhost:${OLLAMA_DEFAULT_PORT}/api/generate -d '{"model":"${modelRef}","prompt":"Hello from localhost","stream":false}'`
}

const getOllamaInstallCommand = (os: InstallWizardOs) => {
  if (os === 'windows') {
    return `Start-Process "${OLLAMA_DOWNLOAD_URLS.windows}"`
  }
  return OLLAMA_INSTALL_COMMAND
}

const getLmStudioInstallCommand = (os: InstallWizardOs) =>
  os === 'windows'
    ? 'irm https://lmstudio.ai/install.ps1 | iex'
    : 'curl -fsSL https://lmstudio.ai/install.sh | bash'

const getLmStudioVerifyCommand = () => 'lms --help'

const getOllamaInstallScript = (os: InstallWizardOs) => {
  if (os === 'windows') {
    return joinLines([
      `$ErrorActionPreference = 'Stop'`,
      `Write-Host 'Opening the official Ollama Windows download page...'`,
      `Start-Process '${OLLAMA_DOWNLOAD_URLS.windows}'`,
      `Write-Host 'Finish the installer, then run: ollama --version'`,
    ])
  }

  return joinLines([
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    OLLAMA_INSTALL_COMMAND,
    'ollama --version',
  ])
}

const getRunModelScript = (
  os: InstallWizardOs,
  model: ModelDatabaseEntry,
  quant: string | null,
) => {
  const modelRef = getOllamaModelRef(model, quant)
  if (os === 'windows') {
    return joinLines([
      `$ErrorActionPreference = 'Stop'`,
      `$model = '${modelRef}'`,
      'ollama pull $model',
      'ollama run $model',
    ])
  }

  return joinLines([
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    `MODEL_REF="${modelRef}"`,
    'ollama pull "$MODEL_REF"',
    'ollama run "$MODEL_REF"',
  ])
}

const getLmStudioQuickstartScript = (
  os: InstallWizardOs,
  model: ModelDatabaseEntry,
) => {
  const modelRef = getLmStudioModelRef(model)
  if (os === 'windows') {
    return joinLines([
      `$ErrorActionPreference = 'Stop'`,
      'irm https://lmstudio.ai/install.ps1 | iex',
      'lms --help',
      `lms get ${modelRef}`,
      `lms chat ${modelRef}`,
      `Write-Host 'Optional local API: lms server start --port ${LM_STUDIO_DEFAULT_PORT}'`,
    ])
  }

  return joinLines([
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'curl -fsSL https://lmstudio.ai/install.sh | bash',
    'lms --help',
    `lms get ${modelRef}`,
    `lms chat ${modelRef}`,
    `echo "Optional local API: lms server start --port ${LM_STUDIO_DEFAULT_PORT}"`,
  ])
}

const getScriptExtension = (os: InstallWizardOs) => (os === 'windows' ? 'ps1' : 'sh')

const buildCopyAllText = (
  os: InstallWizardOs,
  guide: Omit<RuntimeInstallGuide, 'copyAllText'>,
) =>
  joinLines([
    `${guide.label} setup for ${getInstallWizardOsLabel(os)}`,
    `Official download: ${guide.officialUrl}`,
    `Default local endpoint: ${guide.portLabel}`,
    '',
    ...guide.steps.flatMap((step, index) => [
      `${index + 1}. ${step.title}`,
      step.description,
      step.command,
      '',
    ]),
  ]).trim()

const buildOllamaGuide = ({
  os,
  model,
  quant,
}: InstallWizardInput & { os: InstallWizardOs }): RuntimeInstallGuide => {
  const modelRef = getOllamaModelRef(model, quant)
  const steps: InstallWizardStep[] = [
    {
      id: 'install',
      title: 'Install Ollama',
      description:
        os === 'windows'
          ? 'Open the official Ollama download page and run the Windows installer.'
          : 'Use the official Ollama install script, then confirm the CLI is available.',
      command: getOllamaInstallCommand(os),
    },
    {
      id: 'verify',
      title: 'Verify install',
      description: 'Confirm the Ollama CLI is on your PATH before pulling a model.',
      command: getVerifyOllamaCommand(),
    },
    {
      id: 'download',
      title: 'Download model',
      description: `Pull ${quant || 'the recommended quant'} into Ollama before the first run.`,
      command: `ollama pull ${modelRef}`,
    },
    {
      id: 'run',
      title: 'Run model',
      description: `Start an interactive local session for ${model.name}.`,
      command: getRuntimeRecipeCommand(model, 'ollama', quant) || `ollama run ${modelRef}`,
    },
    {
      id: 'api',
      title: 'Optional local API/server',
      description: `Ollama serves a local API on http://localhost:${OLLAMA_DEFAULT_PORT} while the app or service is running.`,
      command: getOllamaApiCommand(os, model, quant),
      optional: true,
    },
  ]

  const baseGuide = {
    runtime: 'ollama' as const,
    label: 'Ollama',
    officialUrl: OLLAMA_DOWNLOAD_URLS[os],
    defaultPort: OLLAMA_DEFAULT_PORT,
    portLabel: `http://localhost:${OLLAMA_DEFAULT_PORT}`,
    steps,
    scripts: [
      {
        fileName: `install-ollama.${getScriptExtension(os)}`,
        label: 'Install script',
        content: getOllamaInstallScript(os),
      },
      {
        fileName: `run-model.${getScriptExtension(os)}`,
        label: 'Run model script',
        content: getRunModelScript(os, model, quant),
      },
    ],
  }

  return {
    ...baseGuide,
    copyAllText: buildCopyAllText(os, baseGuide),
  }
}

const buildLmStudioGuide = ({
  os,
  model,
  quant,
}: InstallWizardInput & { os: InstallWizardOs }): RuntimeInstallGuide => {
  const modelRef = getLmStudioModelRef(model)
  const quantNote = quant ? `Prefer ${quant} when LM Studio shows multiple artifacts.` : 'Use the recommended quant shown above if multiple artifacts are available.'
  const steps: InstallWizardStep[] = [
    {
      id: 'install',
      title: 'Install LM Studio',
      description: 'Run the official LM Studio quickstart installer for your OS.',
      command: getLmStudioInstallCommand(os),
    },
    {
      id: 'verify',
      title: 'Verify install',
      description: 'Check that the LM Studio CLI is ready before downloading a model.',
      command: getLmStudioVerifyCommand(),
    },
    {
      id: 'download',
      title: 'Download model',
      description: quantNote,
      command: `lms get ${modelRef}`,
    },
    {
      id: 'run',
      title: 'Run model',
      description: `Open an interactive LM Studio terminal chat for ${model.name}.`,
      command: `lms chat ${modelRef}`,
    },
    {
      id: 'api',
      title: 'Optional local API/server',
      description: `Start LM Studio's local API server on http://localhost:${LM_STUDIO_DEFAULT_PORT}.`,
      command: `lms server start --port ${LM_STUDIO_DEFAULT_PORT}`,
      optional: true,
    },
  ]

  const baseGuide = {
    runtime: 'lmstudio' as const,
    label: 'LM Studio',
    officialUrl: LM_STUDIO_DOWNLOAD_URL,
    defaultPort: LM_STUDIO_DEFAULT_PORT,
    portLabel: `http://localhost:${LM_STUDIO_DEFAULT_PORT}`,
    steps,
    scripts: [
      {
        fileName: `lmstudio-quickstart.${getScriptExtension(os)}`,
        label: 'Quickstart script',
        content: getLmStudioQuickstartScript(os, model),
      },
    ],
  }

  return {
    ...baseGuide,
    copyAllText: buildCopyAllText(os, baseGuide),
  }
}

export const getInstallWizardOsLabel = (os: InstallWizardOs) => getOsLabelMap[os]

export const getInstallWizardGuides = ({
  model,
  quant,
}: InstallWizardInput): InstallWizardOsGuide[] =>
  INSTALL_WIZARD_OSS.map((os) => ({
    os,
    label: getInstallWizardOsLabel(os),
    runtimeGuides: [
      buildOllamaGuide({ os, model, quant }),
      buildLmStudioGuide({ os, model, quant }),
    ],
  }))

export const getModelRepoUrl = (repo: string) => `https://huggingface.co/${repo}`

export const getRepoModelSlug = (repo: string) => {
  const parts = repo.split('/')
  return parts[parts.length - 1] || repo
}

export const getQuantDownloadUrl = (
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

export const getQuantDownloadHint = (quant: string) =>
  DIRECT_DOWNLOAD_FORMATS.has(quant) ? 'Official repo' : 'Search Hugging Face'

export const getRuntimeRecipeCommand = (
  model: ModelDatabaseEntry,
  runtime: RuntimeId,
  quant: string | null,
): string | null => {
  const repo = model.huggingface_repo
  if (!repo) return null
  const quantTag = (quant || 'Q4_K_M').toLowerCase()
  const template = model.runtime_recipe_templates?.[runtime]

  if (template) {
    const context = String(model.context_windows?.[0] || 4096)
    return fillTemplate(template, {
      repo,
      slug: getRepoModelSlug(repo),
      quant: quant || 'Q4_K_M',
      quant_tag: quantTag,
      context,
    })
  }

  if (runtime === 'ollama') {
    return `ollama run hf.co/${repo}:${quantTag}`
  }
  if (runtime === 'lmstudio') {
    return `lms chat ${repo}`
  }
  return `llama-cli -hf ${repo} -ngl 999 -c ${model.context_windows?.[0] || 4096}`
}

export const getRuntimeDownloadUrl = (runtime: RuntimeId): string | null => {
  if (runtime === 'ollama') return 'https://ollama.com/download'
  if (runtime === 'lmstudio') return LM_STUDIO_DOWNLOAD_URL
  return null
}

export { OLLAMA_INSTALL_COMMAND }
