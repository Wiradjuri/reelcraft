import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { Info } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'animate-fade-in bg-ink text-paper shadow-pop z-50 max-w-64 rounded-md px-2.5 py-1.5 text-[12.5px] leading-snug',
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip content={children}>
      <button type="button" className="text-subtle hover:text-muted" aria-label="More information">
        <Info className="size-3.5" />
      </button>
    </Tooltip>
  )
}
