import { Check, Plus, Store } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ErrorNotice } from '@/components/ErrorNotice'
import { BrandAvatar } from '@/components/layout/BrandSwitcher'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useActivateBrand, useBrands, useCatalog } from '@/lib/api/hooks'

export default function BrandsPage() {
  const { data: brands, isPending, error, refetch } = useBrands()
  const { data: catalog } = useCatalog()
  const activate = useActivateBrand()

  return (
    <>
      <PageHeader
        title="Brands"
        description="Each brand profile teaches the AI a business's voice, audience and rules. Agencies can keep one per client."
        actions={
          <Button asChild>
            <Link to="/brands/new">
              <Plus /> New brand
            </Link>
          </Button>
        }
      />
      {error ? (
        <ErrorNotice error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1].map((i) => (
            <Card key={i} className="flex flex-col gap-3 p-5">
              <Skeleton className="size-10" />
              <Skeleton className="w-1/2" />
              <Skeleton className="w-3/4" />
            </Card>
          ))}
        </div>
      ) : !brands?.length ? (
        <EmptyState
          icon={<Store />}
          title="No brands yet"
          description="Create a brand profile so every piece of content is tailored to the business."
          action={
            <Button asChild size="sm">
              <Link to="/brands/new">Create a brand</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {brands.map((brand) => {
            const completeness = [
              brand.description,
              brand.target_audience,
              brand.products_services,
              brand.content_pillars.length,
              brand.personality || brand.brand_values.length,
            ].filter(Boolean).length
            return (
              <Card key={brand.id} className="flex flex-col">
                <Link
                  to={`/brands/${brand.id}`}
                  className="hover:bg-surface-2/30 flex flex-1 flex-col gap-3 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <BrandAvatar name={brand.name} className="size-11 text-[15px]" />
                    {brand.is_active && (
                      <Badge tone="moss">
                        <Check /> Active
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold">{brand.name}</p>
                    <p className="text-muted text-[13px]">
                      {[brand.industry, catalog?.tones.find((t) => t.value === brand.tone_of_voice)?.label]
                        .filter(Boolean)
                        .join(' · ') || 'Add details to improve results'}
                    </p>
                  </div>
                  {brand.description && (
                    <p className="text-muted line-clamp-2 text-[13.5px]">{brand.description}</p>
                  )}
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <div className="bg-surface-3 h-1.5 flex-1 overflow-hidden rounded-full" aria-hidden>
                      <div
                        className="bg-ember h-full rounded-full"
                        style={{ width: `${(completeness / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-subtle text-[12px]">
                      Profile {Math.round((completeness / 5) * 100)}%
                    </span>
                  </div>
                </Link>
                {!brand.is_active && (
                  <div className="border-line border-t px-5 py-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        activate.mutate(brand.id, {
                          onSuccess: () => toast.success(`Now creating for ${brand.name}`),
                        })
                      }
                    >
                      Make active
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
