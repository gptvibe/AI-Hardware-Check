import { normalizeModelEntry, type ModelDatabaseEntry } from './compatibility'

const HF_REPO_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/

const HF_ORG_TO_PROVIDER: Record<string, string> = {
  'meta-llama': 'Meta',
  facebook: 'Meta',
  openai: 'OpenAI',
  'deepseek-ai': 'DeepSeek',
  mistralai: 'Mistral',
  google: 'Google',
  microsoft: 'Microsoft',
  qwen: 'Alibaba',
  'alibaba-nlp': 'Alibaba',
  zhipuai: 'Z.ai',
  THUDM: 'Z.ai',
  thudm: 'Z.ai',
  'minimax-ai': 'MiniMax',
  moonshotai: 'Moonshot AI',
  nvidia: 'NVIDIA',
  'baichuan-inc': 'Baichuan',
  lmsys: 'LMSYS',
  eleutherai: 'EleutherAI',
  stabilityai: 'Stability AI',
  tiiuae: 'TII UAE',
  nousresearch: 'Nous Research',
  anthropic: 'Anthropic',
  cohere: 'Cohere',
}

const PIPELINE_TAG_TO_MODALITIES: Record<string, string[]> = {
  'text-generation': ['Text'],
  'text2text-generation': ['Text'],
  'image-to-text': ['Image', 'Text'],
  'visual-question-answering': ['Image', 'Text'],
  'image-text-to-text': ['Image', 'Text'],
  'text-to-image': ['Image'],
  'automatic-speech-recognition': ['Audio'],
  'text-to-speech': ['Audio'],
  'audio-classification': ['Audio'],
  'video-classification': ['Video'],
  'text-to-video': ['Video'],
}

type HuggingFaceModelApiResponse = {
  pipeline_tag?: string
  safetensors?: { total?: number }
  config?: { max_position_embeddings?: number; n_ctx?: number }
}

const formatParameterCount = (totalParams: number) => {
  const paramsB = totalParams / 1e9
  if (paramsB >= 1000) {
    return `${(paramsB / 1000).toFixed(1)}T`
  }
  if (paramsB >= 10) {
    return `${Math.round(paramsB)}B`
  }
  if (paramsB >= 1) {
    return `${paramsB.toFixed(1)}B`
  }
  return `${Math.round(paramsB * 1000)}M`
}

export const normalizeHfRepoInput = (value: string): string | null => {
  const trimmed = value.trim()
  if (HF_REPO_PATTERN.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    if (!/^(www\.)?huggingface\.co$/i.test(url.hostname)) return null
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length < 2) return null
    const [org, repo] = segments
    const repoId = `${org}/${repo}`
    return HF_REPO_PATTERN.test(repoId) ? repoId : null
  } catch {
    return null
  }
}

export const validateHfRepoId = (repoId: string) => Boolean(normalizeHfRepoInput(repoId))

export const fetchHuggingFaceModelEntry = async (
  repoInput: string,
): Promise<
  | { ok: true; entry: ModelDatabaseEntry; provider: string; parameterCount: string; slug: string }
  | { ok: false; message: string }
> => {
  const repoId = normalizeHfRepoInput(repoInput)
  if (!repoId) {
    return { ok: false, message: 'Use a Hugging Face repo ID or model URL.' }
  }

  const response = await fetch(`https://huggingface.co/api/models/${repoId}`)
  if (response.status === 404) {
    return { ok: false, message: 'Model not found. Double-check the repo ID.' }
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, message: 'Private model — only public repos are supported.' }
  }
  if (!response.ok) {
    return { ok: false, message: `HuggingFace returned an error (${response.status}).` }
  }

  const data = await response.json() as HuggingFaceModelApiResponse
  const [org, ...rest] = repoId.split('/')
  const slug = rest.join('/')

  const provider =
    HF_ORG_TO_PROVIDER[org] ||
    HF_ORG_TO_PROVIDER[org.toLowerCase()] ||
    org.charAt(0).toUpperCase() + org.slice(1)

  let parameterCount = 'Unknown'
  const totalParams = data.safetensors?.total
  if (typeof totalParams === 'number' && totalParams > 0) {
    parameterCount = formatParameterCount(totalParams)
  } else {
    const sizeMatch = slug.match(/[-_](\d+\.?\d*)\s*([bBmMtT])\b/)
    if (sizeMatch) {
      parameterCount = `${sizeMatch[1]}${sizeMatch[2].toUpperCase()}`
    }
  }

  const modalities =
    (data.pipeline_tag && PIPELINE_TAG_TO_MODALITIES[data.pipeline_tag]) ||
    ['Text']
  const activeParamsB = typeof totalParams === 'number' && totalParams > 0
    ? Number((totalParams / 1e9).toFixed(2))
    : undefined
  const contextWindow =
    (typeof data.config?.max_position_embeddings === 'number' &&
      data.config.max_position_embeddings > 0
      ? Math.round(data.config.max_position_embeddings)
      : typeof data.config?.n_ctx === 'number' && data.config.n_ctx > 0
        ? Math.round(data.config.n_ctx)
        : 4096)

  const entry = normalizeModelEntry({
    name: slug,
    provider,
    family: slug,
    huggingface_repo: repoId,
    parameter_count: parameterCount,
    active_params_b: activeParamsB,
    context_windows: [contextWindow],
    runtime_recipe_templates: {
      ollama: 'ollama run hf.co/{repo}:{quant_tag}',
      llamacpp: 'llama-cli -hf {repo} -ngl 999 -c {context}',
    },
    modalities,
    formats: ['FP16', 'BF16', 'Safetensors'],
    ram_requirements_gb: {},
    userAdded: true,
  })

  return {
    ok: true,
    entry,
    provider,
    parameterCount,
    slug,
  }
}
