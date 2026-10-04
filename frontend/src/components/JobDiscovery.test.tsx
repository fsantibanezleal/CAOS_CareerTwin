import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../api'
import { I18nProvider } from '../i18n'
import { JobDiscovery, type JobSearchPage } from './JobDiscovery'

vi.mock('../api', () => ({ api: vi.fn(), json: (method: string, value: unknown) => ({ method, body: JSON.stringify(value) }) }))
const mocked = vi.mocked(api)
afterEach(cleanup)
const page: JobSearchPage = {
  provider: 'himalayas', cached: false, retrieved_at: '2026-10-03T12:00:00Z', skipped_records: 0,
  has_more: true, next_page: 2, next_cursor: null,
  jobs: [{ key: 'synthetic', provider: 'himalayas', title: 'Analytics Lead', employer: 'Synthetic Research',
    source_url: 'https://himalayas.app/companies/synthetic/jobs/analytics-lead', excerpt: 'Own analytics',
    description: 'Lead delivery.\nPython required.', locations: ['Chile'], timezones: ['-4'], seniority: ['Manager'],
    employment_type: ['Full Time'], categories: ['Data'], salary_min: 90000, salary_max: 120000,
    currency: 'USD', salary_period: 'annual', published_at: '2026-10-03T12:00:00Z', expires_at: null,
    retrieved_at: '2026-10-03T12:00:00Z', import_ticket: 'synthetic-ticket', saved_opportunity_id: null }],
}

beforeEach(() => {
  mocked.mockReset()
  mocked.mockImplementation(async (path) => {
    if (path.endsWith('/catalog')) return { jobicy_locations: [{ value: 'latam', label: 'LATAM' }], jobicy_locations_error: null }
    if (path.endsWith('/presets')) return []
    if (path.endsWith('/import')) return { created: true, opportunity: { id: 'saved-role' } }
    return page
  })
})

function mount(locale: 'en' | 'es' = 'en') {
  const onImported = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return { onImported, ...render(<QueryClientProvider client={client}><I18nProvider initial={locale}><JobDiscovery onImported={onImported} /></I18nProvider></QueryClientProvider>) }
}

it('searches only on explicit action, previews attribution, and saves only the signed reference', async () => {
  const { onImported, container } = mount()
  await screen.findByText('Find your next opportunity')
  expect(mocked.mock.calls.every(([path]) => path !== '/api/job-search')).toBe(true)
  fireEvent.change(screen.getByLabelText('Keywords'), { target: { value: 'analytics' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search job offers' }))
  await screen.findByRole('heading', { name: 'Analytics Lead' })
  expect(screen.getByRole('link', { name: 'Original listing' })).toHaveAttribute('href', page.jobs[0]?.source_url)
  expect(screen.getByText(/Remote does not mean eligible everywhere/)).toBeVisible()
  expect(mocked.mock.calls.filter(([path]) => path.endsWith('/import'))).toHaveLength(0)
  const result = await axe.run(container)
  expect(result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Save for review' }))
  await waitFor(() => expect(onImported).toHaveBeenCalledWith('saved-role'))
  const request = mocked.mock.calls.find(([path]) => path.endsWith('/import'))?.[1]
  expect(JSON.parse(String(request?.body))).toEqual({ ticket: 'synthetic-ticket' })
})

it('preserves original filters when navigating provider pages', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('Keywords'), { target: { value: 'director' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search job offers' }))
  await screen.findByRole('heading', { name: 'Analytics Lead' })
  fireEvent.click(screen.getByRole('button', { name: 'Next results page' }))
  await waitFor(() => expect(mocked.mock.calls.filter(([path]) => path === '/api/job-search')).toHaveLength(2))
  const last = mocked.mock.calls.filter(([path]) => path === '/api/job-search').at(-1)
  expect(JSON.parse(String(last?.[1]?.body))).toEqual({ provider: 'himalayas', query: 'director', sort: 'recent', page: 2, cursor: '' })
})

it('distinguishes an unavailable provider from an empty result', async () => {
  mocked.mockImplementation(async (path) => {
    if (path === '/api/job-search') throw new Error('Job source is unavailable. Try again later.')
    return path.endsWith('/catalog') ? { jobicy_locations: [], jobicy_locations_error: null } : []
  })
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Search job offers' }))
  await screen.findByText('Job source is unavailable. Try again later.')
  expect(screen.queryByText('No offers found for these filters')).not.toBeInTheDocument()
})

it('renders Spanish controls without exporting a profile', async () => {
  mount('es')
  await screen.findByRole('button', { name: 'Buscar ofertas de trabajo' })
  expect(screen.getByLabelText('Palabras clave')).toBeVisible()
  expect(screen.getByText(/tu perfil y documentos no/)).toBeVisible()
})
