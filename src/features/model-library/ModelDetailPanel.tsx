import {
  formatPerfLatency,
  formatRequirement,
  formatSpeedRange,
  getModelId,
  getModelRepoUrl,
  getQuantDownloadHint,
  getQuantDownloadUrl,
  getReportHash,
  getRuntimeRecipeCommand,
  quantizationLevels,
  RUNTIME_OVERHEAD,
} from '../../domain'
import type { AppController } from '../../components'
import { compatibilityStyles, recommendationStyles } from '../../components'
import { RuntimeRecipes } from '../install-guides'

type ModelDetailPanelProps = {
  controller: AppController
}

export function ModelDetailPanel({ controller }: ModelDetailPanelProps) {
  const selectedModel = controller.selectedModel
  const selectedModelId = selectedModel ? getModelId(selectedModel) : null

  const recipes = selectedModel?.huggingface_repo
    ? (['ollama', 'lmstudio'] as const)
        .map((runtime) => ({
          runtime,
          label: runtime === 'ollama' ? 'Ollama' : 'LM Studio',
          command: getRuntimeRecipeCommand(
            selectedModel,
            runtime,
            controller.recommendedQuant,
          ),
        }))
        .filter((recipe): recipe is { runtime: 'ollama' | 'lmstudio'; label: string; command: string } =>
          typeof recipe.command === 'string' && Boolean(recipe.command),
        )
    : []

  return (
    <aside className="detail-panel card card-strong p-5 sm:p-6 reveal delay-3">
      {selectedModel ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {selectedModel.provider}
              </div>
              <h3 className="mt-2 text-2xl font-semibold">
                {selectedModel.name}
              </h3>
              {selectedModel.notes ? (
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  {selectedModel.notes}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-2">
              <div className="flex flex-wrap gap-2">
                {(selectedModel.modalities || ['Text']).map((modality) => (
                  <span
                    key={`modal-${modality}`}
                    className="chip chip-compact"
                  >
                    {modality}
                  </span>
                ))}
              </div>
              {controller.recommendedQuant ? (
                <span className="recommend-pill">
                  Recommended: {controller.recommendedQuant}
                </span>
              ) : null}
              <span
                className={`status-pill ${compatibilityStyles[controller.selectedSummary]}`}
              >
                Compatibility: {controller.selectedSummary}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="stat sm:col-span-2">
              <div className="text-[11px] uppercase text-[color:var(--muted)]">
                Selected system fit
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`status-pill ${compatibilityStyles[controller.selectedSummary]}`}
                >
                  {controller.selectedSummary}
                </span>
                {controller.recommendedQuant ? (
                  <span className="recommend-pill">
                    Best fit: {controller.recommendedQuant}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="stat">
              <div className="text-[11px] uppercase text-[color:var(--muted)]">
                Params
              </div>
              <div className="text-lg font-semibold">
                {selectedModel.parameter_count}
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                Active: {selectedModel.active_params_b ? `${selectedModel.active_params_b}B` : 'Unknown'}
              </div>
            </div>
            <div className="stat">
              <div className="text-[11px] uppercase text-[color:var(--muted)]">
                Modalities
              </div>
              <div className="text-sm font-semibold">
                {(selectedModel.modalities || ['Text']).join(', ')}
              </div>
            </div>
            <div className="stat">
              <div className="text-[11px] uppercase text-[color:var(--muted)]">
                Est. speed
              </div>
              <div className="text-lg font-semibold">
                {formatSpeedRange(
                  controller.selectedPerformance.expectedTokPerSec,
                  controller.selectedPerformance.conservativeTokPerSec,
                )}
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                {formatPerfLatency(controller.selectedPerformance.firstTokenLatencyMs)}
              </div>
            </div>
            <div className="stat sm:col-span-2">
              <div className="text-[11px] uppercase text-[color:var(--muted)]">
                Formats
              </div>
              <div className="format-chip-list mt-2 text-sm font-semibold">
                {selectedModel.formats.length ? (
                  selectedModel.formats.map((format) => {
                    const formatUrl = getQuantDownloadUrl(
                      selectedModel,
                      format,
                    )
                    return formatUrl ? (
                      <a
                        key={format}
                        className="format-chip"
                        href={formatUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={`${format}: ${getQuantDownloadHint(format)}`}
                      >
                        {format}
                      </a>
                    ) : (
                      <span key={format} className="format-chip static">
                        {format}
                      </span>
                    )
                  })
                ) : (
                  '--'
                )}
              </div>
            </div>
            <div className="stat sm:col-span-2">
              <div className="text-[11px] uppercase text-[color:var(--muted)]">
                Repo
              </div>
              <div className="text-sm font-semibold break-all">
                {selectedModel.huggingface_repo || 'Not listed'}
              </div>
              <div className="text-xs text-[color:var(--muted)] mt-1">
                Context: {(selectedModel.context_windows || [4096]).join(', ')} tokens
              </div>
            </div>
          </div>

          {selectedModel.huggingface_repo ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                className="pill-button"
                href={getModelRepoUrl(selectedModel.huggingface_repo)}
                target="_blank"
                rel="noreferrer"
              >
                Open HuggingFace
              </a>
              <button
                type="button"
                className="pill-button"
                onClick={() =>
                  void controller.handleCopyRepo(selectedModel.huggingface_repo || '')
                }
              >
                {controller.copiedRepo === selectedModel.huggingface_repo
                  ? 'Copied'
                  : 'Copy Repo ID'}
              </button>
              <button
                type="button"
                className="pill-button"
                onClick={() => controller.toggleModelCompare(selectedModel)}
              >
                {selectedModelId && controller.compareModelIds.includes(selectedModelId)
                  ? 'Remove from compare'
                  : 'Add to compare'}
              </button>
              <button
                type="button"
                className="pill-button"
                onClick={() => {
                  window.location.hash = getReportHash(controller.shareableReport)
                }}
              >
                Open report
              </button>
            </div>
          ) : null}

          <RuntimeRecipes
            copiedCommand={controller.copiedCommand}
            modelName={selectedModel.name}
            onCopyCommand={controller.handleCopyCommand}
            recipes={recipes}
          />

          {selectedModel.userAdded ? (
            <div className="mt-3">
              <button
                type="button"
                className="pill-button pill-button--remove"
                onClick={() => controller.removeUserModel(selectedModel)}
              >
                Remove custom model
              </button>
            </div>
          ) : null}

          <div className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-sm font-semibold">
                Quantization & RAM fit
              </h4>
              <span className="text-xs text-[color:var(--muted)]">
                {Math.round((RUNTIME_OVERHEAD - 1) * 100)}% runtime overhead
              </span>
            </div>
            {controller.quantRows.length === 0 ? (
              <div className="empty-state mt-3">
                Quantization data not available for this model.
              </div>
            ) : (
              <div className="table-wrap mt-4">
                <table>
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
                      <th>Quant</th>
                      <th>RAM required</th>
                      <th>Compatibility</th>
                      <th>System fit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {controller.quantRows.map((row) => (
                      <tr key={row.key}>
                        <td className="mono">
                          <div className="quant-cell">
                            {row.downloadUrl ? (
                              <a
                                className="quant-link"
                                href={row.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                title={`${row.key}: ${row.downloadHint}`}
                              >
                                {row.key}
                              </a>
                            ) : (
                              <span>{row.key}</span>
                            )}
                            {controller.recommendedQuant === row.key ? (
                              <span className="recommend-tag">
                                Recommended
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>{formatRequirement(row.requirement)}</td>
                        <td>
                          <span
                            className={`status-pill ${compatibilityStyles[row.status]}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td>
                          <div className="quant-fit-cell">
                            <span
                              className={`status-pill ${recommendationStyles[row.recommendation.tone]}`}
                            >
                              {row.recommendation.label}
                            </span>
                            <div className="text-xs text-[color:var(--muted)]">
                              {row.detail.reason}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-[color:var(--muted)]">
              FP16 and other full-precision links open the official repo.
              Lower-bit quants search Hugging Face for matching downloads.
            </p>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Performance confidence: {controller.selectedPerformance.confidence}. {controller.selectedPerformance.explanation}
            </p>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold">Quality guidance</h4>
            <div className="mt-3 space-y-3">
              {quantizationLevels.map((level) => (
                <div key={level.key} className="stat">
                  <div className="flex items-center justify-between">
                    <span className="mono text-sm">{level.label}</span>
                    <span className="text-xs text-[color:var(--muted)]">
                      {level.bytes} bytes/param
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    {level.blurb}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          Pick a model to see details.
        </div>
      )}
    </aside>
  )
}
