import * as React from 'react'

import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-line-strong bg-surface/60 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div className="bg-ember-soft text-ember-ink flex size-11 items-center justify-center rounded-full [&_svg]:size-5">
          {icon}
        </div>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {description && <p className="text-muted text-[13.5px]">{description}</p>}
      </div>
      {action}
    </div>
  )
}
