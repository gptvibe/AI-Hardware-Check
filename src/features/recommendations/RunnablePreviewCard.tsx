import { getModelId } from '../../domain'
import type { AppController } from '../../components'

type RunnablePreviewCardProps = {
  controller: AppController
}

export function RunnablePreviewCard({ controller }: RunnablePreviewCardProps) {
  return (
    <div className="card p-5">
      <div className="runnable-header-row">
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Runs on this system
        </div>
        <span className="text-xs text-[color:var(--muted)]">
          Latest 2
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="status-pill bg-emerald-100 text-emerald-700 border border-emerald-200">
          Can Run: {controller.runnableModelList.canRunCount}
        </span>
        <span className="status-pill bg-amber-100 text-amber-700 border border-amber-200">
          Maybe: {controller.runnableModelList.maybeCount}
        </span>
      </div>
      {controller.runnableModelList.preview.length === 0 ? (
        <div className="empty-state mt-4">
          No runnable models in the current filters.
        </div>
      ) : (
        <div className="runnable-list mt-4">
          {controller.runnableModelList.preview.map((entry: (typeof controller.runnableModelList.preview)[number]) => {
            const id = getModelId(entry.model)
            const isActive = controller.selectedModelId === id
            return (
              <button
                key={id}
                type="button"
                className={`runnable-item ${isActive ? 'active' : ''}`}
                onClick={() => controller.setSelectedModelId(id)}
              >
                <span className="runnable-name">{entry.model.name}</span>
                <span className="runnable-meta">
                  {entry.model.parameter_count} · {entry.summary}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {controller.runnableModelList.totalRunnable > controller.runnableModelList.preview.length ? (
        <p className="mt-3 text-xs text-[color:var(--muted)]">
          Showing latest runnable models based on release date (or catalog order when date is missing).
        </p>
      ) : null}
    </div>
  )
}
