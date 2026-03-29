import type { AppController } from './useAppController'
import { HardwareConfidenceBanner } from '../features/hardware'

type AppHeaderProps = {
  controller: AppController
}

export function AppHeader({ controller }: AppHeaderProps) {
  return (
    <header className="reveal">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip">Browser only</span>
          <span className="chip">No uploads</span>
          <span className="chip">Open-source only</span>
        </div>
        <div className="header-actions">
          <a
            className="github-link"
            href="https://github.com/gptvibe/AI-Hardware-Check"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <button
            type="button"
            className="theme-toggle"
            onClick={() =>
              controller.setTheme((current) => (current === 'light' ? 'dark' : 'light'))
            }
          >
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Theme
            </span>
            <span className="theme-pill">
              {controller.theme === 'light' ? 'Light' : 'Dark'}
            </span>
          </button>
        </div>
      </div>
      <div className="mt-6 max-w-4xl">
          <div className="mb-4 inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-1">
            {(['beginner', 'advanced'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${
                  controller.experienceMode === mode
                    ? 'bg-[color:var(--surface)] text-[color:var(--text)] shadow-sm'
                    : 'text-[color:var(--muted)]'
                }`}
                onClick={() => controller.setExperienceMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <h1 className="display-title text-4xl font-semibold md:text-5xl lg:text-6xl">
            AI Hardware Check
          </h1>
          <p className="mt-4 text-base text-[color:var(--muted)] md:text-lg">
            See the best local models for your machine first, then drop into the full catalog when you want more control.
          </p>
          <form
            className="add-model-bar mt-6"
            onSubmit={(event) => {
              event.preventDefault()
              void controller.fetchAndAddModel()
            }}
          >
            <input
              type="text"
              className="add-model-input"
              value={controller.addModelInput}
              onChange={(event) => {
                controller.setAddModelInput(event.target.value)
                if (controller.addModelStatus.type !== 'idle') {
                  controller.setAddModelStatus({ type: 'idle' })
                }
              }}
              placeholder="Add any model — paste a Hugging Face ID or URL (e.g. meta-llama/Llama-3.1-8B-Instruct or https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct)"
              disabled={controller.addModelStatus.type === 'loading'}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <button
              type="submit"
              className="add-model-btn"
              disabled={controller.addModelStatus.type === 'loading' || !controller.addModelInput.trim()}
            >
              {controller.addModelStatus.type === 'loading' ? 'Adding…' : 'Add model'}
            </button>
          </form>
          {controller.addModelStatus.type !== 'idle' && controller.addModelStatus.message ? (
            <div className={`add-model-status add-model-status--${controller.addModelStatus.type}`}>
              {controller.addModelStatus.message}
            </div>
          ) : null}
          <HardwareConfidenceBanner controller={controller} />
      </div>
    </header>
  )
}
