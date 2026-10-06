import { RadioGroup } from 'radix-ui'

import { cn } from '@/lib/utils'

export interface SegmentOption {
  value: string
  label: string
  hint?: string
  disabled?: boolean
}

interface SegmentedProps {
  value: string
  onValueChange: (value: string) => void
  options: SegmentOption[]
  'aria-label': string
  className?: string
  size?: 'sm' | 'md'
}

/** A compact radio group styled as a segmented control (keyboard accessible via arrow keys). */
export function Segmented({
  value,
  onValueChange,
  options,
  className,
  size = 'md',
  ...rest
}: SegmentedProps) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={rest['aria-label']}
      orientation="horizontal"
      className={cn(
        'bg-surface-2 ring-line inline-flex w-full flex-wrap gap-1 rounded-lg p-1 ring-1 ring-inset',
        className,
      )}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          title={option.hint}
          className={cn(
            'text-muted hover:text-ink data-[state=checked]:bg-surface data-[state=checked]:text-ink data-[state=checked]:shadow-card flex-1 rounded-md px-3 font-medium whitespace-nowrap transition-all disabled:opacity-40',
            size === 'sm' ? 'h-7 text-[12.5px]' : 'h-8 text-[13px]',
          )}
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}
