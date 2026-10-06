/** A small stateful in-memory API used by workflow tests (mirrors backend contracts). */
import { http, HttpResponse } from 'msw'

import type { Brand, Catalog, ContentItem, Generation, Session } from '@/lib/api/types'

export const catalog: Catalog = {
  platforms: [
    { value: 'instagram', label: 'Instagram', available: true, caption_max_chars: 2200 },
    { value: 'tiktok', label: 'TikTok', available: false, caption_max_chars: 4000 },
  ],
  content_types: [
    {
      value: 'reel',
      label: 'Reel',
      description: '',
      default_variations: 3,
      max_variations: 4,
      regenerable_fields: [
        { name: 'hook', label: 'Hook' },
        { name: 'caption', label: 'Caption' },
      ],
    },
    {
      value: 'caption',
      label: 'Caption',
      description: '',
      default_variations: 3,
      max_variations: 5,
      regenerable_fields: [{ name: 'hook', label: 'Opening line' }],
    },
  ],
  objectives: [
    { value: 'engagement', label: 'Engagement' },
    { value: 'promotion', label: 'Promotion' },
  ],
  tones: [
    { value: 'conversational', label: 'Conversational' },
    { value: 'playful', label: 'Playful' },
  ],
  qualities: [
    { value: 'auto', label: 'Auto', description: 'Recommended.' },
    { value: 'fast', label: 'Fast', description: 'Quick.' },
    { value: 'professional', label: 'Professional', description: 'Higher quality.' },
    { value: 'premium', label: 'Premium', description: 'Best.' },
  ],
  caption_lengths: [
    { value: 'short', label: 'Short' },
    { value: 'medium', label: 'Medium' },
    { value: 'long', label: 'Long' },
  ],
  caption_styles: [{ value: 'general', label: 'General' }],
  quote_categories: [{ value: 'motivational', label: 'Motivational' }],
  emoji_styles: [
    { value: 'none', label: 'No emojis' },
    { value: 'light', label: 'A few emojis' },
  ],
  reel_durations: [15, 30, 45, 60],
  ai_providers: [
    {
      id: 'openai',
      label: 'OpenAI',
      description: 'GPT models.',
      requires_api_key: true,
      requires_base_url: false,
      base_url_placeholder: '',
      api_key_help_url: 'https://platform.openai.com/api-keys',
      supports_model_discovery: true,
    },
  ],
}

const now = () => new Date().toISOString()

export function reelData(n: number) {
  return {
    title: `Reel ${n}`,
    concept: 'A cosy reveal.',
    hook: `Hook number ${n}`,
    opening_shot: 'Steam close-up',
    scenes: [
      { timing: '0-3s', visual: 'Steam', action: 'Pour', on_screen_text: 'Back!', voiceover: 'Guess what?' },
      { timing: '3-30s', visual: 'Cup', action: 'Sip', on_screen_text: '', voiceover: '' },
    ],
    script: 'Guess what? It is back.',
    voiceover: 'Warm',
    on_screen_text: ['Back!'],
    audio_suggestion: 'Lo-fi',
    camera_setup: 'Vertical, tripod',
    b_roll: ['Milk steaming'],
    edit_notes: ['Punch in on the reveal'],
    thumbnail_text: 'The latte is back',
    details_to_confirm: [],
    caption: 'Autumn in a cup.',
    cta: 'Tag a friend',
    hashtags: ['#latte'],
    estimated_duration_seconds: 30,
  }
}

export interface MockState {
  hasUser: boolean
  authenticated: boolean
  onboarded: boolean
  brands: Brand[]
  generations: Generation[]
  requests: { method: string; path: string; body: unknown }[]
}

