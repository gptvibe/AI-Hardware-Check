import { getRuntimeDownloadUrl, OLLAMA_INSTALL_COMMAND } from '../../domain'

type RuntimeRecipe = {
  runtime: 'ollama' | 'lmstudio' | 'llamacpp'
  label: string
  command: string
}

type RuntimeRecipesProps = {
  copiedCommand: string | null
  modelName: string
  onCopyCommand: (command: string) => void | Promise<void>
  recipes: RuntimeRecipe[]
}

export function RuntimeRecipes({
  copiedCommand,
  modelName,
  onCopyCommand,
  recipes,
}: RuntimeRecipesProps) {
  if (recipes.length === 0) return null

  return (
    <div className="runtime-recipes mt-4">
      {recipes.map((recipe) => (
        <div key={recipe.runtime} className="runtime-recipe-card">
          <div className="runtime-recipe-head">
            <span className="runtime-recipe-label">{recipe.label}</span>
            <div className="runtime-recipe-actions">
              {getRuntimeDownloadUrl(recipe.runtime) ? (
                <a
                  className="pill-button"
                  href={getRuntimeDownloadUrl(recipe.runtime) || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download here
                </a>
              ) : null}
              {recipe.runtime === 'ollama' ? (
                <button
                  type="button"
                  className="pill-button"
                  onClick={() => void onCopyCommand(OLLAMA_INSTALL_COMMAND)}
                >
                  {copiedCommand === OLLAMA_INSTALL_COMMAND ? 'Copied' : 'Copy install'}
                </button>
              ) : null}
              {recipe.runtime === 'ollama' ? (
                <button
                  type="button"
                  className="pill-button"
                  onClick={() => void onCopyCommand(recipe.command)}
                >
                  {copiedCommand === recipe.command ? 'Copied' : 'Copy run'}
                </button>
              ) : null}
            </div>
          </div>
          <div className="runtime-recipe-command">
            {recipe.runtime === 'ollama' ? (
              <>
                <div className="mono">Install: {OLLAMA_INSTALL_COMMAND}</div>
                <div className="mono mt-1">Run: {recipe.command}</div>
              </>
            ) : (
              <div>Download LM Studio, open the app, and search for "{modelName}".</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
