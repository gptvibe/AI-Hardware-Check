import { formatRam, getConfidenceLabel } from '../../domain'
import type { AppController } from '../../components'
import { readinessStyles } from '../../components'
import { CalibrationControls } from '../benchmarking'
import { CompanionContractCard } from './CompanionContractCard'
import { ConfidenceDetailsPopover } from './ConfidenceDetailsPopover'
import { HardwareOverrideControls } from './HardwareOverrideControls'

type HardwareOverviewSectionProps = {
  controller: AppController
}

export function HardwareOverviewSection({
  controller,
}: HardwareOverviewSectionProps) {
  return (
    <section className="card p-6 reveal delay-2 mt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">System hardware</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Collected locally, then confidence-scored from measured and reported signals.
          </p>
        </div>
        <span
          className={`status-pill ${readinessStyles[controller.readiness.tone]}`}
        >
          {controller.readiness.label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="status-pill bg-slate-100 text-slate-700 border border-slate-200">
          {getConfidenceLabel(controller.effectiveHardwareProfile.confidenceScore)}
        </span>
        <span className="text-xs text-[color:var(--muted)]">
          Confidence score: {controller.effectiveHardwareProfile.confidenceScore}%
        </span>
        <span className="text-xs text-[color:var(--muted)]">
          Tier: {controller.effectiveHardwareProfile.performanceTier}
        </span>
        <ConfidenceDetailsPopover controller={controller} />
      </div>

      <HardwareOverrideControls controller={controller} />

      {controller.needsHardwareOverride ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {controller.hardwareConfidenceDetails
            .filter((detail) => detail.confidence !== 'high')
            .map((detail) => (
              <div key={detail.label} className="stat">
                <div className="text-[11px] uppercase text-[color:var(--muted)]">
                  Uncertain Field
                </div>
                <div className="mt-1 font-semibold">{detail.label}</div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  {detail.note}
                </div>
              </div>
            ))}
        </div>
      ) : null}

      <CalibrationControls controller={controller} />

      {controller.benchmarkState.error ? (
        <div className="empty-state mt-2">{controller.benchmarkState.error}</div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">
            CPU Threads
          </div>
          <div className="text-2xl font-semibold">
            {controller.effectiveHardwareProfile.system.cpuCores || '--'}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {controller.effectiveHardwareProfile.cpuCores.source}
          </div>
        </div>
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">
            System RAM
          </div>
          <div className="text-2xl font-semibold">
            {formatRam(controller.effectiveRamGb)}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {controller.ramSourceLabel}
          </div>
          {controller.selectedChipProfile ? (
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              {controller.selectedChipProfile.note} RAM preset: {controller.selectedChipProfile.recommendedRamGb} GB.
            </p>
          ) : null}
          {!controller.selectedChipProfile && controller.appleDeviceHint ? (
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              {controller.appleDeviceHint}
            </p>
          ) : null}
        </div>
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">
            GPU Renderer
          </div>
          <div className="text-lg font-semibold" title={controller.effectiveHardwareProfile.gpu.renderer}>
            {controller.effectiveHardwareProfile.gpu.renderer}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {controller.effectiveHardwareProfile.gpu.vendor}
          </div>
        </div>
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">
            Graphics API
          </div>
          <div className="text-2xl font-semibold">{controller.effectiveHardwareProfile.gpu.api}</div>
          <div className="text-xs text-[color:var(--muted)]">
            Probe: {controller.effectiveHardwareProfile.graphicsProbeScore === null ? '--' : controller.effectiveHardwareProfile.graphicsProbeScore.toFixed(2)} loops/ms
          </div>
        </div>
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">
            WebGPU
          </div>
          <div className="text-2xl font-semibold">
            {controller.effectiveHardwareProfile.system.webgpu ? 'Yes' : 'No'}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {controller.effectiveHardwareProfile.webgpu.note}
          </div>
        </div>
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">
            Platform
          </div>
          <div className="text-2xl font-semibold">
            {controller.effectiveHardwareProfile.system.platform}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {controller.effectiveHardwareProfile.gpu.available ? 'GPU detected' : 'GPU not detected'}
          </div>
        </div>
      </div>
      {controller.effectiveHardwareProfile.unresolved.length > 0 ? (
        <div className="empty-state mt-4">
          {controller.effectiveHardwareProfile.unresolved[0]}
        </div>
      ) : null}
      <p className="mt-5 text-xs text-[color:var(--muted)] mono break-all">
        User agent: {controller.effectiveHardwareProfile.system.userAgent}
      </p>

      <CompanionContractCard controller={controller} />
    </section>
  )
}
