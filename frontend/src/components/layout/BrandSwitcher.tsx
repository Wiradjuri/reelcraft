import { Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useActivateBrand, useBrands } from '@/lib/api/hooks'
import { cn } from '@/lib/utils'

export function BrandAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <span
      aria-hidden
      className={cn(
        'bg-ember-soft text-ember-ink ring-ember/20 flex size-8 shrink-0 items-center justify-center rounded-md text-[12px] font-semibold ring-1 ring-inset',
        className,
      )}
    >
      {initials || '•'}
    </span>
  )
}

export function BrandSwitcher() {
  const { data: brands = [] } = useBrands()
  const activate = useActivateBrand()
  const navigate = useNavigate()
  const active = brands.find((b) => b.is_active) ?? brands[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="border-line bg-surface shadow-card hover:border-line-strong flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors">
        <BrandAvatar name={active?.name ?? '?'} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-subtle text-[11px] font-medium tracking-wide uppercase">Brand</span>
          <span className="truncate text-[13.5px] font-medium">{active?.name ?? 'No brand yet'}</span>
        </span>
        <ChevronsUpDown className="text-subtle size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch brand</DropdownMenuLabel>
        {brands.map((brand) => (
          <DropdownMenuItem
            key={brand.id}
            onSelect={() =>
              !brand.is_active &&
              activate.mutate(brand.id, { onSuccess: () => toast.success(`Now creating for ${brand.name}`) })
            }
          >
            <BrandAvatar name={brand.name} className="size-6 text-[10px]" />
            <span className="flex-1 truncate">{brand.name}</span>
            {brand.is_active && <Check className="!text-ember" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/brands/new')}>
          <Plus /> Add a brand
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/brands')}>
          <Settings2 /> Manage brands
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
