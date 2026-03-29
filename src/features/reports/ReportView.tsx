import {
  formatShareableReportMarkdown,
  formatShareableReportSummary,
  getReportHash,
  type ShareableReport,
} from '../../domain'
import { copyTextToClipboard, downloadTextFile } from '../../utils'

type ReportViewProps = {
  onBack?: () => void
  report: ShareableReport
}

const runtimeLabels = {
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  llamacpp: 'llama.cpp',
} as const

export function ReportView({ onBack, report }: ReportViewProps) {
  const handleExportMarkdown = () => {
    downloadTextFile('ai-hardware-check-report.md', formatShareableReportMarkdown(report))
  }

  const handleExportJson = () => {
    downloadTextFile('ai-hardware-check-report.json', JSON.stringify(report, null, 2))
  }

  const handleCopySummary = async () => {
    await copyTextToClipboard(formatShareableReportSummary(report))
  }

  const handleCopyShareLink = async () => {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}${window.location.pathname}${getReportHash(report)}`
    await copyTextToClipboard(url)
  }

  return (
    <section className="card p-6 report-view">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Shareable report
          </div>
          <h1 className="mt-2 text-2xl font-semibold">AI Hardware Check Report</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Generated {new Date(report.generatedAtIso).toLocaleString()}.
          </p>
        </div>
        <div className="runtime-recipe-actions">
          {onBack ? (
            <button
              type="button"
              className="pill-button"
              onClick={onBack}
            >
              Back to app
            </button>
          ) : null}
          <button type="button" className="pill-button" onClick={() => void handleCopyShareLink()}>
            Copy share link
          </button>
          <button type="button" className="pill-button" onClick={() => void handleCopySummary()}>
            Copy summary
          </button>
          <button type="button" className="pill-button" onClick={handleExportMarkdown}>
            Export Markdown
          </button>
          <button type="button" className="pill-button" onClick={handleExportJson}>
            Export JSON
          </button>
        </div>
      </div>

      <div className="mt-6 report-grid">
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">Detected hardware</div>
          <div className="mt-2 text-sm">
            <div>{report.detectedHardware.platform}</div>
            <div>{report.detectedHardware.ram}</div>
            <div>{report.detectedHardware.gpuRenderer}</div>
            <div>{report.detectedHardware.webgpu ? 'WebGPU available' : 'WebGPU unavailable'}</div>
          </div>
        </div>
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">Confidence</div>
          <div className="mt-2 text-lg font-semibold">{report.confidenceLabel}</div>
          <p className="mt-2 text-sm text-[color:var(--muted)]">{report.confidenceHeadline}</p>
        </div>
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">Selected runtime</div>
          <div className="mt-2 text-lg font-semibold">{runtimeLabels[report.selectedRuntime]}</div>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Goal: {report.selectedGoal}</p>
        </div>
      </div>

      <div className="mt-6 report-section">
        <h2 className="text-lg font-semibold">Top 3 recommendations</h2>
        <div className="mt-3 compare-grid">
          {report.topRecommendations.map((entry) => (
            <div key={entry.slot} className="stat">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {entry.slot}
              </div>
              <div className="mt-2 text-lg font-semibold">{entry.modelName}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {entry.provider} · {entry.parameterCount}
                {entry.recommendedQuant ? ` · ${entry.recommendedQuant}` : ''}
              </div>
              <p className="mt-3 text-sm text-[color:var(--muted)]">{entry.shortReason}</p>
              <div className="mt-3 text-xs text-[color:var(--muted)]">
                Risk: {entry.riskLevel} · Install readiness {entry.installReadinessScore}/100
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 report-section">
        <h2 className="text-lg font-semibold">Install steps</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          {report.installGuide.runtime
            ? `${runtimeLabels[report.installGuide.runtime]} on ${report.installGuide.os} for ${report.installGuide.modelName}${report.installGuide.quant ? ` using ${report.installGuide.quant}` : ''}.`
            : 'No install guide available for the current selection.'}
        </p>
        <div className="mt-4 install-step-list">
          {report.installGuide.steps.map((step, index) => (
            <div key={`${step.title}-${index}`} className="install-step">
              <div className="install-step-title">
                {index + 1}. {step.title}
                {step.optional ? <span className="install-step-optional">Optional</span> : null}
              </div>
              <p className="mt-1 text-sm text-[color:var(--muted)]">{step.description}</p>
              <pre className="install-step-command mono">{step.command}</pre>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 report-section">
        <h2 className="text-lg font-semibold">Caveats</h2>
        <div className="mt-3 space-y-3">
          {report.caveats.map((entry) => (
            <div key={entry} className="stat text-sm text-[color:var(--muted)]">
              {entry}
            </div>
          ))}
        </div>
      </div>

      {report.comparedModels.length > 0 ? (
        <div className="mt-6 report-section">
          <h2 className="text-lg font-semibold">Compared models</h2>
          <div className="mt-3 compare-grid">
            {report.comparedModels.map((model) => (
              <div key={`${model.provider}-${model.name}`} className="stat">
                <div className="text-lg font-semibold">{model.name}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  {model.provider} · {model.parameterCount}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
