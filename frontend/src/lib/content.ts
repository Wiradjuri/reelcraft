/**
 * Content presentation rules: which components each content type shows, how they're
 * edited, and how they're turned into copy-ready text. Kept out of components so it can
 * be tested and reused (results page, library, exports).
 */
import type { ContentType, ReelScene } from './api/types'

export type FieldKind = 'text' | 'longtext' | 'list' | 'hashtags' | 'scenes' | 'card' | 'number'

export interface FieldSpec {
  name: string
  label: string
  kind: FieldKind
  /** Shown prominently at the top of a card. */
  emphasis?: boolean
  help?: string
}

export const CONTENT_FIELDS: Record<ContentType, FieldSpec[]> = {
  reel: [
    { name: 'hook', label: 'Hook', kind: 'text', emphasis: true, help: 'The first 1–3 seconds' },
    { name: 'concept', label: 'Concept', kind: 'longtext' },
    { name: 'opening_shot', label: 'Opening shot', kind: 'longtext' },
    { name: 'scenes', label: 'Shots & scenes', kind: 'scenes' },
    { name: 'script', label: 'Script', kind: 'longtext' },
    { name: 'on_screen_text', label: 'On-screen text', kind: 'list' },
    { name: 'voiceover', label: 'Voice-over direction', kind: 'longtext' },
    { name: 'audio_suggestion', label: 'Audio', kind: 'text' },
    { name: 'caption', label: 'Caption', kind: 'longtext' },
    { name: 'cta', label: 'Call to action', kind: 'text' },
    { name: 'hashtags', label: 'Hashtags', kind: 'hashtags' },
  ],
  caption: [
    { name: 'body', label: 'Caption', kind: 'longtext', emphasis: true },
    { name: 'hook', label: 'Opening line', kind: 'text', help: 'What people see before “more”' },
    { name: 'cta', label: 'Call to action', kind: 'text' },
    { name: 'hashtags', label: 'Hashtags', kind: 'hashtags' },
  ],
  quote: [
    { name: 'text', label: 'Quote', kind: 'longtext', emphasis: true },
    { name: 'card', label: 'Quote card', kind: 'card' },
    { name: 'caption', label: 'Caption', kind: 'longtext' },
    { name: 'hashtags', label: 'Hashtags', kind: 'hashtags' },
  ],
  post_idea: [
    { name: 'hook', label: 'Hook', kind: 'text', emphasis: true },
    { name: 'format', label: 'Format', kind: 'text' },
    { name: 'outline', label: 'Outline', kind: 'list' },
    { name: 'visual_direction', label: 'Visual direction', kind: 'longtext' },
    { name: 'caption', label: 'Caption', kind: 'longtext' },
    { name: 'cta', label: 'Call to action', kind: 'text' },
    { name: 'hashtags', label: 'Hashtags', kind: 'hashtags' },
  ],
}

export const CONTENT_TYPE_META: Record<ContentType, { label: string; plural: string; route: string }> = {
  reel: { label: 'Reel', plural: 'Reels', route: 'reel' },
  caption: { label: 'Caption', plural: 'Captions', route: 'caption' },
  quote: { label: 'Quote', plural: 'Quotes', route: 'quote' },
  post_idea: { label: 'Post idea', plural: 'Post ideas', route: 'post_idea' },
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

export function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString) : []
}

export function asScenes(value: unknown): ReelScene[] {
  return Array.isArray(value) ? (value as ReelScene[]) : []
}

/** Plain-text rendering of a single field, for copy-to-clipboard. */
export function fieldToText(spec: FieldSpec, value: unknown): string {
  switch (spec.kind) {
    case 'hashtags':
      return asList(value).join(' ')
    case 'list':
      return asList(value)
        .map((line) => `• ${line}`)
        .join('\n')
    case 'scenes':
      return asScenes(value)
        .map((s, i) =>
          [
            `${i + 1}. ${s.timing ? `[${s.timing}] ` : ''}${s.visual}`,
            s.action && `   Action: ${s.action}`,
            s.on_screen_text && `   On screen: ${s.on_screen_text}`,
            s.voiceover && `   Voice-over: ${s.voiceover}`,
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .join('\n')
    case 'card': {
      const card = (value ?? {}) as { headline?: string; subtext?: string; visual_direction?: string }
      return [card.headline, card.subtext, card.visual_direction && `Design: ${card.visual_direction}`]
        .filter(Boolean)
        .join('\n')
    }
    default:
      return asString(value)
  }
}

/** The text a creator would paste straight into Instagram. */
export function postReadyText(type: ContentType, data: Record<string, unknown>): string {
  const tags = asList(data.hashtags).join(' ')
  const join = (...parts: string[]) => parts.filter((p) => p.trim()).join('\n\n')
  switch (type) {
    case 'caption':
      return join(asString(data.body), withCta(asString(data.body), asString(data.cta)), tags)
    case 'reel':
    case 'post_idea':
      return join(asString(data.caption), withCta(asString(data.caption), asString(data.cta)), tags)
    case 'quote':
      return join(
        `“${asString(data.text)}”${data.attribution ? ` — ${asString(data.attribution)}` : ''}`,
        asString(data.caption),
        tags,
      )
  }
}

function withCta(body: string, cta: string) {
  // Avoid duplicating a CTA the AI already wove into the body.
  return cta && !body.toLowerCase().includes(cta.toLowerCase().slice(0, 24)) ? cta : ''
}

/** A complete brief: every component, labelled — for sharing with a team or client. */
export function fullBriefText(type: ContentType, data: Record<string, unknown>, title?: string): string {
  const sections = CONTENT_FIELDS[type]
    .map((spec) => {
      const text = fieldToText(spec, data[spec.name])
      return text.trim() ? `${spec.label.toUpperCase()}\n${text}` : ''
    })
    .filter(Boolean)
  const heading = title ?? asString(data.title)
  const duration =
    type === 'reel' && data.estimated_duration_seconds
      ? ` (${asString(data.estimated_duration_seconds)}s)`
      : ''
  return [heading && `${heading}${duration}`, ...sections].filter(Boolean).join('\n\n')
}

export function previewText(type: ContentType, data: Record<string, unknown>): string {
  switch (type) {
    case 'reel':
      return asString(data.hook)
    case 'caption':
      return asString(data.body)
    case 'quote':
      return asString(data.text)
    case 'post_idea':
      return asString(data.hook)
  }
}
