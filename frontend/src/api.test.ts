import { api, json } from './api'
import { describe, expect, it, vi } from 'vitest'

describe('API browser boundary', () => {
  it('adds the CSRF token to state-changing requests', async () => {
    document.cookie = 'ct_csrf=review-token; Path=/'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await api('/api/profile', json('PUT', { revision: 1 }))
    const request = fetchMock.mock.calls[0]
    expect(request).toBeDefined()
    const options = request?.[1]
    expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('review-token')
    expect(options?.credentials).toBe('include')
  })

  it('does not add CSRF material to reads', async () => {
    document.cookie = 'ct_csrf=review-token; Path=/'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await api('/api/profile')
    const options = fetchMock.mock.calls[0]?.[1]
    expect(new Headers(options?.headers).has('X-CSRF-Token')).toBe(false)
  })
})
