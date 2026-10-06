import { Captions, Clapperboard, Lightbulb, Quote, Sparkles } from 'lucide-react'
import * as React from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router'

import { ErrorNotice } from '@/components/ErrorNotice'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChoiceChips } from '@/components/ui/choice-chips'
import { Disclosure } from '@/components/ui/collapsible'
import { Field, Label } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useBrands, useCatalog, useGenerate, useSession } from '@/lib/api/hooks'
import type { ContentType, Quality } from '@/lib/api/types'
import { cn, pluralise } from '@/lib/utils'
import {
  buildGenerateInput,
  type CreatorState,
  initialCreatorState,
  MAX_VARIATIONS,
  PAGE_COPY,
  TOPIC_EXAMPLES,
} from './creator-state'
import { BrandSummary } from './BrandSummary'
import { GeneratingState } from './GeneratingState'

const TYPES: { value: ContentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'reel', label: 'Reel', icon: Clapperboard },
  { value: 'caption', label: 'Caption', icon: Captions },
  { value: 'quote', label: 'Quote', icon: Quote },
  { value: 'post_idea', label: 'Post idea', icon: Lightbulb },
]

export default function CreatePage() {
  const { type: rawType } = useParams()
  const type = TYPES.find((t) => t.value === rawType)?.value
  if (!type) return <Navigate to="/create/reel" replace />
  return <Creator key={type} type={type} />
}

