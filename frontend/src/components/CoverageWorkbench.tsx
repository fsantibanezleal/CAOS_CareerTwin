import { ArrowDownWideNarrow, Filter, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { MatchRun, Opportunity } from '../types'

/**
 * Coverage workbench: one dense, interactive surface answering the three questions a
 * candidate actually has - how do these roles rank, which requirements are unmet, and
 * what evidence backs the ones that are met.
 *
 * Replaces the force-directed network and the adjacency matrix. Node position in a
 * force layout carries no meaning, so those surfaces signalled "knowledge graph"
 * without answering anything. Here every cell is a requirement-by-opportunity fact,
 * ranking uses sorted bars, and any cell opens the evidence behind it.
 */

type Assessment = MatchRun['assessments'][number]
type StatusKey = 'missing' | 'conflict' | 'partial' | 'unknown' | 'met'

const STATUS_KEYS: StatusKey[] = ['missing', 'conflict', 'partial', 'unknown', 'met']
const STATUS_RANK: Record<string, number> = { missing: 0, conflict: 1, partial: 2, unknown: 3, met: 4 }
const IMPORTANCE_RANK: Record<string, number> = { required: 0, eligibility: 1, preferred: 2 }

function statusOf(value: string): StatusKey {
  return (STATUS_KEYS as string[]).includes(value) ? (value as StatusKey) : 'unknown'
}

function pct(value: number | undefined): number {
  return Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)
}

type Cell = { run: MatchRun; assessment: Assessment }

