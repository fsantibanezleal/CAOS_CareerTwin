import { AlertTriangle, CheckCircle2, CircleHelp, CircleOff, FileText, Pencil, ShieldQuestion, X } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'
import { useI18n } from '../i18n'
import type { MatchRun, Opportunity } from '../types'
import { SalaryBand, type Compensation } from './SalaryBand'

/**
 * The opportunity brief: is this role worth pursuing, what does it pay, and where
 * exactly are the gaps.
 *
 * What this replaces: a data-entry form. The screen opened on a textarea holding raw
 * unrendered markdown, followed by one editable row per requirement, each carrying an
 * importance dropdown, a category dropdown, a text input and a weight spinner. Twelve
 * requirements produced forty-eight form controls and not one statement about fit. The
 * single question a candidate has when opening a role had no answer anywhere on it.
 *
 * The layout is sized to its container and never grows the page. Requirements are a
 * dense status grid rather than a list, so a whole role is legible at once and
 * selecting one is a click rather than a scroll.
 */

type Status = 'met' | 'partial' | 'unknown' | 'missing' | 'conflict'

const ORDER: Status[] = ['met', 'partial', 'unknown', 'missing', 'conflict']

const ICON: Record<Status, ReactElement> = {
  met: <CheckCircle2 />,
  partial: <CircleHelp />,
  unknown: <ShieldQuestion />,
  missing: <CircleOff />,
  conflict: <AlertTriangle />,
}

const IMPORTANCE_RANK: Record<string, number> = { required: 0, eligibility: 1, preferred: 2 }
const STATUS_RANK: Record<Status, number> = { missing: 0, conflict: 1, partial: 2, unknown: 3, met: 4 }

function statusOf(value: string | undefined): Status {
  return value && value in STATUS_RANK ? (value as Status) : 'unknown'
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

function CoverageRing({ value, label }: { value: number | null; label: string }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const filled = value === null ? 0 : circumference * value
  return (
    <div className="ob-ring" role="img" aria-label={`${label}: ${value === null ? '—' : Math.round(value * 100)}%`}>
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={radius} className="ob-ring-track" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          className="ob-ring-value"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeDashoffset={circumference / 4}
        />
      </svg>
      <b>{value === null ? '—' : `${Math.round(value * 100)}%`}</b>
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
    return (opportunity.requirements ?? [])
      .map((requirement) => {
        const assessment = byLabel.get(requirement.label.toLowerCase())
        return { requirement, assessment, status: statusOf(assessment?.status) }
      })
      .sort((a, b) => {
        if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
        const ia = IMPORTANCE_RANK[a.requirement.importance] ?? 9
        const ib = IMPORTANCE_RANK[b.requirement.importance] ?? 9
        return ia === ib ? a.requirement.label.localeCompare(b.requirement.label) : ia - ib
      })
  }, [opportunity.requirements, run])

  const counts = useMemo(() => {
    const out: Record<Status, number> = { met: 0, partial: 0, unknown: 0, missing: 0, conflict: 0 }
    for (const row of rows) out[row.status] += 1
    return out
  }, [rows])

  const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter)
  const detail = rows.find((row) => row.requirement.id === selected) ?? null
  const compensation = opportunity.compensation as unknown as Compensation
  const gaps = counts.missing + counts.conflict

  return (
    <section className="ob" aria-label={t('Opportunity brief')}>
      <header className="ob-head">
        <div className="ob-identity">
          <span className="ob-eyebrow">{opportunity.employer || t('Employer unknown')}</span>
          <h2>{opportunity.title}</h2>
          <p>{[opportunity.seniority, opportunity.location, t(opportunity.remote_mode)].filter(Boolean).join(' · ')}</p>
        </div>

        <div className="ob-verdict">
          <CoverageRing value={run ? run.coverage : null} label={t('Requirement coverage')} />
          <dl>
            <div>
              <dt>{t('Requirements met')}</dt>
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

        <div className="ob-head-actions">
          <button type="button" className="button ghost" onClick={() => setPosting(true)}>
            <FileText aria-hidden /> {t('Posting')}
          </button>
          <button type="button" className="button ghost" onClick={onEdit}>
            <Pencil aria-hidden /> {t('Edit')}
          </button>
        </div>
      </header>

      <div className="ob-body">
        <section className="ob-reqs" aria-label={t('Requirements against your evidence')}>
          <nav className="ob-filters">
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
          </nav>

          <div className="ob-grid">
            {visible.map(({ requirement, status, assessment }) => (
              <button
                key={requirement.id}
                type="button"
                className={`ob-chip ${status} ${selected === requirement.id ? 'selected' : ''}`}
                onClick={() => setSelected(selected === requirement.id ? undefined : requirement.id)}
                aria-pressed={selected === requirement.id}
              >
                <span className="ob-chip-icon">{ICON[status]}</span>
                <span className="ob-chip-label">{requirement.label}</span>
                <span className={`ob-chip-imp ${requirement.importance}`}>
                  {t(requirement.importance).slice(0, 3)}
                </span>
                {assessment?.score !== undefined && assessment?.score !== null ? (
                  <span className="ob-chip-score">{Math.round(assessment.score * 100)}</span>
                ) : null}
              </button>
            ))}
            {visible.length === 0 ? (
              <p className="ob-empty">
                {rows.length === 0 ? t('No requirements captured for this role yet.') : t('Nothing in this status.')}
              </p>
            ) : null}
          </div>
        </section>

        <aside className="ob-side">
          <SalaryBand compensation={compensation} />
          {!compensation?.floor ? (
            <p className="ob-nosalary">{t('No compensation band researched for this role yet.')}</p>
          ) : null}

          <div className={`ob-detail ${detail ? 'filled' : ''}`}>
            {detail ? (
              <>
                <span className={`ob-detail-status ${detail.status}`}>
                  {ICON[detail.status]} {t(detail.status)}
                </span>
                <h4>{detail.requirement.label}</h4>
                <p>{detail.assessment?.explanation ?? t('This requirement has not been evaluated in a match run yet.')}</p>
                <dl>
                  <div><dt>{t('Importance')}</dt><dd>{t(detail.requirement.importance)}</dd></div>
                  <div><dt>{t('Weight')}</dt><dd>{detail.requirement.weight}</dd></div>
                  <div><dt>{t('Evidence')}</dt><dd>{detail.assessment?.evidence_ids?.length ?? 0}</dd></div>
                </dl>
              </>
            ) : (
              <p className="ob-detail-hint">{t('Select a requirement to see what answers it.')}</p>
            )}
          </div>
        </aside>
      </div>

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
