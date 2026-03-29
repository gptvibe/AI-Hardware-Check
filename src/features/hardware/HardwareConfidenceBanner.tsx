import type { AppController } from '../../components'
import { CHIP_PROFILES, RAM_OVERRIDE_OPTIONS } from '../../domain'

type HardwareConfidenceBannerProps = {
  controller: AppController
}

export function HardwareConfidenceBanner({
  controller,
}: HardwareConfidenceBannerProps) {
  if (!controller.needsHardwareOverride) return null

  return (
    <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50/85 p-4 text-amber-950 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Confidence Check
          </div>
          <h3 className="mt-2 text-lg font-semibold">
            {controller.hardwareConfidenceSummary.headline}
          </h3>
          <p className="mt-2 text-sm text-amber-900/80">
            Confirm the fields below so the performance estimate and model ranking use corrected values immediately.
          </p>
        </div>
        <span className="status-pill border border-amber-200 bg-white/80 text-amber-700">
          {controller.hardwareConfidenceSummary.level} confidence
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {controller.hardwareConfidenceSummary.uncertainFields.map((field) => (
          <span
            key={field}
            className="rounded-full border border-amber-200 bg-white/75 px-3 py-1 text-xs font-medium text-amber-800"
          >
            Uncertain: {field}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="filter-field">
          <span className="toolbar-label text-amber-900">Confirm RAM</span>
          <select
            className="toolbar-select"
            value={controller.ramOverrideGb}
            onChange={(event) => controller.setRamOverrideGb(event.target.value)}
          >
            <option value="">Use browser estimate</option>
            {RAM_OVERRIDE_OPTIONS.map((ram) => (
              <option key={ram} value={String(ram)}>
                {ram} GB RAM
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span className="toolbar-label text-amber-900">Confirm Device / GPU Class</span>
          <select
            className="toolbar-select"
            value={controller.chipOverrideId}
            onChange={(event) => controller.handleChipOverrideChange(event.target.value)}
          >
            <option value="">Use browser estimate</option>
            {CHIP_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span className="toolbar-label text-amber-900">Inference Preference</span>
          <select
            className="toolbar-select"
            value={controller.computePreference}
            onChange={(event) => controller.setComputePreference(event.target.value as typeof controller.computePreference)}
          >
            <option value="gpu-offload">GPU offload</option>
            <option value="cpu-only">CPU only</option>
          </select>
        </label>
      </div>

      {controller.selectedChipProfile ? (
        <p className="mt-3 text-sm text-amber-900/80">
          {controller.selectedChipProfile.note}
        </p>
      ) : null}
    </div>
  )
}
