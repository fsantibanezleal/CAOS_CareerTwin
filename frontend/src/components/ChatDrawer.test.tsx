import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { ChatDrawer } from './ChatDrawer'

function response(value: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('durable career copilot history', () => {
  it('loads a saved conversation and starts a fresh one without deleting the server copy', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/agent/providers') {
        return response({ providers: [], default: null, mode: 'external-only', configured: false, voice: { available: false, provider: 'xai', model: 'grok-voice-latest' } })
      }
      if (path === '/api/agent/conversations') {
        return response([{ id: 'conversation-1', title: 'Target role review', updated_at: '2026-08-03T00:00:00Z' }])
      }
      if (path === '/api/agent/conversations/conversation-1/messages') {
        return response([{ role: 'assistant', content: 'Saved evidence review' }])
      }
      throw new Error(`Unexpected request: ${path}`)
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <I18nProvider initial="en"><ChatDrawer open onClose={() => undefined} /></I18nProvider>
      </QueryClientProvider>,
    )

    await screen.findByRole('option', { name: 'Target role review' })
    fireEvent.change(screen.getByLabelText('Conversation history'), { target: { value: 'conversation-1' } })
    expect(await screen.findByText('Saved evidence review')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))
    await waitFor(() => expect(screen.queryByText('Saved evidence review')).not.toBeInTheDocument())
    expect(screen.getByText('What are you working toward?')).toBeInTheDocument()
  })
})
