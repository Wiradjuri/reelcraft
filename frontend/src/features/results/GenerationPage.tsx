import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ClipboardCopy,
  Clock,
  FileText,
  RefreshCw,
  Repeat2,
  Sparkles,
} from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { ContentView } from '@/components/content/ContentView'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { stateFromGeneration } from '@/features/create/creator-state'
import { ApiError, toApiError } from '@/lib/api/client'
import { useCatalog, useGeneration, useRegenerateField, useSaveItem, useUpdateItem } from '@/lib/api/hooks'
import type { ContentItem, Generation } from '@/lib/api/types'
import { copyText } from '@/lib/clipboard'
import { CONTENT_TYPE_META, fullBriefText, postReadyText } from '@/lib/content'
import { cn, formatRelative } from '@/lib/utils'

const LETTERS = 'ABCDEFGH'

export default function GenerationPage() {
  const { id } = useParams()
  const { data: generation, error, isPending, refetch } = useGeneration(id)

  if (isPending) return <GenerationSkeleton />
  if (error || !generation) return <ErrorNotice error={error} onRetry={() => void refetch()} />
  return <GenerationView generation={generation} />
}

function GenerationView({ generation }: { generation: Generation }) {
  const navigate = useNavigate()
  const { data: catalog } = useCatalog()
  const type = generation.content_type
  const meta = CONTENT_TYPE_META[type]
  const objective = catalog?.objectives.find((o) => o.value === generation.objective)?.label
  const tone =
    generation.request.tone === 'brand'
      ? 'Brand voice'
      : catalog?.tones.find((t) => t.value === generation.request.tone)?.label
  const tabbed = type === 'reel' || type === 'post_idea'
  const [active, setActive] = React.useState(0)

  const createMore = () =>
    navigate(`/create/${type}`, { state: { prefill: stateFromGeneration(generation) } })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          to="/history"
          className="text-muted hover:text-ink inline-flex items-center gap-1.5 self-start text-[13px]"
        >
          <ArrowLeft className="size-4" /> History
        </Link>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="text-muted flex flex-wrap items-center gap-2 text-[12.5px]">
              <Badge tone="ember">{meta.label}</Badge>
              {generation.brand_name && <span>for {generation.brand_name}</span>}
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {formatRelative(generation.created_at)}
              </span>
            </div>
            <h1 className="font-display text-[34px] leading-[1.1] text-balance sm:text-[40px]">
              {generation.request.topic || generation.title}
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {objective && <Badge>{objective}</Badge>}
              {tone && <Badge>{tone}</Badge>}
              {type === 'reel' && <Badge>{generation.request.options.reel_duration} sec</Badge>}
              <Badge tone="outline">
                Quality: {generation.quality_requested === 'auto' ? 'Auto' : generation.quality_requested}
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={createMore}>
              <Repeat2 /> Create more like this
            </Button>
            <Button asChild variant="primary">
              <Link to={`/create/${type}`}>
                <Sparkles /> New
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {generation.status === 'failed' || generation.items.length === 0 ? (
        <Card className="p-6">
          <ErrorNotice
            error={
              new ApiError(0, {
                code: 'generation_failed',
                title: "This generation didn't finish",
                message:
                  'Nothing was created because the AI ran into a problem. You can try again with the same settings.',
                retryable: true,
                details: {},
              })
            }
            action={
              <Button size="sm" onClick={createMore}>
                <RefreshCw /> Try again with the same settings
              </Button>
            }
          />
        </Card>
      ) : tabbed ? (
        <>
          <div role="tablist" aria-label="Variations" className="flex gap-2 overflow-x-auto pb-1">
            {generation.items.map((item, i) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  'flex min-w-44 flex-col items-start gap-0.5 rounded-lg border px-4 py-2.5 text-left transition-all',
                  i === active
                    ? 'border-ink bg-surface shadow-card dark:border-ember'
                    : 'border-line bg-surface/50 hover:bg-surface',
                )}
              >
                <span className="text-subtle text-[11.5px] font-semibold tracking-wide uppercase">
                  Option {LETTERS[i]} · {item.angle}
                </span>
                <span className="line-clamp-1 text-[13.5px] font-medium">
                  {String(item.data.title ?? item.data.hook ?? '')}
                </span>
              </button>
            ))}
          </div>
          {generation.items[active] && (
            <VariationCard
              key={generation.items[active].id}
              item={generation.items[active]}
              index={active}
              generation={generation}
            />
          )}
        </>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {generation.items.map((item, i) => (
            <VariationCard key={item.id} item={item} index={i} generation={generation} compact />
          ))}
        </div>
      )}

      <Disclosure title="Advanced details" description="AI model and usage">
        <dl className="border-line bg-surface grid max-w-xl grid-cols-2 gap-x-6 gap-y-2 rounded-lg border p-4 text-[13px] sm:grid-cols-3">
          {(
            [
              ['Quality used', generation.meta.quality_resolved],
              ['AI source', generation.meta.ai_source === 'custom' ? 'Your provider' : 'ReelCraft AI'],
              ['Provider', generation.meta.provider],
              ['Model', generation.meta.model],
              [
                'Tokens',
                `${generation.meta.input_tokens.toLocaleString()} in · ${generation.meta.output_tokens.toLocaleString()} out`,
              ],
              ['Time', `${(generation.meta.latency_ms / 1000).toFixed(1)}s`],
              ['Prompt version', generation.meta.prompt_version],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-subtle">{label}</dt>
              <dd className="font-mono text-[12.5px] break-all">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </div>
  )
}

function VariationCard({
  item,
  index,
  generation,
  compact,
}: {
  item: ContentItem
  index: number
  generation: Generation
  compact?: boolean
}) {
  const { data: catalog } = useCatalog()
  const update = useUpdateItem()
  const regenerate = useRegenerateField()
  const save = useSaveItem()
  const navigate = useNavigate()
  const regenerable =
    catalog?.content_types
      .find((c) => c.value === item.content_type)
      ?.regenerable_fields.map((f) => f.name) ?? []
  const type = item.content_type
  const duration = type === 'reel' ? Number(item.data.estimated_duration_seconds) : null
  const busyField = regenerate.isPending ? regenerate.variables?.field : null

  const onSave = () =>
    save.mutate(
      { item_id: item.id },
      {
        onSuccess: () =>
          toast.success(item.saved_id ? 'Library copy updated' : 'Saved to your library', {
            action: { label: 'View library', onClick: () => navigate('/library') },
          }),
        onError: (e) => toast.error(toApiError(e).title, { description: toApiError(e).message }),
      },
    )

  return (
    <Card className="animate-rise overflow-hidden" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="border-line bg-surface-2/40 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-ink text-paper dark:bg-ember dark:text-ink flex size-7 items-center justify-center rounded-md text-[12.5px] font-semibold">
            {LETTERS[index]}
          </span>
          <div className="flex flex-col">
            <span className="text-[13.5px] font-semibold">{item.angle || `Option ${LETTERS[index]}`}</span>
            <span className="text-muted text-[12px]">
              {type === 'reel' ? String(item.data.title ?? '') : CONTENT_TYPE_META[type].label}
              {duration ? ` · ~${duration}s` : ''}
            </span>
          </div>
          {item.is_edited && <Badge tone="outline">Edited</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content="Copy post-ready text (caption + hashtags)">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void copyText(postReadyText(type, item.data), 'Post-ready text copied')}
            >
              <ClipboardCopy /> Copy
            </Button>
          </Tooltip>
          {type !== 'caption' && (
            <Tooltip content="Copy everything as a brief (for your team or client)">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy full brief"
                onClick={() => void copyText(fullBriefText(type, item.data), 'Full brief copied')}
              >
                <FileText />
              </Button>
            </Tooltip>
          )}
          <Button
            variant={item.saved_id ? 'secondary' : 'primary'}
            size="sm"
            onClick={onSave}
            loading={save.isPending}
            aria-label={item.saved_id ? 'Saved — update library copy' : 'Save to library'}
          >
            {item.saved_id ? <BookmarkCheck className="text-ember" /> : <Bookmark />}
            {item.saved_id ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>
      <div className="p-2 sm:p-3">
        <ContentView
          type={type}
          data={item.data}
          compact={compact}
          regenerable={regenerable}
          regeneratingField={busyField}
          onSaveField={(name, value) => update.mutateAsync({ id: item.id, data: { [name]: value } })}
          onRegenerateField={(field, instruction) =>
            regenerate.mutateAsync({ id: item.id, field, instruction })
          }
        />
      </div>
      {item.saved_id && generation.items.length > 1 && (
        <p className="border-line text-muted border-t px-5 py-2.5 text-[12.5px]">
          Edits here don’t change the library copy until you press Saved again.
        </p>
      )}
    </Card>
  )
}

function GenerationSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-2/3" />
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="flex flex-col gap-3 p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="w-full" />
            <Skeleton className="w-3/4" />
          </Card>
        ))}
      </div>
    </div>
  )
}
