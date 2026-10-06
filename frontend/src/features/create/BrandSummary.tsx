import { Check, PenLine } from 'lucide-react'
import { Link } from 'react-router'

import { BrandAvatar } from '@/components/layout/BrandSwitcher'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { Brand, ContentType } from '@/lib/api/types'

const DELIVERABLES: Record<ContentType, string[]> = {
  reel: [
    'Scroll-stopping hook',
    'Opening shot & shot list',
    'Full script & voice-over',
    'On-screen text',
    'Caption, CTA & hashtags',
  ],
  caption: [
    'Opening line that earns the tap',
    'Ready-to-post caption',
    'Call to action',
    'Relevant hashtags',
  ],
  quote: ['Original, quotable lines', 'Quote-card text & design direction', 'Supporting caption & hashtags'],
  post_idea: [
    'Best format for the idea',
    'Slide-by-slide outline',
    'Visual direction',
    'Caption, CTA & hashtags',
  ],
}

export function BrandSummary({ brand, type }: { brand?: Brand; type: ContentType }) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <BrandAvatar name={brand?.name ?? '?'} className="size-10 text-[14px]" />
          <div className="min-w-0 flex-1">
            <p className="text-subtle text-[11.5px] font-medium tracking-wide uppercase">Writing as</p>
            <p className="truncate font-semibold">{brand?.name ?? 'No brand selected'}</p>
          </div>
          {brand && (
            <Link
              to={`/brands/${brand.id}`}
              className="text-subtle hover:bg-surface-2 hover:text-ink rounded-md p-1.5"
              aria-label="Edit brand"
            >
              <PenLine className="size-4" />
            </Link>
          )}
        </div>
        {brand && (
          <dl className="flex flex-col gap-3 text-[13px]">
            {brand.target_audience && (
              <div>
                <dt className="text-subtle">Audience</dt>
                <dd className="line-clamp-2">{brand.target_audience}</dd>
              </div>
            )}
            {brand.content_pillars.length > 0 && (
              <div>
                <dt className="text-subtle mb-1">Pillars</dt>
                <dd className="flex flex-wrap gap-1">
                  {brand.content_pillars.slice(0, 6).map((p) => (
                    <Badge key={p}>{p}</Badge>
                  ))}
                </dd>
              </div>
            )}
            {brand.prohibited_words.length > 0 && (
              <div>
                <dt className="text-subtle">Never says</dt>
                <dd className="line-clamp-2">{brand.prohibited_words.join(', ')}</dd>
              </div>
            )}
            {!brand.description && !brand.target_audience && (
              <p className="bg-warn-soft rounded-md p-2.5 text-[12.5px]">
                Add a description and audience to your brand for more specific content.{' '}
                <Link to={`/brands/${brand.id}`} className="font-medium underline">
                  Improve brand
                </Link>
              </p>
            )}
          </dl>
        )}
      </Card>
      <Card className="p-5">
        <p className="mb-3 text-[13px] font-semibold">Each option includes</p>
        <ul className="text-muted flex flex-col gap-2 text-[13px]">
          {DELIVERABLES[type].map((d) => (
            <li key={d} className="flex items-start gap-2">
              <Check className="text-moss mt-0.5 size-3.5 shrink-0" /> {d}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
