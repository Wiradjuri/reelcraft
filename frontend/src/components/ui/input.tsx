import * as React from 'react'

import { cn } from '@/lib/utils'

export const fieldBase =
  'w-full rounded-md border border-line bg-surface px-3 text-[14px] text-ink shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] transition-colors placeholder:text-subtle hover:border-line-strong focus-visible:border-ember focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(fieldBase, 'h-10', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />
))
Textarea.displayName = 'Textarea'
