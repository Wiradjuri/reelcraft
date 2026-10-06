import { Tabs as TabsPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('border-line flex gap-1 overflow-x-auto border-b', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'text-muted hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink -mb-px inline-flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-[13.5px] font-medium whitespace-nowrap transition-colors [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}
