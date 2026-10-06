/**
 * Critical customer workflows rendered through the real app (router, query cache,
 * components) against an in-memory API.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import App from '@/App'
import type { Brand } from '@/lib/api/types'
import { createQueryClient } from '@/lib/query-client'
import { createMockApi } from './mock-api'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderAt(path: string, api: ReturnType<typeof createMockApi>) {
  server.use(...api.handlers)
  window.history.pushState({}, '', path)
  return render(<App queryClient={createQueryClient()} />)
}

const BRAND: Brand = {
  id: 'b1',
  name: 'Bloom & Brew',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  industry: 'Café',
  description: 'Neighbourhood café',
  products_services: '',
  target_audience: 'Locals',
  location: 'Melbourne',
  tone_of_voice: 'playful',
  personality: '',
  content_pillars: ['coffee'],
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

describe('first launch', () => {
  it('walks a new customer from welcome to their first post', async () => {
    const user = userEvent.setup()
    const api = createMockApi()
    renderAt('/', api)

    // No account yet → the setup wizard opens automatically.
    expect(await screen.findByRole('heading', { name: 'Welcome to ReelCraft' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /get started/i }))

    await user.type(await screen.findByLabelText('Your name'), 'Alex')
    await user.type(screen.getByLabelText('Business or workspace name'), 'Bloom & Brew')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Password'), 'Sup3r-secret!')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('heading', { name: 'Tell us about your brand' })).toBeInTheDocument()
    expect(screen.getByLabelText('Business or brand name')).toHaveValue('Bloom Studio')
    await user.clear(screen.getByLabelText('Business or brand name'))
    await user.type(screen.getByLabelText('Business or brand name'), 'Bloom & Brew')
    await user.click(screen.getByRole('radio', { name: 'Playful' }))
    await user.click(screen.getByRole('button', { name: '+ Community' }))
    await user.click(screen.getByRole('button', { name: /save brand/i }))

    // Hosted AI is included — nothing technical to configure.
    expect(await screen.findByRole('heading', { name: 'AI is ready to go' })).toBeInTheDocument()
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await user.click(await screen.findByRole('button', { name: /create my first post/i }))
    expect(await screen.findByRole('heading', { name: 'Reel Studio' })).toBeInTheDocument()

    const brandRequest = api.state.requests.find((r) => r.path === '/api/v1/brands')
    expect(brandRequest?.body).toMatchObject({
      name: 'Bloom & Brew',
      tone_of_voice: 'playful',
      content_pillars: ['Community'],
    })
    expect(api.state.onboarded).toBe(true)
  })

  it('sends returning signed-out customers to sign in', async () => {
    renderAt('/library', createMockApi({ hasUser: true }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })
})

describe('creating content', () => {
  const ready = () => createMockApi({ hasUser: true, authenticated: true, onboarded: true, brands: [BRAND] })

  it('generates Reels with Auto quality and shows distinct variations', async () => {
    const user = userEvent.setup()
    const api = ready()
    renderAt('/create/reel', api)

    const topic = await screen.findByLabelText('What should it be about?')
    await user.type(topic, 'Our pumpkin latte is back')
    await user.click(screen.getByRole('radio', { name: '45 sec' }))
    await user.click(screen.getByRole('button', { name: /create reels/i }))

    expect(await screen.findByRole('tab', { name: /option a · conversational/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /option b · curiosity/i })).toBeInTheDocument()
    expect(screen.getByText('Hook number 1')).toBeInTheDocument()

    const sent = api.state.requests.find((r) => r.path === '/api/v1/generations')?.body
    expect(sent).toMatchObject({
      content_type: 'reel',
      topic: 'Our pumpkin latte is back',
      quality: 'auto',
      brand_id: 'b1',
      variations: 3,
      options: { reel_duration: 45 },
    })

    await user.click(screen.getByRole('tab', { name: /option b/i }))
    expect(await screen.findByText('Hook number 2')).toBeInTheDocument()
  })

  it('regenerates a single component and saves to the library', async () => {
    const user = userEvent.setup()
    const api = ready()
    renderAt('/create/reel', api)
    await user.type(await screen.findByLabelText('What should it be about?'), 'Autumn menu launch')
    await user.click(screen.getByRole('button', { name: /create reels/i }))
    await screen.findByText('Hook number 1')

    await user.click(screen.getByRole('button', { name: 'Regenerate Hook' }))
    await user.type(await screen.findByLabelText('Direction for the new version'), 'Make it a question')
    await user.click(screen.getByRole('button', { name: /^regenerate$/i }))
    expect(await screen.findByText('Fresh hook')).toBeInTheDocument()
    // Everything else is untouched.
    expect(screen.getByText('Autumn in a cup.')).toBeInTheDocument()
    expect(api.state.requests.find((r) => r.path.endsWith('/regenerate'))?.body).toEqual({
      field: 'hook',
      instruction: 'Make it a question',
    })

    await user.click(screen.getByRole('button', { name: 'Save to library' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /saved — update library copy/i })).toBeInTheDocument(),
    )
  })

  it('lets customers edit a component inline', async () => {
    const user = userEvent.setup()
    const api = ready()
    renderAt('/create/reel', api)
    await user.type(await screen.findByLabelText('What should it be about?'), 'Autumn menu launch')
    await user.click(screen.getByRole('button', { name: /create reels/i }))
    await screen.findByText('Hook number 1')

    await user.click(screen.getByRole('button', { name: 'Edit Call to action' }))
    const section = screen.getByRole('region', { name: 'Call to action' })
    const input = within(section).getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Visit us this weekend')
    await user.click(within(section).getByRole('button', { name: /save/i }))
    expect(await screen.findByText('Visit us this weekend')).toBeInTheDocument()
  })

  it('shows a friendly, actionable error when the AI fails', async () => {
    const user = userEvent.setup()
    const api = ready()
    renderAt('/create/caption', api)
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.post('*/api/v1/generations', () =>
        HttpResponse.json(
          {
            error: {
              code: 'ai_auth_failed',
              title: "We couldn't connect to your AI provider",
              message: 'Check your API key and try again.',
              retryable: false,
              details: { status: 401 },
            },
          },
          { status: 502 },
        ),
      ),
    )
    await user.type(await screen.findByLabelText('What should it be about?'), 'Weekend special')
    await user.click(screen.getByRole('button', { name: /write captions/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("We couldn't connect to your AI provider")
    expect(alert).toHaveTextContent('Check your API key and try again.')
    expect(alert).not.toHaveTextContent('401')
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
