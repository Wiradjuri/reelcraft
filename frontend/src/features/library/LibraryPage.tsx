import { BookMarked, ClipboardCopy, ExternalLink, Search, Star, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ContentView } from '@/components/content/ContentView'
import { ErrorNotice } from '@/components/ErrorNotice'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TagInput } from '@/components/ui/tag-input'
import { toApiError } from '@/lib/api/client'
import { useBrands, useDeleteSaved, useLibrary, useLibraryTags, useUpdateSaved } from '@/lib/api/hooks'
import type { SavedContent } from '@/lib/api/types'
import { copyText } from '@/lib/clipboard'
import { CONTENT_TYPE_META, postReadyText, previewText } from '@/lib/content'
import { cn, formatDate, pluralise } from '@/lib/utils'

const PAGE_SIZE = 24
const ALL = 'all'

const DATE_RANGES: Record<string, number | null> = { all: null, '7': 7, '30': 30, '90': 90 }

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])
  return debounced
}

export default function LibraryPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = React.useState(params.get('q') ?? '')
  const q = useDebounced(search)
  const type = params.get('type') ?? ALL
  const brand = params.get('brand') ?? ALL
  const tag = params.get('tag') ?? ALL
  const range = params.get('range') ?? ALL
  const favourites = params.get('fav') === '1'
  const page = Number(params.get('page') ?? 0)
  const openId = params.get('open')

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        if (value === null || value === ALL || value === '') p.delete(key)
        else p.set(key, value)
        if (key !== 'page' && key !== 'open') p.delete('page')
        return p
      },
      { replace: true },
    )

  const days = DATE_RANGES[range] ?? undefined
  const { data, isPending, isFetching, error, refetch } = useLibrary({
    q,
    content_type: type === ALL ? undefined : type,
    brand_id: brand === ALL ? undefined : brand,
    tag: tag === ALL ? undefined : tag,
    favourites,
    since_days: days,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })
  const { data: brands = [] } = useBrands()
  const { data: tags = [] } = useLibraryTags()
  const filtered = Boolean(q || type !== ALL || brand !== ALL || tag !== ALL || favourites || range !== ALL)
  const opened = data?.items.find((s) => s.id === openId)

  return (
    <>
      <PageHeader
        title="Content library"
        description="Everything you've saved — searchable, filterable and ready to reuse."
      />
      <div className="mb-5 flex flex-col gap-3">
        <div className="relative">
          <Search className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            aria-label="Search saved content"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setParam('q', e.target.value)
            }}
            placeholder="Search titles and notes"
            className="h-11 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Content type"
            className="h-9 w-auto min-w-36"
            value={type}
            onValueChange={(v) => setParam('type', v)}
            options={[
              { value: ALL, label: 'All types' },
              ...Object.entries(CONTENT_TYPE_META).map(([value, m]) => ({ value, label: m.plural })),
            ]}
          />
          <Select
            aria-label="Brand"
            className="h-9 w-auto min-w-36"
            value={brand}
            onValueChange={(v) => setParam('brand', v)}
            options={[
              { value: ALL, label: 'All brands' },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <Select
            aria-label="Date"
            className="h-9 w-auto min-w-36"
            value={range}
            onValueChange={(v) => setParam('range', v)}
            options={[
              { value: ALL, label: 'Any time' },
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
          {tags.length > 0 && (
            <Select
              aria-label="Tag"
              className="h-9 w-auto min-w-32"
              value={tag}
              onValueChange={(v) => setParam('tag', v)}
              options={[
                { value: ALL, label: 'All tags' },
                ...tags.map((t) => ({ value: t, label: `#${t}` })),
              ]}
            />
          )}
          <Button
            variant={favourites ? 'primary' : 'secondary'}
            size="sm"
            className="h-9"
            aria-pressed={favourites}
            onClick={() => setParam('fav', favourites ? null : '1')}
          >
            <Star className={cn(favourites && 'fill-current')} /> Favourites
          </Button>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setParams({}, { replace: true })
              }}
            >
              Clear filters
            </Button>
          )}
          {data && <span className="text-muted ml-auto text-[13px]">{pluralise(data.total, 'item')}</span>}
        </div>
      </div>

      {error ? (
        <ErrorNotice error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} className="flex flex-col gap-3 p-5">
              <Skeleton className="w-20" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="w-2/3" />
            </Card>
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<BookMarked />}
          title={filtered ? 'Nothing matches those filters' : 'Your library is empty'}
          description={
            filtered
              ? 'Try a different search or clear the filters.'
              : 'When you create content, press Save on the options you like and they’ll live here.'
          }
          action={
            !filtered && (
              <Button asChild size="sm">
                <Link to="/create/caption">Create something</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <div
            className={cn(
              'grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3',
              isFetching && 'opacity-70',
            )}
          >
            {data.items.map((item) => (
              <SavedCard key={item.id} item={item} onOpen={() => setParam('open', item.id)} />
            ))}
          </div>
          {data.total > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setParam('page', String(page - 1))}
              >
                Previous
              </Button>
              <span className="text-muted text-[13px]">
                Page {page + 1} of {Math.ceil(data.total / PAGE_SIZE)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= data.total}
                onClick={() => setParam('page', String(page + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={Boolean(opened)} onOpenChange={(open) => !open && setParam('open', null)}>
        {opened && <SavedDetail key={opened.id} item={opened} onClose={() => setParam('open', null)} />}
      </Dialog>
    </>
  )
}

function SavedCard({ item, onOpen }: { item: SavedContent; onOpen: () => void }) {
  const update = useUpdateSaved()
  return (
    <Card className="group hover:shadow-pop flex flex-col transition-all hover:-translate-y-0.5">
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col gap-2.5 p-5 text-left">
        <span className="flex items-center gap-2">
          <Badge tone="ember">{CONTENT_TYPE_META[item.content_type].label}</Badge>
          {item.brand_name && <span className="text-subtle truncate text-[12px]">{item.brand_name}</span>}
        </span>
        <span className="font-medium">{item.title}</span>
        <span className="text-muted line-clamp-3 text-[13.5px]">
          {previewText(item.content_type, item.data)}
        </span>
        {item.tags.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <Badge key={t}>#{t}</Badge>
            ))}
          </span>
        )}
      </button>
      <div className="border-line flex items-center justify-between border-t px-3 py-2">
        <span className="text-subtle pl-2 text-[12px]">{formatDate(item.created_at)}</span>
        <span className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy post-ready text"
            onClick={() =>
              void copyText(postReadyText(item.content_type, item.data), 'Post-ready text copied')
            }
          >
            <ClipboardCopy />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={item.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={item.is_favourite}
            onClick={() => update.mutate({ id: item.id, is_favourite: !item.is_favourite })}
          >
            <Star className={cn(item.is_favourite && 'fill-ember text-ember')} />
          </Button>
        </span>
      </div>
    </Card>
  )
}

