import { Collapsible as C } from 'radix-ui'
import { ChevronRight } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/** Progressive disclosure for advanced controls. */
export function Disclosure({
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <C.Root open={open} onOpenChange={setOpen} className={cn('flex flex-col', className)}>
      <C.Trigger className="group text-muted hover:text-ink flex items-center gap-2 py-1 text-left text-[13.5px] font-medium">
        <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
        <span>{title}</span>
        {description && !open && <span className="text-subtle font-normal">— {description}</span>}
      </C.Trigger>
      <C.Content className="data-[state=open]:animate-rise">
        <div className="pt-3">{children}</div>
      </C.Content>
    </C.Root>
  )
}
