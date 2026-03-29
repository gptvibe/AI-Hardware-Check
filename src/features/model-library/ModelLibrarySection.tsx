import type { AppController } from '../../components'

type ModelLibrarySectionProps = {
  controller: AppController
}

export function ModelLibrarySection({ controller }: ModelLibrarySectionProps) {
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Model library</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Pick a provider and filter before opening model cards below.
          </p>
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Filter first
        </div>
      </div>
      <div className="library-toolbar mt-6">
        <label className="search-field">
          <span className="toolbar-label">Search</span>
          <input
            type="search"
            className="toolbar-input"
            value={controller.searchQuery}
            onChange={(event) => controller.setSearchQuery(event.target.value)}
            placeholder="Search by model, family, provider, quant, or repo"
          />
        </label>
        <label className="filter-field">
          <span className="toolbar-label">Compatibility</span>
          <select
            className="toolbar-select"
            value={controller.compatibilityFilter}
            onChange={(event) =>
              controller.setCompatibilityFilter(
                event.target.value as typeof controller.compatibilityFilter,
              )
            }
          >
            {Object.entries(controller.compatibilityFilterLabels).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="filter-field">
          <span className="toolbar-label">Modality</span>
          <select
            className="toolbar-select"
            value={controller.modalityFilter}
            onChange={(event) => controller.setModalityFilter(event.target.value)}
          >
            <option value="all">All modalities</option>
            {controller.modalityOptions.map((modality) => (
              <option key={modality} value={modality}>
                {modality}
              </option>
            ))}
          </select>
        </label>
        <div className="toolbar-actions">
          <span className="toolbar-summary">
            {controller.libraryResultCount} {controller.selectedCompany ? 'model' : 'company'}
            {controller.libraryResultCount === 1 ? '' : 's'}
            {controller.selectedCompany ? ` in ${controller.selectedCompany}` : ' visible'}
          </span>
          <div className="flex items-center gap-2">
            {controller.selectedCompany ? (
              <button
                type="button"
                className="family-toggle"
                onClick={controller.handleBackToCompanies}
              >
                Back to companies
              </button>
            ) : null}
            <button
              type="button"
              className="family-toggle"
              onClick={controller.clearFilters}
              disabled={!controller.hasManualFilters}
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>
      {controller.modelsError ? (
        <div className="empty-state mt-6">{controller.modelsError}</div>
      ) : controller.companySummaries.length === 0 ? (
        <div className="empty-state mt-6">
          No companies match the current search and filters.
        </div>
      ) : (
        <div className="mt-6">
          <div className="company-grid">
            {controller.companySummaries.map((company) => (
              <button
                key={company.provider}
                type="button"
                className={`company-card tone-${company.tone} ${controller.selectedCompany === company.provider ? 'active' : ''}`}
                onClick={() => controller.handleSelectCompany(company.provider)}
              >
                <div className="company-card-head">
                  <span className="company-name">{company.provider}</span>
                  <span className="company-total">{company.total} models</span>
                </div>
                <div className="company-status-row">
                  <span>Can Run: {company.canRun}</span>
                  <span>Maybe: {company.maybe}</span>
                  <span>Cannot: {company.cannot}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
