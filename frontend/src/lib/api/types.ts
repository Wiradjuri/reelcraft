/** Types mirroring the backend API (app/schemas). */

export type ContentType = 'reel' | 'caption' | 'quote' | 'post_idea'
export type Quality = 'auto' | 'fast' | 'professional' | 'premium'
export type Tone =
  | 'professional'
  | 'conversational'
  | 'bold'
  | 'luxury'
  | 'playful'
  | 'educational'
  | 'inspirational'
  | 'direct'
export type EmojiStyle = 'none' | 'light' | 'expressive'
export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'openai_compatible'
export type Tier = 'fast' | 'professional' | 'premium'

export interface ApiErrorBody {
  code: string
  title: string
  message: string
  retryable: boolean
  details: Record<string, unknown>
}

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

// --- Account -------------------------------------------------------------------
export interface SetupStatus {
  needs_account: boolean
  authenticated: boolean
  onboarding_completed: boolean
  signup_allowed: boolean
  platform_ai_available: boolean
}

export interface User {
  id: string
  email: string
  name: string
}

export interface Workspace {
  id: string
  name: string
  plan: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  active_brand_id: string | null
  onboarding_completed: boolean
  ai_source: 'platform' | 'custom'
  preferences: { default_quality: Quality }
}

export interface Session {
  user: User
  workspace: Workspace
}

export interface SignupInput {
  name: string
  email: string
  password: string
  workspace_name: string
}

// --- Brands --------------------------------------------------------------------
export interface BrandFields {
  name: string
  industry: string
  description: string
  products_services: string
  target_audience: string
  location: string
  tone_of_voice: Tone
  personality: string
  content_pillars: string[]
  writing_preferences: string
  preferred_terminology: string[]
  cta_style: string
  prohibited_words: string[]
  prohibited_subjects: string[]
  brand_values: string[]
  default_hashtags: string[]
  emoji_style: EmojiStyle
  additional_instructions: string
}

export interface Brand extends BrandFields {
  id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BrandInput = Partial<BrandFields> & { name: string; make_active?: boolean }

// --- Catalog -------------------------------------------------------------------
export interface Option {
  value: string
  label: string
  description?: string
}

export interface Catalog {
  platforms: { value: string; label: string; available: boolean; caption_max_chars: number }[]
  content_types: {
    value: ContentType
    label: string
    description: string
    default_variations: number
    max_variations: number
    regenerable_fields: { name: string; label: string }[]
  }[]
  objectives: Option[]
  tones: Option[]
  qualities: Option[]
  caption_lengths: Option[]
  caption_styles: Option[]
  quote_categories: Option[]
  emoji_styles: Option[]
  reel_durations: number[]
  ai_providers: ProviderInfo[]
}

export interface ProviderInfo {
  id: ProviderId
  label: string
  description: string
  requires_api_key: boolean
  requires_base_url: boolean
  base_url_placeholder: string
  api_key_help_url: string
  supports_model_discovery: boolean
}

// --- Content payloads -----------------------------------------------------------
export interface ReelScene {
  timing: string
  visual: string
  action: string
  on_screen_text: string
  voiceover: string
}

export interface ReelProject {
  title: string
  concept: string
  hook: string
  opening_shot: string
  scenes: ReelScene[]
  script: string
  voiceover: string
  on_screen_text: string[]
  audio_suggestion: string
  caption: string
  cta: string
  hashtags: string[]
  estimated_duration_seconds: number
}

export interface Caption {
  hook: string
  body: string
  cta: string
  hashtags: string[]
}

export interface Quote {
  text: string
  attribution: string
  category: string
  caption: string
  hashtags: string[]
  card: { headline: string; subtext: string; visual_direction: string }
}

export interface PostIdea {
  title: string
  format: string
  hook: string
  outline: string[]
  visual_direction: string
  caption: string
  cta: string
  hashtags: string[]
}

export type ContentPayload = ReelProject | Caption | Quote | PostIdea

// --- Generation ------------------------------------------------------------------
export interface GenerationOptions {
  reel_duration: number
  caption_length: 'short' | 'medium' | 'long'
  caption_style: string
  emoji_style: EmojiStyle | null
  include_hashtags: boolean
  hashtag_count: number
  include_cta: boolean
  cta_preference: string
  quote_category: string
}

export interface GenerateInput {
  brand_id?: string | null
  platform: string
  content_type: ContentType
  topic: string
  objective: string
  tone: Tone | 'brand'
  quality: Quality
  variations: number
  options: Partial<GenerationOptions>
  notes: string
}

export interface ContentItem {
  id: string
  generation_id: string
  content_type: ContentType
  position: number
  angle: string
  data: Record<string, unknown>
  is_edited: boolean
  saved_id: string | null
  updated_at: string
}

export interface GenerationSummary {
  id: string
  brand_id: string | null
  brand_name: string
  platform: string
  content_type: ContentType
  title: string
  topic: string
  objective: string
  quality_requested: Quality
  status: 'succeeded' | 'failed'
  item_count: number
  created_at: string
}

export interface Generation extends GenerationSummary {
  request: GenerateInput & { options: GenerationOptions }
  items: ContentItem[]
  meta: {
    quality_resolved: Tier | null
    ai_source: string | null
    provider: string | null
    model: string | null
    prompt_version: string | null
    input_tokens: number
    output_tokens: number
    latency_ms: number
  }
}

// --- Library -----------------------------------------------------------------------
export interface SavedContent {
  id: string
  brand_id: string | null
  brand_name: string
  item_id: string | null
  generation_id: string | null
  platform: string
  content_type: ContentType
  title: string
  data: Record<string, unknown>
  generation_context: {
    topic?: string
    objective?: string
    tone?: string
    angle?: string
    brand_name?: string
    generated_at?: string
  }
  tags: string[]
  notes: string
  is_favourite: boolean
  status: string
  created_at: string
  updated_at: string
}

export interface LibraryQuery {
  q?: string
  content_type?: string
  brand_id?: string
  favourites?: boolean
  tag?: string
  /** Only items saved in the last N days. */
  since_days?: number
  limit?: number
  offset?: number
}

export interface Stats {
  generations: number
  pieces_created: number
  saved: number
  favourites: number
}

// --- AI settings ----------------------------------------------------------------------
export interface ProviderConnection {
  provider: ProviderId
  has_api_key: boolean
  key_hint: string | null
  base_url: string | null
  tier_models: Partial<Record<Tier, string>>
  last_test_ok: boolean | null
  last_test_message: string | null
  last_tested_at: string | null
}

export interface AISettings {
  ai_source: 'platform' | 'custom'
  active_provider: ProviderId | null
  platform_ai_available: boolean
  connections: ProviderConnection[]
}

export interface ConnectionInput {
  provider: ProviderId
  api_key?: string | null
  base_url?: string | null
  tier_models?: Partial<Record<Tier, string>>
}

export interface TestConnectionResult {
  ok: boolean
  title: string
  message: string
  models: { id: string; label: string }[]
  details: Record<string, unknown>
}
