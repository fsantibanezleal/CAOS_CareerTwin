import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { EvidenceList } from './EvidenceList'
import type { MatchRun, Opportunity } from '../types'

/**
 * Cross-role workbench: which role fits best, which requirements recur across the roles
 * being considered, and where the candidate is weak in more than one of them.
 *
 * One instrument. The columns are the roles, and each column header carries the role's
 * fit and a fit bar, best fit first: the ranking is the header row rather than a separate
 * block above a table that repeated the same roles. It ranked by coverage until v0.10.1,
 * which read 100% for every role and compared nothing.
 *
 * Laid out against ADR-0071. Requirements are split by importance into tabs, section 6:
 * content that does not fit is split, not scrolled. The largest group fits at 1280x800;
 * only "All" may scroll, inside the matrix. The view opens on the gaps when there are any,
 * because that is the actionable view.
 */

type Assessment = MatchRun['assessments'][number]
type StatusKey = 'missing' | 'conflict' | 'partial' | 'unknown' | 'met'
type Importance = 'required' | 'eligibility' | 'preferred'
type Tab = Importance | 'all'

const STATUS_KEYS: StatusKey[] = ['missing', 'conflict', 'partial', 'unknown', 'met']
const STATUS_RANK: Record<string, number> = { missing: 0, conflict: 1, partial: 2, unknown: 3, met: 4 }
const IMPORTANCE_RANK: Record<string, number> = { required: 0, eligibility: 1, preferred: 2 }
const TABS: Tab[] = ['required', 'eligibility', 'preferred', 'all']

function statusOf(value: string): StatusKey {
  return (STATUS_KEYS as string[]).includes(value) ? (value as StatusKey) : 'unknown'
}

function importanceOf(value: string): Importance {
  return value === 'eligibility' || value === 'preferred' ? value : 'required'
}

function pct(value: number | undefined | null): number {
  return Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)
}

type Cell = { run: MatchRun; assessment: Assessment }
type Row = { label: string; importance: Importance; cells: Map<string, Cell> }

