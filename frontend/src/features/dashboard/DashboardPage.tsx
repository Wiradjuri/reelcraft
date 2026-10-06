import {
  ArrowRight,
  BookMarked,
  Captions,
  Clapperboard,
  History,
  Lightbulb,
  Quote,
  Sparkles,
  Star,
} from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router'

import { ErrorNotice } from '@/components/ErrorNotice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useBrands, useHistory, useLibrary, useSession, useStats } from '@/lib/api/hooks'
import type { ContentType } from '@/lib/api/types'
import { CONTENT_TYPE_META, previewText } from '@/lib/content'
import { formatRelative } from '@/lib/utils'

const QUICK: {
  type: ContentType
  title: string
  body: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { type: 'reel', title: 'Plan a Reel', body: 'Hook, shots, script and caption', icon: Clapperboard },
  { type: 'caption', title: 'Write captions', body: 'Ready to post in seconds', icon: Captions },
  { type: 'quote', title: 'Create quotes', body: 'Shareable lines and quote cards', icon: Quote },
  { type: 'post_idea', title: 'Get post ideas', body: 'Carousels, images and stories', icon: Lightbulb },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { data: brands = [] } = useBrands()
  const navigate = useNavigate()
  const [topic, setTopic] = React.useState('')
  const brand = brands.find((b) => b.is_active) ?? brands[0]

  return (
    <div className="flex flex-col gap-8">
      <section className="bg-ink text-paper dark:bg-surface-2 dark:text-ink relative overflow-hidden rounded-xl px-6 py-8 sm:px-10 sm:py-10">
        <div
          aria-hidden
          className="bg-ember/30 pointer-events-none absolute -top-24 -right-16 size-80 rounded-full blur-3xl"
        />
        <div className="relative flex flex-col gap-5">
          <div>
            <p className="text-paper/60 dark:text-muted text-[13px]">
              {greeting()}, {session?.user.name.split(' ')[0]}
            </p>
            <h1 className="font-display text-[36px] leading-[1.1] text-balance sm:text-[44px]">
              What should <span className="text-ember italic">{brand?.name ?? 'your brand'}</span> post next?
            </h1>
          </div>
          <form
            className="flex max-w-2xl flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              navigate('/create/reel', topic.trim() ? { state: { topic: topic.trim() } } : undefined)
            }}
          >
            <label htmlFor="quick-topic" className="sr-only">
              Describe your next post
            </label>
            <input
              id="quick-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Our autumn menu launches on Friday"
              className="text-paper placeholder:text-paper/45 focus-visible:border-ember focus-visible:ring-ring dark:border-line dark:bg-surface dark:text-ink dark:placeholder:text-subtle h-12 flex-1 rounded-lg border border-white/15 bg-white/10 px-4 text-[15px] focus-visible:ring-3 focus-visible:outline-none"
            />
            <Button type="submit" size="lg" variant="accent">
              <Sparkles /> Create a Reel
            </Button>
          </form>
        </div>
      </section>

      <section aria-labelledby="quick-actions" className="flex flex-col gap-3">
        <h2 id="quick-actions" className="text-[15px] font-semibold">
          Start something new
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK.map((q) => (
            <Link
              key={q.type}
              to={`/create/${q.type}`}
              className="group border-line bg-surface shadow-card hover:border-line-strong hover:shadow-pop flex flex-col gap-3 rounded-lg border p-4 transition-all hover:-translate-y-0.5"
            >
              <span className="bg-ember-soft text-ember-ink flex size-9 items-center justify-center rounded-md">
                <q.icon className="size-[18px]" />
              </span>
              <span>
                <span className="block font-medium">{q.title}</span>
                <span className="text-muted block text-[13px]">{q.body}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] [&>*]:min-w-0">
        <RecentGenerations />
        <div className="flex flex-col gap-6">
          <StatsCard />
          <SavedPreview />
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title, to, label }: { title: string; to: string; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <Link to={to} className="text-muted hover:text-ink inline-flex items-center gap-1 text-[13px]">
        {label} <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}

function RecentGenerations() {
  const { data, isPending, error, refetch } = useHistory({ limit: 6 })
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Recent work" to="/history" label="All history" />
      {isPending ? (
        <Card className="divide-line divide-y">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2 p-4">
              <Skeleton className="w-1/3" />
              <Skeleton className="w-2/3" />
            </div>
          ))}
        </Card>
      ) : error ? (
        <ErrorNotice error={error} onRetry={() => void refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={<History />}
          title="Nothing created yet"
          description="Your generations appear here so you can reopen, edit and reuse them."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/create/reel">Create your first Reel</Link>
            </Button>
          }
        />
      ) : (
        <Card className="divide-line divide-y overflow-hidden">
          {data.items.map((g) => (
            <Link
              key={g.id}
              to={`/generations/${g.id}`}
              className="hover:bg-surface-2/60 flex items-center gap-4 px-4 py-3.5 transition-colors"
            >
              <Badge tone={g.status === 'failed' ? 'danger' : 'ember'} className="w-20 justify-center">
                {g.status === 'failed' ? 'Failed' : CONTENT_TYPE_META[g.content_type].label}
              </Badge>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{g.topic || g.title}</span>
                <span className="text-muted block truncate text-[12.5px]">
                  {g.brand_name} · {g.item_count} {g.item_count === 1 ? 'option' : 'options'}
                </span>
              </span>
              <span className="text-subtle shrink-0 text-[12.5px]">{formatRelative(g.created_at)}</span>
            </Link>
          ))}
        </Card>
      )}
    </section>
  )
}

function StatsCard() {
  const { data } = useStats()
  const items = [
    ['Pieces created', data?.pieces_created],
    ['Saved', data?.saved],
    ['Favourites', data?.favourites],
  ] as const
  return (
    <Card className="divide-line grid grid-cols-3 divide-x">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5 p-4">
          <span className="font-display text-[30px] leading-none">{value ?? '–'}</span>
          <span className="text-muted text-[12px]">{label}</span>
        </div>
      ))}
    </Card>
  )
}

function SavedPreview() {
  const { data } = useLibrary({ limit: 4 })
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title="Saved content" to="/library" label="Library" />
      {!data?.items.length ? (
        <EmptyState
          className="py-8"
          icon={<BookMarked />}
          title="Save your favourites"
          description="Press Save on any result to keep it here."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((s) => (
            <Link
              key={s.id}
              to={`/library?open=${s.id}`}
              className="border-line bg-surface hover:border-line-strong flex flex-col gap-1 rounded-lg border p-3.5 transition-colors"
            >
              <span className="text-subtle flex items-center gap-2 text-[11.5px]">
                {CONTENT_TYPE_META[s.content_type].label}
                {s.is_favourite && <Star className="fill-ember text-ember size-3" aria-label="Favourite" />}
              </span>
              <span className="line-clamp-2 text-[13.5px]">
                {previewText(s.content_type, s.data) || s.title}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
