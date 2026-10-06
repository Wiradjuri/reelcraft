import { ArrowLeft, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { ErrorNotice } from '@/components/ErrorNotice'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChoiceChips } from '@/components/ui/choice-chips'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { TagInput } from '@/components/ui/tag-input'
import { ApiError } from '@/lib/api/client'
import { useBrands, useCatalog, useCreateBrand, useDeleteBrand, useUpdateBrand } from '@/lib/api/hooks'
import type { Brand, BrandFields } from '@/lib/api/types'
import { INDUSTRY_SUGGESTIONS, PILLAR_SUGGESTIONS, VALUE_SUGGESTIONS } from './suggestions'

const EMPTY: BrandFields = {
  name: '',
  industry: '',
  description: '',
  products_services: '',
  target_audience: '',
  location: '',
  tone_of_voice: 'conversational',
  personality: '',
  content_pillars: [],
  writing_preferences: '',
  preferred_terminology: [],
  cta_style: '',
  prohibited_words: [],
  prohibited_subjects: [],
  brand_values: [],
  default_hashtags: [],
  emoji_style: 'light',
  additional_instructions: '',
}

export default function BrandEditorPage() {
  const { id } = useParams()
  const { data: brands, isPending } = useBrands()
  if (!id) return <BrandEditor />
  if (isPending) return <Skeleton className="h-96 w-full" />
  const brand = brands?.find((b) => b.id === id)
  if (!brand)
    return (
      <ErrorNotice
        error={
          new ApiError(404, {
            code: 'not_found',
            title: "We couldn't find that brand",
            message: 'It may have been deleted.',
            retryable: false,
            details: {},
          })
        }
        action={
          <Button asChild size="sm" variant="secondary">
            <Link to="/brands">Back to brands</Link>
          </Button>
        }
      />
    )
  return <BrandEditor brand={brand} />
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-muted text-[13.5px]">{description}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </Card>
  )
}