export function createMockApi(initial: Partial<MockState> = {}) {
  const state: MockState = {
    hasUser: false,
    authenticated: false,
    onboarded: false,
    brands: [],
    generations: [],
    requests: [],
    ...initial,
  }
  const session = (): Session => ({
    user: { id: 'u1', email: 'alex@example.com', name: 'Alex' },
    workspace: {
      id: 'w1',
      name: 'Bloom Studio',
      plan: 'starter',
      role: 'owner',
      active_brand_id: state.brands[0]?.id ?? null,
      onboarding_completed: state.onboarded,
      ai_source: 'platform',
      preferences: { default_quality: 'auto' },
    },
  })
  const record = async (request: Request) => {
    const body =
      request.method === 'GET'
        ? undefined
        : await request
            .clone()
            .json()
            .catch(() => undefined)
    state.requests.push({ method: request.method, path: new URL(request.url).pathname, body })
    return body as Record<string, unknown>
  }
  const unauthorised = () =>
    HttpResponse.json(
      {
        error: { code: 'auth_required', title: 'Please sign in', message: '', retryable: false, details: {} },
      },
      { status: 401 },
    )

  const handlers = [
    http.get('*/api/v1/setup/status', () =>
      HttpResponse.json({
        needs_account: !state.hasUser,
        authenticated: state.authenticated,
        onboarding_completed: state.onboarded,
        signup_allowed: true,
        platform_ai_available: true,
      }),
    ),
    http.get('*/api/v1/catalog', () => HttpResponse.json(catalog)),
    http.get('*/api/v1/auth/session', () =>
      state.authenticated ? HttpResponse.json(session()) : unauthorised(),
    ),
    http.post('*/api/v1/auth/signup', async ({ request }) => {
      await record(request)
      state.hasUser = true
      state.authenticated = true
      return HttpResponse.json(session(), { status: 201 })
    }),
    http.get('*/api/v1/brands', () => HttpResponse.json(state.brands)),
    http.post('*/api/v1/brands', async ({ request }) => {
      const body = await record(request)
      const brand = {
        id: `b${state.brands.length + 1}`,
        is_active: true,
        created_at: now(),
        updated_at: now(),
        industry: '',
        description: '',
        products_services: '',
        target_audience: '',
        location: '',
        tone_of_voice: 'conversational',
        personality: '',
        content_pillars: [],
        writing_preferences: '',
        preferred_terminology: [],
        cta_style: '',
        prohibited_words: [],
        prohibited_subjects: [],
        brand_values: [],
        default_hashtags: [],
        emoji_style: 'light',
        additional_instructions: '',
        ...body,
      } as unknown as Brand
      state.brands.push(brand)
      return HttpResponse.json(brand, { status: 201 })
    }),
    http.get('*/api/v1/settings/ai', () =>
      HttpResponse.json({
        ai_source: 'platform',
        active_provider: null,
        platform_ai_available: true,
        connections: [],
      }),
    ),
    http.post('*/api/v1/setup/complete', async ({ request }) => {
      await record(request)
      state.onboarded = true
      return HttpResponse.json(session().workspace)
    }),
    http.get('*/api/v1/workspace/stats', () =>
      HttpResponse.json({ generations: 0, pieces_created: 0, saved: 0, favourites: 0 }),
    ),
    http.get('*/api/v1/generations', () =>
      HttpResponse.json({ items: state.generations, total: state.generations.length, limit: 20, offset: 0 }),
    ),
    http.get('*/api/v1/library', () => HttpResponse.json({ items: [], total: 0, limit: 24, offset: 0 })),
    http.post('*/api/v1/generations', async ({ request }) => {
      const body = (await record(request)) as unknown as Generation['request']
      const id = `g${state.generations.length + 1}`
      const items: ContentItem[] = Array.from({ length: body.variations }, (_, i) => ({
        id: `${id}-i${i}`,
        generation_id: id,
        content_type: body.content_type,
        position: i,
        angle: ['Conversational', 'Curiosity', 'Bold', 'Direct'][i] ?? 'Direct',
        data: reelData(i + 1),
        is_edited: false,
        saved_id: null,
        updated_at: now(),
      }))
      const generation: Generation = {
        id,
        brand_id: state.brands[0]?.id ?? null,
        brand_name: state.brands[0]?.name ?? '',
        platform: 'instagram',
        content_type: body.content_type,
        title: 'Reel 1',
        topic: body.topic,
        objective: body.objective,
        quality_requested: body.quality,
        status: 'succeeded',
        item_count: items.length,
        created_at: now(),
        request: { ...body, options: { ...body.options } as Generation['request']['options'] },
        items,
        meta: {
          quality_resolved: 'professional',
          ai_source: 'platform',
          provider: 'openai',
          model: 'gpt-test',
          prompt_version: '1',
          input_tokens: 10,
          output_tokens: 20,
          latency_ms: 1200,
        },
      }
      state.generations.unshift(generation)
      return HttpResponse.json(generation, { status: 201 })
    }),
    http.get('*/api/v1/generations/:id', ({ params }) => {
      const generation = state.generations.find((g) => g.id === params.id)
      return generation ? HttpResponse.json(generation) : HttpResponse.json({}, { status: 404 })
    }),
    http.post('*/api/v1/items/:id/regenerate', async ({ request, params }) => {
      const body = await record(request)
      const item = state.generations.flatMap((g) => g.items).find((i) => i.id === params.id)!
      item.data = { ...item.data, [String(body.field)]: `Fresh ${String(body.field)}` }
      item.is_edited = true
      return HttpResponse.json(item)
    }),
    http.patch('*/api/v1/items/:id', async ({ request, params }) => {
      const body = await record(request)
      const item = state.generations.flatMap((g) => g.items).find((i) => i.id === params.id)!
      item.data = { ...item.data, ...(body.data as object) }
      item.is_edited = true
      return HttpResponse.json(item)
    }),
    http.post('*/api/v1/library', async ({ request }) => {
      const body = await record(request)
      const item = state.generations.flatMap((g) => g.items).find((i) => i.id === body.item_id)!
      item.saved_id = `s-${item.id}`
      return HttpResponse.json({ id: item.saved_id }, { status: 201 })
    }),
  ]
  return { state, handlers }
}
