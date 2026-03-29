import type { AppController } from '../../components'

type ConfidenceDetailsPopoverProps = {
  controller: AppController
}

const confidenceTone = {
  high: 'text-emerald-700',
  medium: 'text-amber-700',
  low: 'text-rose-700',
} as const

export function ConfidenceDetailsPopover({
  controller,
}: ConfidenceDetailsPopoverProps) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
        Confidence details
      </summary>
      <div className="absolute right-0 z-10 mt-3 w-[min(32rem,calc(100vw-3rem))] rounded-3xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4 shadow-2xl">
        <h4 className="text-sm font-semibold">How this estimate was produced</h4>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          We combine browser-reported hardware fields, WebGL renderer signals, WebGPU availability, and a quick graphics probe. Lower-confidence fields reduce estimate certainty.
        </p>
        <div className="mt-4 space-y-3">
          {controller.hardwareConfidenceDetails.map((detail) => (
            <div key={detail.label} className="stat">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{detail.label}</span>
                <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${confidenceTone[detail.confidence]}`}>
                  {detail.confidence}
                </span>
              </div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                Source: {detail.source}
              </div>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                {detail.note}
              </p>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}
