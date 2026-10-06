import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { api, ApiError } from './client'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('api client', () => {
  it('sends the CSRF header and JSON body', async () => {
    let headers: Headers | undefined
    server.use(
      http.post('*/api/v1/brands', async ({ request }) => {
        headers = request.headers
        return HttpResponse.json({ received: await request.json() })
      }),
    )
    const result = await api<{ received: unknown }>('/brands', { method: 'POST', body: { name: 'X' } })
    expect(result.received).toEqual({ name: 'X' })
    expect(headers?.get('x-requested-with')).toBe('reelcraft')
  })

  it('turns API errors into friendly ApiErrors with field errors', async () => {
    server.use(
      http.post('*/api/v1/auth/signup', () =>
        HttpResponse.json(
          {
            error: {
              code: 'validation_error',
              title: 'Please check the highlighted fields',
              message: 'Enter a valid email address.',
              retryable: false,
              details: { errors: [{ field: 'email', message: 'Enter a valid email address.' }] },
            },
          },
          { status: 422 },
        ),
      ),
    )
    const error = await api('/auth/signup', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).title).toBe('Please check the highlighted fields')
    expect((error as ApiError).fieldErrors).toEqual({ email: 'Enter a valid email address.' })
  })

  it('never shows raw HTTP errors for unexpected responses', async () => {
    server.use(
      http.get('*/api/v1/catalog', () => new HttpResponse('<html>502 Bad Gateway</html>', { status: 502 })),
    )
    const error = (await api('/catalog').catch((e: unknown) => e)) as ApiError
    expect(error.title).toBe('Something went wrong on our side')
    expect(error.message).not.toContain('502')
  })

  it('reports network failures in plain language', async () => {
    server.use(http.get('*/api/v1/catalog', () => HttpResponse.error()))
    const error = (await api('/catalog').catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe('network_error')
    expect(error.title).toBe("We couldn't reach ReelCraft")
  })

  it('omits empty query parameters', async () => {
    let url = ''
    server.use(
      http.get('*/api/v1/library', ({ request }) => {
        url = request.url
        return HttpResponse.json({ items: [] })
      }),
    )
    await api('/library', { query: { q: '', favourites: false, content_type: 'reel', limit: 24 } })
    expect(new URL(url).search).toBe('?content_type=reel&limit=24')
  })
})