function Creator({ type }: { type: ContentType }) {
  const { data: catalog } = useCatalog()
  const { data: session } = useSession()
  const { data: brands = [] } = useBrands()
  const location = useLocation()
  const navigate = useNavigate()
  const generate = useGenerate()
  const topicRef = React.useRef<HTMLTextAreaElement>(null)

  const routeState = location.state as { prefill?: CreatorState; topic?: string } | null
  const [state, setState] = React.useState<CreatorState>(
    () =>
      routeState?.prefill ?? {
        ...initialCreatorState(type, {
          brandId: session?.workspace.active_brand_id ?? null,
          quality: session?.workspace.preferences.default_quality,
        }),
        topic: routeState?.topic ?? '',
      },
  )
  const set = <K extends keyof CreatorState>(key: K, value: CreatorState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  const brand = brands.find((b) => b.id === state.brand_id) ?? brands.find((b) => b.is_active) ?? brands[0]
  const copy = PAGE_COPY[type]
  const toneLabel = catalog?.tones.find((t) => t.value === brand?.tone_of_voice)?.label
  const topicTooShort = state.topic.trim().length < 3

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (topicTooShort) {
      topicRef.current?.focus()
      return
    }
    generate.mutate(buildGenerateInput(type, { ...state, brand_id: brand?.id ?? null }), {
      onSuccess: (generation) => navigate(`/generations/${generation.id}`),
    })
  }

  if (generate.isPending) {
    return <GeneratingState type={type} variations={state.variations} quality={state.quality} />
  }

  return (
    <>
      <PageHeader eyebrow="Create" title={copy.title} description={copy.description} />
      <nav aria-label="Content type" className="mb-6 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Link
            key={t.value}
            to={`/create/${t.value}`}
            aria-current={t.value === type ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium transition-all',
              t.value === type
                ? 'border-ink bg-ink text-paper dark:border-ember dark:bg-ember dark:text-ink'
                : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-6">
          {generate.isError && <ErrorNotice error={generate.error} onRetry={() => submit()} />}

          <Card className="flex flex-col gap-6 p-5 sm:p-6">
            <Field
              label="What should it be about?"
              htmlFor="topic"
              hint={
                topicTooShort && state.topic
                  ? 'Add a little more detail.'
                  : 'A sentence or two is perfect. Mention offers, dates or details you want included.'
              }
            >
              <Textarea
                id="topic"
                ref={topicRef}
                value={state.topic}
                onChange={(e) => set('topic', e.target.value)}
                maxLength={2000}
                placeholder={`e.g. ${TOPIC_EXAMPLES[type][0]}`}
                className="min-h-28 text-[15px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
                }}
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-subtle text-[12.5px]">Try:</span>
                {TOPIC_EXAMPLES[type].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => set('topic', example)}
                    className="bg-surface-2 text-muted ring-line hover:text-ink rounded-full px-2.5 py-1 text-[12.5px] ring-1 transition-colors ring-inset"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Brand" htmlFor="brand">
                <Select
                  id="brand"
                  value={brand?.id ?? ''}
                  onValueChange={(v) => set('brand_id', v)}
                  options={brands.map((b) => ({ value: b.id, label: b.name }))}
                  placeholder="Choose a brand"
                />
              </Field>
              <Field label="Platform" htmlFor="platform" tip="More platforms are on the way.">
                <Select
                  id="platform"
                  value={state.platform}
                  onValueChange={(v) => set('platform', v)}
                  options={(
                    catalog?.platforms ?? [{ value: 'instagram', label: 'Instagram', available: true }]
                  ).map((p) => ({
                    value: p.value,
                    label: p.available ? p.label : `${p.label} — coming soon`,
                    disabled: !p.available,
                  }))}
                />
              </Field>
            </div>

            <Field
              label="Goal"
              tip="What should this content achieve? It shapes the angle and call to action."
            >
              <ChoiceChips
                aria-label="Goal"
                value={state.objective}
                onValueChange={(v) => set('objective', v)}
                options={catalog?.objectives ?? []}
              />
            </Field>

            <Field label="Tone">
              <ChoiceChips
                aria-label="Tone"
                value={state.tone}
                onValueChange={(v) => set('tone', v as CreatorState['tone'])}
                options={[
                  { value: 'brand', label: toneLabel ? `Brand voice (${toneLabel})` : 'Brand voice' },
                  ...(catalog?.tones ?? []),
                ]}
              />
            </Field>

            <TypeOptions type={type} state={state} set={set} />
          </Card>

          <Card className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="How many options?"
                tip="Each option uses a different creative angle, so they genuinely differ."
              >
                <Segmented
                  aria-label="Number of variations"
                  value={String(state.variations)}
                  onValueChange={(v) => set('variations', Number(v))}
                  options={Array.from({ length: MAX_VARIATIONS[type] }, (_, i) => ({
                    value: String(i + 1),
                    label: String(i + 1),
                  }))}
                />
              </Field>
              <Field
                label="AI quality"
                tip="Auto picks the right AI for each request. Choose Premium for important campaigns and client work."
              >
                <Segmented
                  aria-label="AI quality"
                  value={state.quality}
                  onValueChange={(v) => set('quality', v as Quality)}
                  options={(catalog?.qualities ?? []).map((q) => ({
                    value: q.value,
                    label: q.value === 'auto' ? 'Auto' : q.label,
                    hint: q.description,
                  }))}
                />
                <p className="text-muted text-[12.5px]">
                  {catalog?.qualities.find((q) => q.value === state.quality)?.description}
                </p>
              </Field>
            </div>

            <Disclosure title="More options" description="emojis, hashtags, call to action, notes">
              <div className="flex flex-col gap-5">
                <Field label="Emojis">
                  <Segmented
                    aria-label="Emojis"
                    size="sm"
                    value={state.emoji_style}
                    onValueChange={(v) => set('emoji_style', v as CreatorState['emoji_style'])}
                    options={[{ value: 'brand', label: 'Brand default' }, ...(catalog?.emoji_styles ?? [])]}
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="include-hashtags">Hashtags</Label>
                      <Switch
                        id="include-hashtags"
                        checked={state.include_hashtags}
                        onCheckedChange={(v) => set('include_hashtags', v)}
                      />
                    </div>
                    {state.include_hashtags && (
                      <Segmented
                        aria-label="Number of hashtags"
                        size="sm"
                        value={String(state.hashtag_count)}
                        onValueChange={(v) => set('hashtag_count', Number(v))}
                        options={[3, 6, 10, 15].map((n) => ({ value: String(n), label: `${n}` }))}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="include-cta">Call to action</Label>
                      <Switch
                        id="include-cta"
                        checked={state.include_cta}
                        onCheckedChange={(v) => set('include_cta', v)}
                      />
                    </div>
                    {state.include_cta && (
                      <Input
                        aria-label="Preferred call to action"
                        value={state.cta_preference}
                        onChange={(e) => set('cta_preference', e.target.value)}
                        placeholder={brand?.cta_style || 'e.g. Book via the link in bio'}
                        maxLength={200}
                      />
                    )}
                  </div>
                </div>
                <Field label="Anything else?" htmlFor="notes" optional>
                  <Textarea
                    id="notes"
                    value={state.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder="e.g. Mention the sale ends Friday. Don't mention pricing."
                    maxLength={1000}
                    className="min-h-16"
                  />
                </Field>
              </div>
            </Disclosure>
          </Card>

          <div className="border-line bg-surface/90 shadow-pop sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border p-3 pl-5 backdrop-blur">
            <span className="text-muted hidden text-[13px] sm:block">
              {pluralise(state.variations, 'option')} for{' '}
              <strong className="text-ink font-medium">{brand?.name ?? '…'}</strong>
              <span className="text-subtle"> · ⌘↵ to create</span>
            </span>
            <Button type="submit" size="lg" variant="accent" disabled={!brand} className="w-full sm:w-auto">
              <Sparkles /> {copy.cta}
            </Button>
          </div>
        </form>

        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <BrandSummary brand={brand} type={type} />
          </div>
        </aside>
      </div>
    </>
  )
}

function TypeOptions({
  type,
  state,
  set,
}: {
  type: ContentType
  state: CreatorState
  set: <K extends keyof CreatorState>(key: K, value: CreatorState[K]) => void
}) {
  const { data: catalog } = useCatalog()
  if (type === 'reel') {
    return (
      <Field label="Reel length">
        <Segmented
          aria-label="Reel length"
          value={String(state.reel_duration)}
          onValueChange={(v) => set('reel_duration', Number(v))}
          options={(catalog?.reel_durations ?? [15, 30, 45, 60]).map((d) => ({
            value: String(d),
            label: `${d} sec`,
          }))}
        />
      </Field>
    )
  }
  if (type === 'caption') {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Length">
          <Segmented
            aria-label="Caption length"
            value={state.caption_length}
            onValueChange={(v) => set('caption_length', v as CreatorState['caption_length'])}
            options={(catalog?.caption_lengths ?? []).map((l) => ({
              value: l.value,
              label: l.label,
              hint: l.description,
            }))}
          />
        </Field>
        <Field label="Caption style" htmlFor="caption-style">
          <Select
            id="caption-style"
            value={state.caption_style}
            onValueChange={(v) => set('caption_style', v)}
            options={catalog?.caption_styles ?? []}
          />
        </Field>
      </div>
    )
  }
  if (type === 'quote') {
    return (
      <Field label="Quote style">
        <ChoiceChips
          aria-label="Quote style"
          value={state.quote_category}
          onValueChange={(v) => set('quote_category', v)}
          options={catalog?.quote_categories ?? []}
        />
      </Field>
    )
  }
  return null
}
