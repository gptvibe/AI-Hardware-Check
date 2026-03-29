import { useMemo, useState } from 'react'
import {
  classifyRuntimeDetection,
  getInstallWizardGuides,
  type BrowserDetectedRuntime,
  type InstallWizardOs,
  type ModelDatabaseEntry,
  type RuntimeDetectionResult,
} from '../../domain'
import { detectBrowserRuntime, downloadTextFile } from '../../utils'

type InstallWizardProps = {
  copiedCommand: string | null
  experienceMode: 'beginner' | 'advanced'
  model: ModelDatabaseEntry
  onCopyCommand: (command: string) => void | Promise<void>
  preferredRuntime?: 'ollama' | 'lmstudio'
  quant: string | null
}

type RuntimeDetectionUiState =
  | {
      runtime: BrowserDetectedRuntime
      state: 'idle' | 'checking'
      title: string
      detail: string
      help?: string
    }
  | RuntimeDetectionResult

const createIdleDetectionState = (
  runtime: BrowserDetectedRuntime,
): RuntimeDetectionUiState => ({
  runtime,
  state: 'idle',
  title: 'Optional runtime check',
  detail: `Probe localhost for ${runtime === 'ollama' ? 'Ollama on port 11434' : 'LM Studio on port 1234'} without sending data to a backend.`,
})

const detectionStyles: Record<
  RuntimeDetectionUiState['state'],
  string
> = {
  idle: 'bg-slate-100 text-slate-700 border border-slate-200',
  checking: 'bg-sky-100 text-sky-700 border border-sky-200',
  healthy: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'installed-not-running': 'bg-amber-100 text-amber-700 border border-amber-200',
  'not-detected': 'bg-slate-100 text-slate-700 border border-slate-200',
  blocked: 'bg-rose-100 text-rose-700 border border-rose-200',
}

