/** Creator form state and its translation into an API request (kept out of components for testing). */
import type { ContentType, EmojiStyle, GenerateInput, Generation, Quality, Tone } from '@/lib/api/types'

export interface CreatorState {
  brand_id: string | null
  platform: string
  topic: string
  objective: string
  tone: Tone | 'brand'
  quality: Quality
  variations: number
  notes: string
  reel_duration: number
  caption_length: 'short' | 'medium' | 'long'
  caption_style: string
  quote_category: string
  emoji_style: EmojiStyle | 'brand'
  include_hashtags: boolean
  hashtag_count: number
  include_cta: boolean
  cta_preference: string
}

export const DEFAULT_VARIATIONS: Record<ContentType, number> = { reel: 3, caption: 3, quote: 5, post_idea: 3 }
export const MAX_VARIATIONS: Record<ContentType, number> = { reel: 4, caption: 5, quote: 8, post_idea: 5 }

const DEFAULT_OBJECTIVE: Record<ContentType, string> = {
  reel: 'engagement',
  caption: 'engagement',
  quote: 'community',
  post_idea: 'education',
}

export function initialCreatorState(
  type: ContentType,
  { brandId = null, quality = 'auto' }: { brandId?: string | null; quality?: Quality } = {},
): CreatorState {
  return {
    brand_id: brandId,
    platform: 'instagram',
    topic: '',
    objective: DEFAULT_OBJECTIVE[type],
    tone: 'brand',
    quality,
    variations: DEFAULT_VARIATIONS[type],
    notes: '',
    reel_duration: 30,
    caption_length: 'medium',
    caption_style: 'general',
    quote_category: 'motivational',
    emoji_style: 'brand',
    include_hashtags: true,
    hashtag_count: 6,
    include_cta: true,
    cta_preference: '',
  }
}

/** Rebuild creator state from a previous generation ("Create more like this"). */
export function stateFromGeneration(generation: Generation): CreatorState {
  const r = generation.request
  const o = r.options
  return {
    ...initialCreatorState(generation.content_type),
    brand_id: generation.brand_id,
    platform: r.platform,
    topic: r.topic,
    objective: r.objective,
    tone: r.tone,
    quality: r.quality,
    variations: r.variations,
    notes: r.notes ?? '',
    reel_duration: o.reel_duration,
    caption_length: o.caption_length,
    caption_style: o.caption_style,
    quote_category: o.quote_category,
    emoji_style: o.emoji_style ?? 'brand',
    include_hashtags: o.include_hashtags,
    hashtag_count: o.hashtag_count,
    include_cta: o.include_cta,
    cta_preference: o.cta_preference,
  }
}

export function buildGenerateInput(type: ContentType, s: CreatorState): GenerateInput {
  const options: GenerateInput['options'] = {
    emoji_style: s.emoji_style === 'brand' ? null : s.emoji_style,
    include_hashtags: s.include_hashtags,
    hashtag_count: s.include_hashtags ? s.hashtag_count : 0,
    include_cta: s.include_cta,
    cta_preference: s.include_cta ? s.cta_preference.trim() : '',
  }
  if (type === 'reel') options.reel_duration = s.reel_duration
  if (type === 'caption') {
    options.caption_length = s.caption_length
    options.caption_style = s.caption_style
  }
  if (type === 'quote') options.quote_category = s.quote_category
  return {
    brand_id: s.brand_id,
    platform: s.platform,
    content_type: type,
    topic: s.topic.trim(),
    objective: s.objective,
    tone: s.tone,
    quality: s.quality,
    variations: Math.min(Math.max(1, s.variations), MAX_VARIATIONS[type]),
    options,
    notes: s.notes.trim(),
  }
}

export const TOPIC_EXAMPLES: Record<ContentType, string[]> = {
  reel: [
    'Behind the scenes of how we make our best-seller',
    '3 mistakes customers make before buying',
    'A day in the life at our business',
  ],
  caption: [
    'Announcing our new seasonal menu',
    'Thank our customers for a record month',
    'Why we started this business',
  ],
  quote: ['Consistency beats perfection', 'Small businesses and community', 'Craft and attention to detail'],
  post_idea: ['Educate customers about our process', 'Introduce our team', 'Showcase customer results'],
}

export const PAGE_COPY: Record<ContentType, { title: string; description: string; cta: string }> = {
  reel: {
    title: 'Reel Studio',
    description: 'Complete Reel plans — hook, shot list, script, on-screen text and caption — ready to film.',
    cta: 'Create Reels',
  },
  caption: {
    title: 'Caption generator',
    description:
      'Scroll-stopping captions with a strong first line, the right length and a clear call to action.',
    cta: 'Write captions',
  },
  quote: {
    title: 'Quote generator',
    description: 'Original, shareable quotes for posts, stories and quote cards.',
    cta: 'Create quotes',
  },
  post_idea: {
    title: 'Post ideas',
    description: 'Fully-formed post concepts with the best format, an outline and a caption.',
    cta: 'Create post ideas',
  },
}
