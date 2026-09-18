import { AlertTriangle, CheckCircle2, CircleHelp, CircleOff, FileText, Pencil, ShieldQuestion, X } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'
import { useI18n } from '../i18n'
import type { MatchRun, Opportunity } from '../types'
import { EvidenceList } from './EvidenceList'
import { SalaryBand, type Compensation } from './SalaryBand'

/**
 * The opportunity brief: is this role worth pursuing, what does it pay, and where
 * exactly are the gaps.
 *
 * What this replaced: a data-entry form. The screen opened on a textarea holding raw
 * unrendered markdown, then one editable row per requirement, each with an importance
 * dropdown, a category dropdown, a text input and a weight spinner: forty-eight form
 * controls for twelve requirements and no statement anywhere about fit.
 *
 * Layout follows ADR-0071. The brief is sized to its container and never grows the
 * page. Requirements are split by importance into columns, per section 6: content that
 * does not fit is split, not scrolled. That spends width, which the screen has, instead
 * of height, which it does not: the largest column in the current data holds eight
 * requirements against eighteen as a single list. The selected requirement opens as an
 * overlay rather than holding a permanent column.
 */

type Status = 'met' | 'partial' | 'unknown' | 'missing' | 'conflict'
type Importance = 'required' | 'eligibility' | 'preferred'

const ORDER: Status[] = ['met', 'partial', 'unknown', 'missing', 'conflict']
const GROUPS: Importance[] = ['required', 'eligibility', 'preferred']

const ICON: Record<Status, ReactElement> = {
  met: <CheckCircle2 />,
  partial: <CircleHelp />,
  unknown: <ShieldQuestion />,
  missing: <CircleOff />,
  conflict: <AlertTriangle />,
}

// Gaps first within a column: the requirement a candidate must address is the one to see.
const STATUS_RANK: Record<Status, number> = { missing: 0, conflict: 1, partial: 2, unknown: 3, met: 4 }

function statusOf(value: string | undefined): Status {
  return value && value in STATUS_RANK ? (value as Status) : 'unknown'
}

function importanceOf(value: string): Importance {
  return value === 'eligibility' || value === 'preferred' ? value : 'required'
}

/** Markdown to readable blocks. A textarea of raw `#` and `**` is not a document. */
function readable(text: string): ReactElement[] {
  const blocks: ReactElement[] = []
  let bullets: string[] = []

  const inline = (value: string) =>
    value.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
      part.startsWith('**') && part.endsWith('**')
        ? <b key={index}>{part.slice(2, -2)}</b>
        : <span key={index}>{part}</span>,
    )

  const flush = (key: string) => {
    if (!bullets.length) return
    blocks.push(<ul key={`u${key}`}>{bullets.map((item, index) => <li key={index}>{inline(item)}</li>)}</ul>)
    bullets = []
  }

  text.split('\n').forEach((raw, index) => {
    const line = raw.trim()
    const key = String(index)
    if (/^[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+/, ''))
      return
    }
    flush(key)
    if (!line || /^-{3,}$/.test(line)) return
    if (line.startsWith('|')) {
      // A pipe table pasted from a posting reads as noise; keep its cells as a line.
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean)
      if (cells.length && !cells.every((cell) => /^:?-+:?$/.test(cell))) {
        blocks.push(<p key={key} className="ob-kv">{inline(cells.join(' · '))}</p>)
      }
      return
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push((heading[1]?.length ?? 0) <= 2 ? <h4 key={key}>{heading[2]}</h4> : <h5 key={key}>{heading[2]}</h5>)
      return
    }
    blocks.push(<p key={key}>{inline(line)}</p>)
  })
  flush('end')
  return blocks
}

/**
 * The fit, drawn. The number it depicts is printed and labelled beside it, because an
 * unlabelled percentage in a ring was read as a match score when it was coverage.
 */
function FitRing({ value }: { value: number | null }) {
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const filled = value === null ? 0 : circumference * value
  return (
    <div className="ob-ring" aria-hidden>
      <svg viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r={radius} className="ob-ring-track" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          className="ob-ring-value"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeDashoffset={circumference / 4}
        />
      </svg>
    </div>
  )
}

