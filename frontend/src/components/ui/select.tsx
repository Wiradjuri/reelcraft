import { Select as SelectPrimitive } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface SelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
}

export function Select({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  className,
  disabled,
  ...rest
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={rest['aria-label']}
        className={cn(
          'border-line bg-surface hover:border-line-strong focus-visible:border-ember focus-visible:ring-ring data-[placeholder]:text-subtle flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-[14px] transition-colors focus-visible:ring-3 focus-visible:outline-none disabled:opacity-60',
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="text-subtle size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="animate-fade-in border-line bg-surface shadow-pop z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="data-[highlighted]:bg-surface-2 relative flex cursor-default flex-col rounded-md py-2 pr-8 pl-3 text-[14px] outline-none select-none data-[disabled]:opacity-45"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                {option.description && <span className="text-muted text-[12px]">{option.description}</span>}
                <SelectPrimitive.ItemIndicator className="absolute top-2.5 right-2.5">
                  <Check className="text-ember size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
