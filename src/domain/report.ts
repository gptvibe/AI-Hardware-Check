import type { ModelDatabaseEntry } from './compatibility'
import { formatRam, getConfidenceLabel } from './formatters'
import { getInstallWizardGuides, type InstallWizardOs } from './installGuides'
import type { HardwareProfile } from './systemHardware'
import type {
  ComputePreference,
  HardwareConfidenceSummary,
  RankedRecommendation,
  RuntimeId,
  UserGoal,
} from './types'

export type ShareableReportRecommendation = {
  slot: string
  modelName: string
  provider: string
  parameterCount: string
  recommendedQuant: string | null
  shortReason: string
  riskLevel: 'low' | 'medium' | 'high'
  installReadinessScore: number
}

export type ShareableReportInstallStep = {
  title: string
  description: string
  command: string
  optional?: boolean
}

export type ShareableReport = {
  generatedAtIso: string
  selectedRuntime: RuntimeId
  selectedGoal: UserGoal
  confidenceLevel: 'high' | 'medium' | 'low'
  confidenceLabel: string
  confidenceHeadline: string
  detectedHardware: {
    platform: string
    cpuCores: number | null
    ram: string
    gpuRenderer: string
    gpuVendor: string
    webgpu: boolean
    performanceTier: string
    computePreference: ComputePreference
  }
  topRecommendations: ShareableReportRecommendation[]
  installGuide: {
    os: InstallWizardOs
    runtime: 'ollama' | 'lmstudio' | null
    modelName: string | null
    quant: string | null
    steps: ShareableReportInstallStep[]
  }
  caveats: string[]
  comparedModels: Array<{
    name: string
    provider: string
    parameterCount: string
  }>
}

const hashPrefix = 'report='

export const inferInstallWizardOs = (platform: string): InstallWizardOs => {
  const normalized = platform.toLowerCase()
  if (normalized.includes('mac')) return 'macos'
  if (normalized.includes('win')) return 'windows'
  return 'linux'
}

const runtimeLabelMap: Record<RuntimeId, string> = {
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  llamacpp: 'llama.cpp',
}

export const buildReportCaveats = ({
  benchmarkConfidence,
  benchmarkFreshnessLabel,
  benchmarkSource,
  confidenceSummary,
  runtimePreference,
  topRecommendations,
}: {
  benchmarkConfidence: 'high' | 'medium' | 'low'
  benchmarkFreshnessLabel: string
  benchmarkSource: string | null
  confidenceSummary: HardwareConfidenceSummary
  runtimePreference: RuntimeId
  topRecommendations: RankedRecommendation[]
}) => {
  const caveats: string[] = []

  if (confidenceSummary.level !== 'high') {
    caveats.push(
      `Hardware detection confidence is ${confidenceSummary.level}; verify ${confidenceSummary.uncertainFields.join(', ')} before treating these recommendations as final.`,
    )
  }

  if (benchmarkSource) {
    caveats.push(
      `Current speed estimates are calibrated with ${benchmarkSource} benchmark data. ${benchmarkFreshnessLabel}. Confidence: ${benchmarkConfidence}.`,
    )
  } else {
    caveats.push('No saved benchmark is available yet, so runtime speed estimates are still heuristic.')
  }

  if (runtimePreference === 'llamacpp') {
    caveats.push('The report keeps install steps focused on Ollama and LM Studio. llama.cpp remains available in advanced mode only.')
  }

  if (topRecommendations.some((entry) => entry.riskLevel !== 'low')) {
    caveats.push('At least one highlighted recommendation carries medium or high risk, usually because memory headroom or runtime confidence is tight.')
  }

  return caveats
}

export const buildShareableReport = ({
  benchmarkConfidence,
  benchmarkFreshnessLabel,
  benchmarkSource,
  comparedModels,
  computePreference,
  confidenceSummary,
  hardwareProfile,
  runtimePreference,
  selectedGoal,
  selectedInstallModel,
  selectedInstallQuant,
  topRecommendations,
}: {
  benchmarkConfidence: 'high' | 'medium' | 'low'
  benchmarkFreshnessLabel: string
  benchmarkSource: string | null
  comparedModels: ModelDatabaseEntry[]
  computePreference: ComputePreference
  confidenceSummary: HardwareConfidenceSummary
  hardwareProfile: HardwareProfile
  runtimePreference: RuntimeId
  selectedGoal: UserGoal
  selectedInstallModel: ModelDatabaseEntry | null
  selectedInstallQuant: string | null
  topRecommendations: Array<{ slot: string; recommendation: RankedRecommendation | null }>
}): ShareableReport => {
  const installOs = inferInstallWizardOs(hardwareProfile.system.platform)
  const installGuide = selectedInstallModel
    ? getInstallWizardGuides({
        model: selectedInstallModel,
        quant: selectedInstallQuant,
      })
        .find((entry) => entry.os === installOs)
        ?.runtimeGuides.find((guide) => guide.runtime === (runtimePreference === 'lmstudio' ? 'lmstudio' : 'ollama'))
    : null

  const normalizedTopRecommendations = topRecommendations
    .filter((entry): entry is { slot: string; recommendation: RankedRecommendation } => Boolean(entry.recommendation))
    .map((entry) => ({
      slot: entry.slot,
      modelName: entry.recommendation.model.name,
      provider: entry.recommendation.model.provider,
      parameterCount: entry.recommendation.model.parameter_count,
      recommendedQuant: entry.recommendation.recommendedQuant,
      shortReason: entry.recommendation.shortReason,
      riskLevel: entry.recommendation.riskLevel,
      installReadinessScore: entry.recommendation.installReadinessScore,
    }))

  return {
    generatedAtIso: new Date().toISOString(),
    selectedRuntime: runtimePreference,
    selectedGoal,
    confidenceLevel: confidenceSummary.level,
    confidenceLabel: getConfidenceLabel(hardwareProfile.confidenceScore),
    confidenceHeadline: confidenceSummary.headline,
    detectedHardware: {
      platform: hardwareProfile.system.platform,
      cpuCores: hardwareProfile.system.cpuCores,
      ram: formatRam(hardwareProfile.system.ramGb),
      gpuRenderer: hardwareProfile.gpu.renderer,
      gpuVendor: hardwareProfile.gpu.vendor,
      webgpu: hardwareProfile.system.webgpu,
      performanceTier: hardwareProfile.performanceTier,
      computePreference,
    },
    topRecommendations: normalizedTopRecommendations,
    installGuide: {
      os: installOs,
      runtime: installGuide?.runtime || null,
      modelName: selectedInstallModel?.name || null,
      quant: selectedInstallQuant,
      steps:
        installGuide?.steps.map((step) => ({
          title: step.title,
          description: step.description,
          command: step.command,
          optional: step.optional,
        })) || [],
    },
    caveats: buildReportCaveats({
      benchmarkConfidence,
      benchmarkFreshnessLabel,
      benchmarkSource,
      confidenceSummary,
      runtimePreference,
      topRecommendations: normalizedTopRecommendations.map((entry) => {
        const full = topRecommendations.find((item) => item.slot === entry.slot)?.recommendation
        return full!
      }),
    }),
    comparedModels: comparedModels.map((model) => ({
      name: model.name,
      provider: model.provider,
      parameterCount: model.parameter_count,
    })),
  }
}

