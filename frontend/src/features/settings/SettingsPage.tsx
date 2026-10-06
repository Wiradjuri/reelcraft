import { Building2, CheckCircle2, Cpu, Sparkles, Unplug, UserRound } from 'lucide-react'
import * as React from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { ErrorNotice } from '@/components/ErrorNotice'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/collapsible'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useAISettings,
  useCatalog,
  useDeleteConnection,
  useLogout,
  useSession,
  useSetAISource,
  useUpdateWorkspace,
} from '@/lib/api/hooks'
import type { Quality } from '@/lib/api/types'
import { cn, formatRelative } from '@/lib/utils'
import { ConnectionForm } from './ConnectionForm'

const TABS = ['workspace', 'ai', 'account'] as const

export default function SettingsPage() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const active = TABS.includes(tab as (typeof TABS)[number]) ? (tab as string) : 'workspace'
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs value={active} onValueChange={(v) => navigate(`/settings/${v}`, { replace: true })}>
        <TabsList className="mb-6">
          <TabsTrigger value="workspace">
            <Building2 /> Workspace
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Cpu /> AI & Integrations
          </TabsTrigger>
          <TabsTrigger value="account">
            <UserRound /> Account
          </TabsTrigger>
        </TabsList>
        <TabsContent value="workspace">
          <WorkspaceSettings />
        </TabsContent>
        <TabsContent value="ai">
          <AISettingsPanel />
        </TabsContent>
        <TabsContent value="account">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </>
  )
}

function WorkspaceSettings() {
  const { data: session } = useSession()
  const { data: catalog } = useCatalog()
  const update = useUpdateWorkspace()
  const [name, setName] = React.useState(session?.workspace.name ?? '')
  const canEdit = session?.workspace.role === 'owner' || session?.workspace.role === 'admin'
  if (!session) return null
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Your workspace holds your brands, content and team.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Workspace name" htmlFor="ws-name">
            <div className="flex gap-2">
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                maxLength={120}
              />
              <Button
                variant="secondary"
                disabled={!canEdit || !name.trim() || name === session.workspace.name}
                loading={update.isPending && update.variables?.name !== undefined}
                onClick={() =>
                  update.mutate(
                    { name: name.trim() },
                    { onSuccess: () => toast.success('Workspace renamed') },
                  )
                }
              >
                Save
              </Button>
            </div>
          </Field>
          <div className="text-muted flex items-center gap-2 text-[13px]">
            Plan:{' '}
            <Badge tone="ember" className="capitalize">
              {session.workspace.plan}
            </Badge>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Default AI quality</CardTitle>
          <CardDescription>
            Used for new content unless you choose otherwise. Auto is recommended.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Segmented
            aria-label="Default AI quality"
            value={session.workspace.preferences.default_quality}
            onValueChange={(v) =>
              update.mutate(
                { preferences: { default_quality: v as Quality } },
                { onSuccess: () => toast.success('Default quality updated') },
              )
            }
            options={(catalog?.qualities ?? []).map((q) => ({
              value: q.value,
              label: q.label,
              disabled: !canEdit,
            }))}
          />
          <p className="text-muted mt-2 text-[13px]">
            {
              catalog?.qualities.find((q) => q.value === session.workspace.preferences.default_quality)
                ?.description
            }
          </p>
        </CardContent>
      </Card>
      {update.isError && <ErrorNotice error={update.error} />}
    </div>
  )
}

