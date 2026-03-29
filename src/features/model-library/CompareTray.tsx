import {
  estimatePerformanceRange,
  formatPerfLatency,
  formatSpeedRange,
  getModelId,
  parseParamCount,
} from '../../domain'
import type { AppController } from '../../components'
import { compatibilityStyles } from '../../components'

type CompareTrayProps = {
  controller: AppController
}

export function CompareTray({ controller }: CompareTrayProps) {
  if (controller.comparedModels.length === 0) return null

  return (
    <section className="card p-6 compare-tray reveal delay-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Compare tray</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Keep up to 3 models side by side while you narrow the final pick.
          </p>
        </div>
        <div className="runtime-recipe-actions">
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {controller.comparedModels.length}/3 selected
          </span>
          <button
            type="button"
            className="family-toggle"
            onClick={controller.clearCompareTray}
          >
            Clear tray
          </button>
        </div>
      </div>

      <div className="compare-grid mt-5">
        {controller.comparedModels.map((model) => {
          const id = getModelId(model)
          const paramsB = model.active_params_b ?? parseParamCount(model.parameter_count)
          const performance = estimatePerformanceRange({
            paramsB,
            quant: controller.recommendedQuant,
            contextTokens: model.context_windows?.[0] || 4096,
            profile: controller.effectiveHardwareProfile,
            chipMultiplier: controller.effectiveAccelerationMultiplier,
            calibrationMultiplier: controller.calibrationMultiplier,
            benchmarkResult: controller.benchmarkResult,
          })
          const compatibility = controller.compatibilityById.get(id) || 'Unknown'

          return (
            <div key={id} className="stat">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    {model.provider}
                  </div>
                  <div className="mt-1 text-lg font-semibold">{model.name}</div>
                </div>
                <button
                  type="button"
                  className="pill-button pill-button--remove"
                  onClick={() => controller.removeModelFromCompare(model)}
                >
                  Remove
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`status-pill ${compatibilityStyles[compatibility]}`}>
                  {compatibility}
                </span>
                <span className="status-pill bg-slate-100 text-slate-700 border border-slate-200">
                  {model.parameter_count}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                <div>Speed: {formatSpeedRange(performance.expectedTokPerSec, performance.conservativeTokPerSec)}</div>
                <div>Latency: {formatPerfLatency(performance.firstTokenLatencyMs)}</div>
                <div>Modalities: {(model.modalities || ['Text']).join(', ')}</div>
                <div>Context: {(model.context_windows?.[0] || 4096).toLocaleString()} tokens</div>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  className="pill-button"
                  onClick={() => controller.setSelectedModelId(id)}
                >
                  Open details
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
