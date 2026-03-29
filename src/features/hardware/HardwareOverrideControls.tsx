import { CHIP_PROFILES, RAM_OVERRIDE_OPTIONS } from '../../domain'
import type { AppController } from '../../components'

type HardwareOverrideControlsProps = {
  controller: AppController
}

export function HardwareOverrideControls({
  controller,
}: HardwareOverrideControlsProps) {
  if (!controller.needsHardwareOverride) return null

  return (
    <div className="override-inline-bar mt-3">
      <span className="text-xs text-[color:var(--muted)]">
        Hardware details are uncertain. Confirm them for better recommendations.
      </span>
      <select
        className="toolbar-select override-inline-select"
        value={controller.chipOverrideId}
        onChange={(event) => controller.handleChipOverrideChange(event.target.value)}
      >
        <option value="">Select device / GPU class</option>
        {CHIP_PROFILES.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.label}
          </option>
        ))}
      </select>
      <select
        className="toolbar-select override-inline-select"
        value={controller.ramOverrideGb}
        onChange={(event) => controller.setRamOverrideGb(event.target.value)}
      >
        <option value="">RAM auto</option>
        {RAM_OVERRIDE_OPTIONS.map((ram) => (
          <option key={ram} value={String(ram)}>
            {ram} GB RAM
          </option>
        ))}
      </select>
      <select
        className="toolbar-select override-inline-select"
        value={controller.computePreference}
        onChange={(event) => controller.setComputePreference(event.target.value as typeof controller.computePreference)}
      >
        <option value="gpu-offload">GPU offload</option>
        <option value="cpu-only">CPU only</option>
      </select>
    </div>
  )
}
