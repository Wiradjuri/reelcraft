/**
 * Server-state hooks (TanStack Query). Components never call `fetch` directly; they use
 * these hooks, which own cache keys and invalidation.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type {
  AISettings,
  Brand,
  BrandInput,
  Catalog,
  ConnectionInput,
  ContentItem,
  GenerateInput,
  Generation,
  GenerationSummary,
  LibraryQuery,
  Page,
  ProviderConnection,
  SavedContent,
  Session,
  SetupStatus,
  SignupInput,
  Stats,
  TestConnectionResult,
  Workspace,
} from './types'

export const keys = {
  setup: ['setup'] as const,
  session: ['session'] as const,
  catalog: ['catalog'] as const,
  brands: ['brands'] as const,
  stats: ['stats'] as const,
  generation: (id: string) => ['generation', id] as const,
  history: (params: object) => ['history', params] as const,
  library: (params: object) => ['library', params] as const,
  libraryTags: ['library-tags'] as const,
  aiSettings: ['ai-settings'] as const,
}

// --- Setup & account ---------------------------------------------------------------
export const useSetupStatus = () =>
  useQuery({ queryKey: keys.setup, queryFn: () => api<SetupStatus>('/setup/status'), staleTime: 0 })

export const useSession = (enabled = true) =>
  useQuery({ queryKey: keys.session, queryFn: () => api<Session>('/auth/session'), enabled, retry: false })

function useAuthMutation<TInput>(path: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TInput) => api<Session>(path, { method: 'POST', body: input }),
    onSuccess: (session) => {
      qc.setQueryData(keys.session, session)
      void qc.invalidateQueries({ queryKey: keys.setup })
    },
  })
}

export const useSignup = () => useAuthMutation<SignupInput>('/auth/signup')
export const useLogin = () => useAuthMutation<{ email: string; password: string }>('/auth/login')

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      qc.clear()
    },
  })
}

export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (brand: BrandInput | null) =>
      api<Workspace>('/setup/complete', { method: 'POST', body: brand ? { brand } : {} }),
    onSuccess: (workspace) => {
      qc.setQueryData<Session>(keys.session, (s) => (s ? { ...s, workspace } : s))
      // Update synchronously so the app gate lets the customer straight in.
      qc.setQueryData<SetupStatus>(keys.setup, (s) => (s ? { ...s, onboarding_completed: true } : s))
      void qc.invalidateQueries({ queryKey: keys.brands })
    },
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Pick<Workspace, 'name' | 'preferences' | 'active_brand_id'>>) =>
      api<Workspace>('/workspace', { method: 'PATCH', body: input }),
    onSuccess: (workspace) => {
      qc.setQueryData<Session>(keys.session, (s) => (s ? { ...s, workspace } : s))
      void qc.invalidateQueries({ queryKey: keys.brands })
    },
  })
}

export const useCatalog = () =>
  useQuery({ queryKey: keys.catalog, queryFn: () => api<Catalog>('/catalog'), staleTime: Infinity })

export const useStats = () =>
  useQuery({ queryKey: keys.stats, queryFn: () => api<Stats>('/workspace/stats') })

// --- Brands -------------------------------------------------------------------------
export const useBrands = (enabled = true) =>
  useQuery({ queryKey: keys.brands, queryFn: () => api<Brand[]>('/brands'), enabled })

function useBrandMutation<TInput>(fn: (input: TInput) => Promise<Brand | void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.brands })
      void qc.invalidateQueries({ queryKey: keys.session })
    },
  })
}

export const useCreateBrand = () =>
  useBrandMutation((input: BrandInput) => api<Brand>('/brands', { method: 'POST', body: input }))
export const useUpdateBrand = () =>
  useBrandMutation(({ id, ...input }: Partial<BrandInput> & { id: string }) =>
    api<Brand>(`/brands/${id}`, { method: 'PATCH', body: input }),
  )
export const useActivateBrand = () =>
  useBrandMutation((id: string) => api<Brand>(`/brands/${id}/activate`, { method: 'POST' }))
export const useDeleteBrand = () =>
  useBrandMutation((id: string) => api<void>(`/brands/${id}`, { method: 'DELETE' }))

// --- Generation -----------------------------------------------------------------------
export function useGenerate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateInput) => api<Generation>('/generations', { method: 'POST', body: input }),
    onSuccess: (generation) => {
      qc.setQueryData(keys.generation(generation.id), generation)
      void qc.invalidateQueries({ queryKey: ['history'] })
      void qc.invalidateQueries({ queryKey: keys.stats })
    },
    onError: () => void qc.invalidateQueries({ queryKey: ['history'] }),
  })
}

export const useGeneration = (id: string | undefined) =>
  useQuery({
    queryKey: keys.generation(id ?? ''),
    queryFn: () => api<Generation>(`/generations/${id}`),
    enabled: Boolean(id),
  })

export const useHistory = (params: {
  content_type?: string
  brand_id?: string
  q?: string
  limit?: number
  offset?: number
}) =>
  useQuery({
    queryKey: keys.history(params),
    queryFn: () => api<Page<GenerationSummary>>('/generations', { query: params }),
    placeholderData: keepPreviousData,
  })

export function useDeleteGeneration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/generations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['history'] })
      void qc.invalidateQueries({ queryKey: keys.stats })
    },
  })
}

/** Writes an updated item back into its cached generation. */
function useItemCacheUpdate() {
  const qc = useQueryClient()
  return (item: ContentItem) =>
    qc.setQueryData<Generation>(keys.generation(item.generation_id), (g) =>
      g ? { ...g, items: g.items.map((i) => (i.id === item.id ? item : i)) } : g,
    )
}

