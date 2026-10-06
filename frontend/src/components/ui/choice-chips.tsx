import { RadioGroup } from 'radix-ui'

import { cn } from '@/lib/utils'

export interface ChipOption {
  value: string
  label: string
  description?: string
}

/** Single-choice pills with optional descriptions (accessible radio group). */
export function ChoiceChips({
  value,
  onValueChange,
  options,
  className,
  ...rest
}: {
  value: string
  onValueChange: (value: string) => void
  options: ChipOption[]
  className?: string
  'aria-label': string
}) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={rest['aria-label']}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          title={o.description}
          className="border-line bg-surface text-muted hover:border-line-strong hover:text-ink data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-paper dark:data-[state=checked]:border-ember dark:data-[state=checked]:bg-ember dark:data-[state=checked]:text-ink rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all"
        >
          {o.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}
