import { Label as LabelPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { InfoTip } from './tooltip'

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-ink text-[13px] font-medium', className)} {...props} />
}

interface FieldProps {
  label: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  tip?: string
  error?: string
  optional?: boolean
  className?: string
  children: React.ReactNode
}

/** Label + control + hint/error, with accessible wiring left to the control's id. */
export function Field({ label, htmlFor, hint, tip, error, optional, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional && <span className="text-subtle text-[12px]">Optional</span>}
        {tip && <InfoTip>{tip}</InfoTip>}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-danger text-[12.5px]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted text-[12.5px]">{hint}</p>
      ) : null}
    </div>
  )
}