export function CoverageWorkbench({
  runs,
  opportunities,
}: {
  runs: MatchRun[]
  opportunities: Opportunity[]
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<StatusKey>>(new Set())
  const [importanceFilter, setImportanceFilter] = useState<string>('all')
  const [sortMode, setSortMode] = useState<'gap' | 'label' | 'importance'>('gap')
  const [focused, setFocused] = useState<{ requirement: string; opportunity: string } | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const byId = useMemo(() => {
    const map = new Map<string, Opportunity>()
    for (const item of opportunities) map.set(item.id, item)
    return map
  }, [opportunities])

  /** Newest run per opportunity; a stale run must never outrank a current one. */
  const columns = useMemo(() => {
    const latest = new Map<string, MatchRun>()
    for (const run of runs) {
      const prior = latest.get(run.opportunity_id)
      if (!prior || run.created_at > prior.created_at) latest.set(run.opportunity_id, run)
    }
    return [...latest.values()].sort((a, b) => b.coverage - a.coverage)
  }, [runs])

  /** Requirement label is the row key: the same capability asked by several employers is one row. */
  const rows = useMemo(() => {
    const map = new Map<string, { label: string; importance: string; cells: Map<string, Cell> }>()
    for (const run of columns) {
      for (const assessment of run.assessments) {
        const key = assessment.label.toLowerCase()
        const row = map.get(key) ?? { label: assessment.label, importance: assessment.importance, cells: new Map() }
        if ((IMPORTANCE_RANK[assessment.importance] ?? 9) < (IMPORTANCE_RANK[row.importance] ?? 9)) {
          row.importance = assessment.importance
        }
        row.cells.set(run.opportunity_id, { run, assessment })
        map.set(key, row)
      }
    }
    return [...map.values()]
  }, [columns])

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    let list = rows.filter((row) => {
      if (needle && !row.label.toLowerCase().includes(needle)) return false
      if (importanceFilter !== 'all' && row.importance !== importanceFilter) return false
      if (statusFilter.size > 0) {
        const hit = [...row.cells.values()].some((cell) => statusFilter.has(statusOf(cell.assessment.status)))
        if (!hit) return false
      }
      return true
    })
    const worst = (row: (typeof rows)[number]) =>
      Math.min(...[...row.cells.values()].map((cell) => STATUS_RANK[cell.assessment.status] ?? 9), 9)
    list = [...list]
    if (sortMode === 'gap') list.sort((a, b) => worst(a) - worst(b) || a.label.localeCompare(b.label))
    if (sortMode === 'label') list.sort((a, b) => a.label.localeCompare(b.label))
    if (sortMode === 'importance') {
      list.sort(
        (a, b) =>
          (IMPORTANCE_RANK[a.importance] ?? 9) - (IMPORTANCE_RANK[b.importance] ?? 9) ||
          a.label.localeCompare(b.label),
      )
    }
    return list
  }, [rows, query, statusFilter, importanceFilter, sortMode])

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

  function toggleStatus(key: StatusKey) {
    setStatusFilter((prior) => {
      const next = new Set(prior)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totals = useMemo(() => {
    const counts: Record<StatusKey, number> = { missing: 0, conflict: 0, partial: 0, unknown: 0, met: 0 }
    for (const row of rows) for (const cell of row.cells.values()) counts[statusOf(cell.assessment.status)] += 1
    return counts
  }, [rows])

  if (columns.length === 0) {
    return <p className="cw-empty">{t('No match runs yet. Run a match to populate this view.')}</p>
  }

  return (
    <div className="cw">
      {/* Ranking: sorted horizontal bars, the correct form for comparing categories. */}
      <section className="cw-rank" aria-label={t('Opportunities ranked by requirement coverage')}>
        {columns.map((run) => {
          const opportunity = byId.get(run.opportunity_id)
          return (
            <article key={run.id} className="cw-rank-row">
              <span className="cw-rank-name">
                <b>{opportunity?.employer ?? t('Unknown')}</b>
                <small>{opportunity?.title ?? ''}</small>
              </span>
              <span className="cw-rank-bar">
                <i style={{ width: `${pct(run.coverage)}%` }} />
              </span>
              <span className="cw-rank-value">{pct(run.coverage)}%</span>
            </article>
          )
        })}
      </section>

      <div className="cw-toolbar">
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

        <div className="cw-chips" role="group" aria-label={t('Filter by status')}>
          <Filter aria-hidden />
          {STATUS_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={statusFilter.has(key) ? `cw-chip ${key} active` : `cw-chip ${key}`}
              onClick={() => toggleStatus(key)}
              aria-pressed={statusFilter.has(key)}
            >
              <i /> {t(key)} <em>{totals[key]}</em>
            </button>
          ))}
        </div>

        <label className="cw-select">
          <span>{t('Importance')}</span>
          <select value={importanceFilter} onChange={(event) => setImportanceFilter(event.target.value)}>
            <option value="all">{t('All')}</option>
            <option value="required">{t('required')}</option>
            <option value="eligibility">{t('eligibility')}</option>
            <option value="preferred">{t('preferred')}</option>
          </select>
        </label>

        <label className="cw-select">
          <ArrowDownWideNarrow aria-hidden />
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
            <option value="gap">{t('Worst gaps first')}</option>
            <option value="importance">{t('By importance')}</option>
            <option value="label">{t('Alphabetical')}</option>
          </select>
        </label>
      </div>

      {/* Matrix: requirement rows against opportunity columns. Every cell is a fact and opens its evidence. */}
      <div className="cw-matrix-scroll">
        <table className="cw-matrix">
          <thead>
            <tr>
              <th scope="col">{t('Requirement')}</th>
              {columns.map((run) => (
                <th key={run.id} scope="col" title={byId.get(run.opportunity_id)?.title ?? ''}>
                  {byId.get(run.opportunity_id)?.employer ?? t('Unknown')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.label}>
                <th scope="row">
                  <span className={`cw-importance ${row.importance}`} aria-hidden />
                  {row.label}
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
                        title={`${t(key)}${cell.assessment.evidence_ids.length ? ` · ${cell.assessment.evidence_ids.length} ${t('evidence')}` : ''}`}
                      >
                        {cell.assessment.evidence_ids.length > 0 ? cell.assessment.evidence_ids.length : ''}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 ? <p className="cw-empty">{t('No requirement matches these filters.')}</p> : null}
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
            {detail.opportunity?.employer} &middot; {t(detail.cell.assessment.importance)} &middot;{' '}
            {t('{count} evidence items', { count: detail.cell.assessment.evidence_ids.length })}
          </p>
          {detail.cell.assessment.explanation ? <p>{detail.cell.assessment.explanation}</p> : null}
        </aside>
      ) : null}
    </div>
  )
}