function SavedDetail({ item, onClose }: { item: SavedContent; onClose: () => void }) {
  const update = useUpdateSaved()
  const remove = useDeleteSaved()
  const [title, setTitle] = React.useState(item.title)
  const [tags, setTags] = React.useState(item.tags)
  const [notes, setNotes] = React.useState(item.notes)
  const dirty = title !== item.title || notes !== item.notes || tags.join() !== item.tags.join()
  const ctx = item.generation_context

  return (
    <DialogContent size="xl">
      <DialogHeader>
        <DialogTitle>{item.title}</DialogTitle>
        <DialogDescription>
          {CONTENT_TYPE_META[item.content_type].label}
          {item.brand_name && ` for ${item.brand_name}`} · saved {formatDate(item.created_at)}
          {ctx.angle && ` · ${ctx.angle} angle`}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="-mx-3">
          <ContentView
            type={item.content_type}
            data={item.data}
            onSaveField={(name, value) => update.mutateAsync({ id: item.id, data: { [name]: value } })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Title" htmlFor="saved-title">
            <Input
              id="saved-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="Tags">
            <TagInput value={tags} onChange={setTags} placeholder="e.g. autumn, launch" />
          </Field>
          <Field label="Notes" htmlFor="saved-notes" optional>
            <Textarea
              id="saved-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20"
            />
          </Field>
          {dirty && (
            <Button
              size="sm"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { id: item.id, title: title.trim() || item.title, tags, notes },
                  { onSuccess: () => toast.success('Details saved') },
                )
              }
            >
              Save details
            </Button>
          )}
          {(ctx.topic || ctx.objective) && (
            <div className="bg-surface-2/60 text-muted ring-line rounded-lg p-3 text-[12.5px] ring-1">
              <p className="text-ink mb-1 font-medium">How this was made</p>
              {ctx.topic && <p>Brief: {ctx.topic}</p>}
              {ctx.objective && <p>Goal: {ctx.objective.replace('_', ' ')}</p>}
              {ctx.tone && <p>Tone: {ctx.tone === 'brand' ? 'Brand voice' : ctx.tone}</p>}
            </div>
          )}
        </div>
      </DialogBody>
      {update.isError && <ErrorNotice error={update.error} className="mx-6 mb-4" />}
      <DialogFooter className="justify-between">
        <Button
          variant="ghost"
          className="text-danger hover:text-danger"
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(item.id, {
              onSuccess: () => {
                toast.success('Removed from library')
                onClose()
              },
              onError: (e) => toast.error(toApiError(e).title),
            })
          }
        >
          <Trash2 /> Remove
        </Button>
        <div className="flex gap-2">
          {item.generation_id && (
            <Button asChild variant="secondary">
              <Link to={`/generations/${item.generation_id}`}>
                <ExternalLink /> Original
              </Link>
            </Button>
          )}
          <Button
            onClick={() =>
              void copyText(postReadyText(item.content_type, item.data), 'Post-ready text copied')
            }
          >
            <ClipboardCopy /> Copy
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  )
}
