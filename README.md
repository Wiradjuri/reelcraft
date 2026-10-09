# ReelFlow

ReelFlow is a working MVP that turns one topic into an editable short-form vertical video plan and a downloadable 1080 × 1920 MP4. It combines provider-independent AI text generation with deterministic demo fixtures and assembles the final video with Remotion.

## What works

- Dashboard with status, reopen, duplicate and delete actions.
- Creative brief for audience, platform, objective, tone, duration, style, voice, CTA and brand notes.
- Structured script and storyboard generation with Zod validation.
- Editable script sections and reorderable, addable and removable scenes.
- Live text generation through OpenAI, Anthropic, Nous Portal, Grok/xAI, Google Gemini, OpenRouter, LM Studio, or a custom OpenAI-compatible endpoint.
- Separately configurable scene-image generation and TTS narration through an OpenAI-compatible media endpoint.
- Animated captions, image movement, transitions, voice-over and optional music support in the Remotion composition.
- In-browser vertical preview, local MP4 rendering and JSON export.
- Deterministic demo mode that needs no API key or credits.
- Persisted projects with progress, render job and recoverable error state.

## Architecture

The Next.js App Router serves both the React creator UI and server API routes. `src/lib/repository.ts` is a small atomic JSON repository stored at `data/projects.json`; this keeps the MVP single-service and easy to run locally. It is suitable for one local Node instance, but production or multi-instance deployment should replace the repository implementation with a managed SQL database.

`src/lib/ai-providers.ts` is the server-only text-provider boundary. Anthropic uses its Messages API; the other presets use their OpenAI-compatible Chat Completions endpoints. `src/lib/ai.ts` validates every plan with Zod and keeps image and speech generation behind a separate media client. API keys, endpoint overrides, and model IDs remain server-only.

`src/lib/renderer.ts` implements the `VideoRenderer` interface with a local Remotion renderer. This boundary can be replaced by a queued hosted renderer without changing the UI or project model.

## Prerequisites

- Node.js 22 or newer (Node 24 was used during development)
- npm
- FFmpeg for local rendering
- A Chromium-compatible browser downloaded by Remotion on the first render
- Credentials for the selected provider only when using live mode (LM Studio can run keyless)

## Install and run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo mode is enabled in the top bar and does not call an AI provider. The included project is ready to preview.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `REELFLOW_TEXT_PROVIDER` | `openai`, `anthropic`, `nous`, `grok`, `google`, `openrouter`, `lmstudio`, or `custom` | `openai` |
| `REELFLOW_PLANNING_MODEL` | Provider model ID for structured plans | OpenAI default; required otherwise |
| `REELFLOW_COPY_MODEL` | Provider model ID for section rewrites | planning model |
| `REELFLOW_TEXT_API_KEY` | Generic override for the preset credential | provider-specific key |
| `REELFLOW_TEXT_BASE_URL` | Endpoint override; required for `custom` | provider preset |
| `REELFLOW_MEDIA_API_KEY` | Credential for images and speech | `OPENAI_API_KEY` |
| `REELFLOW_MEDIA_BASE_URL` | OpenAI-compatible images/speech endpoint | OpenAI |
| `REELFLOW_IMAGE_MODEL` | Standard scene imagery | `gpt-image-2.5-flare` |
| `REELFLOW_PREMIUM_IMAGE_MODEL` | Optional premium imagery | `gpt-image-2.5-sunburst` |
| `REELFLOW_TTS_MODEL` | Voice-over generation | `gpt-4o-mini-tts` |
| `REELFLOW_DEMO_MODE` | Documented deployment default; the current UI toggle starts enabled | `true` |

Provider-specific credentials are `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `NOUS_API_KEY`, `XAI_API_KEY`, `GEMINI_API_KEY`, and `OPENROUTER_API_KEY`. Provider-specific model variables such as `GEMINI_PLANNING_MODEL` and `GEMINI_COPY_MODEL` are also accepted. Never use a `NEXT_PUBLIC_` prefix for credentials; the browser only calls ReelFlow API routes.

### Provider examples

For Gemini:

```bash
REELFLOW_TEXT_PROVIDER=google
GEMINI_API_KEY=your_key
REELFLOW_PLANNING_MODEL=your_gemini_model
```

For OpenRouter (model IDs include the provider prefix):

```bash
REELFLOW_TEXT_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key
REELFLOW_PLANNING_MODEL=anthropic/your_model
```

For a local LM Studio server:

```bash
REELFLOW_TEXT_PROVIDER=lmstudio
REELFLOW_PLANNING_MODEL=the_model_identifier_shown_in_lm_studio
# Optional when LM Studio is not on the default endpoint:
REELFLOW_TEXT_BASE_URL=http://127.0.0.1:1234/v1
```

See `.env.example` for all presets and overrides. The Nous preset endpoint can be overridden with `NOUS_BASE_URL` if the endpoint shown in your Portal account differs.

## Demo and live generation

Demo mode creates a deterministic script and five-scene storyboard from local fixtures. The Remotion preview uses deterministic gradient scenes if no generated image is present, so the whole edit/preview/render workflow can be reviewed without spending credits.

Turn off **Demo** before creating a project to use the configured live text provider. Image and narration requests use the separately configured media endpoint. If no compatible media credential is configured, the validated script and storyboard are still saved while image and voice failures are retained as retryable warnings.

## Tests and checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

The tests cover provider configuration, schema validation, incomplete model output, duration normalization, caption timing, CRUD persistence, safe API errors, the server-only credential boundary and deterministic Remotion fixture metadata. External provider calls are not made by tests.

## Rendering

Use **Render MP4** in the preview screen. The Node server bundles the Remotion composition, renders H.264, writes the output to `public/exports`, and returns a download link. The first render may take longer while Remotion prepares Chromium.

To render the deterministic fixture directly:

```bash
npm run render:demo
```

The output is `public/exports/reelflow-demo.mp4`.

## Security and operational notes

- Inputs and all model output are schema-validated.
- Project identifiers are UUID-validated before file-affecting operations.
- Generated filenames are random UUIDs; user strings never become server paths.
- API errors shown to users omit internal details.
- Basic in-memory throttling limits create, generation and render requests. In production, enforce distributed rate limits at the gateway or shared data layer.
- Uploaded files are not part of this MVP, so no upload endpoint or arbitrary-file rendering surface exists.
- The app does not publish to social platforms, run model-generated commands, add analytics or use an OpenAI video-generation API.

## Known MVP limitations

- JSON persistence supports a single durable Node instance only; serverless and horizontally scaled deployments need a shared database and object storage.
- Rendering is synchronous in the request process. Production should use a durable queue, worker, cancellation signal and authenticated job-status endpoint.
- Render progress is persisted in 10% increments but the MVP request waits for completion rather than polling in the browser.
- Background music ducking is implemented as a low fixed music mix when a music asset exists; there is no upload/licensing UI yet.
- Demo mode does not synthesize spoken audio, so its deterministic preview/render is silent unless a voice asset is generated in live mode.
- Authentication and per-user authorization are intentionally out of scope for this local MVP and are required before public deployment.

## Production deployment

Run on a long-lived Node host with sufficient CPU, memory, local Chromium support and writable storage, or replace `VideoRenderer` with a hosted render worker. Add authentication, per-project authorization, shared SQL persistence, object storage, distributed throttling, queue-backed rendering, retention policies and monitoring before exposing the app publicly.
