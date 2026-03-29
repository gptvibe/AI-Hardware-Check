import {
  estimatePerformanceRange,
  formatSpeedRange,
  getFamilyKey,
  getModelId,
  parseParamCount,
} from '../../domain'
import type { AppController } from '../../components'
import { compatibilityStyles } from '../../components'

type ModelCardsSectionProps = {
  controller: AppController
}

export function ModelCardsSection({ controller }: ModelCardsSectionProps) {
  return (
    <section className="card p-6 reveal delay-1">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Model cards</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Browse model families and select a card to inspect details.
          </p>
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Under model library
        </div>
      </div>
      {controller.modelsError ? (
        <div className="empty-state mt-6">{controller.modelsError}</div>
      ) : controller.companySummaries.length === 0 ? (
        <div className="empty-state mt-6">
          No companies match the current search and filters.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {controller.selectedCompany ? (
            controller.filteredModels.length === 0 ? (
              <div className="empty-state">
                No models from {controller.selectedCompany} match current filters.
              </div>
            ) : (
              <div className="space-y-6">
                {controller.modelGroups.map((provider) => (
                  <div key={provider.name} className="provider-section">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="provider-title">{provider.name}</h3>
                      <span className="provider-count">
                        {provider.totalModels} models · {provider.families.length} families
                      </span>
                    </div>
                    {provider.families.length === 0 ? (
                      <div className="empty-state">
                        Add models in public/models.json.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {provider.families.map((family) => {
                          const familyKey = getFamilyKey({
                            ...family.models[0],
                            provider: provider.name,
                            family: family.name,
                          })
                          const visibleModels = family.models.filter(
                            (model) =>
                              (controller.compatibilityById.get(getModelId(model)) ||
                                'Unknown') !== 'Cannot Run',
                          )
                          const hiddenModels = family.models.filter(
                            (model) =>
                              (controller.compatibilityById.get(getModelId(model)) ||
                                'Unknown') === 'Cannot Run',
                          )
                          const showAll = controller.expandedFamilies.has(familyKey)
                          const modelsToShow = controller.hasManualFilters
                            ? family.models
                            : showAll
                              ? family.models
                              : visibleModels

                          return (
                            <div key={familyKey} className="family-block">
                              <div className="family-header">
                                <div>
                                  <div className="family-title">
                                    {family.name}
                                  </div>
                                  <div className="family-meta">
                                    Sizes: {family.sizes.join(', ')}
                                  </div>
                                </div>
                                <div className="family-actions">
                                  <span className="family-count">
                                    {modelsToShow.length} shown
                                  </span>
                                  {hiddenModels.length > 0 && !controller.hasManualFilters ? (
                                    <button
                                      type="button"
                                      className="family-toggle"
                                      onClick={() => controller.toggleFamily(familyKey)}
                                    >
                                      {showAll
                                        ? 'Hide unavailable'
                                        : `Show unavailable (${hiddenModels.length})`}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {modelsToShow.length === 0 ? (
                                <div className="empty-state">
                                  No sizes fit this system. Show unavailable to view the full family.
                                </div>
                              ) : (
                                <div className="model-grid">
                                  {modelsToShow.map((model) => {
                                    const id = getModelId(model)
                                    const isActive = controller.selectedModelId === id
                                    const paramsB = model.active_params_b ?? parseParamCount(
                                      model.parameter_count,
                                    )
                                    const perf = estimatePerformanceRange({
                                      paramsB,
                                      quant: 'INT8',
                                      contextTokens: model.context_windows?.[0] || 4096,
                                      profile: controller.effectiveHardwareProfile,
                                      chipMultiplier:
                                        controller.effectiveAccelerationMultiplier,
                                      calibrationMultiplier: controller.calibrationMultiplier,
                                      benchmarkResult: controller.benchmarkResult,
                                    })
                                    const summary =
                                      controller.compatibilityById.get(id) || 'Unknown'
                                    const unavailable = summary === 'Cannot Run'

                                    return (
                                      <button
                                        key={id}
                                        type="button"
                                        className={`model-card ${isActive ? 'active' : ''} ${unavailable ? 'unavailable' : ''}`}
                                        onClick={() => controller.setSelectedModelId(id)}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <div className="model-name">
                                              {model.name}
                                              {model.userAdded ? (
                                                <span className="user-badge ml-1.5">Custom</span>
                                              ) : null}
                                            </div>
                                            <div className="model-meta">
                                              <span className="mono">
                                                {model.parameter_count}
                                              </span>
                                              {(model.modalities || ['Text']).map(
                                                (modality) => (
                                                  <span
                                                    key={`${id}-${modality}`}
                                                    className="chip chip-compact"
                                                  >
                                                    {modality}
                                                  </span>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                          <span
                                            className={`status-pill ${compatibilityStyles[summary]}`}
                                          >
                                            {summary}
                                          </span>
                                        </div>
                                        <div className="model-stats">
                                          <span className="text-xs text-[color:var(--muted)]">
                                            Est. speed
                                          </span>
                                          <span className="mono">
                                            {formatSpeedRange(
                                              perf.expectedTokPerSec,
                                              perf.conservativeTokPerSec,
                                            )}
                                          </span>
                                        </div>
                                        {model.notes ? (
                                          <div className="model-notes">
                                            {model.notes}
                                          </div>
                                        ) : null}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="empty-state">
              Select a company in Model library to view model cards.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