export const formatShareableReportSummary = (report: ShareableReport) => {
  const recommendations = report.topRecommendations
    .map((entry, index) => `${index + 1}. ${entry.slot}: ${entry.modelName}${entry.recommendedQuant ? ` (${entry.recommendedQuant})` : ''}`)
    .join('\n')

  return [
    `Hardware: ${report.detectedHardware.platform}, ${report.detectedHardware.ram}, ${report.detectedHardware.gpuRenderer}`,
    `Confidence: ${report.confidenceLabel}`,
    `Runtime: ${runtimeLabelMap[report.selectedRuntime]}`,
    'Top recommendations:',
    recommendations || 'No recommendations available.',
    `Caveats: ${report.caveats.join(' ')}`,
  ].join('\n')
}

export const formatShareableReportMarkdown = (report: ShareableReport) => {
  const installSteps = report.installGuide.steps.length
    ? report.installGuide.steps
        .map((step, index) =>
          `${index + 1}. **${step.title}**${step.optional ? ' (Optional)' : ''}\n${step.description}\n\n\`\`\`\n${step.command}\n\`\`\``,
        )
        .join('\n\n')
    : 'No install guide is available for the current selection.'

  const topRecommendations = report.topRecommendations.length
    ? report.topRecommendations
        .map(
          (entry, index) =>
            `${index + 1}. **${entry.slot}**: ${entry.modelName} (${entry.provider}, ${entry.parameterCount})${entry.recommendedQuant ? `, recommended ${entry.recommendedQuant}` : ''}\nRisk: ${entry.riskLevel}. Install readiness: ${entry.installReadinessScore}/100.\n${entry.shortReason}`,
        )
        .join('\n\n')
    : 'No recommendations available.'

  const caveats = report.caveats.map((entry) => `- ${entry}`).join('\n') || '- None'

  return [
    '# AI Hardware Check Report',
    '',
    `Generated: ${report.generatedAtIso}`,
    '',
    '## Detected Hardware',
    `- Platform: ${report.detectedHardware.platform}`,
    `- CPU threads: ${report.detectedHardware.cpuCores ?? '--'}`,
    `- RAM: ${report.detectedHardware.ram}`,
    `- GPU: ${report.detectedHardware.gpuRenderer} (${report.detectedHardware.gpuVendor})`,
    `- WebGPU: ${report.detectedHardware.webgpu ? 'Yes' : 'No'}`,
    `- Performance tier: ${report.detectedHardware.performanceTier}`,
    `- Compute preference: ${report.detectedHardware.computePreference}`,
    '',
    '## Confidence',
    `- ${report.confidenceLabel}`,
    `- ${report.confidenceHeadline}`,
    '',
    '## Top 3 Recommendations',
    topRecommendations,
    '',
    '## Selected Runtime',
    `- ${runtimeLabelMap[report.selectedRuntime]}`,
    '',
    '## Install Steps',
    `- OS: ${report.installGuide.os}`,
    `- Runtime: ${report.installGuide.runtime ? runtimeLabelMap[report.installGuide.runtime] : 'None'}`,
    `- Model: ${report.installGuide.modelName || 'None'}`,
    `- Quant: ${report.installGuide.quant || 'None'}`,
    '',
    installSteps,
    '',
    '## Caveats',
    caveats,
  ].join('\n')
}

export const serializeShareableReport = (report: ShareableReport) =>
  encodeURIComponent(JSON.stringify(report))

export const parseShareableReport = (value: string): ShareableReport | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as ShareableReport
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.topRecommendations) || !Array.isArray(parsed.caveats)) return null
    return parsed
  } catch {
    return null
  }
}

export const getReportHash = (report: ShareableReport) =>
  `#${hashPrefix}${serializeShareableReport(report)}`

export const readReportFromHash = (hash: string) => {
  if (!hash.startsWith(`#${hashPrefix}`)) return null
  return parseShareableReport(hash.slice(hashPrefix.length + 1))
}
