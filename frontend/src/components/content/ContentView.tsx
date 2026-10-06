import { toast } from 'sonner'

import { toApiError } from '@/lib/api/client'
import type { ContentType } from '@/lib/api/types'
import { CONTENT_FIELDS } from '@/lib/content'
import { ContentField } from './ContentField'

interface ContentViewProps {
  type: ContentType
  data: Record<string, unknown>
  /** Persist an edited field. Omit for read-only display. */
  onSaveField?: (name: string, value: unknown) => Promise<unknown>
  /** Regenerate one field with the AI. Omit to hide regeneration. */
  onRegenerateField?: (name: string, instruction: string) => Promise<unknown>
  regeneratingField?: string | null
  regenerable?: string[]
  compact?: boolean
}

/** Renders every component of a content payload using the shared field registry. */
export function ContentView({
  type,
  data,
  onSaveField,
  onRegenerateField,
  regeneratingField,
  regenerable = [],
  compact,
}: ContentViewProps) {
  const withToast = <A extends unknown[]>(
    fn: ((...args: A) => Promise<unknown>) | undefined,
    success: string,
  ) =>
    fn &&
    (async (...args: A) => {
      try {
        const result = await fn(...args)
        toast.success(success)
        return result
      } catch (error) {
        const e = toApiError(error)
        toast.error(e.title, { description: e.message })
        throw error
      }
    })

  return (
    <div className="divide-line flex flex-col divide-y">
      {CONTENT_FIELDS[type].map((spec) => {
        const save = withToast(
          onSaveField && ((v: unknown) => onSaveField(spec.name, v)),
          `${spec.label} updated`,
        )
        const regenerate = regenerable.includes(spec.name)
          ? withToast(
              onRegenerateField && ((instruction: string) => onRegenerateField(spec.name, instruction)),
              `New ${spec.label.toLowerCase()} ready`,
            )
          : undefined
        return (
          <ContentField
            key={spec.name}
            spec={spec}
            value={data[spec.name]}
            onSave={save}
            onRegenerate={regenerate}
            regenerating={regeneratingField === spec.name}
            compact={compact}
          />
        )
      })}
    </div>
  )
}