export function InstallWizard({
  copiedCommand,
  experienceMode,
  model,
  onCopyCommand,
  preferredRuntime = 'ollama',
  quant,
}: InstallWizardProps) {
  const guides = useMemo(
    () => getInstallWizardGuides({ model, quant }),
    [model, quant],
  )
  const [activeOs, setActiveOs] = useState<InstallWizardOs>('windows')
  const [installedHints, setInstalledHints] = useState<Record<BrowserDetectedRuntime, boolean>>({
    ollama: false,
    lmstudio: false,
  })
  const [runtimeDetection, setRuntimeDetection] = useState<
    Record<BrowserDetectedRuntime, RuntimeDetectionUiState>
  >({
    ollama: createIdleDetectionState('ollama'),
    lmstudio: createIdleDetectionState('lmstudio'),
  })

  const activeGuide = guides.find((guide) => guide.os === activeOs) || guides[0]
  const runtimeGuides = useMemo(() => {
    if (!activeGuide) return []
    return [...activeGuide.runtimeGuides].sort((left, right) => {
      if (left.runtime === preferredRuntime && right.runtime !== preferredRuntime) return -1
      if (right.runtime === preferredRuntime && left.runtime !== preferredRuntime) return 1
      return left.label.localeCompare(right.label)
    })
  }, [activeGuide, preferredRuntime])

  if (!activeGuide) return null

  const handleDetectRuntime = async (runtime: BrowserDetectedRuntime) => {
    setRuntimeDetection((current) => ({
      ...current,
      [runtime]: {
        runtime,
        state: 'checking',
        title: 'Checking localhost',
        detail:
          runtime === 'ollama'
            ? 'Trying to reach Ollama on http://localhost:11434 ...'
            : 'Trying to reach LM Studio on http://localhost:1234 ...',
      },
    }))

    const result = await detectBrowserRuntime({
      runtime,
      installedHint: installedHints[runtime],
    })

    setRuntimeDetection((current) => ({
      ...current,
      [runtime]: result,
    }))
  }

  const handleMarkInstalled = (runtime: BrowserDetectedRuntime) => {
    setInstalledHints((current) => ({
      ...current,
      [runtime]: true,
    }))
    setRuntimeDetection((current) => ({
      ...current,
      [runtime]: classifyRuntimeDetection({
        runtime,
        installedHint: true,
      }),
    }))
  }

  return (
    <div className="install-wizard mt-5">
      <div className="install-wizard-head">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Guided install wizard
          </div>
          <h3 className="mt-2 text-lg font-semibold">
            {experienceMode === 'beginner'
              ? 'Start with one install path, keep the fallback close'
              : 'Compare both runtime paths for this model'}
          </h3>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Using <span className="mono">{model.name}</span>
            {quant ? ` with ${quant}` : ''}. The recommended runtime is highlighted first.
          </p>
        </div>
        <div className="install-wizard-tabs" role="tablist" aria-label="Operating systems">
          {guides.map((guide) => (
            <button
              key={guide.os}
              type="button"
              className={`install-wizard-tab ${guide.os === activeOs ? 'active' : ''}`}
              onClick={() => setActiveOs(guide.os)}
              role="tab"
              aria-selected={guide.os === activeOs}
            >
              {guide.label}
            </button>
          ))}
        </div>
      </div>

      <div className="install-runtime-grid mt-4">
        {runtimeGuides.map((guide) => (
          <section key={`${activeOs}-${guide.runtime}`} className="install-runtime-card">
            {(() => {
              const detection = runtimeDetection[guide.runtime]

              return (
                <div className={`runtime-detection ${detectionStyles[detection.state]}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="runtime-detection-title">{detection.title}</div>
                      <p className="mt-1 text-sm">{detection.detail}</p>
                      {detection.help ? (
                        <p className="mt-2 text-xs opacity-85">{detection.help}</p>
                      ) : null}
                    </div>
                    <div className="runtime-recipe-actions">
                      <button
                        type="button"
                        className="pill-button"
                        onClick={() => void handleDetectRuntime(guide.runtime)}
                        disabled={detection.state === 'checking'}
                      >
                        {detection.state === 'checking'
                          ? 'Checking...'
                          : detection.state === 'idle'
                            ? 'Check runtime'
                            : 'Retry check'}
                      </button>
                      {detection.state === 'not-detected' ? (
                        <button
                          type="button"
                          className="pill-button"
                          onClick={() => handleMarkInstalled(guide.runtime)}
                        >
                          I already installed this
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })()}
            <div className="runtime-recipe-head">
              <div>
                <div className="runtime-recipe-label">{guide.label}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="status-pill bg-slate-100 text-slate-700 border border-slate-200">
                    Default endpoint {guide.portLabel}
                  </span>
                  {guide.runtime === preferredRuntime ? (
                    <span className="status-pill bg-emerald-100 text-emerald-700 border border-emerald-200">
                      {experienceMode === 'beginner' ? 'Recommended path' : 'Current preference'}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="runtime-recipe-actions">
                <a
                  className="pill-button"
                  href={guide.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official docs
                </a>
                <button
                  type="button"
                  className="pill-button"
                  onClick={() => void onCopyCommand(guide.copyAllText)}
                >
                  {copiedCommand === guide.copyAllText ? 'Copied' : 'Copy all steps'}
                </button>
              </div>
            </div>

            <div className="install-script-row mt-4">
              {guide.scripts.map((script) => (
                <button
                  key={script.fileName}
                  type="button"
                  className="pill-button"
                  onClick={() => downloadTextFile(script.fileName, script.content)}
                >
                  Download {script.fileName}
                </button>
              ))}
            </div>

            <div className="install-step-list mt-4">
              {guide.steps.map((step, index) => (
                <div key={step.id} className="install-step">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="install-step-title">
                        {index + 1}. {step.title}
                        {step.optional ? (
                          <span className="install-step-optional">Optional</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {step.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="pill-button"
                      onClick={() => void onCopyCommand(step.command)}
                    >
                      {copiedCommand === step.command ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="install-step-command mono">{step.command}</pre>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
