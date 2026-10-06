import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  LayoutDashboard,
  Sparkles,
  Store,
  Wand2,
} from 'lucide-react'
import * as React from 'react'
import { Link, Navigate, useNavigate } from 'react-router'

import { ErrorNotice } from '@/components/ErrorNotice'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { ChoiceChips } from '@/components/ui/choice-chips'
import { Disclosure } from '@/components/ui/collapsible'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { TagInput } from '@/components/ui/tag-input'
import { PILLAR_SUGGESTIONS } from '@/features/brands/suggestions'
import { ConnectionForm } from '@/features/settings/ConnectionForm'
import type { ApiError } from '@/lib/api/client'
import {
  useAISettings,
  useBrands,
  useCatalog,
  useCompleteOnboarding,
  useCreateBrand,
  useSession,
  useSetupStatus,
  useSignup,
} from '@/lib/api/hooks'
import type { Tone } from '@/lib/api/types'
import { cn } from '@/lib/utils'

const STEPS = ['Welcome', 'Your account', 'Your brand', 'AI', 'Ready'] as const
type Step = 0 | 1 | 2 | 3 | 4

export default function SetupWizard() {
  const { data: status, isPending } = useSetupStatus()
  const { data: session } = useSession(Boolean(status?.authenticated))
  const { data: brands } = useBrands(Boolean(status?.authenticated))
  const [chosenStep, setStep] = React.useState<Step | null>(null)
  // Until the customer moves, resume where they left off (e.g. after a refresh).
  const resumeStep: Step | null = !status
    ? null
    : !status.authenticated
      ? 0
      : brands
        ? brands.length
          ? 3
          : 2
        : null
  const step = chosenStep ?? resumeStep

  if (isPending || !status) return <FullPageLoader />
  if (status.authenticated && status.onboarding_completed && step !== 4) return <Navigate to="/" replace />
  if (!status.authenticated && !status.signup_allowed) return <Navigate to="/login" replace />
  if (step === null) return <FullPageLoader />

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <WizardAside step={step} />
      <div className="flex flex-col px-5 py-8 sm:px-12 lg:py-12">
        <div className="mb-10 flex items-center justify-between lg:hidden">
          <Logo />
        </div>
        <Progress step={step} />
        <div key={step} className="animate-rise mx-auto flex w-full max-w-xl flex-1 flex-col py-10">
          {step === 0 && <WelcomeStep onNext={() => setStep(status.authenticated ? 2 : 1)} />}
          {step === 1 && <AccountStep onBack={() => setStep(0)} onNext={() => setStep(2)} />}
          {step === 2 && (
            <BrandStep
              defaultName={session?.workspace.name ?? ''}
              onNext={() => setStep(3)}
              existing={brands?.length ?? 0}
            />
          )}
          {step === 3 && (
            <AIStep
              platformAvailable={status.platform_ai_available}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && <ReadyStep />}
        </div>
      </div>
    </div>
  )
}

function WizardAside({ step }: { step: Step }) {
  const lines = [
    [
      'Content that sounds like you.',
      'ReelCraft learns your brand once, then writes everything in your voice.',
    ],
    ['A home for your team.', 'Your workspace keeps brands, content and history in one place.'],
    ['Tell us about your business.', 'The more we know, the more specific — and useful — your content gets.'],
    ['The AI is handled for you.', 'We automatically pick the right AI for every request. No set-up needed.'],
    ["You're ready to create.", 'Reels, captions and quotes — tailored to your brand in seconds.'],
  ] as const
  const [title, body] = lines[step]
  return (
    <aside className="bg-ink text-paper dark:bg-surface-2 dark:text-ink relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div
        aria-hidden
        className="bg-ember/25 pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full blur-3xl"
      />
      <Logo className="[&_rect]:fill-paper [&_path]:fill-ember dark:[&_rect]:fill-ink relative" />
      <div className="relative flex flex-col gap-4">
        <p className="font-display text-[44px] leading-[1.05] text-balance">{title}</p>
        <p className="text-paper/70 dark:text-muted max-w-sm text-[15px]">{body}</p>
      </div>
      <PreviewCard />
    </aside>
  )
}

