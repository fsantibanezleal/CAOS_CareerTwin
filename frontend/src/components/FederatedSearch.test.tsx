import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../api'
import { I18nProvider } from '../i18n'
import { mergeBattery } from '../jobBattery'
import { JobDiscovery } from './JobDiscovery'
import type { BatteryPage } from './FederatedSearch'

vi.mock('../api', () => ({ api: vi.fn(), json: (method: string, value: unknown) => ({ method, body: JSON.stringify(value) }) }))
const mocked = vi.mocked(api)
afterEach(cleanup)
const page: BatteryPage = {
  jobs: [{ key: 'synthetic', provider: 'getonbrd', title: 'Head of Analytics', employer: 'Synthetic', source_url: 'https://www.getonbrd.com/jobs/synthetic', excerpt: 'Lead programmes.', description: 'Own analytics programmes. Python required.', locations: ['Chile'], timezones: [], seniority: [], employment_type: [], categories: [], salary_min: null, salary_max: null, currency: 'USD', salary_period: '', salary_basis: '', remote_mode: 'hybrid', published_at: null, expires_at: null, retrieved_at: '2026-10-04T00:00:00Z', import_ticket: 'synthetic-ticket', saved_opportunity_id: null }],
  coverage: [{ query_id: 'gob', search: { provider: 'getonbrd', query: 'Head', country: 'CL' }, status: 'ok', found: 1, source_count: 1, skipped_records: 0, cached: false, error: '', next_search: { provider: 'getonbrd', query: 'Head', country: 'CL', page: 2 } }, { query_id: 'jobicy', search: { provider: 'jobicy', query: 'Head' }, status: 'error', found: 0, source_count: 0, skipped_records: 0, cached: false, error: 'Source unavailable', next_search: null }],
  provenance: { synthetic: ['gob'] }, partial: true, retrieved_at: '2026-10-04T00:00:00Z',
}
beforeEach(() => {
  mocked.mockReset()
  mocked.mockImplementation(async (path) => {
    if (path.endsWith('/catalog')) return { jobicy_locations: [{ value: 'latam', label: 'LATAM' }], jobicy_locations_error: null }
    if (path.endsWith('/batteries') || path.endsWith('/presets')) return []
    if (path.endsWith('/import')) return { opportunity: { id: 'saved' } }
    if (path.includes('/research-links')) return [{ name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/search/?keywords=Head' }]
    return page
  })
})
function mount(locale: 'en' | 'es' = 'en') {
  const onImported = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return { onImported, ...render(<QueryClientProvider client={client}><I18nProvider initial={locale}><JobDiscovery onImported={onImported} /></I18nProvider></QueryClientProvider>) }
}
it('defaults to all three sources and sends only explicit public terms', async () => {
  const { container, onImported } = mount()
  await screen.findByText('Find your next opportunity')
  expect(mocked.mock.calls.some(([path]) => path.endsWith('/battery'))).toBe(false)
  fireEvent.change(screen.getByLabelText('Search terms, one per line'), { target: { value: 'Head\nAnalytics' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search all selected sources' }))
  await screen.findByRole('heading', { name: 'Head of Analytics' })
  const payload = JSON.parse(String(mocked.mock.calls.find(([path]) => path.endsWith('/battery'))?.[1]?.body))
  expect(payload.searches).toHaveLength(6)
  expect(new Set(payload.searches.map((value: { provider: string }) => value.provider))).toEqual(new Set(['getonbrd', 'himalayas', 'jobicy']))
  expect(Object.keys(payload)).toEqual(['title_only', 'searches'])
  expect(screen.getByText('Source unavailable')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Original listing' })).toHaveAttribute('href', page.jobs[0]?.source_url)
  const result = await axe.run(container)
  expect(result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Save for review' }))
  await waitFor(() => expect(onImported).toHaveBeenCalledWith('saved'))
  expect(JSON.parse(String(mocked.mock.calls.find(([path]) => path.endsWith('/import'))?.[1]?.body))).toEqual({ ticket: 'synthetic-ticket' })
})
it('continues a single query without discarding other source results', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Search all selected sources' }))
  await screen.findByRole('heading', { name: 'Head of Analytics' })
  fireEvent.click(screen.getByRole('button', { name: 'More from this query' }))
  await waitFor(() => expect(mocked.mock.calls.filter(([path]) => path.endsWith('/battery'))).toHaveLength(2))
  const request = mocked.mock.calls.filter(([path]) => path.endsWith('/battery')).at(-1)
  expect(JSON.parse(String(request?.[1]?.body)).searches).toEqual([page.coverage[0]?.next_search])
  const next = { ...page, jobs: [{ ...page.jobs[0]!, key: 'second', source_url: 'https://www.getonbrd.com/jobs/second' }], coverage: [page.coverage[0]!] }
  expect(mergeBattery(page, next).jobs).toHaveLength(2)
  expect(mergeBattery(page, next).partial).toBe(true)
})
it('rejects oversized batteries locally and prepares external research only on request', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('Search terms, one per line'), { target: { value: '1\n2\n3\n4\n5\n6\n7' } })
  expect(screen.getByRole('button', { name: 'Search all selected sources' })).toBeDisabled()
  expect(mocked.mock.calls.some(([path]) => path.includes('/research-links'))).toBe(false)
  fireEvent.click(screen.getByText('Additional sites and employer research'))
  fireEvent.click(screen.getByRole('button', { name: 'Prepare links using the first query' }))
  await screen.findByRole('link', { name: 'LinkedIn' })
})
it('renders Spanish battery controls and preserves legacy single-source searches', async () => {
  mount('es')
  await screen.findByRole('button', { name: 'Buscar en todas las fuentes seleccionadas' })
  fireEvent.click(screen.getByRole('button', { name: 'Una fuente' }))
  await screen.findByLabelText('Palabras clave')
})
it('does not describe total source failure as an empty market', async () => {
  mocked.mockImplementation(async (path) => path.endsWith('/catalog') ? { jobicy_locations: [], jobicy_locations_error: null } : path.endsWith('/batteries') ? [] : { ...page, jobs: [], coverage: page.coverage.map((item) => ({ ...item, status: 'error', next_search: null, found: 0 })) })
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Search all selected sources' }))
  await screen.findByRole('heading', { name: 'Search sources unavailable' })
  expect(screen.queryByText('No offers found for these filters')).not.toBeInTheDocument()
  expect(mocked.mock.calls.some(([path]) => path.endsWith('/import'))).toBe(false)
})
it('loads an irregular saved battery without changing its exact filters or submitting automatically', async () => {
  const battery = { title_only: true, searches: [{ provider: 'getonbrd', query: 'Head', country: 'CL' }, { provider: 'himalayas', query: 'Director', worldwide: true }] }
  mocked.mockImplementation(async (path) => path.endsWith('/catalog') ? { jobicy_locations: [], jobicy_locations_error: null } : path.endsWith('/batteries') ? [{ id: 'private', name: 'Private targets', battery }] : page)
  mount()
  await screen.findByRole('option', { name: 'Private targets' })
  fireEvent.click(screen.getByText(/Saved search batteries/))
  fireEvent.change(screen.getByLabelText('Use a saved battery'), { target: { value: 'private' } })
  expect(mocked.mock.calls.some(([path]) => path.endsWith('/battery'))).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Search all selected sources' }))
  await screen.findByRole('heading', { name: 'Head of Analytics' })
  expect(JSON.parse(String(mocked.mock.calls.find(([path]) => path.endsWith('/battery'))?.[1]?.body))).toEqual(battery)
})
