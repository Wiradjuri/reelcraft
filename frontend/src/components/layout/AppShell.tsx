import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  BookMarked,
  Captions,
  Clapperboard,
  History,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Quote,
  Settings,
  Store,
  Sun,
  X,
} from 'lucide-react'
import * as React from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout, useSession } from '@/lib/api/hooks'
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { BrandSwitcher } from './BrandSwitcher'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

const NAV: { heading?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    heading: 'Create',
    items: [
      { to: '/create/reel', label: 'Reel Studio', icon: Clapperboard },
      { to: '/create/caption', label: 'Captions', icon: Captions },
      { to: '/create/quote', label: 'Quotes', icon: Quote },
      { to: '/create/post_idea', label: 'Post ideas', icon: Lightbulb },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      { to: '/library', label: 'Content library', icon: BookMarked },
      { to: '/history', label: 'History', icon: History },
      { to: '/brands', label: 'Brands', icon: Store },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="px-1.5">
        <Logo />
      </div>
      <BrandSwitcher />
      <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAV.map((group, i) => (
          <div key={group.heading ?? i} className="flex flex-col gap-0.5">
            {group.heading && (
              <div className="text-subtle px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
                {group.heading}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] font-medium transition-colors',
                    isActive
                      ? 'bg-surface text-ink shadow-card ring-line ring-1'
                      : 'text-muted hover:bg-surface-2 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        'size-[18px]',
                        isActive ? 'text-ember' : 'text-subtle group-hover:text-muted',
                      )}
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <UserMenu />
    </div>
  )
}

function UserMenu() {
  const { data: session } = useSession()
  const logout = useLogout()
  const navigate = useNavigate()
  const [theme, setTheme] = React.useState<ThemePreference>(getThemePreference)
  if (!session) return null
  const choose = (t: ThemePreference) => {
    setTheme(t)
    setThemePreference(t)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-surface-2 flex items-center gap-2.5 rounded-lg p-2 text-left transition-colors">
        <span className="bg-ink text-paper flex size-8 items-center justify-center rounded-full text-[12px] font-semibold">
          {session.user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[13.5px] font-medium">{session.user.name}</span>
          <span className="text-subtle truncate text-[12px]">{session.workspace.name}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel>{session.user.email}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        {(
          [
            ['light', 'Light', Sun],
            ['dark', 'Dark', Moon],
            ['system', 'Match my device', Monitor],
          ] as const
        ).map(([value, label, Icon]) => (
          <DropdownMenuItem key={value} onSelect={() => choose(value)}>
            <Icon /> {label}
            {theme === value && <span className="bg-ember ml-auto size-1.5 rounded-full" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
          }
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const location = useLocation()
  const mainRef = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <a
        href="#main"
        className="bg-ink text-paper sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <aside className="border-line bg-paper sticky top-0 hidden h-dvh border-r lg:block">
        <SidebarContent />
      </aside>

      <header className="border-line bg-paper/85 sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogPrimitive.Trigger className="hover:bg-surface-2 rounded-md p-2" aria-label="Open menu">
            <Menu className="size-5" />
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="animate-fade-in bg-ink/30 fixed inset-0 z-40" />
            <DialogPrimitive.Content className="animate-rise bg-paper shadow-pop fixed inset-y-0 left-0 z-50 w-[84vw] max-w-xs">
              <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="hover:bg-surface-2 absolute top-4 right-3 rounded-md p-1.5"
                aria-label="Close menu"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 outline-none">
        <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-8 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
