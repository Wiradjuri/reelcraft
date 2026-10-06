import * as React from 'react'

import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && (
          <div className="text-ember-ink text-[12.5px] font-medium tracking-wide uppercase">{eyebrow}</div>
        )}
        <h1 className="font-display text-[34px] leading-[1.1] text-balance sm:text-[40px]">{title}</h1>
        {description && <p className="text-muted max-w-2xl text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
