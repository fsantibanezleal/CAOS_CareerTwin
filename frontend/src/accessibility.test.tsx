import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { expect, it } from 'vitest'
import { Login } from './components/Login'
import { Shell } from './components/Shell'
import { I18nProvider } from './i18n'
import { MemoryRouter } from 'react-router'
import type { User } from './types'

it('has no automatically detectable serious or critical login violations', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(
    <QueryClientProvider client={client}>
      <I18nProvider initial="en"><Login onSuccess={() => undefined} /></I18nProvider>
    </QueryClientProvider>,
  )
  expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
  const result = await axe.run(container)
  const blocking = result.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([])
})

it('has no automatically detectable serious or critical authenticated-shell violations', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const user: User = { id: 'synthetic-user', email: 'seeker@example.invalid', display_name: 'Synthetic Seeker', is_active: true, is_superuser: false, locale: 'en', theme: 'dark', must_change_password: false }
  const { container } = render(
    <QueryClientProvider client={client}>
      <MemoryRouter><I18nProvider initial="en"><Shell user={user} onLogout={() => undefined}><h1>Career workspace</h1></Shell></I18nProvider></MemoryRouter>
    </QueryClientProvider>,
  )
  const result = await axe.run(container)
  const blocking = result.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([])
})
