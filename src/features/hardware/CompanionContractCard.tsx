import {
  LOCAL_COMPANION_HANDSHAKE_PROTOCOL,
  LOCAL_COMPANION_PROTOCOL_VERSION,
} from '../../domain'
import type { AppController } from '../../components'

type CompanionContractCardProps = {
  controller: AppController
}

const formatBytesAsGb = (value?: number) =>
  typeof value === 'number' ? `${(value / 1024 ** 3).toFixed(1)} GB` : '--'

export function CompanionContractCard({ controller }: CompanionContractCardProps) {
  const hardware = controller.companionHardwareInfo
  const firstGpu = hardware?.gpus[0]

  return (
    <section className="card p-6 mt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Local companion contract</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Future-ready bridge for a Tauri or Electron companion that can provide more accurate local hardware and runtime data.
          </p>
        </div>
        <span className="status-pill bg-slate-100 text-slate-700 border border-slate-200">
          {controller.companionStatus}
        </span>
      </div>

      <div className="mt-4 companion-grid">
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">
            Protocol
          </div>
          <div className="mt-2 text-sm font-semibold">{LOCAL_COMPANION_PROTOCOL_VERSION}</div>
          <div className="mt-2 text-xs text-[color:var(--muted)]">
            {LOCAL_COMPANION_HANDSHAKE_PROTOCOL.flow[0]}
          </div>
        </div>
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">
            Capability flags
          </div>
          <div className="mt-2 text-sm font-semibold">
            {controller.companionCapabilitiesLabel}
          </div>
          <div className="mt-2 text-xs text-[color:var(--muted)]">
            Total RAM, free RAM, GPU model, VRAM, backend support, installed runtimes, and local models are negotiated explicitly.
          </div>
        </div>
        <div className="stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">
            Mock adapter
          </div>
          <div className="mt-2 runtime-recipe-actions">
            {controller.companionStatus === 'connected' ? (
              <button
                type="button"
                className="pill-button"
                onClick={controller.disconnectCompanion}
              >
                Disconnect mock companion
              </button>
            ) : (
              <button
                type="button"
                className="pill-button"
                onClick={() => {
                  void controller.connectMockCompanion()
                }}
                disabled={controller.companionStatus === 'connecting'}
              >
                {controller.companionStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Connect mock companion'}
              </button>
            )}
          </div>
          <div className="mt-2 text-xs text-[color:var(--muted)]">
            The mock adapter validates the handshake and hardware snapshot using the same schemas a desktop companion would use later.
          </div>
        </div>
      </div>

      {controller.companionError ? (
        <div className="empty-state mt-4">{controller.companionError}</div>
      ) : null}

      {controller.companionHandshake ? (
        <div className="mt-4 stat">
          <div className="text-[11px] uppercase text-[color:var(--muted)]">
            Handshake
          </div>
          <div className="mt-2 text-sm font-semibold">
            {controller.companionHandshake.companion.name} {controller.companionHandshake.companion.version}
          </div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            Session {controller.companionHandshake.sessionId}
          </div>
        </div>
      ) : null}

      {hardware ? (
        <div className="mt-4 companion-grid">
          <div className="stat">
            <div className="text-[11px] uppercase text-[color:var(--muted)]">
              Accurate memory
            </div>
            <div className="mt-2 text-lg font-semibold">
              {formatBytesAsGb(hardware.memory.totalRamBytes)}
            </div>
            <div className="text-xs text-[color:var(--muted)]">
              Free RAM {formatBytesAsGb(hardware.memory.freeRamBytes)}
            </div>
          </div>
          <div className="stat">
            <div className="text-[11px] uppercase text-[color:var(--muted)]">
              GPU and VRAM
            </div>
            <div className="mt-2 text-sm font-semibold">
              {firstGpu?.model || 'No GPU reported'}
            </div>
            <div className="text-xs text-[color:var(--muted)]">
              {firstGpu?.vendor || '--'} · VRAM {formatBytesAsGb(firstGpu?.vramBytes)}
            </div>
          </div>
          <div className="stat">
            <div className="text-[11px] uppercase text-[color:var(--muted)]">
              Installed runtimes
            </div>
            <div className="mt-2 text-sm font-semibold">
              {hardware.installedRuntimes.length}
            </div>
            <div className="text-xs text-[color:var(--muted)]">
              {hardware.installedRuntimes.map((runtime) => runtime.name).join(', ') || 'None'}
            </div>
          </div>
          <div className="stat">
            <div className="text-[11px] uppercase text-[color:var(--muted)]">
              Local models
            </div>
            <div className="mt-2 text-sm font-semibold">
              {hardware.localModels.length}
            </div>
            <div className="text-xs text-[color:var(--muted)]">
              {hardware.localModels.slice(0, 3).map((model) => model.displayName).join(', ') || 'None'}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state mt-4">
          No companion is connected yet. The browser-only path stays active until a local companion responds to the handshake.
        </div>
      )}
    </section>
  )
}