export function useUpdateItem() {
  const update = useItemCacheUpdate()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api<ContentItem>(`/items/${id}`, { method: 'PATCH', body: { data } }),
    onSuccess: update,
  })
}

export function useRegenerateField() {
  const update = useItemCacheUpdate()
  return useMutation({
    mutationFn: ({ id, field, instruction = '' }: { id: string; field: string; instruction?: string }) =>
      api<ContentItem>(`/items/${id}/regenerate`, { method: 'POST', body: { field, instruction } }),
    onSuccess: update,
  })
}

// --- Library ---------------------------------------------------------------------------
export const useLibrary = (params: LibraryQuery) =>
  useQuery({
    queryKey: keys.library(params),
    queryFn: () => {
      const { since_days, ...rest } = params
      const date_from = since_days ? new Date(Date.now() - since_days * 86_400_000).toISOString() : undefined
      return api<Page<SavedContent>>('/library', { query: { ...rest, date_from } })
    },
    placeholderData: keepPreviousData,
  })

export const useLibraryTags = () =>
  useQuery({ queryKey: keys.libraryTags, queryFn: () => api<string[]>('/library/tags') })

function useLibraryMutation<TInput, TOutput>(fn: (input: TInput) => Promise<TOutput>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['library'] })
      void qc.invalidateQueries({ queryKey: keys.libraryTags })
      void qc.invalidateQueries({ queryKey: keys.stats })
      void qc.invalidateQueries({ queryKey: ['generation'] })
    },
  })
}

export const useSaveItem = () =>
  useLibraryMutation((input: { item_id: string; tags?: string[]; is_favourite?: boolean }) =>
    api<SavedContent>('/library', { method: 'POST', body: input }),
  )
export const useUpdateSaved = () =>
  useLibraryMutation(
    ({
      id,
      ...input
    }: { id: string } & Partial<Pick<SavedContent, 'title' | 'tags' | 'notes' | 'is_favourite' | 'data'>>) =>
      api<SavedContent>(`/library/${id}`, { method: 'PATCH', body: input }),
  )
export const useDeleteSaved = () =>
  useLibraryMutation((id: string) => api<void>(`/library/${id}`, { method: 'DELETE' }))

// --- AI settings ----------------------------------------------------------------------
export const useAISettings = () =>
  useQuery({ queryKey: keys.aiSettings, queryFn: () => api<AISettings>('/settings/ai') })

export function useSaveConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ConnectionInput) =>
      api<ProviderConnection>('/settings/ai/connections', { method: 'PUT', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.aiSettings }),
  })
}

export function useDeleteConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (provider: string) => api<void>(`/settings/ai/connections/${provider}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.aiSettings })
      void qc.invalidateQueries({ queryKey: keys.session })
    },
  })
}

export function useSetAISource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { ai_source: 'platform' | 'custom'; provider?: string | null }) =>
      api<AISettings>('/settings/ai/source', { method: 'PUT', body: input }),
    onSuccess: (settings) => {
      qc.setQueryData(keys.aiSettings, settings)
      void qc.invalidateQueries({ queryKey: keys.session })
    },
  })
}

export const useTestConnection = () =>
  useMutation({
    mutationFn: (input: ConnectionInput) =>
      api<TestConnectionResult>('/settings/ai/test', { method: 'POST', body: input }),
  })
