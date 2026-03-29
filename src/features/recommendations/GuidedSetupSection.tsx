import type { AppController } from '../../components'
import { getModelId, getReportHash } from '../../domain'
import { InstallWizard } from '../install-guides'

type GuidedSetupSectionProps = {
  controller: AppController
}

const riskStyles = {
  low: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border border-amber-200',
  high: 'bg-rose-100 text-rose-700 border border-rose-200',
} as const

export function GuidedSetupSection({ controller }: GuidedSetupSectionProps) {
  const primaryRecommendation =
    controller.homepageRecommendations.cards[0]?.recommendation ||
    controller.homepageRecommendations.cards.find((card) => card.recommendation)?.recommendation ||
    null

  const openReportView = () => {
    window.location.hash = getReportHash(controller.shareableReport)
  }

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Recommended for this machine</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Start with the strongest local options first, then explore deeper if you want more control.
          </p>
        </div>
        <div className="runtime-recipe-actions">
          <button
            type="button"
            className="pill-button"
            onClick={openReportView}
          >
            Open shareable report
          </button>
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {controller.experienceMode === 'beginner' ? 'Beginner path' : 'Advanced controls'}
          </span>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {controller.homepageRecommendations.cards.map((card) => (
          <div key={card.title} className="stat">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
              {card.title}
            </div>
            <div className="mt-3">
              {card.recommendation ? (
                (() => {
                  const recommendation = card.recommendation

                  return (
                    <>
                  <div className="text-lg font-semibold">
                    {recommendation.model.name}
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    {recommendation.recommendedQuant ? `${recommendation.recommendedQuant} recommended` : 'No confident quant'} · Install readiness {recommendation.installReadinessScore}/100
                  </div>
                  <p className="mt-3 text-sm text-[color:var(--muted)]">
                    {recommendation.shortReason}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`status-pill ${riskStyles[recommendation.riskLevel]}`}>
                      Risk: {recommendation.riskLevel}
                    </span>
                    <span className="status-pill bg-slate-100 text-slate-700 border border-slate-200">
                      Score {recommendation.score}
                    </span>
                    <button
                      type="button"
                      className="pill-button"
                      onClick={() => controller.toggleModelCompare(recommendation.model)}
                    >
                      {controller.compareModelIds.includes(getModelId(recommendation.model))
                        ? 'Remove from compare'
                        : 'Add to compare'}
                    </button>
                  </div>
                    </>
                  )
                })()
              ) : (
                <>
                  <div className="text-lg font-semibold">No clear match yet</div>
                  <p className="mt-3 text-sm text-[color:var(--muted)]">
                    Adjust the goal or filters to surface a stronger local option.
                  </p>
                </>
              )}
            </div>
            <p className="mt-4 text-xs text-[color:var(--muted)]">
              {card.subtitle}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="filter-field">
          <span className="toolbar-label">Goal</span>
          <select
            className="toolbar-select"
            value={controller.userGoal}
            onChange={(event) => controller.setUserGoal(event.target.value as typeof controller.userGoal)}
          >
            <option value="chat">Chat</option>
            <option value="coding">Coding</option>
            <option value="vision">Vision</option>
            <option value="offline">Offline</option>
            <option value="api-server">API server</option>
          </select>
        </label>
        {controller.experienceMode === 'advanced' ? (
          <>
            <label className="filter-field">
              <span className="toolbar-label">Runtime</span>
              <select
                className="toolbar-select"
                value={controller.runtimePreference}
                onChange={(event) => controller.setRuntimePreference(event.target.value as typeof controller.runtimePreference)}
              >
                <option value="ollama">Ollama</option>
                <option value="lmstudio">LM Studio</option>
                <option value="llamacpp">llama.cpp</option>
              </select>
            </label>
            <label className="filter-field">
              <span className="toolbar-label">Priority</span>
              <select
                className="toolbar-select"
                value={controller.qualityPreference}
                onChange={(event) => controller.setQualityPreference(event.target.value as typeof controller.qualityPreference)}
              >
                <option value="best-quality">Best quality</option>
                <option value="balanced">Balanced</option>
                <option value="fastest">Fastest</option>
              </select>
            </label>
          </>
        ) : (
          <div className="sm:col-span-2 stat">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Beginner path
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Beginner mode keeps the install path simple and uses <span className="mono">{controller.effectiveRuntimePreference}</span> as the default runtime.
            </p>
          </div>
        )}
      </div>
      <div className="guided-result mt-5">
        {controller.homepageRecommendations.primaryModel ? (
          <>
            <div className="mt-2 text-base font-semibold">
              Start here: {controller.homepageRecommendations.primaryModel.name}
            </div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              {controller.homepageRecommendations.primaryModel.parameter_count} · {(controller.homepageRecommendations.primaryModel.modalities || ['Text']).join(', ')}
            </div>
            {controller.experienceMode === 'advanced' ? (
              <div className="mt-4 space-y-3">
                {controller.guidedRecommendation.topRecommendations.map((entry, index) => (
                  <div key={`${entry.model.provider}-${entry.model.name}`} className="stat">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          #{index + 1} · Score {entry.score}
                        </div>
                        <div className="mt-1 font-semibold">
                          {entry.model.name}
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--muted)]">
                          {entry.recommendedQuant ? `${entry.recommendedQuant} recommended` : 'No confident quant'} · Install readiness {entry.installReadinessScore}/100
                        </div>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">
                          {entry.shortReason}
                        </p>
                      </div>
                      <span className={`status-pill ${riskStyles[entry.riskLevel]}`}>
                        Risk: {entry.riskLevel}
                      </span>
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        className="pill-button"
                        onClick={() => controller.toggleModelCompare(entry.model)}
                      >
                        {controller.compareModelIds.includes(getModelId(entry.model))
                          ? 'Remove from compare'
                          : 'Add to compare'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <InstallWizard
              copiedCommand={controller.copiedCommand}
              experienceMode={controller.experienceMode}
              model={controller.homepageRecommendations.primaryModel}
              onCopyCommand={controller.handleCopyCommand}
              preferredRuntime={
                controller.effectiveRuntimePreference === 'lmstudio'
                  ? 'lmstudio'
                  : 'ollama'
              }
              quant={primaryRecommendation?.recommendedQuant || controller.recommendedQuant}
            />
          </>
        ) : (
          <div className="empty-state mt-3">
            No compatible model found for this goal with current filters. Try "General chat" or clear filters.
          </div>
        )}
      </div>
    </section>
  )
}
