# AI Hardware Check

A browser-only tool that detects your system hardware and estimates which open-source AI models you can run locally — no uploads, no accounts, no backend.

![Screenshot](artifacts/webui.png)

## Features

- **Model library** — curated catalog of 40+ model families (Meta, Mistral, DeepSeek, Qwen, Google, and more), grouped by provider and family
- **Add any model** — paste a HuggingFace repo ID and the app fetches parameter count, modality, and provider automatically, then groups it alongside the built-in catalog
- **RAM fit estimation** — compares your system RAM against per-quantization requirements (FP16 → Q2_K) with a 30 % runtime overhead buffer
- **Quantization table** — every quant row links directly to the HuggingFace repo or a pre-filled search for community GGUF downloads
- **System hardware snapshot** — CPU threads, RAM, GPU renderer, WebGL / WebGPU status, all from browser APIs
- **Search & filters** — filter by provider, compatibility status, or modality; full-text search across model names, families, and repo IDs
- **Dark / light theme** — persisted to `localStorage`
- **100 % client-side** — no server, no data collection

## Quick Start (Docker Hub)

> Replace `YOUR_DOCKERHUB_USERNAME` with the actual image name after it is published.

```bash
# Pull and run in one step
docker run --rm -p 8080:80 YOUR_DOCKERHUB_USERNAME/ai-hardware-check
```

Then open <http://localhost:8080>.

### docker-compose

```bash
# docker-compose.yml is already in the repo — just edit the image name, then:
docker compose up -d
```

## Local Development

```bash
npm install
npm run dev        # http://localhost:5173
```

## Production Build

```bash
npm run build      # output in dist/
npm run preview    # serve the built output locally
```

## Docker (self-host / build from source)

```bash
# Build
docker build -t ai-hardware-check .

# Run on port 8080
docker run --rm -p 8080:80 ai-hardware-check
```

## Adding Models

Click the input bar at the top of the page and paste any public HuggingFace repo ID, for example:

```
Qwen/QwQ-32B
mistralai/Mistral-Small-3.2-24B-Instruct-2506
google/gemma-3-27b-it
```

The app fetches the safetensors parameter count and pipeline tag, derives the provider from the org prefix, estimates RAM requirements, and persists the entry in `localStorage` across reloads. Custom models can be removed from the detail panel.

## Model Catalog

Models are stored in `public/models.json`. Each entry supports:

| Field | Description |
|---|---|
| `name` | Display name |
| `provider` | Company / org (used for grouping) |
| `family` | Model family name (optional, defaults to `name`) |
| `parameter_count` | e.g. `8B`, `70B`, `1T` |
| `huggingface_repo` | `org/model-name` |
| `modalities` | `["Text"]`, `["Image","Text"]`, etc. |
| `formats` | Quantization formats available |
| `ram_requirements_gb` | Optional overrides per quant key |
| `release_date` | ISO date string for recency sorting (optional) |
| `quant_download_links` | Explicit download URLs per quant key (optional) |
| `notes` | Short note shown in the UI (optional) |

RAM is auto-estimated from `parameter_count` when `ram_requirements_gb` is not provided.

## License

MIT

