# ReelCraft — AI Social Content Studio

A CGM Software & Tech Solutions product. ReelCraft helps businesses, agencies and creators
produce on-brand Instagram content: complete **Reel plans** (hook, shot list, script,
on-screen text, caption), **captions**, **quotes** and **post ideas**, in several genuinely
different variations, with per-component editing and regeneration, a content library and
full generation history.

> **These instructions are for developers and operators.** Customers never use a terminal,
> edit `.env` files or see model names: they sign up, complete the in-app setup wizard and
> configure everything (brands, AI provider, preferences) through the interface.

---

## Architecture at a glance

```
React UI (frontend/)            never talks to AI providers
   │  same-origin JSON API, session cookie + CSRF header
FastAPI (backend/app/api)       validation, auth, rate limits, friendly errors
   │
Services (app/services)         brands, generation, library/history, AI settings
   │
Prompt layer (app/content)      brand + platform + type + objective + tone + request + schema
   │
AI router (app/ai/router.py)    Auto/Fast/Professional/Premium → model, failover, repair retry
   │
Provider adapters (app/ai/providers)  OpenAI · Anthropic · Gemini · OpenRouter · OpenAI-compatible
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design decisions.

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI primitives, TanStack Query, React Router |
| Backend | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic, structlog |
| Database | PostgreSQL in production (asyncpg); SQLite for local development |
| AI SDKs | `openai`, `anthropic`, `google-genai` |
| Tooling | uv, ruff, mypy (strict), pytest · pnpm, ESLint, Prettier, Vitest, Testing Library, MSW |

## Requirements

- Python 3.13 and [uv](https://docs.astral.sh/uv/)
- Node.js 22+ and [pnpm](https://pnpm.io/)
- PostgreSQL 15+ for production (optional locally)

## Installation

```bash
make install          # uv sync + pnpm install
cp .env.example .env  # optional: only needed to set platform AI keys etc.
```

## Configuration

All operator configuration is environment-based — see the annotated [`.env.example`](.env.example).
The important settings:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Defaults to SQLite in `backend/data/`. Use `postgresql+asyncpg://…` in production. |
| `SECRET_ENCRYPTION_KEY` | Fernet key that encrypts customers' own AI keys at rest. **Required in production.** Auto-generated locally. |
| `PLATFORM_AI_PROVIDER` + `OPENAI_API_KEY` (etc.) | CGM-hosted AI used by customers on "ReelCraft AI". Never exposed to browsers. |
| `AI_MODEL_CATALOG_PATH` | Optional override of [`backend/app/ai/model_catalog.toml`](backend/app/ai/model_catalog.toml) (tier → model mapping). |
| `CORS_ORIGINS`, `TRUSTED_HOSTS` | Restrict browser origins and Host headers. |
| `ALLOW_PRIVATE_AI_URLS` | Whether customers may point "Local / custom server" at private-network addresses. Off in production by default (SSRF protection). |

If no platform AI key is configured, the setup wizard asks the customer to connect their own
provider instead — still entirely through the UI.

### Changing AI models

Edit `backend/app/ai/model_catalog.toml` (or your override file). Each quality tier lists a
preferred model and fallbacks per provider, plus provider-specific tuning such as reasoning
effort. No code changes are needed; restart the API to pick up changes.

## Database setup

```bash
make migrate                          # alembic upgrade head (SQLite by default)
DATABASE_URL=postgresql+asyncpg://user:pass@host/db make migrate
```

Create a new migration after changing models:
`cd backend && uv run alembic revision --autogenerate -m "describe change"`.

## Running in development

```bash
make dev-api   # http://localhost:8000  (API docs at /api/docs)
make dev-web   # http://localhost:5173  (proxies /api to the backend)
```

Open http://localhost:5173 — on a fresh database the setup wizard starts automatically.

## Testing and quality checks

```bash
make test      # backend pytest + frontend vitest
make check     # + ruff, formatting, mypy --strict, tsc, eslint, prettier
```

AI providers are mocked in tests (at the adapter boundary and with HTTP mock transports),
so the suite runs offline and costs nothing.

## Building for production

```bash
make build     # frontend → frontend/dist
make serve     # one process: API + built UI on http://127.0.0.1:8000
```

For production deployments:

1. Set `ENVIRONMENT=production`, `SECRET_ENCRYPTION_KEY`, `DATABASE_URL` (PostgreSQL),
   `CORS_ORIGINS`, `TRUSTED_HOSTS`, `LOG_JSON=true` and the platform AI key(s).
2. Run `alembic upgrade head` as a release step.
3. Run `uvicorn app.main:app --workers N` behind a TLS-terminating reverse proxy
   (cookies are `Secure` in production). Either serve `frontend/dist` from the API
   (`FRONTEND_DIST_DIR`) or from a CDN on the same origin.
4. The in-process rate limiter and AI health tracker are per-process; use a shared store
   (e.g. Redis) behind the same interfaces when scaling horizontally.

## Repository layout

```
backend/
  app/
    api/            HTTP routes and dependencies (auth, CSRF, rate limits)
    ai/             provider adapters, router, model catalogue, errors
    content/        content types, output schemas, prompt builder
    services/       business logic (brands, generation, library, AI settings, auth)
    db/             SQLAlchemy models and session management
    core/           config, logging (secret redaction), security, errors
  alembic/          migrations
  tests/            pytest suite
frontend/
  src/
    features/       pages: setup, dashboard, create, results, library, history, brands, settings
    components/     UI primitives, layout, content renderers
    lib/            API client + hooks, content formatting, utilities
docs/               architecture decisions
```
