import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import type { MatchRun, Opportunity } from '../types'
import { CoverageWorkbench } from './CoverageWorkbench'

/**
 * The ranking compared nothing: it ranked roles by coverage, the share of requirements the
 * matcher could evaluate, and every role read 100%. An 82% fit sat level with 99% fits.
 * These tests hold the ranking to fit, with every role at full coverage so that coverage
 * cannot separate them and a regression to it shows immediately.
 */

function opportunity(id: string, employer: string, title: string): Opportunity {
  return {
    id,
    title,
    employer,
    description: '',
    source_kind: 'manual',
    industry: '',
    area: '',
    seniority: '',
    location: '',
    remote_mode: 'unspecified',
    compensation: {},
    status: 'watching',
    version: 1,
    structured_data: {},
    requirements: [],
    created_at: '2026-09-17T00:00:00Z',
    updated_at: '2026-09-17T00:00:00Z',
  }
}

function run(opportunityId: string, score: number): MatchRun {
  return {
    id: `run-${opportunityId}`,
    opportunity_id: opportunityId,
    policy_version: 'match-v1.1.0',
    input_digest: opportunityId,
    score,
    lower_bound: score,
    upper_bound: score,
    coverage: 1,
    eligibility: 'eligible',
    components: {},
    assessments: [
      {
        requirement_id: `req-${opportunityId}`,
        label: 'Data Governance',
        category: 'skill',
        importance: 'required',
        status: 'met',
        score: 1,
        evidence_ids: [],
        explanation: 'Evidenced.',
      },
    ],
    created_at: '2026-09-17T00:00:00Z',
  }
}

function renderWorkbench() {
  const opportunities = [
    opportunity('ultranav', 'Ultranav', 'Head of Data & Data Governance'),
    opportunity('global66', 'Global66', 'Head of Data & Analytics'),
    opportunity('confidencial', 'Empresa Confidencial', 'Subgerente de IA'),
  ]
  // Deliberately listed worst first, so the order on screen has to come from sorting.
  const runs = [run('ultranav', 0.822), run('global66', 0.986), run('confidencial', 0.958)]
  return render(
    <I18nProvider initial="en">
      <CoverageWorkbench runs={runs} opportunities={opportunities} />
    </I18nProvider>,
  )
}

describe('CoverageWorkbench ranking', () => {
  afterEach(cleanup)

  it('orders roles by fit, not by coverage', () => {
    renderWorkbench()
    const ranking = screen.getByRole('region', { name: 'Opportunities ranked by fit' })
    const employers = within(ranking).getAllByRole('article').map((row) => row.querySelector('b')?.textContent)
    expect(employers).toEqual(['Global66', 'Empresa Confidencial', 'Ultranav'])
  })

  it('prints the fit, labelled, for each role', () => {
    renderWorkbench()
    const ranking = screen.getByRole('region', { name: 'Opportunities ranked by fit' })
    const values = within(ranking).getAllByRole('article').map((row) => row.querySelector('.cw-rank-value')?.textContent)
    expect(values).toEqual(['99% fit', '96% fit', '82% fit'])
  })

  it('never prints coverage as the ranked value', () => {
    renderWorkbench()
    const ranking = screen.getByRole('region', { name: 'Opportunities ranked by fit' })
    // Every role here is at 100% coverage. If coverage were ranked, every value would read 100%.
    expect(within(ranking).queryByText('100%')).toBeNull()
  })
})
