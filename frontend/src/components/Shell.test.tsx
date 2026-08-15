import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import type { User } from '../types'
import { Shell } from './Shell'

const user: User = {
  id: 'synthetic-user',
  email: 'seeker@example.invalid',
  display_name: 'Synthetic Seeker',
  is_active: true,
  is_superuser: false,
  locale: 'en',
  theme: 'dark',
  must_change_password: false,
}

describe('shared authenticated workbench shell', () => {
  it('preserves CareerTwin navigation, responsive preferences, keyboard access, and overlays', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if ((init?.method ?? 'GET') !== 'PATCH') {
        const path = String(_input)
        const payload = path.endsWith('/api/agent/providers')
          ? { providers: [], configured: false, default: null, voice: { available: false } }
          : []
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const preferences = JSON.parse(String(init?.body ?? '{}')) as Partial<User>
      return new Response(JSON.stringify({ ...user, ...preferences }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/profile']}>
          <I18nProvider initial="en">
            <Shell user={user} onLogout={() => undefined}><h1>Profile evidence</h1></Shell>
          </I18nProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(container.querySelector('.caos-workbench-shell')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('button', { name: /Search or ask CareerTwin/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Career copilot/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /System architecture/i })).toBeInTheDocument()
    expect(screen.getByText('Profile evidence')).toBeInTheDocument()
    const account = screen.getByRole('button', { name: 'Account menu' })
    expect(account).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(account)
    expect(account).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Use light theme' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    fireEvent.click(account)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to Spanish' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Menú de cuenta' })).toBeInTheDocument())
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Menú de cuenta' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Menú de cuenta' })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(container.querySelector('.chat-drawer')).toHaveClass('open')
    fetchMock.mockRestore()
  })
})
