import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import type { Landscape, MatchRun, ProfileGraphData } from '../types'
import { CareerRiver, MatchWaterfall, OpportunityLandscape, ProfileConstellation } from './Visualizations'

const captureSigmaSettings = vi.hoisted(() => vi.fn())

vi.mock('./EChart', () => ({
  EChart: ({ ariaLabel }: { ariaLabel: string }) => <div role="img" aria-label={ariaLabel} />,
}))
vi.mock('@react-sigma/core', () => ({
  SigmaContainer: ({ children, settings }: { children: React.ReactNode; settings: Record<string, unknown> }) => {
    captureSigmaSettings(settings)
    return <>{children}</>
  },
  useLoadGraph: () => vi.fn(),
  useRegisterEvents: () => vi.fn(),
  useSetSettings: () => vi.fn(),
  useSigma: () => ({
    getGraph: () => ({ neighbors: vi.fn(() => []), extremities: vi.fn(() => []) }),
    getCamera: () => ({ animatedReset: vi.fn() }),
    refresh: vi.fn(),
  }),
}))

function renderEnglish(node: React.ReactNode) {
  return render(<I18nProvider initial="en">{node}</I18nProvider>)
}

describe('decision-grade visual fallbacks', () => {
  it('keeps Sigma labels, edges, and hover rendering readable across themes', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    document.documentElement.dataset.theme = 'dark'
    renderEnglish(<ProfileConstellation data={{
      nodes: [{ id: 'profile-1', label: 'Profile', type: 'profile' }, { id: 'skill-1', label: 'Python', type: 'skill' }],
      edges: [{ id: 'edge-1', source: 'profile-1', target: 'skill-1', type: 'has_skill' }],
    }} />)
    expect(captureSigmaSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      labelColor: { color: '#edf3fc' },
      defaultEdgeColor: '#697991',
      defaultDrawNodeHover: expect.any(Function),
    }))

    document.documentElement.dataset.theme = 'light'
    await waitFor(() => expect(captureSigmaSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      labelColor: { color: '#152036' },
      defaultEdgeColor: '#738198',
      defaultDrawNodeHover: expect.any(Function),
    })))
  })

  it('represents career history as dated ranges with a readable table', () => {
    const rows: ProfileGraphData['river'] = [
      { id: 'experience-1', kind: 'experience', title: 'Lead Engineer', organization: 'Example Systems', start: '2021-01-01', end: '2024-06-30' },
      { id: 'education-1', kind: 'education', title: 'MSc Data Science', organization: 'Example University', start: '2018-03-01', end: '2020-12-01' },
    ]
    renderEnglish(<CareerRiver rows={rows} />)
    expect(screen.getByRole('img', { name: 'Career duration timeline chart' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Read career timeline as a table'))
    const table = screen.getByRole('table')
    expect(within(table).getByText('Lead Engineer')).toBeInTheDocument()
    expect(within(table).getByText('Example University')).toBeInTheDocument()
    expect(within(table).getByText('2021-01-01')).toBeInTheDocument()
  })

  it('switches opportunity analysis between ranked skills, seniority, and industries', () => {
    const data: Landscape = {
      denominator: 4,
      skills: { Python: 4, Kubernetes: 2 },
      seniority: { Senior: 3, Lead: 1 },
      industries: { Mining: 2, Software: 2 },
      opportunities: [],
      warning: 'Counts describe only saved opportunities.',
    }
    renderEnglish(<OpportunityLandscape data={data} />)
    expect(screen.getByRole('img', { name: 'skills across saved opportunity research' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seniority' }))
    expect(screen.getByRole('img', { name: 'seniority across saved opportunity research' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Read this landscape as a table'))
    expect(screen.getByRole('cell', { name: 'Senior' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Industries' }))
    expect(screen.getByRole('cell', { name: 'Mining' })).toBeInTheDocument()
  })

  it('surfaces the lowest-supported match category as the priority gap', () => {
    const run: MatchRun = {
      id: 'match-1', opportunity_id: 'opportunity-1', policy_version: 'test', input_digest: 'digest',
      lower_bound: 0.38, upper_bound: 0.71, coverage: 0.62, eligibility: 'unknown', assessments: [], created_at: '2026-08-04T00:00:00Z',
      components: { by_category: { Technical: { score: 0.76, coverage: 0.9, requirements: 5 }, Leadership: { score: 0.31, coverage: 0.4, requirements: 2 } } },
    }
    renderEnglish(<MatchWaterfall run={run} />)
    const breakdown = screen.getByLabelText('Requirement category breakdown')
    const articles = within(breakdown).getAllByRole('article')
    const priority = articles[0]
    expect(priority).toBeDefined()
    expect(within(priority!).getByText('Priority gap')).toBeInTheDocument()
    expect(within(priority!).getByText('Leadership')).toBeInTheDocument()
    expect(within(priority!).getByText('40% coverage · 2 requirements')).toBeInTheDocument()
  })
})