function BrandEditor({ brand }: { brand?: Brand }) {
  const navigate = useNavigate()
  const { data: catalog } = useCatalog()
  const create = useCreateBrand()
  const update = useUpdateBrand()
  const remove = useDeleteBrand()
  const [form, setForm] = React.useState<BrandFields>(() => ({ ...EMPTY, ...(brand ?? {}) }))
  const mutation = brand ? update : create
  const errors = mutation.error instanceof ApiError ? mutation.error.fieldErrors : {}

  const set = <K extends keyof BrandFields>(key: K, value: BrandFields[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const text = (key: keyof BrandFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set(key, e.target.value as never)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const done = (saved: Brand | void) => {
      toast.success(brand ? 'Brand updated' : 'Brand created', {
        description: brand ? 'New content will use these details.' : `${form.name} is now your active brand.`,
      })
      if (!brand && saved) navigate('/brands')
    }
    if (brand) update.mutate({ id: brand.id, ...form }, { onSuccess: done })
    else create.mutate({ ...form, make_active: true }, { onSuccess: done })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Link
        to="/brands"
        className="text-muted hover:text-ink inline-flex items-center gap-1.5 self-start text-[13px]"
      >
        <ArrowLeft className="size-4" /> Brands
      </Link>
      <PageHeader
        className="pb-1"
        title={brand ? brand.name : 'New brand'}
        description="Only the name is required. Every detail you add is used automatically in every generation."
      />

      <Section title="The basics" description="Who you are and what you offer.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand or business name" htmlFor="name" error={errors.name}>
            <Input id="name" value={form.name} onChange={text('name')} required maxLength={120} />
          </Field>
          <Field label="Industry" htmlFor="industry" optional>
            <Input
              id="industry"
              value={form.industry}
              onChange={text('industry')}
              list="industries"
              maxLength={120}
            />
            <datalist id="industries">
              {INDUSTRY_SUGGESTIONS.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="What the business does" htmlFor="description" optional>
          <Textarea
            id="description"
            value={form.description}
            onChange={text('description')}
            maxLength={2000}
          />
        </Field>
        <Field
          label="Products & services"
          htmlFor="products"
          optional
          hint="Include signature products, prices or offers you want mentioned."
        >
          <Textarea
            id="products"
            value={form.products_services}
            onChange={text('products_services')}
            maxLength={2000}
            className="min-h-20"
          />
        </Field>
        <Field
          label="Location / market"
          htmlFor="location"
          optional
          hint="Used for local references and spelling (e.g. British vs American English)."
        >
          <Input id="location" value={form.location} onChange={text('location')} maxLength={160} />
        </Field>
      </Section>

      <Section title="Audience & voice" description="Who you're talking to, and how you sound.">
        <Field label="Target audience" htmlFor="audience" optional>
          <Textarea
            id="audience"
            value={form.target_audience}
            onChange={text('target_audience')}
            maxLength={1000}
            className="min-h-20"
          />
        </Field>
        <Field label="Default tone of voice">
          <ChoiceChips
            aria-label="Default tone of voice"
            value={form.tone_of_voice}
            onValueChange={(v) => set('tone_of_voice', v as BrandFields['tone_of_voice'])}
            options={catalog?.tones ?? []}
          />
        </Field>
        <Field
          label="Personality"
          htmlFor="personality"
          optional
          hint="e.g. Warm, witty, a little nerdy about coffee. Never corporate."
        >
          <Textarea
            id="personality"
            value={form.personality}
            onChange={text('personality')}
            maxLength={1000}
            className="min-h-16"
          />
        </Field>
        <Field label="Brand values" optional>
          <TagInput
            value={form.brand_values}
            onChange={(v) => set('brand_values', v)}
            placeholder="Type and press Enter"
            suggestions={VALUE_SUGGESTIONS}
          />
        </Field>
        <Field label="Emojis">
          <Segmented
            aria-label="Emoji style"
            value={form.emoji_style}
            onValueChange={(v) => set('emoji_style', v as BrandFields['emoji_style'])}
            options={(catalog?.emoji_styles ?? []).map((o) => ({ value: o.value, label: o.label }))}
          />
        </Field>
      </Section>

      <Section title="Content" description="What you post about and how you ask people to act.">
        <Field label="Content pillars" optional hint="The themes you post about regularly.">
          <TagInput
            value={form.content_pillars}
            onChange={(v) => set('content_pillars', v)}
            placeholder="Type and press Enter"
            suggestions={PILLAR_SUGGESTIONS}
          />
        </Field>
        <Field
          label="Preferred call-to-action style"
          htmlFor="cta"
          optional
          hint="e.g. Invite people to book via the link in bio."
        >
          <Input id="cta" value={form.cta_style} onChange={text('cta_style')} maxLength={200} />
        </Field>
        <Field
          label="Preferred terminology"
          optional
          hint="Words and names the brand always uses (e.g. “studio” not “gym”)."
        >
          <TagInput
            value={form.preferred_terminology}
            onChange={(v) => set('preferred_terminology', v)}
            placeholder="Type and press Enter"
          />
        </Field>
        <Field label="Brand hashtags" optional>
          <TagInput
            value={form.default_hashtags}
            onChange={(v) => set('default_hashtags', v)}
            placeholder="#yourbrand"
          />
        </Field>
      </Section>

      <Section title="Guardrails" description="Things the AI must never do. These are always enforced.">
        <Field label="Words to avoid" optional>
          <TagInput
            value={form.prohibited_words}
            onChange={(v) => set('prohibited_words', v)}
            placeholder="e.g. cheap, guaranteed"
          />
        </Field>
        <Field label="Subjects to avoid" optional>
          <TagInput
            value={form.prohibited_subjects}
            onChange={(v) => set('prohibited_subjects', v)}
            placeholder="e.g. politics, competitors"
          />
        </Field>
        <Field
          label="Writing preferences"
          htmlFor="writing"
          optional
          hint="Formatting, spelling or style rules."
        >
          <Textarea
            id="writing"
            value={form.writing_preferences}
            onChange={text('writing_preferences')}
            maxLength={2000}
            className="min-h-16"
          />
        </Field>
        <Field label="Additional instructions" htmlFor="extra" optional>
          <Textarea
            id="extra"
            value={form.additional_instructions}
            onChange={text('additional_instructions')}
            maxLength={2000}
            className="min-h-16"
          />
        </Field>
      </Section>

      {mutation.isError && <ErrorNotice error={mutation.error} />}

      <div className="border-line bg-surface/90 shadow-pop sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border p-3 backdrop-blur">
        {brand ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="ghost" className="text-danger hover:text-danger">
                <Trash2 /> Delete brand
              </Button>
            </DialogTrigger>
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>Delete {brand.name}?</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <p className="text-muted text-[14px]">
                  The brand will be removed. Your history and saved content made for it are kept.
                </p>
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  loading={remove.isPending}
                  onClick={() =>
                    remove.mutate(brand.id, {
                      onSuccess: () => {
                        toast.success('Brand deleted')
                        navigate('/brands')
                      },
                    })
                  }
                >
                  Delete brand
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" loading={mutation.isPending} disabled={!form.name.trim()}>
          {brand ? 'Save changes' : 'Create brand'}
        </Button>
      </div>
    </form>
  )
}
