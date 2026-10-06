import { History, Search, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ErrorNotice } from '@/components/ErrorNotice'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useBrands, useCatalog, useDeleteGeneration, useHistory } from '@/lib/api/hooks'
import { CONTENT_TYPE_META } from '@/lib/content'
import { cn, formatRelative, pluralise } from '@/lib/utils'

const PAGE_SIZE = 20
const ALL = 'all'

export default function HistoryPage() {
  const [type, setType] = React.useState(ALL)
  const [brand, setBrand] = React.useState(ALL)
  const [search, setSearch] = React.useState('')
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(0)
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setQ(search)
      setPage(0)
    }, 250)
    return () => window.clearTimeout(id)
  }, [search])

  const { data, isPending, isFetching, error, refetch } = useHistory({
    content_type: type === ALL ? undefined : type,
    brand_id: brand === ALL ? undefined : brand,
    q,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })
  const { data: brands = [] } = useBrands()
  const { data: catalog } = useCatalog()
  const remove = useDeleteGeneration()
  const objectiveLabel = (v: string) => catalog?.objectives.find((o) => o.value === v)?.label ?? v

  return (
    <>
      <PageHeader
        title="History"
        description="Every generation is kept here automatically. Reopen one to edit, regenerate parts or save it."
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            aria-label="Search history"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title"
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Content type"
          className="w-auto min-w-36"
          value={type}
          onValueChange={(v) => {
            setType(v)
            setPage(0)
          }}
          options={[
            { value: ALL, label: 'All types' },
            ...Object.entries(CONTENT_TYPE_META).map(([value, m]) => ({ value, label: m.plural })),
          ]}
        />
        <Select
          aria-label="Brand"
          className="w-auto min-w-36"
          value={brand}
          onValueChange={(v) => {
            setBrand(v)
            setPage(0)
          }}
          options={[
            { value: ALL, label: 'All brands' },
            ...brands.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
      </div>

      {error ? (
        <ErrorNotice error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <Card className="divide-line divide-y">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-4 p-4">
              <Skeleton className="h-5 w-20" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="w-1/2" />
                <Skeleton className="w-1/3" />
              </div>
            </div>
          ))}
        </Card>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<History />}
          title={q || type !== ALL || brand !== ALL ? 'No matching generations' : 'No history yet'}
          description="Everything you create is recorded here automatically."
          action={
            <Button asChild size="sm">
              <Link to="/create/reel">Create content</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card
            className={cn(
              'divide-line divide-y overflow-hidden transition-opacity',
              isFetching && 'opacity-70',
            )}
          >
            {data.items.map((g) => (
              <div key={g.id} className="group hover:bg-surface-2/60 flex items-center gap-4 px-4 py-3.5">
                <Badge
                  tone={g.status === 'failed' ? 'danger' : 'ember'}
                  className="w-20 shrink-0 justify-center"
                >
                  {g.status === 'failed' ? 'Failed' : CONTENT_TYPE_META[g.content_type].label}
                </Badge>
                <Link to={`/generations/${g.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium hover:underline">{g.topic || g.title}</span>
                  <span className="text-muted block truncate text-[12.5px]">
                    {[g.brand_name, objectiveLabel(g.objective), pluralise(g.item_count, 'option')]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
                <span className="text-subtle hidden shrink-0 text-[12.5px] sm:block">
                  {formatRelative(g.created_at)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete “${g.topic || g.title}” from history`}
                  className="opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={() =>
                    remove.mutate(g.id, {
                      onSuccess: () =>
                        toast.success('Removed from history', {
                          description: 'Saved library items are kept.',
                        }),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </Card>
          {data.total > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