export function OpportunityBrief({
  opportunity,
  run,
  onEdit,
}: {
  opportunity: Opportunity
  run?: MatchRun
  onEdit: () => void
}) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [selected, setSelected] = useState<string>()
  const [posting, setPosting] = useState(false)

  const rows = useMemo(() => {
    const byLabel = new Map<string, MatchRun['assessments'][number]>()
    for (const item of run?.assessments ?? []) byLabel.set(item.label.toLowerCase(), item)
    return (opportunity.requirements ?? []).map((requirement) => {
      const assessment = byLabel.get(requirement.label.toLowerCase())
      return {
        requirement,
        assessment,
        status: statusOf(assessment?.status),
        importance: importanceOf(requirement.importance),
      }
    })
  }, [opportunity.requirements, run])

  const counts = useMemo(() => {
    const out: Record<Status, number> = { met: 0, partial: 0, unknown: 0, missing: 0, conflict: 0 }
    for (const row of rows) out[row.status] += 1
    return out
  }, [rows])

  const columns = useMemo(() => {
    const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter)
    return GROUPS.map((importance) => ({
      importance,
      items: visible
        .filter((row) => row.importance === importance)
        .sort((a, b) =>
          STATUS_RANK[a.status] !== STATUS_RANK[b.status]
            ? STATUS_RANK[a.status] - STATUS_RANK[b.status]
            : a.requirement.label.localeCompare(b.requirement.label),
        ),
    })).filter((column) => column.items.length > 0)
  }, [rows, filter])

  const detail = rows.find((row) => row.requirement.id === selected) ?? null
  const compensation = opportunity.compensation as unknown as Compensation
  const gaps = counts.missing + counts.conflict
  // An absent work mode is omitted, not printed as the word "unspecified".
  const workMode = opportunity.remote_mode && opportunity.remote_mode !== 'unspecified' ? t(opportunity.remote_mode) : ''
  const meta = [opportunity.employer || t('Employer unknown'), opportunity.seniority, opportunity.location, workMode]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="ob" aria-label={t('Opportunity brief')}>
      <header className="ob-head">
        <div className="ob-identity">
          <h2 title={opportunity.title}>{opportunity.title}</h2>
          <p title={meta}>{meta}</p>
        </div>
        <div className="ob-verdict">
          <FitRing value={run?.score ?? null} />
          <dl>
            <div title={run ? t('{coverage}% of requirements evaluated', { coverage: Math.round(run.coverage * 100) }) : undefined}>
              <dt>{t('Fit')}</dt>
              <dd className="fit">{run?.score != null ? `${Math.round(run.score * 100)}%` : '–'}</dd>
            </div>
            <div>
              <dt>{t('Met')}</dt>
              <dd>{counts.met}<span>/{rows.length}</span></dd>
            </div>
            <div>
              <dt>{t('Gaps')}</dt>
              <dd className={gaps ? 'warn' : 'clear'}>{gaps}</dd>
            </div>
            <div>
              <dt>{t('Eligibility')}</dt>
              <dd className={`elig ${run?.eligibility ?? 'unknown'}`}>{t(run?.eligibility ?? 'unknown')}</dd>
            </div>
          </dl>
        </div>
      </header>

      {compensation?.floor !== undefined ? (
        <SalaryBand compensation={compensation} variant="strip" />
      ) : (
        <p className="ob-nosalary">{t('No compensation band researched for this role yet.')}</p>
      )}

      <nav className="ob-filters" aria-label={t('Filter by status')}>
        <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          {t('All')} <span>{rows.length}</span>
        </button>
        {ORDER.filter((status) => counts[status] > 0).map((status) => (
          <button
            key={status}
            type="button"
            className={`${status} ${filter === status ? 'active' : ''}`}
            onClick={() => setFilter(filter === status ? 'all' : status)}
          >
            {ICON[status]} {t(status)} <span>{counts[status]}</span>
          </button>
        ))}
        <span className="ob-filters-actions">
          <button type="button" className="ob-action" onClick={() => setPosting(true)}>
            <FileText aria-hidden /> {t('Posting')}
          </button>
          <button type="button" className="ob-action" onClick={onEdit}>
            <Pencil aria-hidden /> {t('Edit')}
          </button>
        </span>
      </nav>

      <div className="ob-columns" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <section key={column.importance} className="ob-col" data-importance={column.importance} aria-label={t(column.importance)}>
            <h3>
              {t(column.importance)} <span>{column.items.length}</span>
            </h3>
            <ul>
              {column.items.map(({ requirement, status }) => (
                <li key={requirement.id}>
                  <button
                    type="button"
                    className={`ob-chip ${status} ${selected === requirement.id ? 'selected' : ''}`}
                    onClick={() => setSelected(selected === requirement.id ? undefined : requirement.id)}
                    aria-pressed={selected === requirement.id}
                    title={requirement.label}
                  >
                    <span className="ob-chip-icon" aria-label={t(status)}>{ICON[status]}</span>
                    <span className="ob-chip-label">{requirement.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {columns.length === 0 ? (
          <p className="ob-empty">
            {rows.length === 0 ? t('No requirements captured for this role yet.') : t('Nothing in this status.')}
          </p>
        ) : null}
      </div>

      {detail ? (
        <aside className="ob-detail" aria-label={t('Requirement detail')}>
          <header>
            <span className={`ob-detail-status ${detail.status}`}>
              {ICON[detail.status]} {t(detail.status)}
            </span>
            <button type="button" className="icon-button" onClick={() => setSelected(undefined)} aria-label={t('Close')}>
              <X />
            </button>
          </header>
          <h4>{detail.requirement.label}</h4>
          <p>{detail.assessment?.explanation ?? t('This requirement has not been evaluated in a match run yet.')}</p>
          <dl>
            <div><dt>{t('Importance')}</dt><dd>{t(detail.importance)}</dd></div>
            <div><dt>{t('Weight')}</dt><dd>{detail.requirement.weight}</dd></div>
            <div><dt>{t('Score')}</dt><dd>{detail.assessment?.score != null ? Math.round(detail.assessment.score * 100) : '–'}</dd></div>
          </dl>
          <EvidenceList ids={detail.assessment?.evidence_ids ?? []} status={detail.assessment?.status} />
        </aside>
      ) : null}

      {posting ? (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPosting(false)}>
          <section className="ob-posting" role="dialog" aria-modal="true" aria-label={t('Posting')}>
            <header>
              <h3>{opportunity.title}</h3>
              <button type="button" className="icon-button" onClick={() => setPosting(false)} aria-label={t('Close')}>
                <X />
              </button>
            </header>
            <div className="ob-posting-body">{readable(opportunity.description ?? '')}</div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
