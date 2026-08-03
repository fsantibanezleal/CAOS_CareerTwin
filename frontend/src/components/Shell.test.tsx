import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
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
  it('preserves CareerTwin navigation, product controls, content landmark, and overlays', () => {
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
  })
})