function PreviewCard() {
  return (
    <div className="bg-paper text-ink shadow-pop relative w-72 rotate-[-2deg] rounded-xl p-4" aria-hidden>
      <div className="text-ember-ink mb-3 flex items-center gap-2 text-[11px] font-medium tracking-wide uppercase">
        <Clapperboard className="size-3.5" /> Reel · Variation A · Bold
      </div>
      <p className="font-display text-[22px] leading-tight">
        “Stop scrolling — your Monday coffee is lying to you.”
      </p>
      <div className="mt-3 flex gap-1.5">
        {['0–3s', '3–12s', '12–25s', '25–30s'].map((t) => (
          <span
            key={t}
            className="bg-surface-2 text-muted ring-line rounded px-1.5 py-0.5 text-[10.5px] ring-1"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function Progress({ step }: { step: Step }) {
  return (
    <ol className="mx-auto flex w-full max-w-xl items-center gap-2" aria-label="Setup progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 flex-col gap-2" aria-current={i === step ? 'step' : undefined}>
          <span
            className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-ember' : 'bg-surface-3')}
          />
          <span
            className={cn('hidden text-[12px] sm:block', i === step ? 'text-ink font-medium' : 'text-subtle')}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <h1 className="font-display text-[38px] leading-[1.08] text-balance">{title}</h1>
      <p className="text-muted text-[15.5px]">{description}</p>
    </div>
  )
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const points = [
    [
      Clapperboard,
      'Reels, captions & quotes',
      'Complete Reel plans with hooks, shots and scripts — plus ready-to-post captions.',
    ],
    [
      Wand2,
      'Several genuinely different options',
      'Every request gives you distinct creative angles to choose from.',
    ],
    [Store, 'Always on-brand', 'Your tone, audience and rules are applied automatically, every time.'],
  ] as const
  return (
    <>
      <StepHeading
        title="Welcome to ReelCraft"
        description="Your AI content studio for Instagram. Set up takes about two minutes — then you can create your first post."
      />
      <ul className="mb-10 flex flex-col gap-4">
        {points.map(([Icon, title, body]) => (
          <li key={title} className="flex gap-4">
            <span className="bg-ember-soft text-ember-ink flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block font-medium">{title}</span>
              <span className="text-muted block text-[14px]">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <Link to="/login" className="text-muted hover:text-ink text-[14px]">
          Already have an account? <span className="text-ember-ink font-medium">Sign in</span>
        </Link>
        <Button size="lg" onClick={onNext}>
          Get started <ArrowRight />
        </Button>
      </div>
    </>
  )
}

function AccountStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const signup = useSignup()
  const [form, setForm] = React.useState({ name: '', workspace_name: '', email: '', password: '' })
  const errors = (signup.error as ApiError | null)?.fieldErrors ?? {}
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        signup.mutate(form, { onSuccess: onNext })
      }}
      className="flex flex-1 flex-col"
      noValidate
    >
      <StepHeading
        title="Create your account"
        description="This keeps your brands and content private to your workspace."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" error={errors.name}>
          <Input id="name" value={form.name} onChange={set('name')} autoComplete="name" required />
        </Field>
        <Field
          label="Business or workspace name"
          htmlFor="workspace"
          error={errors.workspace_name}
          tip="Agencies can add client brands later."
        >
          <Input
            id="workspace"
            value={form.workspace_name}
            onChange={set('workspace_name')}
            autoComplete="organization"
            required
          />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email} className="sm:col-span-2">
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            required
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint="At least 10 characters, with a mix of letters and numbers or symbols."
          className="sm:col-span-2"
        >
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            required
          />
        </Field>
      </div>
      {signup.isError && !Object.keys(errors).length && <ErrorNotice error={signup.error} className="mt-5" />}
      <div className="mt-auto flex items-center justify-between gap-3 pt-10">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <Button type="submit" size="lg" loading={signup.isPending}>
          Create account <ArrowRight />
        </Button>
      </div>
    </form>
  )
}

function BrandStep({
  defaultName,
  existing,
  onNext,
}: {
  defaultName: string
  existing: number
  onNext: () => void
}) {
  const { data: catalog } = useCatalog()
  const create = useCreateBrand()
  const [brand, setBrand] = React.useState({
    name: defaultName,
    industry: '',
    description: '',
    products_services: '',
    target_audience: '',
    location: '',
    tone_of_voice: 'conversational' as Tone,
    content_pillars: [] as string[],
  })
  const errors = (create.error as ApiError | null)?.fieldErrors ?? {}
  const set = (key: keyof typeof brand) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setBrand((b) => ({ ...b, [key]: e.target.value }))

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate({ ...brand, make_active: true }, { onSuccess: onNext })
      }}
    >
      <StepHeading
        title="Tell us about your brand"
        description="Only the name is required. Everything else makes your content sharper — and you can change it any time."
      />
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business or brand name" htmlFor="brand-name" error={errors.name}>
            <Input id="brand-name" value={brand.name} onChange={set('name')} required />
          </Field>
          <Field label="Industry" htmlFor="industry" optional>
            <Input
              id="industry"
              value={brand.industry}
              onChange={set('industry')}
              placeholder="e.g. Specialty café"
            />
          </Field>
        </div>
        <Field label="What does your business do?" htmlFor="description" optional>
          <Textarea
            id="description"
            value={brand.description}
            onChange={set('description')}
            placeholder="e.g. A neighbourhood café roasting single-origin coffee in-house, known for our seasonal menu."
            className="min-h-20"
          />
        </Field>
        <Field label="Who are your customers?" htmlFor="audience" optional>
          <Input
            id="audience"
            value={brand.target_audience}
            onChange={set('target_audience')}
            placeholder="e.g. Young professionals and remote workers in Fitzroy"
          />
        </Field>
        <Field label="How should your content sound?">
          <ChoiceChips
            aria-label="Tone of voice"
            value={brand.tone_of_voice}
            onValueChange={(v) => setBrand((b) => ({ ...b, tone_of_voice: v as Tone }))}
            options={catalog?.tones ?? []}
          />
        </Field>
        <Field
          label="What do you want to post about?"
          optional
          hint="Your content pillars — pick a few or type your own."
        >
          <TagInput
            value={brand.content_pillars}
            onChange={(v) => setBrand((b) => ({ ...b, content_pillars: v }))}
            placeholder="Type and press Enter"
            suggestions={PILLAR_SUGGESTIONS}
          />
        </Field>
        <Disclosure title="Add more detail" description="products, location">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Products or services" htmlFor="products" optional className="sm:col-span-2">
              <Textarea
                id="products"
                value={brand.products_services}
                onChange={set('products_services')}
                className="min-h-16"
              />
            </Field>
            <Field
              label="Location / market"
              htmlFor="location"
              optional
              hint="Helps with local references and spelling."
            >
              <Input
                id="location"
                value={brand.location}
                onChange={set('location')}
                placeholder="e.g. Melbourne, Australia"
              />
            </Field>
          </div>
        </Disclosure>
      </div>
      {create.isError && <ErrorNotice error={create.error} className="mt-5" />}
      <div className="mt-auto flex items-center justify-between gap-3 pt-10">
        {existing > 0 ? (
          <Button type="button" variant="ghost" onClick={onNext}>
            Skip — use my existing brand
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" loading={create.isPending} disabled={!brand.name.trim()}>
          Save brand <ArrowRight />
        </Button>
      </div>
    </form>
  )
}

function AIStep({
  platformAvailable,
  onBack,
  onNext,
}: {
  platformAvailable: boolean
  onBack: () => void
  onNext: () => void
}) {
  const { data: settings } = useAISettings()
  const [customise, setCustomise] = React.useState(!platformAvailable)
  const connected = settings?.ai_source === 'custom'
  const ready = platformAvailable || connected

  return (
    <div className="flex flex-1 flex-col">
      <StepHeading
        title={platformAvailable ? 'AI is ready to go' : 'Connect your AI'}
        description={
          platformAvailable
            ? 'ReelCraft AI is included. We automatically choose the right model for each piece of content.'
            : 'This installation needs an AI provider. Paste an API key below — it’s stored encrypted and never shown again.'
        }
      />
      {platformAvailable && (
        <div className="border-moss/30 bg-moss-soft/60 mb-6 flex items-start gap-3 rounded-lg border p-4">
          <span className="bg-moss flex size-9 shrink-0 items-center justify-center rounded-full text-white">
            <Check className="size-5" />
          </span>
          <div>
            <p className="font-semibold">
              {connected ? 'Your own AI provider is connected' : 'ReelCraft AI is active'}
            </p>
            <p className="text-muted text-[14px]">
              {connected
                ? 'New content will use your connection.'
                : 'Nothing to configure. Quality is set to Auto (recommended).'}
            </p>
          </div>
        </div>
      )}
      {platformAvailable && !customise ? (
        <button
          type="button"
          onClick={() => setCustomise(true)}
          className="text-muted hover:text-ink self-start text-[14px] underline-offset-4 hover:underline"
        >
          Advanced: use my own AI provider instead
        </button>
      ) : (
        <div className="border-line bg-surface shadow-card rounded-xl border p-5">
          <ConnectionForm connections={settings?.connections ?? []} />
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-10">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <Button size="lg" onClick={onNext} disabled={!ready}>
          Continue <ArrowRight />
        </Button>
      </div>
    </div>
  )
}

function ReadyStep() {
  const complete = useCompleteOnboarding()
  const navigate = useNavigate()
  const { data: brands } = useBrands()
  const finish = (to: string) => complete.mutate(null, { onSuccess: () => navigate(to, { replace: true }) })
  const brand = brands?.find((b) => b.is_active) ?? brands?.[0]

  return (
    <div className="flex flex-1 flex-col">
      <div className="bg-ember shadow-pop mb-6 flex size-14 items-center justify-center rounded-2xl text-white">
        <Sparkles className="size-7" />
      </div>
      <StepHeading
        title="You're all set"
        description={`${brand ? `${brand.name} is ready. ` : ''}Let's make your first piece of content — it takes about 30 seconds.`}
      />
      {complete.isError && <ErrorNotice error={complete.error} className="mb-5" />}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => finish('/create/reel')}
          disabled={complete.isPending}
          className="group border-ember bg-ember-soft/40 ring-ring hover:shadow-pop flex flex-col gap-3 rounded-xl border p-5 text-left ring-3 transition-shadow"
        >
          <Clapperboard className="text-ember-ink size-6" />
          <span>
            <span className="block text-[16px] font-semibold">Create my first post</span>
            <span className="text-muted block text-[13.5px]">Start with a Reel in Reel Studio.</span>
          </span>
          <ArrowRight className="text-ember-ink size-4 transition-transform group-hover:translate-x-1" />
        </button>
        <button
          onClick={() => finish('/')}
          disabled={complete.isPending}
          className="group border-line bg-surface hover:shadow-card flex flex-col gap-3 rounded-xl border p-5 text-left transition-shadow"
        >
          <LayoutDashboard className="text-muted size-6" />
          <span>
            <span className="block text-[16px] font-semibold">Go to my dashboard</span>
            <span className="text-muted block text-[13.5px]">Have a look around first.</span>
          </span>
          <ArrowRight className="text-muted size-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  )
}
