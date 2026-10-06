import { Sparkles } from 'lucide-react'
import * as React from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ContentType, Quality } from '@/lib/api/types'
import { CONTENT_TYPE_META } from '@/lib/content'
import { pluralise } from '@/lib/utils'

const MESSAGES: Record<ContentType, string[]> = {
  reel: [
    'Reading your brand profile…',
    'Finding scroll-stopping hooks…',
    'Planning shots and timing…',
    'Writing the script…',
    'Polishing captions and hashtags…',
  ],
  caption: [
    'Reading your brand profile…',
    'Drafting opening lines…',
    'Shaping each caption…',
    'Choosing hashtags…',
  ],
  quote: [
    'Reading your brand profile…',
    'Drafting original lines…',
    'Tightening every word…',
    'Designing quote cards…',
  ],
  post_idea: [
    'Reading your brand profile…',
    'Exploring angles…',
    'Outlining each idea…',
    'Writing captions…',
  ],
}

export function GeneratingState({
  type,
  variations,
  quality,
}: {
  type: ContentType
  variations: number
  quality: Quality
}) {
  const [index, setIndex] = React.useState(0)
  const messages = MESSAGES[type]
  React.useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => Math.min(i + 1, messages.length - 1)), 3500)
    return () => window.clearInterval(id)
  }, [messages.length])

  return (
    <div className="flex flex-col gap-8 py-6" aria-live="polite" aria-busy="true">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex size-16 items-center justify-center">
          <span className="bg-ember/20 absolute inset-0 animate-ping rounded-full" />
          <span className="bg-ember shadow-pop relative flex size-14 items-center justify-center rounded-full text-white">
            <Sparkles className="size-6" />
          </span>
        </div>
        <div>
          <h1 className="font-display text-[34px] leading-tight">
            Creating {pluralise(variations, CONTENT_TYPE_META[type].label.toLowerCase())}
          </h1>
          <p className="text-muted" role="status">
            {messages[index]}
          </p>
          <p className="text-subtle mt-1 text-[12.5px]">
            {type === 'reel' || quality === 'premium'
              ? 'This usually takes 20–60 seconds.'
              : 'This usually takes 10–30 seconds.'}
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: Math.min(variations, 3) }, (_, i) => (
          <Card key={i} className="flex flex-col gap-3 p-5" style={{ animationDelay: `${i * 120}ms` }}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-11/12" />
            <Skeleton className="h-6 w-3/4" />
            <div className="mt-2 flex flex-col gap-2">
              <Skeleton className="w-full" />
              <Skeleton className="w-full" />
              <Skeleton className="w-2/3" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
