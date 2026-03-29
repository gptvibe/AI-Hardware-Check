import type { AppController } from '../../components'

type CalibrationControlsProps = {
  controller: AppController
}

const confidenceStyles = {
  high: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border border-amber-200',
  low: 'bg-slate-100 text-slate-700 border border-slate-200',
} as const

const freshnessStyles = {
  fresh: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  recent: 'bg-amber-100 text-amber-700 border border-amber-200',
  stale: 'bg-rose-100 text-rose-700 border border-rose-200',
  unknown: 'bg-slate-100 text-slate-700 border border-slate-200',
} as const

const sourceLabels = {
  synthetic: 'Synthetic fallback',
  ollama: 'Ollama runtime',
  lmstudio: 'LM Studio runtime',
} as const

export function CalibrationControls({ controller }: CalibrationControlsProps) {
  const activeResult = controller.benchmarkResult

  return (
    <div className="mt-4 benchmark-stack">
      <div className="calibration-row">
        <button
          type="button"
          className="pill-button"
          onClick={() => {
            void controller.runCalibration('ollama')
          }}
          disabled={controller.benchmarkState.runningTarget !== null}
        >
          {controller.benchmarkState.runningTarget === 'ollama'
            ? 'Benchmarking Ollama...'
            : 'Benchmark Ollama'}
        </button>
        <button
          type="button"
          className="pill-button"
          onClick={() => {
            void controller.runCalibration('lmstudio')
          }}
          disabled={controller.benchmarkState.runningTarget !== null}
        >
          {controller.benchmarkState.runningTarget === 'lmstudio'
            ? 'Benchmarking LM Studio...'
            : 'Benchmark LM Studio'}
        </button>
        <button
          type="button"
          className="pill-button"
          onClick={() => {
            void controller.runCalibration('synthetic')
          }}
          disabled={controller.benchmarkState.runningTarget !== null}
        >
          {controller.benchmarkState.runningTarget === 'synthetic'
            ? 'Running fallback...'
            : 'Run synthetic fallback'}
        </button>
      </div>

      <div className="text-xs text-[color:var(--muted)]">
        Runtime benchmarks use your local Ollama or LM Studio APIs when available. The synthetic benchmark remains the fallback when no runtime server is reachable.
      </div>

      {activeResult ? (
        <div className="benchmark-summary-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Active estimator calibration
              </div>
              <div className="mt-1 text-base font-semibold">
                {sourceLabels[activeResult.source]}
              </div>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Multiplier {activeResult.suggestedMultiplier.toFixed(2)}
                {activeResult.benchmarkModel ? ` using ${activeResult.benchmarkModel}` : ''}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`status-pill ${confidenceStyles[controller.benchmarkConfidence]}`}>
                Confidence: {controller.benchmarkConfidence}
              </span>
              <span className={`status-pill ${freshnessStyles[controller.benchmarkFreshness.level]}`}>
                {controller.benchmarkFreshness.label}
              </span>
            </div>
          </div>

          <div className="mt-4 benchmark-stat-grid">
            <div className="stat">
              <div className="text-[11px] uppercase text-[color:var(--muted)]">
                First token
              </div>
              <div className="text-lg font-semibold">
                {activeResult.shortPrompt?.firstTokenLatencyMs
                  ? `${activeResult.shortPrompt.firstTokenLatencyMs} ms`
                  : '--'}
              </div>
            </div>
            <div className="stat">
              <div className="text-[11px] uppercase text-[color:var(--muted)]">
                Decode throughput
              </div>
              <div className="text-lg font-semibold">
                {activeResult.shortPrompt?.decodeTokensPerSecond
                  ? `${activeResult.shortPrompt.decodeTokensPerSecond.toFixed(1)} tok/s`
                  : activeResult.scoreOpsPerSec
                    ? `${activeResult.scoreOpsPerSec.toLocaleString()} ops/s`
                    : '--'}
              </div>
            </div>
            <div className="stat">
              <div className="text-[11px] uppercase text-[color:var(--muted)]">
                Prefill
              </div>
              <div className="text-lg font-semibold">
                {activeResult.prefillPrompt?.prefillTokensPerSecond
                  ? `${activeResult.prefillPrompt.prefillTokensPerSecond.toFixed(1)} tok/s`
                  : '--'}
              </div>
            </div>
          </div>

          {activeResult.notes ? (
            <p className="mt-3 text-xs text-[color:var(--muted)]">{activeResult.notes}</p>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">
          No benchmark saved yet. Run a runtime benchmark if your local server is available, or use the synthetic fallback once to improve estimates.
        </div>
      )}
    </div>
  )
}
