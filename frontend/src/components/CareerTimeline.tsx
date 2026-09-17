import { Building2, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { Education, Experience } from '../types'

/**
 * A career timeline where every bar carries its own name.
 *
 * The previous "career river" drew two flat lanes, one pink for education and one
 * orange for experience, with no label on any bar. Eleven roles collapsed into a
 * single undifferentiated rectangle spanning fifteen years, from which no individual
 * job could be read. A timeline whose bars are anonymous conveys only "something
 * happened", which is not worth the space it occupies.
 *
 * Here each role is its own labelled row, positioned and scaled by its real dates,
 * sorted most recent first, expandable to its achievements.
 */

type Row = {
  id: string
  kind: 'experience' | 'education'
  title: string
  organization: string
  start: number
  end: number
  current: boolean
  detail: string[]
  summary: string
}

/** Fractional year from an ISO-ish date, so a mid-year start is not rounded to January. */
function toYear(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback
  const parts = String(value).split('-')
  const year = Number(parts[0])
  if (!Number.isFinite(year)) return fallback
  const month = Number(parts[1] ?? '1')
  return year + (Number.isFinite(month) ? (month - 1) / 12 : 0)
}

function formatYear(value: number): string {
  return String(Math.floor(value))
}

export function CareerTimeline({
  experiences,
  education,
}: {
  experiences: Experience[]
  education: Education[]
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [lens, setLens] = useState<'all' | 'experience' | 'education'>('all')

  const nowYear = new Date().getFullYear() + new Date().getMonth() / 12

  const rows = useMemo<Row[]>(() => {
    const fromExperience: Row[] = experiences.map((item) => ({
      id: `x-${item.id}`,
      kind: 'experience',
      title: item.role,
      organization: item.organization,
      start: toYear(item.start_date, nowYear),
      end: item.current ? nowYear : toYear(item.end_date, nowYear),
      current: item.current,
      summary: item.summary ?? '',
      detail: (item.achievements ?? [])
        .map((entry) => String((entry as Record<string, unknown>).statement ?? (entry as Record<string, unknown>).text ?? ''))
        .filter(Boolean),
    }))
    const fromEducation: Row[] = education.map((item) => ({
      id: `e-${item.id}`,
      kind: 'education',
      title: item.credential,
      organization: item.institution,
      start: toYear(item.start_date, nowYear),
      end: toYear(item.end_date, nowYear),
      current: !item.end_date,
      summary: item.field ?? '',
      detail: item.details ? [item.details] : [],
    }))
    const all = [...fromExperience, ...fromEducation]
    const filtered = lens === 'all' ? all : all.filter((row) => row.kind === lens)
    return filtered.sort((a, b) => b.start - a.start)
  }, [experiences, education, lens, nowYear])

  const span = useMemo(() => {
    if (rows.length === 0) return { min: nowYear - 1, max: nowYear }
    const min = Math.floor(Math.min(...rows.map((row) => row.start)))
    const max = Math.ceil(Math.max(...rows.map((row) => row.end)))
    return { min, max: Math.max(max, min + 1) }
  }, [rows, nowYear])

  const ticks = useMemo(() => {
    const total = span.max - span.min
    const step = total > 20 ? 5 : total > 10 ? 2 : 1
    const out: number[] = []
    for (let year = Math.ceil(span.min / step) * step; year <= span.max; year += step) out.push(year)
    return out
  }, [span])

  const place = (value: number) => ((value - span.min) / (span.max - span.min)) * 100

  return (
    <div className="ct">
      <div className="ct-lens" role="group" aria-label={t('Filter timeline')}>
        {(['all', 'experience', 'education'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={lens === key ? 'active' : ''}
            onClick={() => setLens(key)}
            aria-pressed={lens === key}
          >
            {t(key === 'all' ? 'All' : key === 'experience' ? 'Experience' : 'Education')}
          </button>
        ))}
        <span className="ct-span">{t('{from} to {to}', { from: span.min, to: span.max })}</span>
      </div>

      <div className="ct-axis" aria-hidden>
        {ticks.map((year) => (
          <span key={year} style={{ left: `${place(year)}%` }}>
            {year}
          </span>
        ))}
      </div>

      <ol className="ct-rows">
        {rows.map((row) => {
          const left = place(row.start)
          const width = Math.max(place(row.end) - left, 1.5)
          const open = expanded === row.id
          return (
            <li key={row.id} className={`ct-row ${row.kind}${open ? ' open' : ''}`}>
              <button
                type="button"
                className="ct-head"
                onClick={() => setExpanded(open ? null : row.id)}
                aria-expanded={open}
              >
                <span className="ct-meta">
                  <b>{row.title}</b>
                  <small>
                    <Building2 aria-hidden /> {row.organization}
                  </small>
                </span>
                <span className="ct-track">
                  <i
                    className={`${row.current ? 'current' : ''}${width < 9 ? ' narrow' : ''}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${formatYear(row.start)} – ${row.current ? t('present') : formatYear(row.end)}`}
                  >
                    {/* A label wider than its bar renders as clipped nonsense ("20", "2"),
                        so a short span puts its dates beside the bar instead of inside it. */}
                    {width >= 9 ? (
                      <em>
                        {formatYear(row.start)}&ndash;{row.current ? t('now') : formatYear(row.end)}
                      </em>
                    ) : null}
                  </i>
                  {width < 9 ? (
                    <span className="ct-outside" style={{ left: `calc(${left + width}% + var(--space-2))` }}>
                      {formatYear(row.start)}&ndash;{row.current ? t('now') : formatYear(row.end)}
                    </span>
                  ) : null}
                </span>
                {row.detail.length > 0 ? (
                  <span className="ct-count">
                    {row.detail.length}
                    <ChevronDown aria-hidden />
                  </span>
                ) : (
                  <span className="ct-count empty" />
                )}
              </button>
              {open ? (
                <div className="ct-detail">
                  {row.summary ? <p>{row.summary}</p> : null}
                  {row.detail.length > 0 ? (
                    <ul>
                      {row.detail.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>

      {rows.length === 0 ? <p className="ct-empty">{t('No timeline entries yet.')}</p> : null}
    </div>
  )
}
