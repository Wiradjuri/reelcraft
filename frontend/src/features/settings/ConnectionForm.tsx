import { CheckCircle2, ExternalLink, Eye, EyeOff, PlugZap, XCircle } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { ErrorNotice } from '@/components/ErrorNotice'
import { Button } from '@/components/ui/button'
import { Disclosure } from '@/components/ui/collapsible'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useCatalog, useSaveConnection, useSetAISource, useTestConnection } from '@/lib/api/hooks'
import type { ProviderConnection, ProviderId, TestConnectionResult, Tier } from '@/lib/api/types'
import { cn } from '@/lib/utils'

const TIERS: { tier: Tier; label: string; hint: string }[] = [
  { tier: 'fast', label: 'Fast', hint: 'Everyday captions and quotes' },
  { tier: 'professional', label: 'Professional', hint: 'Reels and important content' },
  { tier: 'premium', label: 'Premium', hint: 'Campaigns and client work' },
]
const RECOMMENDED = '__recommended__'

/**
 * Bring-your-own-AI connection form. The API key is write-only: it's sent to the server,
 * encrypted there, and never returned — the UI only ever sees a masked hint.
 */
export function ConnectionForm({
  connections,
  initialProvider,
  activateOnSave = true,
  onSaved,
}: {
  connections: ProviderConnection[]
  initialProvider?: ProviderId
  activateOnSave?: boolean
  onSaved?: () => void
}) {
  const { data: catalog } = useCatalog()
  const providers = catalog?.ai_providers ?? []
  const [providerId, setProviderId] = React.useState<ProviderId>(initialProvider ?? 'openai')
  const info = providers.find((p) => p.id === providerId)
  const existing = connections.find((c) => c.provider === providerId)

  const [apiKey, setApiKey] = React.useState('')
  const [showKey, setShowKey] = React.useState(false)
  const [baseUrl, setBaseUrl] = React.useState(existing?.base_url ?? '')
  const [tierModels, setTierModels] = React.useState<Partial<Record<Tier, string>>>(
    existing?.tier_models ?? {},
  )
  const [result, setResult] = React.useState<TestConnectionResult | null>(null)

  const test = useTestConnection()
  const save = useSaveConnection()
  const setSource = useSetAISource()

  const selectProvider = (id: ProviderId) => {
    const current = connections.find((c) => c.provider === id)
    setProviderId(id)
    setApiKey('')
    setBaseUrl(current?.base_url ?? '')
    setTierModels(current?.tier_models ?? {})
    setResult(null)
    test.reset()
  }

  const isLocal = providerId === 'openai_compatible'
  const payload = () => ({
    provider: providerId,
    api_key: apiKey.trim() || null,
    base_url: baseUrl.trim() || null,
    tier_models:
      isLocal && tierModels.fast
        ? { fast: tierModels.fast, professional: tierModels.fast, premium: tierModels.fast }
        : tierModels,
  })

  const runTest = () =>
    test.mutate(payload(), {
      onSuccess: (r) => {
        setResult(r)
        if (isLocal && !tierModels.fast && r.models[0]) setTierModels({ fast: r.models[0].id })
      },
    })

  const onSave = async () => {
    try {
      await save.mutateAsync(payload())
      if (activateOnSave) await setSource.mutateAsync({ ai_source: 'custom', provider: providerId })
      toast.success(`${info?.label ?? 'Provider'} saved`, {
        description: activateOnSave ? 'New content will use your own AI connection.' : undefined,
      })
      setApiKey('')
      onSaved?.()
    } catch {
      /* rendered below */
    }
  }

  const models = result?.models ?? []
  const modelOptions = [
    ...(isLocal ? [] : [{ value: RECOMMENDED, label: 'Recommended (automatic)' }]),
    ...models.map((m) => ({ value: m.id, label: m.label === m.id ? m.id : `${m.label} · ${m.id}` })),
  ]
  const needsKey = Boolean(info?.requires_api_key) && !existing?.has_api_key && !apiKey.trim()
  const needsModel = isLocal && !tierModels.fast

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="AI provider">
        {providers.map((p) => {
          const connected = connections.find((c) => c.provider === p.id)
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === providerId}
              onClick={() => selectProvider(p.id)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-all',
                p.id === providerId
                  ? 'border-ember bg-ember-soft/50 ring-ring ring-3'
                  : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className="flex w-full items-center justify-between text-[14px] font-medium">
                {p.label}
                {connected && <CheckCircle2 className="text-moss size-4" aria-label="Connected" />}
              </span>
              <span className="text-muted text-[12px] leading-snug">{p.description}</span>
            </button>
          )
        })}
      </div>

      {info?.requires_base_url && (
        <Field
          label="Server address"
          htmlFor="base-url"
          hint="The address shown in LM Studio, Ollama or your server's settings. It usually ends in /v1."
        >
          <Input
            id="base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={info.base_url_placeholder}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      )}

      <Field
        label="API key"
        htmlFor="api-key"
        optional={!info?.requires_api_key}
        hint={
          existing?.has_api_key ? (
            <>
              A key ending <span className="font-mono">{existing.key_hint}</span> is saved. Leave blank to
              keep it.
            </>
          ) : info?.api_key_help_url ? (
            <a
              href={info.api_key_help_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-ember-ink inline-flex items-center gap-1 hover:underline"
            >
              Where do I find my {info.label} API key? <ExternalLink className="size-3" />
            </a>
          ) : (
            'Only needed if your server requires one.'
          )
        }
      >
        <div className="relative">
          <Input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={existing?.has_api_key ? '••••••••••••••••' : 'Paste your API key'}
            autoComplete="off"
            spellCheck={false}
            className="pr-11 font-mono text-[13px]"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="text-subtle hover:text-ink absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5"
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={runTest} loading={test.isPending} disabled={needsKey}>
          <PlugZap /> Test connection
        </Button>
        {test.isError && <span className="text-danger text-[13px]">Test failed — see below.</span>}
      </div>

      {result && <ConnectionStatus result={result} />}
      {test.isError && <ErrorNotice error={test.error} />}

      {(models.length > 0 || Object.keys(tierModels).length > 0) && (
        <div className="border-line bg-surface-2/40 flex flex-col gap-3 rounded-lg border p-4">
          <div>
            <p className="text-[14px] font-medium">{isLocal ? 'Model' : 'Models for each quality level'}</p>
            <p className="text-muted text-[13px]">
              {isLocal
                ? 'Choose the model your server should use.'
                : 'Leave on Recommended unless you need a specific model.'}
            </p>
          </div>
          <div className={cn('grid gap-3', !isLocal && 'sm:grid-cols-3')}>
            {(isLocal ? TIERS.slice(0, 1) : TIERS).map(({ tier, label, hint }) => {
              const current = tierModels[tier]
              const options =
                current && !modelOptions.some((o) => o.value === current)
                  ? [...modelOptions, { value: current, label: current }]
                  : modelOptions
              return (
                <Field key={tier} label={isLocal ? 'Model' : label} hint={isLocal ? undefined : hint}>
                  <Select
                    aria-label={`${label} model`}
                    value={current ?? (isLocal ? '' : RECOMMENDED)}
                    onValueChange={(v) =>
                      setTierModels((m) => {
                        const next = { ...m }
                        if (v === RECOMMENDED) delete next[tier]
                        else next[tier] = v
                        return next
                      })
                    }
                    options={options}
                    placeholder="Test the connection to load models"
                  />
                </Field>
              )
            })}
          </div>
        </div>
      )}

      {save.isError && <ErrorNotice error={save.error} />}
      {setSource.isError && <ErrorNotice error={setSource.error} />}

      <div className="border-line flex flex-wrap items-center gap-3 border-t pt-4">
        <Button
          onClick={onSave}
          loading={save.isPending || setSource.isPending}
          disabled={needsKey || needsModel}
        >
          {activateOnSave ? `Save & use ${info?.label ?? 'provider'}` : 'Save connection'}
        </Button>
        {needsModel && (
          <span className="text-muted text-[13px]">Test the connection and choose a model first.</span>
        )}
      </div>
    </div>
  )
}

export function ConnectionStatus({ result }: { result: TestConnectionResult }) {
  return (
    <div
      role="status"
      className={cn(
        'flex gap-3 rounded-lg border p-3.5',
        result.ok ? 'border-moss/30 bg-moss-soft/60' : 'border-danger/25 bg-danger-soft/60',
      )}
    >
      {result.ok ? (
        <CheckCircle2 className="text-moss mt-0.5 size-5 shrink-0" />
      ) : (
        <XCircle className="text-danger mt-0.5 size-5 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold">{result.title}</p>
        <p className="text-muted text-[13.5px]">{result.message}</p>
        {Object.keys(result.details).length > 0 && (
          <Disclosure title="Advanced details">
            <pre className="bg-surface text-muted ring-line overflow-x-auto rounded-md p-3 text-[12px] ring-1">
              {JSON.stringify(result.details, null, 2)}
            </pre>
          </Disclosure>
        )}
      </div>
    </div>
  )
}
