import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../api'
import { I18nProvider } from '../i18n'
import { CareerStrategy, type StrategyResponse } from './CareerStrategy'

vi.mock('../api', () => ({ api: vi.fn(), json: (method: string, value: unknown) => ({ method, body: JSON.stringify(value) }) }))
const mocked = vi.mocked(api)
afterEach(cleanup)
const value: StrategyResponse = {
  revision: 3, strategy: { current_role: 'Programme leader', target_titles: [], location: '', modalities: [], currency: 'CLP', basis: 'gross', period: 'month', current_fixed: 100, minimum_move: null, desired_uplift_percent: 25, transition_cost: 0, positioning: '', evidence_priorities: [], market_references: [] },
  comparison: { threshold: 125, currency: 'CLP', basis: 'gross', period: 'month', status: 'not_compared', notes: [], uplift_low_percent: null, uplift_high_percent: null, offer_low: null, offer_high: null },
}
beforeEach(() => {
  mocked.mockReset()
  mocked.mockImplementation(async (path, options) => path.endsWith('/compare') ? { ...value.comparison, status: 'benchmark_only', offer_low: 140, notes: ['This is market research, not an actual offer or a justified move.'] } : options?.method === 'PUT' ? { ...value, revision: 4, strategy: JSON.parse(String(options.body)).strategy } : value)
})
function mount(locale: 'en' | 'es' = 'en') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><I18nProvider initial={locale}><CareerStrategy /></I18nProvider></QueryClientProvider>)
}
it('edits private strategy without rewriting canonical experience and supports multiline targets', async () => {
  const { container } = mount()
  await screen.findByLabelText('Current role')
  const targets = screen.getByLabelText('Target roles, one per line')
  fireEvent.change(targets, { target: { value: 'Head of Data\n' } })
  expect(targets).toHaveValue('Head of Data\n')
  fireEvent.change(targets, { target: { value: 'Head of Data\nHead of Analytics' } })
  const result = await axe.run(container)
  expect(result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Save career strategy' }))
  await waitFor(() => expect(mocked.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true))
  const [path, options] = mocked.mock.calls.find(([, request]) => request?.method === 'PUT')!
  expect(path).toBe('/api/job-search/strategy')
  expect(JSON.parse(String(options?.body))).toMatchObject({ revision: 3, strategy: { target_titles: ['Head of Data', 'Head of Analytics'] } })
})
it('keeps benchmarks separate from employer offers and clears stale comparisons after edits', async () => {
  mount()
  await screen.findByLabelText('Salary evidence type')
  fireEvent.change(screen.getByLabelText('Salary evidence type'), { target: { value: 'benchmark' } })
  fireEvent.change(screen.getByLabelText('Offer basis'), { target: { value: 'gross' } })
  fireEvent.change(screen.getByLabelText('Offer period'), { target: { value: 'month' } })
  fireEvent.change(screen.getByLabelText('Offer fixed minimum'), { target: { value: '140' } })
  fireEvent.click(screen.getByRole('button', { name: 'Compare fixed pay' }))
  await screen.findByRole('heading', { name: 'Market benchmark only' })
  expect(screen.getByText('This is market research, not an actual offer or a justified move.')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Current fixed pay'), { target: { value: '150' } })
  expect(screen.queryByRole('heading', { name: 'Market benchmark only' })).not.toBeInTheDocument()
})
it('shows Spanish private strategy labels', async () => {
  mount('es')
  await screen.findByLabelText('Cargo actual')
  expect(screen.getByRole('button', { name: 'Guardar estrategia profesional' })).toBeVisible()
})
it('edits attributed research through labelled fields instead of requiring raw JSON', async () => {
  mount()
  await screen.findByLabelText('Current role')
  fireEvent.click(screen.getByText('Attributed salary research'))
  fireEvent.click(screen.getByRole('button', { name: 'Add research reference' }))
  fireEvent.change(screen.getByLabelText('Reference label'), { target: { value: 'Synthetic market research' } })
  fireEvent.change(screen.getByLabelText('Public source URL'), { target: { value: 'https://example.com/research' } })
  fireEvent.change(screen.getByLabelText('Date checked'), { target: { value: '2026-10-04' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save career strategy' }))
  await waitFor(() => expect(mocked.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true))
  const payload = JSON.parse(String(mocked.mock.calls.find(([, request]) => request?.method === 'PUT')?.[1]?.body))
  expect(payload.strategy.market_references[0]).toMatchObject({ source_url: 'https://example.com/research', basis: 'unspecified', period: 'unspecified', low: null, high: null })
})