export function CoverageWorkbench({
  runs,
  opportunities,
  onOpenRole,
}: {
  runs: MatchRun[]
  opportunities: Opportunity[]
  /** Opens the per-role detail; the header is a button only when this is provided. */
  onOpenRole?: (opportunityId: string) => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState<{ requirement: string; opportunity: string } | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const byId = useMemo(() => {
    const map = new Map<string, Opportunity>()
    for (const item of opportunities) map.set(item.id, item)
    return map
  }, [opportunities])

  /** Newest run per role, best fit first. A run too thin to score sorts last. */
  const columns = useMemo(() => {
    const latest = new Map<string, MatchRun>()
    for (const run of runs) {
      const prior = latest.get(run.opportunity_id)
      if (!prior || run.created_at > prior.created_at) latest.set(run.opportunity_id, run)
    }
    return [...latest.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  }, [runs])

  /** Requirement label is the row key: the same capability asked by several employers is one row. */
  const rows = useMemo(() => {
    const map = new Map<string, Row>()
    for (const run of columns) {
      for (const assessment of run.assessments) {
        const key = assessment.label.toLowerCase()
        const importance = importanceOf(assessment.importance)
        const row = map.get(key) ?? { label: assessment.label, importance, cells: new Map() }
        // A requirement asked as "required" by any role is a required row.
        if ((IMPORTANCE_RANK[importance] ?? 9) < (IMPORTANCE_RANK[row.importance] ?? 9)) row.importance = importance
        row.cells.set(run.opportunity_id, { run, assessment })
        map.set(key, row)
      }
    }
    return [...map.values()]
  }, [columns])

  const isGap = (row: Row) => [...row.cells.values()].some((cell) => statusOf(cell.assessment.status) !== 'met')
  const gapCount = useMemo(() => rows.filter(isGap).length, [rows])

  // Open on the gaps when there are any: that is the view a candidate acts on.
  const [gapsOnly, setGapsOnly] = useState<boolean | null>(null)
  const showGapsOnly = gapsOnly ?? gapCount > 0

  const tabCounts = useMemo(() => {
    const scoped = showGapsOnly ? rows.filter(isGap) : rows
    const out: Record<Tab, number> = { required: 0, eligibility: 0, preferred: 0, all: scoped.length }
    for (const row of scoped) out[row.importance] += 1
    return out
  }, [rows, showGapsOnly])

  // With the gap view on, open the first importance group that has gaps in it.
  const [tabChoice, setTabChoice] = useState<Tab | null>(null)
  const tab: Tab = tabChoice ?? (TABS.find((key) => key !== 'all' && tabCounts[key] > 0) ?? 'all')

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const worst = (row: Row) => Math.min(...[...row.cells.values()].map((cell) => STATUS_RANK[cell.assessment.status] ?? 9), 9)
    return rows
      .filter((row) => (tab === 'all' ? true : row.importance === tab))
      .filter((row) => (showGapsOnly ? isGap(row) : true))
      .filter((row) => (needle ? row.label.toLowerCase().includes(needle) : true))
      // Worst gap first, then the requirements more roles ask for, then by name.
      .sort((a, b) => worst(a) - worst(b) || b.cells.size - a.cells.size || a.label.localeCompare(b.label))
  }, [rows, tab, showGapsOnly, query])

  const detail = useMemo(() => {
    if (!focused) return null
    const row = rows.find((item) => item.label.toLowerCase() === focused.requirement)
    const cell = row?.cells.get(focused.opportunity)
    if (!row || !cell) return null
    return { row, cell, opportunity: byId.get(focused.opportunity) }
  }, [focused, rows, byId])

  useEffect(() => {
    if (!detail) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocused(null)
    }
    window.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [detail])

  if (columns.length === 0) {
    return <p className="cw-empty">{t('No match runs yet. Run a match to populate this view.')}</p>
  }

  return (
    <div className="cw">
      <div className="cw-controls">
        <nav className="cw-tabs" aria-label={t('Requirement importance')}>
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              className={tab === key ? 'active' : ''}
              aria-pressed={tab === key}
              onClick={() => setTabChoice(key)}
            >
              {t(key === 'all' ? 'All' : key)} <span>{tabCounts[key]}</span>
            </button>
          ))}
        </nav>
        <label className="cw-toggle">
          <input type="checkbox" checked={showGapsOnly} onChange={(event) => setGapsOnly(event.target.checked)} />
          {t('Gaps only')} <span>{gapCount}</span>
        </label>
        <label className="cw-search">
          <Search aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search requirements')}
            aria-label={t('Search requirements')}
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label={t('Clear search')}>
              <X aria-hidden />
            </button>
          ) : null}
        </label>
      </div>

      <div className="cw-matrix-scroll">
        <table className="cw-matrix" aria-label={t('Opportunities ranked by fit')}>
          <thead>
            <tr>
              <th scope="col" className="cw-corner">{t('Requirement')}</th>
              {columns.map((run) => {
                const opportunity = byId.get(run.opportunity_id)
                const fit = run.score != null ? pct(run.score) : null
                const label = (
                  <>
                    <b>{opportunity?.employer ?? t('Unknown')}</b>
                    <small>{opportunity?.title ?? ''}</small>
                    <span className="cw-fit">
                      <i style={{ width: `${fit ?? 0}%` }} />
                    </span>
                    <em className="cw-rank-value">{fit === null ? '–' : `${fit}% ${t('fit')}`}</em>
                  </>
                )
                return (
                  <th
                    key={run.id}
                    scope="col"
                    className="cw-rank-row"
                    title={t('{fit}% fit, {coverage}% of requirements evaluated', { fit: fit ?? 0, coverage: pct(run.coverage) })}
                  >
                    {onOpenRole ? (
                      <button type="button" className="cw-role" onClick={() => onOpenRole(run.opportunity_id)}>
                        {label}
                      </button>
                    ) : (
                      <span className="cw-role">{label}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.label}>
                <th scope="row" title={row.label}>
                  <span className="cw-label">{row.label}</span>
                </th>
                {columns.map((run) => {
                  const cell = row.cells.get(run.opportunity_id)
                  if (!cell) return <td key={run.id} className="cw-cell absent" aria-label={t('Not requested')} />
                  const key = statusOf(cell.assessment.status)
                  const isFocused =
                    focused?.requirement === row.label.toLowerCase() && focused?.opportunity === run.opportunity_id
                  return (
                    <td key={run.id} className="cw-cell">
                      <button
                        type="button"
                        className={isFocused ? `cw-dot ${key} active` : `cw-dot ${key}`}
                        onClick={() => setFocused({ requirement: row.label.toLowerCase(), opportunity: run.opportunity_id })}
                        aria-label={`${row.label}: ${t(key)}`}
                        title={t(key)}
                      >
                        {t(key)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 ? (
          <p className="cw-empty">
            {showGapsOnly && gapCount === 0 ? t('No gaps across your roles.') : t('No requirement matches these filters.')}
          </p>
        ) : null}
      </div>

      {detail ? (
        <aside className="cw-detail" ref={dialogRef} tabIndex={-1} role="dialog" aria-label={t('Requirement detail')}>
          <header>
            <span className={`cw-badge ${statusOf(detail.cell.assessment.status)}`}>{t(detail.cell.assessment.status)}</span>
            <button type="button" onClick={() => setFocused(null)} aria-label={t('Close')}>
              <X aria-hidden />
            </button>
          </header>
          <h3>{detail.row.label}</h3>
          <p className="cw-detail-meta">
            {detail.opportunity?.employer} &middot; {t(detail.cell.assessment.importance)}
          </p>
          {detail.cell.assessment.explanation ? <p>{detail.cell.assessment.explanation}</p> : null}
          <EvidenceList ids={detail.cell.assessment.evidence_ids} status={detail.cell.assessment.status} />
        </aside>
      ) : null}
    </div>
  )
}
