import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { fieldBase } from './input'

interface TagInputProps {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  max?: number
  suggestions?: string[]
  className?: string
}

/** Type and press Enter or comma to add. Backspace on an empty field removes the last tag. */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  max = 40,
  suggestions = [],
  className,
}: TagInputProps) {
  const [draft, setDraft] = React.useState('')

  const add = (raw: string) => {
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const next = [...value]
    for (const item of items) {
      if (next.length >= max) break
      if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) next.push(item.slice(0, 120))
    }
    onChange(next)
    setDraft('')
  }

  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className={cn(
          fieldBase,
          'focus-within:border-ember focus-within:ring-ring flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:ring-3',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="bg-surface-2 ring-line inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-[13px] ring-1 ring-inset"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="text-subtle hover:bg-surface-3 hover:text-ink rounded p-0.5"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            if (e.target.value.includes(',')) add(e.target.value)
            else setDraft(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (draft.trim()) add(draft)
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? '' : placeholder}
          className="placeholder:text-subtle h-7 min-w-32 flex-1 bg-transparent px-1 text-[14px] outline-none"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="border-line-strong text-muted hover:border-ember hover:text-ember-ink rounded-full border border-dashed px-2.5 py-0.5 text-[12.5px] transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
