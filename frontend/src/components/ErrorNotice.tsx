import { AlertTriangle, RotateCcw } from 'lucide-react'

import { Disclosure } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { toApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

/** Customer-friendly error with technical diagnostics tucked under "Advanced details". */
export function ErrorNotice({
  error,
  onRetry,
  className,
  action,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
  action?: React.ReactNode
}) {
  const e = toApiError(error)
  const details = Object.keys(e.details).length ? e.details : null
  return (
    <div
      role="alert"
      className={cn('border-danger/25 bg-danger-soft/60 flex gap-3 rounded-lg border p-4', className)}
    >
      <AlertTriangle className="text-danger mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p className="font-semibold">{e.title}</p>
          <p className="text-muted text-[14px]">{e.message}</p>
        </div>
        {(onRetry || action) && (
          <div className="flex flex-wrap gap-2">
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                <RotateCcw /> Try again
              </Button>
            )}
            {action}
          </div>
        )}
        {(details || e.code) && (
          <Disclosure title="Advanced details">
            <pre className="bg-surface text-muted ring-line overflow-x-auto rounded-md p-3 text-[12px] ring-1">
              {JSON.stringify({ code: e.code, status: e.status || undefined, ...details }, null, 2)}
            </pre>
          </Disclosure>
        )}
      </div>
    </div>
  )
}
