import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-ink" />
      <path d="M11 9.5v13l11-6.5z" className="fill-ember" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-display text-[22px] leading-none tracking-tight">
        Reel<span className="text-ember-ink italic">craft</span>
      </span>
    </span>
  )
}
