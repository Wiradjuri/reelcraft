import { LogoMark } from './Logo'

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading">
      <LogoMark className="size-9 animate-pulse" />
    </div>
  )
}