function AISettingsPanel() {
  const { data: settings, isPending, error, refetch } = useAISettings()
  const { data: catalog } = useCatalog()
  const setSource = useSetAISource()
  const disconnect = useDeleteConnection()

  if (isPending) return <Skeleton className="h-64 max-w-3xl" />
  if (error || !settings) return <ErrorNotice error={error} onRetry={() => void refetch()} />

  const usingCustom = settings.ai_source === 'custom'
  const activeConnection = settings.connections.find((c) => c.provider === settings.active_provider)
  const providerLabel = (id: string) => catalog?.ai_providers.find((p) => p.id === id)?.label ?? id

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <SourceCard
          active={!usingCustom}
          title="ReelCraft AI"
          badge="Recommended"
          description={
            settings.platform_ai_available
              ? 'Included with your plan. We pick the best model for each request automatically.'
              : 'Not available on this installation. Connect your own provider below.'
          }
          disabled={!settings.platform_ai_available}
          onSelect={() =>
            setSource.mutate(
              { ai_source: 'platform' },
              { onSuccess: () => toast.success('Using ReelCraft AI') },
            )
          }
        />
        <SourceCard
          active={usingCustom}
          title="Your own AI provider"
          badge="Advanced"
          description={
            activeConnection
              ? `Connected to ${providerLabel(activeConnection.provider)}${activeConnection.key_hint ? ` (key ${activeConnection.key_hint})` : ''}.`
              : 'Use your own OpenAI, Anthropic, Gemini, OpenRouter or local AI account.'
          }
          disabled={!settings.connections.length}
          onSelect={() => {
            const provider = settings.active_provider ?? settings.connections[0]?.provider
            if (provider)
              setSource.mutate(
                { ai_source: 'custom', provider },
                { onSuccess: () => toast.success(`Using ${providerLabel(provider)}`) },
              )
          }}
        />
      </div>
      {setSource.isError && <ErrorNotice error={setSource.error} />}

      {settings.connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved connections</CardTitle>
          </CardHeader>
          <CardContent className="divide-line flex flex-col divide-y py-2">
            {settings.connections.map((c) => (
              <div key={c.provider} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {providerLabel(c.provider)}
                    {usingCustom && settings.active_provider === c.provider && (
                      <Badge tone="moss">In use</Badge>
                    )}
                  </p>
                  <p className="text-muted text-[12.5px]">
                    {[
                      c.key_hint && `Key ${c.key_hint}`,
                      c.base_url,
                      c.last_tested_at && `Tested ${formatRelative(c.last_tested_at)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {c.last_test_ok === false && <span className="text-danger"> · Last test failed</span>}
                  </p>
                </div>
                {!(usingCustom && settings.active_provider === c.provider) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSource.mutate({ ai_source: 'custom', provider: c.provider })}
                  >
                    Use this
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    disconnect.mutate(c.provider, {
                      onSuccess: () => toast.success(`${providerLabel(c.provider)} disconnected`),
                    })
                  }
                >
                  <Unplug /> Disconnect
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <Disclosure
          title="Advanced: connect your own AI provider"
          description="bring your own API key or local model"
          defaultOpen={!settings.platform_ai_available || usingCustom}
        >
          <p className="text-muted mb-5 text-[13.5px]">
            Your key is encrypted and stored on the server. It’s never shown again or sent to your browser.
          </p>
          <ConnectionForm
            connections={settings.connections}
            initialProvider={settings.active_provider ?? undefined}
          />
        </Disclosure>
      </Card>
    </div>
  )
}

function SourceCard({
  active,
  title,
  badge,
  description,
  disabled,
  onSelect,
}: {
  active: boolean
  title: string
  badge: string
  description: string
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || active}
      aria-pressed={active}
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-5 text-left transition-all disabled:cursor-default',
        active
          ? 'border-ember bg-ember-soft/40 ring-ring ring-3'
          : 'border-line bg-surface hover:border-line-strong',
        disabled && !active && 'opacity-60',
      )}
    >
      <span className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold">
          {active ? (
            <CheckCircle2 className="text-ember size-4" />
          ) : (
            <Sparkles className="text-subtle size-4" />
          )}
          {title}
        </span>
        <Badge tone={active ? 'ember' : 'neutral'}>{active ? 'Active' : badge}</Badge>
      </span>
      <span className="text-muted text-[13.5px]">{description}</span>
    </button>
  )
}

function AccountSettings() {
  const { data: session } = useSession()
  const logout = useLogout()
  const navigate = useNavigate()
  if (!session) return null
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Your account</CardTitle>
        <CardDescription>
          Signed in to {session.workspace.name} as {session.workspace.role}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-[14px]">
          <dt className="text-muted">Name</dt>
          <dd>{session.user.name}</dd>
          <dt className="text-muted">Email</dt>
          <dd>{session.user.email}</dd>
        </dl>
        <Button
          variant="secondary"
          className="self-start"
          loading={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}
        >
          Sign out
        </Button>
      </CardContent>
    </Card>
  )
}
