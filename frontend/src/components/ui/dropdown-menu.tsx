import { DropdownMenu as Menu } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger

export function DropdownMenuContent({ className, ...props }: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={6}
        className={cn(
          'animate-fade-in border-line bg-surface shadow-pop z-50 min-w-52 rounded-lg border p-1',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      className={cn(
        'data-[highlighted]:bg-surface-2 [&_svg]:text-subtle flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px] outline-none select-none data-[disabled]:opacity-50 [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Menu.Label>) {
  return (
    <Menu.Label
      className={cn('text-subtle px-2.5 py-1.5 text-[11.5px] font-medium tracking-wide uppercase', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="bg-line my-1 h-px" />
}
