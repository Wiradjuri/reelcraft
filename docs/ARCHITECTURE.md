# Architecture decisions

Short records of the decisions that shape ReelCraft, and why.

## 1. The browser never talks to AI providers

All AI calls happen server-side: UI → API → `ContentGenerationService` → `AIRouter` →
provider adapter. Provider SDKs are imported only in `app/ai/providers/`. Swapping or adding
a provider never touches the UI, routes or services.

## 2. Provider adapters translate everything into provider-neutral types

Each adapter implements `AIProvider.generate_structured()` and `list_models()` and maps SDK
exceptions to `AIError` subclasses (`AIAuthenticationError`, `AIRateLimited`,
`AIQuotaExceeded`, `AITimeout`, …). Each error carries a customer-friendly title/message plus
technical `details` that the UI only shows under "Advanced details", and a `failover` flag
telling the router whether another model might succeed.

OpenAI, OpenRouter and generic OpenAI-compatible servers share one Chat Completions
adapter. Compatible servers degrade from `json_schema` → `json_object` → prompt-only
structured output when a server rejects a mode.

## 3. Quality tiers, not model names

Customers choose **Auto / Fast / Professional / Premium**. `model_catalog.toml` maps tiers to
ordered model lists per provider (preferred first, fallbacks after) with provider tuning
(reasoning effort, thinking budgets). Auto scores each task (content complexity, number of
variations, expected length) and picks Fast or Professional; it never escalates to Premium,
which is an explicit, cost-bearing choice. Customers with their own provider can pin models
per tier under Settings → AI & Integrations → Advanced.

The router deprioritises models that keep failing (a small circuit breaker), retries once with
a repair hint when output is malformed, and fails over to the next model on retryable errors.

## 4. Structured output from Pydantic models

`app/content/schemas.py` defines the payloads (`ReelProject`, `Caption`, `Quote`,
`PostIdea`). The JSON schema sent to providers is generated from them
(`json_schema.py` inlines `$ref`s, forces `additionalProperties: false`, strips keywords some
providers reject) and every response is validated by the same models before it is stored or
shown. Invalid output is never persisted.

## 5. Content-type registry

`app/content/registry.py` describes each content type: payload model, complexity, token
budget, variation limits and which components can be regenerated. Routing, prompting,
validation, regeneration and the `/catalog` API all derive from it. Adding a type (e.g.
"campaign" or "carousel") means adding a payload model and a registry entry.

## 6. Prompts live in one testable layer

`app/content/prompts/` composes prompts from sections: brand profile, platform rules,
content-type instructions, request, tone, emoji/hashtag/CTA constraints and variation
angles. Customer text is wrapped in tagged blocks and the system prompt tells the model to
treat it as data (prompt-injection hardening). `PROMPT_VERSION` is stored on every
generation.

**Variations differ by construction:** each variation is assigned a distinct creative angle
(Direct, Story-driven, Conversational, Bold, Educational, Curiosity, …) ordered by the
objective, and the prompt instructs the model to vary hooks, structure and CTAs.

## 7. Data model

- `User`, `Workspace`, `WorkspaceMember(role)`: multi-tenant from day one; every query is
  scoped to the caller's workspace. Roles (viewer < editor < admin < owner) are enforced in
  services via `RequestContext.require()`.
- `BrandProfile`: soft-deleted so history keeps its context.
- `ContentGeneration` *is* the generation history: request, settings, a **brand snapshot**,
  provider/model, prompt version, tokens and latency. Failed generations are recorded too.
- `ContentItem`: one variation; typed payload in JSON (`ReelProject`, `Caption`, `Quote`,
  `PostIdea`) discriminated by `content_type`. JSON keeps the schema flexible as content
  types evolve, and JSONB makes it queryable on PostgreSQL.
- `SavedContent`: library entry that snapshots the payload and how it was generated, so it
  survives history clean-up; includes tags, favourites, notes and a `status` field ready for
  approval/scheduling workflows.
- `ProviderSettings`: Bring-Your-Own-AI connections, API keys encrypted with Fernet.
- `UsageEvent`: per-call AI metering (provider, model, tier, tokens, success): the basis for
  quotas, plans and billing.

## 8. Authentication and request security

- Email/password accounts (Argon2 hashes) with opaque session tokens stored **hashed** in
  `auth_sessions`, delivered as `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production).
- CSRF: every state-changing API request must carry `X-Requested-With: reelcraft`; browsers
  can't add custom headers cross-site without a CORS preflight, which the CORS policy denies.
- The first person to open a fresh installation creates the owner account in the setup
  wizard; afterwards `ALLOW_PUBLIC_SIGNUP` controls self-service sign-up.
- Rate limits on login/sign-up and generation; request size limits; security headers;
  `/api/docs` disabled in production; stack traces never returned.
- Customer-supplied AI server URLs are validated, and private-network targets are rejected in
  production (SSRF protection).

## 9. Secrets

Platform AI keys come from the environment and are only used server-side. Customer keys are
encrypted at rest and never returned by the API (only a masked hint such as `sk-…a1b2`).
Logging passes through a redaction processor that drops sensitive keys and scrubs
key-shaped strings, and noisy HTTP client loggers are capped at WARNING.

## 10. Frontend structure

Feature folders (`features/*`) own pages; `lib/api/hooks.ts` owns all server state and cache
invalidation; `lib/content.ts` holds presentation rules (field layout, copy formatting) so
components stay thin. Design tokens live in `styles/index.css` as CSS variables (light and
dark), which is the seam for white-labelling agency workspaces later.

## Future work this architecture anticipates

Teams and invitations (memberships and roles exist), agency client workspaces, plans and
quotas (`Workspace.plan` + `UsageEvent`), approval and scheduling (`SavedContent.status`),
more platforms (`PLATFORMS` registry already lists TikTok, Facebook, LinkedIn and YouTube),
background generation jobs for very long requests, and visual quote cards (`Quote.card`
already carries headline, subtext and design direction).
