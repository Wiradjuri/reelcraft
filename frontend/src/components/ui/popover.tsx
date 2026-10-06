import { Popover as P } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverClose = P.Close

export function PopoverContent({ className, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={6}
        className={cn(
          'animate-fade-in border-line bg-surface shadow-pop z-50 w-80 rounded-lg border p-4',
          className,
        )}
        {...props}
      />
    </P.Portal>
  )
}
