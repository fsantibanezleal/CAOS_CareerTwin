import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import { Login } from './Login'

it('presents an invite-only private workspace rather than public registration', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><I18nProvider initial="en"><Login onSuccess={() => undefined} /></I18nProvider></QueryClientProvider>)
  expect(screen.getByRole('heading', { name: 'See your career as a living system.' })).toBeInTheDocument()
  expect(screen.getByText(/There is no public registration/)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument()
})
